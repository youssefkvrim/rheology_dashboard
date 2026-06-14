"""
Fetch dashboard-maintained rheology bounds for mapped slurry instances.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Callable
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from config import PropertyRange

log = logging.getLogger("barbotine.bounds")

HttpGetJson = Callable[[str, dict[str, str], float], Any]


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


def fetch_ranges(
    slurry_id: str,
    http_get_json: HttpGetJson = _http_get_json,
) -> dict[str, PropertyRange] | None:
    token = _internal_token()
    if not token:
        log.warning("INTERNAL_TOKEN is not set; falling back to configured profiles")
        return None

    url = f"{_dashboard_base()}/api/rheology/bounds?{urlencode({'slurryId': slurry_id})}"
    try:
        payload = http_get_json(url, {"X-Internal-Token": token}, 3.0)
    except (OSError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        log.warning("Could not fetch dashboard bounds for %s: %s", slurry_id, exc)
        return None

    if not isinstance(payload, list):
        return None

    ranges: dict[str, PropertyRange] = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        key = _metric_key(str(item.get("key", "")))
        low = item.get("low")
        high = item.get("high")
        if key is None or low is None or high is None:
            continue
        try:
            ranges[key] = PropertyRange(float(low), float(high))
        except (TypeError, ValueError):
            continue

    required = {"density", "viscosity", "covering_power"}
    if not required.issubset(ranges):
        return None
    return ranges
