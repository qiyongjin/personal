import { useLoaderData, useSearchParams } from "react-router-dom";
import ResumeDocument from "../../../shared/ResumeDocument";
import {
  englishIsCurrent,
  resumeFileName,
  type ResumeRecord,
} from "../../../shared/resume";
import { useI18n } from "../../i18n/context";
import ResumeActions from "./components/ResumeActions";
import "./index.css";

export default function Personal() {
  const record = useLoaderData() as ResumeRecord;
  const { locale, t, setLocale } = useI18n();
  const [search, setSearch] = useSearchParams();
  const ready =
    locale === "zh" || englishIsCurrent(record.data, record.english);
  const data = locale === "en" && ready ? record.english!.data : record.data;
  return (
    <div className="personal-page">
      {ready && (
        <ResumeActions
          fileName={resumeFileName(data, locale)}
          locale={locale}
        />
      )}
      <main className="resume-layout">
        {ready ? (
          <ResumeDocument data={data} locale={locale} />
        ) : (
          <div className="translation-empty" role="status">
            <h2>
              {t(
                record.english
                  ? "英文版本正在更新，请先查看中文版。"
                  : "英文版本尚未发布。",
              )}
            </h2>
            <button
              onClick={() => {
                const next = new URLSearchParams(search);
                next.set("lang", "zh");
                setLocale("zh");
                setSearch(next, { replace: true });
              }}
            >
              {t("查看中文版")}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
