from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import get_settings
from app.models.memorial import Memorial

TRANSLATABLE_FIELDS = ("name", "biography", "epitaph", "announcement", "birthPlace", "deathPlace", "occupation")
DEFAULT_TARGET_LOCALES = ("en", "fa", "ar", "zh")


@dataclass(frozen=True)
class TranslationResult:
    translations: dict[str, dict[str, Any]]
    status: dict[str, Any]


def pick_source_locale(translations: dict[str, Any], preferred: str | None = None) -> str | None:
    if preferred and isinstance(translations.get(preferred), dict):
        return preferred
    for locale in DEFAULT_TARGET_LOCALES:
        if isinstance(translations.get(locale), dict) and translations[locale].get("name"):
            return locale
    for locale, layer in translations.items():
        if isinstance(layer, dict) and layer.get("name"):
            return locale
    return None


def _copy_layer(layer: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in layer.items() if value is not None}


async def _libretranslate_text(text: str, source: str, target: str) -> str:
    settings = get_settings()
    payload: dict[str, Any] = {
        "q": text,
        "source": source,
        "target": target,
        "format": "text",
    }
    if settings.libretranslate_api_key:
        payload["api_key"] = settings.libretranslate_api_key

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(f"{settings.libretranslate_url.rstrip('/')}/translate", json=payload)
        response.raise_for_status()
        data = response.json()
    translated = data.get("translatedText")
    return translated if isinstance(translated, str) and translated else text


async def translate_memorial_layers(
    memorial: Memorial,
    *,
    source_locale: str | None = None,
    target_locales: tuple[str, ...] = DEFAULT_TARGET_LOCALES,
) -> TranslationResult:
    settings = get_settings()
    translations = dict(memorial.translations or {})
    source = pick_source_locale(translations, source_locale)
    status: dict[str, Any] = {
        "provider": settings.translation_provider,
        "source_locale": source,
        "targets": {},
    }
    if source is None:
        status["state"] = "skipped"
        status["reason"] = "no_source_locale"
        return TranslationResult(translations=translations, status=status)

    source_layer = translations.get(source)
    if not isinstance(source_layer, dict):
        status["state"] = "skipped"
        status["reason"] = "invalid_source_layer"
        return TranslationResult(translations=translations, status=status)

    if settings.translation_provider == "disabled":
        for target in target_locales:
            if target == source:
                status["targets"][target] = "source"
            elif not isinstance(translations.get(target), dict) or not translations[target].get("name"):
                translations[target] = _copy_layer(source_layer)
                status["targets"][target] = "copied_pending_provider"
            else:
                status["targets"][target] = "existing"
        status["state"] = "pending_provider"
        return TranslationResult(translations=translations, status=status)

    for target in target_locales:
        if target == source:
            status["targets"][target] = "source"
            continue
        existing_layer = translations.get(target)
        if isinstance(existing_layer, dict) and existing_layer.get("name"):
            status["targets"][target] = "existing"
            continue

        target_layer = _copy_layer(source_layer)
        try:
            for field in TRANSLATABLE_FIELDS:
                value = source_layer.get(field)
                if isinstance(value, str) and value.strip():
                    target_layer[field] = await _libretranslate_text(value, source, target)
            translations[target] = target_layer
            status["targets"][target] = "translated"
        except Exception as exc:
            translations[target] = target_layer
            status["targets"][target] = "copied_failed"
            status.setdefault("errors", {})[target] = str(exc)

    status["state"] = "completed" if not status.get("errors") else "partial"
    return TranslationResult(translations=translations, status=status)
