import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useLoaderData, useNavigate } from "react-router-dom";
import ResumeDocument from "../../../shared/ResumeDocument";
import {
  englishIsCurrent,
  englishResumeSchema,
  resumeSchema,
  type EnglishResume,
  type Locale,
  type ResumeData,
  type ResumeRecord,
  type ResumeSection,
} from "../../../shared/resume";
import { ApiError, errorMessage, request } from "../../lib/api";
import ContactsEditor from "./ContactsEditor";
import { Field, ItemActions, SectionEditor } from "./Fields";
import { moveItem, newSection } from "./sections";
import ConfirmProvider from "../../components/ConfirmDialog/ConfirmProvider";
import { useConfirm } from "../../components/ConfirmDialog/useConfirm";
import { useI18n } from "../../i18n/context";
import LanguageSwitcher from "../../i18n/LanguageSwitcher";
import "./admin.css";

const basicsFields: [Exclude<keyof ResumeData["basics"], "contacts">, string][] = [
  ["name", "姓名"],
  ["headline", "职业简介"],
  ["city", "所在城市"],
  ["jobType", "求职类型"],
  ["salary", "薪资意向"],
  ["phone", "手机"],
  ["email", "邮箱"],
];
export default function Editor() {
  return (
    <ConfirmProvider>
      <ResumeEditor />
    </ConfirmProvider>
  );
}

