#!/usr/bin/env python3
"""
Compare badge vs. no_badge conditions across multiple metrics.

Metrics analyzed:
  - Relative Hypervolume (observed HV / theoretical max HV)
  - Total Formal Evaluation Count
  - Pareto Set Count
  - Design Space Count
  - Total Travel Distance
  - Mean Travel Distance

Usage:
    python compare_conditions.py

Output:
    output/condition_comparison.png   (relative HV boxplot)
    output/metrics_comparison.png     (5-metric mosaic boxplot)
    output/condition_comparison.json  (all test results)
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch
import yaml
from botorch.utils.multi_objective.hypervolume import Hypervolume
from botorch.utils.multi_objective.pareto import is_non_dominated
from scipy.stats import wilcoxon, ttest_rel, shapiro

# ── Paths ──────────────────────────────────────────────────────────────────────
RESULTS_DIR   = Path(__file__).parent / "results"
OUTPUT_DIR    = Path(__file__).parent / "output"
CONFIG_PATH   = Path(__file__).parent.parent / "backend" / "app" / "tasks" / "config.yaml"
OUTPUT_HV     = OUTPUT_DIR / "condition_comparison.png"
OUTPUT_MOSAIC = OUTPUT_DIR / "metrics_comparison.png"
OUTPUT_NASA   = OUTPUT_DIR / "nasa_tlx_comparison.png"
OUTPUT_MTQ    = OUTPUT_DIR / "mtq_comparison.png"
OUTPUT_JSON   = OUTPUT_DIR / "condition_comparison.json"

# ── Constants ────────────────────────────────────────────────────────────────────
REF_POINT      = [0.0, 0.0]
N_SOBOL        = 200_000   # samples for max-HV estimation
ALPHA          = 0.05      # significance level
EXCLUDED_USERS = {"admin"}

# Metrics for mosaic plot: key → axis label
METRICS = {
    "total_formal_evaluation_count": "Total Formal Eval Count",
    "pareto_set_count":              "Pareto Set Count",
    "design_space_count_metric":     "Design Space Count",
    "total_travel_distance":         "Total Travel Distance",
    "mean_travel_distance":          "Mean Travel Distance",
}

# subplot_mosaic layout keys
MOSAIC_LAYOUT = [
    ["total_formal_evaluation_count", "pareto_set_count",         "design_space_count_metric"],
    ["total_travel_distance",          "mean_travel_distance",     "."],
]

# NASA-TLX metrics
NASA_TLX_METRICS = {
    "weighted_tlx":    "Weighted TLX",
    "mental_demand":   "Mental Demand",
    "physical_demand": "Physical Demand",
    "temporal_demand": "Temporal Demand",
    "performance":     "Performance",
    "effort":          "Effort",
    "frustration":     "Frustration",
}

NASA_TLX_LAYOUT = [
    ["weighted_tlx",    "mental_demand",   "physical_demand"],
    ["temporal_demand", "performance",     "effort"],
    ["frustration",     ".",               "."],
]

# MTQ metrics
MTQ_METRICS = {
    "purpose_score":      "Purpose Score",
    "transparency_score": "Transparency Score",
    "utility_score":      "Utility Score",
}

MTQ_LAYOUT = [
    ["purpose_score", "transparency_score", "utility_score"],
]


# ── 1. Load task configs ───────────────────────────────────────────────────────

def load_task_configs(config_path: Path) -> dict[str, dict]:
    """Return {task_id: config_dict} for non-tutorial tasks."""
    with open(config_path) as f:
        raw = yaml.safe_load(f)
    return {
        t["id"]: t
        for t in raw["tasks"]
        if t["id"] != "task_tutorial"
    }


# ── 2. Estimate maximum HV for a task ─────────────────────────────────────────

def _eval_objectives_noiseless(X: np.ndarray, cfg: dict) -> np.ndarray:
    """
    Evaluate noise-free objectives for N x d array X.
    f_j(x) = baseline_j - sum_i weight_ji * (x_i - center_ji)^2
    Returns N x 2 array.
    """
    centers = np.array(cfg["obj_centers"])   # [2, d]
    weights = np.array(cfg["obj_weights"])   # [2, d]
    baselines = np.array(cfg["obj_baselines"])  # [2]

    Y = np.zeros((X.shape[0], 2))
    for j in range(2):
        Y[:, j] = baselines[j] - np.sum(
            weights[j] * (X - centers[j]) ** 2, axis=1
        )
    Y = np.clip(Y, 0.0, 1.0)
    return Y


def estimate_max_hv(cfg: dict, n_samples: int = N_SOBOL) -> float:
    """Estimate theoretical maximum HV via Sobol sampling."""
    d = len(cfg["parameters"])
    sobol = torch.quasirandom.SobolEngine(dimension=d, scramble=True, seed=42)
    X_unit = sobol.draw(n_samples).numpy()   # [N, d]

    # Scale to parameter ranges (all [0,1] in this study)
    ranges = [(p["range"][0], p["range"][1]) for p in cfg["parameters"]]
    X = X_unit * np.array([r[1] - r[0] for r in ranges]) + np.array([r[0] for r in ranges])

    Y = _eval_objectives_noiseless(X, cfg)

    Y_t = torch.tensor(Y, dtype=torch.float64)
    pareto_mask = is_non_dominated(Y_t)
    pareto_Y = Y_t[pareto_mask]

    hv = Hypervolume(torch.tensor(REF_POINT, dtype=torch.float64))
    return float(hv.compute(pareto_Y))


# ── 3. Load session JSON files ─────────────────────────────────────────────────

def load_sessions(results_dir: Path, excluded_users: set[str]) -> list[dict]:
    """
    Load all JSON files, skip excluded users.
    Returns list of dicts with keys: user, session_id, condition, task_id, hv, metrics.
    """
    sessions = []
    for path in sorted(results_dir.glob("*.json")):
        user = path.stem.split("_session")[0]
        if user in excluded_users:
            continue
        with open(path) as f:
            data = json.load(f)
        sessions.append({
            "user":       user,
            "session_id": data["session_id"],
            "condition":  data["condition"],
            "task_id":    data["task_id"],
            "hv":         data["metrics"]["hypervolume"],
            "metrics":    data["metrics"],
            "nasa_tlx":   data.get("nasa_tlx") or {},
            "mtq":        data.get("mtq") or {},
        })
    return sessions


# ── 4. Build paired data ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

def _group_by_user(sessions: list[dict]) -> dict[str, dict[str, dict]]:
    by_user: dict[str, dict[str, dict]] = {}
    for s in sessions:
        by_user.setdefault(s["user"], {})[s["condition"]] = s
    return by_user


def build_paired_data(
    sessions: list[dict],
    max_hv: dict[str, float],
) -> tuple[list[str], list[float], list[float]]:
    """Pair badge / no_badge sessions per user for relative HV."""
    users, badge_vals, no_badge_vals = [], [], []
    for user, conds in sorted(_group_by_user(sessions).items()):
        if "badge" not in conds or "no_badge" not in conds:
            print(f"  [skip] {user}: missing one condition")
            continue
        b, nb = conds["badge"], conds["no_badge"]
        users.append(user)
        badge_vals.append(b["hv"] / max_hv[b["task_id"]])
        no_badge_vals.append(nb["hv"] / max_hv[nb["task_id"]])
    return users, badge_vals, no_badge_vals


def build_paired_for_metric(
    sessions: list[dict],
    metric_key: str,
) -> tuple[list[str], list[float], list[float]]:
    """Pair badge / no_badge sessions per user for an arbitrary metrics key."""
    users, badge_vals, no_badge_vals = [], [], []
    for user, conds in sorted(_group_by_user(sessions).items()):
        if "badge" not in conds or "no_badge" not in conds:
            continue
        b, nb = conds["badge"], conds["no_badge"]
        users.append(user)
        badge_vals.append(b["metrics"][metric_key])
        no_badge_vals.append(nb["metrics"][metric_key])
    return users, badge_vals, no_badge_vals


def build_paired_for_nasa(
    sessions: list[dict],
    nasa_key: str,
) -> tuple[list[str], list[float], list[float]]:
    """Pair badge / no_badge sessions per user for a NASA-TLX key."""
    users, badge_vals, no_badge_vals = [], [], []
    for user, conds in sorted(_group_by_user(sessions).items()):
        if "badge" not in conds or "no_badge" not in conds:
            continue
        b, nb = conds["badge"], conds["no_badge"]
        bv = b["nasa_tlx"].get(nasa_key)
        nbv = nb["nasa_tlx"].get(nasa_key)
        if bv is None or nbv is None:
            continue
        users.append(user)
        badge_vals.append(float(bv))
        no_badge_vals.append(float(nbv))
    return users, badge_vals, no_badge_vals


def build_paired_for_mtq(
    sessions: list[dict],
    mtq_key: str,
) -> tuple[list[str], list[float], list[float]]:
    """Pair badge / no_badge sessions per user for a MTQ key."""
    users, badge_vals, no_badge_vals = [], [], []
    for user, conds in sorted(_group_by_user(sessions).items()):
        if "badge" not in conds or "no_badge" not in conds:
            continue
        b, nb = conds["badge"], conds["no_badge"]
        bv = b["mtq"].get(mtq_key)
        nbv = nb["mtq"].get(mtq_key)
        if bv is None or nbv is None:
            continue
        users.append(user)
        badge_vals.append(float(bv))
        no_badge_vals.append(float(nbv))
    return users, badge_vals, no_badge_vals


# ── 5. Statistical test ────────────────────────────────────────────────────────

def run_test(
    badge: list[float], no_badge: list[float]
) -> tuple[float, bool, str]:
    """
    Test normality of differences (Shapiro-Wilk, alpha=0.05).
    If normal  → paired t-test.
    If not     → Wilcoxon signed-rank test.
    Returns (p_value, is_significant, test_name).
    """
    diffs = [b - nb for b, nb in zip(badge, no_badge)]
    _, p_shapiro = shapiro(diffs)
    if p_shapiro >= ALPHA:
        # Differences are normally distributed → paired t-test
        _, p = ttest_rel(badge, no_badge)
        return p, p < ALPHA, "paired_t-test"
    else:
        # Not normal → Wilcoxon signed-rank test
        _, p = wilcoxon(badge, no_badge, alternative="two-sided")
        return p, p < ALPHA, "wilcoxon"


# ── 6. Plots ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

def _draw_boxplot(ax, badge: list[float], no_badge: list[float],
                 ylabel: str, title: str, p_value: float, significant: bool,
                 test_name: str = "") -> None:
    """Draw a single condition-comparison boxplot on the given axes."""
    colors = ["#7bafd4", "#f4a261"]
    bp = ax.boxplot(
        [no_badge, badge],
        positions=[1, 2],
        widths=0.4,
        patch_artist=True,
        medianprops=dict(color="black", linewidth=2),
    )
    for patch, color in zip(bp["boxes"], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.6)

    ax.set_xticks([1, 2])
    ax.set_xticklabels(["No Badge", "Badge"], fontsize=10)
    ax.set_ylabel(ylabel, fontsize=9)
    ax.set_title(title, fontsize=10)
    ax.set_xlim(0.5, 2.5)

    all_vals = badge + no_badge
    y_min, y_max = min(all_vals), max(all_vals)
    margin = (y_max - y_min) * 0.4 if y_max > y_min else 0.05
    ax.set_ylim(y_min - margin, y_max + margin)
    ax.yaxis.set_major_locator(plt.MaxNLocator(nbins=5))
    ax.yaxis.grid(True, linestyle="--", alpha=0.5)
    ax.set_axisbelow(True)

    label = "t" if "t-test" in test_name else "W"
    sig_str = f"{label}: p={p_value:.3f}{'*' if significant else ''}"
    ax.text(0.97, 0.03, sig_str, transform=ax.transAxes,
            ha="right", va="bottom", fontsize=9,
            color="red" if significant else "black")


def plot(
    users: list[str],
    badge: list[float],
    no_badge: list[float],
    p_value: float,
    significant: bool,
    test_name: str,
    output_path: Path,
) -> None:
    """Single relative HV boxplot."""
    fig, ax = plt.subplots(figsize=(6, 5))
    _draw_boxplot(ax, badge, no_badge, "Relative Hypervolume",
                 "Optimization Performance by Condition", p_value, significant, test_name)
    ax.text(0.03, 0.97, f"n = {len(users)} participants",
            transform=ax.transAxes, ha="left", va="top", fontsize=10, color="gray")
    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  → saved: {output_path}")


def plot_metrics_mosaic(
    results: dict[str, dict],
    output_path: Path,
) -> None:
    """5-metric mosaic boxplot."""
    fig, axes = plt.subplot_mosaic(
        MOSAIC_LAYOUT,
        figsize=(13, 8),
        constrained_layout=True,
    )
    for key, ax in list(axes.items()):
        if key == ".":
            ax.set_visible(False)
            continue
        r = results[key]
        _draw_boxplot(ax, r["badge"], r["no_badge"],
                     METRICS[key], METRICS[key], r["p_value"], r["significant"], r["test_name"])

    fig.suptitle("Condition Comparison by Metric", fontsize=13)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  → saved: {output_path}")


def plot_nasa_mosaic(
    results: dict[str, dict],
    output_path: Path,
) -> None:
    """NASA-TLX mosaic boxplot."""
    fig, axes = plt.subplot_mosaic(
        NASA_TLX_LAYOUT,
        figsize=(13, 11),
        constrained_layout=True,
    )
    for key, ax in list(axes.items()):
        if key == ".":
            ax.set_visible(False)
            continue
        r = results[key]
        _draw_boxplot(ax, r["badge"], r["no_badge"],
                     NASA_TLX_METRICS[key], NASA_TLX_METRICS[key],
                     r["p_value"], r["significant"], r["test_name"])

    fig.suptitle("NASA-TLX Condition Comparison", fontsize=13)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  → saved: {output_path}")


def plot_mtq_mosaic(
    results: dict[str, dict],
    output_path: Path,
) -> None:
    """MTQ mosaic boxplot."""
    fig, axes = plt.subplot_mosaic(
        MTQ_LAYOUT,
        figsize=(13, 5),
        constrained_layout=True,
    )
    for key, ax in list(axes.items()):
        if key == ".":
            ax.set_visible(False)
            continue
        r = results[key]
        _draw_boxplot(ax, r["badge"], r["no_badge"],
                     MTQ_METRICS[key], MTQ_METRICS[key],
                     r["p_value"], r["significant"], r["test_name"])

    fig.suptitle("MTQ Condition Comparison", fontsize=13)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  → saved: {output_path}")


def save_json(
    hv_users: list[str],
    hv_badge: list[float],
    hv_no_badge: list[float],
    hv_p: float,
    hv_sig: bool,
    hv_test: str,
    max_hv: dict[str, float],
    metric_results: dict[str, dict],
    nasa_results: dict[str, dict],
    mtq_results: dict[str, dict],
    output_path: Path,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    tests: dict = {
        "relative_hv": {
            "test": hv_test,
            "p_value": round(hv_p, 6),
            "significant": bool(hv_sig),
            "participants": [
                {"user": u, "badge": round(b, 6), "no_badge": round(nb, 6)}
                for u, b, nb in zip(hv_users, hv_badge, hv_no_badge)
            ],
        }
    }
    for key, r in {**metric_results, **nasa_results, **mtq_results}.items():
        tests[key] = {
            "test": r["test_name"],
            "p_value": round(r["p_value"], 6),
            "significant": bool(r["significant"]),
            "participants": [
                {"user": u, "badge": round(b, 6), "no_badge": round(nb, 6)}
                for u, b, nb in zip(r["users"], r["badge"], r["no_badge"])
            ],
        }
    data = {
        "alpha": ALPHA,
        "max_hv_per_task": max_hv,
        "tests": tests,
    }
    output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"  → saved: {output_path}")


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    # Load task configs & estimate max HV
    task_cfgs = load_task_configs(CONFIG_PATH)
    print("Estimating maximum HV per task (Sobol sampling)...")
    max_hv: dict[str, float] = {}
    for task_id, cfg in task_cfgs.items():
        max_hv[task_id] = estimate_max_hv(cfg)
        print(f"  {task_id}: max_hv = {max_hv[task_id]:.6f}")

    # Load sessions
    sessions = load_sessions(RESULTS_DIR, EXCLUDED_USERS)
    print(f"\nLoaded {len(sessions)} sessions from {len({s['user'] for s in sessions})} users")

    # Relative HV
    hv_users, hv_badge, hv_no_badge = build_paired_data(sessions, max_hv)
    hv_p, hv_sig, hv_test = run_test(hv_badge, hv_no_badge)
    print(f"\n{'Metric':<35}  test            p-value  sig")
    print(f"  {'relative_hv':<33}  {hv_test:<14}  {hv_p:.4f}   {hv_sig}")

    # Other metrics
    metric_results: dict[str, dict] = {}
    for key, label in METRICS.items():
        users, badge_v, no_badge_v = build_paired_for_metric(sessions, key)
        p, sig, test_name = run_test(badge_v, no_badge_v)
        metric_results[key] = {
            "users": users, "badge": badge_v, "no_badge": no_badge_v,
            "p_value": p, "significant": sig, "test_name": test_name,
        }
        print(f"  {key:<33}  {test_name:<14}  {p:.4f}   {sig}")

    # NASA-TLX
    nasa_results: dict[str, dict] = {}
    print(f"\n{'NASA-TLX':<35}  test            p-value  sig")
    for key, label in NASA_TLX_METRICS.items():
        users, badge_v, no_badge_v = build_paired_for_nasa(sessions, key)
        p, sig, test_name = run_test(badge_v, no_badge_v)
        nasa_results[key] = {
            "users": users, "badge": badge_v, "no_badge": no_badge_v,
            "p_value": p, "significant": sig, "test_name": test_name,
        }
        print(f"  {key:<33}  {test_name:<14}  {p:.4f}   {sig}")

    # MTQ
    mtq_results: dict[str, dict] = {}
    print(f"\n{'MTQ':<35}  test            p-value  sig")
    for key, label in MTQ_METRICS.items():
        users, badge_v, no_badge_v = build_paired_for_mtq(sessions, key)
        p, sig, test_name = run_test(badge_v, no_badge_v)
        mtq_results[key] = {
            "users": users, "badge": badge_v, "no_badge": no_badge_v,
            "p_value": p, "significant": sig, "test_name": test_name,
        }
        print(f"  {key:<33}  {test_name:<14}  {p:.4f}   {sig}")

    # Outputs
    print("\nGenerating outputs...")
    plot(hv_users, hv_badge, hv_no_badge, hv_p, hv_sig, hv_test, OUTPUT_HV)
    plot_metrics_mosaic(metric_results, OUTPUT_MOSAIC)
    plot_nasa_mosaic(nasa_results, OUTPUT_NASA)
    plot_mtq_mosaic(mtq_results, OUTPUT_MTQ)
    save_json(hv_users, hv_badge, hv_no_badge, hv_p, hv_sig, hv_test,
              max_hv, metric_results, nasa_results, mtq_results, OUTPUT_JSON)


if __name__ == "__main__":
    main()
