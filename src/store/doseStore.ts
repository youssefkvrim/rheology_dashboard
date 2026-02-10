import { create } from 'zustand';
import type { MetricSample } from '../types/domain';

interface DoseState {
  doseRateLph: number;
  setDoseRateLph: (rate: number) => void;
  doseRateHistory: MetricSample[];
  coverPowerHistory: MetricSample[];
  addCoverPowerResult: (value: number) => void;
  lastPlaqueSrc: string | null;
  setLastPlaqueSrc: (src: string | null) => void;
}

// everything related to dosing rate + plaque analysis results
export const useDoseStore = create<DoseState>((set) => ({
  doseRateLph: 0.019,
  // clamp to 0 minimum and round to 3 decimals so we dont get weird float stuff
  setDoseRateLph: (rate) => set({ doseRateLph: Math.max(0, Number(rate.toFixed(3))) }),
  doseRateHistory: [],
  coverPowerHistory: [],
  // add a new cover power reading, keep last 200 so memory doesnt blow up
  addCoverPowerResult: (value) =>
    set(s => ({
      coverPowerHistory: [...s.coverPowerHistory, { t: Date.now(), v: Number(value.toFixed(2)) }].slice(-200),
    })),
  // last plaque image url, basically what the user uploaded for analysis
  lastPlaqueSrc: null,
  setLastPlaqueSrc: (src) => set({ lastPlaqueSrc: src }),
}));
