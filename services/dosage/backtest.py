#!/usr/bin/env python3
"""
Replay archived dashboard CSV data through the dosage decision engine.
"""

from __future__ import annotations

import argparse
import csv
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

from config import DOSER_CONFIGS, PROFILES, BarbotineProfile, PropertyRange
from data_store import compute_rolling_average
from decision_engine import classify_reading, compute_confidence, resolve_scenario
from flow_controller import apply_daily_cap, compute_raw_delta, compute_proposed_rate
from models import (
    AdjustmentRecord,
    BarbotineType,
    Measurement,
    RheologyReading,
    StatusTriplet,
)


@dataclass
class DailySample:
    day: date
    density: float | None = None
    viscosity: float | None = None
    covering_power: float | None = None
    h2o: float | None = None

    def reading(self) -> RheologyReading | None:
        if self.density is None or self.viscosity is None or self.covering_power is None:
            return None
        return RheologyReading(self.density, self.viscosity, self.covering_power)


@dataclass
class ProposalRow:
    day: date
    scenario_id: int
    decision: str
    conflict: bool
    current_rate: float
    proposed_rate: float
    proposed_delta: float
    actual_rate: float | None
    actual_direction: str
    engine_direction: str
    matched: bool | None
    saturated: bool


def _cell(row: dict[str, str], *names: str) -> str:
    lowered = {key.lower(): value for key, value in row.items()}
    for name in names:
        if name.lower() in lowered:
            return lowered[name.lower()].strip()
    return ""


def _number(raw: str) -> float | None:
    raw = (raw or "").strip().replace(",", ".")
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _day(raw: str) -> date | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(raw).date()
    except ValueError:
        return None


def _param(raw: str) -> str | None:
    value = (raw or "").strip().upper()
    if value in {"DENSITY", "DENSITE", "DENSITÉ"}:
        return "density"
    if value in {"VISCOSITY", "VISCOSITE", "VISCOSITÉ", "VISCO MOYENNE", "VISCO"}:
        return "viscosity"
    if value in {"PC", "COVERING_POWER", "POUVOIR COUVRANT"}:
        return "covering_power"
    if value in {"H2O", "DEBIT EAU", "DÉBIT EAU", "WATER_FLOW"}:
        return "h2o"
    return None


def _norm(raw: str) -> str:
    return "".join(ch for ch in raw.upper() if ch.isalnum())


def load_csv(path: Path, slurry: str | None) -> tuple[list[DailySample], dict[str, tuple[float, float]]]:
    samples: dict[date, DailySample] = {}
    bounds: dict[str, Counter[tuple[float, float]]] = defaultdict(Counter)
    slurry_norm = _norm(slurry or "")

    with path.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            product = _cell(row, "product", "slurry_type", "id_slurry")
            if slurry_norm and product and _norm(product) != slurry_norm:
                continue

            day = _day(_cell(row, "timestamp"))
            param = _param(_cell(row, "parameter"))
            value = _number(_cell(row, "value"))
            if day is None or param is None or value is None:
                continue

            sample = samples.setdefault(day, DailySample(day))
            setattr(sample, param, value)

            lsl = _number(_cell(row, "lsl", "LSL"))
            usl = _number(_cell(row, "usl", "USL"))
            if param != "h2o" and lsl is not None and usl is not None:
                bounds[param][(lsl, usl)] += 1

    selected_bounds = {
        param: counter.most_common(1)[0][0]
        for param, counter in bounds.items()
        if counter
    }
    return [samples[day] for day in sorted(samples)], selected_bounds


def profile_from_bounds(
    btype: BarbotineType,
    bounds: dict[str, tuple[float, float]],
) -> tuple[BarbotineProfile, str]:
    fallback = PROFILES[btype]
    required = {"density", "viscosity", "covering_power"}
    if not required.issubset(bounds):
        return fallback, "fallback_profile"
    return (
        BarbotineProfile(
            base_flow_rate=fallback.base_flow_rate,
            density=PropertyRange(*bounds["density"]),
            viscosity=PropertyRange(*bounds["viscosity"]),
            covering_power=PropertyRange(*bounds["covering_power"]),
        ),
        "csv_bounds",
    )


def _direction(delta: float | None) -> str:
    if delta is None:
        return "n/a"
    if delta > 1e-9:
        return "INC"
    if delta < -1e-9:
        return "DEC"
    return "MNT"


