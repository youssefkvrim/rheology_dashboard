#!/usr/bin/env python3
"""
CSV → SQL converter for rheology table with cleaning step (UPDATED RULES).

Changes vs previous:
- Removed slurry_type column.
- 'source' now stores the mapped user id (e.g., 'benoit.marie').
- SQL columns use 'usl' and 'lsl' (not upl/lpl).
- USL/LSL are overwritten by fixed limits per parameter:
    viscosity: usl=30,    lsl=10
    pc:        usl=8.5,   lsl=8
    density:   usl=246.5, lsl=245.5
    H2O:       usl=NULL,  lsl=NULL
- Enforce non-null for id_rheology, id_slurry, timestamp, value (drop rows with empty/non-numeric value).
- Timestamp output: Europe/Paris at 13:00:00 on that date, formatted as YYYY-MM-DDTHH:MM:SS+HH (hours-only offset).
"""

import argparse
import csv
from dataclasses import dataclass
from datetime import datetime, time
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from pathlib import Path
import re
import sys
from typing import List, Tuple, Dict, Optional

try:
    from zoneinfo import ZoneInfo  # Python 3.9+
except Exception:
    print("This script requires Python 3.9+.", file=sys.stderr)
    sys.exit(1)

# --- CONSTANTS --- #
PARIS_TZ = ZoneInfo("Europe/Paris")

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
    "silice": "%",
    "grain": "%",
}

USER_MAP = [
    ("benoit", "benoit.marie"),
    ("marc", "marc.mendy"),
    ("luc", "luc.essayan"),
    ("aliz", "aliz.pinto-mora"),
]

