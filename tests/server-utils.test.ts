import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  ALL_DB_KEYS,
  ALL_FRONTEND_KEYS,
  DB_TO_FRONTEND,
  toDbKey,
  toFeKey,
} from '../src/shared/metricKeys';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'vitest-secret';

const require = createRequire(import.meta.url);
const { lttb } = require('../server/lib/lttb.cjs');
const { parseCsvLine, toLegacyTs, toMs } = require('../server/index.cjs');

describe('lttb', () => {
  const points = Array.from({ length: 10 }, (_, i) => ({ t: i, v: i === 5 ? 100 : i }));

  it('keeps the first and last points while downsampling', () => {
    const sampled = lttb(points, 5);
    expect(sampled).toHaveLength(5);
    expect(sampled[0]).toBe(points[0]);
    expect(sampled[sampled.length - 1]).toBe(points[points.length - 1]);
    expect(sampled).toContain(points[5]);
  });

  it('returns sensible fallbacks for edge thresholds', () => {
    expect(lttb(points, 99)).toEqual(points);
    expect(lttb(points, 2)).toEqual([points[0], points[points.length - 1]]);
    expect(lttb(points, 0)).toEqual(points);
    expect(lttb(null, 5)).toEqual([]);
  });
});

describe('timestamp helpers', () => {
  it('parses legacy and SQL Server timestamp strings', () => {
    const expected = Date.parse('2025-10-12T14:30:00+02:00');
    expect(toMs('2025-10-12T14:30:00+02')).toBe(expected);
    expect(toMs('2025-10-12 14:30:00.0000000 +02:00')).toBe(expected);
    expect(toMs(new Date(expected))).toBe(expected);
    expect(Number.isNaN(toMs('not a timestamp'))).toBe(true);
  });

  it('serializes dates to the Europe/Paris legacy format', () => {
    expect(toLegacyTs(new Date('2025-01-15T12:34:56Z'))).toBe('2025-01-15T13:34:56+01');
    expect(toLegacyTs(new Date('2025-07-15T12:34:56Z'))).toBe('2025-07-15T14:34:56+02');
  });
});

describe('parseCsvLine', () => {
  it('handles quoted commas, escaped quotes, and trailing empty fields', () => {
    expect(parseCsvLine('"a,b","c""d",e')).toEqual(['a,b', 'c"d', 'e']);
    expect(parseCsvLine('a,b,')).toEqual(['a', 'b', '']);
    expect(parseCsvLine('')).toEqual(['']);
  });
});

describe('metric key mappings', () => {
  it('maps frontend keys to database keys and back', () => {
    expect(toDbKey('densite')).toBe('density');
    expect(toDbKey('h2o')).toBe('H2O');
    expect(toFeKey('pH')).toBe('ph');
    expect(DB_TO_FRONTEND.grain).toBe('grains');
  });

  it('keeps complete key arrays and deterministic fallback behavior', () => {
    expect(ALL_FRONTEND_KEYS).toContain('grains');
    expect(ALL_DB_KEYS).toContain('grain');
    expect(toFeKey('UNKNOWN')).toBe('unknown');
  });
});
