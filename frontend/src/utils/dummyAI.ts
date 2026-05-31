import type { Parameters, ConfidenceLabel, ConfidenceInfo } from '../types';

interface AISuggestionResult {
    message: string;
    suggestedParams: Parameters;
    confidence: ConfidenceInfo;
}

// ── Confidence computation from pseudo-GP predictive variance ──

const PARAM_KEYS = ['opacity', 'distance', 'iconSize', 'boxSize', 'textSize'] as const;
const MAX_DIST = Math.sqrt(PARAM_KEYS.length); // max Euclidean distance in unit hypercube

function euclideanDist(a: Parameters, b: Parameters): number {
    return Math.sqrt(PARAM_KEYS.reduce((sum, k) => sum + (a[k] - b[k]) ** 2, 0));
}

function computeConfidence(candidate: Parameters, history: Parameters[]): ConfidenceInfo {
    let variance: number;
    if (history.length === 0) {
        variance = 0.8; // no evaluated points → maximum uncertainty
    } else {
        const minDist = Math.min(...history.map((h) => euclideanDist(candidate, h)));
        variance = (minDist / MAX_DIST) ** 2;
    }

    // Thresholds simulate quantile-based classification (q33 / q66)
    let label: ConfidenceLabel;
    if (variance < 0.10) label = 'High';
    else if (variance < 0.25) label = 'Medium';
    else label = 'Low';

    const reason =
        label === 'High'
            ? 'This candidate is close to previously evaluated designs, so the predicted performance is relatively reliable.'
            : label === 'Medium'
                ? 'This candidate is moderately near explored regions; the prediction carries some uncertainty.'
                : 'This candidate lies in a less explored region, so the predicted performance is more uncertain.';

    const recommendationType = label === 'Low' ? 'Uncertain but informative' : 'Reliable';

    return { label, variance, reason, recommendationType };
}

// Simple keyword-based AI response for the mock
export async function getAISuggestion(
    userMessage: string,
    currentParams: Parameters,
    evaluationHistory: Parameters[] = [],
): Promise<AISuggestionResult> {
    await new Promise((r) => setTimeout(r, 1400)); // simulate latency

    const lower = userMessage.toLowerCase();
    const p: Parameters = { ...currentParams };
    const changes: string[] = [];

    if (lower.includes('bright') || lower.includes('vivid') || lower.includes('clear') || lower.includes('visible')) {
        p.opacity = Math.min(1, p.opacity + 0.2);
        changes.push('increased opacity');
    }
    if (lower.includes('space') || lower.includes('spread') || lower.includes('room') || lower.includes('padding')) {
        p.distance = Math.min(1, p.distance + 0.25);
        changes.push('increased spacing');
    }
    if (lower.includes('compact') || lower.includes('dense') || lower.includes('tight') || lower.includes('close')) {
        p.distance = Math.max(0, p.distance - 0.2);
        changes.push('reduced spacing');
    }
    if (lower.includes('large text') || lower.includes('bigger text') || lower.includes('font') || lower.includes('readable') || lower.includes('legible')) {
        p.textSize = Math.min(1, p.textSize + 0.25);
        changes.push('increased text size');
    }
    if (lower.includes('small text') || lower.includes('smaller text')) {
        p.textSize = Math.max(0, p.textSize - 0.2);
        changes.push('decreased text size');
    }
    if (lower.includes('icon')) {
        p.iconSize = Math.min(1, p.iconSize + 0.2);
        changes.push('increased icon size');
    }
    if (lower.includes('card') || lower.includes('box') || lower.includes('block')) {
        p.boxSize = Math.min(1, p.boxSize + 0.2);
        changes.push('increased box size');
    }
    if (lower.includes('minimal') || lower.includes('simple') || lower.includes('clean')) {
        p.opacity = Math.max(0, p.opacity - 0.15);
        p.distance = Math.min(1, p.distance + 0.15);
        p.iconSize = Math.max(0, p.iconSize - 0.1);
        changes.push('applied minimal styling');
    }

    if (changes.length === 0) {
        // BO-like nudge toward estimated optimum
        p.opacity += (0.6 - p.opacity) * 0.35;
        p.distance += (0.45 - p.distance) * 0.35;
        p.textSize += (0.7 - p.textSize) * 0.35;
        changes.push('adjusted parameters toward high-performing region');
    }

    // clamp all to [0, 1]
    for (const key of Object.keys(p) as Array<keyof Parameters>) {
        p[key] = Math.max(0, Math.min(1, p[key]));
    }

    const message =
        `I've ${changes.join(', ')} based on your request. ` +
        `The sliders have been updated — feel free to fine-tune and then run an evaluation.`;

    const confidence = computeConfidence(p, evaluationHistory);

    return { message, suggestedParams: p, confidence };
}
