"""
Domain models for the barbotine water-addition control system.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional

from clock import now_utc


class BarbotineType(Enum):
    M7 = "M7"
    CN2 = "2CN2"
    R55 = "R55"


class PropertyStatus(Enum):
    HIGHER = "higher"
    CONFORM = "conform"
    LOWER = "lower"


class Decision(Enum):
    INCREASE = "increase_water_flow"
    MAINTAIN = "maintain_water_flow"
    DECREASE = "decrease_water_flow"


class OutcomeVerdict(Enum):
    EFFECTIVE = "effective"
    INSUFFICIENT = "insufficient"
    OVERCORRECTED = "overcorrected"
    NO_EFFECT = "no_effect"
    PENDING = "pending"


@dataclass(frozen=True)
class RheologyReading:
    density: float
    viscosity: float
    covering_power: float
    temperature: float | None = None


@dataclass(frozen=True)
class ConfidenceScore:
    """
    Continuous deviation scores per property.
    0.0 = center of conform range.
    [-1, +1] = within conform range.
    |score| > 1 = outside conform range (higher or lower).
    """
    density: float
    viscosity: float
    covering_power: float

    @property
    def severity(self) -> float:
        return (abs(self.density) + abs(self.viscosity) + abs(self.covering_power)) / 3


@dataclass(frozen=True)
class StatusTriplet:
    density: PropertyStatus
    viscosity: PropertyStatus
    covering_power: PropertyStatus

    def as_tuple(self) -> tuple[PropertyStatus, PropertyStatus, PropertyStatus]:
        return (self.density, self.viscosity, self.covering_power)

    @property
    def deviation_count(self) -> int:
        return sum(1 for s in self.as_tuple() if s != PropertyStatus.CONFORM)


@dataclass(frozen=True)
class DoserConfig:
    min_rate: float = 0.010
    increment: float = 0.002  # 0.002 or 0.003 depending on hardware


@dataclass
class Measurement:
    barbotine_type: BarbotineType
    reading: RheologyReading
    timestamp: datetime = field(default_factory=now_utc)
    id: Optional[int] = None


@dataclass
class AdjustmentRecord:
    barbotine_type: BarbotineType
    scenario_id: int
    status: StatusTriplet
    confidence: ConfidenceScore
    decision: Decision
    current_rate: float
    proposed_rate: float
    actual_rate: float | None = None
    user_confirmed: bool = False
    superseded: bool = False
    timestamp: datetime = field(default_factory=now_utc)
    id: Optional[int] = None

    @property
    def proposed_delta(self) -> float:
        return round(self.proposed_rate - self.current_rate, 6)

    @property
    def actual_delta(self) -> float | None:
        if self.actual_rate is None:
            return None
        return round(self.actual_rate - self.current_rate, 6)


@dataclass
class ActionOutcome:
    adjustment_id: int
    barbotine_type: BarbotineType
    pre_avg: RheologyReading
    post_avg: RheologyReading
    verdict: OutcomeVerdict
    detail: str = ""
    evaluated_at: datetime = field(default_factory=now_utc)
    id: Optional[int] = None
