# Performance Guidance

This project renders simulated time‑series data with Recharts. Use the following guidance for responsive UX.

## Data Windows
- Live charts retain ~48 points per metric (5s tick ≈ 4 min window in the base series; extended windows are simulated on demand).
- Historical generators downsample by a computed step to cap points around a few hundred per chart.

## Limits
- Target ≤ 2–3k points per chart for smooth pan/hover on typical laptops.
- Avoid dot rendering for dense lines (`dot={false}`).
- Average line is `isAnimationActive={false}` to save cycles.

## Animation & Rendering
- Prefer dashed average (lightweight) over per‑point markers.
- Use `ResponsiveContainer` to avoid reflow thrash on resize.

## Memory
- When generating ranges, compute step from requested span to limit array length.
- Drop old ambient and H₂O history outside the visible window.

## Profiling Checklist
- Chrome DevTools Performance + Memory
- FPS/Latency when panning and hovering tooltips
- Re-renders: verify state slices and memoization (`useMemo`) on derived series
