#!/usr/bin/env python3
"""
Barbotine water-addition control system -- CLI entry point.

Usage:
    python main.py init
    python main.py add-measurement <type> <density> <viscosity> <covering_power> [--temp T]
    python main.py decide <type>
    python main.py confirm <type> <actual_rate>
    python main.py reject <type>
    python main.py status [type]
    python main.py map [type] [slurry_id]
    python main.py history <type> [--hours N]
    python main.py analytics <type> [--hours N]
    python main.py import-csv <file>

Types: M7, 2CN2, R55
"""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from analytics import compute_stats
from clock import now_utc
from config import (
    CALIBRATION_STATUS,
    CONFLICT_NOTE,
    DECREASE_NOTE,
    DOSER_CONFIGS,
    PENDING_TTL_HOURS,
    PROFILES,
)
from data_store import (
    compute_rolling_average,
    confirm_adjustment,
    get_all_adjustments,
    get_all_mappings,
    get_confirmed_adjustments_window,
    get_current_flow_rate,
    get_last_status,
    get_mapping,
    get_measurements_window,
    get_pending_adjustment,
    init_db,
    insert_adjustment,
    insert_measurement,
    reject_pending_adjustment,
    set_mapping,
    set_flow_state,
    supersede_pending_adjustments,
)
from decision_engine import classify_reading, compute_confidence, resolve_scenario
from decision_context import (
    MappingRequiredError,
    MeasurementSourceError,
    collect_decision_measurements,
    get_required_mapping,
    select_profile,
)
from evaluator import evaluate_last_adjustment
from flow_controller import compute_proposed_rate, snap_to_doser
from models import (
    AdjustmentRecord,
    BarbotineType,
    Decision,
    Measurement,
    RheologyReading,
)

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("barbotine")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_type(raw: str) -> BarbotineType:
    mapping = {"M7": BarbotineType.M7, "2CN2": BarbotineType.CN2, "R55": BarbotineType.R55}
    bt = mapping.get(raw.upper())
    if bt is None:
        log.error("Unknown barbotine type '%s'. Valid: M7, 2CN2, R55", raw)
        sys.exit(1)
    return bt


def _decision_label(d: Decision) -> str:
    return {
        Decision.INCREASE: "INCREASE water flow",
        Decision.MAINTAIN: "MAINTAIN water flow",
        Decision.DECREASE: "DECREASE water flow",
    }[d]


def _parse_timestamp(raw: str | None) -> datetime:
    if not raw:
        return now_utc()
    ts = datetime.fromisoformat(raw)
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(timezone.utc)


def _pending_is_stale(pending: AdjustmentRecord) -> bool:
    return pending.timestamp < now_utc() - timedelta(hours=PENDING_TTL_HOURS)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_init(_args: argparse.Namespace) -> None:
    init_db()
    for bt, profile in PROFILES.items():
        if get_current_flow_rate(bt) is None:
            set_flow_state(bt, profile.base_flow_rate)
            log.info("Initialized %s at %.4f L/h", bt.value, profile.base_flow_rate)
    log.info("Database ready.")


def cmd_add_measurement(args: argparse.Namespace) -> None:
    bt = _parse_type(args.type)
    temp = getattr(args, "temp", None)
    reading = RheologyReading(args.density, args.viscosity, args.covering_power, temp)
    m = Measurement(barbotine_type=bt, reading=reading)
    mid = insert_measurement(m)
    temp_str = f" t={temp:.1f}C" if temp is not None else ""
    log.info(
        "Recorded measurement #%d for %s: d=%.4f v=%.2f cp=%.2f%s",
        mid, bt.value, reading.density, reading.viscosity, reading.covering_power, temp_str,
    )


