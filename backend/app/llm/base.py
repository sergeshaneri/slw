"""Интерфейс LLM-клиента для ИИ-коуча.

Концентрируем всё провайдер-зависимое в реализациях `LLMClient`.
Роут `/api/coach/summon` зовёт только `complete()` — ему всё равно,
что под капотом: stub, OpenRouter, Anthropic или local model.
"""
from dataclasses import dataclass
from typing import Protocol


@dataclass
class LLMResponse:
    text: str
    tokens_in: int | None = None
    tokens_out: int | None = None


class LLMClient(Protocol):
    async def complete(self, system: str, user: str, max_tokens: int = 1024) -> LLMResponse:
        ...
