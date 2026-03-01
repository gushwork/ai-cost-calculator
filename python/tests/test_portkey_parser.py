import json
from unittest.mock import Mock, patch

from ai_cost_calculator.data.alias_builder import clear_alias_cache
from ai_cost_calculator.providers.portkey_client import clear_portkey_cache, get_portkey_pricing_map


def _mock_portkey_json() -> str:
    return json.dumps({
        "default": {
            "pricing_config": {
                "pay_as_you_go": {
                    "request_token": {"price": 0},
                    "response_token": {"price": 0},
                },
            },
        },
        "gpt-4o-mini": {
            "pricing_config": {
                "pay_as_you_go": {
                    "request_token": {"price": 0.00000015},
                    "response_token": {"price": 0.0000006},
                },
            },
        },
    })


def _response_with_text(text: str) -> Mock:
    response = Mock()
    response.status_code = 200
    response.is_success = True
    response.raise_for_status.return_value = None
    response.text = text
    return response


def setup_function():
    clear_portkey_cache()
    clear_alias_cache()


@patch("ai_cost_calculator.data.alias_builder.httpx.get")
@patch("ai_cost_calculator.providers.portkey_client.httpx.get")
def test_parse_portkey_json_api(mock_portkey_get, mock_alias_get):
    mock_portkey_get.return_value = _response_with_text(_mock_portkey_json())
    mock_alias_get.return_value = _response_with_text(_mock_portkey_json())

    models = get_portkey_pricing_map()
    assert "gpt-4o-mini" in models
    model = models["gpt-4o-mini"]
    assert model.input_cost_per_1m == 0.15
    assert model.output_cost_per_1m == 0.6
