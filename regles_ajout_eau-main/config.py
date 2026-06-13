"""
Configuration constants for the barbotine water-addition control system.

Target ranges are placeholders -- calibrate per installation before production use.
Values outside the (min, max) range are classified as HIGHER or LOWER.
Values inside are CONFORM.
"""

from __future__ import annotations

from dataclasses import dataclass
from models import BarbotineType, DoserConfig


@dataclass(frozen=True)
class PropertyRange:
    min: float
    max: float

    @property
    def midpoint(self) -> float:
        return (self.min + self.max) / 2

    @property
    def halfwidth(self) -> float:
        return (self.max - self.min) / 2


@dataclass(frozen=True)
class BarbotineProfile:
    base_flow_rate: float
    density: PropertyRange
    viscosity: PropertyRange
    covering_power: PropertyRange


# ---------------------------------------------------------------------------
# Safety constraints
# ---------------------------------------------------------------------------
MAX_DELTA_PER_ADJUSTMENT: float = 0.002
MAX_DELTA_PER_DAY: float = 0.048
ROLLING_WINDOW_HOURS: int = 72
PENDING_TTL_HOURS: int = 4

# ---------------------------------------------------------------------------
# Confidence scoring
# ---------------------------------------------------------------------------
HYSTERESIS_BAND: float = 0.05  # 5% of halfwidth — prevents oscillation at boundaries
MIN_STEP: float = 0.0005       # L/h — minimum non-zero adjustment

# ---------------------------------------------------------------------------
# Doser hardware configs — set per barbotine type based on installed hardware
# ---------------------------------------------------------------------------
DOSER_CONFIGS: dict[BarbotineType, DoserConfig] = {
    BarbotineType.M7:  DoserConfig(min_rate=0.010, increment=0.002),
    BarbotineType.CN2: DoserConfig(min_rate=0.010, increment=0.002),
    BarbotineType.R55: DoserConfig(min_rate=0.010, increment=0.003),
}

# ---------------------------------------------------------------------------
# Barbotine profiles — CALIBRATE BEFORE PRODUCTION USE
# ---------------------------------------------------------------------------
PROFILES: dict[BarbotineType, BarbotineProfile] = {
    BarbotineType.M7: BarbotineProfile(
        base_flow_rate=0.019,
        density=PropertyRange(1.780, 1.820),
        viscosity=PropertyRange(18.0, 22.0),
        covering_power=PropertyRange(45.0, 55.0),
    ),
    BarbotineType.CN2: BarbotineProfile(
        base_flow_rate=0.022,
        density=PropertyRange(1.720, 1.760),
        viscosity=PropertyRange(15.0, 19.0),
        covering_power=PropertyRange(40.0, 50.0),
    ),
    BarbotineType.R55: BarbotineProfile(
        base_flow_rate=0.034,
        density=PropertyRange(1.650, 1.700),
        viscosity=PropertyRange(12.0, 16.0),
        covering_power=PropertyRange(35.0, 45.0),
    ),
}

# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------
EVALUATION_WINDOW_HOURS: int = 24  # hours after adjustment to evaluate effect
MIN_MEASUREMENTS_FOR_EVAL: int = 3
