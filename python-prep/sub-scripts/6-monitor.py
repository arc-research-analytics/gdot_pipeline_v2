# This script is Part 6 of the GDOT Tracker pipeline — the monitoring/diagnostic step.
# It reads the appended snapshot history (written by 3-finalize.py), compares the two
# most-recent runs, and records what changed month-over-month.
#
# Outputs (all append-only, all committed to the repo):
#   data/history/changes.csv      — tidy long-format, one row per detected change
#   data/history/run_summary.csv  — one roll-up row per run (the cadence diagnostic)
#
# It reads only snapshots.csv, so it is safe to run standalone after a finalize.
# See MONITORING_DESIGN.md for the full rationale.

import os
import pandas as pd
from datetime import datetime

HISTORY_DIR = '../data/history'
SNAPSHOT_CSV = os.path.join(HISTORY_DIR, 'snapshots.csv')
CHANGES_CSV = os.path.join(HISTORY_DIR, 'changes.csv')
RUN_SUMMARY_CSV = os.path.join(HISTORY_DIR, 'run_summary.csv')

# Thresholds — keep noise out of changes.csv
COST_EPS = 1.0       # dollars; ignore sub-dollar cost wobble
PCT_EPS = 0.01       # percentage points; ignore sub-0.01% wobble
DIVERGENCE_PTS = 10.0  # payment-vs-construction gap (points) that counts as "diverged"

CHANGES_COLUMNS = ['snapshot_date', 'prev_date', 'ID', 'change_type',
                   'old_value', 'new_value', 'delta']
RUN_SUMMARY_COLUMNS = ['snapshot_date', 'total_projects', 'new_projects',
                       'status_changes', 'cost_changes', 'pct_movements',
                       'completion_date_slips', 'work_stoppages',
                       'anomalies_dropped', 'pct_of_universe_changed']

# Statuses for the two cost/percent questions
PRE_CONSTRUCTION = 'PRE-CONSTRUCTION'
UNDER_CONSTRUCTION = 'UNDER-CONSTRUCTION'


def num(value):
    """Coerce to float, or None if blank / non-numeric (e.g. 'Unable to scrape')."""
    n = pd.to_numeric(value, errors='coerce')
    return None if pd.isna(n) else float(n)


def date_or_none(value):
    """Parse a 'YYYY-MM-DD' string to a date, or None if blank/unparseable."""
    if value is None or (isinstance(value, float) and pd.isna(value)) or str(value).strip() == '':
        return None
    try:
        return datetime.strptime(str(value).strip(), '%Y-%m-%d').date()
    except ValueError:
        return None


