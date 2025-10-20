// Unit conversion helpers per metric

export type ConvertFn = (v: number) => number;

export function viscConverters(unit: string): { to: ConvertFn; from: ConvertFn; axisLabel: string } {
  // base = mPa·s
  switch (unit) {
    case 'Pa·s': return { to: v => v / 1000, from: v => v * 1000, axisLabel: 'Pa·s' };
    case 'mPa·s': return { to: v => v, from: v => v, axisLabel: 'mPa·s' };
    case 'cP': return { to: v => v, from: v => v, axisLabel: 'cP' }; // 1 mPa·s == 1 cP
    case 'P': return { to: v => v / 100, from: v => v * 100, axisLabel: 'P' }; // 1 P = 100 cP
    case 'St': return { to: v => v / 1000, from: v => v * 1000, axisLabel: 'St' }; // assuming density ~1 g/cm³
    case 'cSt': return { to: v => v, from: v => v, axisLabel: 'cSt' }; // ~ mPa·s
    case 's': return { to: v => v, from: v => v, axisLabel: 's' }; // placeholder (rheology time)
    default: return { to: v => v, from: v => v, axisLabel: unit };
  }
}

export function densConverters(unit: string): { to: ConvertFn; from: ConvertFn; axisLabel: string } {
  // base = g/cm³
  switch (unit) {
    case 'kg/m³': return { to: v => v * 1000, from: v => v / 1000, axisLabel: 'kg/m³' };
    case 'g/cm³': return { to: v => v, from: v => v, axisLabel: 'g/cm³' };
    case 'g/mL': return { to: v => v, from: v => v, axisLabel: 'g/mL' };
    case 'kg/L': return { to: v => v, from: v => v, axisLabel: 'kg/L' };
    case 'g/L': return { to: v => v * 1000, from: v => v / 1000, axisLabel: 'g/L' };
    case 'mg/mL': return { to: v => v * 1000, from: v => v / 1000, axisLabel: 'mg/mL' };
    default: return { to: v => v, from: v => v, axisLabel: unit };
  }
}

export function tempConverters(unit: string): { to: ConvertFn; from: ConvertFn; axisLabel: string } {
  // base = °C
  switch (unit) {
    case '°C': return { to: v => v, from: v => v, axisLabel: '°C' };
    case '°F': return { to: v => v * 9/5 + 32, from: v => (v - 32) * 5/9, axisLabel: '°F' };
    case 'K': return { to: v => v + 273.15, from: v => v - 273.15, axisLabel: 'K' };
    default: return { to: v => v, from: v => v, axisLabel: unit };
  }
}

export function h2oConverters(unit: string): { to: ConvertFn; from: ConvertFn; axisLabel: string } {
  // base = L/h
  switch (unit) {
    case 'L/h': return { to: v => v, from: v => v, axisLabel: 'L/h' };
    case 'L/day': return { to: v => v * 24, from: v => v / 24, axisLabel: 'L/day' };
    case 'mL/min': return { to: v => v * 1000 / 60, from: v => v * 60 / 1000, axisLabel: 'mL/min' };
    case 'mL/s': return { to: v => v * 1000 / 3600, from: v => v * 3600 / 1000, axisLabel: 'mL/s' };
    default: return { to: v => v, from: v => v, axisLabel: unit };
  }
}

export function pcConverters(unit: string): { to: ConvertFn; from: ConvertFn; axisLabel: string } {
  // base = g; for g/cm², plaque is 15 cm x 15 cm => 225 cm²
  switch (unit) {
    case 'g': return { to: v => v, from: v => v, axisLabel: 'g' };
    case 'g/cm²': return { to: v => v / 225, from: v => v * 225, axisLabel: 'g/cm²' };
    default: return { to: v => v, from: v => v, axisLabel: unit };
  }
}


