import json
from unittest.mock import Mock, patch

from ai_cost_calculator.data.alias_builder import clear_alias_cache
from ai_cost_calculator.data.model_resolver import normalize_model_id, resolve_canonical_model_id


def _mock_litellm_payload() -> str:
    return json.dumps({
        "openai/gpt-4o-mini": {
            "input_cost_per_token": 0.000001,
            "output_cost_per_token": 0.000002,
            "litellm_provider": "openai",
        },
        "gpt-4o-mini": {
            "input_cost_per_token": 0.000001,
            "output_cost_per_token": 0.000002,
            "litellm_provider": "openai",
        },
        "anthropic/claude-3-5-sonnet": {
            "input_cost_per_token": 0.000003,
            "output_cost_per_token": 0.000006,
            "litellm_provider": "anthropic",
        },
    })


def _response_with_text(text: str) -> Mock:
    response = Mock()
    response.status_code = 200
    response.is_success = True
    response.raise_for_status.return_value = None
    response.text = text
    return response


def _failed_response() -> Mock:
    response = Mock()
    response.status_code = 500
    response.is_success = False
    response.ok = False
    response.raise_for_status.side_effect = Exception("HTTP 500")
    return response


def setup_function():
    clear_alias_cache()


def test_normalize_model_id():
    assert normalize_model_id("  OPENAI/GPT-4O-MINI  ") == "openai/gpt-4o-mini"
    assert normalize_model_id("\nGEMINI-1.5-PRO\t") == "gemini-1.5-pro"


@patch("ai_cost_calculator.data.alias_builder.httpx.get")
def test_resolve_provider_prefixed_alias(mock_get):
    mock_get.return_value = _response_with_text(_mock_litellm_payload())
    assert resolve_canonical_model_id("openai/gpt-4o-mini") == "gpt-4o-mini"


@patch("ai_cost_calculator.data.alias_builder.httpx.get")
def test_unknown_model_passthrough(mock_get):
    mock_get.return_value = _response_with_text(_mock_litellm_payload())
    assert resolve_canonical_model_id("  custom-provider/model-x  ") == "custom-provider/model-x"
