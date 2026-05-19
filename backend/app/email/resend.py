"""Resend.com HTTP API клиент.

Один источник правды для исходящих email-сообщений. Сейчас используется
для password-reset; в будущем добавим welcome / weekly digest и т.п.

Без API-ключа функция возвращает False без сетевого вызова — caller
сам решает что делать (fallback на TG, тихое логирование и т.п.).
"""
import logging

import httpx

from app.config import settings

log = logging.getLogger(__name__)

API_URL = "https://api.resend.com/emails"
TIMEOUT_SEC = 8.0


async def send_email(*, to: str, subject: str, html: str, text: str | None = None) -> bool:
    """Отправить email через Resend HTTP API.

    Возвращает True если письмо принято (HTTP 200 от Resend),
    False иначе (нет API-ключа, network error, отказ Resend).
    Best-effort: исключения не пробрасываем.
    """
    api_key = settings.resend_api_key.strip()
    if not api_key:
        log.info("send_email: RESEND_API_KEY not set, skipping (to=%s subject=%s)", to, subject)
        return False

    payload: dict = {
        "from": settings.resend_from,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SEC) as client:
            resp = await client.post(
                API_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
        if resp.status_code >= 400:
            log.warning(
                "Resend rejected (status=%s body=%s to=%s)",
                resp.status_code, resp.text[:200], to,
            )
            return False
        log.info("Resend sent to %s (subject=%s)", to, subject)
        return True
    except Exception as e:
        log.warning("Resend network error (to=%s): %s", to, e)
        return False