def cmd_decide(args: argparse.Namespace) -> None:
    bt = _parse_type(args.type)
    try:
        slurry_id = get_required_mapping(bt)
    except MappingRequiredError as exc:
        log.error("[%s] %s", bt.value, exc)
        sys.exit(1)

    profile_selection = select_profile(bt, slurry_id)
    profile = profile_selection.profile
    doser = DOSER_CONFIGS[bt]
    log.info(
        "[%s] source: slurry=%s ranges=%s calibration=%s",
        bt.value,
        profile_selection.slurry_id or "standalone",
        profile_selection.ranges_source,
        CALIBRATION_STATUS,
    )

    # Auto-evaluate previous adjustment before making a new decision
    outcome = evaluate_last_adjustment(bt)
    if outcome is not None:
        log.info(
            "[%s] Previous adjustment evaluated: %s — %s",
            bt.value, outcome.verdict.value.upper(), outcome.detail,
        )

    try:
        selection = collect_decision_measurements(bt, slurry_id)
    except MeasurementSourceError as exc:
        log.error("[%s] measurement source unavailable: %s", bt.value, exc)
        sys.exit(1)

    measurements = selection.measurements
    window_hours = selection.window_hours
    window_degraded = selection.window_degraded
    if not measurements:
        log.warning("No measurements in the last %.1f h for %s.", window_hours, bt.value)
        sys.exit(0)

    avg = compute_rolling_average(measurements)
    if avg is None:
        log.warning("Rolling average computation failed for %s.", bt.value)
        sys.exit(0)

    temp_str = f" t={avg.temperature:.1f}C" if avg.temperature is not None else ""
    log.info(
        "[%s] %.1fh avg over %d readings: d=%.4f v=%.2f cp=%.2f%s",
        bt.value, window_hours, len(measurements),
        avg.density, avg.viscosity, avg.covering_power, temp_str,
    )
    if window_degraded:
        log.warning("[%s] Short post-adjustment window under-sampled; fell back to 72h.", bt.value)

    previous_status = get_last_status(bt)
    status = classify_reading(avg, profile, previous_status)
    confidence = compute_confidence(avg, profile)
    scenario_id, decision, conflict = resolve_scenario(status)

    log.info(
        "[%s] Scenario #%02d | D=%s V=%s CP=%s => %s",
        bt.value, scenario_id,
        status.density.value.upper(),
        status.viscosity.value.upper(),
        status.covering_power.value.upper(),
        _decision_label(decision),
    )
    if conflict:
        log.warning("[%s] %s", bt.value, CONFLICT_NOTE)
    if decision == Decision.DECREASE:
        log.info("[%s] %s", bt.value, DECREASE_NOTE)
    log.info(
        "[%s] Confidence: d=%.2f v=%.2f cp=%.2f | severity=%.2f",
        bt.value, confidence.density, confidence.viscosity,
        confidence.covering_power, confidence.severity,
    )

    current_rate = get_current_flow_rate(bt)
    if current_rate is None:
        log.error("Flow state not initialized for %s. Run 'init' first.", bt.value)
        sys.exit(1)

    history = get_confirmed_adjustments_window(bt, hours=24)
    proposed, delta, doser_options = compute_proposed_rate(
        current_rate, decision, status, confidence, history, doser,
    )

    superseded_count = supersede_pending_adjustments(bt)
    if superseded_count:
        log.info("[%s] Superseded %d prior pending adjustment(s).", bt.value, superseded_count)

    record = AdjustmentRecord(
        barbotine_type=bt,
        scenario_id=scenario_id,
        status=status,
        confidence=confidence,
        decision=decision,
        current_rate=current_rate,
        proposed_rate=proposed,
    )
    adj_id = insert_adjustment(record)

    log.info(
        "[%s] Proposed: %.4f L/h (delta %+.4f from %.4f)",
        bt.value, proposed, delta, current_rate,
    )
    log.info(
        "[%s] Doser options (step %.3f): %s",
        bt.value, doser.increment,
        ", ".join(f"{o:.4f}" for o in doser_options),
    )

    if decision == Decision.DECREASE and proposed == 0.0:
        log.warning("[%s] Flow at ZERO — consider cutting water or opening lid.", bt.value)

    log.info(
        "[%s] Adjustment #%d left pending. Use 'confirm %s <rate>' or 'reject %s'.",
        bt.value, adj_id, bt.value, bt.value,
    )


