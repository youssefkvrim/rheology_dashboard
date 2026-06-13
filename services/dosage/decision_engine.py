"""
Decision engine: classifies rheological readings and maps them to one of 27 scenarios.

Supports two classification modes:
  - Discrete: hard thresholds (original 27-scenario table)
  - Confidence-based: continuous scoring with hysteresis to prevent oscillation
"""

from __future__ import annotations

from config import BarbotineProfile, HYSTERESIS_BAND, PropertyRange
from models import (
    ConfidenceScore,
    Decision,
    PropertyStatus,
    RheologyReading,
    StatusTriplet,
)

H = PropertyStatus.HIGHER
C = PropertyStatus.CONFORM
L = PropertyStatus.LOWER

INC = Decision.INCREASE
MNT = Decision.MAINTAIN
DEC = Decision.DECREASE

# fmt: off
SCENARIO_TABLE: dict[tuple[PropertyStatus, PropertyStatus, PropertyStatus], tuple[int, Decision]] = {
    # ---- density HIGHER (scenarios 1-9) ----
    (H, H, H): ( 1, INC),  (H, H, C): ( 2, INC),  (H, H, L): ( 3, INC),
    (H, C, H): ( 4, INC),  (H, C, C): ( 5, INC),  (H, C, L): ( 6, INC),
    (H, L, H): ( 7, INC),  (H, L, C): ( 8, INC),  (H, L, L): ( 9, INC),
    # ---- density CONFORM (scenarios 10-18) ----
    (C, H, H): (10, INC),  (C, H, C): (11, INC),  (C, H, L): (12, MNT),
    (C, C, H): (13, INC),  (C, C, C): (14, MNT),  (C, C, L): (15, DEC),
    (C, L, H): (16, MNT),  (C, L, C): (17, MNT),  (C, L, L): (18, MNT),
    # ---- density LOWER (scenarios 19-27) ----
    (L, H, H): (19, DEC),  (L, H, C): (20, DEC),  (L, H, L): (21, DEC),
    (L, C, H): (22, DEC),  (L, C, C): (23, DEC),  (L, C, L): (24, DEC),
    (L, L, H): (25, DEC),  (L, L, C): (26, DEC),  (L, L, L): (27, DEC),
}
# fmt: on


# ---------------------------------------------------------------------------
# Continuous confidence scoring
# ---------------------------------------------------------------------------

def compute_score(value: float, prop_range: PropertyRange) -> float:
    """
    Normalized deviation from range center.
    Returns [-1, +1] when inside conform range.
    >1 = above range (higher), <-1 = below range (lower).
    """
    hw = prop_range.halfwidth
    if hw == 0:
        if value == prop_range.midpoint:
            return 0.0
        return 1.0 if value > prop_range.midpoint else -1.0
    return (value - prop_range.midpoint) / hw


def compute_confidence(
    reading: RheologyReading, profile: BarbotineProfile
) -> ConfidenceScore:
    return ConfidenceScore(
        density=round(compute_score(reading.density, profile.density), 4),
        viscosity=round(compute_score(reading.viscosity, profile.viscosity), 4),
        covering_power=round(compute_score(reading.covering_power, profile.covering_power), 4),
    )


# ---------------------------------------------------------------------------
# Classification with hysteresis
# ---------------------------------------------------------------------------

def classify_value(
    value: float,
    prop_range: PropertyRange,
    previous_status: PropertyStatus | None = None,
) -> PropertyStatus:
    """
    Classify with optional hysteresis.
    Without previous_status: standard threshold.
    With previous_status: require exceeding threshold + hysteresis band to switch.
    """
    score = compute_score(value, prop_range)
    band = HYSTERESIS_BAND

    if previous_status is None:
        if score > 1.0:
            return PropertyStatus.HIGHER
        if score < -1.0:
            return PropertyStatus.LOWER
        return PropertyStatus.CONFORM

    if previous_status == PropertyStatus.CONFORM:
        if score > 1.0 + band:
            return PropertyStatus.HIGHER
        if score < -(1.0 + band):
            return PropertyStatus.LOWER
        return PropertyStatus.CONFORM
    elif previous_status == PropertyStatus.HIGHER:
        if score < 1.0 - band:
            return PropertyStatus.CONFORM if score > -(1.0 + band) else PropertyStatus.LOWER
        return PropertyStatus.HIGHER
    else:  # LOWER
        if score > -(1.0 - band):
            return PropertyStatus.CONFORM if score < 1.0 + band else PropertyStatus.HIGHER
        return PropertyStatus.LOWER


def classify_reading(
    reading: RheologyReading,
    profile: BarbotineProfile,
    previous_status: StatusTriplet | None = None,
) -> StatusTriplet:
    prev_d = previous_status.density if previous_status else None
    prev_v = previous_status.viscosity if previous_status else None
    prev_cp = previous_status.covering_power if previous_status else None

    return StatusTriplet(
        density=classify_value(reading.density, profile.density, prev_d),
        viscosity=classify_value(reading.viscosity, profile.viscosity, prev_v),
        covering_power=classify_value(reading.covering_power, profile.covering_power, prev_cp),
    )


def resolve_scenario(status: StatusTriplet) -> tuple[int, Decision]:
    return SCENARIO_TABLE[status.as_tuple()]
