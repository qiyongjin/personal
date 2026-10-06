import { createContext, useCallback, useContext } from "react";
import type { Locale } from "../../shared/resume";
import { translate } from "../../shared/i18n";

export function initialLocale(): Locale {
  const query = new URLSearchParams(window.location.search).get("lang");
  if (query === "en" || query === "zh") return query;
  try {
    return localStorage.getItem("resume-locale") === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}
export const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: "zh", setLocale: () => {} });
export function useI18n() {
  const context = useContext(LocaleContext);
  const t = useCallback(
    (text: string) => translate(text, context.locale),
    [context.locale],
  );
  return { ...context, t };
}
