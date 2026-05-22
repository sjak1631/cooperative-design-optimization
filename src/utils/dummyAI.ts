import type { Parameters } from '../types';

interface AISuggestionResult {
    message: string;
    suggestedParams: Parameters;
}

// Simple keyword-based AI response for the mock
export async function getAISuggestion(
    userMessage: string,
    currentParams: Parameters,
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

    return { message, suggestedParams: p };
}
