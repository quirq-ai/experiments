#!/usr/bin/env python3
"""
gen_figures.py
--------------
Responsibility: Generate the figure set from metrics.parquet + stats_results.json,
                once over ALL data and once per task.

Inputs:
  --metrics       path to metrics.parquet
  --stats         path to stats_results.json
  --output-dir    base figures dir (default results/processed/figures)
  --runs-dir      runs/ dir (fig05/fig11/fig12 read event_log.jsonl + run_record.json)

Outputs (under --output-dir):
  full/           figures pooled across all tasks
  <TASK>/         one folder per task (T01, T02, ...) with that task's figures
  each folder contains PNG + PDF, plus an svg/ subfolder (vector, for papers):
    fig00_headline_token_cost   bar(input) + line(cache-adjusted) + score
    fig01_token_cost_by_env     fig02_success_rate_by_env
    fig03_ttfua_cdf             (N/A for codex — no timestamps)
    fig04_nav_entropy_vs_tokens fig05_phase_activity_share (tool-call share per phase)
    fig06_nav_entropy_distribution  fig07_efficiency_ratio_by_difficulty
    fig08_memory_utilization    fig09_replanning_frequency
    fig10_agent_comparison      fig11_token_curve (N/A for codex — single-turn tokens)
    fig12_file_heatmap          (files read × environment, from files_read_sequence)
"""

import argparse
import json
import warnings
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np
import pandas as pd
import seaborn as sns

warnings.filterwarnings("ignore")

ENV_ORDER   = ["E0", "E1", "E2", "E3", "E4", "E5"]
ENV_LABELS  = {"E0": "E0\nEmpty", "E1": "E1\nREADME", "E2": "E2\nAGENTS",
               "E3": "E3\nAGENTS\n+PROJECT", "E4": "E4\nFull XO", "E5": "E5\nXO+Mem"}
ENV_PALETTE = sns.color_palette("Blues_d", n_colors=6)
FIGSIZE_WIDE = (10, 5)
FIGSIZE_SQ   = (7, 6)
DPI          = 150
RUNS_DIR     = Path("runs")   # set from --runs-dir in main(); used by fig05


def save(fig, name: str, out_dir: Path):
    # PNG + PDF in the main dir (quick view / general use); SVG in svg/ for papers.
    svg_dir = out_dir / "svg"
    svg_dir.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_dir / f"{name}.png", bbox_inches="tight", dpi=DPI)
    fig.savefig(out_dir / f"{name}.pdf", bbox_inches="tight")
    fig.savefig(svg_dir / f"{name}.svg", bbox_inches="tight")
    plt.close(fig)
    print(f"  {name}")


def sig_label(stats: dict, metric: str, ea: str, eb: str) -> str:
    key = f"{ea}_vs_{eb}"
    try:
        p = stats["dunn_pairwise"][metric][key]["p_adjusted"]
        if p < 0.001: return "***"
        if p < 0.01:  return "**"
        if p < 0.05:  return "*"
    except (KeyError, TypeError):
        pass
    return ""


# ── Figure 0: Headline token-cost bars (+ cache-adjusted line) ────────────────
def fig00_headline(df: pd.DataFrame, stats: dict, out: Path):
    d = df.copy()
    d["total_effective"] = d["total_effective"].astype(float)
    order = [e for e in ENV_ORDER if e in set(d["env_id"].astype(str))]
    if not order:
        return
    g = (d.groupby(d["env_id"].astype(str))
           .agg(inp=("total_input", "mean"), eff=("total_effective", "mean"),
                score=("score_automated", "mean"), n=("total_input", "size"))
           .reindex(order))
    x = np.arange(len(g)); inp = g["inp"] / 1e6; eff = g["eff"] / 1e6
    base = inp.iloc[0]
    tasks = sorted(d["task_id"].dropna().unique())
    scope = tasks[0] if len(tasks) == 1 else f"{len(tasks)} tasks pooled"

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.bar(x, inp, width=0.6, color="#4C78A8", zorder=3, label="Total input tokens")
    ax.plot(x, eff, "o-", color="#E45756", lw=2.5, ms=8, zorder=4, label="Effective (cache-adjusted)")
    for i, (v, e, sc) in enumerate(zip(inp, eff, g["score"])):
        pct = (v - base) / base * 100
        ax.text(i, v + inp.max() * 0.02, f"{v:.2f}M" + ("" if i == 0 else f"\n({pct:+.0f}%)"),
                ha="center", va="bottom", fontsize=9.5, fontweight="bold")
        if pd.notna(sc):
            ax.text(i, inp.max() * 0.03, f"{sc:.2f}", ha="center", va="bottom",
                    fontsize=8.5, color="white", fontweight="bold", zorder=5)
    ax.set_xticks(x); ax.set_xticklabels([ENV_LABELS[e] for e in order], fontsize=9)
    ax.set_ylabel("Tokens (millions)"); ax.set_ylim(0, inp.max() * 1.18)
    ax.set_title(f"Token cost by environment — {scope}, codex\n"
                 "(bar = input tokens; line = cache-adjusted; white = mean score)",
                 fontweight="bold", fontsize=12)
    ax.legend(loc="upper right", fontsize=9)
    ax.grid(axis="y", alpha=0.3, zorder=0)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    save(fig, "fig00_headline_token_cost", out)


