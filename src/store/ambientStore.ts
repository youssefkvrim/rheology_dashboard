import { create } from 'zustand';

interface AmbientState {
  ambient: { temperatureRoom: number; humidityRoom: number };
  ambientHistory: { t: number; temp: number; humid: number }[];
}

// room temp + humidity store, rn its empty but will hook up to real sensors later
export const useAmbientStore = create<AmbientState>(() => ({
  ambient: { temperatureRoom: 0, humidityRoom: 0 },
  ambientHistory: [],
}));
