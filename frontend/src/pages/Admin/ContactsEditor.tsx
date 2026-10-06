import type { Contact } from "../../../shared/resume";
import { useI18n } from "../../i18n/context";
import { Field, ItemActions } from "./Fields";
import { moveItem } from "./sections";

export default function ContactsEditor({
  items,
  onChange,
}: {
  items: Contact[];
  onChange: (items: Contact[]) => void;
}) {
  const { t } = useI18n();
  function update(id: string, patch: Partial<Contact>) {
    onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }
  return (
    <section className="contacts-editor" aria-label={t("自定义联系方式")}>
      <div className="field-heading">
        {t("自定义联系方式")}
        <span>{items.length} / 20</span>
      </div>
      <p className="contacts-hint">
        {t("可添加网站、GitHub、微信等；标签可留空，内容会显示在简历顶部。")}
      </p>
      {items.map((item, index) => (
        <div className="contact-entry" key={item.id}>
          <ItemActions
            index={index}
            count={items.length}
            label={`${t("自定义联系方式")} ${index + 1}`}
            onMove={(step) => onChange(moveItem(items, index, step))}
            onDelete={() => onChange(items.filter((entry) => entry.id !== item.id))}
          />
          <div className="field-grid">
            <Field
              label="标签（可选）"
              value={item.label}
              onChange={(label) => update(item.id, { label })}
            />
            <Field
              label="内容"
              value={item.value}
              onChange={(value) => update(item.id, { value })}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        className="text-button"
        disabled={items.length >= 20}
        onClick={() => onChange([...items, { id: crypto.randomUUID(), label: "", value: "" }])}
      >
        + {t("添加联系方式")}
      </button>
    </section>
  );
}
