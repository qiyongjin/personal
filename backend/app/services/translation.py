import asyncio
import re
from typing import Any

import httpx

from ..schemas import EnglishResume, ResumeData
from .english_case import normalize_english

HAN = re.compile(r"[\u3400-\u9fff\U00020000-\U000323af]")


class Translator:
    def __init__(
        self,
        url: str,
        api_key: str = "",
        timeout: float = 180,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.client = httpx.AsyncClient(
            base_url=url.rstrip("/") + "/", timeout=timeout, follow_redirects=False, transport=transport
        )
        self.api_key = api_key
        self.timeout = timeout
        self.busy = False

    async def translate(self, source: ResumeData) -> EnglishResume:
        data = source.model_dump()
        entries: list[tuple[dict[str, Any], str, str]] = []

        def visit(value: Any) -> None:
            if isinstance(value, dict):
                for key, child in value.items():
                    if (
                        isinstance(child, str)
                        and key not in {"id", "type", "phone", "email"}
                        and not (value is data["basics"] and key == "name")
                        and HAN.search(child)
                    ):
                        entries.append((value, key, child))
                    elif isinstance(child, dict | list):
                        visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)

        visit(data)
        async with asyncio.timeout(self.timeout):
            response = await self.client.get("languages")
            response.raise_for_status()
            languages = response.json()
            if not isinstance(languages, list):
                raise ValueError("Invalid language response")
            language = next(
                (
                    code
                    for code in ("zh-Hans", "zh")
                    if any(
                        isinstance(item, dict)
                        and item.get("code") == code
                        and "en" in (item.get("targets") or [])
                        for item in languages
                    )
                ),
                None,
            )
            if not language:
                raise ValueError("Chinese to English model unavailable")
            for offset in range(0, len(entries), 12):
                batch = entries[offset : offset + 12]
                payload = {
                    "q": [entry[2] for entry in batch],
                    "source": language,
                    "target": "en",
                    "format": "text",
                }
                if self.api_key:
                    payload["api_key"] = self.api_key
                response = await self.client.post("translate", json=payload)
                response.raise_for_status()
                result = response.json().get("translatedText")
                if (
                    not isinstance(result, list)
                    or len(result) != len(batch)
                    or any(not isinstance(item, str) or not item.strip() for item in result)
                ):
                    raise ValueError("Invalid translation response")
                for (item, key, _), translated in zip(batch, result, strict=True):
                    item[key] = translated
        return normalize_english(EnglishResume(data=ResumeData.model_validate(data), source=source))

    async def close(self) -> None:
        await self.client.aclose()
