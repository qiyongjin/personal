import hashlib
import secrets
import time
from datetime import UTC, datetime

from sqlalchemy import Engine, delete, insert, select, update

from .models import Resume, Session
from .schemas import EnglishResume, ResumeData, ResumeRecord, SaveResume
from .services.english_case import normalize_english


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class ResumeRepository:
    def __init__(self, engine: Engine):
        self.engine = engine

    def initialize(self, seed: ResumeData) -> None:
        # Deployment runs as a single instance. Never overwrite an existing record.
        with self.engine.begin() as connection:
            if connection.execute(select(Resume.id).where(Resume.id == 1)).first() is None:
                connection.execute(
                    insert(Resume).values(
                        id=1, data=seed.model_dump_json(), english=None, version=1, updated_at=now()
                    )
                )

    def read(self) -> ResumeRecord:
        with self.engine.connect() as connection:
            row = connection.execute(select(Resume.__table__).where(Resume.id == 1)).mappings().one()
        english = (
            normalize_english(EnglishResume.model_validate_json(row["english"])) if row["english"] else None
        )
        return ResumeRecord(
            data=ResumeData.model_validate_json(row["data"]),
            english=english,
            version=row["version"],
            updatedAt=row["updated_at"],
        )

    def save(self, command: SaveResume) -> ResumeRecord | None:
        values: dict[str, object] = {
            "data": command.data.model_dump_json(),
            "version": command.version + 1,
            "updated_at": now(),
        }
        if "english" in command.model_fields_set:
            values["english"] = command.english.model_dump_json() if command.english else None
        # RETURNING is inside the same transaction: concurrent writers cannot alter our response snapshot.
        with self.engine.begin() as connection:
            row = (
                connection.execute(
                    update(Resume)
                    .where(Resume.id == 1, Resume.version == command.version)
                    .values(**values)
                    .returning(*Resume.__table__.c)
                )
                .mappings()
                .first()
            )
            if row is None:
                return None
            return ResumeRecord(
                data=ResumeData.model_validate_json(row["data"]),
                english=normalize_english(EnglishResume.model_validate_json(row["english"]))
                if row["english"]
                else None,
                version=row["version"],
                updatedAt=row["updated_at"],
            )


class SessionRepository:
    def __init__(self, engine: Engine):
        self.engine = engine

    @staticmethod
    def digest(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    def create(self) -> str:
        token = secrets.token_hex(32)
        timestamp = int(time.time() * 1000)
        with self.engine.begin() as connection:
            connection.execute(delete(Session).where(Session.expires_at <= timestamp))
            connection.execute(
                insert(Session).values(token_hash=self.digest(token), expires_at=timestamp + 12 * 3600 * 1000)
            )
        return token

    def valid(self, token: str | None) -> bool:
        if not token or len(token) > 128:
            return False
        with self.engine.connect() as connection:
            return (
                connection.execute(
                    select(Session.token_hash).where(
                        Session.token_hash == self.digest(token), Session.expires_at > int(time.time() * 1000)
                    )
                ).first()
                is not None
            )

    def delete(self, token: str | None) -> None:
        if token:
            with self.engine.begin() as connection:
                connection.execute(delete(Session).where(Session.token_hash == self.digest(token)))
