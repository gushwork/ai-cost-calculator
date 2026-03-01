import json
import os
from typing import Any

import httpx

BERRI_URL = (
    "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
)
OPENROUTER_URL = "https://openrouter.ai/api/v1/models"
HELICONE_URL = "https://www.helicone.ai/api/llm-costs"
PORTKEY_PRICING_BASE = "https://configs.portkey.ai/pricing"

PORTKEY_PROVIDERS = [
    "openai",
    "anthropic",
    "google",
    "mistral",
    "meta",
    "cohere",
    "deepseek",
    "jina",
]

_cache: dict[str, str] | None = None


def _normalize(model_id: str) -> str:
    return model_id.strip().lower()


def _strip_provider(model_id: str) -> str | None:
    idx = model_id.find("/")
    if idx < 0:
        return None
    return model_id[idx + 1 :]


def _add_alias(aliases: dict[str, str], alias: str, canonical: str) -> None:
    key = _normalize(alias)
    if key and canonical and key not in aliases:
        aliases[key] = canonical


def _extract_from_litellm(aliases: dict[str, str]) -> None:
    try:
        response = httpx.get(BERRI_URL, timeout=30.0)
        response.raise_for_status()
        payload = json.loads(response.text)
    except Exception:
        return

    for key in payload:
        if key == "sample_spec":
            continue
        normalized_key = _normalize(key)
        bare = _strip_provider(normalized_key)
        if bare:
            _add_alias(aliases, normalized_key, bare)
        else:
            _add_alias(aliases, normalized_key, normalized_key)


def _extract_from_openrouter(aliases: dict[str, str]) -> None:
    headers: dict[str, str] = {}
    if os.getenv("OPENROUTER_API_KEY"):
        headers["Authorization"] = f'Bearer {os.getenv("OPENROUTER_API_KEY")}'

    try:
        response = httpx.get(OPENROUTER_URL, headers=headers, timeout=30.0)
        response.raise_for_status()
        payload = json.loads(response.text)
    except Exception:
        return

    for model in payload.get("data", []):
        if not isinstance(model, dict):
            continue
        model_id = model.get("id") if isinstance(model.get("id"), str) else None
        slug = (
            model.get("canonical_slug")
            if isinstance(model.get("canonical_slug"), str)
            else None
        )

        canonical = _strip_provider(_normalize(slug)) if slug else None
        id_bare = _strip_provider(_normalize(model_id)) if model_id else None
        resolved = canonical or id_bare or (_normalize(model_id) if model_id else None)
        if not resolved:
            continue

        if model_id:
            _add_alias(aliases, _normalize(model_id), resolved)
        if slug:
            _add_alias(aliases, _normalize(slug), resolved)
        if id_bare and id_bare != resolved:
            _add_alias(aliases, id_bare, resolved)


def _extract_from_helicone(aliases: dict[str, str]) -> None:
    try:
        response = httpx.get(HELICONE_URL, timeout=30.0)
        response.raise_for_status()
        payload = json.loads(response.text)
    except Exception:
        return

    for entry in payload.get("data", []):
        if not isinstance(entry, dict):
            continue
        model = entry.get("model")
        if not model or entry.get("operator") != "equals":
            continue
        model_id = _normalize(model)
        bare = _strip_provider(model_id)
        if bare:
            _add_alias(aliases, model_id, bare)
        else:
            _add_alias(aliases, model_id, model_id)


def _extract_from_portkey(aliases: dict[str, str]) -> None:
    for provider in PORTKEY_PROVIDERS:
        try:
            response = httpx.get(
                f"{PORTKEY_PRICING_BASE}/{provider}.json", timeout=15.0
            )
            if not response.is_success:
                continue
            payload = json.loads(response.text)
        except Exception:
            continue

        for key in payload:
            if key == "default":
                continue
            model_id = _normalize(key)
            _add_alias(aliases, model_id, model_id)


def _build_alias_map() -> dict[str, str]:
    aliases: dict[str, str] = {}
    errors: list[Exception] = []

    extractors = [
        _extract_from_litellm,
        _extract_from_openrouter,
        _extract_from_helicone,
        _extract_from_portkey,
    ]
    for extractor in extractors:
        try:
            extractor(aliases)
        except Exception as exc:
            errors.append(exc)

    if len(errors) == len(extractors) and not aliases:
        raise RuntimeError("All alias sources failed to fetch.")

    return aliases


def get_alias_map() -> dict[str, str]:
    global _cache
    if _cache is not None:
        return _cache
    _cache = _build_alias_map()
    return _cache


def clear_alias_cache() -> None:
    global _cache
    _cache = None