# ── Figure 1: Token cost violin ───────────────────────────────────────────────
def fig01(df: pd.DataFrame, stats: dict, out: Path):
    fig, axes = plt.subplots(1, 2, figsize=(12, 5), sharey=True)
    for ax, agent in zip(axes, df["agent_id"].unique()[:2]):
        sub = df[df["agent_id"] == agent].copy()
        sub["log_tokens"] = np.log2(1 + sub["total_input"].fillna(0))
        sns.violinplot(data=sub, x="env_id", y="log_tokens", order=ENV_ORDER,
                       palette=ENV_PALETTE, inner="box", ax=ax)
        ax.set_title(agent)
        ax.set_xlabel("Environment")
        ax.set_ylabel("log₂(input tokens)" if ax == axes[0] else "")
        ax.set_xticklabels([ENV_LABELS[e] for e in ENV_ORDER], fontsize=8)
    fig.suptitle("Figure 1 — Token Cost by Environment", fontweight="bold")
    save(fig, "fig01_token_cost_by_env", out)


# ── Figure 2: Success rate bar ────────────────────────────────────────────────
def fig02(df: pd.DataFrame, stats: dict, out: Path):
    from statsmodels.stats.proportion import proportion_confint
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    env_data = []
    for env in ENV_ORDER:
        sub = df[df["env_id"] == env]["success"].dropna()
        if len(sub) == 0: continue
        k = sub.sum(); n = len(sub)
        lo, hi = proportion_confint(k, n, method="wilson")
        env_data.append({"env": env, "rate": k/n, "lo": lo, "hi": hi, "n": n})
    edf = pd.DataFrame(env_data)
    ax.bar(edf["env"], edf["rate"], color=ENV_PALETTE[:len(edf)], alpha=0.85, width=0.6)
    ax.errorbar(edf["env"], edf["rate"],
                yerr=[edf["rate"]-edf["lo"], edf["hi"]-edf["rate"]],
                fmt="none", color="black", capsize=4, linewidth=1.5)
    for _, row in edf.iterrows():
        ax.text(row["env"], row["rate"] + 0.03, f"n={int(row['n'])}", ha="center", fontsize=8)
    ax.set_ylim(0, 1.15)
    ax.set_ylabel("Automated AC Pass Rate")
    ax.set_xlabel("Environment")
    ax.set_title("Figure 2 — Task Success Rate by Environment", fontweight="bold")
    save(fig, "fig02_success_rate_by_env", out)


