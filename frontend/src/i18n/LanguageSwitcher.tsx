import { useI18n } from "./context";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { Locale } from "../../shared/resume";

export default function LanguageSwitcher({
  syncUrl = false,
}: {
  syncUrl?: boolean;
}) {
  const { locale, setLocale, t } = useI18n();
  const [search, setSearch] = useSearchParams();
  useEffect(() => {
    const language = search.get("lang");
    if (syncUrl && (language === "en" || language === "zh"))
      setLocale(language);
  }, [search, setLocale, syncUrl]);
  function select(language: Locale) {
    setLocale(language);
    if (syncUrl) {
      const next = new URLSearchParams(search);
      next.set("lang", language);
      setSearch(next, { replace: true });
    }
  }
  return (
    <div className="language-switch" role="group" aria-label={t("界面语言")}>
      <button
        type="button"
        lang="zh-CN"
        aria-pressed={locale === "zh"}
        onClick={() => select("zh")}
      >
        {t("中文")}
      </button>
      <button
        type="button"
        lang="en"
        aria-pressed={locale === "en"}
        onClick={() => select("en")}
      >
        {t("英文")}
      </button>
    </div>
  );
}
