import { create } from 'zustand';

function getUserId(): string {
  return sessionStorage.getItem('userId') || 'anonymous';
}

// makes a storage key unique per user so prefs dont leak between accounts
function prefKey(key: string): string {
  return `${getUserId()}:${key}`;
}

interface PrefsState {
  theme: 'light' | 'dark';
  accentColor: string;
  notifChannel: 'sms' | 'email';
  notifTypes: string[];
  refreshInterval: number;
  language: string;
  setTheme: (t: 'light' | 'dark') => void;
  setAccentColor: (c: string) => void;
  setNotifChannel: (c: 'sms' | 'email') => void;
  setNotifTypes: (types: string[]) => void;
  setRefreshInterval: (seconds: number) => void;
  setLanguage: (lang: string) => void;
  reloadFromStorage: () => void;
}

const MIN_REFRESH_INTERVAL_MS = 30_000;

export function toRefreshIntervalMs(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return MIN_REFRESH_INTERVAL_MS;
  const ms = n > 1000 ? n : n * 1000;
  return Math.max(MIN_REFRESH_INTERVAL_MS, Math.floor(ms));
}

// tries to load a pref from storage, checks the new user-scoped key first then the old flat key for backwards compat
function loadPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(prefKey(key)) ?? localStorage.getItem(key);
    if (v == null) return fallback;
    return JSON.parse(v) as T;
  } catch {
    try {
      // if JSON.parse failed maybe its just a raw string, try using it as-is
      const v = localStorage.getItem(prefKey(key)) ?? localStorage.getItem(key);
      return (v as unknown as T) ?? fallback;
    } catch {
      return fallback;
    }
  }
}

function savePref(key: string, value: any) {
  try {
    localStorage.setItem(prefKey(key), JSON.stringify(value));
  } catch {}
}

// all the user settings like theme, language, notifs etc - everything persists in localStorage
export const usePrefsStore = create<PrefsState>((set) => ({
  theme: (loadPref('theme', 'light') as 'light' | 'dark'),
  accentColor: loadPref('accent-color', '#0e224b'),
  notifChannel: loadPref('notif-channel', 'email') as 'sms' | 'email',
  notifTypes: loadPref('notif-types', ['email']),
  refreshInterval: loadPref('refresh-interval', 30),
  language: loadPref('language', 'fr'),

  // each setter saves to storage then updates the state, pretty straightforward
  setTheme: (t) => { savePref('theme', t); set({ theme: t }); },
  setAccentColor: (c) => { savePref('accent-color', c); set({ accentColor: c }); },
  setNotifChannel: (c) => { savePref('notif-channel', c); set({ notifChannel: c }); },
  setNotifTypes: (types) => { savePref('notif-types', types); set({ notifTypes: types }); },
  setRefreshInterval: (seconds) => {
    const next = Math.max(30, Math.floor(Number(seconds) || 30));
    savePref('refresh-interval', next);
    set({ refreshInterval: next });
  },
  setLanguage: (lang) => { savePref('language', lang); set({ language: lang }); },

  // nuke everything and re-read from storage, useful after login/logout
  reloadFromStorage: () => {
    set({
      theme: loadPref('theme', 'light') as 'light' | 'dark',
      accentColor: loadPref('accent-color', '#0e224b'),
      notifChannel: loadPref('notif-channel', 'email') as 'sms' | 'email',
      notifTypes: loadPref('notif-types', ['email']),
      refreshInterval: loadPref('refresh-interval', 30),
      language: loadPref('language', 'fr'),
    });
  },
}));
