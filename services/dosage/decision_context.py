"""
Shared decision setup for API and CLI.
"""

from __future__ import annotations

from dataclasses import dataclass

from bounds_source import fetch_ranges
from clock import now_utc
from config import (
    MIN_MEASUREMENTS_FOR_EVAL,
    POST_ADJUST_MIN_WINDOW_HOURS,
    PROFILES,
    ROLLING_WINDOW_HOURS,
    BarbotineProfile,
)
from data_store import get_last_confirmed_adjustment, get_mapping
from measurements_source import MeasurementSourceError, fetch_measurements, standalone_mode
from models import BarbotineType, Measurement


class MappingRequiredError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProfileSelection:
    profile: BarbotineProfile
    ranges_source: str
    slurry_id: str | None


@dataclass(frozen=True)
class MeasurementSelection:
    measurements: list[Measurement]
    window_hours: float
    window_degraded: bool


def get_required_mapping(bt: BarbotineType) -> str | None:
    if standalone_mode():
        return None
    mapping = get_mapping(bt)
    if mapping is None:
        raise MappingRequiredError(f"no slurry mapped for {bt.value}")
    return mapping.slurry_id


def select_profile(bt: BarbotineType, slurry_id: str | None) -> ProfileSelection:
    fallback = PROFILES[bt]
    if slurry_id is None or standalone_mode():
        return ProfileSelection(fallback, "fallback_profile", slurry_id)

    ranges = fetch_ranges(slurry_id)
    if ranges is None:
        return ProfileSelection(fallback, "fallback_profile", slurry_id)

    return ProfileSelection(
        BarbotineProfile(
            base_flow_rate=fallback.base_flow_rate,
            density=ranges["density"],
            viscosity=ranges["viscosity"],
            covering_power=ranges["covering_power"],
        ),
        "dashboard_bounds",
        slurry_id,
    )


def collect_decision_measurements(
    bt: BarbotineType,
    slurry_id: str | None,
) -> MeasurementSelection:
    last_confirmed = get_last_confirmed_adjustment(bt)
    window_hours = float(ROLLING_WINDOW_HOURS)
    degraded = False

    if last_confirmed is not None:
        elapsed_hours = max(
            0.0,
            (now_utc() - last_confirmed.timestamp).total_seconds() / 3600,
        )
        window_hours = max(
            float(POST_ADJUST_MIN_WINDOW_HOURS),
            min(float(ROLLING_WINDOW_HOURS), elapsed_hours),
        )

    measurements = fetch_measurements(bt, window_hours, slurry_id)
    if last_confirmed is not None and len(measurements) < MIN_MEASUREMENTS_FOR_EVAL:
        degraded = True
        window_hours = float(ROLLING_WINDOW_HOURS)
        measurements = fetch_measurements(bt, window_hours, slurry_id)

    return MeasurementSelection(measurements, window_hours, degraded)


__all__ = [
    "MappingRequiredError",
    "MeasurementSourceError",
    "ProfileSelection",
    "MeasurementSelection",
    "collect_decision_measurements",
    "get_required_mapping",
    "select_profile",
]
