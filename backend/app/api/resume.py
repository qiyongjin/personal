import logging
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, Request, Response
from starlette.concurrency import run_in_threadpool

from ..core.errors import ApiError
from ..schemas import EnglishResume, Locale, ResumeRecord, SaveResume, TranslationInput
from ..services.pdf import PdfRenderer, filename
from ..services.translation import Translator
from .dependencies import ResumesDep, rate_limit, require_admin

router = APIRouter(tags=["Resume"])
admin = APIRouter(prefix="/api/admin", tags=["Administration"], dependencies=[Depends(require_admin)])
logger = logging.getLogger("resume.services")


def locale(lang: str = "zh") -> Locale:
    if lang not in {"zh", "en"}:
        raise ApiError(400, "不支持的语言。")
    return "en" if lang == "en" else "zh"


LocaleDep = Annotated[Locale, Depends(locale)]


def snapshot(record: ResumeRecord, language: Locale) -> ResumeRecord:
    try:
        return record.localized(language)
    except ValueError as error:
        raise ApiError(409, str(error)) from error


@router.get("/api/resume", response_model=ResumeRecord)
def read_resume(store: ResumesDep, language: LocaleDep) -> ResumeRecord:
    return snapshot(store.read(), language)


@admin.put("/resume", response_model=ResumeRecord)
def save_resume(body: SaveResume, store: ResumesDep) -> ResumeRecord:
    record = store.save(body)
    if record is None:
        raise ApiError(409, "简历已在另一个窗口更新。请先保留当前修改，再重新加载最新版本。")
    return record


@admin.post("/resume/translate", response_model=EnglishResume)
async def translate_resume(body: TranslationInput, request: Request) -> EnglishResume:
    rate_limit(request, "translation", 6, 60, "翻译请求过于频繁，请稍后重试。")
    translator: Translator | None = request.app.state.translator
    if translator is None:
        raise ApiError(503, "翻译服务尚未配置，请按 README 启动 LibreTranslate 并设置 TRANSLATION_URL。")
    if translator.busy:
        raise ApiError(429, "正在处理翻译，请稍后重试。")
    translator.busy = True
    try:
        return await translator.translate(body.data)
    except Exception as error:
        logger.warning(
            "translation_failed id=%s error_type=%s", request.state.request_id, type(error).__name__
        )
        raise ApiError(
            503, "英文生成失败，请检查翻译服务是否启动、中文模型是否加载完成后重试。当前内容已保留。"
        ) from error
    finally:
        translator.busy = False


@router.get("/api/resume/pdf", response_class=Response, responses={200: {"content": {"application/pdf": {}}}})
async def download_pdf(request: Request, store: ResumesDep, language: LocaleDep) -> Response:
    rate_limit(request, "pdf", 20, 60, "下载过于频繁，请稍后重试。")
    record = snapshot(await run_in_threadpool(store.read), language)
    renderer: PdfRenderer = request.app.state.pdf
    try:
        result = await renderer.render(record, language)
    except Exception as error:
        logger.warning("pdf_failed id=%s error_type=%s", request.state.request_id, type(error).__name__)
        raise ApiError(503, "PDF 暂时生成失败，请稍后重试。") from error
    return Response(
        result,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=\"resume.pdf\"; filename*=UTF-8''{quote(filename(record, language), safe='')}",
            "Content-Language": "en" if language == "en" else "zh-CN",
            "X-Resume-Version": str(record.version),
        },
    )
