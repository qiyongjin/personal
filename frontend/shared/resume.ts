import { z } from "zod";

const text = z.string().max(12000, "单项内容不能超过 12000 字");
const shortText = z.string().max(1000, "内容过长");
const id = z.string().min(1).max(80);
const title = z.string().trim().min(1, "请填写标题").max(200);
const bullet = z.object({ id, text: text.trim().min(1, "请填写条目内容") });
const base = { id, title };

export const contactSchema = z.object({
  id,
  label: shortText,
  value: shortText,
});

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("bullets"),
    items: z.array(bullet).max(100),
  }),
  z.object({
    ...base,
    type: z.literal("skills"),
    items: z
      .array(
        z.object({
          id,
          title,
          points: z.array(bullet).max(100),
        }),
      )
      .max(100),
  }),
  z.object({
    ...base,
    type: z.literal("projects"),
    items: z
      .array(
        z.object({
          id,
          company: shortText,
          name: title,
          start: shortText,
          end: shortText,
          role: shortText,
          technologies: shortText,
          description: text,
          responsibilitiesLabel: title,
          outcomesLabel: title,
          responsibilities: z.array(bullet).max(100),
          outcomes: z.array(bullet).max(100),
        }),
      )
      .max(100),
  }),
  z.object({ ...base, type: z.literal("text"), content: text }),
]);

export const resumeSchema = z
  .object({
    basics: z.object({
      name: title,
      headline: shortText,
      city: shortText,
      jobType: shortText,
      salary: shortText,
      phone: shortText,
      email: shortText,
      contacts: z.array(contactSchema).max(20).default([]),
    }),
    sections: z.array(sectionSchema).max(30),
  })
  .superRefine((data, context) => {
    const ids = new Set<string>();
    const visit = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      if ("id" in value && typeof value.id === "string") {
        if (ids.has(value.id))
          context.addIssue({ code: "custom", message: "条目 ID 不能重复" });
        ids.add(value.id);
      }
      Object.values(value).forEach(visit);
    };
    visit(data);
  });

export const englishResumeSchema = z.object({
  data: resumeSchema,
  source: resumeSchema,
});
export const saveResumeSchema = z.object({
  data: resumeSchema,
  version: z.number().int().positive(),
  english: englishResumeSchema.nullable().optional(),
});

export type ResumeData = z.infer<typeof resumeSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type ResumeSection = z.infer<typeof sectionSchema>;
export type Bullet = z.infer<typeof bullet>;
export type Project = Extract<
  ResumeSection,
  { type: "projects" }
>["items"][number];
export type Locale = "zh" | "en";
export type EnglishResume = z.infer<typeof englishResumeSchema>;
export type ResumeRecord = {
  data: ResumeData;
  version: number;
  updatedAt: string;
  english?: EnglishResume | null;
};

export function englishIsCurrent(
  data: ResumeData,
  english?: EnglishResume | null,
) {
  return !!english && JSON.stringify(data) === JSON.stringify(english.source);
}

export function resumeFileName(data: ResumeData, locale: Locale = "zh") {
  const name = Array.from(data.basics.name)
    .filter((char) => char.charCodeAt(0) >= 32)
    .join("");
  return `${name.replace(/[<>:"/\\|?*]/g, "").trim() || (locale === "en" ? "Personal" : "个人")}_${locale === "en" ? "Resume" : "简历"}.pdf`;
}
