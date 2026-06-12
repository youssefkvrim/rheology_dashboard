// re-export everything so u can import from @/i18n or whatever
export { I18nProvider, useI18n, useTranslation } from './I18nContext';
export type { Language } from './translations';
export { LANGUAGE_NAMES, translations, getTranslation } from './translations';
