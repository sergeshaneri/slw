"""Echo-заглушка для разработки без LLM-ключа.

Возвращает структурированный «ответ», в котором видно, что system+user
дошли до клиента. Полезно для smoke-теста цепочки фронт→бэк→БД,
не тратя бесплатные лимиты OpenRouter.
"""
from app.llm.base import LLMResponse


class StubLLMClient:
    async def complete(self, system: str, user: str, max_tokens: int = 1024) -> LLMResponse:
        text = (
            "🤖 Это stub-ответ (LLM_PROVIDER=stub).\n\n"
            "Цепочка работает, но реальная модель не подключена.\n"
            "Чтобы получить настоящий ответ — выставь:\n"
            "  LLM_PROVIDER=openrouter\n"
            "  OPENROUTER_API_KEY=<ключ>\n"
            "  LLM_MODEL=meta-llama/llama-3.1-8b-instruct:free\n\n"
            "Или для Mistral:\n"
            "  LLM_PROVIDER=mistral\n"
            "  MISTRAL_API_KEY=<ключ>\n"
            "  LLM_MODEL=mistral-small-latest\n\n"
            f"---\nДлина system-промта: {len(system)} символов\n"
            f"Длина user-блока: {len(user)} символов"
        )
        return LLMResponse(text=text, tokens_in=None, tokens_out=None)
