import sqlite3
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.application import create_app
from app.core.config import ROOT, Settings
from app.core.security import hash_password
from app.database import create_database, initialize_database
from app.schemas import EnglishResume, ResumeData

PASSWORD = "test-password-123"
ORIGIN = {"Origin": "http://localhost:5173"}


@pytest.fixture
def client(tmp_path):
    settings = Settings(
        admin_username="admin",
        admin_password_hash=hash_password(PASSWORD),
        database_url=f"sqlite:///{tmp_path / 'resume.sqlite'}",
    )
    with TestClient(create_app(settings)) as client:
        yield client


def login(client):
    response = client.post(
        "/api/auth/login", headers=ORIGIN, json={"username": "admin", "password": PASSWORD}
    )
    assert response.status_code == 200
    assert response.json() == {"authenticated": True}


def test_auth_save_and_conflict(client):
    assert client.get("/api/auth/session").json() == {"authenticated": False}
    record = client.get("/api/resume").json()
    assert client.put("/api/admin/resume", headers=ORIGIN, json=record).status_code == 401
    assert (
        client.post(
            "/api/auth/login", headers=ORIGIN, json={"username": "admin", "password": "wrong"}
        ).status_code
        == 401
    )
    login(client)
    assert client.get("/api/auth/session").json() == {"authenticated": True}
    record["data"]["basics"]["headline"] = "Updated headline"
    record["data"]["basics"]["contacts"] = [
        {"id": "custom-contact-1", "label": "GitHub", "value": "github.com/example"},
        {"id": "custom-contact-2", "label": "", "value": "Available remotely"},
    ]
    saved = client.put("/api/admin/resume", headers=ORIGIN, json=record)
    assert saved.status_code == 200
    assert saved.json()["version"] == record["version"] + 1
    assert saved.json()["data"]["basics"]["contacts"] == record["data"]["basics"]["contacts"]
    assert client.get("/api/resume").json() == saved.json()
    assert client.put("/api/admin/resume", headers=ORIGIN, json=record).status_code == 409
    assert client.post("/api/auth/logout", headers=ORIGIN).status_code == 204
    assert client.get("/api/auth/session").json() == {"authenticated": False}


def test_translation_and_pdf_contract(client):
    login(client)
    record = client.get("/api/resume").json()
    source = ResumeData.model_validate(record["data"])
    payload = {"data": record["data"]}
    assert client.post("/api/admin/resume/translate", headers=ORIGIN, json=payload).status_code == 503
    translated = EnglishResume(data=source.model_copy(deep=True), source=source)
    translated.data.basics.headline = "Software Engineer"
    translator = AsyncMock()
    translator.busy = False
    translator.translate.return_value = translated
    client.app.state.translator = translator
    result = client.post("/api/admin/resume/translate", headers=ORIGIN, json=payload)
    assert result.status_code == 200
    assert result.json() == translated.model_dump()
    record["english"] = result.json()
    assert client.put("/api/admin/resume", headers=ORIGIN, json=record).status_code == 200
    assert client.get("/api/resume?lang=en").json()["data"]["basics"]["headline"] == "Software Engineer"
    client.app.state.pdf.render = AsyncMock(return_value=b"%PDF-test")
    pdf = client.get("/api/resume/pdf?lang=en")
    assert pdf.status_code == 200
    assert pdf.content == b"%PDF-test"
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.headers["content-language"] == "en"
    assert pdf.headers["x-resume-version"] == str(record["version"] + 1)
    assert "attachment" in pdf.headers["content-disposition"]
    client.app.state.pdf.render.side_effect = RuntimeError("Browser unavailable")
    assert client.get("/api/resume/pdf").status_code == 503
    saved = client.get("/api/resume").json()
    saved["data"]["basics"]["headline"] = "Changed Chinese source"
    saved.pop("english")
    assert client.put("/api/admin/resume", headers=ORIGIN, json=saved).status_code == 200
    assert client.get("/api/resume?lang=en").status_code == 409


def test_origins_and_removed_routes(client):
    assert client.post("/api/auth/login", json={"username": "admin", "password": PASSWORD}).status_code == 403
    login(client)
    for path in ("/api/health", "/api/admin/translation", "/resume/mini_seven.pdf"):
        assert client.get(path).status_code == 404
    paths = set(client.app.openapi()["paths"])
    assert paths == {
        "/api/auth/login",
        "/api/auth/session",
        "/api/auth/logout",
        "/api/resume",
        "/api/admin/resume",
        "/api/admin/resume/translate",
        "/api/resume/pdf",
    }


def test_database_initialization_preserves_legacy_data(tmp_path):
    path = tmp_path / "legacy.sqlite"
    seed = (ROOT / "resources/initial-resume.json").read_text()
    with sqlite3.connect(path) as db:
        db.execute(
            "CREATE TABLE resume (id INTEGER PRIMARY KEY, data TEXT, version INTEGER, updated_at TEXT)"
        )
        db.execute("INSERT INTO resume VALUES (1, ?, 42, 'saved-date')", (seed,))
    settings = Settings(
        admin_username="admin", admin_password_hash=hash_password(PASSWORD), database_url=f"sqlite:///{path}"
    )
    for _ in range(2):
        with TestClient(create_app(settings)) as client:
            record = client.get("/api/resume").json()
            assert record["version"] == 42
            assert record["updatedAt"] == "saved-date"
            assert record["data"] == ResumeData.model_validate_json(seed).model_dump()
    with sqlite3.connect(path) as db:
        assert "english" in {row[1] for row in db.execute("PRAGMA table_info(resume)")}
        assert db.execute("SELECT count(*) FROM sessions").fetchone() == (0,)


def test_database_rejects_unknown_schema(tmp_path):
    path = tmp_path / "unknown.sqlite"
    with sqlite3.connect(path) as db:
        db.execute("CREATE TABLE resume (id INTEGER PRIMARY KEY, unexpected TEXT)")
    engine = create_database(f"sqlite:///{path}")
    try:
        with pytest.raises(ValueError, match="数据库结构不兼容"):
            initialize_database(engine)
    finally:
        engine.dispose()
