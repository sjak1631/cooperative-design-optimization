#!/usr/bin/env python3
"""
Analyze a study session from the cooperative-design-optimization DB.

Usage:
    python analyze_session.py --user admin --session 36
    python analyze_session.py --user admin --session-index 36   # 1-based index within user's sessions
    python analyze_session.py --user admin --all                 # all sessions of the user

Output:
    results/{username}_session{id}.json   — structured metrics
"""

import argparse
import asyncio
import json
import math
import sys
from pathlib import Path

import aiosqlite
import numpy as np
import torch
import yaml
from botorch.utils.multi_objective.hypervolume import Hypervolume

DEFAULT_DB_PATH = Path(__file__).parent.parent / "study.db"
CONFIG_PATH = Path(__file__).parent.parent / "backend" / "app" / "tasks" / "config.yaml"
RESULTS_DIR = Path(__file__).parent / "results"
N_BINS = 3          # per dimension → 3^5 = 243 hypercubes
REF_POINT = [0.0, 0.0]  # reference point for HV (both objectives ∈ [0,1])


# ── helpers ────────────────────────────────────────────────────────────────────

def compute_pareto_front(points: list[tuple[float, float]]) -> list[int]:
    """Return indices of Pareto-optimal points (maximise both objectives)."""
    n = len(points)
    dominated = [False] * n
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            if (points[j][0] >= points[i][0] and points[j][1] >= points[i][1] and
                    (points[j][0] > points[i][0] or points[j][1] > points[i][1])):
                dominated[i] = True
                break
    return [i for i in range(n) if not dominated[i]]


def hypervolume(pareto_pts: list[tuple[float, float]], ref: list[float]) -> float:
    if not pareto_pts:
        return 0.0
    Y = torch.tensor(pareto_pts, dtype=torch.float64)
    hv = Hypervolume(torch.tensor(ref, dtype=torch.float64))
    return float(hv.compute(Y))


def load_task_configs(config_path: Path = CONFIG_PATH) -> dict[str, dict]:
    """Return {task_id: config_dict} from config.yaml."""
    with open(config_path) as f:
        raw = yaml.safe_load(f)
    return {t["id"]: t for t in raw["tasks"]}


def noiseless_objectives(params: dict[str, float], task_cfg: dict) -> tuple[float, float]:
    """
    Compute noise-free objective values from logged parameters.
    f_j(x) = baseline_j - sum_i weight_ji * (x_i - center_ji)^2
    """
    keys = [p["key"] for p in task_cfg["parameters"]]
    x = np.array([params.get(k, 0.5) for k in keys])
    centers  = np.array(task_cfg["obj_centers"])   # [2, d]
    weights  = np.array(task_cfg["obj_weights"])    # [2, d]
    baselines = np.array(task_cfg["obj_baselines"]) # [2]
    speed    = float(np.clip(baselines[0] - np.sum(weights[0] * (x - centers[0]) ** 2), 0.0, 1.0))
    accuracy = float(np.clip(baselines[1] - np.sum(weights[1] * (x - centers[1]) ** 2), 0.0, 1.0))
    return speed, accuracy


def bin_index(v: float, n_bins: int) -> int:
    """Map value in [0,1] to bin index 0..n_bins-1."""
    return min(int(v * n_bins), n_bins - 1)


def design_space_count(param_list: list[dict], n_bins: int = N_BINS) -> int:
    """Count distinct hypercubes occupied by the given parameter dicts."""
    if not param_list:
        return 0
    keys = sorted(param_list[0].keys())
    cubes: set[tuple] = set()
    for p in param_list:
        cube = tuple(bin_index(p[k], n_bins) for k in keys)
        cubes.add(cube)
    return len(cubes)


def travel_distances(param_list: list[dict]) -> tuple[float, float]:
    """Return (total_distance, mean_distance) for ordered formal eval points."""
    if len(param_list) < 2:
        return 0.0, 0.0
    keys = sorted(param_list[0].keys())
    total = 0.0
    for i in range(1, len(param_list)):
        dist = math.sqrt(sum(
            (param_list[i][k] - param_list[i - 1][k]) ** 2 for k in keys
        ))
        total += dist
    mean = total / (len(param_list) - 1)
    return total, mean


# ── DB queries ─────────────────────────────────────────────────────────────────

async def get_participant_id(db: aiosqlite.Connection, username: str) -> int | None:
    async with db.execute(
        "SELECT id FROM participants WHERE participant_id = ?", (username,)
    ) as cur:
        row = await cur.fetchone()
        return row[0] if row else None


async def get_sessions(db: aiosqlite.Connection, participant_id: int) -> list[dict]:
    async with db.execute(
        """SELECT id, condition, task_id, order_index, started_at, ended_at, end_reason
           FROM study_sessions
           WHERE participant_id = ?
           ORDER BY id""",
        (participant_id,),
    ) as cur:
        rows = await cur.fetchall()
    return [
        {
            "id": r[0], "condition": r[1], "task_id": r[2],
            "order_index": r[3], "started_at": r[4],
            "ended_at": r[5], "end_reason": r[6],
        }
        for r in rows
    ]


