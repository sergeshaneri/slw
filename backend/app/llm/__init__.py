"""Фабрика LLM-клиента. Диспатч по `settings.llm_provider`.

При неизвестном/пустом провайдере — `StubLLMClient`. Это даёт
задеплоить фичу до выбора провайдера и переключиться через env
без релиза.
"""
from app.config import settings
from app.llm.base import LLMClient, LLMResponse
from app.llm.stub import StubLLMClient


_cached: LLMClient | None = None


def get_llm_client() -> LLMClient:
    global _cached
    if _cached is not None:
        return _cached

    provider = (settings.llm_provider or "stub").lower()
    if provider == "openrouter":
        # Импорт ленивый: openai SDK подтянется только когда реально нужен.
        from app.llm.openrouter import OpenRouterClient
        _cached = OpenRouterClient()
    elif provider == "mistral":
        from app.llm.mistral import MistralClient
        _cached = MistralClient()
    else:
        _cached = StubLLMClient()
    return _cached


__all__ = ["LLMClient", "LLMResponse", "get_llm_client"]
