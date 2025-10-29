#!/usr/bin/env python3
"""
Batch CSV → SQL converter for rheology table (robust numeric + date parsing + multi-moyenne hours).

- Processes every *.csv in --in directory, writes one .sql per file into --out.
- id_slurry = file name (without .csv)
- slurry_type is inferred from file name prefix: M7-3 / R55 / 2CN2
- id_rheology = <id_slurry>_<letter><YYMMDDHHMMSS><F>  (F = Paris offset hours 1 or 2)
- timestamp localized to Europe/Paris at base 13:00:00 and formatted 'YYYY-MM-DDTHH:MM:SS+HH'
- If multiple VISCO MOYENNE exist for same date, insert at 13:00, 14:00, 15:00, ...
- If MOYENNE exists for a date, ignore VISCO 1/2 for that date.
- If no MOYENNE: avg(VISCO 1,2) else single 1 or 2 (at 13:00).
- source = mapped user id
- silice unit = %
- value must be numeric (3 decimals) — rows with empty or non-numeric value are dropped
- per-file USL/LSL by id_slurry prefix: M7-3 / R55 / 2CN2
- Accepts timestamp in: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, DD-MM-YY
- Accepts numeric values like: 0.012, 0,012, "0,012", '0,012'
"""

import argparse
import csv
from dataclasses import dataclass
from datetime import datetime, date, time, timedelta
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import re
import sys

try:
    from zoneinfo import ZoneInfo
except Exception:
    print("This script requires Python 3.9+ (zoneinfo). On Windows, install tzdata if needed: pip install tzdata", file=sys.stderr)
    sys.exit(1)

PARIS_TZ = ZoneInfo("Europe/Paris")

# --- parameter maps & units --- #
PARAM_MAP = {
    "pc": "pc",
    "densite": "density",
    "densité": "density",
    "density": "density",
    "h2o": "H2O",
    "%silice": "silice",
    "silice": "silice",
    "visco 1": "visco1",
    "visco 2": "visco2",
    "visco moyenne": "visco_avg",
    "temperature": "temperature",
    "température": "temperature",
    "ph": "pH",
    "%grain": "grain",
    "grain": "grain",
}

TYPE_LETTER = {
    "viscosity": "v",
    "density": "d",
    "pc": "p",
    "H2O": "h",
    "temperature": "t",
    "pH": "a",
    "silice": "s",
    "grain": "g",
}

DEFAULT_UNITS = {
    "viscosity": "s",
    "density": "g",
    "pc": "g",
    "H2O": "L/h",
    "pH": None,
    "temperature": "°C",
    "silice": "%",   # ensure silice unit is %
    "grain": "%",
}

USER_MAP = [
    ("benoit", "benoit.marie"),
    ("marc", "marc.mendy"),
    ("luc", "luc.essayan"),
    ("aliz", "aliz.pinto-mora"),
]

@dataclass
class Row:
    timestamp: str
    user_id: str
    product: str
    parameter: str
    value: str
    USL: str
    LSL: str

# ---------- Helpers ----------

def normalize_header(h: str) -> str:
    return (h or "").strip().lower()

def _strip_quotes_and_spaces(s: str) -> str:
    s = (s or "").strip()
    # remove surrounding matching quotes once
    if (len(s) >= 2) and ((s[0] == s[-1]) and s[0] in ("'", '"')):
        s = s[1:-1].strip()
    return s

def as_decimal_3(x: Optional[str]) -> Optional[str]:
    """
    Robust numeric parser:
    - strips surrounding quotes
    - trims spaces
    - converts comma to dot IF there is no dot already (e.g., "0,012" -> "0.012")
    - returns a string with 3 decimals, or None if invalid/empty
    """
    if x is None:
        return None
    s = _strip_quotes_and_spaces(str(x))
    if s == "":
        return None
    # handle euro-decimal "1,234" -> "1.234" (but don't break "1,234.56")
    if "," in s and "." not in s:
        s = s.replace(",", ".")
    try:
        q = Decimal(s)
        q = q.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
        return f"{q:.3f}"
    except (InvalidOperation, ValueError):
        return None

