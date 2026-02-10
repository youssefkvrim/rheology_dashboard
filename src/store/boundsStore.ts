import { create } from 'zustand';
import type { Bounds } from '../types/domain';
import { getUserPrefs, putUserPrefs } from '../services/api';

export type AllBounds = {
  densite: Bounds; viscosite: Bounds; ph: Bounds; temperature: Bounds;
  pc: Bounds; h2o: Bounds; silice: Bounds; grains: Bounds;
};

// empty bounds = no limits set yet
const NULL_BOUNDS: Bounds = { low: null, high: null };
const DEFAULT_BOUNDS: AllBounds = {
  densite: { ...NULL_BOUNDS }, viscosite: { ...NULL_BOUNDS }, ph: { ...NULL_BOUNDS },
  temperature: { ...NULL_BOUNDS }, pc: { ...NULL_BOUNDS }, h2o: { ...NULL_BOUNDS },
  silice: { ...NULL_BOUNDS }, grains: { ...NULL_BOUNDS },
};

// this removes the old fake default values that were hardcoded before we had real ones
export function stripLegacyBounds(obj: any): any {
  const copy = { ...(obj || {}) };
  if (copy?.densite?.low === 1.25 && copy?.densite?.high === 1.45) copy.densite = { low: null, high: null };
  if (copy?.viscosite?.low === 350 && copy?.viscosite?.high === 550) copy.viscosite = { low: null, high: null };
  if (copy?.ph?.low === 7.5 && copy?.ph?.high === 9.0) copy.ph = { low: null, high: null };
  if (copy?.temperature?.low === 18 && copy?.temperature?.high === 28) copy.temperature = { low: null, high: null };
  return copy;
}

// same thing but for a whole map of slurry ids -> bounds
function stripLegacyBoundsMap(obj: Record<string, any>): Record<string, AllBounds> {
  const next: Record<string, AllBounds> = {};
  for (const [id, b] of Object.entries(obj || {})) {
    next[id] = stripLegacyBounds(b) as AllBounds;
  }
  return next;
}

function getUserId(): string {
  return sessionStorage.getItem('userId') || 'anonymous';
}

interface BoundsState {
  bounds: AllBounds;
  boundsById: Record<string, AllBounds>;
  setBounds: (metric: keyof AllBounds, next: Bounds) => void;
  getBoundsFor: (id: string) => AllBounds;
  setBoundsFor: (id: string, metric: keyof AllBounds, next: Bounds) => void;
  reloadFromStorage: () => void;
  reloadFromBackend: () => Promise<void>;
}

// we wait 2 sec before saving to the server so we dont spam it
let boundsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useBoundsStore = create<BoundsState>((set, get) => {
  // grab whatever bounds were saved locally so u dont start from scratch every time
  let initialBounds = { ...DEFAULT_BOUNDS };
  let initialBoundsById: Record<string, AllBounds> = {};
  try {
    const userId = getUserId();
    const raw = localStorage.getItem(`bounds:${userId}`);
    if (raw) initialBounds = { ...DEFAULT_BOUNDS, ...stripLegacyBounds(JSON.parse(raw)) };
    const rawMap = localStorage.getItem(`boundsById:${userId}`);
    if (rawMap) initialBoundsById = stripLegacyBoundsMap(JSON.parse(rawMap));
  } catch {}

  return {
    bounds: initialBounds,
    boundsById: initialBoundsById,

    setBounds: (metric, next) => {
      set(s => {
        const updated = { ...s.bounds, [metric]: next };
        // save locally + send to server
        try {
          localStorage.setItem(`bounds:${getUserId()}`, JSON.stringify(updated));
        } catch {}
        void putUserPrefs(getUserId(), { bounds: updated }).catch(() => {});
        return { bounds: updated };
      });
    },

    getBoundsFor: (id) => {
      const s = get();
      // fall back to global bounds if this slurry has no custom ones
      return s.boundsById[id] || s.bounds;
    },

    setBoundsFor: (id, metric, next) => {
      set(s => {
        const base = s.boundsById[id] || s.bounds;
        const updated = { ...s.boundsById, [id]: { ...base, [metric]: next } };
        // save to local storage right away so it feels instant
        try {
          localStorage.setItem(`boundsById:${getUserId()}`, JSON.stringify(updated));
        } catch {}
        // but we chill a bit before hitting the server lol
        if (boundsDebounceTimer) clearTimeout(boundsDebounceTimer);
        boundsDebounceTimer = setTimeout(() => {
          void putUserPrefs(getUserId(), { boundsById: updated }).catch(() => {});
        }, 2000);
        return { boundsById: updated };
      });
    },

    reloadFromStorage: () => {
      try {
        const userId = getUserId();
        const raw = localStorage.getItem(`bounds:${userId}`);
        if (raw) set(s => ({ bounds: { ...s.bounds, ...stripLegacyBounds(JSON.parse(raw)) } }));
        const rawMap = localStorage.getItem(`boundsById:${userId}`);
        if (rawMap) set({ boundsById: stripLegacyBoundsMap(JSON.parse(rawMap)) });
      } catch {}
    },

    reloadFromBackend: async () => {
      try {
        const userId = getUserId();
        // no point fetching if nobody's logged in tbh
        if (!userId || userId === 'anonymous') return;
        const prefs = await getUserPrefs(userId);
        if (prefs?.bounds) {
          set(s => ({ bounds: { ...s.bounds, ...stripLegacyBounds(prefs.bounds) } }));
        }
        if (prefs?.boundsById) {
          set({ boundsById: stripLegacyBoundsMap(prefs.boundsById) });
        }
      } catch {}
    },
  };
});
