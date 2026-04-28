"""Mistral AI клиент через OpenAI-совместимый SDK.

Mistral предоставляет Chat Completions API, полностью совместимый с OpenAI.
Поэтому используем тот же `openai` SDK с подменой `base_url`.

API ключ: https://console.mistral.ai/
Документация: https://docs.mistral.ai/getting-started/quickstart/
"""
import logging
import traceback

from openai import AsyncOpenAI

from app.config import settings
from app.llm.base import LLMResponse


logger = logging.getLogger(__name__)
_BASE_URL = "https://api.mistral.ai/v1"


def _format_cause_chain(exc: BaseException) -> str:
    """Раскручивает цепочку __cause__/__context__ в одну строку.
    openai-SDK заворачивает httpx-ошибки в `APIConnectionError("Connection error.")`,
    а реальная причина живёт в __cause__. Без этой функции в логе была бы
    бесполезная "Connection error." вместо, скажем, "ConnectError: Name resolution failed".
    """
    parts = [f"{type(exc).__name__}: {exc}"]
    seen = {id(exc)}
    cur: BaseException | None = exc.__cause__ or exc.__context__
    while cur is not None and id(cur) not in seen:
        seen.add(id(cur))
        parts.append(f"caused by {type(cur).__name__}: {cur}")
        cur = cur.__cause__ or cur.__context__
    return " | ".join(parts)


class MistralClient:
    def __init__(self) -> None:
        if not settings.mistral_api_key:
            raise RuntimeError(
                "mistral_api_key is empty — set MISTRAL_API_KEY env var "
                "or switch LLM_PROVIDER back to 'stub'"
            )
        # Защита от мусора в env: иногда ключ вставляется с кавычками или
        # переводами строки → Authorization-хедер ломается → выглядит как
        # сетевая ошибка, хотя проблема в значении.
        self._key = settings.mistral_api_key.strip().strip('"').strip("'")
        self._client = AsyncOpenAI(
            api_key=self._key,
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
            chain = _format_cause_chain(exc)
            logger.error(
                "Mistral API error (model=%s, base=%s): %s\n%s",
                settings.llm_model, _BASE_URL, chain, traceback.format_exc(),
            )
            # Подменяем сообщение исключения, чтобы в HTTP-ответе coach.summon
            # клиент видел реальную причину, а не "Connection error.".
            raise RuntimeError(f"Mistral [{settings.llm_model}]: {chain}") from exc
        choice = resp.choices[0].message.content or ""
        usage = resp.usage
        return LLMResponse(
            text=choice,
            tokens_in=usage.prompt_tokens if usage else None,
            tokens_out=usage.completion_tokens if usage else None,
        )
