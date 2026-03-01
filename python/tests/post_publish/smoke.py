from ai_cost_calculator import BestEffortCalculator

response = {
    "model": "gpt-4o-mini",
    "usage": {
        "prompt_tokens": 1000,
        "completion_tokens": 500,
        "total_tokens": 1500,
    },
}

result = BestEffortCalculator.get_cost(response)

assert result["currency"] == "USD", f'Expected currency "USD", got "{result["currency"]}"'
assert isinstance(result["cost"], (int, float)) and result["cost"] > 0, (
    f"Expected positive cost, got {result['cost']}"
)

print("Post-publish smoke test passed:", result)
