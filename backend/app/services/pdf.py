import asyncio
import re
from urllib.parse import urlsplit

from playwright.async_api import Browser, BrowserContext, Playwright, Route, async_playwright

from ..schemas import Locale, ResumeRecord


def filename(record: ResumeRecord, locale: Locale) -> str:
    name = re.sub(r'[\x00-\x1f<>:"/\\|?*]', "", record.data.basics.name).strip()
    name = name or ("Personal" if locale == "en" else "个人")
    return f"{name}_{'Resume' if locale == 'en' else '简历'}.pdf"


class PdfRenderer:
    """Render an immutable snapshot through the same React component as the website.

    Fetch the configured frontend print page over HTTP; neither project reads the
    other project's files. Only its origin is allowed and API requests are blocked.
    """

    def __init__(self, render_url: str, executable_path: str | None = None, timeout: float = 45):
        self.render_url = render_url
        url = urlsplit(render_url)
        self.render_origin = (url.scheme, url.netloc)
        self.executable_path = executable_path
        self.timeout = timeout
        self.runtime: Playwright | None = None
        self.browser: Browser | None = None
        self.lock = asyncio.Lock()
        self.active = 0

    async def _browser(self) -> Browser:
        async with self.lock:
            if self.runtime is None:
                self.runtime = await async_playwright().start()
            if self.browser is None or not self.browser.is_connected():
                self.browser = await self.runtime.chromium.launch(
                    executable_path=self.executable_path, timeout=30_000
                )
            return self.browser

    async def _asset(self, route: Route) -> None:
        url = urlsplit(route.request.url)
        if (
            (url.scheme, url.netloc) != self.render_origin
            or route.request.method != "GET"
            or url.path == "/api"
            or url.path.startswith("/api/")
            or url.path.startswith("/admin/")
        ):
            await route.abort()
            return
        await route.continue_()

    async def render(self, record: ResumeRecord, locale: Locale) -> bytes:
        if self.active >= 2:
            raise RuntimeError("PDF renderer busy")
        self.active += 1
        context: BrowserContext | None = None
        try:
            async with asyncio.timeout(self.timeout):
                browser = await self._browser()
                context = await browser.new_context(service_workers="block")
                await context.route("**/*", self._asset)
                page = await context.new_page()
                # Disable Vite HMR sockets and any socket initiated by the print page.
                await page.route_web_socket("**/*", lambda ws: ws.close())
                response = await page.goto(self.render_url, wait_until="load", timeout=30_000)
                if response is None or not response.ok:
                    raise RuntimeError("Frontend print page unavailable")
                await page.wait_for_function("typeof window.renderResume === 'function'")
                await page.evaluate(
                    "payload => window.renderResume(payload)",
                    {"data": record.data.model_dump(), "locale": locale},
                )
                await page.evaluate("document.fonts.ready")
                return await page.pdf(
                    format="A4", prefer_css_page_size=True, print_background=True, tagged=True
                )
        finally:
            try:
                if context:
                    await context.close()
            finally:
                self.active -= 1

    async def close(self) -> None:
        if self.browser:
            await self.browser.close()
        if self.runtime:
            await self.runtime.stop()