def cmd_confirm(args: argparse.Namespace) -> None:
    bt = _parse_type(args.type)
    pending = get_pending_adjustment(bt)
    if pending is None or pending.id is None:
        log.warning("No pending adjustment for %s.", bt.value)
        sys.exit(0)
    if _pending_is_stale(pending):
        log.error(
            "Pending adjustment #%d for %s is older than %d h; reject it and decide again.",
            pending.id, bt.value, PENDING_TTL_HOURS,
        )
        sys.exit(1)

    actual = args.actual_rate
    confirm_adjustment(pending.id, actual)
    set_flow_state(bt, actual, pending.status)
    log.info(
        "[%s] Confirmed adjustment #%d: actual=%.4f (proposed was %.4f, delta from proposed %+.4f)",
        bt.value, pending.id, actual, pending.proposed_rate, actual - pending.proposed_rate,
    )


def cmd_reject(args: argparse.Namespace) -> None:
    bt = _parse_type(args.type)
    rejected = reject_pending_adjustment(bt)
    if rejected is None or rejected.id is None:
        log.warning("No pending adjustment for %s.", bt.value)
        sys.exit(0)
    log.info("[%s] Rejected pending adjustment #%d.", bt.value, rejected.id)


def cmd_status(args: argparse.Namespace) -> None:
    types = [_parse_type(args.type)] if args.type else list(BarbotineType)
    for bt in types:
        rate = get_current_flow_rate(bt)
        if rate is None:
            print(f"  {bt.value:5s}  -- not initialized")
            continue
        base = PROFILES[bt].base_flow_rate
        doser = DOSER_CONFIGS[bt]
        diff = rate - base
        last_st = get_last_status(bt)
        mapping = get_mapping(bt)
        status_str = ""
        if last_st:
            status_str = f"  [D={last_st.density.value} V={last_st.viscosity.value} CP={last_st.covering_power.value}]"
        print(
            f"  {bt.value:5s}  {rate:.4f} L/h  (base {base:.4f}, delta {diff:+.4f})"
            f"  doser step={doser.increment}"
            f"  mapped={mapping.slurry_id if mapping else '--'}"
            f"  calibration={CALIBRATION_STATUS}{status_str}"
        )


def cmd_map(args: argparse.Namespace) -> None:
    if args.type is None:
        records = {record.barbotine_type: record for record in get_all_mappings()}
        for bt in BarbotineType:
            record = records.get(bt)
            if record is None:
                print(f"  {bt.value:5s}  -- unmapped")
            else:
                print(
                    f"  {bt.value:5s}  {record.slurry_id}"
                    f"  updated={record.updated_at.isoformat()}"
                )
        return

    bt = _parse_type(args.type)
    if args.slurry_id is None:
        record = get_mapping(bt)
        if record is None:
            print(f"  {bt.value:5s}  -- unmapped")
        else:
            print(
                f"  {bt.value:5s}  {record.slurry_id}"
                f"  updated={record.updated_at.isoformat()}"
            )
        return

    slurry_id = args.slurry_id.strip()
    if not slurry_id:
        log.error("slurry_id must not be blank")
        sys.exit(1)
    record = set_mapping(bt, slurry_id)
    log.info(
        "[%s] mapped to slurry %s at %s",
        bt.value,
        record.slurry_id,
        record.updated_at.isoformat(),
    )


def cmd_history(args: argparse.Namespace) -> None:
    bt = _parse_type(args.type)
    measurements = get_measurements_window(bt, args.hours)
    if not measurements:
        print(f"No measurements for {bt.value} in the last {args.hours} h.")
        return
    print(f"{'Timestamp':>20s}  {'Density':>8s}  {'Viscosity':>9s}  {'CovPow':>8s}  {'Temp':>6s}")
    print("-" * 60)
    for m in measurements:
        t_str = f"{m.reading.temperature:6.1f}" if m.reading.temperature is not None else "   --"
        print(
            f"{m.timestamp.strftime('%Y-%m-%d %H:%M'):>20s}"
            f"  {m.reading.density:8.4f}"
            f"  {m.reading.viscosity:9.2f}"
            f"  {m.reading.covering_power:8.2f}"
            f"  {t_str}"
        )