def text(value):
    """Normalize a possibly-NaN cell to a stripped string ('' if missing)."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
    return str(value).strip()


def load_snapshots():
    if not os.path.exists(SNAPSHOT_CSV):
        return None
    df = pd.read_csv(SNAPSHOT_CSV, dtype={'ID': str})
    df['ID'] = df['ID'].str.zfill(7)
    return df


def compare(prev, curr, prev_date, curr_date):
    """Return (list of change-row dicts, set of changed IDs) for the two snapshots."""
    changes = []
    changed_ids = set()

    def record(pid, change_type, old_value='', new_value='', delta=''):
        changes.append({
            'snapshot_date': curr_date, 'prev_date': prev_date, 'ID': pid,
            'change_type': change_type, 'old_value': old_value,
            'new_value': new_value, 'delta': delta,
        })
        changed_ids.add(pid)

    prev_by_id = {r['ID']: r for _, r in prev.iterrows()}
    curr_by_id = {r['ID']: r for _, r in curr.iterrows()}
    prev_ids, curr_ids = set(prev_by_id), set(curr_by_id)

    # New projects (clean arrival rate — universe is monotonic) and anomalies.
    for pid in sorted(curr_ids - prev_ids):
        record(pid, 'new_project')
    for pid in sorted(prev_ids - curr_ids):
        # Projects never leave the API per GDOT IT — a disappearance is a data anomaly.
        record(pid, 'dropped')

    # Projects present in both runs.
    for pid in sorted(curr_ids & prev_ids):
        p, c = prev_by_id[pid], curr_by_id[pid]
        p_status, c_status = text(p['Status']), text(c['Status'])

        # Status transitions (lifecycle flow).
        if p_status != c_status:
            record(pid, 'status_change', p_status, c_status)

        # Pre-construction cost-estimate revisions (the one signal needing the scrape).
        if p_status == PRE_CONSTRUCTION:
            p_cost, c_cost = num(p['Cost_estimate']), num(c['Cost_estimate'])
            if p_cost is not None and c_cost is not None and abs(c_cost - p_cost) >= COST_EPS:
                record(pid, 'cost_change', p_cost, c_cost, round(c_cost - p_cost, 2))

        # Construction-percent movement for projects active in both runs.
        if p_status == UNDER_CONSTRUCTION and c_status == UNDER_CONSTRUCTION:
            p_pct, c_pct = num(p['Construction_pct_complete']), num(c['Construction_pct_complete'])
            if p_pct is None and c_pct is not None:
                record(pid, 'pct_now_reporting', '', c_pct)
            elif p_pct is not None and c_pct is not None:
                diff = round(c_pct - p_pct, 2)
                if diff >= PCT_EPS:
                    record(pid, 'pct_increase', p_pct, c_pct, diff)
                elif diff <= -PCT_EPS:
                    record(pid, 'pct_decrease', p_pct, c_pct, diff)

            # Payment vs construction divergence (newly crossing the threshold).
            p_pay, c_pay = num(p['Payment_pct_complete']), num(c['Payment_pct_complete'])
            if c_pct is not None and c_pay is not None:
                curr_gap = abs(c_pay - c_pct)
                prev_gap = abs(p_pay - p_pct) if (p_pct is not None and p_pay is not None) else 0.0
                if curr_gap >= DIVERGENCE_PTS > prev_gap:
                    record(pid, 'payment_pct_divergence', round(prev_gap, 2), round(curr_gap, 2),
                           round(curr_gap - prev_gap, 2))

        # Completion-date slippage (schedule health).
        p_done, c_done = date_or_none(p['Curr_completion_date']), date_or_none(c['Curr_completion_date'])
        if p_done and c_done and p_done != c_done:
            delta_days = (c_done - p_done).days
            kind = 'completion_date_slip' if delta_days > 0 else 'completion_date_pulled_in'
            record(pid, kind, p_done.isoformat(), c_done.isoformat(), delta_days)

        # Award event (let to contract).
        if not date_or_none(p['Award_date']) and date_or_none(c['Award_date']):
            record(pid, 'awarded', '', text(c['Award_date']))

        # Work stoppage.
        if not date_or_none(p['Time_stopped_date']) and date_or_none(c['Time_stopped_date']):
            record(pid, 'work_stopped', '', text(c['Time_stopped_date']))

    return changes, changed_ids


def append_rows(path, rows, columns):
    df = pd.DataFrame(rows, columns=columns)
    write_header = not os.path.exists(path) or os.path.getsize(path) == 0
    df.to_csv(path, mode='a', header=write_header, index=False)


def print_summary(summary, changes):
    counts = {}
    for ch in changes:
        counts[ch['change_type']] = counts.get(ch['change_type'], 0) + 1
    print(f"\n{'═' * 52}")
    print(f"  MONITORING SUMMARY — {summary['snapshot_date']}")
    print(f"{'═' * 52}")
    print(f"  Total projects:           {summary['total_projects']:>6,}")
    print(f"  New projects:             {summary['new_projects']:>6,}")
    print(f"  Status changes:           {summary['status_changes']:>6,}")
    print(f"  Pre-con cost changes:     {summary['cost_changes']:>6,}")
    print(f"  Percent movements:        {summary['pct_movements']:>6,}")
    print(f"  Completion-date slips:    {summary['completion_date_slips']:>6,}")
    print(f"  Work stoppages:           {summary['work_stoppages']:>6,}")
    print(f"  Anomalies (dropped):      {summary['anomalies_dropped']:>6,}")
    print(f"  % of universe changed:    {summary['pct_of_universe_changed']:>6}%")
    other = {k: v for k, v in counts.items() if k not in (
        'new_project', 'dropped', 'status_change', 'cost_change')}
    if other:
        detail = ', '.join(f"{k}={v}" for k, v in sorted(other.items()))
        print(f"  ── change-type detail: {detail}")
    print(f"{'═' * 52}")


def main():
    os.makedirs(HISTORY_DIR, exist_ok=True)
    snapshots = load_snapshots()
    if snapshots is None or snapshots.empty:
        print("No snapshot history found — run 3-finalize.py first. Nothing to compare.")
        return

    dates = sorted(snapshots['snapshot_date'].unique())
    curr_date = dates[-1]
    curr = snapshots[snapshots['snapshot_date'] == curr_date]
    total = len(curr)

    if len(dates) < 2:
        # First run: nothing to diff. Record a roll-up row with blanks for change counts.
        print(f"Only one snapshot ({curr_date}) on file — baseline recorded, no diff yet.")
        summary = {
            'snapshot_date': curr_date, 'total_projects': total, 'new_projects': '',
            'status_changes': '', 'cost_changes': '', 'pct_movements': '',
            'completion_date_slips': '', 'work_stoppages': '', 'anomalies_dropped': '',
            'pct_of_universe_changed': '',
        }
        append_rows(RUN_SUMMARY_CSV, [summary], RUN_SUMMARY_COLUMNS)
        return

    prev_date = dates[-2]
    prev = snapshots[snapshots['snapshot_date'] == prev_date]
    print(f"Comparing {prev_date} → {curr_date} ({len(prev):,} vs {total:,} projects)...")

    changes, changed_ids = compare(prev, curr, prev_date, curr_date)

    def count(*types):
        return sum(1 for ch in changes if ch['change_type'] in types)

    summary = {
        'snapshot_date': curr_date,
        'total_projects': total,
        'new_projects': count('new_project'),
        'status_changes': count('status_change'),
        'cost_changes': count('cost_change'),
        'pct_movements': count('pct_increase', 'pct_decrease', 'pct_now_reporting'),
        'completion_date_slips': count('completion_date_slip'),
        'work_stoppages': count('work_stopped'),
        'anomalies_dropped': count('dropped'),
        'pct_of_universe_changed': round(len(changed_ids) / total * 100, 2) if total else 0,
    }

    if changes:
        append_rows(CHANGES_CSV, changes, CHANGES_COLUMNS)
    append_rows(RUN_SUMMARY_CSV, [summary], RUN_SUMMARY_COLUMNS)
    print_summary(summary, changes)


if __name__ == '__main__':
    main()
    print("✅ Monitoring complete!")
