from fastapi import FastAPI

from app.web.routes.me import router as me_router

app = FastAPI(title="SLW API")

app.include_router(me_router, prefix="/api")


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}
