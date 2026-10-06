from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException

from .api import auth, resume
from .core.config import ROOT, Settings
from .core.errors import ApiError, error_response
from .core.middleware import RateLimiter, RequestMiddleware
from .database import create_database, initialize_database
from .repository import ResumeRepository, SessionRepository
from .schemas import ResumeData
from .services.pdf import PdfRenderer
from .services.translation import Translator


def create_app(config: Settings | None = None) -> FastAPI:
    settings = config or Settings.load()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = create_database(settings.database_url.get_secret_value())
        pdf = PdfRenderer(settings.pdf_render_url, settings.chromium_executable_path, settings.pdf_timeout)
        translator = (
            Translator(
                settings.translation_url,
                settings.translation_api_key.get_secret_value(),
                settings.translation_timeout,
            )
            if settings.translation_url
            else None
        )
        try:
            await run_in_threadpool(initialize_database, engine)
            store = ResumeRepository(engine)
            seed = ResumeData.model_validate_json((ROOT / "resources/initial-resume.json").read_text())
            await run_in_threadpool(store.initialize, seed)
            app.state.resumes = store
            app.state.sessions = SessionRepository(engine)
            app.state.pdf = pdf
            app.state.translator = translator
            app.state.limiter = RateLimiter()
            yield
        finally:
            await pdf.close()
            if translator:
                await translator.close()
            await run_in_threadpool(engine.dispose)

    app = FastAPI(
        title="Personal Website API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if settings.production else "/api/docs",
        redoc_url=None,
        openapi_url=None if settings.production else "/api/openapi.json",
    )
    app.state.settings = settings
    app.add_middleware(RequestMiddleware, settings=settings)
    # Outermost: successful responses and errors both expose credentials only to trusted frontends.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["Content-Type", "Accept-Language"],
        expose_headers=["Content-Disposition", "Content-Language", "X-Resume-Version", "X-Request-ID"],
    )

    @app.exception_handler(ApiError)
    async def api_error(request: Request, error: ApiError) -> JSONResponse:
        return error_response(request, error.status, error.message)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, error: RequestValidationError) -> JSONResponse:
        message = "请求格式不正确。"
        if request.url.path == "/api/auth/login":
            message = "请填写用户名和密码。"
        elif request.url.path.endswith("/translate"):
            message = "请先完善中文简历，再生成英文。"
        elif any("条目 ID 不能重复" in item["msg"] for item in error.errors()):
            message = "条目 ID 不能重复"
        return error_response(request, 400, message)

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, error: HTTPException) -> JSONResponse:
        return error_response(
            request, error.status_code, "接口不存在。" if error.status_code == 404 else "请求格式不正确。"
        )

    app.include_router(auth.router)
    app.include_router(resume.router)
    app.include_router(resume.admin)

    return app
