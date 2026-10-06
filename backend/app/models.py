from sqlalchemy import CheckConstraint, Integer, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Resume(Base):
    __tablename__ = "resume"
    __table_args__ = (CheckConstraint("id = 1", name="single_resume"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    # Keep JSON text compatible with existing SQLite resume data.
    data: Mapped[str] = mapped_column(Text)
    english: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[str] = mapped_column(Text)


class Session(Base):
    __tablename__ = "sessions"
    token_hash: Mapped[str] = mapped_column(Text, primary_key=True)
    expires_at: Mapped[int] = mapped_column(Integer)
