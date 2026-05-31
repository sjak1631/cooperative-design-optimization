"""
LLM-based candidate selector using OpenAI structured output.

Given:
  - user_message
  - batch candidates (with posterior stats + optional confidence badge)
  - evaluation history
  - task context

Returns: selected_index (int), assistant_message (str)
"""
from __future__ import annotations

import json
import math
from typing import Any

from openai import AsyncOpenAI

from app.core.config import get_settings
from app.schemas.bo import CandidatePoint
from app.tasks.loader import TaskConfig

settings = get_settings()

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


def _fmt_float(v: float) -> str:
    if math.isnan(v):
        return "N/A"
    return f"{v:.3f}"


def _build_prompt(
    task: TaskConfig,
    user_message: str,
    candidates: list[CandidatePoint],
    history: list[dict[str, Any]],
    with_badge: bool,
) -> str:
    param_constraints = "\n".join(
        f"  {p.key}: {p.range[0]}–{p.range[1]}  ({p.description})"
        for p in task.parameters
    )
    objective_ranges = ", ".join(
        f"{m.name}: {m.range[0]}–{m.range[1]}"
        for m in task.metrics
    )
    metrics_desc = ", ".join(
        f"{m.name}: {m.explanation}"
        for m in task.metrics
    )

    # Observed results (last 10 to keep context short)
    if history:
        obs_lines = []
        for h in history[-10:]:
            p_str = ", ".join(f"{k}={v:.3f}" for k, v in h["parameters"].items())
            eval_type_jp = "正式評価" if h['eval_type'] == 'formal' else "非正式評価"
            obs_lines.append(
                f"  [{p_str}] 速度={h['speed']:.1f}, 精度={h['accuracy']:.1f} ({eval_type_jp})"
            )
        obs_block = "観測された結果:\n" + "\n".join(obs_lines)
    else:
        obs_block = "観測された結果: まだなし"

    # Candidate block
    variance_note = (
        "各候補点には以下の情報が含まれます：パラメータ値、mean_obj（予測平均）、"
        "variance_obj（予測分散 — 値が大きいほど不確実性が高い）、"
        "acquisition_value（値が大きいほど最適化に有望）"
    )
    if with_badge:
        variance_note += (
            "、confidence_badge（他の候補との相対的な不確実性を示す Low/Medium/High — "
            "High バッジ = 高分散 = 探索的、Low バッジ = 低分散 = 利用的）"
        )

    cand_lines = []
    for c in candidates:
        p_str = ", ".join(f"{k}={v:.3f}" for k, v in c.parameters.items())
        stats = (
            f"mean_speed={_fmt_float(c.mean_speed)}, variance_speed={_fmt_float(c.variance_speed)}, "
            f"mean_accuracy={_fmt_float(c.mean_accuracy)}, variance_accuracy={_fmt_float(c.variance_accuracy)}, "
            f"acquisition_value={_fmt_float(c.acquisition_value)}"
        )
        badge_str = f", confidence_badge={c.confidence_badge}" if (with_badge and c.confidence_badge) else ""
        cand_lines.append(f"• index: {c.index}  [{p_str}]\n    {stats}{badge_str}")

    prompt = f"""ユーザーのリクエストに基づいて、最適な候補点のインデックスを選択し、その理由を述べてください。

【重要】reason フィールドの説明は「必ず日本語だけ」で書いてください。英語は絶対に混ぜないでください。

タスク: {task.name}
説明: {task.description}
指標: {metrics_desc}
パラメータ制約:
{param_constraints}
目的値の範囲: {objective_ranges}

ユーザーのリクエスト: {user_message}

{obs_block}

これらの候補点はベイズ最適化のサンプラーによって生成されています。{variance_note}

候補点:
{chr(10).join(cand_lines)}

以下の形式で有効な JSON のみで応答してください。reason フィールドには必ず日本語だけで理由を述べてください。英語を混ぜないでください:
{{"selected_index": <0-{len(candidates)-1}の整数>, "reason": "<日本語だけの説明>"}}"""

    return prompt


async def select_candidate(
    task: TaskConfig,
    user_message: str,
    candidates: list[CandidatePoint],
    history: list[dict[str, Any]],
    with_badge: bool,
) -> tuple[int, str]:
    """
    Returns (selected_index, assistant_message).
    selected_index is 0-based matching CandidatePoint.index.
    """
    prompt = _build_prompt(task, user_message, candidates, history, with_badge)

    response = await _get_client().chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "あなたはUIデザイン最適化を支援するエキスパートデザインアシスタントです。"
                    "ベイズ最適化を使ってウェブページレイアウトを改善するのに協力します。"
                    "ユーザーの好みと最適化統計に基づいて最適な候補点を選択し、"
                    "その理由を日本語で明確かつ簡潔に説明してください。"
                    "【重要】すべての説明は日本語だけで提供してください。英語は絶対に使用しないでください。"
                ),
            },
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
        max_tokens=512,
    )

    raw = response.choices[0].message.content or "{}"
    data = json.loads(raw)

    selected_index: int = int(data.get("selected_index", 0))
    reason: str = data.get("reason", "Selected based on your request.")

    # Clamp to valid range
    selected_index = max(0, min(selected_index, len(candidates) - 1))

    # Format friendly response
    cand = candidates[selected_index]
    param_str = ", ".join(f"{k}={v:.2f}" for k, v in cand.parameters.items())
    assistant_message = (
        f"**候補 {selected_index + 1}** ({param_str}) を選択しました。\n\n{reason}\n\n"
        f"スライダーが更新されました。微調整してから評価を実行してください。"
    )

    return selected_index, assistant_message
