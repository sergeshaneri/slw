from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.web.routes.auth import router as auth_router
from app.web.routes.diary import router as diary_router
from app.web.routes.me import router as me_router
from app.web.routes.scores import router as scores_router
from app.web.routes.state import router as state_router
from app.web.routes.sync import router as sync_router

app = FastAPI(title="SLW API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(me_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(state_router, prefix="/api")
app.include_router(scores_router, prefix="/api")
app.include_router(diary_router, prefix="/api")
app.include_router(sync_router, prefix="/api")


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}
