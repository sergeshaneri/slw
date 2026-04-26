"""JWT helpers, password hashing, Telegram Login Widget verification."""
import hashlib
import hmac
import time
from datetime import datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Passwords ────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


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
