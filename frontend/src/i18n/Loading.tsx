import { useI18n } from "./context";
export default function Loading({ admin = false }: { admin?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="route-loading">
      {t(admin ? "正在打开工作台…" : "正在加载简历…")}
    </div>
  );
}
