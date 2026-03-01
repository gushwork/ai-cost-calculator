import os
from pathlib import Path
from unittest.mock import patch

import pytest

from ai_cost_calculator.calculator.cost_utils import compute_cost
from ai_cost_calculator.data.response_transformer import (
    extract_token_usage,
    get_input_includes_cache_read,
)
from ai_cost_calculator.calculator.berri import BerrilmBasedCalculator
from ai_cost_calculator.calculator.openrouter import OpenRouterBasedCalculator
from ai_cost_calculator.providers.berri_client import clear_berri_cache
from ai_cost_calculator.providers.openrouter_client import clear_openrouter_cache
from ai_cost_calculator.types import NormalizedPricingModel, TokenUsage

os.environ["LLMCOST_CONFIGS_DIR"] = str(Path(__file__).resolve().parents[2] / "configs")


def teardown_function():
    clear_berri_cache()
    clear_openrouter_cache()


class TestCacheTokenExtraction:
    def test_openai_cached_tokens(self):
        usage = extract_token_usage(
            {
                "usage": {
                    "prompt_tokens": 2006,
                    "completion_tokens": 300,
                    "total_tokens": 2306,
                    "prompt_tokens_details": {"cached_tokens": 1920},
                }
            },
            "openai",
        )
        assert usage.input_tokens == 2006
        assert usage.output_tokens == 300
        assert usage.cache_read_tokens == 1920
        assert usage.cache_creation_tokens == 0

    def test_anthropic_cache_tokens(self):
        usage = extract_token_usage(
            {
                "usage": {
                    "input_tokens": 50,
                    "output_tokens": 503,
                    "cache_read_input_tokens": 100000,
                    "cache_creation_input_tokens": 248,
                }
            },
            "anthropic",
        )
        assert usage.input_tokens == 50
        assert usage.output_tokens == 503
        assert usage.cache_read_tokens == 100000
        assert usage.cache_creation_tokens == 248

    def test_google_cached_content_token_count(self):
        usage = extract_token_usage(
            {
                "usageMetadata": {
                    "promptTokenCount": 50000,
                    "candidatesTokenCount": 200,
                    "totalTokenCount": 50200,
                    "cachedContentTokenCount": 48000,
                }
            },
            "google",
        )
        assert usage.input_tokens == 50000
        assert usage.cache_read_tokens == 48000
        assert usage.cache_creation_tokens == 0

    def test_deepseek_cache_hit_tokens(self):
        usage = extract_token_usage(
            {
                "usage": {
                    "prompt_tokens": 100,
                    "completion_tokens": 50,
                    "total_tokens": 150,
                    "prompt_cache_hit_tokens": 80,
                    "prompt_cache_miss_tokens": 20,
                }
            },
            "deepseek",
        )
        assert usage.input_tokens == 100
        assert usage.cache_read_tokens == 80

    def test_openrouter_cache_tokens(self):
        usage = extract_token_usage(
            {
                "usage": {
                    "prompt_tokens": 10339,
                    "completion_tokens": 60,
                    "total_tokens": 10399,
                    "prompt_tokens_details": {
                        "cached_tokens": 10318,
                        "cache_write_tokens": 21,
                    },
                }
            },
            "openrouter",
        )
        assert usage.input_tokens == 10339
        assert usage.cache_read_tokens == 10318
        assert usage.cache_creation_tokens == 21

    def test_xai_cached_tokens(self):
        usage = extract_token_usage(
            {
                "usage": {
                    "prompt_tokens": 199,
                    "completion_tokens": 1,
                    "total_tokens": 200,
                    "prompt_tokens_details": {"cached_tokens": 163},
                }
            },
            "xai",
        )
        assert usage.input_tokens == 199
        assert usage.cache_read_tokens == 163

    def test_defaults_cache_tokens_to_zero(self):
        usage = extract_token_usage(
            {"usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150}},
            "openai",
        )
        assert usage.cache_read_tokens == 0
        assert usage.cache_creation_tokens == 0


class TestGetInputIncludesCacheRead:
    def test_true_for_openai(self):
        assert get_input_includes_cache_read("openai") is True

    def test_false_for_anthropic(self):
        assert get_input_includes_cache_read("anthropic") is False

    def test_true_for_unknown(self):
        assert get_input_includes_cache_read("some-unknown") is True


class TestComputeCost:
    pricing = NormalizedPricingModel(
        model_id="test-model",
        input_cost_per_1m=10,
        output_cost_per_1m=30,
        cache_read_cost_per_1m=1,
        cache_creation_cost_per_1m=12.5,
    )

    def test_cache_read_input_includes(self):
        usage = TokenUsage(
            input_tokens=2000,
            output_tokens=500,
            total_tokens=2500,
            cache_read_tokens=1500,
            cache_creation_tokens=0,
        )
        cost = compute_cost(usage, self.pricing, True)
        assert cost == pytest.approx(0.0215, abs=1e-10)

    def test_cache_read_input_excludes_anthropic(self):
        usage = TokenUsage(
            input_tokens=50,
            output_tokens=500,
            total_tokens=550,
            cache_read_tokens=100000,
            cache_creation_tokens=248,
        )
        cost = compute_cost(usage, self.pricing, False)
        assert cost == pytest.approx(0.1186, abs=1e-10)

    def test_fallback_to_input_rate_when_no_cache_pricing(self):
        no_cache_pricing = NormalizedPricingModel(
            model_id="test-model",
            input_cost_per_1m=10,
            output_cost_per_1m=30,
        )
        usage = TokenUsage(
            input_tokens=2000,
            output_tokens=500,
            total_tokens=2500,
            cache_read_tokens=1500,
            cache_creation_tokens=0,
        )
        cost = compute_cost(usage, no_cache_pricing, True)
        assert cost == pytest.approx(0.035, abs=1e-10)

    def test_same_as_old_formula_without_cache(self):
        usage = TokenUsage(input_tokens=1000, output_tokens=500, total_tokens=1500)
        cost = compute_cost(usage, self.pricing, True)
        old_cost = (1000 / 1_000_000) * 10 + (500 / 1_000_000) * 30
        assert cost == pytest.approx(old_cost, abs=1e-10)


class TestCalculatorWithCachePricing:
    @patch("ai_cost_calculator.providers.berri_client.httpx.get")
    def test_berri_with_cache_tokens(self, mock_get):
        mock_get.return_value.status_code = 200
        mock_get.return_value.raise_for_status.return_value = None
        mock_get.return_value.text = """
        {"gpt-4o-mini":{"input_cost_per_token":0.00000015,"output_cost_per_token":0.0000006,"cache_read_input_token_cost":0.000000075,"litellm_provider":"openai"}}
        """
        clear_berri_cache()
        result = BerrilmBasedCalculator.get_cost(
            {
                "model": "gpt-4o-mini",
                "usage": {
                    "prompt_tokens": 2000,
                    "completion_tokens": 500,
                    "total_tokens": 2500,
                    "prompt_tokens_details": {"cached_tokens": 1500},
                },
            }
        )
        assert result["cost"] == pytest.approx(0.0004875, abs=1e-10)
        assert result["currency"] == "USD"

    @patch("ai_cost_calculator.providers.berri_client.httpx.get")
    def test_berri_backward_compat_no_cache(self, mock_get):
        mock_get.return_value.status_code = 200
        mock_get.return_value.raise_for_status.return_value = None
        mock_get.return_value.text = """
        {"gpt-4o-mini":{"input_cost_per_token":0.00000015,"output_cost_per_token":0.0000006,"litellm_provider":"openai"}}
        """
        clear_berri_cache()
        result = BerrilmBasedCalculator.get_cost(
            {
                "model": "gpt-4o-mini",
                "usage": {"prompt_tokens": 1000, "completion_tokens": 500, "total_tokens": 1500},
            }
        )
        assert result == {"currency": "USD", "cost": 0.00045}

    @patch("httpx.get")
    def test_openrouter_with_cache_pricing(self, mock_get):
        def _mock_resp(text):
            m = type("MockResp", (), {"status_code": 200, "raise_for_status": lambda self: None, "text": text})()
            return m

        mock_get.side_effect = [
            _mock_resp('{"openai/gpt-4o-mini":{"litellm_provider":"openai"}}'),
            _mock_resp(
                '{"data":[{"id":"openai/gpt-4o-mini","pricing":{"prompt":"0.00000015","completion":"0.0000006","input_cache_read":"0.000000075","input_cache_write":"0.00000015"}}]}'
            ),
        ]
        clear_berri_cache()
        clear_openrouter_cache()
        result = OpenRouterBasedCalculator.get_cost(
            {
                "model": "openai/gpt-4o-mini",
                "usage": {
                    "prompt_tokens": 2000,
                    "completion_tokens": 500,
                    "total_tokens": 2500,
                    "prompt_tokens_details": {"cached_tokens": 1500},
                },
            }
        )
        assert result["cost"] == pytest.approx(0.0004875, abs=1e-10)
