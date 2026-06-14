"""
SQLite persistence layer.

Tables:
  measurements   — raw rheological readings with timestamps and optional temperature
  adjustments    — every decision: proposed, confirmed actual, full scenario context
  flow_state     — current flow rate + last classification status per barbotine
  action_outcomes — auto-evaluated effectiveness of each confirmed adjustment
"""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Generator

from clock import now_utc
from models import (
    ActionOutcome,
    AdjustmentRecord,
    BarbotineType,
    ConfidenceScore,
    Decision,
    MappingRecord,
    Measurement,
    OutcomeVerdict,
    PropertyStatus,
    RheologyReading,
    StatusTriplet,
)

def _configured_db_path() -> Path:
    configured = os.environ.get("DOSAGE_DB_PATH")
    if configured:
        return Path(configured).expanduser()
    return Path(__file__).resolve().parent / "barbotine.db"


DB_PATH = _configured_db_path()


def _parse_ts(raw: str) -> datetime:
    ts = datetime.fromisoformat(raw)
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(timezone.utc)


@contextmanager
def _connect(path: Path = DB_PATH) -> Generator[sqlite3.Connection, None, None]:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(path: Path = DB_PATH) -> None:
    with _connect(path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS measurements (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                barbotine_type  TEXT    NOT NULL,
                density         REAL    NOT NULL,
                viscosity       REAL    NOT NULL,
                covering_power  REAL    NOT NULL,
                temperature     REAL,
                timestamp       TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS adjustments (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                barbotine_type  TEXT    NOT NULL,
                scenario_id     INTEGER NOT NULL,
                density_status  TEXT    NOT NULL,
                viscosity_status TEXT   NOT NULL,
                cp_status       TEXT    NOT NULL,
                conf_density    REAL    NOT NULL,
                conf_viscosity  REAL    NOT NULL,
                conf_cp         REAL    NOT NULL,
                decision        TEXT    NOT NULL,
                current_rate    REAL    NOT NULL,
                proposed_rate   REAL    NOT NULL,
                actual_rate     REAL,
                user_confirmed  INTEGER NOT NULL DEFAULT 0,
                superseded      INTEGER NOT NULL DEFAULT 0,
                timestamp       TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS flow_state (
                barbotine_type      TEXT PRIMARY KEY,
                current_rate        REAL NOT NULL,
                last_density_status TEXT,
                last_visc_status    TEXT,
                last_cp_status      TEXT,
                updated_at          TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS action_outcomes (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                adjustment_id   INTEGER NOT NULL REFERENCES adjustments(id),
                barbotine_type  TEXT    NOT NULL,
                pre_density     REAL NOT NULL,
                pre_viscosity   REAL NOT NULL,
                pre_cp          REAL NOT NULL,
                pre_temperature REAL,
                post_density    REAL NOT NULL,
                post_viscosity  REAL NOT NULL,
                post_cp         REAL NOT NULL,
                post_temperature REAL,
                verdict         TEXT NOT NULL,
                detail          TEXT,
                evaluated_at    TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS mapping (
                barbotine_type  TEXT PRIMARY KEY,
                slurry_id       TEXT NOT NULL,
                updated_at      TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_meas_type_ts
                ON measurements(barbotine_type, timestamp);
            CREATE INDEX IF NOT EXISTS idx_adj_type_ts
                ON adjustments(barbotine_type, timestamp);
            CREATE INDEX IF NOT EXISTS idx_adj_confirmed
                ON adjustments(barbotine_type, user_confirmed);
            CREATE INDEX IF NOT EXISTS idx_outcomes_adj
                ON action_outcomes(adjustment_id);
            """
        )
        columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(adjustments)").fetchall()
        }
        if "superseded" not in columns:
            conn.execute(
                "ALTER TABLE adjustments ADD COLUMN superseded INTEGER NOT NULL DEFAULT 0"
            )


# ---------------------------------------------------------------------------
# Measurements
# ---------------------------------------------------------------------------

def insert_measurement(m: Measurement, path: Path = DB_PATH) -> int:
    with _connect(path) as conn:
        cur = conn.execute(
            """INSERT INTO measurements
               (barbotine_type, density, viscosity, covering_power, temperature, timestamp)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                m.barbotine_type.value,
                m.reading.density,
                m.reading.viscosity,
                m.reading.covering_power,
                m.reading.temperature,
                m.timestamp.isoformat(),
            ),
        )
        return cur.lastrowid  # type: ignore[return-value]


def get_measurements_window(
    btype: BarbotineType,
    hours: float = 72,
    path: Path = DB_PATH,
    since: datetime | None = None,
) -> list[Measurement]:
    if since is None:
        since = now_utc() - timedelta(hours=hours)
    cutoff = since.isoformat()
    with _connect(path) as conn:
        rows = conn.execute(
            """SELECT id, barbotine_type, density, viscosity, covering_power,
                      temperature, timestamp
               FROM measurements
               WHERE barbotine_type = ? AND timestamp >= ?
               ORDER BY timestamp""",
            (btype.value, cutoff),
        ).fetchall()
    return [
        Measurement(
            id=r["id"],
            barbotine_type=BarbotineType(r["barbotine_type"]),
            reading=RheologyReading(
                r["density"], r["viscosity"], r["covering_power"], r["temperature"]
            ),
            timestamp=_parse_ts(r["timestamp"]),
        )
        for r in rows
    ]


def compute_rolling_average(measurements: list[Measurement]) -> RheologyReading | None:
    if not measurements:
        return None
    n = len(measurements)
    temps = [m.reading.temperature for m in measurements if m.reading.temperature is not None]
    return RheologyReading(
        density=round(sum(m.reading.density for m in measurements) / n, 6),
        viscosity=round(sum(m.reading.viscosity for m in measurements) / n, 6),
        covering_power=round(sum(m.reading.covering_power for m in measurements) / n, 6),
        temperature=round(sum(temps) / len(temps), 2) if temps else None,
    )


# ---------------------------------------------------------------------------
# Mapping
# ---------------------------------------------------------------------------

def set_mapping(
    btype: BarbotineType,
    slurry_id: str,
    path: Path = DB_PATH,
) -> MappingRecord:
    updated_at = now_utc()
    with _connect(path) as conn:
        conn.execute(
            """INSERT INTO mapping (barbotine_type, slurry_id, updated_at)
               VALUES (?, ?, ?)
               ON CONFLICT(barbotine_type)
               DO UPDATE SET slurry_id = excluded.slurry_id,
                             updated_at = excluded.updated_at""",
            (btype.value, slurry_id, updated_at.isoformat()),
        )
    return MappingRecord(btype, slurry_id, updated_at)


def get_mapping(
    btype: BarbotineType,
    path: Path = DB_PATH,
) -> MappingRecord | None:
    with _connect(path) as conn:
        row = conn.execute(
            "SELECT barbotine_type, slurry_id, updated_at FROM mapping WHERE barbotine_type = ?",
            (btype.value,),
        ).fetchone()
    if row is None:
        return None
    return MappingRecord(
        BarbotineType(row["barbotine_type"]),
        row["slurry_id"],
        _parse_ts(row["updated_at"]),
    )


def get_all_mappings(path: Path = DB_PATH) -> list[MappingRecord]:
    with _connect(path) as conn:
        rows = conn.execute(
            "SELECT barbotine_type, slurry_id, updated_at FROM mapping ORDER BY barbotine_type"
        ).fetchall()
    return [
        MappingRecord(
            BarbotineType(row["barbotine_type"]),
            row["slurry_id"],
            _parse_ts(row["updated_at"]),
        )
        for row in rows
    ]


# ---------------------------------------------------------------------------
# Adjustments
# ---------------------------------------------------------------------------

def insert_adjustment(a: AdjustmentRecord, path: Path = DB_PATH) -> int:
    with _connect(path) as conn:
        cur = conn.execute(
            """INSERT INTO adjustments
               (barbotine_type, scenario_id, density_status, viscosity_status,
                cp_status, conf_density, conf_viscosity, conf_cp,
                decision, current_rate, proposed_rate, actual_rate,
                user_confirmed, superseded, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                a.barbotine_type.value,
                a.scenario_id,
                a.status.density.value,
                a.status.viscosity.value,
                a.status.covering_power.value,
                a.confidence.density,
                a.confidence.viscosity,
                a.confidence.covering_power,
                a.decision.value,
                a.current_rate,
                a.proposed_rate,
                a.actual_rate,
                int(a.user_confirmed),
                int(a.superseded),
                a.timestamp.isoformat(),
            ),
        )
        return cur.lastrowid  # type: ignore[return-value]


def confirm_adjustment(adj_id: int, actual_rate: float, path: Path = DB_PATH) -> None:
    with _connect(path) as conn:
        conn.execute(
            """UPDATE adjustments
               SET actual_rate = ?, user_confirmed = 1, superseded = 0
               WHERE id = ? AND superseded = 0""",
            (actual_rate, adj_id),
        )


def supersede_pending_adjustments(
    btype: BarbotineType, path: Path = DB_PATH
) -> int:
    with _connect(path) as conn:
        cur = conn.execute(
            """UPDATE adjustments
               SET superseded = 1
               WHERE barbotine_type = ?
                 AND user_confirmed = 0
                 AND superseded = 0""",
            (btype.value,),
        )
        return cur.rowcount


def supersede_adjustment(adj_id: int, path: Path = DB_PATH) -> None:
    with _connect(path) as conn:
        conn.execute(
            "UPDATE adjustments SET superseded = 1 WHERE id = ? AND user_confirmed = 0",
            (adj_id,),
        )


def reject_pending_adjustment(
    btype: BarbotineType, path: Path = DB_PATH
) -> AdjustmentRecord | None:
    pending = get_pending_adjustment(btype, path)
    if pending is None or pending.id is None:
        return None
    supersede_adjustment(pending.id, path)
    pending.superseded = True
    return pending


def get_adjustments_window(
    btype: BarbotineType,
    hours: int = 24,
    path: Path = DB_PATH,
) -> list[AdjustmentRecord]:
    cutoff = (now_utc() - timedelta(hours=hours)).isoformat()
    with _connect(path) as conn:
        rows = conn.execute(
            """SELECT * FROM adjustments
               WHERE barbotine_type = ? AND timestamp >= ?
               ORDER BY timestamp""",
            (btype.value, cutoff),
        ).fetchall()
    return _rows_to_adjustments(rows)


def get_confirmed_adjustments_window(
    btype: BarbotineType,
    hours: int = 24,
    path: Path = DB_PATH,
) -> list[AdjustmentRecord]:
    cutoff = (now_utc() - timedelta(hours=hours)).isoformat()
    with _connect(path) as conn:
        rows = conn.execute(
            """SELECT * FROM adjustments
               WHERE barbotine_type = ?
                 AND user_confirmed = 1
                 AND timestamp >= ?
               ORDER BY timestamp""",
            (btype.value, cutoff),
        ).fetchall()
    return _rows_to_adjustments(rows)


def get_confirmed_adjustments_between(
    btype: BarbotineType,
    start: datetime,
    end: datetime,
    path: Path = DB_PATH,
) -> list[AdjustmentRecord]:
    with _connect(path) as conn:
        rows = conn.execute(
            """SELECT * FROM adjustments
               WHERE barbotine_type = ?
                 AND user_confirmed = 1
                 AND timestamp > ?
                 AND timestamp <= ?
               ORDER BY timestamp""",
            (btype.value, start.isoformat(), end.isoformat()),
        ).fetchall()
    return _rows_to_adjustments(rows)


def get_last_confirmed_adjustment(
    btype: BarbotineType, path: Path = DB_PATH
) -> AdjustmentRecord | None:
    with _connect(path) as conn:
        row = conn.execute(
            """SELECT * FROM adjustments
               WHERE barbotine_type = ? AND user_confirmed = 1
               ORDER BY timestamp DESC LIMIT 1""",
            (btype.value,),
        ).fetchone()
    if row is None:
        return None
    return _rows_to_adjustments([row])[0]


def get_pending_adjustment(
    btype: BarbotineType, path: Path = DB_PATH
) -> AdjustmentRecord | None:
    with _connect(path) as conn:
        row = conn.execute(
            """SELECT * FROM adjustments
               WHERE barbotine_type = ? AND user_confirmed = 0 AND superseded = 0
               ORDER BY timestamp DESC LIMIT 1""",
            (btype.value,),
        ).fetchone()
    if row is None:
        return None
    return _rows_to_adjustments([row])[0]


def get_all_adjustments(
    btype: BarbotineType, hours: int = 168, path: Path = DB_PATH
) -> list[AdjustmentRecord]:
    cutoff = (now_utc() - timedelta(hours=hours)).isoformat()
    with _connect(path) as conn:
        rows = conn.execute(
            """SELECT * FROM adjustments
               WHERE barbotine_type = ? AND timestamp >= ?
               ORDER BY timestamp""",
            (btype.value, cutoff),
        ).fetchall()
    return _rows_to_adjustments(rows)


def _rows_to_adjustments(rows: list) -> list[AdjustmentRecord]:
    return [
        AdjustmentRecord(
            id=r["id"],
            barbotine_type=BarbotineType(r["barbotine_type"]),
            scenario_id=r["scenario_id"],
            status=StatusTriplet(
                PropertyStatus(r["density_status"]),
                PropertyStatus(r["viscosity_status"]),
                PropertyStatus(r["cp_status"]),
            ),
            confidence=ConfidenceScore(
                r["conf_density"], r["conf_viscosity"], r["conf_cp"]
            ),
            decision=Decision(r["decision"]),
            current_rate=r["current_rate"],
            proposed_rate=r["proposed_rate"],
            actual_rate=r["actual_rate"],
            user_confirmed=bool(r["user_confirmed"]),
            superseded=bool(r["superseded"]) if "superseded" in r.keys() else False,
            timestamp=_parse_ts(r["timestamp"]),
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Flow state (with hysteresis tracking)
# ---------------------------------------------------------------------------

def get_current_flow_rate(btype: BarbotineType, path: Path = DB_PATH) -> float | None:
    with _connect(path) as conn:
        row = conn.execute(
            "SELECT current_rate FROM flow_state WHERE barbotine_type = ?",
            (btype.value,),
        ).fetchone()
    return row["current_rate"] if row else None


def get_last_status(btype: BarbotineType, path: Path = DB_PATH) -> StatusTriplet | None:
    with _connect(path) as conn:
        row = conn.execute(
            """SELECT last_density_status, last_visc_status, last_cp_status
               FROM flow_state WHERE barbotine_type = ?""",
            (btype.value,),
        ).fetchone()
    if row is None or row["last_density_status"] is None:
        return None
    return StatusTriplet(
        PropertyStatus(row["last_density_status"]),
        PropertyStatus(row["last_visc_status"]),
        PropertyStatus(row["last_cp_status"]),
    )


def set_flow_state(
    btype: BarbotineType,
    rate: float,
    status: StatusTriplet | None = None,
    path: Path = DB_PATH,
) -> None:
    now = now_utc().isoformat()
    d_s = status.density.value if status else None
    v_s = status.viscosity.value if status else None
    c_s = status.covering_power.value if status else None
    with _connect(path) as conn:
        conn.execute(
            """INSERT INTO flow_state
               (barbotine_type, current_rate, last_density_status, last_visc_status,
                last_cp_status, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(barbotine_type)
               DO UPDATE SET current_rate = excluded.current_rate,
                             last_density_status = COALESCE(excluded.last_density_status, last_density_status),
                             last_visc_status = COALESCE(excluded.last_visc_status, last_visc_status),
                             last_cp_status = COALESCE(excluded.last_cp_status, last_cp_status),
                             updated_at = excluded.updated_at""",
            (btype.value, rate, d_s, v_s, c_s, now),
        )


# ---------------------------------------------------------------------------
# Action outcomes
# ---------------------------------------------------------------------------

def insert_outcome(o: ActionOutcome, path: Path = DB_PATH) -> int:
    with _connect(path) as conn:
        cur = conn.execute(
            """INSERT INTO action_outcomes
               (adjustment_id, barbotine_type,
                pre_density, pre_viscosity, pre_cp, pre_temperature,
                post_density, post_viscosity, post_cp, post_temperature,
                verdict, detail, evaluated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                o.adjustment_id,
                o.barbotine_type.value,
                o.pre_avg.density, o.pre_avg.viscosity, o.pre_avg.covering_power,
                o.pre_avg.temperature,
                o.post_avg.density, o.post_avg.viscosity, o.post_avg.covering_power,
                o.post_avg.temperature,
                o.verdict.value,
                o.detail,
                o.evaluated_at.isoformat(),
            ),
        )
        return cur.lastrowid  # type: ignore[return-value]


def outcome_exists(adjustment_id: int, path: Path = DB_PATH) -> bool:
    with _connect(path) as conn:
        row = conn.execute(
            "SELECT 1 FROM action_outcomes WHERE adjustment_id = ?",
            (adjustment_id,),
        ).fetchone()
    return row is not None