def cmd_analytics(args: argparse.Namespace) -> None:
    bt = _parse_type(args.type)
    hours = args.hours
    adjustments = get_all_adjustments(bt, hours=hours)
    stats = compute_stats(adjustments, window_hours=hours)

    print(f"\n  Analytics for {bt.value} (last {hours}h)")
    print(f"  {'='*45}")
    print(f"  Total adjustments:     {stats.total}")
    print(f"  Increases:             {stats.increases}")
    print(f"  Maintains:             {stats.maintains}")
    print(f"  Decreases:             {stats.decreases}")
    print(f"  Confirmed / Pending:   {stats.confirmed} / {stats.unconfirmed}")
    print(f"  Avg proposed |delta|:  {stats.avg_proposed_magnitude:.6f} L/h")
    print(f"  Max proposed |delta|:  {stats.max_proposed_magnitude:.6f} L/h")
    if stats.avg_actual_magnitude is not None:
        print(f"  Avg actual |delta|:    {stats.avg_actual_magnitude:.6f} L/h")
    print(f"  Adjustments/day:       {stats.adjustments_per_day:.1f}")
    print(f"  Magnitude trend:       {stats.magnitude_trend}")
    if stats.drift_alert:
        print(f"  ** DRIFT ALERT **      {stats.drift_detail}")
    print()


def cmd_import_csv(args: argparse.Namespace) -> None:
    path = Path(args.file)
    if not path.exists():
        log.error("File not found: %s", path)
        sys.exit(1)

    count = 0
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            bt = _parse_type(row["type"])
            ts = (
                _parse_timestamp(row["timestamp"])
                if "timestamp" in row and row["timestamp"]
                else now_utc()
            )
            temp = float(row["temperature"]) if row.get("temperature") else None
            m = Measurement(
                barbotine_type=bt,
                reading=RheologyReading(
                    float(row["density"]),
                    float(row["viscosity"]),
                    float(row["covering_power"]),
                    temp,
                ),
                timestamp=ts,
            )
            insert_measurement(m)
            count += 1
    log.info("Imported %d measurements from %s", count, path)


# ---------------------------------------------------------------------------
# CLI parser
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="barbotine-ctrl",
        description="Barbotine water-addition control system",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init", help="Initialize database and flow state")

    p_add = sub.add_parser("add-measurement", help="Record a rheological measurement")
    p_add.add_argument("type", help="Barbotine type: M7, 2CN2, R55")
    p_add.add_argument("density", type=float)
    p_add.add_argument("viscosity", type=float)
    p_add.add_argument("covering_power", type=float)
    p_add.add_argument("--temp", type=float, default=None, help="Temperature (C)")

    p_dec = sub.add_parser("decide", help="Run decision engine (proposes + optional confirm)")
    p_dec.add_argument("type", help="Barbotine type: M7, 2CN2, R55")

    p_conf = sub.add_parser("confirm", help="Confirm pending adjustment with actual doser rate")
    p_conf.add_argument("type", help="Barbotine type")
    p_conf.add_argument("actual_rate", type=float, help="Actual rate set on doser (L/h)")

    p_rej = sub.add_parser("reject", help="Reject pending adjustment without changing flow state")
    p_rej.add_argument("type", help="Barbotine type")

    p_st = sub.add_parser("status", help="Show current flow rates")
    p_st.add_argument("type", nargs="?", default=None)

    p_map = sub.add_parser("map", help="List or set type-to-slurry mappings")
    p_map.add_argument("type", nargs="?", default=None, help="Barbotine type")
    p_map.add_argument("slurry_id", nargs="?", default=None, help="Dashboard slurry id")

    p_hist = sub.add_parser("history", help="Show measurement history")
    p_hist.add_argument("type")
    p_hist.add_argument("--hours", type=int, default=72)

    p_an = sub.add_parser("analytics", help="Adjustment frequency and drift analysis")
    p_an.add_argument("type")
    p_an.add_argument("--hours", type=int, default=168)

    p_csv = sub.add_parser("import-csv", help="Import measurements from CSV")
    p_csv.add_argument("file", help="Path to CSV file")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    dispatch = {
        "init": cmd_init,
        "add-measurement": cmd_add_measurement,
        "decide": cmd_decide,
        "confirm": cmd_confirm,
        "reject": cmd_reject,
        "status": cmd_status,
        "map": cmd_map,
        "history": cmd_history,
        "analytics": cmd_analytics,
        "import-csv": cmd_import_csv,
    }
    dispatch[args.command](args)


if __name__ == "__main__":
    main()