def replay(samples: list[DailySample], btype: BarbotineType, profile: BarbotineProfile) -> list[ProposalRow]:
    doser = DOSER_CONFIGS[btype]
    readings: list[tuple[date, RheologyReading]] = []
    history: list[AdjustmentRecord] = []
    previous_status: StatusTriplet | None = None
    previous_h2o: float | None = None
    rows: list[ProposalRow] = []

    for sample in samples:
        reading = sample.reading()
        if reading is None:
            if sample.h2o is not None:
                previous_h2o = sample.h2o
            continue

        readings.append((sample.day, reading))
        window_start = sample.day - timedelta(days=3)
        window = [
            Measurement(btype, item, datetime.combine(day, time(12), timezone.utc))
            for day, item in readings
            if day >= window_start
        ]
        avg = compute_rolling_average(window)
        if avg is None:
            continue

        status = classify_reading(avg, profile, previous_status)
        confidence = compute_confidence(avg, profile)
        scenario_id, decision, conflict = resolve_scenario(status)
        current_rate = sample.h2o if sample.h2o is not None else (
            previous_h2o if previous_h2o is not None else profile.base_flow_rate
        )
        now = datetime.combine(sample.day, time(12), timezone.utc)
        raw_delta = compute_raw_delta(decision, status, confidence)
        capped_delta = apply_daily_cap(raw_delta, history, now)
        proposed, delta, _ = compute_proposed_rate(
            current_rate,
            decision,
            status,
            confidence,
            history,
            doser,
            now,
        )
        actual_delta = None if previous_h2o is None or sample.h2o is None else sample.h2o - previous_h2o
        engine_direction = _direction(delta)
        actual_direction = _direction(actual_delta)
        matched = None if actual_direction == "n/a" else engine_direction == actual_direction
        saturated = abs(capped_delta) + 1e-12 < abs(raw_delta)

        rows.append(
            ProposalRow(
                day=sample.day,
                scenario_id=scenario_id,
                decision=decision.value,
                conflict=conflict,
                current_rate=current_rate,
                proposed_rate=proposed,
                proposed_delta=delta,
                actual_rate=sample.h2o,
                actual_direction=actual_direction,
                engine_direction=engine_direction,
                matched=matched,
                saturated=saturated,
            )
        )
        history.append(
            AdjustmentRecord(
                barbotine_type=btype,
                scenario_id=scenario_id,
                status=status,
                confidence=confidence,
                decision=decision,
                current_rate=current_rate,
                proposed_rate=proposed,
                actual_rate=proposed,
                user_confirmed=True,
                timestamp=now,
            )
        )
        previous_status = status
        if sample.h2o is not None:
            previous_h2o = sample.h2o

    return rows


def write_report(
    output_dir: Path,
    csv_path: Path,
    slurry: str,
    btype: BarbotineType,
    ranges_source: str,
    rows: list[ProposalRow],
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    out = output_dir / f"backtest_report_{_norm(slurry) or btype.value}.md"
    comparable = [row for row in rows if row.matched is not None]
    matches = sum(1 for row in comparable if row.matched)
    conflicts = sum(1 for row in rows if row.conflict)
    saturated = sum(1 for row in rows if row.saturated)
    match_rate = (matches / len(comparable) * 100) if comparable else 0.0

    lines = [
        f"# Backtest Report - {slurry or btype.value}",
        "",
        f"- CSV: `{csv_path}`",
        f"- Type: `{btype.value}`",
        f"- Ranges source: `{ranges_source}`",
        f"- Decision days: `{len(rows)}`",
        f"- Direction matches: `{matches}/{len(comparable)}` ({match_rate:.1f}%)",
        f"- Conflict triplets: `{conflicts}`",
        f"- Daily-cap saturation days: `{saturated}`",
        "",
        "## Timeline",
        "",
        "| Date | Scenario | Decision | Conflict | Current H2O | Proposed | Delta | Actual H2O | Engine Dir | Actual Dir | Match | Saturated |",
        "| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |",
    ]
    for row in rows:
        actual_rate = f"{row.actual_rate:.4f}" if row.actual_rate is not None else "n/a"
        lines.append(
            "| "
            f"{row.day.isoformat()} | {row.scenario_id} | {row.decision} | "
            f"{'yes' if row.conflict else 'no'} | {row.current_rate:.4f} | "
            f"{row.proposed_rate:.4f} | {row.proposed_delta:+.4f} | "
            f"{actual_rate}"
        )
        suffix = (
            f" | {row.engine_direction} | {row.actual_direction} | "
            f"{'n/a' if row.matched is None else ('yes' if row.matched else 'no')} | "
            f"{'yes' if row.saturated else 'no'} |"
        )
        lines[-1] += suffix

    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Replay a dashboard CSV through the dosage engine.")
    parser.add_argument("--csv", required=True, type=Path)
    parser.add_argument("--type", required=True, choices=[item.value for item in BarbotineType])
    parser.add_argument("--slurry", required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("."))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    btype = BarbotineType(args.type)
    samples, bounds = load_csv(args.csv, args.slurry)
    profile, ranges_source = profile_from_bounds(btype, bounds)
    rows = replay(samples, btype, profile)
    report = write_report(args.output_dir, args.csv, args.slurry, btype, ranges_source, rows)
    print(report)


if __name__ == "__main__":
    main()
