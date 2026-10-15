#!/usr/bin/env python3
"""
headline_figure.py — the clean "token cost by environment" story figure.

Bars = total input tokens per environment; overlaid line = cache-adjusted
"effective" tokens; each bar annotated with % change vs E0 and mean score.
Outputs PNG + PDF to the figures dir and SVG to figures/svg/ for papers.

Usage:
  python3 analysis/scripts/headline_figure.py \
    --dataset results/processed/dataset.parquet \
    --output-dir results/processed/figures \
    [--task T01]    # restrict to one task; default = all tasks pooled
"""
import argparse
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ENV_ORDER = ["E0", "E1", "E2", "E3", "E4", "E5"]
LABELS = {"E0": "E0\nEmpty", "E1": "E1\n+README", "E2": "E2\n+AGENTS",
          "E3": "E3\n+PROJECT", "E4": "E4\nFull XO", "E5": "E5\n+XO+Mem"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="results/processed/dataset.parquet")
    ap.add_argument("--output-dir", default="results/processed/figures")
    ap.add_argument("--task", default=None)
    args = ap.parse_args()

    df = pd.read_parquet(args.dataset)
    if args.task:
        df = df[df["task_id"] == args.task]
    df = df.copy()
    df["total_effective"] = df["total_effective"].astype(float)

    order = [e for e in ENV_ORDER if e in set(df["env_id"].astype(str))]
    g = (df.groupby(df["env_id"].astype(str))
           .agg(inp=("total_input", "mean"), eff=("total_effective", "mean"),
                score=("score_automated", "mean"), n=("total_input", "size"))
           .reindex(order))

    x = np.arange(len(g))
    inp = g["inp"] / 1e6
    eff = g["eff"] / 1e6
    base = inp.iloc[0]
    agents = ", ".join(sorted(df["agent_id"].unique()))
    scope = args.task if args.task else f"{df['task_id'].nunique()} tasks pooled"

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.bar(x, inp, width=0.6, color="#4C78A8", zorder=3, label="Total input tokens")
    ax.plot(x, eff, "o-", color="#E45756", lw=2.5, ms=8, zorder=4,
            label="Effective (cache-adjusted)")

    for i, (v, e, sc) in enumerate(zip(inp, eff, g["score"])):
        pct = (v - base) / base * 100
        tag = f"{v:.2f}M" + ("" if i == 0 else f"\n({pct:+.0f}% vs E0)")
        ax.text(i, v + inp.max() * 0.02, tag, ha="center", va="bottom",
                fontsize=10, fontweight="bold")
        ax.text(i, e - eff.max() * 0.05, f"{e*1000:.0f}K", ha="center", va="top",
                fontsize=8.5, color="#E45756")
        if pd.notna(sc):
            ax.text(i, inp.max() * 0.03, f"score {sc:.1f}", ha="center", va="bottom",
                    fontsize=9, color="white", fontweight="bold", zorder=5)

    ax.set_xticks(x)
    ax.set_xticklabels([LABELS.get(e, e) for e in order], fontsize=11)
    ax.set_ylabel("Tokens (millions)", fontsize=12)
    ax.set_title(f"Richer project context → fewer tokens, no loss of success\n"
                 f"{scope}, {agents}", fontsize=14, fontweight="bold")
    ax.legend(loc="upper right", fontsize=10, framealpha=0.95)
    ax.set_ylim(0, inp.max() * 1.18)
    ax.grid(axis="y", alpha=0.3, zorder=0)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)

    red = (1 - inp.iloc[-1] / base) * 100
    ns = ", ".join(f"{e}:n={int(g.loc[e,'n'])}" for e in order)
    fig.text(0.5, -0.02,
             f"E0→{order[-1]}: input tokens {-red:.0f}%  •  mean score "
             f"{df['score_automated'].mean():.2f}  •  {ns}",
             ha="center", fontsize=9, style="italic", color="#555")

    plt.tight_layout()
    out = Path(args.output_dir)
    (out / "svg").mkdir(parents=True, exist_ok=True)
    stem = f"headline_{args.task if args.task else 'all_tasks'}_token_cost"
    fig.savefig(out / f"{stem}.png", dpi=130, bbox_inches="tight")
    fig.savefig(out / f"{stem}.pdf", bbox_inches="tight")
    fig.savefig(out / "svg" / f"{stem}.svg", bbox_inches="tight")
    plt.close(fig)
    print(f"{stem} written ({scope})")
    print(g.assign(inp_M=(g.inp/1e6).round(2), eff_K=(g.eff/1e3).round(0))
            [["inp_M", "eff_K", "score", "n"]].to_string())


if __name__ == "__main__":
    main()
