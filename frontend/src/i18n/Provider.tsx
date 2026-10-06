import { useEffect, useState, type ReactNode } from "react";
import { initialLocale, LocaleContext } from "./context";
import "./language.css";

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState(initialLocale);
  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
    document.title = locale === "en" ? "Resume Studio" : "在线简历工作台";
    try {
      localStorage.setItem("resume-locale", locale);
    } catch {
      /* Browsing without storage still works. */
    }
  }, [locale]);
  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}
