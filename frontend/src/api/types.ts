// API response types (mirrors backend Pydantic schemas)

export interface TokenResponse {
    access_token: string;
    token_type: string;
    participant_id: string;
    is_admin: boolean;
    is_guest: boolean;
}

export type Condition = 'badge' | 'no_badge';
export type EvalType = 'informal' | 'formal';
export type EndReason = 'pareto' | 'timeout' | 'manual' | 'server_shutdown';

export interface UserInfo {
    id: number;
    participant_id: string;
    is_admin: boolean;
    is_guest: boolean;
    task_no_badge: string | null;   // web app assigned to no_badge condition
    task_badge: string | null;      // web app assigned to badge condition
    created_at: string;
}

export interface SessionInfo {
    session_id: number;
    task_id: string;
    condition: Condition;
    order_index: number;
    started_at: string;
    ended_at: string | null;
    end_reason: EndReason | null;
    is_active: boolean;
    elapsed_seconds: number;
    pareto_front_count: number;
    formal_eval_count: number;
}

export interface EvaluationResult {
    evaluation_id: number;
    eval_type: EvalType;
    speed: number;
    accuracy: number;
    parameters: Record<string, number>;
    created_at: string;
    session_ended: boolean;
    end_reason: string | null;
    pareto_front_count: number;
}

export interface EvaluationHistoryItem {
    evaluation_id: number;
    eval_type: EvalType;
    speed: number;
    accuracy: number;
    parameters: Record<string, number>;
    created_at: string;
    is_latent: boolean;
}

export interface CandidatePoint {
    index: number;
    parameters: Record<string, number>;
    mean_speed: number;
    variance_speed: number;
    mean_accuracy: number;
    variance_accuracy: number;
    acquisition_value: number;
    confidence_badge: 'High' | 'Medium' | 'Low' | null;
}

export interface BOSuggestResponse {
    candidates: CandidatePoint[];
    has_model: boolean;
}

export interface LLMSelectResponse {
    selected_index: number;
    selected_parameters: Record<string, number>;
    assistant_message: string;
    user_message_saved_id: number;
    assistant_message_saved_id: number;
}

export interface ChatHistoryItem {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    selected_candidate_index: number | null;
}

export interface ParameterInfo {
    key: string;
    label: string;
    description: string;
    range_min: number;
    range_max: number;
}

export interface MetricInfo {
    name: string;
    label: string;
    explanation: string;
    range_min: number;
    range_max: number;
}

export interface TaskInfo {
    id: string;
    name: string;
    description: string;
    condition?: Condition;  // optional: condition is now per-user, not per-task
    is_fixed?: boolean;     // fixed tasks are shown to all users without assignment
    parameters: ParameterInfo[];
    metrics: MetricInfo[];
}

// ── NASA-TLX ─────────────────────────────────────────────────────────────────

export interface PairwiseChoice {
    pair: [string, string];
    chosen: string;
}

export interface NASATLXRequest {
    session_id: number;
    mental_demand: number;
    physical_demand: number;
    temporal_demand: number;
    performance: number;
    effort: number;
    frustration: number;
    pairwise_choices: PairwiseChoice[];
}

export interface NASATLXResult {
    id: number;
    session_id: number;
    mental_demand: number;
    physical_demand: number;
    temporal_demand: number;
    performance: number;
    effort: number;
    frustration: number;
    pairwise_choices: PairwiseChoice[];
    weights: Record<string, number>;
    weighted_tlx: number;
    created_at: string;
}

// ── MTQ ───────────────────────────────────────────────────────────────────────

export interface MTQRequest {
    session_id: number;
    purpose_q1: number;
    purpose_q2: number;
    purpose_q3: number;
    transparency_q1: number;
    transparency_q2: number;
    transparency_q3: number;
    utility_q1: number;
    utility_q2: number;
    utility_q3: number;
}

export interface MTQResult {
    id: number;
    session_id: number;
    purpose_q1: number;
    purpose_q2: number;
    purpose_q3: number;
    transparency_q1: number;
    transparency_q2: number;
    transparency_q3: number;
    utility_q1: number;
    utility_q2: number;
    utility_q3: number;
    purpose_score: number;
    transparency_score: number;
    utility_score: number;
    created_at: string;
}
