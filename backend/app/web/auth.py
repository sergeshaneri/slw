"""JWT helpers, password hashing, Telegram Login Widget verification."""
import hashlib
import hmac
import time
from datetime import datetime, timedelta
from urllib.parse import parse_qsl

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Passwords ────────────────────────────────────────────────────────────────

def _truncate_for_bcrypt(s: str) -> str:
    """bcrypt поддерживает максимум 72 байта (UTF-8). Старые версии passlib
    обрезали тихо, новые — крашатся. Чтобы не зависеть от этого — обрезаем
    сами. Лимит 72 — стандарт bcrypt."""
    encoded = s.encode("utf-8")
    if len(encoded) <= 72:
        return s
    # Обрезаем по байтам, потом аккуратно декодим обратно (на случай если
    # последний байт — половина мультибайтного символа).
    return encoded[:72].decode("utf-8", errors="ignore")


def hash_password(plain: str) -> str:
    return _pwd.hash(_truncate_for_bcrypt(plain))


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(_truncate_for_bcrypt(plain), hashed)


# ── JWT ──────────────────────────────────────────────────────────────────────

def create_token(web_user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": str(web_user_id), "exp": expire},
        settings.secret_key,
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> int:
    """Returns web_user_id or raises JWTError."""
    payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    return int(payload["sub"])


# ── Telegram Login Widget ────────────────────────────────────────────────────

def verify_telegram_auth(data: dict) -> bool:
    """
    Verify the hash that Telegram sends with the Login Widget callback.
    data must contain 'hash' and at least 'auth_date'.
    Returns False if data is older than 1 hour.
    """
    received_hash = data.get("hash", "")
    # Build the check string: exclude 'hash' and None values (Telegram omits absent fields)
    check_parts = sorted(
        f"{k}={v}" for k, v in data.items()
        if k != "hash" and v is not None
    )
    check_string = "\n".join(check_parts)

    secret = hashlib.sha256(settings.bot_token.encode()).digest()
    expected = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected, received_hash):
        return False

    # Reject if older than 1 hour
    auth_date = int(data.get("auth_date", 0))
    if abs(time.time() - auth_date) > 3600:
        return False

    return True


# ── Telegram Mini App (WebApp) initData ──────────────────────────────────────
# Спека: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
# Отличается от Login Widget: secret_key = HMAC_SHA256("WebAppData", bot_token).
# initData приходит как query-string из window.Telegram.WebApp.initData.

def verify_webapp_init_data(init_data: str) -> dict | None:
    """Проверяет initData из Telegram Mini App. Возвращает распарсенный dict
    (включая JSON-строку 'user', 'auth_date', 'start_param' и т.п.) при
    успехе, либо None при невалидной подписи / устаревших данных (>24h)."""
    if not init_data:
        return None
    try:
        parsed = dict(parse_qsl(init_data, strict_parsing=True))
    except ValueError:
        return None

    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None

    # data_check_string: отсортированные "key=value" через \n.
    check_parts = sorted(f"{k}={v}" for k, v in parsed.items())
    check_string = "\n".join(check_parts)

    secret_key = hmac.new(
        b"WebAppData", settings.bot_token.encode(), hashlib.sha256
    ).digest()
    expected = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received_hash):
        return None

    # auth_date — UNIX timestamp. Реджектим если старше 24 часов.
    try:
        auth_date = int(parsed.get("auth_date", "0"))
    except ValueError:
        return None
    if auth_date <= 0 or abs(time.time() - auth_date) > 86400:
        return None

    return parsed
