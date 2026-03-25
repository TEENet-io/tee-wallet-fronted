import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import en from '../i18n/en';
import zh from '../i18n/zh';

type Lang = 'en' | 'zh';
type Translations = Record<string, string>;

const translations: Record<Lang, Translations> = { en, zh };

interface LanguageContextValue {
  lang: Lang;
  toggleLang: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    return (localStorage.getItem('ocw_lang') as Lang) || 'en';
  });

  const toggleLang = useCallback(() => {
    setLang(prev => {
      const next = prev === 'en' ? 'zh' : 'en';
      localStorage.setItem('ocw_lang', next);
      return next;
    });
  }, []);

  const t = useCallback((key: string): string => {
    return translations[lang][key] || translations['en'][key] || key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
