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
import NasaTLX from './components/NasaTLX';
import MtqSurvey from './components/MtqSurvey';
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

type AppStage = 'login' | 'home' | 'admin' | 'setup' | 'study' | 'nasa_tlx' | 'mtq' | 'done';

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
  const [initialized, setInitialized] = useState(false);

  const SESSION_TIMEOUT_SEC = 20 * 60; // 20 min
  const FINISH_UNLOCK_SEC = 15 * 60;   // 15 min (regular users)

  const sessionSyncRef = useRef<{ elapsed: number; at: number }>({ elapsed: 0, at: Date.now() });

  // ── Session persistence with localStorage ──
  useEffect(() => {
    const init = async () => {
      try {
        // Try to restore from localStorage
        const savedMe = localStorage.getItem('auth_user');
        if (savedMe) {
          const user = JSON.parse(savedMe) as UserInfo;
          setMe(user);
          // Verify token is still valid
          try {
            const meData = await getMe();
            setMe(meData);
            if (meData.is_admin) {
              setStage('home');
            } else {
              setStage('setup');
            }
          } catch {
            // Token expired or invalid
            localStorage.removeItem('auth_user');
            setMe(null);
            setStage('login');
          }
        } else {
          setStage('login');
        }
      } catch {
        setStage('login');
      } finally {
        setInitialized(true);
      }
    };
    init();
  }, []);

  // ── Save user to localStorage when logged in ──
  useEffect(() => {
    if (me) {
      localStorage.setItem('auth_user', JSON.stringify(me));
    } else {
      localStorage.removeItem('auth_user');
    }
  }, [me]);

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
        // Non-tutorial tasks → NASA-TLX survey first (skipped for guests)
        if (me?.is_guest) {
          setSession(null); setTask(null); setHistory([]); setStage('setup');
        } else if (task && !task.id.startsWith('task_tutorial')) {
          setStage('nasa_tlx');
        } else {
          setStage('done');
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [session?.is_active, session?.elapsed_seconds, task, me]);

  const handleFinish = useCallback(async () => {
    try {
      const updated = await endSession();
      setSession(updated);
      // Non-tutorial tasks → NASA-TLX survey first (skipped for guests)
      if (me?.is_guest) {
        setSession(null); setTask(null); setHistory([]); setStage('setup');
      } else if (task && !task.id.startsWith('task_tutorial')) {
        setStage('nasa_tlx');
      } else {
        setStage('done');
      }
    } catch (err) {
      console.error('Failed to end session', err);
    }
  }, [task, me]);

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

  const handleSignOut = useCallback(() => {
    localStorage.removeItem('auth_user');
    setMe(null);
    setSession(null);
    setTask(null);
    setHistory([]);
    setParams({} as Parameters);
    setStage('login');
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
        // Non-tutorial tasks → NASA-TLX survey first (skipped for guests)
        if (me?.is_guest) {
          setSession(null); setTask(null); setHistory([]); setStage('setup');
        } else if (task && !task.id.startsWith('task_tutorial')) {
          setStage('nasa_tlx');
        } else {
          setStage('done');
        }
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
  }, [session, isEvaluating, params, refreshHistory, task, me]);

  const isAdmin = me?.is_admin ?? false;

  // ── Show loading during initialization ──
  if (!initialized) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f8fafc',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '3px solid #e2e8f0',
            borderTop: '3px solid #3b82f6',
            animation: 'spin 1s linear infinite',
          }} />
          <p style={{ color: '#64748b', fontSize: '14px' }}>Loading...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

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
          <button
            className="done-btn"
            style={{ background: '#dc2626', marginTop: 4, color: '#ffffff' }}
            onClick={handleSignOut}
          >
            {t('app.signOut')}
          </button>
        </div>
      </div>
    );
  }

  // ── Admin panel ──
  if (stage === 'admin') {
    return <AdminPanel onBack={() => setStage('home')} />;
  }

  // ── NASA-TLX survey ──
  if (stage === 'nasa_tlx' && session) {
    return (
      <NasaTLX
        sessionId={session.session_id}
        onComplete={() => setStage('mtq')}
      />
    );
  }

  // ── MTQ survey ──
  if (stage === 'mtq' && session) {
    return (
      <MtqSurvey
        sessionId={session.session_id}
        onComplete={() => setStage('done')}
      />
    );
  }

  // ── Session setup ──
  if (stage === 'setup') {
    return (
      <SessionSetup
        isAdmin={isAdmin}
        onSessionStarted={handleSessionStarted}
        onGoAdmin={isAdmin ? () => setStage('home') : undefined}
        onSignOut={handleSignOut}
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
  const isTutorial = task?.id?.startsWith('task_tutorial');
  const finishUnlocked = isAdmin || isTutorial || elapsedSec >= FINISH_UNLOCK_SEC;

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