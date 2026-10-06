import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { errorMessage, request } from "../../lib/api";
import "./admin.css";
import { useI18n } from "../../i18n/context";
import LanguageSwitcher from "../../i18n/LanguageSwitcher";

export default function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form)),
      });
      navigate("/admin/resume", { replace: true });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <Link to="/resume" className="login-brand">
          {t("个人简历")} <span> / RESUME</span>
        </Link>
        <div>
          <span className="eyebrow">YOUR STORY, ALWAYS CURRENT</span>
          <h1>
            {t("让每一次更新，")}
            <br />
            {t("成为新的起点。")}
          </h1>
          <p>
            {t("整理经历，记录成长。")}
            <br />
            {t("在这里维护属于你的那一份简历。")}
          </p>
        </div>
        <span className="login-note">{t("编辑 · 预览 · 保存 · 下载")}</span>
      </div>
      <main className="login-main">
        <div className="login-language">
          <LanguageSwitcher />
        </div>
        <form className="login-form" onSubmit={login}>
          <span className="eyebrow">RESUME STUDIO</span>
          <h2>{t("登录简历后台")}</h2>
          <p>{t("保存后，公开页面和 PDF 将同步更新。")}</p>
          <label>
            {t("用户名")}
            <input
              name="username"
              autoComplete="username"
              required
              autoFocus
              maxLength={200}
            />
          </label>
          <label>
            {t("密码")}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
            />
          </label>
          {error && (
            <p className="feedback feedback--error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy}>
            {t(busy ? "正在登录…" : "登录并编辑简历")}
          </button>
          <Link className="login-back" to="/resume">
            {t("← 返回公开简历")}
          </Link>
        </form>
      </main>
    </div>
  );
}
