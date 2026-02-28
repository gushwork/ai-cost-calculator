import os
from pathlib import Path

import pytest

from llmcost.data.response_transformer import extract_token_usage

os.environ["LLMCOST_CONFIGS_DIR"] = str(Path(__file__).resolve().parents[2] / "configs")


@pytest.mark.parametrize(
    ("provider", "response", "expected"),
    [
        (
            "openai",
            {"usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}},
            (10, 5, 15),
        ),
        (
            "openai_responses",
            {"usage": {"input_tokens": 20, "output_tokens": 8, "total_tokens": 28}},
            (20, 8, 28),
        ),
        (
            "openai_chat_completions",
            {"usage": {"prompt_tokens": 11, "completion_tokens": 9, "total_tokens": 20}},
            (11, 9, 20),
        ),
        (
            "openai_completions",
            {"usage": {"prompt_tokens": 7, "completion_tokens": 3, "total_tokens": 10}},
            (7, 3, 10),
        ),
        (
            "openrouter",
            {"usage": {"prompt_tokens": 12, "completion_tokens": 6, "total_tokens": 18}},
            (12, 6, 18),
        ),
        (
            "anthropic",
            {"usage": {"input_tokens": 30, "output_tokens": 9}},
            (30, 9, 39),
        ),
        (
            "google",
            {
                "usageMetadata": {
                    "promptTokenCount": 13,
                    "candidatesTokenCount": 4,
                    "totalTokenCount": 17,
                }
            },
            (13, 4, 17),
        ),
        (
            "meta",
            {"usage": {"prompt_tokens": 14, "completion_tokens": 6, "total_tokens": 20}},
            (14, 6, 20),
        ),
        (
            "mistral",
            {"usage": {"prompt_tokens": 21, "completion_tokens": 5, "total_tokens": 26}},
            (21, 5, 26),
        ),
        (
            "cohere",
            {"meta": {"billed_units": {"input_tokens": 16, "output_tokens": 7}}},
            (16, 7, 23),
        ),
        (
            "xai",
            {"usage": {"prompt_tokens": 22, "completion_tokens": 11, "total_tokens": 33}},
            (22, 11, 33),
        ),
        (
            "deepseek",
            {"usage": {"prompt_tokens": 15, "completion_tokens": 10, "total_tokens": 25}},
            (15, 10, 25),
        ),
        (
            "qwen",
            {"usage": {"prompt_tokens": 18, "completion_tokens": 2, "total_tokens": 20}},
            (18, 2, 20),
        ),
        (
            "unknown-provider",
            {"usage": {"prompt_tokens": 9, "completion_tokens": 1, "total_tokens": 10}},
            (9, 1, 10),
        ),
    ],
)
def test_extract_token_usage_for_all_providers(provider, response, expected):
    usage = extract_token_usage(response, provider)
    assert (usage.input_tokens, usage.output_tokens, usage.total_tokens) == expected