# ── Figure 3: TTFUA CDF ───────────────────────────────────────────────────────
def fig03(df: pd.DataFrame, stats: dict, out: Path):
    if not df["time_to_first_edit_seconds"].notna().any():
        fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
        ax.text(0.5, 0.5, "Time-to-first-edit needs per-event timestamps.\n"
                "Unavailable for codex (no timestamps in its transcript);\n"
                "auto-populates once claude runs are added.",
                ha="center", va="center", transform=ax.transAxes, color="gray")
        ax.set_title("Figure 3 — Time to First Useful Action (N/A for codex)", fontweight="bold")
        save(fig, "fig03_ttfua_cdf", out)
        return
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    for i, env in enumerate(ENV_ORDER):
        data = df[df["env_id"] == env]["time_to_first_edit_seconds"].dropna().sort_values()
        if data.empty: continue
        y = np.arange(1, len(data) + 1) / len(data)
        ax.step(data.values, y, label=env, color=ENV_PALETTE[i], linewidth=2)
    ax.set_xlabel("Time to First Edit (seconds)")
    ax.set_ylabel("Cumulative Proportion of Runs")
    ax.legend(title="Environment")
    ax.set_title("Figure 3 — Time to First Useful Action: CDF by Environment", fontweight="bold")
    save(fig, "fig03_ttfua_cdf", out)


# ── Figure 4: Nav entropy vs tokens scatter ───────────────────────────────────
def fig04(df: pd.DataFrame, stats: dict, out: Path):
    fig, ax = plt.subplots(figsize=FIGSIZE_SQ)
    markers = {"completed": "o", "partial": "s", "failed": "x", "timeout": "^", "error": "D"}
    for i, env in enumerate(ENV_ORDER):
        sub = df[df["env_id"] == env].dropna(subset=["nav_entropy_pre_edit", "total_input"])
        if sub.empty: continue
        for state, grp in sub.groupby("terminal_state"):
            ax.scatter(grp["nav_entropy_pre_edit"], np.log2(1 + grp["total_input"]),
                       color=ENV_PALETTE[i], marker=markers.get(state, "o"),
                       alpha=0.7, s=40, label=f"{env} ({state})")
    # Linear regression across all
    valid = df.dropna(subset=["nav_entropy_pre_edit", "total_input"])
    if len(valid) > 3:
        x = valid["nav_entropy_pre_edit"].values
        y = np.log2(1 + valid["total_input"].values)
        m, b = np.polyfit(x, y, 1)
        xr = np.linspace(x.min(), x.max(), 100)
        ax.plot(xr, m * xr + b, "k--", linewidth=1.5, label=f"OLS (slope={m:.2f})")
    ax.set_xlabel("Navigation Entropy (pre-edit)")
    ax.set_ylabel("log₂(input tokens)")
    ax.set_title("Figure 4 — Navigation Entropy vs Token Cost", fontweight="bold")
    ax.legend(fontsize=7, ncol=2)
    save(fig, "fig04_nav_entropy_vs_tokens", out)


# ── Figure 5: Phase activity share stacked bar ────────────────────────────────
# Token-level phase split is unavailable for single-turn agents (codex reports
# all tokens in one end-of-turn event → 100% orientation). Instead we show the
# share of TOOL CALLS in each phase, computed from event_log.jsonl, which is
# well-defined for any agent and captures orientation overhead by environment.
def _phase_activity_share(run_id: str):
    p = RUNS_DIR / run_id / "event_log.jsonl"
    if not p.exists():
        return None
    rows = [json.loads(l) for l in p.read_text().splitlines() if l.strip()]
    tools = [r for r in rows if r.get("tool")]
    edits = [r["seq"] for r in rows if r.get("is_edit")]
    if not tools or not edits:
        return None
    fe, le = edits[0], edits[-1]
    o = sum(1 for r in tools if r["seq"] < fe)
    i = sum(1 for r in tools if fe <= r["seq"] <= le)
    v = sum(1 for r in tools if r["seq"] > le)
    tot = o + i + v
    return None if tot == 0 else (o / tot, i / tot, v / tot)


