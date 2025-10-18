# CSV Import

Defines the CSV import format and behavior used by the Alerts page scatter chart.

## Scope
- Temporary, front-only import. No persistence on page reload.
- Intended for quick visualization and manual analysis.

## Format
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

## Validation Rules
- Skip empty lines.
- A line is accepted only if both `timestamp` and `value` parse to finite numbers.
- Malformed lines are ignored (no crash). Consider showing a count message in UI.

## Units
- The scatter plot is unit‑agnostic; semantics depend on the metric context chosen by the user.

## Time & Locale
- Timestamps are interpreted by the browser (client timezone/DST).
- Display uses local time in tooltips.

## Limitations
- No server storage; data is lost on refresh.
- No header support; use raw `timestamp,value` lines.
