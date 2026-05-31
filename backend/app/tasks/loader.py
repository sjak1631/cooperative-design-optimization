"""Task configuration loader (YAML)."""
from __future__ import annotations

import yaml
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.config import get_settings

settings = get_settings()


class ParameterConfig:
    def __init__(self, data: dict[str, Any]) -> None:
        self.key: str = data["key"]
        self.label: str = data["label"]
        self.description: str = data.get("description", "")
        self.range: tuple[float, float] = tuple(data["range"])  # type: ignore[assignment]


class MetricConfig:
    def __init__(self, data: dict[str, Any]) -> None:
        self.name: str = data["name"]
        self.label: str = data["label"]
        self.explanation: str = data["explanation"]
        self.range: tuple[float, float] = tuple(data["range"])  # type: ignore[assignment]


class TaskConfig:
    def __init__(self, data: dict[str, Any]) -> None:
        self.id: str = data["id"]
        self.name: str = data["name"]
        self.description: str = data["description"]
        self.condition: str = data.get("condition", "no_badge")  # optional; per-user condition takes precedence
        self.is_fixed: bool = data.get("fixed", False)
        self.timeout_minutes: int | None = data.get("timeout_minutes", None)  # None = use global default
        self.parameters: list[ParameterConfig] = [ParameterConfig(p) for p in data["parameters"]]
        self.metrics: list[MetricConfig] = [MetricConfig(m) for m in data["metrics"]]
        # True objective coefficients for dummy evaluation (research use only)
        self._obj_centers: list[list[float]] = data.get("obj_centers", [])
        self._obj_weights: list[list[float]] = data.get("obj_weights", [])
        self._obj_baselines: list[float] = data.get("obj_baselines", [])
        self._noise_informal: float = data.get("noise_informal", 12.0)
        self._noise_formal: float = data.get("noise_formal", 3.0)

    def param_keys(self) -> list[str]:
        return [p.key for p in self.parameters]

    def param_ranges(self) -> list[tuple[float, float]]:
        return [p.range for p in self.parameters]


@lru_cache
def load_tasks() -> dict[str, TaskConfig]:
    path = Path(settings.TASKS_CONFIG_PATH)
    with path.open() as f:
        data = yaml.safe_load(f)
    return {t["id"]: TaskConfig(t) for t in data["tasks"]}


def get_task(task_id: str) -> TaskConfig:
    tasks = load_tasks()
    if task_id not in tasks:
        raise ValueError(f"Unknown task_id: {task_id}")
    return tasks[task_id]
