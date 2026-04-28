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
# Bot → Web event-лог. Бот пишет step_completed на каждом advance; web
# подтягивает и обогащает свой completedScripts. См. CLAUDE.md "Sync layer".
# Поля aspect/level/short_id — уже распарсенный bot-id для прямого матча с
# web-форматом (см. content.loader.short_id_for).

class JourneyEvent(Base):
    __tablename__ = "journey_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    web_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(Text)            # 'bot' | 'web'
    type: Mapped[str] = mapped_column(Text)              # 'step_completed' пока единственный
    aspect: Mapped[str | None] = mapped_column(Text, nullable=True)
    level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    short_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    step_id: Mapped[str | None] = mapped_column(Text, nullable=True)  # full bot-id for debugging
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


# ── AI coach summon ─────────────────────────────────────────────────────────
# Каждый вызов ИИ-коуча. Используется для квоты (count today) и для UI-истории.

class CoachCall(Base):
    __tablename__ = "coach_calls"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    web_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_users.id"))
    prompt: Mapped[str] = mapped_column(Text)
    response: Mapped[str | None] = mapped_column(Text, nullable=True)
    focus_aspect: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_with_stardust: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    tokens_in: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_out: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


# ── Public profile / community ──────────────────────────────────────────────
# Профиль для публичной странички и лидерборда. По умолчанию is_public=true.
# inspirations / goals хранятся как JSONB-массивы — проще, чем нормализовать
# в отдельные таблицы.

class PublicProfile(Base):
    __tablename__ = "public_profiles"

    web_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("web_users.id"), primary_key=True
    )
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Эмодзи-аватар (выбор из набора во фронте). Полноценные изображения —
    # позже, через S3/Cloudinary. Сейчас храним просто строку.
    avatar: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Список аспектов (1-3) на которых юзер сейчас фокусируется.
    # Например ["БС", "ЧИ"]. Валидация на стороне роута.
    focus_aspects: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # Свободные теги: "финансы", "дизайн", "спорт" и т.п.
    interests: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # Карточки вдохновения: [{type, title, note, aspect?}].
    # type ∈ {film, book, music, activity, person, other}.
    inspirations: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # Список из ≤3 коротких целей.
    goals: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # Опт-ин скрыть профиль и не появляться в лидерборде.
    is_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    updated_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class AspectInsight(Base):
    """Инсайт или рекомендация юзера по конкретному аспекту.
    Другие могут лайкать (см. InsightLike). Видны только если юзер публичный
    и `is_public` инсайта = true.
    """
    __tablename__ = "aspect_insights"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    web_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_users.id"))
    aspect: Mapped[str] = mapped_column(Text)               # 'БС'/'ЧИ'/...
    kind: Mapped[str] = mapped_column(Text)                 # 'insight' | 'recommendation'
    text: Mapped[str] = mapped_column(Text)
    is_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class InsightLike(Base):
    """Реакция юзера на инсайт. Один юзер — одна реакция за раз
    (можно сменить тип, но не «оставить две»). Тип хранится в `reaction`:
      heart   — ♥ нравится
      thanks  — 🙏 спасибо
      aha     — 💡 осенило
      fire    — 🔥 топ
    PK по (insight_id, web_user_id) — гарантия одной реакции от юзера.
    Имя таблицы оставлено `insight_likes` ради миграционной совместимости.
    """
    __tablename__ = "insight_likes"

    insight_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("aspect_insights.id"), primary_key=True
    )
    web_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("web_users.id"), primary_key=True
    )
    reaction: Mapped[str] = mapped_column(
        Text, nullable=False, default="heart", server_default="heart"
    )
    # Опциональный коммент к реакции. Видим в списке реакторов.
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class WebAchievement(Base):
    """Бейджи юзера. Метаданные кода (title/icon/desc) живут в
    `app.web.routes.profile.ACHIEVEMENT_CATALOG` — БД хранит только факт.
    """
    __tablename__ = "web_achievements"

    web_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("web_users.id"), primary_key=True
    )
    code: Mapped[str] = mapped_column(Text, primary_key=True)
    unlocked_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class Subscription(Base):
    """Подписка одного web-юзера на другого.
    follower_id — кто подписался. target_id — на кого.
    PK по (follower_id, target_id), один follow от юзера на юзера.
    """
    __tablename__ = "subscriptions"

    follower_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("web_users.id"), primary_key=True
    )
    target_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("web_users.id"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)
