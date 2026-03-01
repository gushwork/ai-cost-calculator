import math
import os
from pathlib import Path

import httpx
import pytest
from dotenv import load_dotenv

from ai_cost_calculator.calculator.best_effort import BestEffortCalculator

load_dotenv(Path(__file__).resolve().parents[2] / ".env")
os.environ["LLMCOST_CONFIGS_DIR"] = str(Path(__file__).resolve().parents[2] / "configs")


@pytest.mark.skipif(
    os.getenv("LLMCOST_E2E_LIVE", "false").lower() != "true",
    reason="Set LLMCOST_E2E_LIVE=true to run live e2e tests.",
)
def test_live_best_effort_calculation_openrouter_or_native():
    invocation = _get_live_invocation()
    result = BestEffortCalculator.get_cost(invocation["response"])
    assert result["currency"] == "USD"
    assert result["cost"] > 0


@pytest.mark.skipif(
    os.getenv("LLMCOST_E2E_LIVE", "false").lower() != "true"
    or not os.getenv("OPENAI_API_KEY"),
    reason="Requires LLMCOST_E2E_LIVE=true and OPENAI_API_KEY for OpenAI Responses test.",
)
def test_live_openai_responses_usage_payload():
    invocation = _call_openai_responses()
    result = BestEffortCalculator.get_cost(invocation["response"])
    assert result["currency"] == "USD"
    assert result["cost"] > 0


@pytest.mark.skipif(
    os.getenv("LLMCOST_E2E_LIVE", "false").lower() != "true"
    or not os.getenv("OPENAI_API_KEY"),
    reason="Requires LLMCOST_E2E_LIVE=true and OPENAI_API_KEY for OpenAI Chat test.",
)
def test_live_openai_chat_completions_usage_payload():
    invocation = _call_openai()
    result = BestEffortCalculator.get_cost(invocation["response"])
    assert result["currency"] == "USD"
    assert result["cost"] > 0


@pytest.mark.skipif(
    os.getenv("LLMCOST_E2E_LIVE", "false").lower() != "true"
    or not os.getenv("OPENAI_API_KEY")
    or not os.getenv("LLMCOST_E2E_OPENAI_COMPLETIONS_MODEL"),
    reason="Requires live mode, OPENAI_API_KEY, and LLMCOST_E2E_OPENAI_COMPLETIONS_MODEL.",
)
def test_live_openai_legacy_completions_usage_payload():
    invocation = _call_openai_completions()
    result = BestEffortCalculator.get_cost(invocation["response"])
    assert result["currency"] == "USD"
    assert result["cost"] > 0


def _get_live_invocation() -> dict[str, str | dict]:
    if os.getenv("OPENROUTER_API_KEY"):
        return _call_openrouter()
    if os.getenv("OPENAI_API_KEY"):
        return _call_openai()
    raise RuntimeError("Set OPENROUTER_API_KEY or OPENAI_API_KEY for live e2e.")


def _call_openrouter() -> dict[str, str | dict]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY not set")
    model = os.getenv("LLMCOST_E2E_OPENROUTER_MODEL", "openai/gpt-4o-mini")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if os.getenv("OPENROUTER_HTTP_REFERER"):
        headers["HTTP-Referer"] = os.getenv("OPENROUTER_HTTP_REFERER", "")
    if os.getenv("OPENROUTER_X_TITLE"):
        headers["X-Title"] = os.getenv("OPENROUTER_X_TITLE", "")
    response = httpx.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [{"role": "user", "content": "Reply with exactly: ok"}],
            "max_tokens": 8,
            "temperature": 0,
        },
        timeout=45.0,
    )
    response.raise_for_status()
    return {
        "response": response.json(),
    }


def _call_openai() -> dict[str, str | dict]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")
    model = os.getenv("LLMCOST_E2E_MODEL", "gpt-4o-mini")
    response = httpx.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [{"role": "user", "content": "Reply with exactly: ok"}],
            "max_tokens": 8,
            "temperature": 0,
        },
        timeout=45.0,
    )
    response.raise_for_status()
    return {
        "response": response.json(),
    }


def _call_openai_responses() -> dict[str, str | dict]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")
    model = os.getenv("LLMCOST_E2E_OPENAI_RESPONSES_MODEL", "gpt-4o-mini")
    response = httpx.post(
        "https://api.openai.com/v1/responses",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "input": "Reply with exactly: ok",
            "max_output_tokens": 8,
        },
        timeout=45.0,
    )
    response.raise_for_status()
    return {
        "response": response.json(),
    }


def _call_openai_completions() -> dict[str, str | dict]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")
    model = os.getenv("LLMCOST_E2E_OPENAI_COMPLETIONS_MODEL")
    if not model:
        raise RuntimeError("LLMCOST_E2E_OPENAI_COMPLETIONS_MODEL not set")
    response = httpx.post(
        "https://api.openai.com/v1/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "prompt": "Reply with exactly: ok",
            "max_tokens": 8,
            "temperature": 0,
        },
        timeout=45.0,
    )
    response.raise_for_status()
    return {
        "response": response.json(),
    }


_MULTI_PROVIDER_MODELS = [
    ("openai", "openai/gpt-4o-mini", None),
    ("anthropic", "anthropic/claude-3.5-haiku", None),
    ("google", "google/gemini-2.0-flash-001", None),
    ("meta", "meta-llama/llama-3.1-8b-instruct", None),
    ("mistral", "mistralai/mistral-small-24b-instruct-2501", None),
    ("cohere", "cohere/command-r-08-2024", None),
    ("xai", "x-ai/grok-3-mini", None),
    ("deepseek", "deepseek/deepseek-chat-v3-0324", None),
    ("qwen", "qwen/qwen-2.5-7b-instruct", "openrouter"),
]

_can_run_multi_provider = (
    os.getenv("LLMCOST_E2E_LIVE", "false").lower() == "true"
    and bool(os.getenv("OPENROUTER_API_KEY"))
)


def _call_openrouter_model(model: str) -> dict:
    api_key = os.environ["OPENROUTER_API_KEY"]
    response = httpx.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [{"role": "user", "content": "Reply with: ok"}],
            "max_tokens": 5,
            "temperature": 0,
        },
        timeout=60.0,
    )
    response.raise_for_status()
    return response.json()


@pytest.mark.skipif(not _can_run_multi_provider, reason="Requires LLMCOST_E2E_LIVE=true and OPENROUTER_API_KEY")
@pytest.mark.parametrize(
    "provider,model,provider_override",
    _MULTI_PROVIDER_MODELS,
    ids=[p for p, _, _ in _MULTI_PROVIDER_MODELS],
)
def test_live_multi_provider(provider: str, model: str, provider_override: str | None):
    response = _call_openrouter_model(model)
    kwargs = {"provider": provider_override} if provider_override else {}
    result = BestEffortCalculator.get_cost(response, **kwargs)

    assert result["currency"] == "USD"
    assert isinstance(result["cost"], (int, float))
    assert math.isfinite(result["cost"])
    assert result["cost"] >= 0
