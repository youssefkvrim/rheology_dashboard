#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scan SQL files in the current folder:
- Per file: detect duplicate id_rheology; oldest & newest timestamp
- Global: id_rheology that appear in more than one file
- Output: report_sql_scan.txt in the same folder

Assumptions:
- INSERT lines look like:
  INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl)
  VALUES ('<id>','<slurry>',...,'<timestamp>',...);

- Timestamp format is like 'YYYY-MM-DDTHH:MM:SS+HH' (hours-only offset).
"""

from pathlib import Path
from datetime import datetime
import re
import sys
from collections import Counter, defaultdict

# -------- helpers --------

def split_sql_values(inner: str):
    """
    Split the content between VALUES ( ... ) into fields,
    handling commas inside single-quoted strings and NULLs.
    Returns a list of raw field strings (still quoted if quoted).
    """
    items = []
    buf = []
    in_quote = False
    esc = False
    quote_char = None

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

def unquote(s: str):
    s = s.strip()
    if len(s) >= 2 and ((s[0] == s[-1]) and s[0] in ("'", '"')):
        return s[1:-1]
    return s

def parse_timestamp(ts: str):
    """
    Convert 'YYYY-MM-DDTHH:MM:SS+HH' to a Python datetime by normalizing to +HH:00.
    Returns (datetime, normalized_string_with_hours_only).
    """
    raw = unquote(ts).strip()
    # normalize "+HH" to "+HH:00" for fromisoformat
    norm = re.sub(r"([+-]\d{2})$", r"\1:00", raw)
    try:
        dt = datetime.fromisoformat(norm)
    except Exception:
        # if anything weird, return None; caller handles
        return None, raw
    return dt, raw

# -------- main --------

def main():
    base = Path.cwd()  # script runs from the folder that contains the .sql files
    sql_files = sorted(base.glob("*.sql"))
    if not sql_files:
        print("No .sql files found in this folder.")
        sys.exit(0)

    per_file_info = []
    global_index = defaultdict(list)  # id_rheology -> list of (filename, line_no)

    insert_re = re.compile(
        r"INSERT\s+INTO\s+rheology\s*\([^)]*\)\s*VALUES\s*\((.*?)\)\s*;",
        re.IGNORECASE
    )

    for sql_path in sql_files:
        ids = []
        timestamps = []
        occurrences = []  # (id, line_no)

        with sql_path.open("r", encoding="utf-8", errors="replace") as f:
            for i, line in enumerate(f, start=1):
                m = insert_re.search(line)
                if not m:
                    continue
                inner = m.group(1)
                fields = split_sql_values(inner)
                # Expect our 10 columns order:
                # 0:id_rheology 1:id_slurry 2:slurry_type 3:timestamp 4:source 5:param 6:value 7:unit 8:usl 9:lsl
                if len(fields) < 4:
                    continue  # malformed line
                id_rheology = unquote(fields[0]).strip()
                ts_field = fields[3]

                ids.append(id_rheology)
                occurrences.append((id_rheology, i))
                dt, raw_ts = parse_timestamp(ts_field)
                if dt is not None:
                    timestamps.append(dt)

                # record to global index (per id, collect file & line)
                global_index[id_rheology].append((sql_path.name, i))

        cnt = Counter(ids)
        dup_ids = sorted([k for k, c in cnt.items() if c > 1])
        oldest = min(timestamps).isoformat() if timestamps else "N/A"
        newest = max(timestamps).isoformat() if timestamps else "N/A"

        per_file_info.append({
            "file": sql_path.name,
            "rows": len(ids),
            "dup_count": sum(c for c in cnt.values() if c > 1),
            "dup_ids": dup_ids,
            "oldest": oldest,
            "newest": newest,
        })

    # global duplicates (id present in more than one file)
    global_dups = {rid: locs for rid, locs in global_index.items() if len({fn for fn, _ in locs}) > 1}

    # Write report
    out_path = base / "report_sql_scan.txt"
    with out_path.open("w", encoding="utf-8") as out:
        out.write("SQL Files Scan Report\n")
        out.write("=====================\n\n")
        out.write(f"Scanned folder: {base}\n")
        out.write(f"Files found: {len(sql_files)}\n\n")

        out.write("Per-file summary\n")
        out.write("----------------\n")
        for info in per_file_info:
            out.write(f"File: {info['file']}\n")
            out.write(f"  Total INSERT rows: {info['rows']}\n")
            out.write(f"  Oldest timestamp : {info['oldest']}\n")
            out.write(f"  Newest timestamp : {info['newest']}\n")
            if info["dup_ids"]:
                out.write(f"  Duplicate id_rheology ({len(info['dup_ids'])} unique, {info['dup_count']} rows):\n")
                for rid in info["dup_ids"]:
                    out.write(f"    - {rid}\n")
            else:
                out.write("  Duplicate id_rheology: none\n")
            out.write("\n")

        out.write("Global duplicates across files\n")
        out.write("------------------------------\n")
        if global_dups:
            for rid, locs in sorted(global_dups.items()):
                out.write(f"id_rheology: {rid}\n")
                for fn, ln in locs:
                    out.write(f"  - {fn} (line {ln})\n")
                out.write("\n")
        else:
            out.write("None\n")

    print(f"✅ Report written: {out_path}")

if __name__ == "__main__":
    main()
