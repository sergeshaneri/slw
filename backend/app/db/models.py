from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Integer, Numeric, SmallInteger, Text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMPTZ
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)  # = Telegram user_id
    username: Mapped[str | None] = mapped_column(Text, nullable=True)
    first_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    language_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, default=datetime.utcnow)


class UserState(Base):
    __tablename__ = "user_state"

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), primary_key=True)
    current_aspect: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    current_step_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    last_active_at: Mapped[datetime | None] = mapped_column(TIMESTAMPTZ, nullable=True)


class ScriptStep(Base):
    __tablename__ = "script_steps"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # e.g. bs_L0_misc_01
    aspect: Mapped[str] = mapped_column(Text)                 # 'БС'
    level: Mapped[int] = mapped_column(SmallInteger)
    ord: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(Text)                   # info / open_question / exercise_ack / score / choice
    source_file: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    body_md: Mapped[str] = mapped_column(Text)
    meta: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    step_id: Mapped[str] = mapped_column(Text, ForeignKey("script_steps.id"))
    kind: Mapped[str] = mapped_column(Text)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_num: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    value_choice: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, default=datetime.utcnow)


class DiaryEntry(Base):
    __tablename__ = "diary_entries"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(Text)
    aspect: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(Text, default="bot")  # 'bot' / 'web'
    created_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, default=datetime.utcnow)


class Score(Base):
    __tablename__ = "scores"

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), primary_key=True)
    aspect: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[float] = mapped_column(Numeric(3, 1))
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, default=datetime.utcnow)


class Achievement(Base):
    __tablename__ = "achievements"

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), primary_key=True)
    code: Mapped[str] = mapped_column(Text, primary_key=True)
    unlocked_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, default=datetime.utcnow)
