"""Тезаурус-слова по аспектам (для «слова дня» на дашборде и отдельной ленты).

Источник — `backend/app/content/words.json`, генерируется скриптом
`tools/build_words.py` из «упорядоченных» тезаурусов в
`/тезаурус с определениями/`. Хранится в репо, чтобы бэк не парсил .md
на каждом старте — данные стабильные.

Аспекты используют ЛАТИНСКИЕ ключи (Si/Se/Ti/Te/Fi/Fe/Ni/Ne), как фронт.
Если для аспекта в JSON нет слов — отдаём пустой массив (фронт сам
fallback'нется на цитаты или скроет блок).
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException

log = logging.getLogger(__name__)
router = APIRouter()


# Lazy-load один раз при первом обращении (модуль-level кэш).
_WORDS_CACHE: Optional[dict[str, list[dict]]] = None


def _load_words() -> dict[str, list[dict]]:
    """Читаем words.json из соседней content/-папки. Если файла нет — пустой
    dict. Кэшируется на уровне модуля."""
    global _WORDS_CACHE
    if _WORDS_CACHE is not None:
        return _WORDS_CACHE
    path = Path(__file__).resolve().parent.parent.parent / "content" / "words.json"
    if not path.exists():
        log.warning("words.json не найден: %s", path)
        _WORDS_CACHE = {}
        return _WORDS_CACHE
    try:
        with path.open(encoding="utf-8") as f:
            _WORDS_CACHE = json.load(f) or {}
    except Exception as e:
        log.exception("Не удалось прочитать words.json: %s", e)
        _WORDS_CACHE = {}
    return _WORDS_CACHE


def get_words_for_aspect(aspect_latin: str) -> list[dict]:
    """Публичный хелпер — используется в dashboard._word_of_day."""
    return list(_load_words().get(aspect_latin, []))


# Маппинг кириллица → латиница (дашборд хранит фокус-аспекты в кириллице).
_CYR_TO_LAT = {
    "БС": "Si", "ЧС": "Se",
    "БЛ": "Ti", "ЧЛ": "Te",
    "БЭ": "Fi", "ЧЭ": "Fe",
    "БИ": "Ni", "ЧИ": "Ne",
}


def cyr_to_latin(aspect: str) -> str:
    return _CYR_TO_LAT.get(aspect, aspect)


@router.get("/words/{aspect}")
async def get_words(aspect: str) -> dict:
    """Список слов для аспекта (latin или cyrillic ключ).

    Возвращает `{aspect, total, words: [{word, short_def, long_def, group}, ...]}`.
    """
    lat = aspect if aspect in {"Si", "Se", "Ti", "Te", "Fi", "Fe", "Ni", "Ne"} else cyr_to_latin(aspect)
    words = get_words_for_aspect(lat)
    if not words:
        # Не 404 — отдаём пустой массив, фронт обработает.
        return {"aspect": lat, "total": 0, "words": []}
    return {"aspect": lat, "total": len(words), "words": words}
