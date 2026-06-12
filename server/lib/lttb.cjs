function triangleArea(a, b, c) {
  return Math.abs(
    (a.t - c.t) * (b.v - a.v) -
    (a.t - b.t) * (c.v - a.v)
  ) / 2;
}

function lttb(points, threshold) {
  if (!Array.isArray(points)) return [];
  const len = points.length;
  if (!Number.isFinite(threshold) || threshold >= len || threshold <= 0) return points.slice();
  if (threshold < 3) return [points[0], points[len - 1]].filter(Boolean);

  const sampled = [points[0]];
  const bucketSize = (len - 2) / (threshold - 2);
  let a = 0;

  for (let i = 0; i < threshold - 2; i++) {
    const avgStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, len);
    const avgRange = points.slice(avgStart, avgEnd);
    const avg = avgRange.length
      ? avgRange.reduce((acc, p) => ({ t: acc.t + p.t, v: acc.v + p.v }), { t: 0, v: 0 })
      : points[Math.min(avgStart, len - 1)];
    const c = avgRange.length
      ? { t: avg.t / avgRange.length, v: avg.v / avgRange.length }
      : avg;

    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, len - 1);
    let maxArea = -1;
    let nextA = rangeStart;

    for (let j = rangeStart; j < rangeEnd; j++) {
      const area = triangleArea(points[a], points[j], c);
      if (area > maxArea) {
        maxArea = area;
        nextA = j;
      }
    }

    sampled.push(points[nextA]);
    a = nextA;
  }

  sampled.push(points[len - 1]);
  return sampled;
}

module.exports = { lttb };
