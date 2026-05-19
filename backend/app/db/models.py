from datetime import datetime

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, Numeric, SmallInteger, Text, TIMESTAMP, text
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
    # current_aspect — последний выбранный юзером аспект ("папка", в которой
    # он сейчас); current_step_id — денормализованная копия из
    # user_aspect_state[current_aspect].current_step_id для удобства быстрого
    # доступа без второго запроса. Source of truth — user_aspect_state.
    current_aspect: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    current_step_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    last_active_at: Mapped[datetime | None] = mapped_column(TZ, nullable=True)


class UserAspectState(Base):
    """Прогресс юзера в одном аспекте. Одна строка на пару (юзер, аспект).

    Создаётся когда юзер впервые входит в аспект. `current_step_id` всегда
    указывает на текущий шаг в этом аспекте. `finished=true` когда юзер
    дошёл до конца L3 (next_step_for_aspect вернул None).
    """
    __tablename__ = "user_aspect_state"

    telegram_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), primary_key=True)
    aspect: Mapped[str] = mapped_column(Text, primary_key=True)
    current_step_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    finished: Mapped[bool] = mapped_column(Boolean, default=False)
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
    # Onboarding: серверный флаг "юзер прошёл Quick Tour".
    # Карта закрытых hints/discover-cards: { "dashboard-intro": true, ... }.
    onboarding_done: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    hints_seen: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    # TG-нотификации (2026-05). Глобальный toggle + cool-down per type.
    # notification_cooldowns хранит { 'continue_journey': 'YYYY-MM-DD', ... }
    # чтобы не отправлять один тип чаще раза в сутки.
    notifications_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    notification_cooldowns: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    # ── Реферальная система (2026-05) ────────────────────────────────────
    # referral_code — короткий уникальный код юзера для ссылки `?ref=XXX`.
    # Генерируется при первом обращении (lazy). Уникальность защищена
    # constraint'ом.
    # referrer_id — кто пригласил этого юзера. Закрепляется при регистрации
    # (если пришёл по реф-ссылке) и больше не меняется. NULL = пришёл сам
    # или зарегистрирован до того как фича появилась.
    referral_code: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True)
    referrer_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
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


