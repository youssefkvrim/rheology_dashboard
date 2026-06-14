"""
Measurement source adapter.

Production reads mapped slurry measurements from the dashboard API. Standalone
mode (`DOSAGE_STANDALONE=1`) keeps the local SQLite measurement path for tests,
backtests, and development.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Callable
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from clock import now_utc
from data_store import get_measurements_window
from models import BarbotineType, Measurement, RheologyReading

log = logging.getLogger("barbotine.measurements")

HttpGetJson = Callable[[str, dict[str, str], float], Any]


class MeasurementSourceError(RuntimeError):
    pass


def standalone_mode() -> bool:
    return os.environ.get("DOSAGE_STANDALONE", "").strip().lower() in {"1", "true", "yes", "on"}


def _dashboard_base() -> str:
    return os.environ.get("DASHBOARD_API_BASE", "http://127.0.0.1:3001").rstrip("/")


def _internal_token() -> str | None:
    return os.environ.get("INTERNAL_TOKEN")


def _http_get_json(url: str, headers: dict[str, str], timeout: float) -> Any:
    req = Request(url, headers=headers)
    with urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _metric_key(raw: str) -> str | None:
    key = (raw or "").strip().lower()
    if key in {"density", "densite", "densité"}:
        return "density"
    if key in {"viscosity", "viscosite", "viscosité"}:
        return "viscosity"
    if key in {"pc", "covering_power", "pouvoir couvrant"}:
        return "covering_power"
    return None


def _bucket_hour(ms: int | float) -> datetime:
    bucket = round(float(ms) / 3_600_000)
    return datetime.fromtimestamp(bucket * 3600, timezone.utc)


def bucket_readings(series: dict[str, list[dict[str, Any]]], btype: BarbotineType) -> list[Measurement]:
    buckets: dict[datetime, dict[str, float]] = {}
    for raw_key, points in series.items():
        key = _metric_key(raw_key)
        if key is None or not isinstance(points, list):
            continue
        for point in points:
            if not isinstance(point, dict):
                continue
            try:
                ts = _bucket_hour(point["t"])
                value = float(point["v"])
            except (KeyError, TypeError, ValueError):
                continue
            buckets.setdefault(ts, {})[key] = value

    measurements: list[Measurement] = []
    for ts in sorted(buckets):
        values = buckets[ts]
        if {"density", "viscosity", "covering_power"}.issubset(values):
            measurements.append(
                Measurement(
                    barbotine_type=btype,
                    reading=RheologyReading(
                        values["density"],
                        values["viscosity"],
                        values["covering_power"],
                    ),
                    timestamp=ts,
                )
            )
    return measurements


def fetch_measurements(
    btype: BarbotineType,
    hours: float,
    slurry_id: str | None,
    http_get_json: HttpGetJson = _http_get_json,
) -> list[Measurement]:
    if standalone_mode():
        return get_measurements_window(btype, hours)

    if not slurry_id:
        raise MeasurementSourceError(f"no slurry mapped for {btype.value}")

    token = _internal_token()
    if not token:
        raise MeasurementSourceError("INTERNAL_TOKEN is not set")

    start_ms = int((now_utc().timestamp() - hours * 3600) * 1000)
    query = urlencode(
        {
            "slurryId": slurry_id,
            "params": "density,viscosity,pc",
            "includeBounds": "0",
            "start": str(start_ms),
            "maxPoints": "10000",
        }
    )
    url = f"{_dashboard_base()}/api/rheology/all?{query}"
    try:
        payload = http_get_json(url, {"X-Internal-Token": token}, 3.0)
    except (OSError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise MeasurementSourceError(str(exc)) from exc

    if not isinstance(payload, dict) or not isinstance(payload.get("series"), dict):
        raise MeasurementSourceError("invalid dashboard measurement payload")
    return bucket_readings(payload["series"], btype)