def fig05(df: pd.DataFrame, stats: dict, out: Path):
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    labels = ["Orientation", "Implementation", "Verification"]
    colors = ["#d62728", "#1f77b4", "#2ca02c"]
    env_share, env_n = {}, {}
    for env in ENV_ORDER:
        runs = df[df["env_id"] == env]["run_id"].tolist()
        shares = [s for rid in runs if (s := _phase_activity_share(rid)) is not None]
        if shares:
            env_share[env] = np.mean(np.array(shares), axis=0)  # mean preserves sum=1
            env_n[env] = len(shares)
    envs = [e for e in ENV_ORDER if e in env_share]
    if not envs:
        ax.text(0.5, 0.5, "No event_log.jsonl files found.\nPass --runs-dir.",
                ha="center", va="center", transform=ax.transAxes, color="gray")
        save(fig, "fig05_phase_activity_share", out)
        return
    bottom = np.zeros(len(envs))
    for j, (label, color) in enumerate(zip(labels, colors)):
        vals = np.array([env_share[e][j] for e in envs])
        ax.bar(envs, vals, bottom=bottom, label=label, color=color, alpha=0.85)
        bottom += vals
    for k, e in enumerate(envs):
        ax.text(k, 1.02, f"n={env_n[e]}", ha="center", fontsize=8, color="#555")
    ax.set_ylim(0, 1.12)
    ax.set_ylabel("Share of tool calls")
    ax.set_xlabel("Environment")
    ax.legend(loc="lower right", fontsize=8, framealpha=0.95)
    ax.set_title("Figure 5 — Phase Activity Share (tool calls)\n"
                 "token-level split N/A for single-turn agents (codex)",
                 fontweight="bold", fontsize=11)
    save(fig, "fig05_phase_activity_share", out)


# ── Figure 6: Nav entropy box plot ────────────────────────────────────────────
def fig06(df: pd.DataFrame, stats: dict, out: Path):
    fig, ax = plt.subplots(figsize=FIGSIZE_SQ)
    sns.boxplot(data=df, x="env_id", y="nav_entropy_pre_edit", order=ENV_ORDER,
                palette=ENV_PALETTE, ax=ax)
    sns.stripplot(data=df, x="env_id", y="nav_entropy_pre_edit", order=ENV_ORDER,
                  color="black", alpha=0.4, size=3, jitter=True, ax=ax)
    ax.set_xlabel("Environment")
    ax.set_ylabel("Navigation Entropy (pre-edit)")
    ax.set_title("Figure 6 — Navigation Entropy Distribution by Environment", fontweight="bold")
    save(fig, "fig06_nav_entropy_distribution", out)


# ── Figure 7: Efficiency ratio by difficulty ──────────────────────────────────
def fig07(df: pd.DataFrame, stats: dict, out: Path):
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    sub = df.dropna(subset=["efficiency_ratio"])
    pivot = sub.groupby(["env_id", "difficulty"])["efficiency_ratio"].median().reset_index()
    width = 0.25
    difficulties = ["easy", "medium", "hard"]
    diff_colors = ["#aec7e8", "#1f77b4", "#17becf"]
    x = np.arange(len(ENV_ORDER))
    for i, (diff, color) in enumerate(zip(difficulties, diff_colors)):
        vals = [
            pivot[(pivot["env_id"] == e) & (pivot["difficulty"] == diff)]["efficiency_ratio"].values
            for e in ENV_ORDER
        ]
        heights = [float(v[0]) if len(v) > 0 else 0.0 for v in vals]
        ax.bar(x + i * width, heights, width, label=diff.capitalize(), color=color, alpha=0.9)
    ax.set_xticks(x + width)
    ax.set_xticklabels(ENV_ORDER)
    ax.set_xlabel("Environment")
    ax.set_ylabel("Efficiency Ratio (median)")
    ax.legend(title="Difficulty")
    ax.set_title("Figure 7 — Efficiency Ratio by Environment and Task Difficulty", fontweight="bold")
    save(fig, "fig07_efficiency_ratio_by_difficulty", out)


# ── Figure 8: Memory utilization E4 vs E5 ────────────────────────────────────
def fig08(df: pd.DataFrame, stats: dict, out: Path):
    fig, ax = plt.subplots(figsize=(6, 5))
    sub = df[df["env_id"].isin(["E4", "E5"])]
    mem_cols = ["memory_reads", "memory_writes"]
    agg = sub.groupby("env_id")[mem_cols].median().reindex(["E4", "E5"])
    bottom = np.zeros(2)
    colors = ["#6baed6", "#2171b5"]
    for col, color in zip(mem_cols, colors):
        vals = agg[col].fillna(0).values
        ax.bar(["E4", "E5"], vals, bottom=bottom,
               label=col.replace("_", " ").title(), color=color, alpha=0.85)
        bottom += vals
    ax.set_xlabel("Environment")
    ax.set_ylabel("Median Operation Count")
    ax.legend()
    ax.set_title("Figure 8 — Memory Utilization: E4 vs E5", fontweight="bold")
    save(fig, "fig08_memory_utilization", out)


