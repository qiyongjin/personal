import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { errorMessage } from "../lib/api";
import { useI18n } from "../i18n/context";

export default function RouteError() {
  const error = useRouteError();
  const { t } = useI18n();
  return (
    <main className="route-error">
      <h1>{t("暂时无法打开页面")}</h1>
      <p role="alert">
        {isRouteErrorResponse(error)
          ? t("页面不存在或暂时不可用。")
          : errorMessage(error)}
      </p>
      <button onClick={() => window.location.reload()}>{t("重新加载")}</button>
      <a href="/resume">{t("返回简历")}</a>
    </main>
  );
}
