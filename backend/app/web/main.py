import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.web.routes.auth import router as auth_router
from app.web.routes.coach import router as coach_router
from app.web.routes.diary import router as diary_router
from app.web.routes.dm import router as dm_router
from app.web.routes.events import router as events_router
from app.web.routes.habits import router as habits_router
from app.web.routes.hall import router as hall_router
from app.web.routes.leaderboard import router as leaderboard_router
from app.web.routes.me import router as me_router
from app.web.routes.notifications import router as notifications_router
from app.web.routes.profile import router as profile_router
from app.web.routes.scores import router as scores_router
from app.web.routes.state import router as state_router
from app.web.routes.sync import router as sync_router

log = logging.getLogger(__name__)

app = FastAPI(title="SLW API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Без явного хендлера 500-ответ Railway-edge подменяет на свой
# (text/plain «Internal Server Error») и теряет CORS-headers — браузер
# показывает «CORS-блок», а реальная причина скрыта. Этот хендлер
# заворачивает всё необработанное в JSON через FastAPI, чтобы CORS-
# middleware успел добавить headers, и в теле было видно тип ошибки.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    log.exception("Unhandled exception in request: %s %s", request.method, request.url.path)
    body = {"detail": f"{type(exc).__name__}: {exc}"}
    if settings.debug:
        body["trace"] = traceback.format_exc()
    return JSONResponse(status_code=500, content=body)

app.include_router(me_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(state_router, prefix="/api")
app.include_router(scores_router, prefix="/api")
app.include_router(diary_router, prefix="/api")
app.include_router(sync_router, prefix="/api")
app.include_router(events_router, prefix="/api")
app.include_router(coach_router, prefix="/api")
app.include_router(profile_router, prefix="/api")
app.include_router(leaderboard_router, prefix="/api")
app.include_router(hall_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(dm_router, prefix="/api")
app.include_router(habits_router, prefix="/api")


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}
