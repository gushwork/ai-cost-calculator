import os
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from llmcost.data.response_transformer import (
    extract_response_metadata,
    infer_provider_from_model,
)
from llmcost.errors import ProviderInferenceError
from llmcost.providers.berri_client import clear_berri_cache

os.environ["LLMCOST_CONFIGS_DIR"] = str(Path(__file__).resolve().parents[2] / "configs")


def _response_with_text(text: str) -> Mock:
    response = Mock()
    response.status_code = 200
    response.raise_for_status.return_value = None
    response.text = text
    return response


def _berri_provider_payload() -> str:
    return """
    {
      "openai/gpt-4o-mini": {"input_cost_per_token": 0.000001, "output_cost_per_token": 0.000002, "litellm_provider": "openai"},
      "openai/gpt-4o": {"input_cost_per_token": 0.000002, "output_cost_per_token": 0.000004, "litellm_provider": "openai"},
      "anthropic/claude-3-5-sonnet": {"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000006, "litellm_provider": "anthropic"},
      "google/gemini-1.5-pro": {"input_cost_per_token": 0.0000015, "output_cost_per_token": 0.000003, "litellm_provider": "google"},
      "meta-llama/llama-3.1-70b-instruct": {"input_cost_per_token": 0.0000005, "output_cost_per_token": 0.000001, "litellm_provider": "meta"},
      "mistralai/mistral-large": {"input_cost_per_token": 0.000001, "output_cost_per_token": 0.000002, "litellm_provider": "mistral"},
      "cohere/command-r-plus": {"input_cost_per_token": 0.000001, "output_cost_per_token": 0.000002, "litellm_provider": "cohere"},
      "xai/grok-2": {"input_cost_per_token": 0.000001, "output_cost_per_token": 0.000002, "litellm_provider": "xai"},
      "deepseek/deepseek-chat": {"input_cost_per_token": 0.0000005, "output_cost_per_token": 0.000001, "litellm_provider": "deepseek"},
      "qwen/qwen-2.5-72b-instruct": {"input_cost_per_token": 0.0000004, "output_cost_per_token": 0.0000008, "litellm_provider": "qwen"}
    }
    """


def setup_function():
    clear_berri_cache()


@patch("llmcost.providers.berri_client.httpx.get")
def test_infer_provider_for_canonical_and_alias_models(mock_get):
    mock_get.return_value = _response_with_text(_berri_provider_payload())

    cases = [
        ("openai/gpt-4o-mini", "openai"),
        ("openrouter/openai/gpt-4o-mini", "openai"),
        ("gpt-4o-mini-2024-07-18", "openai"),
        ("anthropic/claude-3-5-sonnet", "anthropic"),
        ("claude-3-5-sonnet-20241022", "anthropic"),
        ("google/gemini-1.5-pro", "google"),
        ("gemini-1.5-pro-latest", "google"),
        ("meta/llama-3.1-70b-instruct", "meta"),
        ("mistral/mistral-large", "mistral"),
        ("cohere/command-r-plus", "cohere"),
        ("xai/grok-2", "xai"),
        ("deepseek/deepseek-chat", "deepseek"),
        ("qwen/qwen-2.5-72b-instruct", "qwen"),
    ]

    for model, provider in cases:
        assert infer_provider_from_model(model) == provider


@patch("llmcost.providers.berri_client.httpx.get")
def test_extract_response_metadata_for_alias_model(mock_get):
    mock_get.return_value = _response_with_text(_berri_provider_payload())

    metadata = extract_response_metadata(
        {
            "model": "openrouter/anthropic/claude-3-5-sonnet",
            "usage": {"input_tokens": 10, "output_tokens": 5},
        }
    )
    assert metadata == {
        "model": "openrouter/anthropic/claude-3-5-sonnet",
        "provider": "anthropic",
    }


@patch("llmcost.providers.berri_client.httpx.get")
def test_infer_provider_raises_for_unknown_model(mock_get):
    mock_get.return_value = _response_with_text(_berri_provider_payload())

    with pytest.raises(ProviderInferenceError):
        infer_provider_from_model("custom/no-map-model")
