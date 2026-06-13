import type {
    BOSuggestResponse,
    CandidatePoint,
    EvaluationHistoryItem,
    EvaluationResult,
    LLMSelectResponse,
    MTQRequest,
    MTQResult,
    NASATLXRequest,
    NASATLXResult,
    SessionInfo,
    TaskInfo,
    TokenResponse,
    UserInfo,
} from './types';
import type { EvalType } from './types';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

class ApiError extends Error {
    status: number;
    constructor(
        status: number,
        message: string,
    ) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

async function request<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const token = sessionStorage.getItem('access_token');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE}${path}`, { ...options, headers });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new ApiError(res.status, body.detail ?? res.statusText);
    }
    return res.json() as Promise<T>;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(participantId: string, password: string): Promise<TokenResponse> {
    return request<TokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ participant_id: participantId, password }),
    });
}

export async function guestLogin(): Promise<TokenResponse> {
    return request<TokenResponse>('/auth/guest', { method: 'POST' });
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function listTasks(): Promise<TaskInfo[]> {
    return request<TaskInfo[]>('/tasks');
}

export async function getTask(taskId: string): Promise<TaskInfo> {
    return request<TaskInfo>(`/tasks/${taskId}`);
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function startSession(taskId: string, condition: string): Promise<SessionInfo> {
    return request<SessionInfo>('/session/start', {
        method: 'POST',
        body: JSON.stringify({ task_id: taskId, condition }),
    });
}

export async function getCurrentSession(): Promise<SessionInfo> {
    return request<SessionInfo>('/session/current');
}

export async function endSession(): Promise<SessionInfo> {
    return request<SessionInfo>('/session/end', { method: 'POST' });
}

export async function listSessions(): Promise<SessionInfo[]> {
    return request<SessionInfo[]>('/session/all');
}

// ── Evaluate ─────────────────────────────────────────────────────────────────

export async function evaluate(
    sessionId: number,
    evalType: EvalType,
    parameters: Record<string, number>,
): Promise<EvaluationResult> {
    return request<EvaluationResult>('/evaluate', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, eval_type: evalType, parameters }),
    });
}

export async function getEvalHistory(sessionId: number): Promise<EvaluationHistoryItem[]> {
    return request<EvaluationHistoryItem[]>(`/evaluate/history/${sessionId}`);
}

// ── BO / LLM ─────────────────────────────────────────────────────────────────

export async function boSuggest(sessionId: number): Promise<BOSuggestResponse> {
    return request<BOSuggestResponse>('/bo/suggest', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
    });
}

export async function llmSelect(
    sessionId: number,
    userMessage: string,
    candidates: CandidatePoint[],
): Promise<LLMSelectResponse> {
    return request<LLMSelectResponse>('/bo/select', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, user_message: userMessage, candidates }),
    });
}

export { ApiError };

// ── Auth/Me ───────────────────────────────────────────────────────────────────

export async function getMe(): Promise<UserInfo> {
    return request<UserInfo>('/auth/me');
}

// ── NASA-TLX ─────────────────────────────────────────────────────────────────

export async function submitNasaTlx(data: NASATLXRequest): Promise<NASATLXResult> {
    return request<NASATLXResult>('/nasa-tlx', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// ── MTQ ───────────────────────────────────────────────────────────────────────

export async function submitMtq(data: MTQRequest): Promise<MTQResult> {
    return request<MTQResult>('/mtq', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function adminListUsers(): Promise<UserInfo[]> {
    return request<UserInfo[]>('/admin/users');
}

export async function adminCreateUser(participantId: string, password: string, isAdmin: boolean): Promise<UserInfo> {
    return request<UserInfo>('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ participant_id: participantId, password, is_admin: isAdmin }),
    });
}

export async function adminDeleteUser(userId: number): Promise<void> {
    await request<void>(`/admin/users/${userId}`, { method: 'DELETE' });
}

export async function adminChangePassword(userId: number, newPassword: string): Promise<void> {
    await request<void>(`/admin/users/${userId}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ new_password: newPassword }),
    });
}

export async function adminAssignTask(
    userId: number,
    taskNoBadge: string | null,
    taskBadge: string | null,
): Promise<UserInfo> {
    return request<UserInfo>(`/admin/users/${userId}/assignment`, {
        method: 'PATCH',
        body: JSON.stringify({ task_no_badge: taskNoBadge, task_badge: taskBadge }),
    });
}
