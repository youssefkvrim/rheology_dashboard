# CSV Import

Defines CSV formats and behavior used by the Alerts page scatter chart and the Données page importer UI.

## Scope
- Temporary, front-only import. No persistence on page reload.
- Intended for quick visualization and manual analysis.

## Format (Alerts)
- One point per line: `timestamp,value`
- `timestamp` may be:
  - Unix epoch in milliseconds (number), or
  - ISO 8601 date/time string parseable by `Date.parse()`
- `value` must be a finite number.

### Examples
```
1697030400000,1.356
2025-10-18T08:30:00Z,420
2025-10-18 10:03:00,8.25
```

## Validation Rules (Alerts)
- Skip empty lines.
- A line is accepted only if both `timestamp` and `value` parse to finite numbers.
- Malformed lines are ignored (no crash). Consider showing a count message in UI.

## Units
- The scatter plot is unit‑agnostic; semantics depend on the metric context chosen by the user.

## Time & Locale
- Timestamps are interpreted by the browser (client timezone/DST).
- Display uses local time in tooltips.

## Données Importer (Visual Only)
- UI supports selecting one or more `.csv` files (≤ 2MB each). Clicking the icon, the label text, or the button opens the file picker.
- Expected CSV structure (for future server-side processing):
  - `id_rheology,id_slurry,slurry_type,timestamp,source,parameter,value,unit,usl,lsl`
  - Timestamp should include timezone offset (e.g., `2024-08-14T13:00:00+02`).
- Current behavior: no parsing or persistence; UI is read-only.

## Limitations
- No server storage; data is lost on refresh.
- No header support; use raw `timestamp,value` lines.
