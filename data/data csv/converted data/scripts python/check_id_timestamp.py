#!/usr/bin/env python3
"""
Check id_rheology ↔ timestamp consistency in SQL files.

- Scans all .sql files in a folder (current working directory by default)
- For each INSERT line, extracts id_rheology (first column) and timestamp (4th column)
- Verifies id_rheology matches pattern: <id_slurry>_<letter><YYMMDDHHMMSS><F>
  and that the embedded YYMMDDHHMMSS and F match the parsed timestamp field.
- Produces a report: report_id_timestamp_check.txt (in same folder).
- Read-only: does not modify any SQL file.
"""

from pathlib import Path
from datetime import datetime
import re
import sys
from typing import Optional, Tuple, List
from collections import defaultdict

# ---------- helpers (robust splitting like before) ----------

def split_sql_values(inner: str) -> List[str]:
    """Split the content inside VALUES(...) into fields while respecting quoted strings."""
    items = []
    buf = []
    in_quote = False
    quote_char = None
    esc = False
    for ch in inner:
        if in_quote:
            if esc:
                buf.append(ch)
                esc = False
            elif ch == "\\":
                buf.append(ch)
                esc = True
            elif ch == quote_char:
                buf.append(ch)
                in_quote = False
                quote_char = None
            else:
                buf.append(ch)
        else:
            if ch in ("'", '"'):
                in_quote = True
                quote_char = ch
                buf.append(ch)
            elif ch == ",":
                items.append("".join(buf).strip())
                buf = []
            else:
                buf.append(ch)
    if buf:
        items.append("".join(buf).strip())
    return items

def unquote(s: str) -> str:
    s = (s or "").strip()
    if len(s) >= 2 and ((s[0] == s[-1]) and s[0] in ("'", '"')):
        return s[1:-1]
    return s

def parse_sql_timestamp_field(ts_field: str) -> Tuple[Optional[datetime], Optional[str]]:
    """
    Parse timestamp SQL field like 'YYYY-MM-DDTHH:MM:SS+HH' (or with +HH:MM).
    Returns (datetime_obj_or_None, normalized_string_or_raw).
    Normalized string is of form 'YYYY-MM-DDTHH:MM:SS+HH' (hours-only offset).
    """
    raw = unquote(ts_field).strip()
    if not raw:
        return None, None
    # Normalize +HH or +HH:MM to +HH:MM for fromisoformat
    norm = re.sub(r"([+-]\d{2})$", r"\1:00", raw)
    try:
        dt = datetime.fromisoformat(norm)
    except Exception:
        return None, raw
    # Build hours-only representation
    hours_only = re.sub(r"([+-]\d{2}):\d{2}$", r"\1", dt.isoformat())
    return dt, hours_only

def parse_id_rheology(id_str: str) -> Optional[Tuple[str, str, str, str]]:
    """
    Parse id_rheology like <id_slurry>_<letter><YYMMDDHHMMSS><F>
    Returns (id_slurry, letter, stamp_12, offset_digit) or None if not match.
    """
    s = (id_str or "").strip()
    # Greedy id_slurry (can contain underscores) then underscore, then letter, 12 digits stamp and 1 digit offset
    m = re.match(r"^(?P<id_slurry>.+)_(?P<letter>[A-Za-z])(?P<stamp>\d{12})(?P<offset>\d)$", s)
    if not m:
        return None
    return m.group("id_slurry"), m.group("letter"), m.group("stamp"), m.group("offset")