# ── Figure 9: Replanning frequency ───────────────────────────────────────────
def fig09(df: pd.DataFrame, stats: dict, out: Path):
    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    agg = df.groupby("env_id")["replanning_events"].median().reindex(ENV_ORDER)
    ax.bar(ENV_ORDER, agg.values, color=ENV_PALETTE, alpha=0.85)
    for env in ENV_ORDER:
        sub = df[df["env_id"] == env]["replanning_events"].dropna()
        ax.scatter([env] * len(sub), sub.values, color="black", alpha=0.35, s=20, zorder=5)
    ax.set_xlabel("Environment")
    ax.set_ylabel("Replanning Events (median + all runs)")
    ax.set_title("Figure 9 — Replanning Frequency by Environment", fontweight="bold")
    save(fig, "fig09_replanning_frequency", out)


# ── Figure 10: Agent comparison ────────────────────────────────────────────────
def fig10(df: pd.DataFrame, stats: dict, out: Path):
    fig, ax1 = plt.subplots(figsize=FIGSIZE_WIDE)
    ax2 = ax1.twinx()
    agents = df["agent_id"].unique()
    colors = ["#1f77b4", "#ff7f0e"]
    for agent, color in zip(agents, colors):
        sub = df[df["agent_id"] == agent]
        tok = sub.groupby("env_id")["total_input"].median().reindex(ENV_ORDER)
        sr  = sub.groupby("env_id")["score_automated"].mean().reindex(ENV_ORDER)
        ax1.plot(ENV_ORDER, tok.values, "o-", color=color, label=f"{agent} tokens", linewidth=2)
        ax2.plot(ENV_ORDER, sr.values, "s--", color=color, alpha=0.6, label=f"{agent} SR", linewidth=1.5)
    ax1.set_xlabel("Environment")
    ax1.set_ylabel("Median Input Tokens")
    ax2.set_ylabel("Mean Success Rate")
    ax2.set_ylim(0, 1.1)
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, fontsize=8)
    ax1.set_title("Figure 10 — Agent Comparison Across Environments", fontweight="bold")
    save(fig, "fig10_agent_comparison", out)


# ── Figure 11: Cumulative token curve ─────────────────────────────────────────
# Reads token_curve [[seq, cumulative_input], ...] from each run_record. For
# single-turn agents (codex) the curve is flat-then-spike (all tokens land in one
# end-of-turn event), which carries no shape — so we detect that and show a note.
# It auto-activates for agents with per-message tokens (claude).
def fig11(df: pd.DataFrame, stats: dict, out: Path):
    GRID = np.linspace(0, 1, 21)
    env_curves = {}
    for env in ENV_ORDER:
        curves = []
        for rid in df[df["env_id"] == env]["run_id"]:
            p = RUNS_DIR / rid / "run_record.json"
            if not p.exists():
                continue
            tc = json.loads(p.read_text()).get("token_curve") or []
            pts = [(s, c) for s, c in tc]
            nz = [c for _, c in pts if c > 0]
            if len(pts) < 2 or len(set(nz)) < 2:   # degenerate (flat-then-spike) → skip
                continue
            seqs = np.array([s for s, _ in pts], dtype=float)
            cum = np.array([c for _, c in pts], dtype=float)
            xn = (seqs - seqs.min()) / (seqs.max() - seqs.min())
            yn = cum / cum.max()
            curves.append(np.interp(GRID, xn, yn))
        if curves:
            env_curves[env] = np.median(np.array(curves), axis=0)

    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    if not env_curves:
        ax.text(0.5, 0.5, "Cumulative token curve needs per-message token counts.\n"
                "codex reports a single end-of-turn total (flat-then-spike),\n"
                "so there's no curve to draw; auto-activates for claude.",
                ha="center", va="center", transform=ax.transAxes, color="gray")
        ax.set_title("Figure 11 — Cumulative Token Curve (N/A for codex)", fontweight="bold")
        save(fig, "fig11_token_curve", out)
        return
    for i, env in enumerate(ENV_ORDER):
        if env in env_curves:
            ax.plot(GRID, env_curves[env], color=ENV_PALETTE[i], lw=2, label=env)
    ax.set_xlabel("Normalized progress (message sequence)")
    ax.set_ylabel("Cumulative input tokens (fraction of total)")
    ax.legend(title="Environment", fontsize=8)
    ax.set_title("Figure 11 — Cumulative Token Curve by Environment", fontweight="bold")
    save(fig, "fig11_token_curve", out)


