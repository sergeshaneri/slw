"""OpenRouter-клиент через OpenAI-совместимый SDK.

OpenRouter — шлюз к десяткам моделей (включая free-tier). API совместим
с OpenAI Chat Completions, поэтому используем `openai` SDK с подменой
`base_url`. От обычного OpenAI отличается двумя дополнительными хедерами:
  - HTTP-Referer: домен приложения (обязателен для free-tier)
  - X-Title: имя приложения (опционально, для аналитики OpenRouter)

Модель выбирается через `settings.llm_model`. Менять без правки кода.
"""
from openai import AsyncOpenAI

from app.config import settings
from app.llm.base import LLMResponse


_BASE_URL = "https://openrouter.ai/api/v1"


class OpenRouterClient:
    def __init__(self) -> None:
        if not settings.openrouter_api_key:
            raise RuntimeError(
                "openrouter_api_key is empty — set OPENROUTER_API_KEY env var "
                "or switch LLM_PROVIDER back to 'stub'"
            )
        self._client = AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url=_BASE_URL,
            default_headers={
                "HTTP-Referer": settings.app_url,
                "X-Title": "SLW",
            },
        )

    async def complete(self, system: str, user: str, max_tokens: int = 1024) -> LLMResponse:
        resp = await self._client.chat.completions.create(
            model=settings.llm_model,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        choice = resp.choices[0].message.content or ""
        usage = resp.usage
        return LLMResponse(
            text=choice,
            tokens_in=usage.prompt_tokens if usage else None,
            tokens_out=usage.completion_tokens if usage else None,
        )
