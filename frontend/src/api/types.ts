// API response types (mirrors backend Pydantic schemas)

export interface TokenResponse {
    access_token: string;
    token_type: string;
    participant_id: string;
    is_admin: boolean;
}

export type Condition = 'badge' | 'no_badge';
export type EvalType = 'informal' | 'formal';
export type EndReason = 'pareto' | 'timeout' | 'manual' | 'server_shutdown';

export interface UserInfo {
    id: number;
    participant_id: string;
    is_admin: boolean;
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
