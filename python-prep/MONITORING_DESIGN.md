# GDOT Tracker — Time-Series Monitoring Design

**Status:** Design only (no code written yet)
**Goal:** Track how GDOT statewide projects change month-over-month, and use that
record to decide how often the pipeline actually needs to run.

---

## 1. What we're trying to learn

Two distinct questions:

1. **Substantive:** Are project estimates and progress actually moving?
   - Do **pre-construction cost estimates** change before construction starts?
   - Is **construction percent complete** rising over time for active projects?
   - How many **new projects** truly arrive each period?
   - (Added) Are **completion dates slipping**? Are projects **stopping**, **getting
     awarded**, etc.?

2. **Operational:** Is running the full pipeline monthly overkill? If little changes
   and few projects arrive, a quarterly or semi-annual cadence may be sufficient.

The monitoring files below are designed to answer both — the second one directly.

---

## 2. Findings that shaped this design

- **Construction percent complete is already in the API.** The field
  `CONSTRUCTION_PERCENT_COMPLETE` is currently dropped in
  `1-api-call.py`. Pulled directly, project M006124 returns `60.58` — exactly the
  GeoPI page value. **No scrape change is needed** to capture it.
- **`LAST_REFRESH_DTTM` is a bulk ETL stamp, not a per-record change flag.** Every
  sampled project shares the same refresh month, so it can't tell us which individual
  projects moved. It *does* confirm GDOT refreshes the whole layer at least monthly —
  a hard floor: running more often than the source publishes surfaces nothing new.
- **Projects never leave the API** (per GDOT IT). So:
  - The universe grows **monotonically** → `new_project` counts are a clean, true
    arrival rate.
  - A disappearing project is a **data-integrity anomaly**, not a normal "completed"
    event. Expected count: ~0 per run.
  - The terminal lifecycle event is the transition **→ `COMPLETED-CONSTRUCTION`**.
- **Only cost estimate requires the 15-hour scrape.** Everything else we want to
  monitor is free from the fast API call. This is the basis for decoupling cadences
  (Section 7).

---

## 3. Data sources: cheap vs. expensive

| Signal | Source | Cost to collect |
|---|---|---|
| New projects (IDs) | API | minutes |
| Status (`PRE-CONSTRUCTION` / `UNDER-CONSTRUCTION` / `COMPLETED-CONSTRUCTION`) | API | minutes |
| Construction % complete | API | minutes |
| Payment % complete | API | minutes |
| Current completion date (slippage) | API | minutes |
| Programmed completion date (baseline) | API | minutes |
| Award date / work-stopped date / substantial-completion date | API | minutes |
| TIA flag (regional sales-tax program) | API | minutes |
| Contractor name | API | minutes |
| **Cost estimate** | **Scrape** | **~15 hours** |
| Project type, manager | Scrape | (part of the scrape) |

**Implication:** the only reason to run the expensive scrape is cost-estimate
tracking. Set its cadence off how often cost actually moves (Section 8).

---

## 4. The three diagnostic files

All live in `data/history/`, all append-only, all committed to the repo.

### 4a. `snapshots.csv` — the raw time series (source of truth)

One row per project per run. Wide enough to recompute any metric later even if we
change what we flag.

```
snapshot_date, ID, Status, Cost_estimate, Construction_pct_complete,
Payment_pct_complete, Curr_completion_date, Programmed_completion_date,
Award_date, Time_stopped_date, Substl_work_compl_date, Is_TIA, Contractor, Last_refresh
```

~6,000 rows/run — trivial in size. This file is the durable record; the other two
are derived from it.

### 4b. `changes.csv` — tidy long-format change log

One row per detected change, so you can filter by `change_type` and pivot trends
across many months.

```
snapshot_date, prev_date, ID, change_type, old_value, new_value, delta
```

`change_type` values:

