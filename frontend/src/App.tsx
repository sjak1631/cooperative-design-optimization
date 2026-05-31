import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Parameters, EvaluationPoint } from './types';
import type { SessionInfo, TaskInfo, EvaluationHistoryItem, UserInfo } from './api/types';
import type { EvalType } from './api/types';
import { evaluate, getEvalHistory, getCurrentSession, endSession, getMe } from './api/client';
import { I18nProvider, useI18n } from './context/i18nContext';
import Login from './pages/Login';
import SessionSetup from './pages/SessionSetup';
import AdminPanel from './pages/AdminPanel';
import WebpagePreview from './components/WebpagePreview';
import SetParameters from './components/SetParameters';
import Evaluate from './components/Evaluate';
import CheckResults from './components/CheckResults';
import './App.css';

// Convert API history to legacy EvaluationPoint shape used by components
function toEvalPoint(item: EvaluationHistoryItem): EvaluationPoint {
  return {
    id: item.evaluation_id,
    type: item.eval_type,
    speed: item.speed,
    accuracy: item.accuracy,
    parameters: item.parameters as Parameters,
    isLatent: item.is_latent,
  };
}

function makeDefaultParams(task: TaskInfo): Parameters {
  const p: Partial<Parameters> = {};
  for (const param of task.parameters) {
    (p as Record<string, number>)[param.key] = (param.range_min + param.range_max) / 2;
  }
  return p as Parameters;
}

const EVAL_DELAY_MS: Record<EvalType, number> = {
  formal: 20_000,
  informal: 3_000,
};

type AppStage = 'login' | 'home' | 'admin' | 'setup' | 'study' | 'done';