async def get_formal_evals(db: aiosqlite.Connection, session_id: int) -> list[dict]:
    async with db.execute(
        """SELECT id, parameters, speed, accuracy, created_at
           FROM evaluations
           WHERE session_id = ? AND eval_type = 'formal'
           ORDER BY created_at""",
        (session_id,),
    ) as cur:
        rows = await cur.fetchall()
    return [
        {
            "id": r[0],
            "parameters": json.loads(r[1]),
            "speed": r[2],
            "accuracy": r[3],
            "created_at": r[4],
        }
        for r in rows
    ]


async def get_nl_messages(db: aiosqlite.Connection, session_id: int) -> list[dict]:
    async with db.execute(
        """SELECT id, role, content, selected_candidate_index, created_at
           FROM chat_messages
           WHERE session_id = ? AND role = 'user'
           ORDER BY created_at""",
        (session_id,),
    ) as cur:
        rows = await cur.fetchall()
    return [
        {
            "id": r[0], "role": r[1], "content": r[2],
            "selected_candidate_index": r[3], "created_at": r[4],
        }
        for r in rows
    ]


async def get_nasa_tlx_response(db: aiosqlite.Connection, session_id: int) -> dict | None:
    async with db.execute(
        """SELECT mental_demand, physical_demand, temporal_demand, performance, effort, frustration, weights, weighted_tlx
           FROM nasa_tlx_responses
           WHERE session_id = ?""",
        (session_id,),
    ) as cur:
        row = await cur.fetchone()
    if not row:
        return None
    return {
        "mental_demand": row[0],
        "physical_demand": row[1],
        "temporal_demand": row[2],
        "performance": row[3],
        "effort": row[4],
        "frustration": row[5],
        "weights": json.loads(row[6]) if isinstance(row[6], str) else row[6],
        "weighted_tlx": row[7],
    }


async def get_mtq_response(db: aiosqlite.Connection, session_id: int) -> dict | None:
    async with db.execute(
        """SELECT purpose_q1, purpose_q2, purpose_q3, transparency_q1, transparency_q2, transparency_q3,
                  utility_q1, utility_q2, utility_q3, purpose_score, transparency_score, utility_score
           FROM mtq_responses
           WHERE session_id = ?""",
        (session_id,),
    ) as cur:
        row = await cur.fetchone()
    if not row:
        return None
    return {
        "purpose_q1": row[0],
        "purpose_q2": row[1],
        "purpose_q3": row[2],
        "transparency_q1": row[3],
        "transparency_q2": row[4],
        "transparency_q3": row[5],
        "utility_q1": row[6],
        "utility_q2": row[7],
        "utility_q3": row[8],
        "purpose_score": row[9],
        "transparency_score": row[10],
        "utility_score": row[11],
    }


# ── core analysis ──────────────────────────────────────────────────────────────

async def analyze_session(db: aiosqlite.Connection, session: dict, task_cfgs: dict[str, dict]) -> dict:
    sid = session["id"]
    formal_evals = await get_formal_evals(db, sid)
    nl_messages = await get_nl_messages(db, sid)
    nasa_tlx = await get_nasa_tlx_response(db, sid)
    mtq = await get_mtq_response(db, sid)

    task_cfg = task_cfgs.get(session["task_id"])
    param_list = [e["parameters"] for e in formal_evals]

    # Compute noise-free true objectives from logged parameters
    if task_cfg is not None:
        true_pairs = [
            noiseless_objectives(e["parameters"], task_cfg)
            for e in formal_evals
        ]
    else:
        # fallback: use observed values
        true_pairs = [(e["speed"], e["accuracy"]) for e in formal_evals]

    # Pareto front on true values
    pareto_indices = compute_pareto_front(true_pairs)
    pareto_pts = [true_pairs[i] for i in pareto_indices]
    pareto_params = [formal_evals[i] for i in pareto_indices]

    # hypervolume of true Pareto front
    hv_value = hypervolume(pareto_pts, REF_POINT)

    # design space count
    ds_count = design_space_count(param_list)

    # travel distance
    total_dist, mean_dist = travel_distances(param_list)

    return {
        "session_id": sid,
        "condition": session["condition"],
        "task_id": session["task_id"],
        "order_index": session["order_index"],
        "started_at": session["started_at"],
        "ended_at": session["ended_at"],
        "end_reason": session["end_reason"],
        "metrics": {
            "hypervolume": round(hv_value, 6),
            "total_formal_evaluation_count": len(formal_evals),
            "pareto_set_count": len(pareto_pts),
            "design_space_count_metric": ds_count,
            "total_travel_distance": round(total_dist, 6),
            "mean_travel_distance": round(mean_dist, 6),
            "nl_request_count": len(nl_messages),
        },
        "pareto_set": [
            {"speed": round(true_pairs[pareto_indices[i]][0], 6),
             "accuracy": round(true_pairs[pareto_indices[i]][1], 6),
             "parameters": pareto_params[i]["parameters"]}
            for i in range(len(pareto_indices))
        ],
        "nl_requests": nl_messages,
        "nasa_tlx": nasa_tlx,
        "mtq": mtq,
    }