| change_type | Meaning | Source |
|---|---|---|
| `new_project` | ID present now, absent last run | API |
| `status_change` | e.g. PRE-CONSTRUCTION → UNDER-CONSTRUCTION | API |
| `cost_change` | Pre-construction cost estimate changed | Scrape |
| `pct_increase` / `pct_decrease` | Construction % moved | API |
| `pct_now_reporting` | Was null, now has a value | API |
| `completion_date_slip` | Current completion date moved later (delta = days) | API |
| `completion_date_pulled_in` | Moved earlier | API |
| `awarded` | Award date went null → date | API |
| `work_stopped` | Work-stopped date appeared | API |
| `payment_pct_divergence` | Payment % vs construction % gap crossed a threshold | API |
| `dropped` | **Anomaly** — project disappeared (expected: never) | API |

**Tiered priority:** `new_project`, `status_change`, `cost_change`,
`pct_*`, and `completion_date_slip` are the core flags. `awarded`, `work_stopped`,
`payment_pct_divergence`, and `dropped` are opportunistic — the underlying columns
are always captured in `snapshots.csv`, but we only emit change rows for them if
cheap. Description/scope diffing is intentionally **out of scope initially** (the
title-case cleanup in step 1 would create false positives).

### 4c. `run_summary.csv` — run-level roll-up (the cadence diagnostic)

One row per run. This is the table you read to answer "is monthly overkill?"

```
snapshot_date, total_projects, new_projects, status_changes, cost_changes,
pct_movements, completion_date_slips, work_stoppages, anomalies_dropped,
pct_of_universe_changed
```

Read straight down the columns over a few runs and the cadence answer is visual.

---

## 5. Pipeline touchpoints

| Step | File | Change |
|---|---|---|
| 1 | `sub-scripts/1-api-call.py` | Stop dropping the API fields we now want (`CONSTRUCTION_PERCENT_COMPLETE`, `PAYMENT_PERCENT_COMPLETE`, `CURR_COMPLETION_DATE`, `TPRO_PROJ_COMPLETE_DT`, `AWARD_DATE`, `TIME_STOPPED_DATE`, `SUBSTL_WORK_COMPL_DATE`, `IS_TIA_PROJECT`, `CONTRACTOR_NAME`); carry them through the scrape CSV / geometry merge so they ride alongside `Status`. |
| 3 | `sub-scripts/3-finalize.py` | After building data, append the slim per-project rows to `snapshots.csv`. |
| new | `sub-scripts/6-monitor.py` | Read the two most-recent distinct `snapshot_date`s from `snapshots.csv`, join on normalized `ID`, compute changes → append to `changes.csv`, compute roll-up → append to `run_summary.csv`, print a summary block. |
| wire | `pipeline.py` | Add "Step 5 — Monitor changes" between finalize and the git commit. |

Dates from the API arrive as epoch-milliseconds and are normalized to `YYYY-MM-DD`
on the way into `snapshots.csv`.

---

## 6. Logic rules & gotchas

- **ID normalization** identical to `3-finalize.py` (string + zero-pad to 7) on both
  sides before joining. API IDs vary (`M006124`, `532650-`, `0017404`).
- **Cost sentinels:** `Cost_estimate` can be `'Unable to scrape'` / `'No data found'`.
  Coerce to numeric; skip rows where either month is non-numeric so a failed scrape
  never masquerades as a `$X → $0` change.
- **Percent nulls:** ~60% of under-construction projects have **no percent at the
  source**. Skip `null → null`; emit `pct_now_reporting` for `null → value`; flag
  decreases (real signal — re-baseline / correction), not just increases.
- **Cost change scope:** only where prior `Status` was `PRE-CONSTRUCTION` (your
  question is specifically about estimates moving *before* construction).
- **Float / rounding noise:** round cost and percent comparisons (ignore sub-cent and
  <0.01% diffs) so noise doesn't fill `changes.csv`.
- **First run / no prior snapshot:** write the snapshot, skip the diff cleanly, write
  a `run_summary` row with new/changed counts blank.
