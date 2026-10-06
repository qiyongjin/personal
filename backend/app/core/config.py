import os
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from dotenv import dotenv_values
from pydantic import BaseModel, ConfigDict, Field, SecretStr, model_validator
from sqlalchemy.engine import make_url

from .security import valid_password_hash

ROOT = Path(__file__).resolve().parents[2]


def environment(root: Path = ROOT, overrides: dict[str, str] | None = None) -> dict[str, str]:
    """Explicit environment wins. Never interpolate secrets containing '$'."""
    values = dict(os.environ if overrides is None else overrides)
    base = dotenv_values(root / ".env", interpolate=False)
    mode = values.get(
        "APP_ENV", values.get("NODE_ENV", base.get("APP_ENV") or base.get("NODE_ENV") or "development")
    )
    files = {"production": [".env.production", ".env.prod"], "test": [".env.test"]}.get(
        mode, [".env.development", ".env.dev"]
    )
    for filename in [*files, ".env"]:
        for key, value in dotenv_values(root / filename, interpolate=False).items():
            if value is not None:
                values.setdefault(key, value)
    values["APP_ENV"] = mode
    return values


class Settings(BaseModel):
    model_config = ConfigDict(frozen=True)
    app_env: Literal["development", "test", "production"] = "development"
    admin_username: str
    admin_password_hash: SecretStr
    app_origin: str = "http://localhost:5173"
    database_url: SecretStr = SecretStr(f"sqlite:///{ROOT / 'data/resume.sqlite'}")
    host: str = "127.0.0.1"
    port: int = Field(default=3001, ge=1, le=65535)
    # Explicit IPs/CIDRs trusted by Uvicorn; never infer trust from hop counts.
    forwarded_allow_ips: str = ""
    chromium_executable_path: str | None = None
    translation_url: str | None = None
    translation_api_key: SecretStr = SecretStr("")
    translation_timeout: float = Field(default=180, gt=0, le=600)
    pdf_render_url: str = "http://localhost:5173/print.html"
    pdf_timeout: float = Field(default=45, gt=0, le=300)
    cookie_samesite: Literal["strict", "lax", "none"] = "strict"

    @property
    def production(self) -> bool:
        return self.app_env == "production"

    @property
    def cookie_name(self) -> str:
        return "__Host-resume_session" if self.production else "resume_session"

    @property
    def frontend_origins(self) -> list[str]:
        origins = [self.app_origin]
        url = urlsplit(self.app_origin)
        if not self.production and url.hostname in {"localhost", "127.0.0.1", "::1"}:
            port = f":{url.port}" if url.port else ""
            origins.extend(f"{url.scheme}://{host}{port}" for host in ["localhost", "127.0.0.1", "[::1]"])
        return list(dict.fromkeys(origins))

    @model_validator(mode="after")
    def validate_settings(self) -> "Settings":
        if not self.admin_username.strip() or not valid_password_hash(
            self.admin_password_hash.get_secret_value()
        ):
            raise ValueError(
                "请配置 ADMIN_USERNAME 和有效 ADMIN_PASSWORD_HASH，运行 python -m app.cli password 生成哈希。"
            )
        origin = urlsplit(self.app_origin)
        if (
            origin.scheme not in {"http", "https"}
            or not origin.hostname
            or origin.path
            or origin.query
            or origin.fragment
            or origin.username
            or (self.production and origin.scheme != "https")
        ):
            raise ValueError("APP_ORIGIN 必须是无路径的完整来源；生产环境必须使用 HTTPS。")
        _ = origin.port
        render = urlsplit(self.pdf_render_url)
        if (
            render.scheme not in {"http", "https"}
            or not render.hostname
            or render.username
            or render.password
            or render.query
            or render.fragment
            or not render.path.endswith("/print.html")
        ):
            raise ValueError(
                "PDF_RENDER_URL 必须指向可信前端的 HTTP(S) /print.html 页面，不能包含凭据、查询或片段。"
            )
        _ = render.port
        if self.cookie_samesite == "none" and not self.production:
            raise ValueError("COOKIE_SAMESITE=none 仅支持启用 Secure Cookie 的生产 HTTPS 环境。")
        url = make_url(self.database_url.get_secret_value())
        if url.drivername not in {"sqlite", "sqlite+pysqlite"}:
            raise ValueError(
                "当前后端仅使用 SQLite，请配置 DATABASE_PATH 或 sqlite:/// 格式的 DATABASE_URL。"
            )
        if self.translation_url:
            endpoint = urlsplit(self.translation_url)
            if (
                endpoint.scheme not in {"http", "https"}
                or not endpoint.hostname
                or endpoint.username
                or endpoint.query
                or endpoint.fragment
            ):
                raise ValueError("TRANSLATION_URL 必须是无凭据的 HTTP(S) 服务地址。")
        return self

    @classmethod
    def load(cls, root: Path = ROOT, overrides: dict[str, str] | None = None) -> "Settings":
        env = environment(root, overrides)
        values: dict[str, object] = {key: env[key.upper()] for key in cls.model_fields if key.upper() in env}
        if not env.get("DATABASE_URL"):
            path = Path(env.get("DATABASE_PATH", "data/resume.sqlite"))
            values["database_url"] = f"sqlite:///{path if path.is_absolute() else root / path}"
        if not env.get("PDF_RENDER_URL"):
            values["pdf_render_url"] = env.get("APP_ORIGIN", "http://localhost:5173") + "/print.html"
        return cls.model_validate(values)
