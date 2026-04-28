"""Mistral AI клиент через OpenAI-совместимый SDK.

Mistral предоставляет Chat Completions API, полностью совместимый с OpenAI.
Поэтому используем тот же `openai` SDK с подменой `base_url`.

API ключ: https://console.mistral.ai/
Документация: https://docs.mistral.ai/getting-started/quickstart/
"""
import logging

from openai import AsyncOpenAI

from app.config import settings
from app.llm.base import LLMResponse


logger = logging.getLogger(__name__)
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
            timeout=120,
            max_retries=1,
        )

    async def complete(self, system: str, user: str, max_tokens: int = 1024) -> LLMResponse:
        try:
            resp = await self._client.chat.completions.create(
                model=settings.llm_model,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
        except Exception as exc:
            import traceback
            logger.error(
                f"Mistral API error (model={settings.llm_model}): {type(exc).__name__}: {exc}\n"
                f"{traceback.format_exc()}"
            )
            raise
        choice = resp.choices[0].message.content or ""
        usage = resp.usage
        return LLMResponse(
            text=choice,
            tokens_in=usage.prompt_tokens if usage else None,
            tokens_out=usage.completion_tokens if usage else None,
        )
