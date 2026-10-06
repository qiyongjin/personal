import type { Locale } from "./resume";

import englishMessages from "./locales/en.json";

export const english: Record<string, string> = englishMessages;

export function translate(text: string, locale: Locale) {
  return locale === "en" ? (english[text] ?? text) : text;
}