const AppContent: React.FC = () => {
  const { t } = useI18n();
  const [stage, setStage] = useState<AppStage>('login');
  const [me, setMe] = useState<UserInfo | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [task, setTask] = useState<TaskInfo | null>(null);
  const [params, setParams] = useState<Parameters>({} as Parameters);
  const [history, setHistory] = useState<EvaluationPoint[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalType, setEvalType] = useState<EvalType | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const SESSION_TIMEOUT_SEC = 20 * 60; // 20 min
  const FINISH_UNLOCK_SEC = 15 * 60;   // 15 min (regular users)

  const sessionSyncRef = useRef<{ elapsed: number; at: number }>({ elapsed: 0, at: Date.now() });

  // Count-up timer — forced end at 20 min
  useEffect(() => {
    if (!session?.is_active) return;
    sessionSyncRef.current = { elapsed: session.elapsed_seconds, at: Date.now() };

    const id = setInterval(async () => {
      const { elapsed, at } = sessionSyncRef.current;
      const sec = elapsed + (Date.now() - at) / 1000;
      setElapsedSec(sec);
      if (sec >= SESSION_TIMEOUT_SEC) {
        clearInterval(id);
        try {
          const ended = await endSession();
          setSession(ended);
        } catch {
          setSession(prev => prev ? { ...prev, is_active: false, end_reason: 'timeout' as SessionInfo['end_reason'] } : prev);
        }
        setStage('done');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [session?.is_active, session?.elapsed_seconds]);

  const handleFinish = useCallback(async () => {
    try {
      const updated = await endSession();
      setSession(updated);
      setStage('done');
    } catch (err) {
      console.error('Failed to end session', err);
    }
  }, []);

  const handleFinishAndGoHome = useCallback(async () => {
    try {
      await endSession();
    } catch {
      // already ended
    }
    setSession(null);
    setTask(null);
    setHistory([]);
    setStage('home');
  }, []);

  const handleLogin = useCallback(async (participantId: string) => {
    try {
      const userInfo = await getMe();
      setMe(userInfo);
      if (userInfo.is_admin) {
        setStage('home');
      } else {
        setStage('setup');
      }
    } catch {
      // fallback: admin check by participant_id
      if (participantId === 'admin') {
        setStage('home');
      } else {
        setStage('setup');
      }
    }
  }, []);

  const handleSessionStarted = useCallback((s: SessionInfo, t: TaskInfo) => {
    setSession(s);
    setTask(t);
    setParams(makeDefaultParams(t));
    setHistory([]);
    setStage('study');
  }, []);

  const refreshHistory = useCallback(async (sessionId: number) => {
    try {
      const items = await getEvalHistory(sessionId);
      setHistory(items.map(toEvalPoint));
    } catch {
      // ignore
    }
  }, []);

  const cancelEvalRef = useRef<(() => void) | null>(null);

  const handleCancelEvaluate = useCallback(() => {
    cancelEvalRef.current?.();
  }, []);

  const handleEvaluate = useCallback(async (type: EvalType) => {
    if (!session || isEvaluating) return;
    setIsEvaluating(true);
    setEvalType(type);
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, EVAL_DELAY_MS[type]);
        cancelEvalRef.current = () => {
          clearTimeout(timer);
          reject(new DOMException('Evaluation cancelled by user', 'AbortError'));
        };
      });
      cancelEvalRef.current = null;

      const result = await evaluate(session.session_id, type, params);

      await refreshHistory(session.session_id);
      try {
        const updatedSession = await getCurrentSession();
        setSession(updatedSession);
      } catch {
        // ignore if session already ended
      }
      if (result.session_ended) {
        setSession((prev) => prev ? {
          ...prev,
          is_active: false,
          end_reason: result.end_reason as any,
          pareto_front_count: result.pareto_front_count,
        } : prev);
        setStage('done');
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Cancelled — no DB entry
      } else {
        console.error('Evaluation error', err);
      }
    } finally {
      cancelEvalRef.current = null;
      setIsEvaluating(false);
      setEvalType(null);
    }
  }, [session, isEvaluating, params, refreshHistory]);

  const isAdmin = me?.is_admin ?? false;

  // ── Login ──
  if (stage === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  // ── Admin home ──
  if (stage === 'home' && isAdmin) {
    return (
      <div className="done-root">
        <div className="done-card">
          <div className="done-icon">⚙️</div>
          <h1>{t('app.adminHome')}</h1>
          <p>{t('app.loggedInAs')} <strong>{me?.participant_id}</strong></p>
          <button className="done-btn" onClick={() => setStage('admin')}>
            {t('app.adminPanel')}
          </button>
          <button
            className="done-btn"
            style={{ background: '#475569', marginTop: 4 }}
            onClick={() => setStage('setup')}
          >
            {t('app.startTestSession')}
          </button>
        </div>
      </div>
    );
  }

  // ── Admin panel ──
  if (stage === 'admin') {
    return <AdminPanel onBack={() => setStage('home')} />;
  }

  // ── Session setup ──
  if (stage === 'setup') {
    return (
      <SessionSetup
        isAdmin={isAdmin}
        onSessionStarted={handleSessionStarted}
        onGoAdmin={isAdmin ? () => setStage('home') : undefined}
      />
    );
  }

  // ── Session done ──
  if (stage === 'done') {
    return (
      <div className="done-root">
        <div className="done-card">
          <div className="done-icon">🎉</div>
          <h1>{t('app.sessionComplete')}</h1>
          <p>
            {session?.end_reason === 'timeout'
              ? t('app.sessionTimeoutMessage')
              : session?.end_reason === 'server_shutdown'
                ? t('app.serverRestartMessage')
                : t('app.sessionCompleteMessage')}
          </p>
          {!isAdmin && (
            <p className="done-sub">{t('app.thankYouMessage')}</p>
          )}
          {isAdmin ? (
            <button className="done-btn" onClick={() => setStage('home')}>
              {t('app.backToHome')}
            </button>
          ) : (
            <button className="done-btn" onClick={() => setStage('setup')}>
              {t('app.startNextCondition')}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Main study UI ──
  const paramDefs = task?.parameters ?? [];
  const sessionLabel = task
    ? `${task.name}${session?.condition === 'badge' ? ' · ' + t('app.badgesOn') : ''}`
    : '';
  const finishUnlocked = isAdmin || elapsedSec >= FINISH_UNLOCK_SEC;

  return (
    <div className="app-root">
      <header className="app-header">
        <span className="app-logo">{t('app.logo')}</span>
        <span className="app-subtitle">{sessionLabel}</span>
        {session?.is_active && (
          <span className={`app-session-info${elapsedSec >= SESSION_TIMEOUT_SEC - 60 ? ' app-session-info--warn' : ''}`}>
            {String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:{String(Math.floor(elapsedSec % 60)).padStart(2, '0')} {t('app.elapsed')}
          </span>
        )}
        {isAdmin && session?.is_active && (
          <button
            className="app-finish-btn app-finish-btn--active"
            style={{ marginRight: 4 }}
            onClick={handleFinishAndGoHome}
            disabled={isEvaluating}
            title={t('app.endSessionTitle')}
          >
            ← {t('app.backToHome')}
          </button>
        )}
        {session?.is_active && (
          <button
            className={`app-finish-btn${finishUnlocked ? ' app-finish-btn--active' : ''}`}
            disabled={!finishUnlocked || isEvaluating}
            onClick={handleFinish}
            title={!finishUnlocked
              ? t('app.availableAfterMinutes') + ` (${Math.ceil((FINISH_UNLOCK_SEC - elapsedSec) / 60)} ${t('app.minRemaining')})`
              : t('app.finishSession')}
          >
            {t('app.finishButton')}
          </button>
        )}
      </header>

      <main className="app-panels">
        {/* Panel 1 — Webpage Preview */}
        <div className="panel panel--preview">
          <div className="panel-label">
            <span className="panel-label-dot panel-label-dot--blue" />
            {t('panels.webpagePreview')}
          </div>
          <div className="panel-content">
            <WebpagePreview params={params} taskId={task?.id} />
          </div>
        </div>

        {/* Panel 2 — Set Parameters */}
        <div className="panel panel--params">
          <div className="panel-label">
            <span className="panel-label-dot panel-label-dot--purple" />
            {t('panels.setParameters')}
          </div>
          <div className="panel-content panel-content--padded">
            <SetParameters
              params={params}
              paramDefs={paramDefs}
              onParamsChange={setParams}
              session={session}
            />
          </div>
        </div>

        {/* Panel 3 — Evaluate */}
        <div className="panel panel--evaluate">
          <div className="panel-label">
            <span className="panel-label-dot panel-label-dot--amber" />
            {t('panels.evaluate')}
          </div>
          <div className="panel-content panel-content--padded">
            <Evaluate
              isEvaluating={isEvaluating}
              evaluatingType={evalType}
              onEvaluate={handleEvaluate}
              onCancel={handleCancelEvaluate}
            />
          </div>
        </div>

        {/* Panel 4 — Check & Analyze */}
        <div className="panel panel--results">
          <div className="panel-label">
            <span className="panel-label-dot panel-label-dot--green" />
            {t('panels.checkResults')}
          </div>
          <div className="panel-content panel-content--padded">
            <CheckResults
              history={history}
              currentParams={params}
              onRestoreParams={setParams}
              metricLabels={{ x: task?.metrics?.[0]?.label ?? 'Speed', y: task?.metrics?.[1]?.label ?? 'Accuracy' }}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <I18nProvider>
    <AppContent />
  </I18nProvider>
);

export default App;