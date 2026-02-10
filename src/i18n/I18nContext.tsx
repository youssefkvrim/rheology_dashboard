import { createContext, useContext, useCallback, useEffect, ReactNode } from 'react';
import { Language, LANGUAGE_NAMES, getTranslation } from './translations';
import { usePrefsStore } from '../store/prefsStore';

// wraps the app so any component can use translations
interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  availableLanguages: { code: Language; name: string }[];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const VALID_LANGS: Language[] = ['fr', 'en', 'it', 'es'];

// provides language + t() to the whole app tree
export function I18nProvider({ children }: { children: ReactNode }) {
  const rawLang = usePrefsStore(s => s.language);
  const setLangPref = usePrefsStore(s => s.setLanguage);
  // if stored lang is invalid, default to french
  const language: Language = VALID_LANGS.includes(rawLang as Language) ? (rawLang as Language) : 'fr';

  const setLanguage = useCallback((lang: Language) => {
    setLangPref(lang);
  }, [setLangPref]);

  const t = useCallback((key: string): string => {
    return getTranslation(language, key);
  }, [language]);

  const availableLanguages = Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
    code: code as Language,
    name,
  }));

  // set html lang attr for screen readers n stuff
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, availableLanguages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// lazy version - just gives u t() instead of the whole context
export function useTranslation() {
  const { t } = useI18n();
  return t;
}

