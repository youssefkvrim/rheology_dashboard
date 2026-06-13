"""
Central clock helper for timezone-aware UTC timestamps.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone

_now_provider: Callable[[], datetime] | None = None


def now_utc() -> datetime:
    if _now_provider is not None:
        current = _now_provider()
    else:
        current = datetime.now(timezone.utc)

    if current.tzinfo is None:
        return current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc)


def set_now_provider_for_tests(provider: Callable[[], datetime] | None) -> None:
    global _now_provider
    _now_provider = provider
