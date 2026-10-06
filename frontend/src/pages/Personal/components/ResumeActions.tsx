import { useState } from "react";
import { apiUrl, errorMessage } from "../../../lib/api";
import type { Locale } from "../../../../shared/resume";
import { useI18n } from "../../../i18n/context";

export default function ResumeActions({
  fileName,
  disabled = false,
  locale = "zh",
}: {
  fileName: string;
  disabled?: boolean;
  locale?: Locale;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (busy || disabled) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(apiUrl(`/api/resume/pdf?lang=${locale}`), {
        credentials: "include",
        cache: "no-store",
        headers: { "Accept-Language": document.documentElement.lang },
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "下载失败，请稍后重试。");
      }
      if (!response.headers.get("content-type")?.includes("application/pdf"))
        throw new Error("未收到有效的 PDF，请稍后重试。");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const headerName = response.headers
        .get("content-disposition")
        ?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      link.href = url;
      link.download = headerName ? decodeURIComponent(headerName) : fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(
        cause instanceof TypeError
          ? t("网络连接失败，请重试。")
          : errorMessage(cause),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="download-control">
      <button
        type="button"
        className="download-button"
        onClick={download}
        disabled={disabled || busy}
      >
        {t(busy ? "正在生成 PDF…" : "下载 PDF 简历")}
      </button>
      {disabled && <small>{t("请先保存修改，再下载最新简历。")}</small>}
      {error && (
        <p role="alert" className="feedback feedback--error">
          {t(error)}{" "}
          <button type="button" className="text-button" onClick={download}>
            {t("重试")}
          </button>
        </p>
      )}
    </div>
  );
}