function ResumeEditor() {
  const confirm = useConfirm();
  const { locale, t } = useI18n();
  const initial = useLoaderData() as ResumeRecord;
  const [record, setRecord] = useState(initial);
  const [chinese, setChinese] = useState(initial.data);
  const [english, setEnglish] = useState<EnglishResume | null>(
    initial.english ?? null,
  );
  const [contentLocale, setContentLocale] = useState<Locale>("zh");
  const [active, setActive] = useState("basics");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [sectionType, setSectionType] = useState<ResumeSection["type"]>("text");
  const [busy, setBusy] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [notice, setNotice] = useState("");
  const saving = useRef(false);
  const translationRequest = useRef<AbortController | null>(null);
  const allowNavigation = useRef(false);
  const navigate = useNavigate();
  const data = contentLocale === "en" && english ? english.data : chinese;
  const currentEnglish = englishIsCurrent(chinese, english);
  const hasContent = contentLocale === "zh" || !!english;
  const dirty =
    JSON.stringify([chinese, english]) !==
    JSON.stringify([record.data, record.english ?? null]);
  const blocker = useBlocker(
    () => !allowNavigation.current && (dirty || saving.current),
  );
  useEffect(() => () => translationRequest.current?.abort(), []);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    let current = true;
    void confirm({
      title: t("修改尚未保存"),
      description: t("离开后会丢失当前未保存的修改。"),
      confirmText: t("放弃并离开"),
      cancelText: t("继续编辑"),
      variant: "danger",
    }).then((confirmed) => {
      if (!current) return;
      if (confirmed) blocker.proceed();
      else blocker.reset();
    });
    return () => {
      current = false;
    };
  }, [blocker, confirm, t]);
  const selected = data.sections.find((section) => section.id === active);
  function change(next: ResumeData) {
    if (contentLocale === "en" && english)
      setEnglish({ ...english, data: next });
    else setChinese(next);
    setNotice("");
  }
  function updateSection(section: ResumeSection) {
    change({
      ...data,
      sections: data.sections.map((item) =>
        item.id === section.id ? section : item,
      ),
    });
  }
  function loadRecord(next: ResumeRecord) {
    setRecord(next);
    setChinese(next.data);
    setEnglish(next.english ?? null);
  }
  async function save() {
    if (saving.current) return;
    const valid = resumeSchema.safeParse(chinese);
    const validEnglish = englishResumeSchema.nullable().safeParse(english);
    if (!valid.success || !validEnglish.success) {
      const issue = !valid.success
        ? valid.error.issues[0]
        : !validEnglish.success
          ? validEnglish.error.issues[0]
          : undefined;
      setError(
        `${t("请检查表单")} (${t(!valid.success ? "中文内容" : "英文内容")}): ${t(issue?.message ?? "")}`,
      );
      return;
    }
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setExpired(false);
    try {
      const next = await request<ResumeRecord>("/api/admin/resume", {
        method: "PUT",
        body: JSON.stringify({
          data: valid.data,
          english: validEnglish.data,
          version: record.version,
        }),
      });
      loadRecord(next);
      setNotice("已保存，公开简历与 PDF 已同步更新。");
    } catch (cause) {
      setError(errorMessage(cause));
      setExpired(cause instanceof ApiError && cause.status === 401);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function generateEnglish() {
    if (saving.current) return;
    const valid = resumeSchema.safeParse(chinese);
    if (!valid.success) {
      setError(t("请先完善中文简历，再生成英文。"));
      return;
    }
    if (
      english &&
      !(await confirm({
        title: t("重新生成英文？"),
        description: t(
          "这会替换当前英文内容，包括手动校对的修改。中文内容不受影响。",
        ),
        confirmText: t("重新生成英文"),
      }))
    )
      return;
    saving.current = true;
    setBusy(true);
    setTranslating(true);
    setError("");
    setNotice("");
    const controller = new AbortController();
    translationRequest.current = controller;
    try {
      const translated = await request<EnglishResume>(
        "/api/admin/resume/translate",
        {
          method: "POST",
          body: JSON.stringify({ data: valid.data }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(190_000),
          ]),
        },
      );
      setChinese(valid.data);
      setEnglish(englishResumeSchema.parse(translated));
      setContentLocale("en");
      setActive("basics");
      setNotice("英文已生成，请校对后保存。");
    } catch (cause) {
      if (!controller.signal.aborted) setError(errorMessage(cause));
    } finally {
      translationRequest.current = null;
      saving.current = false;
      setBusy(false);
      setTranslating(false);
    }
  }
  async function markReviewed() {
    if (!english) return;
    const valid = resumeSchema.safeParse(chinese);
    if (!valid.success) {
      setError(t("请先完善中文简历，再生成英文。"));
      return;
    }
    if (
      await confirm({
        title: t("确认英文已校对？"),
        description: t(
          "请确认英文已包含最新中文修改。确认后保存即可重新发布英文。",
        ),
      })
    ) {
      setEnglish({ ...english, source: valid.data });
      setChinese(valid.data);
      setNotice("");
    }
  }
  async function reload() {
    if (
      dirty &&
      !(await confirm({
        title: t("重新加载最新版本？"),
        description: t(
          "重新加载会丢弃当前未保存的修改，并读取已保存的最新简历。",
        ),
        confirmText: t("重新加载"),
        cancelText: t("继续编辑"),
      }))
    )
      return;
    setBusy(true);
    try {
      loadRecord(await request<ResumeRecord>("/api/resume"));
      setActive("basics");
      setError("");
      setNotice("已加载服务器最新版本。");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (
      dirty &&
      !(await confirm({
        title: t("退出登录？"),
        description: t("你有尚未保存的修改，退出后这些修改将丢失。"),
        confirmText: t("退出登录"),
        cancelText: t("继续编辑"),
        variant: "danger",
      }))
    )
      return;
    setBusy(true);
    try {
      await request("/api/auth/logout", { method: "POST" });
      allowNavigation.current = true;
      navigate("/admin/login");
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }
  return (
    <div className="studio" data-mobile-view={mobileView}>
      <header className="studio-header">
        <div className="studio-brand">
          <span className="brand-mark">{locale === "en" ? "R" : "简"}</span>
          <div>
            <h1>{t("简历工作台")}</h1>
            <span>RESUME STUDIO</span>
          </div>
        </div>
        <div className="studio-header__actions">
          <LanguageSwitcher />
          <Link
            to={`/resume?lang=${contentLocale}`}
            target="_blank"
            rel="noreferrer"
          >
            {t("查看公开简历 ↗")}
          </Link>
          <button
            type="button"
            className="text-button"
            onClick={logout}
            disabled={busy}
          >
            {t("退出登录")}
          </button>
        </div>
      </header>
      <div className="studio-intro">
        <div>
          <span className="eyebrow">ONE RESUME. ALWAYS UP TO DATE.</span>
          <h2>{t("你的经历，随时更新。")}</h2>
          <p>{t("编辑内容，确认预览，保存后即可分享最新版。")}</p>
        </div>
        <div
          className={`save-indicator ${dirty ? "save-indicator--dirty" : ""}`}
        >
          <i />
          {t(dirty ? "有未保存的修改" : "所有修改已保存")}
          <small>
            {t("版本")} {record.version} ·{" "}
            {new Date(record.updatedAt).toLocaleString(
              locale === "en" ? "en-US" : "zh-CN",
            )}
          </small>
        </div>
      </div>
      <section className="translation-panel" aria-label={t("简历语言")}>
        <div className="translation-panel__row">
          <div className="translation-panel__tabs">
            {(["zh", "en"] as const).map((language) => (
              <button
                key={language}
                type="button"
                disabled={busy}
                aria-pressed={contentLocale === language}
                onClick={() => {
                  setContentLocale(language);
                  setActive("basics");
                }}
              >
                {t(language === "zh" ? "中文内容" : "英文内容")}
              </button>
            ))}
          </div>
          <div className="translation-panel__actions">
            <button type="button" disabled={busy} onClick={generateEnglish}>
              {t(
                translating
                  ? "正在翻译…"
                  : english
                    ? "重新生成英文"
                    : "生成英文",
              )}
            </button>
            {english && !currentEnglish && (
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={markReviewed}
              >
                {t("已校对，与当前中文同步")}
              </button>
            )}
          </div>
        </div>
        <p
          className={english && !currentEnglish ? "translation-warning" : ""}
          role="status"
        >
          {t(
            !english
              ? "英文尚未生成"
              : currentEnglish
                ? "英文已与中文同步"
                : "中文已修改，英文需要更新",
          )}{" "}
          · {t("英文生成后可以逐项编辑，保存时会同时发布中英文。")}
        </p>
        {english && (
          <p>
            {t(
              !currentEnglish
                ? "当前中文仍可保存和发布；英文更新并保存后恢复公开。"
                : "请校对姓名拼写、公司名、技术术语、日期和数字。",
            )}
          </p>
        )}
      </section>
      {!hasContent ? (
        <div className="translation-empty">
          <h2>{t("英文尚未生成")}</h2>
          <p>{t("先填写中文，再生成英文并校对。")}</p>
        </div>
      ) : (
        <>
          <div className="mobile-tabs" aria-label={t("工作区视图")}>
            <button
              type="button"
              aria-pressed={mobileView === "edit"}
              onClick={() => setMobileView("edit")}
            >
              {t("编辑内容")}
            </button>
            <button
              type="button"
              aria-pressed={mobileView === "preview"}
              onClick={() => setMobileView("preview")}
            >
              {t("简历预览")}
            </button>
          </div>
          <div className="studio-workspace">
            <section className="editor-panel" aria-label={t("简历编辑表单")}>
              <nav className="section-tabs" aria-label={t("简历章节")}>
                <button
                  type="button"
                  aria-current={active === "basics" ? "true" : undefined}
                  onClick={() => setActive("basics")}
                >
                  {t("基本信息")}
                </button>
                {data.sections.map((section) => (
                  <button
                    type="button"
                    key={section.id}
                    aria-current={active === section.id ? "true" : undefined}
                    onClick={() => setActive(section.id)}
                  >
                    {section.title || t("未命名章节")}
                  </button>
                ))}
              </nav>
              <fieldset className="editor-fields" disabled={busy}>
                {active === "basics" ? (
                  <>
                    <div className="panel-title">
                      <span>01 / PROFILE</span>
                      <h3>{t("基本信息")}</h3>
                      <p>{t("用简洁的信息，让对方快速认识你。")}</p>
                    </div>
                    <div className="field-grid">
                      {basicsFields.map(([key, label]) => (
                        <div
                          key={key}
                          className={
                            key === "headline" || key === "email"
                              ? "field-wide"
                              : ""
                          }
                        >
                          <Field
                            label={label}
                            multiline={key === "headline"}
                            value={data.basics[key]}
                            onChange={(value) =>
                              change({
                                ...data,
                                basics: { ...data.basics, [key]: value },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <ContactsEditor
                      items={data.basics.contacts ?? []}
                      onChange={(contacts) =>
                        change({ ...data, basics: { ...data.basics, contacts } })
                      }
                    />
                  </>
                ) : (
                  selected && (
                    <>
                      <div className="panel-title">
                        <span>
                          SECTION /{" "}
                          {String(data.sections.indexOf(selected) + 2).padStart(
                            2,
                            "0",
                          )}
                        </span>
                        <h3>{selected.title}</h3>
                      </div>
                      <ItemActions
                        index={data.sections.indexOf(selected)}
                        count={data.sections.length}
                        label={`${t("章节")}「${selected.title}」`}
                        onMove={(step) =>
                          change({
                            ...data,
                            sections: moveItem(
                              data.sections,
                              data.sections.indexOf(selected),
                              step,
                            ),
                          })
                        }
                        onDelete={() => {
                          change({
                            ...data,
                            sections: data.sections.filter(
                              (section) => section.id !== selected.id,
                            ),
                          });
                          setActive("basics");
                        }}
                      />
                      <Field
                        label="章节标题"
                        value={selected.title}
                        onChange={(title) =>
                          updateSection({ ...selected, title })
                        }
                      />
                      <SectionEditor
                        section={selected}
                        locale={contentLocale}
                        onChange={updateSection}
                      />
                    </>
                  )
                )}
                <div className="add-section">
                  <label htmlFor="section-type">{t("扩展简历章节")}</label>
                  <div>
                    <select
                      id="section-type"
                      value={sectionType}
                      onChange={(e) =>
                        setSectionType(e.target.value as ResumeSection["type"])
                      }
                    >
                      <option value="text">{t("自定义文字")}</option>
                      <option value="bullets">{t("个人优势")}</option>
                      <option value="skills">{t("专业技能")}</option>
                      <option value="projects">{t("项目经历")}</option>
                    </select>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        const section = newSection(sectionType, contentLocale);
                        change({
                          ...data,
                          sections: [...data.sections, section],
                        });
                        setActive(section.id);
                      }}
                    >
                      ＋ {t("添加")}
                      {t("章节")}
                    </button>
                  </div>
                </div>
              </fieldset>
            </section>
            <section className="preview-panel" aria-label={t("实时简历预览")}>
              <div className="preview-caption">
                <span>
                  <i /> {t("实时预览")}
                </span>
                <span>{t("A4 · 自动分页导出")}</span>
              </div>
              <ResumeDocument data={data} locale={contentLocale} />
            </section>
          </div>
        </>
      )}
      <footer className="studio-savebar">
        <div className="savebar-status" aria-live="polite">
          {error ? (
            <p className="feedback feedback--error" role="alert">
              {t(error)}
              {expired && (
                <>
                  {" "}
                  <a href="/admin/login" target="_blank" rel="noreferrer">
                    {t("打开登录页")}
                  </a>
                  {t("，登录后回到此页重新保存。")}
                </>
              )}
            </p>
          ) : (
            <p>
              {t(
                notice ||
                  (dirty
                    ? "保存后，访客即可查看和下载新版。"
                    : "公开页面和下载文件使用同一份简历。"),
              )}
            </p>
          )}
          <button
            type="button"
            className="text-button"
            onClick={reload}
            disabled={busy}
          >
            {t("重新加载最新版本")}
          </button>
        </div>
        <div className="savebar-actions">
          <button
            type="button"
            className="save-button"
            onClick={save}
            disabled={busy || !dirty}
          >
            {t(busy ? "正在处理…" : "保存并更新")}
          </button>
        </div>
      </footer>
    </div>
  );
}
