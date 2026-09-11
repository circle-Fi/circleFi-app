import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

const translations = { en, es, pt };
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
];

const I18nContext = createContext(null);

export function getInitialLocale() {
  const saved = localStorage.getItem('circlefi_locale');
  if (saved && translations[saved]) return saved;
  const nav = navigator.language?.split('-')[0]?.toLowerCase();
  if (nav && translations[nav]) return nav;
  return 'en';
}

function resolveKey(obj, path) {
  const parts = path.split('.');
  let curr = obj;
  for (const p of parts) {
    if (curr == null || typeof curr !== 'object') return null;
    curr = curr[p];
  }
  return typeof curr === 'string' ? curr : null;
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(getInitialLocale);

  const setLocale = (lang) => {
    if (translations[lang]) {
      setLocaleState(lang);
      try {
        localStorage.setItem('circlefi_locale', lang);
      } catch (_) {}
    }
  };

  const t = useMemo(() => {
    return (key, params = {}) => {
      let msg = resolveKey(translations[locale], key);
      if (msg == null) {
        msg = resolveKey(translations.en, key);
      }
      if (msg == null) return key;

      return Object.entries(params).reduce((str, [k, v]) => {
        return str.replaceAll(`{${k}}`, v ?? '');
      }, msg);
    };
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
