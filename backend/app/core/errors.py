import json

from fastapi import Request
from starlette.responses import JSONResponse

from .config import ROOT

ENGLISH: dict[str, str] = json.loads((ROOT / "resources/en.json").read_text())


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message


def error_response(request: Request, status: int, message: str) -> JSONResponse:
    if request.headers.get("accept-language", "").lower().startswith("en"):
        message = ENGLISH.get(message, "Invalid request. Please check your input and try again.")
    return JSONResponse({"message": message}, status_code=status)
