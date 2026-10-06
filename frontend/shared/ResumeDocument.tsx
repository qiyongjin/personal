import type { Bullet, Locale, ResumeData, ResumeSection } from "./resume";
import { translate } from "./i18n";

function Points({
  items,
  ordered = false,
}: {
  items: Bullet[];
  ordered?: boolean;
}) {
  const Tag = ordered ? "ol" : "ul";
  const visible = items.filter((item) => item.text.trim());
  if (!visible.length) return null;
  return (
    <Tag className="resume-points">
      {visible.map((item) => (
        <li key={item.id}>{item.text}</li>
      ))}
    </Tag>
  );
}

function SectionBody({
  section,
  locale,
}: {
  section: ResumeSection;
  locale: Locale;
}) {
  switch (section.type) {
    case "bullets":
      return <Points items={section.items} ordered />;
    case "text":
      return <p className="resume-text">{section.content}</p>;
    case "skills":
      return section.items.map((item) => (
        <div className="resume-entry" key={item.id}>
          <h3>{item.title}</h3>
          <Points items={item.points} />
        </div>
      ));
    case "projects":
      return section.items.map((item) => (
        <div className="resume-entry resume-project" key={item.id}>
          <h3>{[item.company, item.name].filter(Boolean).join(" — ")}</h3>
          {(item.start || item.end || item.role) && (
            <p className="resume-project__meta">
              {[[item.start, item.end].filter(Boolean).join(" - "), item.role]
                .filter(Boolean)
                .join(" | ")}
            </p>
          )}
          {item.technologies && (
            <p className="resume-text">
              {translate("技术栈", locale)}
              {locale === "en" ? ": " : "："}
              {item.technologies}
            </p>
          )}
          {item.description && (
            <p className="resume-text">
              {translate("项目描述", locale)}
              {locale === "en" ? ": " : "："}
              {item.description}
            </p>
          )}
          {!!item.responsibilities.length && (
            <>
              <h4>{item.responsibilitiesLabel}</h4>
              <Points items={item.responsibilities} />
            </>
          )}
          {!!item.outcomes.length && (
            <>
              <h4>{item.outcomesLabel}</h4>
              <Points items={item.outcomes} />
            </>
          )}
        </div>
      ));
  }
}

export default function ResumeDocument({
  data,
  locale = "zh",
}: {
  data: ResumeData;
  locale?: Locale;
}) {
  const { basics, sections } = data;
  const contact = [
    basics.city,
    basics.jobType,
    basics.salary,
    basics.phone && `${translate("手机", locale)}: ${basics.phone}`,
    basics.email && `${translate("邮箱", locale)}: ${basics.email}`,
    ...(basics.contacts ?? []).map(({ label, value }) => {
      const content = value.trim();
      if (!content) return "";
      const heading = label.trim();
      return heading
        ? `${heading}${locale === "en" ? ": " : "："}${content}`
        : content;
    }),
  ]
    .filter(Boolean)
    .join(" | ");
  return (
    <article
      className="resume-paper"
      lang={locale === "en" ? "en" : "zh-CN"}
      aria-label={translate("个人简历", locale)}
    >
      <header className="resume-header">
        <h1>{basics.name || translate("你的姓名", locale)}</h1>
        {basics.headline && (
          <p className="resume-headline">{basics.headline}</p>
        )}
        {contact && <p className="resume-contact">{contact}</p>}
      </header>
      <div className="resume-body">
        {sections.map((section) => (
          <section className="resume-section" key={section.id}>
            <h2>{section.title}</h2>
            <SectionBody section={section} locale={locale} />
          </section>
        ))}
      </div>
    </article>
  );
}