# --- LIMITS OVERRIDE --- #
def fixed_limits(param_std: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Return (usl_str, lsl_str) already formatted to 3 decimals or 'NULL'.
    """
    if param_std == "viscosity":
        return "30.000", "10.000"
    if param_std == "pc":
        return "8.500", "8.000"
    if param_std == "density":
        return "246.500", "245.500"
    if param_std == "H2O":
        return None, None  # both NULL
    # default: keep NULLs (no override defined)
    return None, None

# --- DATA STRUCTURES --- #
@dataclass
class Row:
    timestamp: str
    user_id: str
    product: str
    parameter: str
    value: str
    USL: str
    LSL: str

# --- HELPERS --- #
def normalize_header(h: str) -> str:
    return h.strip().lower()

def as_decimal_3(x: Optional[str]) -> Optional[str]:
    """
    Try to parse as Decimal and return string with 3 decimals; None if invalid/empty.
    """
    if x is None or str(x).strip() == "":
        return None
    try:
        q = Decimal(str(x).strip())
        q = q.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
        return f"{q:.3f}"
    except (InvalidOperation, ValueError):
        return None

def parse_date_to_paris_iso(date_str: str) -> Tuple[str, int]:
    """
    Input 'YYYY-MM-DD' → 'YYYY-MM-DDT13:00:00+HH' (hours-only offset), and offset hours.
    """
    date = datetime.strptime(date_str.strip(), "%Y-%m-%d").date()
    dt = datetime.combine(date, time(13, 0, 0)).replace(tzinfo=PARIS_TZ)
    offset = int(dt.utcoffset().total_seconds() // 3600)
    iso = dt.isoformat()
    # convert '+HH:MM' to '+HH'
    iso = re.sub(r"([+-]\d{2}):\d{2}$", lambda m: m.group(1), iso)
    return iso, offset

def map_product_to_id_slurry(product: str) -> str:
    """
    Product 'M7-3006' → 'M7-3_006' (special case).
    If already contains '_', use as-is. Else replace '-' with '_'.
    """
    p = product.strip()
    if p.upper() == "M7-3006":
        return "M7-3_006"
    if "_" in p:
        return p
    return p.replace("-", "_")

def map_user(user: str) -> str:
    lo = (user or "").lower()
    for k, v in USER_MAP:
        if k in lo:
            return v
    return user.strip()

def load_rows(csv_path: Path) -> List[Row]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        reader.fieldnames = [normalize_header(h) for h in reader.fieldnames]
        rows = []
        for r in reader:
            rows.append(Row(
                timestamp=r.get("timestamp", "").strip(),
                user_id=r.get("user_id", "").strip(),
                product=r.get("product", "").strip(),
                parameter=r.get("parameter", "").strip(),
                value=r.get("value", "").strip(),
                USL=r.get("usl", "").strip(),
                LSL=r.get("lsl", "").strip(),
            ))
        return rows

def clean_rows(rows: List[Row]) -> List[Row]:
    """
    Keep only rows with a non-empty AND numeric 'value' (3-dec format).
    This guarantees 'value' is present (non-NULL) in SQL.
    """
    out = []
    for r in rows:
        v = as_decimal_3(r.value)
        if v is None:
            continue
        out.append(r)
    return out

def aggregate_viscosity(rows: List[Row]) -> Dict[Tuple[str, str], Tuple[str, Optional[str], Optional[str]]]:
    """
    Aggregate viscosity per (date, product).
    Returns mapping: (date, product) -> (value_str, usl_str, lsl_str)
    """
    groups: Dict[Tuple[str, str], Dict[str, Tuple[str, str, str]]] = {}
    for r in rows:
        p = r.parameter.strip().lower()
        mapped = PARAM_MAP.get(p, p)
        if mapped not in ("visco1", "visco2", "visco_avg"):
            continue
        key = (r.timestamp, r.product)
        groups.setdefault(key, {})
        groups[key][mapped] = (r.value, r.USL, r.LSL)

    result: Dict[Tuple[str,str], Tuple[str, Optional[str], Optional[str]]] = {}
    for key, d in groups.items():
        if "visco_avg" in d:
            val = as_decimal_3(d["visco_avg"][0])
        elif "visco1" in d and "visco2" in d:
            try:
                avg = (Decimal(d["visco1"][0]) + Decimal(d["visco2"][0])) / 2
                avg = avg.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
                val = f"{avg:.3f}"
            except Exception:
                val = as_decimal_3(d["visco1"][0])
        elif "visco1" in d:
            val = as_decimal_3(d["visco1"][0])
        elif "visco2" in d:
            val = as_decimal_3(d["visco2"][0])
        else:
            val = None

        # enforce non-null value; if cannot compute, skip emitting this key
        if val is None:
            continue

        # fixed limits for viscosity
        usl_fixed, lsl_fixed = fixed_limits("viscosity")
        result[key] = (val, usl_fixed, lsl_fixed)
    return result

def id_from(dt_iso: str, param: str, offset: int) -> str:
    """
    dt_iso like 'YYYY-MM-DDTHH:MM:SS+02' → normalize to '+02:00' to parse, then build ID.
    """
    norm = re.sub(r"([+-]\d{2})$", r"\1:00", dt_iso)
    dt = datetime.fromisoformat(norm)
    letter = TYPE_LETTER.get(param, "x")
    stamp = dt.strftime("%y%m%d%H%M%S")
    return f"{letter}{stamp}{offset}"

def std_param(param: str) -> str:
    p = (param or "").strip().lower()
    mapped = PARAM_MAP.get(p)
    if mapped in ("visco1", "visco2", "visco_avg"):
        return "viscosity"
    return mapped or (param or "").strip()

# --- MAIN --- #
def main():
    parser = argparse.ArgumentParser(description="CSV→SQL converter for rheology data (updated rules).")
    parser.add_argument("csv_in", help="Path to input CSV file")
    parser.add_argument("-o", "--out", required=True, help="Output SQL file path")
    args = parser.parse_args()

    rows = clean_rows(load_rows(Path(args.csv_in)))  # ensures numeric, non-empty value
    visco = aggregate_viscosity(rows)

    # SQL schema (no slurry_type; usl/lsl columns)
    out_lines = [
        """CREATE TABLE IF NOT EXISTS rheology (
    id_rheology VARCHAR(32) PRIMARY KEY,
    id_slurry   VARCHAR(64) NOT NULL,
    timestamp   VARCHAR(32) NOT NULL,
    source      VARCHAR(64) NOT NULL,
    parameter   VARCHAR(32) NOT NULL,
    value       DECIMAL(12,3) NOT NULL,
    unit        VARCHAR(16) NULL,
    usl         DECIMAL(12,3) NULL,
    lsl         DECIMAL(12,3) NULL
);""",
        ""
    ]

    # Emit non-viscosity rows
    for r in rows:
        p_std = std_param(r.parameter)
        if p_std == "viscosity":
            continue  # handled via aggregation

        # mandatory timestamp
        dt_iso, offset = parse_date_to_paris_iso(r.timestamp)

        # mandatory id_slurry
        id_slurry = map_product_to_id_slurry(r.product)

        # mandatory value (already ensured numeric by clean_rows)
        val = as_decimal_3(r.value)
        if val is None:
            continue  # safety net

        # source = mapped user id
        source = map_user(r.user_id)

        # unit
        unit = DEFAULT_UNITS.get(p_std)

        # fixed limits
        usl_fixed, lsl_fixed = fixed_limits(p_std)
        usl_sql = "NULL" if usl_fixed is None else usl_fixed
        lsl_sql = "NULL" if lsl_fixed is None else lsl_fixed

        # id_rheology
        rid = id_from(dt_iso, p_std, offset)

        cols = ("id_rheology","id_slurry","timestamp","source","parameter","value","unit","usl","lsl")
        vals = [
            f"'{rid}'",
            f"'{id_slurry}'",
            f"'{dt_iso}'",
            f"'{source}'",
            f"'{p_std}'",
            val,
            "NULL" if unit is None else f"'{unit}'",
            usl_sql,
            lsl_sql,
        ]
        out_lines.append(f"INSERT INTO rheology ({', '.join(cols)}) VALUES ({', '.join(vals)});")

    # Emit aggregated viscosity once per (date, product)
    for (date, prod), (v_str, usl_str, lsl_str) in visco.items():
        dt_iso, offset = parse_date_to_paris_iso(date)
        id_slurry = map_product_to_id_slurry(prod)
        # representative source = first matching mapped user for that group
        source = None
        for r in rows:
            if r.timestamp == date and r.product == prod:
                source = map_user(r.user_id)
                if source:
                    break
        if not source:
            source = ""  # should not happen, but keep non-null constraint satisfied as empty string

        rid = id_from(dt_iso, "viscosity", offset)
        unit = DEFAULT_UNITS["viscosity"]

        cols = ("id_rheology","id_slurry","timestamp","source","parameter","value","unit","usl","lsl")
        vals = [
            f"'{rid}'",
            f"'{id_slurry}'",
            f"'{dt_iso}'",
            f"'{source}'",
            f"'viscosity'",
            v_str,
            "NULL" if unit is None else f"'{unit}'",
            "NULL" if usl_str is None else usl_str,
            "NULL" if lsl_str is None else lsl_str,
        ]
        out_lines.append(f"INSERT INTO rheology ({', '.join(cols)}) VALUES ({', '.join(vals)});")

    Path(args.out).write_text("\n".join(out_lines), encoding="utf-8")
    print(f"SQL written to {args.out}")

if __name__ == "__main__":
    main()
