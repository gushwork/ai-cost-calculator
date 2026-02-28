from pathlib import Path

from llmcost.providers.portkey_client import parse_portkey_models_from_html


def test_parse_portkey_next_data_fixture():
    fixture = (
        Path(__file__).resolve().parent / "fixtures" / "portkey-models.html"
    ).read_text(encoding="utf-8")
    models = parse_portkey_models_from_html(fixture)
    assert "gpt-4o-mini" in models
    model = models["gpt-4o-mini"]
    assert model.input_cost_per_1m == 150
    assert model.output_cost_per_1m == 600
