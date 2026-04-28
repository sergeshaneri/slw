from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    bot_token: str
    database_url: str
    secret_key: str = "change-me-in-production"
    web_origin: str = "*"          # CORS origin, e.g. https://yourname.github.io
    sentry_dsn: str = ""
    debug: bool = False

    # ── LLM (AI coach summon) ────────────────────────────────────────────────
    # Провайдер выбирается через env. По умолчанию "stub" — echo-ответ без
    # сети, чтобы фича работала на свежем деплое без ключа.
    # Поддерживается "openrouter" — OpenAI-совместимый шлюз с доступом к
    # бесплатным моделям. SDK тот же `openai`, base_url = openrouter.ai/api/v1.
    llm_provider: str = "stub"
    openrouter_api_key: str = ""
    mistral_api_key: str = ""
    llm_model: str = "meta-llama/llama-3.1-8b-instruct:free"
    # OpenRouter требует HTTP-Referer от приложений; ставим домен фронта.
    app_url: str = "https://sergeshaneri.github.io/slw"

    @field_validator("database_url", mode="before")
    @classmethod
    def fix_db_url(cls, v: str) -> str:
        # Railway gives postgres:// or postgresql://, we need postgresql+asyncpg://
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v.startswith("postgresql://") and "+asyncpg" not in v:
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v


settings = Settings()  # type: ignore[call-arg]
