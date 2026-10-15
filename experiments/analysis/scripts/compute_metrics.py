#!/usr/bin/env python3
"""
compute_metrics.py
------------------
Responsibility: Load dataset.parquet, compute all derived metrics,
                save metrics.parquet.

Inputs:
  --dataset   path to dataset.parquet

Outputs:
  metrics.parquet — dataset.parquet + derived metric columns

Derived columns added:
  efficiency_ratio        score_automated / log2(1 + total_input)
  nav_efficiency          files_edited_count / file_reads_total (or 0 if 0 reads)
  opts                    phase_orient_input / total_input (orientation phase token share)
  replanning_rate         replanning_events / (wall_clock_seconds / 3600)
  memory_utilization_rate (memory_reads + memory_writes) / tool_calls_total
  total_token_cost        total_input + total_output
  cac_ratio               context_acquisition / total_input
  log_total_input         log2(1 + total_input)
"""

import argparse
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd


def efficiency_ratio(row) -> float | None:
    score = row["score_automated"]
    tokens = row["total_input"]
    if score is None or tokens is None or tokens <= 0:
        return None
    return score / math.log2(1 + tokens)


def nav_efficiency(row) -> float | None:
    reads = row["file_reads_total"]
    edits = row["files_edited_count"]
    if reads == 0:
        return 0.0
    return edits / reads


def opts(row) -> float | None:
    orient = row.get("phase_orient_input")
    total = row["total_input"]
    if orient is None or total is None or total == 0:
        return None
    return orient / total


def replanning_rate(row) -> float | None:
    events = row["replanning_events"]
    wct = row["wall_clock_seconds"]
    if wct is None or wct <= 0:
        return None
    return events / (wct / 3600)


def memory_utilization_rate(row) -> float | None:
    total_tools = row["tool_calls_total"]
    if total_tools == 0:
        return 0.0
    return (row["memory_reads"] + row["memory_writes"]) / total_tools


def cac_ratio(row) -> float | None:
    cac = row["context_acquisition"]
    total = row["total_input"]
    if total is None or total == 0:
        return None
    return cac / total


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--output",  default=None)
    args = parser.parse_args()

    dataset_path = Path(args.dataset)
    output_path = Path(args.output) if args.output else dataset_path.parent / "metrics.parquet"

    df = pd.read_parquet(dataset_path)

    df["total_token_cost"]        = df["total_input"] + df["total_output"]
    df["log_total_input"]         = np.log2(1 + df["total_input"].fillna(0))
    df["efficiency_ratio"]        = df.apply(efficiency_ratio, axis=1)
    df["nav_efficiency"]          = df.apply(nav_efficiency, axis=1)
    df["opts"]                    = df.apply(opts, axis=1)
    df["replanning_rate"]         = df.apply(replanning_rate, axis=1)
    df["memory_utilization_rate"] = df.apply(memory_utilization_rate, axis=1)
    df["cac_ratio"]               = df.apply(cac_ratio, axis=1)

    df.to_parquet(output_path, index=False)
    print(f"Metrics parquet: {len(df)} rows → {output_path}")

    # Summary by environment
    summary = df.groupby("env_id").agg(
        n=("run_id", "count"),
        median_tokens=("total_input", "median"),
        mean_score=("score_automated", "mean"),
        median_ttfua=("time_to_first_edit_seconds", "median"),
        median_nav_entropy=("nav_entropy_pre_edit", "median"),
        mean_efficiency_ratio=("efficiency_ratio", "mean"),
    ).round(3)
    print("\nSummary by environment:")
    print(summary.to_string())


if __name__ == "__main__":
    main()
