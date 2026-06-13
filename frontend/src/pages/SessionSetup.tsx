import React, { useEffect, useState } from 'react';
import { listTasks, startSession, getCurrentSession, getMe } from '../api/client';
import { useI18n } from '../context/i18nContext';
import type { TaskInfo, SessionInfo, Condition, UserInfo } from '../api/types';
import './SessionSetup.css';

interface Props {
    isAdmin: boolean;
    onSessionStarted: (session: SessionInfo, task: TaskInfo) => void;
    onGoAdmin?: () => void;
    onSignOut?: () => void;
}

const SessionSetup: React.FC<Props> = ({ isAdmin, onSessionStarted, onGoAdmin, onSignOut }) => {
    const { t } = useI18n();
    const [me, setMe] = useState<UserInfo | null>(null);
    const [taskMap, setTaskMap] = useState<Record<string, TaskInfo>>({});
    const [allTasks, setAllTasks] = useState<TaskInfo[]>([]);
    const [adminCondition, setAdminCondition] = useState<Condition>('no_badge');
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState<string | null>(null); // 'no_badge' | 'badge'
    const [error, setError] = useState('');

    useEffect(() => {
        const init = async () => {
            // Check for existing active session
            try {
                const session = await getCurrentSession();
                const tasks = await listTasks();
                const task = tasks.find((t) => t.id === session.task_id);
                if (task) {
                    onSessionStarted(session, task);
                    return;
                }
            } catch {
                // no active session
            }

            try {
                const [tasks, meData] = await Promise.all([listTasks(), getMe()]);
                const map: Record<string, TaskInfo> = {};
                for (const t of tasks) map[t.id] = t;
                setTaskMap(map);
                setAllTasks(tasks);
                setMe(meData);
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Failed to load task info');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [isAdmin, onSessionStarted]);

    const handleStart = async (taskId: string, condition: Condition) => {
        const task = taskMap[taskId];
        if (!task) return;
        setStarting(condition);
        setError('');
        try {
            const session = await startSession(taskId, condition);
            onSessionStarted(session, task);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to start session');
            setStarting(null);
        }
    };

    if (loading) {
        return (
            <div className="ss-root">
                <div className="ss-spinner" />
            </div>
        );
    }

    // ── User view: show both assigned conditions ──
    if (!isAdmin) {
        const noBadgeTask = me?.task_no_badge ? taskMap[me.task_no_badge] : null;
        const badgeTask = me?.task_badge ? taskMap[me.task_badge] : null;
        const fixedTasks = allTasks.filter((t) => t.is_fixed);
        const hasAny = noBadgeTask || badgeTask || fixedTasks.length > 0;

        // ── Guest view: SNS + badge, no selection required ──
        if (me?.is_guest && badgeTask) {
            return (
                <div className="ss-root">
                    <div className="ss-card">
                        <div className="ss-logo">{t('app.logo')}</div>
                        <h1 className="ss-title">{t('sessionSetup.guestTitle')}</h1>
                        <p className="ss-sub">{t('sessionSetup.guestSubtitle')}</p>
                        {error && <p className="ss-error">{error}</p>}
                        <div className="ss-tasks">
                            <div className="ss-task-card ss-task-card--badge">
                                <div className="ss-condition-tag ss-condition-tag--badge">{t('sessionSetup.withBadge')}</div>
                                <div className="ss-task-name">{badgeTask.name}</div>
                                <div className="ss-task-desc">{t('taskDescriptions.' + badgeTask.id)}</div>
                                <button
                                    className="ss-start-btn ss-start-btn--badge"
                                    onClick={() => handleStart(badgeTask.id, 'badge')}
                                    disabled={starting !== null}
                                >
                                    {starting === 'badge' ? t('sessionSetup.starting') : t('sessionSetup.start')}
                                </button>
                            </div>
                        </div>
                        {onSignOut && (
                            <button
                                className="ss-back-btn"
                                onClick={onSignOut}
                                style={{ background: '#dc2626', marginTop: 8, color: '#ffffff' }}
                            >
                                {t('app.signOut')}
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className="ss-root">
                <div className="ss-card">
                    <div className="ss-logo">{t('app.logo')}</div>
                    <h1 className="ss-title">{t('sessionSetup.selectYourSession')}</h1>
                    {error && <p className="ss-error">{error}</p>}
                    {!hasAny && !error && (
                        <p className="ss-error">{t('sessionSetup.noTaskAssigned')}</p>
                    )}
                    {fixedTasks.length > 0 && (
                        <div className="ss-section">
                            <div className="ss-section-label">{t('sessionSetup.tutorial')}</div>
                            <div className="ss-tasks">
                                {fixedTasks.map((ft) => (
                                    <div key={ft.id} className="ss-task-card ss-task-card--tutorial">
                                        <div className="ss-condition-tag ss-condition-tag--tutorial">{t('sessionSetup.tutorial')}</div>
                                        <div className="ss-task-name">{ft.name}</div>
                                        <div className="ss-task-desc">{t('taskDescriptions.' + ft.id)}</div>
                                        <button
                                            className="ss-start-btn ss-start-btn--tutorial"
                                            onClick={() => handleStart(ft.id, 'no_badge')}
                                            disabled={starting !== null}
                                        >
                                            {starting === 'no_badge' ? t('sessionSetup.starting') : t('sessionSetup.start')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {(noBadgeTask || badgeTask) && (
                        <div className="ss-section">
                            {fixedTasks.length > 0 && (
                                <div className="ss-section-label">{t('sessionSetup.mainTask')}</div>
                            )}
                            <div className="ss-tasks">
                                {noBadgeTask && (
                                    <div className="ss-task-card ss-task-card--no_badge">
                                        <div className="ss-condition-tag ss-condition-tag--no_badge">{t('sessionSetup.standard')}</div>
                                        <div className="ss-task-name">{noBadgeTask.name}</div>
                                        <div className="ss-task-desc">{t('taskDescriptions.' + noBadgeTask.id)}</div>
                                        <button
                                            className="ss-start-btn"
                                            onClick={() => handleStart(noBadgeTask.id, 'no_badge')}
                                            disabled={starting !== null}
                                        >
                                            {starting === 'no_badge' ? t('sessionSetup.starting') : t('sessionSetup.start')}
                                        </button>
                                    </div>
                                )}
                                {badgeTask && (
                                    <div className="ss-task-card ss-task-card--badge">
                                        <div className="ss-condition-tag ss-condition-tag--badge">{t('sessionSetup.withBadge')}</div>
                                        <div className="ss-task-name">{badgeTask.name}</div>
                                        <div className="ss-task-desc">{t('taskDescriptions.' + badgeTask.id)}</div>
                                        <button
                                            className="ss-start-btn ss-start-btn--badge"
                                            onClick={() => handleStart(badgeTask.id, 'badge')}
                                            disabled={starting !== null}
                                        >
                                            {starting === 'badge' ? t('sessionSetup.starting') : t('sessionSetup.start')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {onSignOut && (
                        <button
                            className="ss-back-btn"
                            onClick={onSignOut}
                            style={{ background: '#dc2626', marginTop: 8, color: '#ffffff' }}
                        >
                            {t('app.signOut')}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // ── Admin view: pick condition then web app ──
    return (
        <div className="ss-root">
            <div className="ss-card">
                <div className="ss-logo">{t('app.logo')}</div>
                <h1 className="ss-title">{t('app.startTestSession')}</h1>
                <p className="ss-sub">{t('sessionSetup.selectCondition')}</p>
                {error && <p className="ss-error">{error}</p>}
                <div className="ss-admin-condition">
                    <span className="ss-admin-condition-label">{t('sessionSetup.condition')}</span>
                    <label className="ss-radio-label">
                        <input
                            type="radio"
                            name="adminCondition"
                            value="no_badge"
                            checked={adminCondition === 'no_badge'}
                            onChange={() => setAdminCondition('no_badge')}
                        />
                        {t('sessionSetup.noBadge')}
                    </label>
                    <label className="ss-radio-label">
                        <input
                            type="radio"
                            name="adminCondition"
                            value="badge"
                            checked={adminCondition === 'badge'}
                            onChange={() => setAdminCondition('badge')}
                        />
                        {t('sessionSetup.badge')}
                    </label>
                </div>
                <div className="ss-tasks">
                    {allTasks.map((task) => (
                        <button
                            key={task.id}
                            className={`ss-task-btn ss-task-btn--${adminCondition}`}
                            onClick={() => handleStart(task.id, adminCondition)}
                            disabled={starting !== null}
                        >
                            <div className="ss-task-name">{task.name}</div>
                            <div className="ss-task-desc">{t('taskDescriptions.' + task.id)}</div>
                        </button>
                    ))}
                </div>
                {onGoAdmin && (
                    <button className="ss-back-btn" onClick={onGoAdmin}>
                        {t('sessionSetup.backToAdminHome')}
                    </button>
                )}
                {onSignOut && (
                    <button
                        className="ss-back-btn"
                        onClick={onSignOut}
                        style={{ background: '#dc2626', marginTop: 8, color: '#ffffff' }}
                    >
                        {t('app.signOut')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default SessionSetup;
