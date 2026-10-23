"""Result Checker comparison service (Day 8 A).

Deterministic comparison, no LLM arithmetic:
- within: value within [min, max] with > margin% margin from bounds
- borderline: value within margin% of a bound
- outside: value outside [min, max]
- see criterion: qualitative limit (no min/max, criterion_text provided)
"""

from typing import Optional


def check_numeric_limit(
    value: float,
    min_val: Optional[float],
    max_val: Optional[float],
    margin_pct: float = 10.0,
) -> str:
    """
    Compare a measured value against numeric bounds with a margin.

    Returns: "within limits" | "borderline" | "outside limits"
    """
    # Outside bounds
    if min_val is not None and value < min_val:
        return "outside limits"
    if max_val is not None and value > max_val:
        return "outside limits"

    # Check margin from bounds
    edges = [x for x in (min_val, max_val) if x is not None]
    for edge in edges:
        if edge != 0 and abs(value - edge) / abs(edge) * 100 <= margin_pct:
            return "borderline"

    return "within limits"


def check_result(
    measured_value: float,
    min_val: Optional[float],
    max_val: Optional[float],
    value_text: str,
    unit: Optional[str],
    condition_note: Optional[str],
    margin_pct: float = 10.0,
) -> dict:
    """
    Main comparison function.

    Returns dict with: status, limit_value, source, troubleshooting (list)
    """
    # Qualitative limit: no numeric bounds, only criterion text
    if min_val is None and max_val is None:
        return {
            "status": "see criterion",
            "limit_value": value_text,
            "source": f"Test Catalog (condition: {condition_note or 'general'})",
            "troubleshooting": [],
        }

    status = check_numeric_limit(measured_value, min_val, max_val)

    result = {
        "status": status,
        "limit_value": f"{value_text} {unit or ''}".strip(),
        "source": f"Test Catalog (condition: {condition_note or 'general'})",
        "troubleshooting": [],
    }

    return result