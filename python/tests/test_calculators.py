from unittest.mock import Mock, patch

from ai_cost_calculator.calculator.best_effort import BestEffortCalculator
from ai_cost_calculator.calculator.berri import BerrilmBasedCalculator
from ai_cost_calculator.calculator.openrouter import OpenRouterBasedCalculator
from ai_cost_calculator.calculator.portkey import PortkeyBasedCalculator
from ai_cost_calculator.providers.berri_client import clear_berri_cache
from ai_cost_calculator.providers.helicone_client import clear_helicone_cache
from ai_cost_calculator.providers.openrouter_client import clear_openrouter_cache
from ai_cost_calculator.providers.portkey_client import clear_portkey_cache


RESPONSE = {
    "model": "gpt-4o-mini",
    "usage": {
        "prompt_tokens": 1000,
        "completion_tokens": 500,
        "total_tokens": 1500,
    }
}


def setup_function():
    clear_berri_cache()
    clear_openrouter_cache()
    clear_portkey_cache()
    clear_helicone_cache()


def teardown_function():
    clear_berri_cache()
    clear_openrouter_cache()
    clear_portkey_cache()
    clear_helicone_cache()


def _mock_http_response(text: str) -> Mock:
    response = Mock()
    response.status_code = 200
    response.raise_for_status.return_value = None
    response.text = text
    return response


@patch("httpx.get")
def test_berri_calculator_cost(mock_get):
    mock_get.return_value = _mock_http_response(
        '{"gpt-4o-mini":{"input_cost_per_token":0.00000015,"output_cost_per_token":0.0000006,"litellm_provider":"openai"}}'
    )
    result = BerrilmBasedCalculator.get_cost(RESPONSE)
    assert result == {"currency": "USD", "cost": 0.00045}


@patch("httpx.get")
def test_portkey_calculator_cost(mock_get):
    mock_get.side_effect = [
        _mock_http_response(
            '{"gpt-4o-mini":{"litellm_provider":"openai","input_cost_per_token":0.00000015,"output_cost_per_token":0.0000006}}'
        ),
        _mock_http_response(
            """
            <script id="__NEXT_DATA__" type="application/json">
              {"props":{"pageProps":{"models":[{"id":"gpt-4o-mini","pricing":{"inputCostPer1M":100,"outputCostPer1M":200}}]}}}
            </script>
            """
        ),
    ]
    result = PortkeyBasedCalculator.get_cost(RESPONSE)
    assert result == {"currency": "USD", "cost": 0.2}


@patch("httpx.get")
def test_openrouter_calculator_cost(mock_get):
    mock_get.side_effect = [
        _mock_http_response(
            '{"openai/gpt-4o-mini":{"litellm_provider":"openai","input_cost_per_token":0.00000015,"output_cost_per_token":0.0000006}}'
        ),
        _mock_http_response(
            """
            {"data":[{"id":"openai/gpt-4o-mini","pricing":{"prompt":"0.00000015","completion":"0.0000006"}}]}
            """
        ),
    ]
    result = OpenRouterBasedCalculator.get_cost(
        {
            **RESPONSE,
            "model": "openai/gpt-4o-mini",
        }
    )
    assert result == {"currency": "USD", "cost": 0.00045}


@patch("httpx.get")
def test_berri_calculator_with_model_and_provider_overrides(mock_get):
    mock_get.return_value = _mock_http_response(
        '{"gpt-4o-mini":{"input_cost_per_token":0.00000015,"output_cost_per_token":0.0000006,"litellm_provider":"openai"}}'
    )
    result = BerrilmBasedCalculator.get_cost(
        {
            "usage": {
                "prompt_tokens": 1000,
                "completion_tokens": 500,
                "total_tokens": 1500,
            },
        },
        model="gpt-4o-mini",
        provider="openai",
    )
    assert result == {"currency": "USD", "cost": 0.00045}


@patch("httpx.get")
def test_best_effort_forwards_options(mock_get):
    mock_get.return_value = _mock_http_response(
        '{"gpt-4o-mini":{"input_cost_per_token":0.00000015,"output_cost_per_token":0.0000006,"litellm_provider":"openai"}}'
    )
    result = BestEffortCalculator.get_cost(
        {
            "usage": {
                "prompt_tokens": 1000,
                "completion_tokens": 500,
                "total_tokens": 1500,
            },
        },
        model="gpt-4o-mini",
        provider="openai",
    )
    assert result == {"currency": "USD", "cost": 0.00045}


@patch("httpx.get")
def test_berri_calculator_includes_tool_call_cost(mock_get):
    mock_get.return_value = _mock_http_response(
        '{"claude-sonnet-4-20250514":{"input_cost_per_token":0.000003,"output_cost_per_token":0.000015,"litellm_provider":"anthropic","tool_use_system_prompt_tokens":159}}'
    )
    result = BerrilmBasedCalculator.get_cost(
        {
            "model": "claude-sonnet-4-20250514",
            "usage": {"input_tokens": 1000, "output_tokens": 500, "total_tokens": 1500},
            "content": [
                {"type": "text", "text": "Here is the weather."},
                {"type": "tool_use", "id": "tu_1", "name": "get_weather", "input": {}},
            ],
        }
    )
    assert result["currency"] == "USD"
    assert result["cost"] > 0
    assert "tool_call_cost" in result
    assert abs(result["tool_call_cost"] - 159 * 0.000003) < 1e-10


@patch("httpx.get")
def test_berri_calculator_omits_tool_call_cost_without_tools(mock_get):
    mock_get.return_value = _mock_http_response(
        '{"claude-sonnet-4-20250514":{"input_cost_per_token":0.000003,"output_cost_per_token":0.000015,"litellm_provider":"anthropic","tool_use_system_prompt_tokens":159}}'
    )
    result = BerrilmBasedCalculator.get_cost(
        {
            "model": "claude-sonnet-4-20250514",
            "usage": {"input_tokens": 1000, "output_tokens": 500, "total_tokens": 1500},
        }
    )
    assert "tool_call_cost" not in result


def test_best_effort_fallback():
    with patch("httpx.get") as mock_get:
        mock_get.side_effect = [
            _mock_http_response(
                '{"gpt-4o-mini":{"litellm_provider":"openai"},"other-model":{"input_cost_per_token":0.000001,"output_cost_per_token":0.000001,"litellm_provider":"openai"}}'
            ),
            _mock_http_response(
                '{"data":[{"id":"other-model","pricing":{"prompt":"0.000001","completion":"0.000001"}}]}'
            ),
            _mock_http_response(
                """
                <script id="__NEXT_DATA__" type="application/json">
                  {"props":{"pageProps":{"models":[{"id":"gpt-4o-mini","pricing":{"inputCostPer1M":150,"outputCostPer1M":600}}]}}}
                </script>
                """
            ),
        ]
        result = BestEffortCalculator.get_cost(RESPONSE)
    assert result == {"currency": "USD", "cost": 0.45}