- **Coverage caveat to remember:** percent-movement reporting can only ever cover the
  ~400 active projects that report a percent. That's a GDOT data limitation.

---

## 7. Run strategy — what to run, and when

The decoupling insight means you don't have one cadence decision, you have two.

### Track A — Lightweight API monitor (cheap, run often)
Everything except cost estimate. Runs in minutes. Could be a trimmed path that runs
steps 1 + (snapshot append) + 6 only, **skipping the 15-hour scrape and finalize**.

- **Suggested cadence to start:** monthly (matches GDOT's refresh floor; weekly is
  possible but won't beat the source).
- **Tells you:** arrival rate of new projects, status transitions, percent-complete
  movement, completion-date slippage — the bulk of the "is anything happening" signal.

### Track B — Full pipeline incl. scrape (expensive, run rarely)
The only thing it adds over Track A is fresh **cost estimates** (plus type/manager).

- **Suggested cadence to start:** monthly for the first 3–4 runs to *measure* how
  often cost moves, then step down based on what `cost_changes` shows (Section 8).
- **Tells you:** whether pre-construction estimates are being revised.

> Practically: keep running the full pipeline monthly for ~3–4 months to build the
> baseline, then split into Track A (frequent, cheap) + Track B (infrequent, scrape)
> once the data tells you how slow cost estimates really move.

---

## 8. What to check in each file — and what it should tell you

After each run, look at these in order:

### `run_summary.csv` — first stop, every time
- **`new_projects`** — your arrival rate. If it's consistently 1–2/run, the universe
  is nearly static and frequent runs are hard to justify.
- **`pct_of_universe_changed`** — the headline "is anything moving" number. If it sits
  near zero month after month, that's the case for stretching cadence.
- **`anomalies_dropped`** — should be 0 (projects never leave). Anything >0 = go look.

### `changes.csv` — when you want the detail behind a summary number
- Filter `change_type == 'cost_change'`: **how many pre-construction estimates moved,
  and by how much.** This is the single number that justifies (or retires) the
  15-hour scrape cadence. Few/small changes → scrape less often.
- Filter `pct_increase` / `pct_decrease`: are active projects actually progressing?
  Lots of `pct_decrease` = GDOT re-baselining, worth a conversation.
- Filter `completion_date_slip`: schedule health — sum of slip-days over time is a
  portfolio delay indicator.
- Filter `status_change`: lifecycle flow (how many moved PRE → UNDER → COMPLETED).

### `snapshots.csv` — for any custom/trend analysis
- Pivot a single project's history (e.g. percent-complete trajectory, completion-date
  drift) by filtering on `ID`.
- Segment by `Is_TIA` to compare TIA vs. non-TIA portfolio behavior (ARC-relevant).
- Recompute any metric historically if we later change what `changes.csv` flags.

### What the pattern of results should tell you about cadence

| If `run_summary` shows… | Interpretation | Suggested action |
|---|---|---|
| Many new projects + high % changed each run | Active, fast-moving portfolio | Keep Track A monthly |
| Few new projects, but `cost_changes` frequent | Estimates churn even when count is flat | Keep Track B (scrape) frequent |
| Few new projects **and** `cost_changes` rare | Slow-moving on the one expensive signal | Step Track B down to quarterly/semi-annual; keep Track A monthly |
| Near-zero change across the board for 3+ runs | Source rarely moves | Stretch both tracks to quarterly |
| `anomalies_dropped > 0` ever | Data-integrity issue | Investigate before trusting that run |

---

## 9. Net change footprint

- One small edit to `1-api-call.py` (keep more columns).
- A slightly wider snapshot append in `3-finalize.py`.
- One new `6-monitor.py` (~150–200 lines).
- One wiring line in `pipeline.py`.
- (Optional, later) a trimmed "Track A only" entry point that runs the cheap path
  without the scrape.

No change to the expensive scrape itself.
