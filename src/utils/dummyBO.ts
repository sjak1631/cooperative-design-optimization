import type { Parameters, EvaluationType } from '../types';

// Optimal parameters for each objective
// f_j(x) = c_j - sum_i b_ji * (x_i - a_ji)^2

const A_SPEED = [0.7, 0.3, 0.5, 0.4, 0.6];  // optimal x per dim for speed
const A_ACC = [0.5, 0.6, 0.7, 0.6, 0.8];   // optimal x per dim for accuracy
const B_SPEED = [8, 10, 6, 7, 9];    // curvature weights (speed)
const B_ACC = [7, 9, 8, 6, 10];    // curvature weights (accuracy)
const C_SPEED = 88;
const C_ACC = 90;

function gaussianNoise(std: number): number {
    // Box–Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    return std * Math.sqrt(-2 * Math.log(u1 + 1e-12)) * Math.cos(2 * Math.PI * u2);
}

export function evaluateObjective(
    params: Parameters,
    type: EvaluationType,
): { speed: number; accuracy: number } {
    const x = [params.opacity, params.distance, params.iconSize, params.boxSize, params.textSize];

    let speed = C_SPEED;
    let accuracy = C_ACC;

    for (let i = 0; i < 5; i++) {
        speed -= B_SPEED[i] * (x[i] - A_SPEED[i]) ** 2;
        accuracy -= B_ACC[i] * (x[i] - A_ACC[i]) ** 2;
    }

    const noiseStd = type === 'informal' ? 12 : 3;
    speed += gaussianNoise(noiseStd);
    accuracy += gaussianNoise(noiseStd);

    speed = Math.max(0, Math.min(100, speed));
    accuracy = Math.max(0, Math.min(100, accuracy));

    return { speed, accuracy };
}
