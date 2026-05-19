"""Support route — приём сообщений в поддержку от любого юзера (включая гостей).

Что происходит при POST /api/support/contact:
  1. Находим первого админа (web_users.is_admin = true, ORDER BY id ASC).
  2. Создаём direct_message: sender_id = текущий user_id (если залогинен)
     либо NULL (гость), recipient_id = admin.id, kind='support'.
     В text включаем reply_contact (email/TG юзера для ответа) и сам message.
  3. Создаём notification для админа: type='support', payload содержит
     preview сообщения и reply_contact (чтобы в bell он видел сразу).
  4. Шлём TG-уведомление админу через бота (если у админа привязан
     telegram_id и notifications_enabled).
  5. Возвращаем 200 + ok. Никакого rate-limit/captcha сейчас — если станет
     спам-проблемой, добавим.

NB: kind='support' нужен чтобы DMView мог отрисовать такие сообщения иначе
(имя «Поддержка / Гость», без mutual-follow гейта).
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Notification, WebUser
from app.db.session import get_session
from app.web.deps import get_current_user_optional

log = logging.getLogger(__name__)

router = APIRouter(prefix="/support")


class ContactIn(BaseModel):
    message: str
    reply_contact: str  # required: email или TG, как с юзером связаться


@router.post("/contact")
async def support_contact(
    body: ContactIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
    user: Optional[WebUser] = Depends(get_current_user_optional),
) -> dict:
    message = (body.message or "").strip()
    reply_contact = (body.reply_contact or "").strip()

    if len(message) < 10:
        raise HTTPException(400, "Сообщение должно быть не короче 10 символов")
    if len(message) > 4000:
        raise HTTPException(400, "Сообщение слишком длинное (макс 4000 символов)")
    if not reply_contact:
        raise HTTPException(400, "Укажи как с тобой связаться (email или @telegram)")
    if len(reply_contact) > 200:
        raise HTTPException(400, "Контакт слишком длинный")

    # Находим первого админа. Если их нет в системе — сразу 503: некому
    # читать сообщение. Это маловероятно (есть `is_admin = true` у owner'а),
    # но лучше сразу сказать юзеру правду чем тихо потерять обращение.
    admin = (
        await session.execute(
            select(WebUser).where(WebUser.is_admin.is_(True)).order_by(WebUser.id.asc()).limit(1)
        )
    ).scalar_one_or_none()
    if not admin:
        log.error("support/contact: no admin user found, dropping message from %s", reply_contact)
        raise HTTPException(503, "Поддержка временно недоступна. Попробуй позже.")

    # Подпись сообщения. Для залогиненного юзера показываем имя + email/TG
    # юзера (плюс reply_contact как пожелание ответить). Для гостя — только
    # reply_contact.
    if user:
        sender_label = (
            user.display_name
            or user.telegram_first_name
            or (user.email.split("@")[0] if user.email else None)
            or f"user#{user.id}"
        )
        signature = f"[Поддержка от {sender_label} · web_user_id={user.id}]"
        sender_id_val = user.id
    else:
        signature = "[Поддержка от гостя]"
        sender_id_val = None

    body_text = (
        f"{signature}\n"
        f"📬 Куда ответить: {reply_contact}\n\n"
        f"{message}"
    )

    # 1. direct_messages: kind='support', sender_id NULL для гостя.
    try:
        await session.execute(
            sql_text(
                "INSERT INTO direct_messages (sender_id, recipient_id, text, kind) "
                "VALUES (:sender, :recipient, :text, 'support')"
            ),
            {"sender": sender_id_val, "recipient": admin.id, "text": body_text},
        )
    except Exception as e:
        log.exception("support/contact: insert DM failed: %s", e)
        raise HTTPException(500, "Не удалось сохранить сообщение. Попробуй позже.")

    # 2. Notification для bell-ленты админа. preview обрезаем до 200 символов.
    try:
        session.add(Notification(
            web_user_id=admin.id,
            type="support",
            payload={
                "reply_contact": reply_contact,
                "preview": message[:200],
                "sender_user_id": sender_id_val,
                "sender_label": signature.strip("[]"),
            },
        ))
    except Exception as e:
        log.warning("support/contact: notification add failed (non-fatal): %s", e)

    await session.commit()

    # 3. TG-нотификация админу. Best-effort (если бот не поднят / не привязан
    # TG — просто пропустим).
    try:
        if admin.telegram_id and getattr(admin, "notifications_enabled", True):
            from app.bot.main import get_app as _get_bot
            bot_app = _get_bot()
            if bot_app:
                preview = message if len(message) <= 500 else message[:500] + "…"
                tg_text = (
                    "🆘 *Новое сообщение в поддержку*\n\n"
                    f"От: {signature.strip('[]')}\n"
                    f"📬 Ответить на: `{reply_contact}`\n\n"
                    f"{preview}"
                )
                await bot_app.bot.send_message(
                    chat_id=admin.telegram_id,
                    text=tg_text,
                    parse_mode="Markdown",
                    disable_web_page_preview=True,
                )
    except Exception as e:
        log.warning("support/contact: TG notify failed (non-fatal): %s", e)

    return {"ok": True}