class AspectMessage(Base):
    """Сообщение в чате холла аспекта. Расширен под Q&A:
      kind: 'message' (обычный чат) | 'question' (вопрос) | 'answer' (ответ)
      parent_id: для answer — ссылка на question
      is_best: пометка «лучший ответ» (только на answer); ставит автор вопроса
    Polling 1 раз в 5 сек.
    """
    __tablename__ = "aspect_messages"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    aspect: Mapped[str] = mapped_column(Text)               # 'БС'/'ЧИ'/...
    web_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_users.id"))
    text: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(
        Text, nullable=False, default="message", server_default="message"
    )
    parent_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    is_best: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class AspectSubscription(Base):
    """Подписка юзера на аспект — даёт активность из холла в Ленту.
    Отдельная сущность от public_profiles.focus_aspects (тот — display-тег,
    эта — реальный source активности в /api/community/feed).
    PK по (web_user_id, aspect), один follow на пару.
    aspect — кириллица (как в остальной aspect-storage на бэке).
    """
    __tablename__ = "aspect_subscriptions"

    web_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("web_users.id"), primary_key=True
    )
    aspect: Mapped[str] = mapped_column(Text, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class InsightComment(Base):
    """Комментарий под опубликованным инсайтом. В отличие от insight_likes.comment
    (опц. строка внутри реакции), это полноценная ветка обсуждения: несколько
    комментов от разных юзеров под одним инсайтом, DESC by created_at.
    """
    __tablename__ = "insight_comments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    insight_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("aspect_insights.id"))
    web_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_users.id"))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class Bookmark(Base):
    """Закладка юзера на сущность («сохранить себе»).
    kind = 'insight' | 'message' (пока только insight).
    PK по (user, kind, target_id) даёт идемпотентность.
    """
    __tablename__ = "bookmarks"

    web_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("web_users.id"), primary_key=True
    )
    kind: Mapped[str] = mapped_column(Text, primary_key=True)
    target_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class Notification(Base):
    """Уведомление для юзера. Создаётся бэком при событиях:
      reaction      — кто-то отреагировал на твой инсайт
      follow        — на тебя подписались
      dm            — пришло личное сообщение
      hall_reply    — в холле где ты писал, появилось новое сообщение
      achievement   — разблокирована ачивка
    payload — JSONB с деталями (actor_id, insight_id, reaction, и т.п.).
    """
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    web_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_users.id"))
    type: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_read: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class DirectMessage(Base):
    """Личное сообщение. Доступно только при mutual follow (взаимной подписке)
    между sender_id и recipient_id — проверяется в роуте.
    """
    __tablename__ = "direct_messages"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sender_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_users.id"))
    recipient_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_users.id"))
    text: Mapped[str] = mapped_column(Text)
    read_at: Mapped[datetime | None] = mapped_column(TZ, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class HabitTick(Base):
    """Ежедневный тик практики по аспекту. PK по (user, aspect, date) даёт
    идемпотентность: повторное «тикнул сегодня» не дублируется.
    """
    __tablename__ = "habit_ticks"

    web_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("web_users.id"), primary_key=True
    )
    aspect: Mapped[str] = mapped_column(Text, primary_key=True)
    date: Mapped[str] = mapped_column(Text, primary_key=True)  # 'YYYY-MM-DD'
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class UserStreak(Base):
    """Серверный глобальный стрик юзера.

    Считается по любой «значимой активности»: тик практики, запись дневника,
    публикация инсайта, сообщение в холле, ИИ-вызов, реакция, ЛС.
    Bumped через app.web.streak.bump_streak() из write-роутов.

    shield_until — дата (YYYY-MM-DD), до которой защита перекрывает один
    пропуск. При пропуске стрик сохраняется и shield clears.
    """
    __tablename__ = "user_streaks"

    web_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("web_users.id"), primary_key=True
    )
    current: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    longest: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_active_date: Mapped[str | None] = mapped_column(Text, nullable=True)
    shield_until: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class AnalyticsReport(Base):
    """Аналитический отчёт за период (неделя/месяц/произвольный).
    Импортируется из vault'а (`analytics/29.03-05.04.md`) или генерируется
    ИИ-коучем по template'у `review promt.md`.
    """
    __tablename__ = "analytics_reports"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    web_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_users.id"))
    type: Mapped[str] = mapped_column(Text)               # 'week' | 'month' | 'custom'
    period_start: Mapped[str] = mapped_column(Text)       # 'YYYY-MM-DD'
    period_end: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(Text)             # 'imported' | 'generated'
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_md: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class AspectGoal(Base):
    """Цели юзера по конкретному аспекту. Импортируются из
    `goals/{аспект}.md`. Один файл = одна запись (markdown целиком).
    Короткие goals[] из public_profiles остаются для публичного UI.
    """
    __tablename__ = "aspect_goals"

    web_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("web_users.id"), primary_key=True
    )
    aspect: Mapped[str] = mapped_column(Text, primary_key=True)  # 'БС'/'ЧИ'/...
    content_md: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class Emotion(Base):
    """Эмоция за день. Парсится из таблицы дневника
    («Эмоция / Интенсивность / Триггер / Ощущение / Корни / Урок / Что сделал»).
    """
    __tablename__ = "emotions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    web_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_users.id"))
    diary_entry_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # FK к web_diary_entries.id, опционально
    date: Mapped[str] = mapped_column(Text)               # 'YYYY-MM-DD' дня дневника
    name: Mapped[str] = mapped_column(Text)
    intensity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    trigger: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_sensation: Mapped[str | None] = mapped_column(Text, nullable=True)
    roots: Mapped[str | None] = mapped_column(Text, nullable=True)
    lesson: Mapped[str | None] = mapped_column(Text, nullable=True)
    action: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class Training(Base):
    """Тренировки за день. Парсится из секции «Тренировки» дневника.
    Свободный формат — одно упражнение на строку с подходами/повторениями.
    """
    __tablename__ = "trainings"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    web_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_users.id"))
    diary_entry_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    date: Mapped[str] = mapped_column(Text)
    exercise: Mapped[str] = mapped_column(Text)
    sets: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    reps: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class UserHabit(Base):
    """Выбранная юзером ежедневная практика для аспекта.
    По одной активной привычке на (user, aspect). Юзер сам формулирует
    название практики (потом подвяжем к script_steps когда контент уровней
    будет готов).
    """
    __tablename__ = "user_habits"

    web_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("web_users.id"), primary_key=True
    )
    aspect: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    # Опциональный id скрипта-упражнения, когда контент уровней появится.
    exercise_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


# ── TG-нотификации (2026-05) ────────────────────────────────────────────────
# Глобальный config + лог отправок. Управляются через /api/admin/notify/*.

class NotificationSettings(Base):
    """Singleton (id=1). Глобальный кран и тонкая настройка типов.
    Управляется через admin endpoint GET/PATCH /api/admin/notify/config.
    """
    __tablename__ = "notification_settings"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, default=1)
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    notify_hour_utc: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=15, server_default="15"
    )
    type_pending_task_reminder: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    type_practice_check: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    type_continue_journey: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    updated_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)


class NotificationLog(Base):
    """Журнал каждой отправки уведомления. Видно в Admin UI: кому, какой
    тип, текст, ошибка. Для аудита и дебага."""
    __tablename__ = "notification_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    web_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("web_users.id"), nullable=True
    )
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    type: Mapped[str] = mapped_column(Text)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime] = mapped_column(TZ, default=datetime.utcnow)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
