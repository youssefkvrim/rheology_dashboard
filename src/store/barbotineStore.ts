import { create } from 'zustand';
import type { Barbotine, BarbotineConfig } from '../types/domain';
import { fetchSlurries } from '../services/api';

interface BarbotineState {
  barbotines: Barbotine[];
  initialDataLoading: boolean;
  loadBarbotines: () => Promise<void>;
  addBarbotine: (label: string, online?: boolean, config?: BarbotineConfig) => void;
}

export const useBarbotineStore = create<BarbotineState>((set, get) => {
  // basically the list of all our slurries, we save it so it survives page refresh
  let initial: Barbotine[] = [];
  try {
    const raw = localStorage.getItem('barbotines');
    if (raw) initial = JSON.parse(raw);
  } catch {}

  return {
    barbotines: initial,
    initialDataLoading: true,

    loadBarbotines: async () => {
      set({ initialDataLoading: true });
      try {
        const list = await fetchSlurries();
        // turn the raw server list into our nice format w/ readable names
        const next: Barbotine[] = list.map(it => ({
          id: it.id,
          name: it.id.replace(/_/g, ' '),
          slurryId: it.id,
          online: true,
          last: null,
        }));
        set({ barbotines: next });
        try { localStorage.setItem('barbotines', JSON.stringify(next)); } catch {}
      } catch {
        // if the server is down just keep whatever we had before
      } finally {
        set({ initialDataLoading: false });
      }
    },

    addBarbotine: (label, online, config) => {
      set(s => {
        const next = [...s.barbotines, { id: label, name: label, online: !!online, last: null, config }];
        try { localStorage.setItem('barbotines', JSON.stringify(next)); } catch {}
        return { barbotines: next };
      });
    },
  };
});
