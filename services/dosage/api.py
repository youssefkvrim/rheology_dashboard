"""
REST API layer for the barbotine control system.

Run with:
    uvicorn api:app --host 127.0.0.1 --port 8100

No CORS middleware is enabled. Until dashboard proxy integration, bind only to
127.0.0.1 and never expose this service directly on 0.0.0.0.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import logging

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from analytics import compute_stats
from clock import now_utc
from config import (
    CONFLICT_NOTE,
    DECREASE_NOTE,
    DOSER_CONFIGS,
    MIN_MEASUREMENTS_FOR_EVAL,
    PENDING_TTL_HOURS,
    POST_ADJUST_MIN_WINDOW_HOURS,
    PROFILES,
    ROLLING_WINDOW_HOURS,
)
from data_store import (
    compute_rolling_average,
    confirm_adjustment,
    get_all_adjustments,
    get_confirmed_adjustments_window,
    get_current_flow_rate,
    get_last_confirmed_adjustment,
    get_last_status,
    get_measurements_window,
    get_pending_adjustment,
    init_db,
    insert_adjustment,
    insert_measurement,
    reject_pending_adjustment,
    set_flow_state,
    supersede_pending_adjustments,
)
from decision_engine import classify_reading, compute_confidence, resolve_scenario
from evaluator import evaluate_last_adjustment
from flow_controller import compute_proposed_rate
from models import (
    AdjustmentRecord,
    BarbotineType,
    Decision,
    Measurement,
    RheologyReading,
)


log = logging.getLogger("barbotine.api")

@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    for bt, profile in PROFILES.items():
        if get_current_flow_rate(bt) is None:
            set_flow_state(bt, profile.base_flow_rate)
    yield


app = FastAPI(
    title="Barbotine Control API",
    version="2.0.0",
    description="Water-addition control for ceramic barbotine — decision engine + doser management",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class MeasurementInput(BaseModel):
    type: str = Field(..., description="M7, 2CN2, or R55")
    density: float
    viscosity: float
    covering_power: float
    temperature: float | None = None
    timestamp: str | None = None


class DecisionResponse(BaseModel):
    barbotine_type: str
    adjustment_id: int
    scenario_id: int
    decision: str
    density_status: str
    viscosity_status: str
    cp_status: str
    confidence_density: float
    confidence_viscosity: float
    confidence_cp: float
    severity: float
    current_rate: float
    proposed_rate: float
    proposed_delta: float
    doser_options: list[float]
    doser_increment: float
    conflict: bool
    conflict_note: str | None
    note: str | None
    window_hours: float
    window_degraded: bool
    readings_count: int
    avg_density: float
    avg_viscosity: float
    avg_covering_power: float
    avg_temperature: float | None
    evaluation: dict | None = None


class ConfirmInput(BaseModel):
    actual_rate: float


class StatusResponse(BaseModel):
    barbotine_type: str
    current_rate: float
    base_rate: float
    delta_from_base: float
    doser_increment: float
    last_status: dict | None


class MeasurementRow(BaseModel):
    timestamp: str
    density: float
    viscosity: float
    covering_power: float
    temperature: float | None


class AnalyticsResponse(BaseModel):
    barbotine_type: str
    window_hours: int
    total: int
    increases: int
    maintains: int
    decreases: int
    confirmed: int
    unconfirmed: int
    avg_proposed_magnitude: float
    max_proposed_magnitude: float
    avg_actual_magnitude: float | None
    adjustments_per_day: float
    magnitude_trend: str
    drift_alert: bool
    drift_detail: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TYPE_MAP = {"M7": BarbotineType.M7, "2CN2": BarbotineType.CN2, "R55": BarbotineType.R55}


def _resolve_type(raw: str) -> BarbotineType:
    bt = _TYPE_MAP.get(raw.upper())
    if bt is None:
        raise HTTPException(400, f"Unknown type '{raw}'. Valid: M7, 2CN2, R55")
    return bt


def _parse_timestamp(raw: str | None) -> datetime:
    if not raw:
        return now_utc()
    try:
        ts = datetime.fromisoformat(raw)
    except ValueError as exc:
        raise HTTPException(400, "Invalid ISO timestamp") from exc
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(timezone.utc)


def _pending_is_stale(pending: AdjustmentRecord) -> bool:
    return pending.timestamp < now_utc() - timedelta(hours=PENDING_TTL_HOURS)


def _decision_measurements(bt: BarbotineType) -> tuple[list[Measurement], float, bool]:
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

    measurements = get_measurements_window(bt, window_hours)
    if last_confirmed is not None and len(measurements) < MIN_MEASUREMENTS_FOR_EVAL:
        degraded = True
        window_hours = float(ROLLING_WINDOW_HOURS)
        measurements = get_measurements_window(bt, ROLLING_WINDOW_HOURS)

    return measurements, window_hours, degraded


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "timestamp": now_utc().isoformat()}


@app.post("/measurements", status_code=201)
def add_measurement(body: MeasurementInput) -> dict:
    bt = _resolve_type(body.type)
    ts = _parse_timestamp(body.timestamp)
    reading = RheologyReading(body.density, body.viscosity, body.covering_power, body.temperature)
    m = Measurement(barbotine_type=bt, reading=reading, timestamp=ts)
    mid = insert_measurement(m)
    return {"id": mid, "barbotine_type": bt.value}


@app.post("/decisions/{btype}", response_model=DecisionResponse)
def make_decision(btype: str) -> DecisionResponse:
    bt = _resolve_type(btype)
    profile = PROFILES[bt]
    doser = DOSER_CONFIGS[bt]

    eval_result = evaluate_last_adjustment(bt)
    eval_dict = None
    if eval_result:
        eval_dict = {
            "verdict": eval_result.verdict.value,
            "detail": eval_result.detail,
        }

    measurements, window_hours, window_degraded = _decision_measurements(bt)
    if not measurements:
        raise HTTPException(404, f"No measurements in the last {int(window_hours)}h for {bt.value}")

    avg = compute_rolling_average(measurements)
    if avg is None:
        raise HTTPException(500, "Rolling average computation failed")

    previous_status = get_last_status(bt)
    status = classify_reading(avg, profile, previous_status)
    confidence = compute_confidence(avg, profile)
    scenario_id, decision, conflict = resolve_scenario(status)

    current_rate = get_current_flow_rate(bt)
    if current_rate is None:
        raise HTTPException(500, f"Flow state not initialized for {bt.value}")

    history = get_confirmed_adjustments_window(bt, hours=24)
    proposed, delta, doser_options = compute_proposed_rate(
        current_rate, decision, status, confidence, history, doser,
    )

    superseded_count = supersede_pending_adjustments(bt)
    if superseded_count:
        log.info("[%s] Superseded %d prior pending adjustment(s)", bt.value, superseded_count)

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

    return DecisionResponse(
        barbotine_type=bt.value,
        adjustment_id=adj_id,
        scenario_id=scenario_id,
        decision=decision.value,
        density_status=status.density.value,
        viscosity_status=status.viscosity.value,
        cp_status=status.covering_power.value,
        confidence_density=confidence.density,
        confidence_viscosity=confidence.viscosity,
        confidence_cp=confidence.covering_power,
        severity=round(confidence.severity, 4),
        current_rate=current_rate,
        proposed_rate=proposed,
        proposed_delta=delta,
        doser_options=doser_options,
        doser_increment=doser.increment,
        conflict=conflict,
        conflict_note=CONFLICT_NOTE if conflict else None,
        note=DECREASE_NOTE if decision == Decision.DECREASE else None,
        window_hours=window_hours,
        window_degraded=window_degraded,
        readings_count=len(measurements),
        avg_density=avg.density,
        avg_viscosity=avg.viscosity,
        avg_covering_power=avg.covering_power,
        avg_temperature=avg.temperature,
        evaluation=eval_dict,
    )


@app.post("/decisions/{btype}/confirm")
def confirm_decision(btype: str, body: ConfirmInput) -> dict:
    bt = _resolve_type(btype)
    pending = get_pending_adjustment(bt)
    if pending is None or pending.id is None:
        raise HTTPException(404, f"No pending adjustment for {bt.value}")
    if _pending_is_stale(pending):
        raise HTTPException(
            409,
            f"Pending adjustment for {bt.value} is older than {PENDING_TTL_HOURS}h",
        )

    confirm_adjustment(pending.id, body.actual_rate)
    set_flow_state(bt, body.actual_rate, pending.status)
    return {
        "adjustment_id": pending.id,
        "proposed_rate": pending.proposed_rate,
        "actual_rate": body.actual_rate,
        "delta_from_proposed": round(body.actual_rate - pending.proposed_rate, 6),
    }


@app.post("/decisions/{btype}/reject")
def reject_decision(btype: str) -> dict:
    bt = _resolve_type(btype)
    rejected = reject_pending_adjustment(bt)
    if rejected is None or rejected.id is None:
        raise HTTPException(404, f"No pending adjustment for {bt.value}")
    log.info("[%s] Rejected pending adjustment #%d", bt.value, rejected.id)
    return {
        "adjustment_id": rejected.id,
        "rejected": True,
        "barbotine_type": bt.value,
    }


@app.get("/status", response_model=list[StatusResponse])
def get_status() -> list[StatusResponse]:
    results = []
    for bt in BarbotineType:
        rate = get_current_flow_rate(bt)
        if rate is None:
            continue
        base = PROFILES[bt].base_flow_rate
        doser = DOSER_CONFIGS[bt]
        last_st = get_last_status(bt)
        results.append(StatusResponse(
            barbotine_type=bt.value,
            current_rate=rate,
            base_rate=base,
            delta_from_base=round(rate - base, 6),
            doser_increment=doser.increment,
            last_status={
                "density": last_st.density.value,
                "viscosity": last_st.viscosity.value,
                "covering_power": last_st.covering_power.value,
            } if last_st else None,
        ))
    return results


@app.get("/status/{btype}", response_model=StatusResponse)
def get_status_type(btype: str) -> StatusResponse:
    bt = _resolve_type(btype)
    rate = get_current_flow_rate(bt)
    if rate is None:
        raise HTTPException(404, f"{bt.value} not initialized")
    base = PROFILES[bt].base_flow_rate
    doser = DOSER_CONFIGS[bt]
    last_st = get_last_status(bt)
    return StatusResponse(
        barbotine_type=bt.value,
        current_rate=rate,
        base_rate=base,
        delta_from_base=round(rate - base, 6),
        doser_increment=doser.increment,
        last_status={
            "density": last_st.density.value,
            "viscosity": last_st.viscosity.value,
            "covering_power": last_st.covering_power.value,
        } if last_st else None,
    )


@app.get("/history/{btype}", response_model=list[MeasurementRow])
def get_history(btype: str, hours: int = 72) -> list[MeasurementRow]:
    bt = _resolve_type(btype)
    measurements = get_measurements_window(bt, hours)
    return [
        MeasurementRow(
            timestamp=m.timestamp.isoformat(),
            density=m.reading.density,
            viscosity=m.reading.viscosity,
            covering_power=m.reading.covering_power,
            temperature=m.reading.temperature,
        )
        for m in measurements
    ]


@app.get("/adjustments/{btype}")
def get_adjustment_log(btype: str, hours: int = 168) -> list[dict]:
    bt = _resolve_type(btype)
    adjs = get_all_adjustments(bt, hours=hours)
    return [
        {
            "id": a.id,
            "scenario_id": a.scenario_id,
            "decision": a.decision.value,
            "density_status": a.status.density.value,
            "viscosity_status": a.status.viscosity.value,
            "cp_status": a.status.covering_power.value,
            "confidence_severity": round(a.confidence.severity, 4),
            "current_rate": a.current_rate,
            "proposed_rate": a.proposed_rate,
            "actual_rate": a.actual_rate,
            "user_confirmed": a.user_confirmed,
            "superseded": a.superseded,
            "timestamp": a.timestamp.isoformat(),
        }
        for a in adjs
    ]


@app.get("/analytics/{btype}", response_model=AnalyticsResponse)
def get_analytics(btype: str, hours: int = 168) -> AnalyticsResponse:
    bt = _resolve_type(btype)
    adjs = get_all_adjustments(bt, hours=hours)
    stats = compute_stats(adjs, window_hours=hours)
    return AnalyticsResponse(
        barbotine_type=bt.value,
        window_hours=stats.window_hours,
        total=stats.total,
        increases=stats.increases,
        maintains=stats.maintains,
        decreases=stats.decreases,
        confirmed=stats.confirmed,
        unconfirmed=stats.unconfirmed,
        avg_proposed_magnitude=stats.avg_proposed_magnitude,
        max_proposed_magnitude=stats.max_proposed_magnitude,
        avg_actual_magnitude=stats.avg_actual_magnitude,
        adjustments_per_day=stats.adjustments_per_day,
        magnitude_trend=stats.magnitude_trend,
        drift_alert=stats.drift_alert,
        drift_detail=stats.drift_detail,
    )
