from ai_cost_calculator.data.model_resolver import normalize_model_id


def test_normalize_model_id():
    assert normalize_model_id("  OPENAI/GPT-4O-MINI  ") == "openai/gpt-4o-mini"
    assert normalize_model_id("\nGEMINI-1.5-PRO\t") == "gemini-1.5-pro"
