#!/usr/bin/env python3
"""
build_dataset.py
----------------
Responsibility: Scan runs/ directory for all run_record.json files,
                validate each, flatten to a pandas DataFrame, save as Parquet.

Inputs:
  --runs-dir      path to runs/ directory (default: experiments/runs)
  --raw-file      path to pilot_runs.jsonl (concatenated raw records)
  --output        path to write dataset.parquet

Outputs:
  dataset.parquet   — one row per run, columns = all run_record fields flattened

Usage:
  python analysis/scripts/build_dataset.py \
    --runs-dir runs/ \
    --output results/processed/dataset.parquet
"""

import argparse
import json
import sys
from pathlib import Path

import pandas as pd


ENV_ORDER = ["E0", "E1", "E2", "E3", "E4", "E5"]
DIFFICULTY_ORDER = {"easy": 1, "medium": 2, "hard": 3}


def flatten_record(r: dict) -> dict:
    """Flatten nested run_record dict to a single-level dict for DataFrame."""
    row = {}
    row["run_id"]           = r["run"]["run_id"]
    row["experiment_id"]    = r["run"]["experiment_id"]
    row["operator"]         = r["run"].get("operator")
    row["replication"]      = r["run"]["replication"]
    row["timestamp_start"]  = r["run"]["timestamp_start"]
    row["timestamp_end"]    = r["run"]["timestamp_end"]

    row["task_id"]          = r["condition"]["task_id"]
    row["env_id"]           = r["condition"]["env_id"]
    row["agent_id"]         = r["condition"]["agent_id"]
    row["agent_provider"]   = r["condition"]["agent_provider"]
    row["base_repo_sha"]    = r["condition"]["base_repo_sha"]

    row["terminal_state"]   = r["outcome"]["terminal_state"]
    row["score_automated"]  = r["outcome"]["score_automated"]
    row["score_human"]      = r["outcome"]["score_human"]

    row["total_input"]      = r["tokens"]["total_input"]
    row["total_output"]     = r["tokens"]["total_output"]
    row["cache_read"]       = r["tokens"]["cache_read"]
    row["cache_write"]      = r["tokens"]["cache_write"]
    row["total_effective"]  = r["tokens"].get("total_effective")
    row["context_acquisition"] = r["tokens"]["context_acquisition"]
    row["phase_orient_input"]  = r["tokens"].get("phase_orientation_input")
    row["phase_impl_input"]    = r["tokens"].get("phase_implementation_input")
    row["phase_verif_input"]   = r["tokens"].get("phase_verification_input")

    row["wall_clock_seconds"]        = r["timing"]["wall_clock_seconds"]
    row["time_to_first_edit_seconds"]= r["timing"]["time_to_first_edit_seconds"]
    row["phase_orient_seconds"]      = r["timing"].get("phase_orientation_seconds")
    row["phase_impl_seconds"]        = r["timing"].get("phase_implementation_seconds")
    row["phase_verif_seconds"]       = r["timing"].get("phase_verification_seconds")

    row["file_reads_total"]    = r["navigation"]["file_reads_total"]
    row["file_reads_unique"]   = r["navigation"]["file_reads_unique"]
    row["nav_entropy"]         = r["navigation"]["nav_entropy"]
    row["nav_entropy_pre_edit"]= r["navigation"]["nav_entropy_pre_edit"]
    row["files_edited_count"]  = len(r["navigation"]["files_edited"])
    row["memory_reads"]        = r["navigation"]["memory_reads"]
    row["memory_writes"]       = r["navigation"]["memory_writes"]
    row["xo_reads"]            = r["navigation"]["xo_reads"]
    row["agents_md_read"]      = r["navigation"]["agents_md_read"]
    row["project_md_read"]     = r["navigation"]["project_md_read"]

    row["tool_calls_total"]  = r["operations"]["tool_calls_total"]
    row["bash_calls"]        = r["operations"]["bash_calls"]
    row["search_calls"]      = r["operations"]["search_calls"]
    row["git_calls"]         = r["operations"]["git_calls"]
    row["web_searches"]      = r["operations"]["web_searches"]
    row["agent_spawns"]      = r["operations"]["agent_spawns"]
    row["replanning_events"] = r["operations"]["replanning_events"]
    row["message_count"]     = r["operations"]["message_count"]

    return row


TASK_META = {
    "T01": {"category": "feature",       "difficulty": "easy"},
    "T02": {"category": "bugfix",         "difficulty": "easy"},
    "T03": {"category": "feature",        "difficulty": "medium"},
    "T04": {"category": "refactor",       "difficulty": "medium"},
    "T05": {"category": "test",           "difficulty": "medium"},
    "T06": {"category": "feature",        "difficulty": "medium"},
    "T07": {"category": "feature",        "difficulty": "hard"},
    "T08": {"category": "feature",        "difficulty": "hard"},
    "T09": {"category": "bugfix",         "difficulty": "hard"},
    "T10": {"category": "documentation",  "difficulty": "easy"},
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs-dir",  default="runs")
    parser.add_argument("--raw-file",  default=None, help="Also read from raw JSONL (supplementary)")
    parser.add_argument("--output",    default="results/processed/dataset.parquet")
    args = parser.parse_args()

    records = []

    # Scan runs/ for run_record.json
    runs_path = Path(args.runs_dir)
    for record_file in sorted(runs_path.glob("*/run_record.json")):
        try:
            with open(record_file) as f:
                r = json.load(f)
            records.append(flatten_record(r))
        except Exception as e:
            print(f"WARN: skipping {record_file}: {e}", file=sys.stderr)

    # Also read from raw JSONL if provided
    if args.raw_file and Path(args.raw_file).exists():
        with open(args.raw_file) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    r = json.loads(line)
                    row = flatten_record(r)
                    if not any(rec["run_id"] == row["run_id"] for rec in records):
                        records.append(row)
                except Exception as e:
                    print(f"WARN: skipping raw line: {e}", file=sys.stderr)

    if not records:
        print("ERROR: no records found", file=sys.stderr)
        sys.exit(1)

    df = pd.DataFrame(records)

    # Add task metadata
    df["category"]       = df["task_id"].map(lambda t: TASK_META.get(t, {}).get("category", "unknown"))
    df["difficulty"]     = df["task_id"].map(lambda t: TASK_META.get(t, {}).get("difficulty", "unknown"))
    df["difficulty_num"] = df["difficulty"].map(DIFFICULTY_ORDER)

    # Ordered categoricals for plotting
    df["env_id"] = pd.Categorical(df["env_id"], categories=ENV_ORDER, ordered=True)

    # Binary success
    df["success"] = (df["score_automated"] == 1.0).astype(int)

    df.to_parquet(args.output, index=False)
    print(f"Dataset: {len(df)} rows → {args.output}")
    print(df[["env_id", "task_id", "agent_id", "score_automated", "total_input"]].to_string(index=False))


if __name__ == "__main__":
    main()
