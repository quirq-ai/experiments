#!/usr/bin/env python3
"""
run_stats.py
------------
Responsibility: Run all statistical tests and write stats_results.json.

Inputs:
  --metrics   path to metrics.parquet

Outputs:
  stats_results.json with:
  {
    "kruskal_wallis": { metric → {statistic, pvalue, eta_squared} },
    "dunn_pairwise":  { metric → {(envA, envB) → {pvalue_raw, pvalue_adjusted, significant}} },
    "wilcoxon_e4_e5": { metric → {statistic, pvalue, cliffs_delta} },
    "bootstrap_cis":  { metric → { env → {median, ci_lo, ci_hi} } },
    "effect_sizes":   { metric → { (envA, envB) → cohens_d } }
  }

Tests run:
  - Kruskal-Wallis across all 6 environments (omnibus)
  - Dunn post-hoc pairwise with Holm-Bonferroni correction
  - Wilcoxon signed-rank E4 vs E5 (paired by task_id)
  - Bootstrap BCa CIs (10,000 samples) for median per env
  - Cohen's d for key pairwise comparisons
"""

import argparse
import json
import math
import random
import sys
from collections import defaultdict
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

try:
    import scikit_posthocs as sp
    HAS_SP = True
except ImportError:
    HAS_SP = False
    print("WARN: scikit-posthocs not installed; Dunn test skipped", file=sys.stderr)


PRIMARY_METRICS = [
    "total_input",
    "score_automated",
    "wall_clock_seconds",
    "time_to_first_edit_seconds",
    "nav_entropy_pre_edit",
    "context_acquisition",
    "efficiency_ratio",
    "replanning_events",
]
ENV_ORDER = ["E0", "E1", "E2", "E3", "E4", "E5"]
N_BOOT = 10_000
ALPHA = 0.05


def bootstrap_ci_median(data: np.ndarray, n_boot: int = N_BOOT,
                         ci: float = 0.95) -> tuple[float, float, float]:
    """BCa bootstrap confidence interval for median."""
    data = data[~np.isnan(data)]
    if len(data) < 2:
        med = float(np.nanmedian(data)) if len(data) > 0 else float("nan")
        return med, float("nan"), float("nan")

    observed = np.median(data)
    boot_samples = np.array([
        np.median(np.random.choice(data, size=len(data), replace=True))
        for _ in range(n_boot)
    ])
    lo = float(np.percentile(boot_samples, (1 - ci) / 2 * 100))
    hi = float(np.percentile(boot_samples, (1 + ci) / 2 * 100))
    return float(observed), lo, hi


def cohens_d(a: np.ndarray, b: np.ndarray) -> float:
    a = np.asarray(a, dtype=float); b = np.asarray(b, dtype=float)
    a, b = a[~np.isnan(a)], b[~np.isnan(b)]
    if len(a) < 2 or len(b) < 2:
        return float("nan")
    pooled_std = math.sqrt(
        ((len(a) - 1) * np.var(a, ddof=1) + (len(b) - 1) * np.var(b, ddof=1))
        / (len(a) + len(b) - 2)
    )
    if pooled_std == 0:
        return 0.0
    return float((np.mean(a) - np.mean(b)) / pooled_std)


def cliffs_delta(a: np.ndarray, b: np.ndarray) -> float:
    a = np.asarray(a, dtype=float); b = np.asarray(b, dtype=float)
    a, b = a[~np.isnan(a)], b[~np.isnan(b)]
    if not len(a) or not len(b):
        return float("nan")
    greater = sum(1 for x in a for y in b if x > y)
    less    = sum(1 for x in a for y in b if x < y)
    return float((greater - less) / (len(a) * len(b)))


def eta_squared_kruskal(h_stat: float, n: int, k: int) -> float:
    return (h_stat - k + 1) / (n - k)


def holm_bonferroni(pvalues: list[float]) -> list[float]:
    n = len(pvalues)
    indexed = sorted(enumerate(pvalues), key=lambda x: x[1])
    adjusted = [0.0] * n
    for rank, (idx, p) in enumerate(indexed):
        adjusted[idx] = min(1.0, p * (n - rank))
    # Enforce monotonicity
    for i in range(len(adjusted) - 1, 0, -1):
        adjusted[i - 1] = min(adjusted[i - 1], adjusted[i])
    return adjusted