# ── Figure 12: File access heatmap ────────────────────────────────────────────
# Reads files_read_sequence from each run_record (works for codex too — file
# reads come via nav shell commands). Heatmap = top-N files × environment.
def fig12(df: pd.DataFrame, stats: dict, out: Path):
    from collections import Counter, defaultdict
    env_file = defaultdict(Counter)
    for _, row in df.iterrows():
        p = RUNS_DIR / row["run_id"] / "run_record.json"
        if not p.exists():
            continue
        seq = json.loads(p.read_text()).get("navigation", {}).get("files_read_sequence", [])
        for f in seq:
            env_file[str(row["env_id"])][f] += 1

    fig, ax = plt.subplots(figsize=FIGSIZE_WIDE)
    if not env_file:
        ax.text(0.5, 0.5, "No files_read_sequence found in run records.",
                ha="center", va="center", transform=ax.transAxes, color="gray")
        ax.set_title("Figure 12 — File Access Heatmap", fontweight="bold")
        save(fig, "fig12_file_heatmap", out)
        return

    total = Counter()
    for c in env_file.values():
        total.update(c)
    top = [f for f, _ in total.most_common(20)]
    envs = [e for e in ENV_ORDER if e in env_file]
    mat = np.array([[env_file[e].get(f, 0) for e in envs] for f in top])

    fig, ax = plt.subplots(figsize=(max(6, len(envs) * 1.1 + 3), max(4, len(top) * 0.38)))
    sns.heatmap(mat, xticklabels=envs, yticklabels=top, cmap="rocket_r",
                annot=True, fmt="d", linewidths=0.5, ax=ax,
                cbar_kws={"label": "accesses"})
    ax.set_xlabel("Environment")
    ax.set_title("Figure 12 — File Access Frequency (top 20) by Environment", fontweight="bold")
    save(fig, "fig12_file_heatmap", out)


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--metrics",    required=True)
    parser.add_argument("--stats",      default=None)
    parser.add_argument("--output-dir", default="results/processed/figures")
    parser.add_argument("--runs-dir",   default="runs", help="for fig05 phase activity (reads event_log.jsonl)")
    args = parser.parse_args()

    global RUNS_DIR
    RUNS_DIR = Path(args.runs_dir)

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)

    df = pd.read_parquet(args.metrics)
    if "env_id" in df.columns:
        df["env_id"] = pd.Categorical(df["env_id"], categories=ENV_ORDER, ordered=True)

    stats = {}
    if args.stats and Path(args.stats).exists():
        with open(args.stats) as f:
            stats = json.load(f)

    sns.set_theme(style="whitegrid", font_scale=1.0)

    def render_set(sub: pd.DataFrame, target: Path):
        target.mkdir(parents=True, exist_ok=True)
        sub = sub.copy()
        sub["env_id"] = pd.Categorical(sub["env_id"], categories=ENV_ORDER, ordered=True)
        for fn in (fig00_headline, fig01, fig02, fig03, fig04, fig05, fig06,
                   fig07, fig08, fig09, fig10, fig11, fig12):
            try:
                fn(sub, stats, target)
            except Exception as e:  # one bad figure must not kill the set
                print(f"  [skip] {fn.__name__}: {e}")

    # full/ — all tasks pooled
    print("== full (all tasks pooled) ==")
    render_set(df, out / "full")

    # one folder per task
    for task in sorted(df["task_id"].dropna().unique()):
        print(f"== {task} ==")
        render_set(df[df["task_id"] == task], out / task)

    print(f"\nFigures written under: {out}/  (full/ + one folder per task, each with svg/)")


if __name__ == "__main__":
    main()
