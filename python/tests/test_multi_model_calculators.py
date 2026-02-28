from unittest.mock import patch

import pytest

from llmcost.calculator.berri import BerrilmBasedCalculator
from llmcost.calculator.best_effort import BestEffortCalculator
from llmcost.calculator.openrouter import OpenRouterBasedCalculator
from llmcost.calculator.portkey import PortkeyBasedCalculator
from llmcost.errors import ModelNotFoundError, ProviderInferenceError, UsageNotFoundError
from llmcost.types import NormalizedPricingModel


@patch("llmcost.calculator.berri.get_berri_pricing_map")
@patch("llmcost.data.response_transformer.get_berri_model_provider_map")
def test_berri_calculator_with_anthropic_model(mock_provider_map, mock_berri_pricing):
    mock_provider_map.return_value = {
        "anthropic/claude-3-5-sonnet": "anthropic",
        "claude-3-5-sonnet": "anthropic",
    }
    mock_berri_pricing.return_value = {
        "anthropic/claude-3-5-sonnet": NormalizedPricingModel(
            model_id="claude-3-5-sonnet",
            input_cost_per_1m=1.0,
            output_cost_per_1m=2.0,
            currency="USD",
        )
    }

    result = BerrilmBasedCalculator.get_cost(
        {
            "model": "anthropic/claude-3-5-sonnet",
            "usage": {"input_tokens": 1000, "output_tokens": 500},
        }
    )
    assert result == {"currency": "USD", "cost": 0.002}


@patch("llmcost.calculator.openrouter.get_openrouter_pricing_map")
@patch("llmcost.data.response_transformer.get_berri_model_provider_map")
def test_openrouter_calculator_with_google_model(mock_provider_map, mock_openrouter_pricing):
    mock_provider_map.return_value = {
        "google/gemini-1.5-pro": "google",
        "gemini-1.5-pro": "google",
    }
    mock_openrouter_pricing.return_value = {
        "google/gemini-1.5-pro": NormalizedPricingModel(
            model_id="gemini-1.5-pro",
            input_cost_per_1m=1.5,
            output_cost_per_1m=3.0,
            currency="USD",
        )
    }

    result = OpenRouterBasedCalculator.get_cost(
        {
            "model": "google/gemini-1.5-pro",
            "usageMetadata": {
                "promptTokenCount": 1000,
                "candidatesTokenCount": 500,
                "totalTokenCount": 1500,
            },
        }
    )
    assert result == {"currency": "USD", "cost": 0.003}


@patch("llmcost.calculator.portkey.get_portkey_pricing_map")
@patch("llmcost.data.response_transformer.get_berri_model_provider_map")
def test_portkey_calculator_with_alias_fallback(mock_provider_map, mock_portkey_pricing):
    mock_provider_map.return_value = {
        "deepseek/deepseek-chat": "deepseek",
        "deepseek-chat": "deepseek",
    }
    mock_portkey_pricing.return_value = {
        "deepseek-chat": NormalizedPricingModel(
            model_id="deepseek-chat",
            input_cost_per_1m=10.0,
            output_cost_per_1m=20.0,
            currency="USD",
        )
    }

    result = PortkeyBasedCalculator.get_cost(
        {
            "model": "deepseek/deepseek-chat",
            "usage": {"prompt_tokens": 1000, "completion_tokens": 500, "total_tokens": 1500},
        }
    )
    assert result == {"currency": "USD", "cost": 0.02}


@patch("llmcost.calculator.portkey.get_portkey_pricing_map")
@patch("llmcost.calculator.berri.get_berri_pricing_map")
@patch("llmcost.calculator.openrouter.get_openrouter_pricing_map")
@patch("llmcost.data.response_transformer.get_berri_model_provider_map")
def test_best_effort_fallback_to_portkey(
    mock_provider_map,
    mock_openrouter_pricing,
    mock_berri_pricing,
    mock_portkey_pricing,
):
    mock_provider_map.return_value = {
        "xai/grok-2": "xai",
        "grok-2": "xai",
    }
    mock_openrouter_pricing.return_value = {}
    mock_berri_pricing.return_value = {}
    mock_portkey_pricing.return_value = {
        "grok-2": NormalizedPricingModel(
            model_id="grok-2",
            input_cost_per_1m=100.0,
            output_cost_per_1m=200.0,
            currency="USD",
        )
    }

    result = BestEffortCalculator.get_cost(
        {
            "model": "xai/grok-2",
            "usage": {"prompt_tokens": 1000, "completion_tokens": 500, "total_tokens": 1500},
        }
    )
    assert result == {"currency": "USD", "cost": 0.2}


@patch("llmcost.calculator.berri.get_berri_pricing_map")
@patch("llmcost.data.response_transformer.get_berri_model_provider_map")
def test_model_not_found_when_provider_exists_but_no_pricing(
    mock_provider_map, mock_berri_pricing
):
    mock_provider_map.return_value = {
        "meta/llama-3.1-70b-instruct": "meta",
        "llama-3.1-70b-instruct": "meta",
    }
    mock_berri_pricing.return_value = {}

    with pytest.raises(ModelNotFoundError):
        BerrilmBasedCalculator.get_cost(
            {
                "model": "meta/llama-3.1-70b-instruct",
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            }
        )


@patch("llmcost.calculator.berri.get_berri_pricing_map")
@patch("llmcost.data.response_transformer.get_berri_model_provider_map")
def test_usage_not_found_for_missing_usage_payload(mock_provider_map, mock_berri_pricing):
    mock_provider_map.return_value = {
        "mistralai/mistral-large": "mistral",
        "mistral-large": "mistral",
    }
    mock_berri_pricing.return_value = {
        "mistral-large": NormalizedPricingModel(
            model_id="mistral-large",
            input_cost_per_1m=1.0,
            output_cost_per_1m=1.0,
            currency="USD",
        )
    }

    with pytest.raises(UsageNotFoundError):
        BerrilmBasedCalculator.get_cost({"model": "mistralai/mistral-large"})


@patch("llmcost.data.response_transformer.get_berri_model_provider_map")
def test_provider_inference_error_for_unknown_model(mock_provider_map):
    mock_provider_map.return_value = {
        "openai/gpt-4o-mini": "openai",
        "gpt-4o-mini": "openai",
    }

    with pytest.raises(ProviderInferenceError):
        BerrilmBasedCalculator.get_cost(
            {
                "model": "custom/unknown-model",
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            }
        )
