export interface Parameters {
    [key: string]: number;
    opacity: number;    // 0–1
    distance: number;   // 0–1
    iconSize: number;   // 0–1
    boxSize: number;    // 0–1
    textSize: number;   // 0–1
}

export type EvaluationType = 'informal' | 'formal';

export interface EvaluationPoint {
    id: number;
    type: EvaluationType;
    speed: number;      // 0–100
    accuracy: number;   // 0–100
    parameters: Parameters;
    isLatent: boolean;  // true = most recent evaluation
}

export type ConfidenceLabel = 'High' | 'Medium' | 'Low';

export interface ConfidenceInfo {
    label: ConfidenceLabel;
    variance: number;
    reason: string;
    recommendationType: 'Reliable' | 'Uncertain but informative';
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    confidence?: ConfidenceInfo;
}

export const PARAM_LABELS: Record<keyof Parameters, string> = {
    opacity: 'Opacity',
    distance: 'Distance',
    iconSize: 'Icon Size',
    boxSize: 'Box Size',
    textSize: 'Text Size',
};