def stamp_and_offset_from_dt(dt: datetime) -> Tuple[str, str]:
    """
    Given a timezone-aware datetime, return (YYMMDDHHMMSS, offset_hours_str)
    offset_hours_str is without leading sign? we keep sign like +02 or -01.
    We will format offset as +H or -H (but our ids use single digit, e.g. 1 or 2).
    For safety return offset as string of integer (no sign) if positive, include '-' if negative.
    """
    # create stamp
    stamp = dt.strftime("%y%m%d%H%M%S")
    # get offset hours (int, may be negative)
    off_seconds = dt.utcoffset().total_seconds() if dt.utcoffset() else 0
    off_hours = int(off_seconds // 3600)
    # Represent as positive digit or negative with minus sign. In our id we expect e.g. '2' not '+02'
    # But to compare, we'll compare integer values; return string representation
    return stamp, str(off_hours)

# ---------- main ----------

def main():
    # folder containing SQL files (current working directory)
    base = Path.cwd()
    sql_files = sorted(base.glob("*.sql"))
    if not sql_files:
        print(f"No .sql files found in {base}")
        sys.exit(0)

    insert_re = re.compile(
        r"INSERT\s+INTO\s+rheology\s*\([^)]*\)\s*VALUES\s*\((.*?)\)\s*;",
        re.IGNORECASE
    )

    report_lines = []
    global_problems = defaultdict(list)  # id_rheology -> list of (file,line,problem)

    for sql_path in sql_files:
        report_lines.append(f"File: {sql_path.name}")
        report_lines.append("-" * (6 + len(sql_path.name)))
        problems = []
        total_inserts = 0

        with sql_path.open("r", encoding="utf-8", errors="replace") as fh:
            for lineno, line in enumerate(fh, start=1):
                m = insert_re.search(line)
                if not m:
                    continue
                total_inserts += 1
                inner = m.group(1)
                fields = split_sql_values(inner)
                # We expect at least 4 columns: id_rheology (0), id_slurry(1), slurry_type(2), timestamp(3) ...
                if len(fields) < 4:
                    problems.append((lineno, "malformed INSERT (too few fields)"))
                    continue

                id_field = unquote(fields[0]).strip()
                ts_field = fields[3]

                # parse id
                parsed_id = parse_id_rheology(id_field)
                if parsed_id is None:
                    problems.append((lineno, f"id_rheology format INVALID: '{id_field}'"))
                    global_problems[id_field].append((sql_path.name, lineno, "id_format_invalid"))
                    continue

                id_slurry, letter, id_stamp, id_offset_digit = parsed_id

                # parse timestamp field
                parsed_dt, norm_ts = parse_sql_timestamp_field(ts_field)
                if parsed_dt is None:
                    problems.append((lineno, f"timestamp field UNPARSABLE: {unquote(ts_field)}"))
                    global_problems[id_field].append((sql_path.name, lineno, "timestamp_unparsable"))
                    continue

                # compute stamp and offset from parsed timestamp (timezone-aware)
                try:
                    # parsed_dt is timezone-aware (fromisoformat on +HH:MM)
                    dt_stamp, dt_offset_str = stamp_and_offset_from_dt(parsed_dt)
                except Exception as e:
                    problems.append((lineno, f"error computing stamp from timestamp: {e}"))
                    global_problems[id_field].append((sql_path.name, lineno, "stamp_compute_error"))
                    continue

                # Compare id stamp vs timestamp-derived stamp
                if id_stamp != dt_stamp:
                    problems.append((lineno,
                        f"stamp MISMATCH: id contains '{id_stamp}', timestamp field -> '{dt_stamp}' (timestamp {norm_ts})"))
                    global_problems[id_field].append((sql_path.name, lineno, "stamp_mismatch"))
                    # continue — we also check offset

                # Compare id offset digit vs timestamp offset hours
                # id_offset_digit may be like '2' or '1' (no sign). dt_offset_str is like '2' or '-1'
                # Compare integer values
                try:
                    id_off_int = int(id_offset_digit)
                    dt_off_int = int(dt_offset_str)
                except Exception:
                    problems.append((lineno, f"offset parse error: id offset '{id_offset_digit}', timestamp offset '{dt_offset_str}'"))
                    global_problems[id_field].append((sql_path.name, lineno, "offset_parse_error"))
                    continue

                if id_off_int != dt_off_int:
                    problems.append((lineno,
                        f"offset MISMATCH: id offset '{id_off_int}', timestamp offset '{dt_off_int}' (timestamp {norm_ts})"))
                    global_problems[id_field].append((sql_path.name, lineno, "offset_mismatch"))

        # file summary
        report_lines.append(f"  Total INSERTs scanned: {total_inserts}")
        if problems:
            report_lines.append(f"  Problems found: {len(problems)}")
            for ln, msg in problems:
                report_lines.append(f"    line {ln}: {msg}")
        else:
            report_lines.append("  No problems found.")
        report_lines.append("")  # blank line between files

    # global section
    report_lines.append("Global summary (id_rheology problems across files)")
    report_lines.append("--------------------------------------------------")
    if global_problems:
        for rid, locs in sorted(global_problems.items()):
            report_lines.append(f"{rid}:")
            for fn, ln, kind in locs:
                report_lines.append(f"  - {fn} (line {ln}) : {kind}")
            report_lines.append("")
    else:
        report_lines.append("No global issues found.")
        report_lines.append("")

    # write report
    out_path = base / "report_id_timestamp_check.txt"
    out_path.write_text("\n".join(report_lines), encoding="utf-8")
    print(f"✅ Report written: {out_path}")

if __name__ == "__main__":
    main()
