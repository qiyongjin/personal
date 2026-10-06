import hmac

from fastapi import APIRouter, Request, Response

from ..core.errors import ApiError
from ..core.security import verify_password
from ..schemas import LoginInput, SessionStatus
from .dependencies import SessionsDep, SettingsDep, rate_limit

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=SessionStatus)
def login(
    body: LoginInput, request: Request, response: Response, config: SettingsDep, store: SessionsDep
) -> SessionStatus:
    rate_limit(request, "login", 10, 900, "登录尝试过于频繁，请 15 分钟后重试。")
    correct = verify_password(body.password, config.admin_password_hash.get_secret_value())
    if not correct or not hmac.compare_digest(body.username.encode(), config.admin_username.encode()):
        raise ApiError(401, "用户名或密码不正确。")
    request.app.state.limiter.refund("login", request.client.host if request.client else "unknown")
    store.delete(request.cookies.get(config.cookie_name))
    response.set_cookie(
        config.cookie_name,
        store.create(),
        max_age=12 * 3600,
        httponly=True,
        secure=config.production,
        samesite=config.cookie_samesite,
        path="/",
    )
    return SessionStatus(authenticated=True)


@router.get("/session", response_model=SessionStatus)
def session(request: Request, config: SettingsDep, store: SessionsDep) -> SessionStatus:
    return SessionStatus(authenticated=store.valid(request.cookies.get(config.cookie_name)))


@router.post("/logout", status_code=204)
def logout(request: Request, config: SettingsDep, store: SessionsDep) -> Response:
    store.delete(request.cookies.get(config.cookie_name))
    response = Response(status_code=204)
    response.delete_cookie(
        config.cookie_name, httponly=True, secure=config.production, samesite=config.cookie_samesite, path="/"
    )
    return response
