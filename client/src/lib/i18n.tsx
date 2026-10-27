import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANG, LANGUAGES, type Lang, type LocalizedText } from "@2t2m/shared";
import { de } from "@/locales/de";
import { en } from "@/locales/en";

export type Dict = typeof en;

const DICTS: Record<Lang, Dict> = { en, de };
export const LANGUAGE_NAMES: Record<Lang, string> = { en: "English", de: "Deutsch" };

const STORAGE_KEY = "lang";

function storedLang(): Lang {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.includes(value as Lang) ? (value as Lang) : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

/** Ersetzt Platzhalter wie `{count}` im Text. */
function fmt(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dict;
  fmt: typeof fmt;
  /** Text aus einer Server-Antwort in der aktuellen Sprache. */
  local: (text: LocalizedText) => string;
  /** Übersetzt einen Fehlercode vom Server, sonst eine allgemeine Meldung. */
  errorText: (err: unknown) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(storedLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => {
    const t = DICTS[lang];
    return {
      lang,
      setLang: (next) => {
        setLangState(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // Ohne Speicher gilt die Auswahl nur bis zum Neuladen.
        }
      },
      t,
      fmt,
      local: (text) => text[lang],
      errorText: (err) => {
        const code = err instanceof Error ? err.message : "";
        return code in t.errors ? t.errors[code as keyof Dict["errors"]] : t.common.unknownError;
      },
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n muss innerhalb von I18nProvider verwendet werden");
  return ctx;
}