async def run(username: str, session_ids: list[int] | None, all_sessions: bool, db_path: Path | str = DEFAULT_DB_PATH):
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    task_cfgs = load_task_configs()

    async with aiosqlite.connect(str(db_path)) as db:
        pid = await get_participant_id(db, username)
        if pid is None:
            print(f"Error: user '{username}' not found.", file=sys.stderr)
            sys.exit(1)

        sessions = await get_sessions(db, pid)
        if not sessions:
            print(f"Error: no sessions found for '{username}'.", file=sys.stderr)
            sys.exit(1)

        # resolve target sessions
        if all_sessions:
            targets = sessions
        else:
            # match by DB id
            id_set = set(session_ids or [])
            targets = [s for s in sessions if s["id"] in id_set]
            if not targets:
                print(
                    f"Error: session id(s) {session_ids} not found for '{username}'.\n"
                    f"Available session ids: {[s['id'] for s in sessions]}",
                    file=sys.stderr,
                )
                sys.exit(1)

        for session in targets:
            result = await analyze_session(db, session, task_cfgs)
            out_path = RESULTS_DIR / f"{username}_session{session['id']}.json"
            out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
            _print_summary(result)
            print(f"  → saved: {out_path}\n")


def _print_summary(r: dict):
    m = r["metrics"]
    print(f"{'=' * 60}")
    print(f"User session  : id={r['session_id']}  condition={r['condition']}  task={r['task_id']}")
    print(f"Period        : {r['started_at']} → {r['ended_at']}  ({r['end_reason']})")
    print(f"{'─' * 60}")
    print(f"Hypervolume                : {m['hypervolume']:.6f}  (ref={REF_POINT})")
    print(f"Formal eval count        : {m['total_formal_evaluation_count']}")
    print(f"Pareto set count         : {m['pareto_set_count']}")
    print(f"Design space count       : {m['design_space_count_metric']}  / 243 hypercubes")
    print(f"Total travel distance    : {m['total_travel_distance']:.6f}")
    print(f"Mean travel distance     : {m['mean_travel_distance']:.6f}")
    print(f"NL request count         : {m['nl_request_count']}")
    print(f"{'─' * 60}")
    print(f"Pareto set:")
    for p in r["pareto_set"]:
        print(f"  speed={p['speed']:.4f}  accuracy={p['accuracy']:.4f}")
    
    # NASA-TLX
    if r["nasa_tlx"]:
        tlx = r["nasa_tlx"]
        print(f"{'─' * 60}")
        print(f"NASA-TLX:")
        print(f"  Mental Demand     : {tlx['mental_demand']}")
        print(f"  Physical Demand   : {tlx['physical_demand']}")
        print(f"  Temporal Demand   : {tlx['temporal_demand']}")
        print(f"  Performance       : {tlx['performance']}")
        print(f"  Effort            : {tlx['effort']}")
        print(f"  Frustration       : {tlx['frustration']}")
        print(f"  Weighted TLX      : {tlx['weighted_tlx']:.2f}")
    
    # MTQ
    if r["mtq"]:
        mtq = r["mtq"]
        print(f"{'─' * 60}")
        print(f"MTQ (Mental Training Questionnaire):")
        print(f"  Purpose Score     : {mtq['purpose_score']:.2f}")
        print(f"  Transparency Score: {mtq['transparency_score']:.2f}")
        print(f"  Utility Score     : {mtq['utility_score']:.2f}")


# ── entry point ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Analyze a cooperative-design-optimization study session."
    )
    parser.add_argument("--user", required=True, help="Participant username (e.g. admin)")
    parser.add_argument("--db", type=str, default=str(DEFAULT_DB_PATH), help="Path to database file (default: %(default)s)")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--session", type=int, nargs="+", metavar="ID",
        help="DB session id(s) to analyze (e.g. --session 36)",
    )
    group.add_argument(
        "--session-index", type=int, nargs="+", metavar="N",
        help="1-based index within the user's sessions (e.g. --session-index 36)",
    )
    group.add_argument(
        "--all", action="store_true", dest="all_sessions",
        help="Analyze all sessions of the user",
    )
    args = parser.parse_args()

    async def _run():
        db_path = Path(args.db)
        async with aiosqlite.connect(str(db_path)) as db:
            pid = await get_participant_id(db, args.user)
            if pid is None:
                print(f"Error: user '{args.user}' not found.", file=sys.stderr)
                sys.exit(1)
            sessions = await get_sessions(db, pid)

        if args.session_index:
            session_ids = []
            for idx in args.session_index:
                if idx < 1 or idx > len(sessions):
                    print(
                        f"Error: --session-index {idx} out of range (1–{len(sessions)}).",
                        file=sys.stderr,
                    )
                    sys.exit(1)
                session_ids.append(sessions[idx - 1]["id"])
        else:
            session_ids = args.session

        await run(args.user, session_ids, args.all_sessions, db_path)

    asyncio.run(_run())


if __name__ == "__main__":
    main()
