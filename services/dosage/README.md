# Barbotine Dosage Service

Standalone FastAPI and CLI service for proposing bounded demineralized-water
doser adjustments for M7, 2CN2, and R55 barbotine families.

The service proposes adjustments from rheology measurements, records pending
decisions in SQLite, and updates flow state only after an operator confirms the
actual rate set on the physical doser.

## Non-Negotiable Principle

The software proposes; a human disposes. No code path may command a doser or
treat a proposal as applied without explicit operator confirmation carrying the
actually-set rate.

## Install

```bash
cd services/dosage
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
```

## Run

```bash
cd services/dosage
python main.py init
uvicorn api:app --host 127.0.0.1 --port 8100
```

Set `DOSAGE_DB_PATH=/path/to/barbotine.db` to override the default SQLite path
(`services/dosage/barbotine.db`).

## Test

```bash
cd services/dosage
python3 -m unittest discover
python3 -m unittest discover -s tests
```

## Backtest

```bash
cd services/dosage
python3 backtest.py --csv <export.csv> --type M7 --slurry M7-3006 --output-dir docs/backtests
```

Backtest reports are Markdown evidence for process review. They compare the
engine's proposed direction with the H2O flow direction recorded in archived
dashboard exports.
