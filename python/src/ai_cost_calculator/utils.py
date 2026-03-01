from typing import Any
import math


def parse_number(value: Any) -> float | None:
    """Parse a numeric value, rejecting NaN and Infinity."""
    if isinstance(value, (int, float)):
        if math.isfinite(value):
            return float(value)
        return None
    if isinstance(value, str):
        try:
            result = float(value)
            if math.isfinite(result):
                return result
        except ValueError:
            pass
    return None


def parse_number_clean(value: Any) -> float | None:
    """Parse a numeric value after stripping $, commas, and whitespace."""
    if isinstance(value, (int, float)):
        if math.isfinite(value):
            return float(value)
        return None
    if isinstance(value, str):
        cleaned = value.replace("$", "").replace(",", "").strip()
        try:
            result = float(cleaned)
            if math.isfinite(result):
                return result
        except ValueError:
            pass
    return None
