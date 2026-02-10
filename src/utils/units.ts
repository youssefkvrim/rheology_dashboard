// unit conversion stuff — each function takes a unit string and gives u converters to/from that unit

// just a function that takes a number and returns a number, nothing fancy
export type ConvertFn = (v: number) => number;

// viscosity converter — base unit is mPa·s
export function viscConverters(unit: string): { to: ConvertFn; from: ConvertFn; axisLabel: string } {
  switch (unit) {
    case 'Pa·s': return { to: v => v / 1000, from: v => v * 1000, axisLabel: 'Pa·s' };
    case 'mPa·s': return { to: v => v, from: v => v, axisLabel: 'mPa·s' };
    case 'cP': return { to: v => v, from: v => v, axisLabel: 'cP' }; // fun fact: 1 mPa·s = 1 cP so no math needed
    case 'P': return { to: v => v / 100, from: v => v * 100, axisLabel: 'P' }; // 1 poise = 100 centipoise
    case 'St': return { to: v => v / 1000, from: v => v * 1000, axisLabel: 'St' }; // assumes density ~1 g/cm³ tbh
    case 'cSt': return { to: v => v, from: v => v, axisLabel: 'cSt' }; // roughly same as mPa·s
    case 's': return { to: v => v, from: v => v, axisLabel: 's' }; // raw seconds for rheology time stuff
    default: return { to: v => v, from: v => v, axisLabel: unit };
  }
}

// density converter — base unit is g/cm³
export function densConverters(unit: string): { to: ConvertFn; from: ConvertFn; axisLabel: string } {
  switch (unit) {
    case 'kg/m³': return { to: v => v * 1000, from: v => v / 1000, axisLabel: 'kg/m³' };
    case 'g/cm³': return { to: v => v, from: v => v, axisLabel: 'g/cm³' };
    case 'g/mL': return { to: v => v, from: v => v, axisLabel: 'g/mL' }; // same thing as g/cm³ lol
    case 'kg/L': return { to: v => v, from: v => v, axisLabel: 'kg/L' }; // also the same ngl
    case 'g/L': return { to: v => v * 1000, from: v => v / 1000, axisLabel: 'g/L' };
    case 'mg/mL': return { to: v => v * 1000, from: v => v / 1000, axisLabel: 'mg/mL' };
    default: return { to: v => v, from: v => v, axisLabel: unit };
  }
}

// temperature converter — base unit is °C
export function tempConverters(unit: string): { to: ConvertFn; from: ConvertFn; axisLabel: string } {
  switch (unit) {
    case '°C': return { to: v => v, from: v => v, axisLabel: '°C' };
    case '°F': return { to: v => v * 9/5 + 32, from: v => (v - 32) * 5/9, axisLabel: '°F' }; // the classic formula
    case 'K': return { to: v => v + 273.15, from: v => v - 273.15, axisLabel: 'K' }; // just add 273 basically
    default: return { to: v => v, from: v => v, axisLabel: unit };
  }
}

// water flow converter — base unit is L/h
export function h2oConverters(unit: string): { to: ConvertFn; from: ConvertFn; axisLabel: string } {
  switch (unit) {
    case 'L/h': return { to: v => v, from: v => v, axisLabel: 'L/h' };
    case 'L/day': return { to: v => v * 24, from: v => v / 24, axisLabel: 'L/day' };
    case 'mL/min': return { to: v => v * 1000 / 60, from: v => v * 60 / 1000, axisLabel: 'mL/min' };
    case 'mL/s': return { to: v => v * 1000 / 3600, from: v => v * 3600 / 1000, axisLabel: 'mL/s' };
    default: return { to: v => v, from: v => v, axisLabel: unit };
  }
}

// pouvoir couvrant (covering power) converter — base unit is grams
export function pcConverters(unit: string): { to: ConvertFn; from: ConvertFn; axisLabel: string } {
  switch (unit) {
    case 'g': return { to: v => v, from: v => v, axisLabel: 'g' };
    case 'g/cm²': return { to: v => v / 225, from: v => v * 225, axisLabel: 'g/cm²' }; // plaque is 15x15cm = 225cm²
    default: return { to: v => v, from: v => v, axisLabel: unit };
  }
}
