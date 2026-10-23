import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import en from "./en.json";
import ar from "./ar.json";

export type Lang = "en" | "ar";
export type Numerals = "western" | "eastern";

const dictionaries: Record<Lang, Record<string, string>> = { en, ar };

const STORAGE_KEY = "mithaq.lang";
const NUMERALS_KEY = "mithaq.numerals";

type I18nValue = {
  lang: Lang;
  dir: "ltr" | "rtl";
  numerals: Numerals;
  t: (key: string) => string;
  n: (value: number | string) => string;
  setLang: (lang: Lang) => void;
  setNumerals: (numerals: Numerals) => void;
  toggleLang: () => void;
};

// Keep one context instance across hot reloads (e.g. when en.json/ar.json change),
// otherwise the mounted provider and consumers end up on different contexts.
const g = globalThis as unknown as { __mithaqI18nCtx?: React.Context<I18nValue | null> };
const I18nContext = (g.__mithaqI18nCtx ??= createContext<I18nValue | null>(null));

const EASTERN = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  const [numerals, setNumeralsState] = useState<Numerals>("western");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ar" || stored === "en") setLangState(stored);
    const storedNumerals = window.localStorage.getItem(NUMERALS_KEY);
    if (storedNumerals === "eastern" || storedNumerals === "western")
      setNumeralsState(storedNumerals);
  }, []);

  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const setNumerals = useCallback((next: Numerals) => {
    setNumeralsState(next);
    window.localStorage.setItem(NUMERALS_KEY, next);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const t = (key: string) => dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
    const n = (input: number | string) => {
      const text = String(input);
      if (numerals === "western") return text;
      return text.replace(/[0-9]/g, (d) => EASTERN[Number(d)]!);
    };
    return {
      lang,
      dir,
      numerals,
      t,
      n,
      setLang,
      setNumerals,
      toggleLang: () => setLang(lang === "en" ? "ar" : "en"),
    };
  }, [lang, dir, numerals, setLang, setNumerals]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
