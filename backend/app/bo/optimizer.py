"""
BoTorch-based multi-objective Bayesian Optimization.

Model:   SingleTaskGP with train_Yvar (one GP per objective; botorch>=0.12)
Acqf:    qLogNEHVI  (batch size=8 by default)
"""
from __future__ import annotations

import math
import numpy as np
import torch
from botorch.fit import fit_gpytorch_mll
from botorch.models import SingleTaskGP
from botorch.models.model_list_gp_regression import ModelListGP
from botorch.acquisition.multi_objective.logei import qLogNoisyExpectedHypervolumeImprovement as qLogNEHVI
from botorch.optim import optimize_acqf
from botorch.utils.multi_objective.pareto import is_non_dominated
from botorch.utils.transforms import unnormalize, normalize
from gpytorch.mlls.sum_marginal_log_likelihood import SumMarginalLogLikelihood
from torch import Tensor

from app.core.config import get_settings
from app.tasks.loader import TaskConfig

settings = get_settings()

# Fixed reference point slightly below 0 on [0,1] scale
REF_POINT = torch.tensor([-0.1, -0.1], dtype=torch.double)


def _build_bounds(task: TaskConfig) -> Tensor:
    """Returns [2, d] bounds tensor."""
    ranges = task.param_ranges()
    lb = [r[0] for r in ranges]
    ub = [r[1] for r in ranges]
    return torch.tensor([lb, ub], dtype=torch.double)


def suggest_batch(
    task: TaskConfig,
    train_X_raw: list[list[float]],
    train_Y_raw: list[list[float]],
    noise_vars_raw: list[list[float]],
    batch_size: int = 8,
) -> list[dict]:
    """
    Returns `batch_size` candidate dicts, each containing:
        parameters, mean_speed, variance_speed,
        mean_accuracy, variance_accuracy, acquisition_value
    """
    bounds = _build_bounds(task)
    d = bounds.shape[1]

    X = torch.tensor(train_X_raw, dtype=torch.double)          # [n, d]
    Y = torch.tensor(train_Y_raw, dtype=torch.double)          # [n, 2]
    Yvar = torch.tensor(noise_vars_raw, dtype=torch.double)    # [n, 2]

    # Normalize inputs to [0,1]^d
    X_norm = normalize(X, bounds)

    # Standardize objectives (mean=0, std=1) for GP fitting
    Y_mean = Y.mean(dim=0)
    Y_std  = Y.std(dim=0).clamp(min=1e-6)
    Y_norm = (Y - Y_mean) / Y_std
    Yvar_norm = Yvar / (Y_std ** 2)

    # Build one GP per objective (SingleTaskGP with train_Yvar replaces FixedNoiseGP)
    models = [
        SingleTaskGP(X_norm, Y_norm[:, i : i + 1], train_Yvar=Yvar_norm[:, i : i + 1])
        for i in range(2)
    ]
    model = ModelListGP(*models)
    mll = SumMarginalLogLikelihood(model.likelihood, model)
    fit_gpytorch_mll(mll)

    # Reference point in normalized space
    ref_norm = (REF_POINT - Y_mean) / Y_std

    acqf = qLogNEHVI(
        model=model,
        ref_point=ref_norm,
        X_baseline=X_norm,
        prune_baseline=True,
        cache_root=True,
    )

    unit_bounds = torch.zeros(2, d, dtype=torch.double)
    unit_bounds[1] = 1.0

    candidates_norm, acq_values = optimize_acqf(
        acqf,
        bounds=unit_bounds,
        q=batch_size,
        num_restarts=settings.BO_NUM_RESTARTS,
        raw_samples=settings.BO_RAW_SAMPLES,
        sequential=True,
    )
    # acq_values shape: [q] (one value per candidate)

    # Compute posterior mean & variance for each candidate
    with torch.no_grad():
        posterior = model.posterior(candidates_norm)  # [q, 2]
        means = posterior.mean                         # [q, 2]
        variances = posterior.variance                 # [q, 2]

    # Denormalize
    means_denorm     = means     * Y_std + Y_mean
    variances_denorm = variances * (Y_std ** 2)
    candidates_raw   = unnormalize(candidates_norm, bounds)  # [q, d]
    param_keys       = task.param_keys()

    results = []
    for i in range(batch_size):
        params = {k: float(candidates_raw[i, j]) for j, k in enumerate(param_keys)}
        # clamp to valid range
        for j, (lo, hi) in enumerate(task.param_ranges()):
            k = param_keys[j]
            params[k] = float(np.clip(params[k], lo, hi))

        results.append({
            "parameters":      params,
            "mean_speed":      float(means_denorm[i, 0]),
            "variance_speed":  float(variances_denorm[i, 0]),
            "mean_accuracy":   float(means_denorm[i, 1]),
            "variance_accuracy": float(variances_denorm[i, 1]),
            "acquisition_value": float(acq_values[i]) if acq_values.ndim > 0 else float(acq_values),
        })

    return results


def compute_pareto_front(train_Y_raw: list[list[float]]) -> list[int]:
    """Returns indices of non-dominated points (formal evals only)."""
    if not train_Y_raw:
        return []
    Y = torch.tensor(train_Y_raw, dtype=torch.double)
    mask = is_non_dominated(Y)
    return mask.nonzero(as_tuple=False).squeeze(-1).tolist()


def assign_confidence_badges(
    candidates: list[dict],
    train_Y_raw: list[list[float]],
) -> list[str]:
    """
    Assign High / Medium / Low badges based on predictive variance quantiles.
    Uses pooled variance = variance_speed + variance_accuracy.
    Reference distribution is built from historical GP variances
    (approximated here from the candidate set itself when history is small).
    """
    if not train_Y_raw:
        return ["Medium"] * len(candidates)

    pooled = [
        c["variance_speed"] + c["variance_accuracy"]
        for c in candidates
        if not (math.isnan(c["variance_speed"]))
    ]
    if not pooled:
        return ["Medium"] * len(candidates)

    arr = np.array(pooled)
    q33, q67 = np.percentile(arr, 33), np.percentile(arr, 67)

    badges = []
    for c in candidates:
        if math.isnan(c.get("variance_speed", float("nan"))):
            badges.append("Medium")
            continue
        v = c["variance_speed"] + c["variance_accuracy"]
        if v <= q33:
            badges.append("Low")
        elif v <= q67:
            badges.append("Medium")
        else:
            badges.append("High")

    return badges
