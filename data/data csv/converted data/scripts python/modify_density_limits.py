#!/usr/bin/env python3

from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
import re
import sys
from typing import List

# ---------- helpers to split SQL values (respecting quotes) ----------

def split_sql_items(s: str) -> List[str]:
    """Split a parenthesized SQL value list into individual items, respecting single/double quotes."""
    items = []
    buf = []
    in_quote = False
    quote_char = None
    esc = False
    for ch in s:
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

def unquote_value(s: str) -> str:
    s = (s or "").strip()
    if len(s) >= 2 and ((s[0] == s[-1]) and s[0] in ("'", '"')):
        return s[1:-1]
    return s

def parse_and_divide_numeric(raw: str) -> str:
    """
    Parse raw field (may be 'NULL', quoted or not, comma decimals), divide numeric by 100,
    and return a string formatted with exactly 3 decimals (no quotes).
    Returns None if value is NULL or cannot be parsed as numeric.
    """
    if raw is None:
        return None
    raw_strip = raw.strip()
    if raw_strip.upper() == "NULL":
        return None
    # remove surrounding quotes if present
    val = unquote_value(raw_strip)
    # normalize comma decimal "1,234" -> "1.234" only when no dot present
    if "," in val and "." not in val:
        val = val.replace(",", ".")
    # remove spaces
    val = val.strip()
    try:
        d = Decimal(val)
    except (InvalidOperation, ValueError):
        return None
    # divide by 100
    d2 = (d / Decimal("100")).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    return f"{d2:.3f}"

# ---------- main logic ----------

INSERT_RE = re.compile(
    r"^(?P<prefix>\s*INSERT\s+INTO\s+[^\(]+\s*\()(?P<cols>[^)]+)\)\s*(?P<mid>VALUES\s*\()(?P<vals>.+?)(\)\s*;.*)$",
    re.IGNORECASE
)
# The regex captures:
# prefix  -> the part up to the "(" that starts column list
# cols    -> the column list (text until the closing ')')
# mid     -> "VALUES ("
# vals    -> the values list (greedy, we'll rely on the trailing ) ; part)
# trailing part captured separately to append back.

def process_file(path: Path):
    text = path.read_text(encoding="utf-8", errors="replace")
    changed = False
    changed_examples = []
    lines = text.splitlines()
    out_lines = []

    for lineno, line in enumerate(lines, start=1):
        m = INSERT_RE.match(line)
        if not m:
            out_lines.append(line)
            continue

        cols_raw = m.group("cols")
        vals_raw = m.group("vals")
        trailing = line[m.end(4):]  # from end of vals group to end of line (including ) ; etc)

        # split columns and values
        cols = [c.strip().strip('"').strip("'").lower() for c in cols_raw.split(",")]
        vals = split_sql_items(vals_raw)
        # if number of vals less than columns, treat as malformed -> skip
        if len(vals) < len(cols):
            out_lines.append(line)
            continue

        # find indexes (case-insensitive) for parameter, usl, lsl
        try:
            idx_param = cols.index("parameter")
        except ValueError:
            # parameter column not present - skip editing
            out_lines.append(line)
            continue

        # attempt to locate usl and lsl columns (common names are 'usl' and 'lsl')
        idx_usl = None
        idx_lsl = None
        for candidate in ("usl", "upl", "u_p_l", "upll"):  # allow safety (but we expect 'usl'/'lsl')
            if candidate in cols:
                idx_usl = cols.index(candidate)
                break
        for candidate in ("lsl", "lpl", "l_p_l"):
            if candidate in cols:
                idx_lsl = cols.index(candidate)
                break
        # if we can't find usl/lsl, don't change this line
        if idx_usl is None or idx_lsl is None:
            out_lines.append(line)
            continue

        # get parameter value (unquoted)
        param_val = unquote_value(vals[idx_param]).strip().lower()
        if param_val != "density":
            out_lines.append(line)
            continue

        # For density parameter -> try to modify usl and lsl
        new_vals = list(vals)  # copy
        usl_new = parse_and_divide_numeric(vals[idx_usl])
        lsl_new = parse_and_divide_numeric(vals[idx_lsl])

        # Only change if numeric conversion succeeded (NULL stays as is)
        replaced = False
        if usl_new is not None:
            new_vals[idx_usl] = usl_new
            replaced = True
        else:
            # if original was quoted numeric or had comma decimal but parse failed, leave as-is
            # if it was NULL we keep NULL
            pass

        if lsl_new is not None:
            new_vals[idx_lsl] = lsl_new
            replaced = True
        else:
            pass

        if replaced:
            changed = True
            # construct new vals_raw: join with ", " and keep other fields as originally captured
            reconstructed_vals = ", ".join(new_vals)
            new_line = f"{m.group('prefix')}{cols_raw}){m.group('mid')}{reconstructed_vals}){trailing}"
            out_lines.append(new_line)
            # record example
            changed_examples.append((lineno, line.strip(), new_line.strip()))
        else:
            out_lines.append(line)

    if changed:
        # overwrite file preserving original newline style
        path.write_text("\n".join(out_lines), encoding="utf-8")
    return changed, changed_examples

def main():
    base = Path.cwd()
    sql_files = sorted(base.glob("*.sql"))
    if not sql_files:
        print("No .sql files found in this folder.")
        return

    report_lines = []
    total_changes = 0
    files_changed = 0

    for f in sql_files:
        try:
            changed, examples = process_file(f)
            if changed:
                files_changed += 1
                total_changes += len(examples)
                report_lines.append(f"File: {f.name} - changes: {len(examples)}")
                for ln, before, after in examples[:10]:
                    report_lines.append(f"  line {ln}:")
                    report_lines.append(f"    - BEFORE: {before}")
                    report_lines.append(f"    - AFTER : {after}")
                if len(examples) > 10:
                    report_lines.append(f"    ... ({len(examples)-10} more changes shown in file)")
                report_lines.append("")
        except Exception as e:
            report_lines.append(f"ERROR processing {f.name}: {e}")

    # summary
    report_path = base / "density_usl_lsl_changes_report.txt"
    with report_path.open("w", encoding="utf-8") as rep:
        rep.write("Density USL/LSL Changes Report\n")
        rep.write("==============================\n\n")
        rep.write(f"Scanned folder: {base}\n")
        rep.write(f"SQL files scanned: {len(sql_files)}\n")
        rep.write(f"Files changed: {files_changed}\n")
        rep.write(f"Total changed INSERT lines: {total_changes}\n\n")
        if report_lines:
            rep.write("\n".join(report_lines))
        else:
            rep.write("No changes made.\n")

    print(f"Done. Report written to: {report_path}")
    if files_changed == 0:
        print("No density USL/LSL values required modification.")

if __name__ == "__main__":
    main()
