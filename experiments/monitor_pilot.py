#!/usr/bin/env python3
"""Monitor pilot progress; exit when all 60 run_records exist."""
import time, glob, json, os, sys

run_dir = '/home/coder/experiments/l1/experiments/runs'
target = 60
prev = 0

print("=== Pilot monitor started ===", flush=True)

while True:
    records = sorted(glob.glob(f'{run_dir}/*/run_record.json'))
    n = len(records)
    if n > prev:
        prev = n
        try:
            r = json.load(open(records[-1]))
            rid = r['run']['run_id']
            sc  = r['outcome']['score_automated']
            st  = r['outcome']['terminal_state']
            tin = r['tokens']['total_input']
            nrd = r['navigation']['file_reads_total']
            ned = len(r['navigation']['files_edited'])
            print(f'[{n:2d}/60] {rid:<45s} score={sc}  {st:<10s} tok={tin:>8,}  reads={nrd}  edits={ned}', flush=True)
        except Exception as e:
            print(f'[{n:2d}/60] parse error: {e}', flush=True)

    if n >= target:
        print(f'\n=== ALL {target} RUNS COMPLETE ===', flush=True)
        # Quick summary
        scores = []
        by_env = {}
        for p in records:
            try:
                r = json.load(open(p))
                sc = r['outcome']['score_automated'] or 0
                env = r['condition']['env_id']
                scores.append(sc)
                by_env.setdefault(env, []).append(sc)
            except:
                pass
        print(f'Overall avg score: {sum(scores)/len(scores):.3f}', flush=True)
        for env in sorted(by_env):
            envs = by_env[env]
            print(f'  {env}: mean={sum(envs)/len(envs):.3f}  n={len(envs)}', flush=True)
        break

    # Check if pilot process is still running
    import subprocess
    p = subprocess.run(['pgrep', '-f', 'run_experiment.sh'], capture_output=True)
    if p.returncode != 0 and n < target:
        print(f'WARNING: run_experiment.sh not running but only {n}/{target} done', flush=True)
        break

    time.sleep(60)
