from datetime import datetime

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, Numeric, SmallInteger, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

TZ = TIMESTAMP(timezone=True)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)  # = Telegram user_id
    username: Mapped[str | None] = mapped_column(Text, nullable=True)
    first_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    language_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class UserState(Base):
    __tablename__ = "user_state"

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), primary_key=True)
    current_aspect: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    current_step_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    last_active_at: Mapped[datetime | None] = mapped_column(TZ, nullable=True)


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
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class DiaryEntry(Base):
    __tablename__ = "diary_entries"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(Text)
    aspect: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(Text, default="bot")  # 'bot' / 'web' / 'theory'
    step_id: Mapped[str | None] = mapped_column(Text, ForeignKey("script_steps.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class Score(Base):
    __tablename__ = "scores"

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), primary_key=True)
    aspect: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[float] = mapped_column(Numeric(3, 1))
    updated_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class Achievement(Base):
    __tablename__ = "achievements"

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), primary_key=True)
    code: Mapped[str] = mapped_column(Text, primary_key=True)
    unlocked_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


# ── Web auth ────────────────────────────────────────────────────────────────

class WebUser(Base):
    """Identity for web users (email/password or Telegram Login Widget)."""
    __tablename__ = "web_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Linked Telegram account (set after "Connect Telegram" flow)
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, nullable=True)
    telegram_username: Mapped[str | None] = mapped_column(Text, nullable=True)
    telegram_first_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Отображаемое имя — редактируется юзером из настроек. Если пусто,
    # фронт показывает telegram_first_name либо часть email до @.
    display_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Админ-флаг: даёт доступ к dev-панели на фронте (skip step, авто-анкета,
    # прыжок между уровнями, полный сброс). Ставится вручную в БД:
    #   UPDATE web_users SET is_admin = true WHERE email = '...';
    is_admin: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class WebState(Base):
    """Stores the full whl_journey + whl_history JSON blobs for a web user."""
    __tablename__ = "web_state"

    web_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_users.id"), primary_key=True)
    journey: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    history: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class WebScore(Base):
    """Aspect scores for web users (mirrors bot's scores table)."""
    __tablename__ = "web_scores"

    web_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_users.id"), primary_key=True)
    aspect: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[float] = mapped_column(Numeric(3, 1))
    updated_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class WebDiaryEntry(Base):
    """Diary entries created from the web app."""
    __tablename__ = "web_diary_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    web_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_users.id"))
    text: Mapped[str] = mapped_column(Text)
    aspect: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(Text, default="web")
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # promptTitle, prompt, scriptId, etc.
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


# ── Sync layer ──────────────────────────────────────────────────────────────
# Общий event-лог между ботом и веб-приложением. Bot пишет события про каждый
# пройденный шаг (`source='bot'`); web подтягивает их при загрузке и
# восстанавливает прогресс (completedScripts, currentAspect/Level) для своего
# JSON-блоба `web_state.journey`. Поля `aspect`/`level`/`short_id` — уже
# распарсенный bot-id (например, `бс-L0-T-1` → aspect='БС', level=0,
# short_id='T-1'), потому что web хранит ID в коротком формате.

class JourneyEvent(Base):
    __tablename__ = "journey_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # Один из двух идентификаторов будет заполнен. telegram_id — ключ соединения
    # с bot-слоем; web_user_id — для web-юзеров без линкованной TG.
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    web_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(Text)            # 'bot' | 'web'
    type: Mapped[str] = mapped_column(Text)              # 'step_completed' | 'answer_given' | ...
    aspect: Mapped[str | None] = mapped_column(Text, nullable=True)
    level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    short_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    step_id: Mapped[str | None] = mapped_column(Text, nullable=True)  # full bot-id для отладки
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)
