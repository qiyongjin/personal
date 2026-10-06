import type { Locale, ResumeSection } from "../../../shared/resume";
import { translate } from "../../../shared/i18n";

export function moveItem<T>(items: T[], index: number, step: number) {
  const result = [...items];
  [result[index], result[index + step]] = [result[index + step], result[index]];
  return result;
}

export function newSection(
  type: ResumeSection["type"],
  locale: Locale = "zh",
): ResumeSection {
  const base = { id: crypto.randomUUID() };
  switch (type) {
    case "bullets":
      return { ...base, type, title: translate("个人优势", locale), items: [] };
    case "skills":
      return { ...base, type, title: translate("专业技能", locale), items: [] };
    case "projects":
      return { ...base, type, title: translate("项目经历", locale), items: [] };
    case "text":
      return {
        ...base,
        type,
        title: translate("自定义章节", locale),
        content: "",
      };
  }
}
