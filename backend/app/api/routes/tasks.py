"""
Task config info endpoint — lets frontend know parameter names,
labels, and ranges for the current task.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.tasks.loader import get_task, load_tasks

router = APIRouter(prefix="/tasks", tags=["tasks"])


class ParameterInfo(BaseModel):
    key: str
    label: str
    description: str
    range_min: float
    range_max: float


class MetricInfo(BaseModel):
    name: str
    label: str
    explanation: str
    range_min: float
    range_max: float


class TaskInfo(BaseModel):
    id: str
    name: str
    description: str
    condition: str
    is_fixed: bool = False
    parameters: list[ParameterInfo]
    metrics: list[MetricInfo]


@router.get("", response_model=list[TaskInfo])
async def list_tasks() -> list[TaskInfo]:
    tasks = load_tasks()
    return [_task_to_info(t) for t in tasks.values()]


@router.get("/{task_id}", response_model=TaskInfo)
async def get_task_info(task_id: str) -> TaskInfo:
    try:
        task = get_task(task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _task_to_info(task)


def _task_to_info(task) -> TaskInfo:  # type: ignore[no-untyped-def]
    return TaskInfo(
        id=task.id,
        name=task.name,
        description=task.description,
        condition=task.condition,
        is_fixed=task.is_fixed,
        parameters=[
            ParameterInfo(
                key=p.key,
                label=p.label,
                description=p.description,
                range_min=p.range[0],
                range_max=p.range[1],
            )
            for p in task.parameters
        ],
        metrics=[
            MetricInfo(
                name=m.name,
                label=m.label,
                explanation=m.explanation,
                range_min=m.range[0],
                range_max=m.range[1],
            )
            for m in task.metrics
        ],
    )
