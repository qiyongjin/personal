import re
from typing import Any

from ..schemas import EnglishResume

TERMS = """AI API APIs SDK SDKs UI UX HTML CSS HTTP HTTPS SQL JSON XML URL URLs URI ID IDs UUID RBAC CRUD REST JWT LCP FCP FPS CPU GPU RAG MCP SCRM CRM DOM SEO QA CI CD JS TS JSX TSX ES6 ECMAScript JavaScript TypeScript React Vue Vue3 Electron Node.js Python Go Webpack Vite ESLint Prettier Git GitHub GitLab Redux Zustand Pinia Axios Ionic i18n WebP Canvas HTML5 CSS3 GPT-4 OpenAI LangChain LangGraph PostgreSQL MySQL SQLite MongoDB Redis Docker Kubernetes Linux macOS Windows iOS Android TCP UDP WebSocket""".split()
TOKEN = re.compile(
    r"https?://[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Za-z]+|[A-Za-z][A-Za-z0-9]*(?:[._][A-Za-z0-9]+)*[+#]*",
    re.I | re.ASCII,
)
PROSE_FIELDS = {
    "headline",
    "title",
    "text",
    "content",
    "role",
    "description",
    "responsibilitiesLabel",
    "outcomesLabel",
}


def normalize_english(english: EnglishResume) -> EnglishResume:
    terms: dict[str, str] = {}

    def collect(value: Any) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                if key in {"id", "type", "phone", "email"}:
                    continue
                if isinstance(child, str):
                    for word in TOKEN.findall(child):
                        if len(word) > 1:
                            terms[word.lower()] = word
                else:
                    collect(child)
        elif isinstance(value, list):
            for child in value:
                collect(child)

    collect(english.source.model_dump())
    for term in TERMS:
        for word in TOKEN.findall(term):
            terms.setdefault(word.lower(), word)
    terms["i"] = "I"

    def sentence(line: str) -> str:
        words = TOKEN.findall(line)
        prose = [
            w
            for w in words
            if w.lower() not in terms and "@" not in w and not w.lower().startswith(("http:", "https:"))
        ]
        if len(words) < 3 or len(prose) < 2 or any(w != w.upper() for w in prose):
            return line
        previous_end, start = 0, True

        def replace(match: re.Match[str]) -> str:
            nonlocal previous_end, start
            word = match[0]
            if re.search(r"""[.!?。！？](?:\s|["'”’)]|$)""", line[previous_end : match.start()]):
                start = True
            previous_end = match.end()
            literal = "@" in word or word.lower().startswith(("http:", "https:"))
            result = terms.get(
                word.lower(), word if literal else word.capitalize() if start else word.lower()
            )
            start = False
            return result

        return TOKEN.sub(replace, line)

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                if isinstance(child, str) and key in PROSE_FIELDS:
                    value[key] = "".join(sentence(line) for line in child.splitlines(keepends=True))
                else:
                    visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    data = english.data.model_dump()
    visit(data)
    return EnglishResume.model_validate({"source": english.source, "data": data})
