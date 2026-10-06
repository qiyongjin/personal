import { useId } from "react";
import type {
  Bullet,
  Locale,
  Project,
  ResumeSection,
} from "../../../shared/resume";
import { translate } from "../../../shared/i18n";
import { useI18n } from "../../i18n/context";
import { moveItem } from "./sections";
import { useConfirm } from "../../components/ConfirmDialog/useConfirm";

export function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const id = useId();
  const { t } = useI18n();
  return (
    <div className="editor-field">
      <label htmlFor={id}>{t(label)}</label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export function ItemActions({
  index,
  count,
  label,
  onMove,
  onDelete,
}: {
  index: number;
  count: number;
  label: string;
  onMove: (step: number) => void;
  onDelete: () => void;
}) {
  const confirm = useConfirm();
  const { t } = useI18n();
  async function deleteItem() {
    if (
      await confirm({
        title: t("确认删除"),
        description: (
          <>
            <p>
              {t("确定删除")} <strong>{label}</strong>?
            </p>
            <p>{t("保存后才会更新公开简历。")}</p>
          </>
        ),
        confirmText: t("确认删除"),
        variant: "danger",
      })
    )
      onDelete();
  }
  return (
    <span className="item-actions">
      <button
        type="button"
        className="icon-button"
        aria-label={`${t("上移")}${label}`}
        title={t("上移")}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={`${t("下移")}${label}`}
        title={t("下移")}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        ↓
      </button>
      <button
        type="button"
        className="text-button danger"
        aria-label={`${t("删除")}${label}`}
        onClick={deleteItem}
      >
        {t("删除")}
      </button>
    </span>
  );
}
export function PointsEditor({
  label: labelKey,
  items,
  onChange,
}: {
  label: string;
  items: Bullet[];
  onChange: (items: Bullet[]) => void;
}) {
  const { t } = useI18n();
  const label = t(labelKey);
  return (
    <div className="points-editor">
      <div className="field-heading">
        {label}
        <span>
          {items.length} {t("条")}
        </span>
      </div>
      {items.map((item, index) => (
        <div className="point-row" key={item.id}>
          <span className="point-index">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="point-content">
            <Field
              label={`${label} ${index + 1}`}
              multiline
              value={item.text}
              onChange={(text) =>
                onChange(
                  items.map((entry) =>
                    entry.id === item.id ? { ...entry, text } : entry,
                  ),
                )
              }
            />
            <ItemActions
              index={index}
              count={items.length}
              label={`${label} ${index + 1}`}
              onMove={(step) => onChange(moveItem(items, index, step))}
              onDelete={() =>
                onChange(items.filter((entry) => entry.id !== item.id))
              }
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        className="add-button"
        onClick={() =>
          onChange([...items, { id: crypto.randomUUID(), text: "" }])
        }
      >
        ＋ {t("添加")}
        {label}
      </button>
    </div>
  );
}

function ProjectEditor({
  project,
  onChange,
}: {
  project: Project;
  onChange: (project: Project) => void;
}) {
  const fields: [
    keyof Pick<
      Project,
      | "company"
      | "name"
      | "start"
      | "end"
      | "role"
      | "technologies"
      | "description"
    >,
    string,
  ][] = [
    ["company", "公司名称"],
    ["name", "项目名称"],
    ["start", "开始时间"],
    ["end", "结束时间（或“至今”）"],
    ["role", "担任角色"],
    ["technologies", "技术栈"],
    ["description", "项目描述"],
  ];
  return (
    <div className="entry-form">
      <div className="field-grid">
        {fields.map(([key, label]) => (
          <div
            className={
              ["role", "technologies", "description"].includes(key)
                ? "field-wide"
                : ""
            }
            key={key}
          >
            <Field
              label={label}
              value={project[key]}
              multiline={key === "description"}
              onChange={(value) => onChange({ ...project, [key]: value })}
            />
          </div>
        ))}
      </div>
      <Field
        label="职责小标题"
        value={project.responsibilitiesLabel}
        onChange={(value) =>
          onChange({ ...project, responsibilitiesLabel: value })
        }
      />
      <PointsEditor
        label="职责要点"
        items={project.responsibilities}
        onChange={(value) => onChange({ ...project, responsibilities: value })}
      />
      <Field
        label="成果小标题"
        value={project.outcomesLabel}
        onChange={(value) => onChange({ ...project, outcomesLabel: value })}
      />
      <PointsEditor
        label="成果要点"
        items={project.outcomes}
        onChange={(value) => onChange({ ...project, outcomes: value })}
      />
    </div>
  );
}

export function SectionEditor({
  section,
  onChange,
  locale = "zh",
}: {
  section: ResumeSection;
  onChange: (section: ResumeSection) => void;
  locale?: Locale;
}) {
  const { t } = useI18n();
  const contentT = (text: string) => translate(text, locale);
  switch (section.type) {
    case "text":
      return (
        <Field
          label="章节内容"
          value={section.content}
          multiline
          onChange={(content) => onChange({ ...section, content })}
        />
      );
    case "bullets":
      return (
        <PointsEditor
          label="优势要点"
          items={section.items}
          onChange={(items) => onChange({ ...section, items })}
        />
      );
    case "skills":
      return (
        <>
          {section.items.map((item, index) => (
            <details
              className="entry-details"
              key={item.id}
              open={section.items.length === 1 ? true : undefined}
            >
              <summary>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {item.title || t("新技能分组")}
              </summary>
              <div className="entry-form">
                <ItemActions
                  index={index}
                  count={section.items.length}
                  label={item.title || t("技能分组")}
                  onMove={(step) =>
                    onChange({
                      ...section,
                      items: moveItem(section.items, index, step),
                    })
                  }
                  onDelete={() =>
                    onChange({
                      ...section,
                      items: section.items.filter(
                        (entry) => entry.id !== item.id,
                      ),
                    })
                  }
                />
                <Field
                  label="技能分组名称"
                  value={item.title}
                  onChange={(title) =>
                    onChange({
                      ...section,
                      items: section.items.map((entry) =>
                        entry.id === item.id ? { ...entry, title } : entry,
                      ),
                    })
                  }
                />
                <PointsEditor
                  label="技能要点"
                  items={item.points}
                  onChange={(points) =>
                    onChange({
                      ...section,
                      items: section.items.map((entry) =>
                        entry.id === item.id ? { ...entry, points } : entry,
                      ),
                    })
                  }
                />
              </div>
            </details>
          ))}
          <button
            type="button"
            className="add-button"
            onClick={() =>
              onChange({
                ...section,
                items: [
                  ...section.items,
                  {
                    id: crypto.randomUUID(),
                    title: contentT("新技能分组"),
                    points: [],
                  },
                ],
              })
            }
          >
            ＋ {t("添加")}
            {t("技能分组")}
          </button>
        </>
      );
    case "projects":
      return (
        <>
          {section.items.map((item, index) => (
            <details
              className="entry-details"
              key={item.id}
              open={section.items.length === 1 ? true : undefined}
            >
              <summary className="entry-summary">
                <span className="entry-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="entry-title" title={item.name || t("新项目")}>
                  {item.name || t("新项目")}
                </span>
                <span
                  className="entry-toolbar"
                  onClick={(event) => event.preventDefault()}
                >
                  <ItemActions
                    index={index}
                    count={section.items.length}
                    label={item.name || t("项目")}
                    onMove={(step) =>
                      onChange({
                        ...section,
                        items: moveItem(section.items, index, step),
                      })
                    }
                    onDelete={() =>
                      onChange({
                        ...section,
                        items: section.items.filter(
                          (entry) => entry.id !== item.id,
                        ),
                      })
                    }
                  />
                </span>
              </summary>
              <ProjectEditor
                project={item}
                onChange={(project) =>
                  onChange({
                    ...section,
                    items: section.items.map((entry) =>
                      entry.id === item.id ? project : entry,
                    ),
                  })
                }
              />
            </details>
          ))}
          <button
            type="button"
            className="add-button"
            onClick={() =>
              onChange({
                ...section,
                items: [
                  ...section.items,
                  {
                    id: crypto.randomUUID(),
                    company: "",
                    name: contentT("新项目"),
                    start: "",
                    end: "",
                    role: "",
                    technologies: "",
                    description: "",
                    responsibilitiesLabel: contentT("个人职责"),
                    outcomesLabel: contentT("项目成果"),
                    responsibilities: [],
                    outcomes: [],
                  },
                ],
              })
            }
          >
            ＋ {t("添加")}
            {t("项目经历")}
          </button>
        </>
      );
  }
}
