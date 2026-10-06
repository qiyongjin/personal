import logging
import time
import uuid
from collections.abc import Awaitable, Callable
from threading import Lock

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from starlette.types import ASGIApp

from .config import Settings
from .errors import ApiError, error_response
from .security import trusted_origin

logger = logging.getLogger("uvicorn.error")


class RateLimiter:
    """Bounded, process-local limits. The deployment intentionally uses one worker."""

    def __init__(self) -> None:
        self.entries: dict[tuple[str, str], tuple[int, float]] = {}
        self.lock = Lock()

    def refund(self, bucket: str, client: str) -> None:
        with self.lock:
            key = (bucket, client)
            if key in self.entries:
                count, expiry = self.entries[key]
                self.entries[key] = (max(0, count - 1), expiry)

    def consume(self, bucket: str, client: str, limit: int, window: int, message: str) -> None:
        current = time.monotonic()
        with self.lock:
            self.entries = {key: value for key, value in self.entries.items() if value[1] > current}
            key = (bucket, client)
            count, expiry = self.entries.get(key, (0, current + window))
            if count >= limit or (key not in self.entries and len(self.entries) >= 10000):
                raise ApiError(429, message)
            self.entries[key] = (count + 1, expiry)


class RequestMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, settings: Settings):
        super().__init__(app)
        self.settings = settings

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = uuid.uuid4().hex
        request.state.request_id = request_id
        start = time.monotonic()
        api = request.url.path == "/api" or request.url.path.startswith("/api/")
        try:
            if api and request.method in {"POST", "PUT", "PATCH", "DELETE"}:
                if not trusted_origin(
                    request.headers.get("origin"), self.settings.app_origin, self.settings.production
                ):
                    raise ApiError(403, "请求来源不受信任，请从网站页面操作。")
                # Bound streamed bodies as well as Content-Length (which cannot be trusted).
                body = bytearray()
                async for chunk in request.stream():
                    body.extend(chunk)
                    if len(body) > 3 * 1024 * 1024:
                        raise ApiError(413, "内容过大，请缩减后重试。")
                request._body = bytes(body)
            response = await call_next(request)
        except ApiError as error:
            response = error_response(request, error.status, error.message)
        except Exception as error:
            # Do not log bodies, cookies, passwords or database connection URLs.
            logger.error("request_failed id=%s error_type=%s", request_id, type(error).__name__)
            response = error_response(request, 500, "服务器暂时不可用，请稍后重试。")
        if api:
            response.headers["Cache-Control"] = "no-store"
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "same-origin"
        if self.settings.production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
            )
        logger.info(
            "request id=%s method=%s path=%s status=%d duration_ms=%.1f",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            (time.monotonic() - start) * 1000,
        )
        return response
