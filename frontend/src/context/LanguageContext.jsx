/**
 * LanguageContext — Global language state for Chalo Kisaan.
 *
 * Persists language to localStorage so it survives refreshes.
 * Exposes:
 *   language       — current language key (hindi|english|marathi|punjabi|gujarati)
 *   setLanguage    — update the language
 *   t(key)         — shorthand to translate a key in the current language
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { tr } from '../i18n/translations';

const LanguageContext = createContext(null);

const STORAGE_KEY = 'ck_language';

function loadStoredLang() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'hindi';
  } catch {
    return 'hindi';
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(loadStoredLang);

  const setLanguage = useCallback((lang) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch { /* storage unavailable */ }
  }, []);

  // Bound translator for current language
  const t = useCallback((key) => tr(key, language), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
