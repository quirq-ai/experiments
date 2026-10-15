#!/usr/bin/env python3
"""
monitor.py — live progress for experiment runs (operator/subset aware).

Counts completed run_records under runs/, prints each new one as it lands, and a
per-environment score/token summary. Unlike the old monitor_pilot.py it does not
hardcode a target of 60 or an absolute path, so it works for any subset a
collaborator runs.

Usage:
  python3 monitor.py                # follow until run_experiment.sh exits
  python3 monitor.py --once         # print a one-shot summary and exit
  python3 monitor.py --runs-dir runs --interval 30
"""
import argparse
import glob
import json
import os
import subprocess
import sys
import time
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))


def load_records(runs_dir):
    recs = []
    for p in sorted(glob.glob(os.path.join(runs_dir, "*", "run_record.json"))):
        try:
            recs.append((p, json.load(open(p))))
        except Exception:
            pass
    return recs


def summarize(recs):
    by_env = defaultdict(list)
    for _, r in recs:
        env = r["condition"]["env_id"]
        sc = r["outcome"].get("score_automated")
        by_env[env].append(sc if sc is not None else 0.0)
    print(f"\n=== {len(recs)} run(s) complete ===")
    for env in sorted(by_env):
        v = by_env[env]
        print(f"  {env}: mean_score={sum(v)/len(v):.3f}  n={len(v)}")


def fmt(r):
    rid = r["run"]["run_id"]
    op = r["run"].get("operator") or "-"
    sc = r["outcome"].get("score_automated")
    st = r["outcome"].get("terminal_state")
    tin = r["tokens"].get("total_input", 0)
    nrd = r["navigation"].get("file_reads_total", 0)
    ned = len(r["navigation"].get("files_edited", []))
    return f"{rid:<52s} op={op:<10s} score={sc}  {str(st):<9s} tok={tin:>9,}  reads={nrd} edits={ned}"


def experiment_running():
    return subprocess.run(["pgrep", "-f", "run_experiment.sh"],
                          capture_output=True).returncode == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs-dir", default=os.path.join(HERE, "runs"))
    ap.add_argument("--interval", type=int, default=30)
    ap.add_argument("--once", action="store_true")
    args = ap.parse_args()

    if args.once:
        recs = load_records(args.runs_dir)
        for _, r in recs:
            print(fmt(r))
        summarize(recs)
        return

    print("=== monitor started (Ctrl-C to stop) ===", flush=True)
    seen = set()
    while True:
        recs = load_records(args.runs_dir)
        for p, r in recs:
            if p not in seen:
                seen.add(p)
                print(f"[{len(seen):3d}] {fmt(r)}", flush=True)
        if not experiment_running():
            print("\n(run_experiment.sh not running — final summary)", flush=True)
            summarize(recs)
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
