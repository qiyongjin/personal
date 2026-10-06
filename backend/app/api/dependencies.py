from typing import Annotated

from fastapi import Depends, Request

from ..core.config import Settings
from ..core.errors import ApiError
from ..core.middleware import RateLimiter
from ..repository import ResumeRepository, SessionRepository


def settings(request: Request) -> Settings:
    return request.app.state.settings


def resumes(request: Request) -> ResumeRepository:
    return request.app.state.resumes


def sessions(request: Request) -> SessionRepository:
    return request.app.state.sessions


SettingsDep = Annotated[Settings, Depends(settings)]
ResumesDep = Annotated[ResumeRepository, Depends(resumes)]
SessionsDep = Annotated[SessionRepository, Depends(sessions)]


def require_admin(request: Request, config: SettingsDep, store: SessionsDep) -> None:
    if not store.valid(request.cookies.get(config.cookie_name)):
        raise ApiError(401, "登录已失效，请重新登录。")


def rate_limit(request: Request, bucket: str, limit: int, window: int, message: str) -> None:
    limiter: RateLimiter = request.app.state.limiter
    limiter.consume(bucket, request.client.host if request.client else "unknown", limit, window, message)
