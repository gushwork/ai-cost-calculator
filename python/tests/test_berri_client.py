from unittest.mock import patch

from ai_cost_calculator.data.alias_builder import clear_alias_cache
from ai_cost_calculator.providers.berri_client import (
    clear_berri_cache,
    get_berri_model_provider_map,
    get_berri_pricing_map,
)


def setup_function():
    clear_berri_cache()
    clear_alias_cache()


def teardown_function():
    clear_berri_cache()
    clear_alias_cache()


@patch("httpx.get")
def test_berri_client_caches_pricing_and_provider_map(mock_get):
    mock_get.return_value.status_code = 200
    mock_get.return_value.raise_for_status.return_value = None
    mock_get.return_value.text = """
    {"openai/gpt-4o-mini":{"input_cost_per_token":0.00000015,"output_cost_per_token":0.0000006,"litellm_provider":"openai"}}
    """

    provider_map = get_berri_model_provider_map()
    pricing_map = get_berri_pricing_map()

    assert provider_map["openai/gpt-4o-mini"] == "openai"
    assert pricing_map["gpt-4o-mini"].input_cost_per_1m == 0.15
    assert mock_get.call_count == 1
