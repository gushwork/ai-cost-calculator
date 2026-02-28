from unittest.mock import patch

from llmcost.providers.openrouter_client import (
    clear_openrouter_cache,
    get_openrouter_pricing_map,
)


def teardown_function():
    clear_openrouter_cache()


def setup_function():
    clear_openrouter_cache()


@patch("llmcost.providers.openrouter_client.httpx.get")
def test_openrouter_client_cache(mock_get):
    mock_get.return_value.status_code = 200
    mock_get.return_value.raise_for_status.return_value = None
    mock_get.return_value.text = """
    {"data":[{"id":"openai/gpt-4o-mini","pricing":{"prompt":"0.00000015","completion":"0.0000006"}}]}
    """

    first = get_openrouter_pricing_map()
    second = get_openrouter_pricing_map()
    assert first["openai/gpt-4o-mini"].input_cost_per_1m == 0.15
    assert second["gpt-4o-mini"].output_cost_per_1m == 0.6
    assert mock_get.call_count == 1


@patch("llmcost.providers.openrouter_client.httpx.get")
def test_openrouter_client_parses_currency_and_canonical_slug(mock_get):
    mock_get.return_value.status_code = 200
    mock_get.return_value.raise_for_status.return_value = None
    mock_get.return_value.text = """
    {"data":[{"id":"openai/gpt-4.1-mini","canonical_slug":"gpt-4.1-mini","pricing":{"prompt":"$0.000001","completion":"0.000002"}}]}
    """

    models = get_openrouter_pricing_map()
    assert models["openai/gpt-4.1-mini"].input_cost_per_1m == 1.0
    assert models["gpt-4.1-mini"].output_cost_per_1m == 2.0
