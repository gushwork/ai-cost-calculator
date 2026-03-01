import os
from pathlib import Path

from unittest.mock import patch

from ai_cost_calculator.data.response_transformer import extract_response_metadata, extract_token_usage
from ai_cost_calculator.providers.berri_client import clear_berri_cache

os.environ["LLMCOST_CONFIGS_DIR"] = str(Path(__file__).resolve().parents[2] / "configs")


def test_extract_prompt_and_completion_tokens():
    usage = extract_token_usage(
        {
            "usage": {
                "prompt_tokens": 1000,
                "completion_tokens": 250,
                "total_tokens": 1250,
            }
        },
        "openai",
    )
    assert usage.input_tokens == 1000
    assert usage.output_tokens == 250
    assert usage.total_tokens == 1250
    assert usage.cache_read_tokens == 0
    assert usage.cache_creation_tokens == 0


def test_extract_total_tokens_only():
    usage = extract_token_usage({"usage": {"total_tokens": 777}}, "openai")
    assert usage.input_tokens == 777
    assert usage.output_tokens == 0
    assert usage.total_tokens == 777
    assert usage.cache_read_tokens == 0
    assert usage.cache_creation_tokens == 0


def test_extract_openai_responses_usage_tokens():
    usage = extract_token_usage(
        {"usage": {"input_tokens": 321, "output_tokens": 123, "total_tokens": 444}},
        "openai_responses",
    )
    assert usage.input_tokens == 321
    assert usage.output_tokens == 123
    assert usage.total_tokens == 444


def test_extract_openai_legacy_completions_usage_tokens():
    usage = extract_token_usage(
        {"usage": {"prompt_tokens": 111, "completion_tokens": 22, "total_tokens": 133}},
        "openai_completions",
    )
    assert usage.input_tokens == 111
    assert usage.output_tokens == 22
    assert usage.total_tokens == 133


def teardown_function():
    clear_berri_cache()


@patch("ai_cost_calculator.providers.berri_client.httpx.get")
def test_extract_response_metadata_from_berri_provider_map(mock_get):
    mock_get.return_value.status_code = 200
    mock_get.return_value.raise_for_status.return_value = None
    mock_get.return_value.text = """
    {"openai/gpt-4o-mini":{"input_cost_per_token":0.00000015,"output_cost_per_token":0.0000006,"litellm_provider":"openai"}}
    """

    metadata = extract_response_metadata(
        {
            "model": "openai/gpt-4o-mini",
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
        }
    )

    assert metadata == {"model": "openai/gpt-4o-mini", "provider": "openai"}


@patch("ai_cost_calculator.providers.berri_client.httpx.get")
def test_extract_response_metadata_with_model_override(mock_get):
    mock_get.return_value.status_code = 200
    mock_get.return_value.raise_for_status.return_value = None
    mock_get.return_value.text = (
        '{"gpt-4o-mini":{"litellm_provider":"openai"}}'
    )

    metadata = extract_response_metadata(
        {"usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}},
        model="gpt-4o-mini",
    )

    assert metadata["model"] == "gpt-4o-mini"
    assert metadata["provider"] == "openai"


def test_extract_response_metadata_with_provider_override():
    metadata = extract_response_metadata(
        {"model": "my-custom-model", "usage": {"total_tokens": 1}},
        provider="anthropic",
    )

    assert metadata["model"] == "my-custom-model"
    assert metadata["provider"] == "anthropic"


def test_extract_response_metadata_with_both_overrides():
    metadata = extract_response_metadata(
        {},
        model="gpt-4o",
        provider="openai",
    )

    assert metadata == {"model": "gpt-4o", "provider": "openai"}
