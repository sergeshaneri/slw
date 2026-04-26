"""
Combined entry point: runs Telegram bot + FastAPI web server.
Bot polling runs in a background thread (owns its own event loop).
Uvicorn listens on $PORT (Railway injects this).
"""
import os
import threading
import uvicorn

from app.bot.main import run as run_bot
from app.web.main import app as web_app


def _bot_thread() -> None:
    run_bot()


if __name__ == "__main__":
    t = threading.Thread(target=_bot_thread, daemon=True)
    t.start()

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(web_app, host="0.0.0.0", port=port, log_level="info")
