"""Mistral AI клиент через OpenAI-совместимый SDK.

Mistral предоставляет Chat Completions API, полностью совместимый с OpenAI.
Поэтому используем тот же `openai` SDK с подменой `base_url`.

API ключ: https://console.mistral.ai/
Документация: https://docs.mistral.ai/getting-started/quickstart/
"""
from openai import AsyncOpenAI

from app.config import settings
from app.llm.base import LLMResponse


_BASE_URL = "https://api.mistral.ai/v1"


class MistralClient:
    def __init__(self) -> None:
        if not settings.mistral_api_key:
            raise RuntimeError(
                "mistral_api_key is empty — set MISTRAL_API_KEY env var "
                "or switch LLM_PROVIDER back to 'stub'"
            )
        self._client = AsyncOpenAI(
            api_key=settings.mistral_api_key,
            base_url=_BASE_URL,
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
