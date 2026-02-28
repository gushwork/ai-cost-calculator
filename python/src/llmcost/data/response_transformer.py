from typing import Any

from jsonpath_ng import parse

from llmcost.data.model_resolver import normalize_model_id, resolve_canonical_model_id
from llmcost.data.config_loader import load_response_mappings_config
from llmcost.errors import ModelInferenceError, ProviderInferenceError, UsageNotFoundError
from llmcost.providers.berri_client import get_berri_model_provider_map
from llmcost.types import TokenUsage


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

    if input_tokens is not None or output_tokens is not None:
        input_value = input_tokens or 0.0
        output_value = output_tokens or 0.0
        return TokenUsage(
            input_tokens=input_value,
            output_tokens=output_value,
            total_tokens=total_tokens or (input_value + output_value),
        )

    return TokenUsage(
        input_tokens=total_tokens or 0.0,
        output_tokens=0.0,
        total_tokens=total_tokens or 0.0,
    )


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
    canonical_model = resolve_canonical_model_id(normalized_model)
    provider = provider_map.get(normalized_model) or provider_map.get(canonical_model)
    if provider is None:
        raise ProviderInferenceError(
            f'Could not infer provider from model "{model}" using Berri config mapping.'
        )
    return provider


def extract_response_metadata(response: Any) -> dict[str, str]:
    model = extract_response_model(response)
    provider = infer_provider_from_model(model)
    return {"model": model, "provider": provider}