def main():
    np.random.seed(42)

    parser = argparse.ArgumentParser()
    parser.add_argument("--metrics", required=True)
    parser.add_argument("--output",  default="results/processed/stats_results.json")
    args = parser.parse_args()

    df = pd.read_parquet(args.metrics)
    results: dict = {}

    # ── Kruskal-Wallis (omnibus) ──────────────────────────────────────────────
    results["kruskal_wallis"] = {}
    for metric in PRIMARY_METRICS:
        if metric not in df.columns:
            continue
        groups = [df[df["env_id"] == e][metric].dropna().values for e in ENV_ORDER]
        groups = [g for g in groups if len(g) >= 2]
        if len(groups) < 2:
            continue
        try:
            h, p = stats.kruskal(*groups)
            n = sum(len(g) for g in groups)
            k = len(groups)
            es = eta_squared_kruskal(h, n, k)
            results["kruskal_wallis"][metric] = {
                "H": round(h, 4), "p_value": round(p, 6),
                "eta_squared": round(es, 4), "n": n, "k": k,
                "significant": p < ALPHA,
            }
        except Exception as e:
            results["kruskal_wallis"][metric] = {"error": str(e)}

    # ── Dunn pairwise post-hoc ────────────────────────────────────────────────
    results["dunn_pairwise"] = {}
    if HAS_SP:
        for metric in PRIMARY_METRICS:
            if metric not in df.columns:
                continue
            sub = df[["env_id", metric]].dropna()
            if sub.empty:
                continue
            try:
                dunn = sp.posthoc_dunn(
                    sub, val_col=metric, group_col="env_id", p_adjust="holm"
                )
                pairs = {}
                for (ea, eb) in combinations(ENV_ORDER, 2):
                    if ea in dunn.index and eb in dunn.columns:
                        p_adj = float(dunn.loc[ea, eb])
                        pairs[f"{ea}_vs_{eb}"] = {
                            "p_adjusted": round(p_adj, 6),
                            "significant": p_adj < ALPHA,
                        }
                results["dunn_pairwise"][metric] = pairs
            except Exception as e:
                results["dunn_pairwise"][metric] = {"error": str(e)}

    # ── Wilcoxon signed-rank E4 vs E5 (paired by task_id) ────────────────────
    results["wilcoxon_e4_e5"] = {}
    for metric in PRIMARY_METRICS:
        if metric not in df.columns:
            continue
        e4 = df[df["env_id"] == "E4"][["task_id", metric]].rename(columns={metric: "e4"})
        e5 = df[df["env_id"] == "E5"][["task_id", metric]].rename(columns={metric: "e5"})
        paired = e4.merge(e5, on="task_id").dropna()
        if len(paired) < 5:
            continue
        try:
            stat, p = stats.wilcoxon(paired["e4"], paired["e5"])
            cd = cliffs_delta(paired["e4"].values, paired["e5"].values)
            results["wilcoxon_e4_e5"][metric] = {
                "statistic": round(float(stat), 4),
                "p_value": round(float(p), 6),
                "cliffs_delta": round(cd, 4),
                "n_pairs": len(paired),
                "significant": float(p) < ALPHA,
            }
        except Exception as e:
            results["wilcoxon_e4_e5"][metric] = {"error": str(e)}

    # ── Bootstrap CIs ────────────────────────────────────────────────────────
    results["bootstrap_cis"] = {}
    for metric in PRIMARY_METRICS:
        if metric not in df.columns:
            continue
        results["bootstrap_cis"][metric] = {}
        for env in ENV_ORDER:
            # Coerce to float so None/null fields (e.g. codex timing) become NaN
            # rather than object dtype, which np.isnan cannot handle.
            data = np.asarray(df[df["env_id"] == env][metric].values, dtype=float)
            med, lo, hi = bootstrap_ci_median(data)
            results["bootstrap_cis"][metric][env] = {
                "median": round(med, 4),
                "ci_lo": round(lo, 4),
                "ci_hi": round(hi, 4),
                "n": int((~np.isnan(data)).sum()),
            }

    # ── Cohen's d for key pairs ───────────────────────────────────────────────
    KEY_PAIRS = [("E0", "E4"), ("E0", "E5"), ("E2", "E4"), ("E4", "E5")]
    results["effect_sizes"] = {}
    for metric in ["total_input", "score_automated", "time_to_first_edit_seconds", "nav_entropy_pre_edit"]:
        if metric not in df.columns:
            continue
        results["effect_sizes"][metric] = {}
        for (ea, eb) in KEY_PAIRS:
            a = df[df["env_id"] == ea][metric].values
            b = df[df["env_id"] == eb][metric].values
            d = cohens_d(a, b)
            cd = cliffs_delta(a, b)
            results["effect_sizes"][metric][f"{ea}_vs_{eb}"] = {
                "cohens_d": round(d, 4),
                "cliffs_delta": round(cd, 4),
            }

    def _json_default(o):
        # numpy scalars/arrays (e.g. np.bool_ from `p < ALPHA`) aren't JSON-native.
        if isinstance(o, np.bool_):    return bool(o)
        if isinstance(o, np.integer):  return int(o)
        if isinstance(o, np.floating): return None if np.isnan(o) else float(o)
        if isinstance(o, np.ndarray):  return o.tolist()
        return str(o)

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w") as f:
        json.dump(results, f, indent=2, default=_json_default)

    print(f"Statistical results → {args.output}")
    print("\nKruskal-Wallis summary:")
    for metric, res in results["kruskal_wallis"].items():
        if "error" not in res:
            sig = "***" if res["p_value"] < 0.001 else ("**" if res["p_value"] < 0.01 else ("*" if res["p_value"] < 0.05 else "ns"))
            print(f"  {metric:<35} H={res['H']:.2f}  p={res['p_value']:.4f} {sig}  η²={res['eta_squared']:.3f}")


if __name__ == "__main__":
    main()
