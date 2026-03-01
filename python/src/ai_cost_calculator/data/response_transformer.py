from typing import Any

from jsonpath_ng import parse

from ai_cost_calculator.data.model_resolver import normalize_model_id, strip_provider_prefix
from ai_cost_calculator.data.config_loader import load_response_mappings_config
from ai_cost_calculator.errors import ModelInferenceError, ProviderInferenceError, UsageNotFoundError
from ai_cost_calculator.providers.berri_client import get_berri_model_provider_map
from ai_cost_calculator.types import TokenUsage


def _get_first_numeric_value(response: Any, paths: list[str]) -> float | None:
    for path in paths:
        matches = parse(path).find(response)
        if not matches:
            continue
        first = matches[0].value
        if isinstance(first, (int, float)):
            return float(first)
        if isinstance(first, str):
            try:
                return float(first)
            except ValueError:
                continue
    return None


def extract_token_usage(response: Any, provider: str) -> TokenUsage:
    mappings = load_response_mappings_config()
    mapping = mappings.get(provider) or mappings.get("default")
    if not mapping:
        raise UsageNotFoundError(
            f'No response mapping found for provider "{provider}" and no default mapping exists.'
        )

    input_tokens = _get_first_numeric_value(response, mapping["inputTokensPaths"])
    output_tokens = _get_first_numeric_value(response, mapping["outputTokensPaths"])
    total_tokens = _get_first_numeric_value(response, mapping["totalTokensPaths"])

    if input_tokens is None and output_tokens is None and total_tokens is None:
        raise UsageNotFoundError(
            f'Could not extract token usage for provider "{provider}".'
        )

    cache_read_paths = mapping.get("cacheReadTokensPaths", [])
    cache_creation_paths = mapping.get("cacheCreationTokensPaths", [])
    cache_read = _get_first_numeric_value(response, cache_read_paths) if cache_read_paths else 0.0
    cache_creation = _get_first_numeric_value(response, cache_creation_paths) if cache_creation_paths else 0.0

    if input_tokens is not None or output_tokens is not None:
        input_value = input_tokens or 0.0
        output_value = output_tokens or 0.0
        return TokenUsage(
            input_tokens=input_value,
            output_tokens=output_value,
            total_tokens=total_tokens or (input_value + output_value),
            cache_read_tokens=cache_read or 0.0,
            cache_creation_tokens=cache_creation or 0.0,
        )

    return TokenUsage(
        input_tokens=total_tokens or 0.0,
        output_tokens=0.0,
        total_tokens=total_tokens or 0.0,
        cache_read_tokens=cache_read or 0.0,
        cache_creation_tokens=cache_creation or 0.0,
    )


def get_input_includes_cache_read(provider: str) -> bool:
    mappings = load_response_mappings_config()
    mapping = mappings.get(provider) or mappings.get("default")
    if not mapping:
        return True
    return mapping.get("inputIncludesCacheRead", True)


def _get_first_string_value(response: Any, paths: list[str]) -> str | None:
    for path in paths:
        matches = parse(path).find(response)
        if not matches:
            continue
        first = matches[0].value
        if isinstance(first, str) and first.strip():
            return first.strip()
    return None


def extract_response_model(response: Any) -> str:
    model = _get_first_string_value(response, ["$.model", "$.response.model", "$.data.model"])
    if model is None:
        raise ModelInferenceError("Could not infer model from response.")
    return model


def infer_provider_from_model(model: str) -> str:
    provider_map = get_berri_model_provider_map()
    normalized_model = normalize_model_id(model)

    provider = provider_map.get(normalized_model)
    if provider is not None:
        return provider

    stripped = strip_provider_prefix(normalized_model)
    if stripped != normalized_model:
        provider = provider_map.get(stripped)
        if provider is not None:
            return provider
        double_stripped = strip_provider_prefix(stripped)
        if double_stripped != stripped:
            provider = provider_map.get(double_stripped)
            if provider is not None:
                return provider

    best_match: tuple[str, str] | None = None
    for key, value in provider_map.items():
        if (
            normalized_model.startswith(key)
            and len(normalized_model) > len(key)
        ):
            sep = normalized_model[len(key)]
            if sep in ("-", ":", "."):
                if best_match is None or len(key) > len(best_match[0]):
                    best_match = (key, value)
    if best_match is not None:
        return best_match[1]

    raise ProviderInferenceError(
        f'Could not infer provider from model "{model}" using Berri config mapping.'
    )


def extract_response_metadata(response: Any) -> dict[str, str]:
    model = extract_response_model(response)
    provider = infer_provider_from_model(model)
    return {"model": model, "provider": provider}
