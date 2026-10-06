from pathlib import Path
from typing import Any

from sqlalchemy import Engine, create_engine, event, inspect
from sqlalchemy.engine import make_url
from sqlalchemy.pool import StaticPool

from .models import Base


def create_database(url: str) -> Engine:
    parsed = make_url(url)
    options: dict[str, Any] = {"pool_pre_ping": True}
    if parsed.get_backend_name() == "sqlite":
        if parsed.database and parsed.database != ":memory:":
            Path(parsed.database).parent.mkdir(parents=True, exist_ok=True)
        options["connect_args"] = {"check_same_thread": False, "timeout": 15}
        if not parsed.database or parsed.database == ":memory:":
            options["poolclass"] = StaticPool
    engine = create_engine(url, **options)
    if parsed.get_backend_name() == "sqlite":

        @event.listens_for(engine, "connect")
        def configure_sqlite(connection: Any, _: Any) -> None:
            cursor = connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=15000")
            cursor.close()

    return engine


def initialize_database(engine: Engine) -> None:
    """Create missing tables and retain existing SQLite resume data."""
    with engine.begin() as connection:
        inspector = inspect(connection)
        if inspector.has_table("resume"):
            columns = {column["name"] for column in inspector.get_columns("resume")}
            if not {"id", "data", "version", "updated_at"}.issubset(columns):
                raise ValueError("简历数据库结构不兼容，请检查 DATABASE_PATH 指向的文件。")
            if "english" not in columns:
                connection.exec_driver_sql("ALTER TABLE resume ADD COLUMN english TEXT")
        Base.metadata.create_all(connection)