def try_parse_date(ds: str) -> date:
    """
    Accepts: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, DD-MM-YY
    """
    ds = (ds or "").strip()
    fmts = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"]
    last_err = None
    for fmt in fmts:
        try:
            return datetime.strptime(ds, fmt).date()
        except Exception as e:
            last_err = e
    raise ValueError(f"Unrecognized date format: {ds}") from last_err

def make_paris_iso(date_obj: date, hour: int, minute: int = 0, second: int = 0) -> Tuple[str, int]:
    """
    Build ISO string at given local time in Europe/Paris and return (iso_hours_only, offset_hours).
    """
    dt = datetime.combine(date_obj, time(hour, minute, second)).replace(tzinfo=PARIS_TZ)
    offset = int(dt.utcoffset().total_seconds() // 3600)
    iso = dt.isoformat()
    # reduce '+HH:MM' to '+HH'
    iso = re.sub(r"([+-]\d{2}):\d{2}$", lambda m: m.group(1), iso)
    return iso, offset

def parse_date_to_paris_iso(date_str: str) -> Tuple[str, int]:
    """
    Base convenience: 13:00 on that date.
    """
    d = try_parse_date(date_str)
    return make_paris_iso(d, 13)

def std_param(param: str) -> str:
    p = (param or "").strip().lower()
    mapped = PARAM_MAP.get(p)
    if mapped in ("visco1", "visco2", "visco_avg"):
        return "viscosity"
    return mapped or (param or "").strip()

def map_user(user: str) -> str:
    lo = (user or "").lower()
    for k, v in USER_MAP:
        if k in lo:
            return v
    return (user or "").strip()

def load_rows(csv_path: Path) -> List[Row]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        reader.fieldnames = [normalize_header(h) for h in reader.fieldnames]
        need = {"timestamp","user_id","product","parameter","value","usl","lsl"}
        missing = need - set(reader.fieldnames or [])
        if missing:
            raise SystemExit(f"{csv_path.name}: missing required columns: {', '.join(sorted(missing))}")
        rows: List[Row] = []
        for r in reader:
            rows.append(Row(
                timestamp=_strip_quotes_and_spaces(r.get("timestamp","")),
                user_id=_strip_quotes_and_spaces(r.get("user_id","")),
                product=_strip_quotes_and_spaces(r.get("product","")),
                parameter=_strip_quotes_and_spaces(r.get("parameter","")),
                value=_strip_quotes_and_spaces(r.get("value","")),
                USL=_strip_quotes_and_spaces(r.get("usl","")),
                LSL=_strip_quotes_and_spaces(r.get("lsl","")),
            ))
        return rows

def clean_rows(rows: List[Row]) -> List[Row]:
    """Keep only rows with numeric 'value' (ensures NOT NULL in SQL)."""
    out = []
    for r in rows:
        if as_decimal_3(r.value) is None:
            continue
        out.append(r)
    return out

def fixed_limits_by_prefix(id_slurry: str, param_std: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Per-file limits based on id_slurry prefix (M7-3, R55, 2CN2).
    Returns strings with 3 decimals or None for NULL.
    """
    s = id_slurry.upper()
    def f(x):
        return None if x is None else f"{Decimal(x).quantize(Decimal('0.001')):.3f}"

    if s.startswith("M7-3"):
        if param_std == "viscosity": return f(30),   f(10)
        if param_std == "pc":        return f(8.5),  f(8)
        if param_std == "density":   return f(246.5),f(245.5)
        if param_std in ("H2O","silice"): return None, None
    elif s.startswith("R55"):
        if param_std == "viscosity": return f(10),   f(8)
        if param_std == "density":   return f(226),  f(224)
        if param_std in ("H2O","silice"): return None, None
    elif s.startswith("2CN2"):
        if param_std == "viscosity": return f(14),   f(8)
        if param_std == "pc":        return f(5.4),  f(4.9)
        if param_std == "density":   return f(242),  f(236)
        if param_std in ("H2O","silice"): return None, None
    return None, None

def aggregate_viscosity_entries(rows: List[Row]) -> Dict[str, List[Tuple[int, str]]]:
    """
    For each date, return a list of (hour_offset_from_13, value_str) to insert.
    Logic:
      - If any VISCO MOYENNE on that date: ignore VISCO 1/2 and insert each
        moyenne at 13:00 + n hours (n = 0,1,2,...) in encounter order.
      - Else: if both VISCO 1 and 2 exist → average once at 13:00.
              else whichever single exists at 13:00.
    """
    # Collect raw per date
    per_date: Dict[str, Dict[str, List[str]]] = {}
    for r in rows:
        low = (r.parameter or "").strip().lower()
        mapped = PARAM_MAP.get(low, low)
        if mapped not in ("visco1","visco2","visco_avg"):
            continue
        d = per_date.setdefault(r.timestamp, {"visco_avg":[], "visco1":[], "visco2":[]})
        d[mapped].append(r.value)

    result: Dict[str, List[Tuple[int, str]]] = {}
    for date_str, d in per_date.items():
        out_list: List[Tuple[int, str]] = []
        moyennes = [as_decimal_3(v) for v in d["visco_avg"]]
        moyennes = [v for v in moyennes if v is not None]
        if moyennes:
            # multiple moyennes → 13:00, 14:00, ...
            for i, mv in enumerate(moyennes):
                out_list.append((i, mv))  # hour offset i
        else:
            v1 = next((as_decimal_3(v) for v in d["visco1"] if as_decimal_3(v) is not None), None)
            v2 = next((as_decimal_3(v) for v in d["visco2"] if as_decimal_3(v) is not None), None)
            if v1 is not None and v2 is not None:
                avg = (Decimal(v1) + Decimal(v2)) / 2
                avg = avg.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
                out_list.append((0, f"{avg:.3f}"))
            elif v1 is not None:
                out_list.append((0, v1))
            elif v2 is not None:
                out_list.append((0, v2))
        if out_list:
            result[date_str] = out_list
    return result

def id_from(id_slurry: str, dt_iso: str, param_std: str, offset: int) -> str:
    """
    id_rheology = <id_slurry>_<letter><YYMMDDHHMMSS><F>
    dt_iso uses +HH; normalize to +HH:00 for parsing the time part.
    """
    norm = re.sub(r"([+-]\d{2})$", r"\1:00", dt_iso)
    dt = datetime.fromisoformat(norm)
    letter = TYPE_LETTER.get(param_std, "x")
    stamp = dt.strftime("%y%m%d%H%M%S")
    return f"{id_slurry}_{letter}{stamp}{offset}"

def create_table_sql() -> str:
    return """CREATE TABLE IF NOT EXISTS rheology (
  id_rheology VARCHAR(128) PRIMARY KEY,
  id_slurry   VARCHAR(64)  NOT NULL,
  slurry_type VARCHAR(16)  NOT NULL,
  timestamp   VARCHAR(32)  NOT NULL,
  source      VARCHAR(64)  NOT NULL,
  parameter   VARCHAR(32)  NOT NULL,
  value       DECIMAL(12,3) NOT NULL,
  unit        VARCHAR(16)   NULL,
  usl         DECIMAL(12,3) NULL,
  lsl         DECIMAL(12,3) NULL
);"""

def infer_slurry_type(id_slurry: str) -> str:
    up = id_slurry.upper()
    if up.startswith("M7-3"):
        return "M7-3"
    if up.startswith("R55"):
        return "R55"
    if up.startswith("2CN2"):
        return "2CN2"
    # fallback: take chunk before first '_' or '-' (keeps schema non-null)
    for sep in ("_", "-"):
        if sep in id_slurry:
            return id_slurry.split(sep, 1)[0]
    return id_slurry  # last resort

def convert_one_csv(csv_path: Path, out_path: Path):
    id_slurry = csv_path.stem  # file name without .csv
    slurry_type = infer_slurry_type(id_slurry)
    rows = clean_rows(load_rows(csv_path))  # ensures numeric values
    visco_schedule = aggregate_viscosity_entries(rows)

    lines: List[str] = []
    lines.append(create_table_sql())
    lines.append("")

    # Non-viscosity rows
    for r in rows:
        p_std = std_param(r.parameter)
        if p_std == "viscosity":
            continue
        dt_iso, offset = parse_date_to_paris_iso(r.timestamp)  # always 13:00 for non-viscosity
        val = as_decimal_3(r.value)
        if val is None:
            continue  # safety
        source = map_user(r.user_id)
        unit = DEFAULT_UNITS.get(p_std)
        usl_fixed, lsl_fixed = fixed_limits_by_prefix(id_slurry, p_std)
        usl_sql = "NULL" if usl_fixed is None else usl_fixed
        lsl_sql = "NULL" if lsl_fixed is None else lsl_fixed
        rid = id_from(id_slurry, dt_iso, p_std, offset)

        cols = ("id_rheology","id_slurry","slurry_type","timestamp","source","parameter","value","unit","usl","lsl")
        vals = [
            f"'{rid}'",
            f"'{id_slurry}'",
            f"'{slurry_type}'",
            f"'{dt_iso}'",
            f"'{source}'",
            f"'{p_std}'",
            val,
            "NULL" if unit is None else f"'{unit}'",
            usl_sql,
            lsl_sql,
        ]
        lines.append(f"INSERT INTO rheology ({', '.join(cols)}) VALUES ({', '.join(vals)});")

    # Viscosity rows (with hour increments when multiple MOYENNE)
    for date_str, entries in visco_schedule.items():
        d = try_parse_date(date_str)
        # representative source from any row of that date
        source = ""
        for rr in rows:
            if try_parse_date(rr.timestamp) == d:
                source = map_user(rr.user_id)
                if source:
                    break
        unit = DEFAULT_UNITS["viscosity"]
        usl_fixed, lsl_fixed = fixed_limits_by_prefix(id_slurry, "viscosity")
        usl_sql = "NULL" if usl_fixed is None else usl_fixed
        lsl_sql = "NULL" if lsl_fixed is None else lsl_fixed

        for hour_offset, vis_val in entries:
            # base 13:00 + hour_offset
            hour = 13 + hour_offset
            # allow rolling past midnight if someone really logs >11 in one day
            dt_iso, offset = make_paris_iso(d + timedelta(hours=hour-13), hour % 24)
            rid = id_from(id_slurry, dt_iso, "viscosity", offset)

            cols = ("id_rheology","id_slurry","slurry_type","timestamp","source","parameter","value","unit","usl","lsl")
            vals = [
                f"'{rid}'",
                f"'{id_slurry}'",
                f"'{slurry_type}'",
                f"'{dt_iso}'",
                f"'{source}'",
                f"'viscosity'",
                vis_val,
                "NULL" if unit is None else f"'{unit}'",
                usl_sql,
                lsl_sql,
            ]
            lines.append(f"INSERT INTO rheology ({', '.join(cols)}) VALUES ({', '.join(vals)});")

    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"✓ {csv_path.name} → {out_path.name}")

def main():
    ap = argparse.ArgumentParser(description="Batch CSV → SQL converter for rheology.")
    ap.add_argument("--in", dest="src_dir",
                    default=r"C:\Users\d649578\Desktop\test data csv",
                    help="Source directory containing CSV files")
    ap.add_argument("--out", dest="out_dir",
                    default=r"C:\Users\d649578\Desktop\test data csv\converted data",
                    help="Output directory to write SQL files")
    args = ap.parse_args()

    src = Path(args.src_dir)
    dst = Path(args.out_dir)
    dst.mkdir(parents=True, exist_ok=True)

    csv_files = sorted(p for p in src.glob("*.csv") if p.is_file())
    if not csv_files:
        print(f"No CSV files found in: {src}")
        return

    for csv_path in csv_files:
        out_path = dst / (csv_path.stem + ".sql")
        try:
            convert_one_csv(csv_path, out_path)
        except Exception as e:
            print(f"ERROR converting {csv_path.name}: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
