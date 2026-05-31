import React, { useEffect, useState, useCallback } from 'react';
import {
    adminListUsers,
    adminCreateUser,
    adminDeleteUser,
    adminChangePassword,
    adminAssignTask,
    listTasks,
} from '../api/client';
import { useI18n } from '../context/i18nContext';
import type { UserInfo, TaskInfo } from '../api/types';
import './AdminPanel.css';

interface Props {
    onBack: () => void;
}

interface AssignDraft {
    noBadge: string;  // task_id for no_badge condition ('__none__' = clear)
    badge: string;    // task_id for badge condition ('__none__' = clear)
}

const AdminPanel: React.FC<Props> = ({ onBack }) => {
    const { t } = useI18n();
    const [users, setUsers] = useState<UserInfo[]>([]);
    const [tasks, setTasks] = useState<TaskInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // New user form
    const [newId, setNewId] = useState('');
    const [newPw, setNewPw] = useState('');
    const [newIsAdmin, setNewIsAdmin] = useState(false);
    const [creating, setCreating] = useState(false);

    // Inline edit state
    const [pwEditing, setPwEditing] = useState<Record<number, string>>({});
    // Assignment draft: userId → {noBadge, badge}
    const [assignDraft, setAssignDraft] = useState<Record<number, AssignDraft>>({});

    const refresh = useCallback(async () => {
        try {
            const [u, t] = await Promise.all([adminListUsers(), listTasks()]);
            setUsers(u);
            setTasks(t);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const openDraft = (u: UserInfo) => {
        setAssignDraft(prev => ({
            ...prev,
            [u.id]: {
                noBadge: u.task_no_badge ?? '__none__',
                badge: u.task_badge ?? '__none__',
            },
        }));
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setError('');
        try {
            await adminCreateUser(newId.trim(), newPw, newIsAdmin);
            setNewId('');
            setNewPw('');
            setNewIsAdmin(false);
            await refresh();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to create user');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (user: UserInfo) => {
        if (!window.confirm(`Delete user "${user.participant_id}"? This cannot be undone.`)) return;
        try {
            await adminDeleteUser(user.id);
            await refresh();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to delete user');
        }
    };

    const handleChangePw = async (user: UserInfo) => {
        const pw = pwEditing[user.id] ?? '';
        if (pw.length < 6) { setError('Password must be at least 6 characters'); return; }
        setError('');
        try {
            await adminChangePassword(user.id, pw);
            setPwEditing(prev => { const n = { ...prev }; delete n[user.id]; return n; });
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to change password');
        }
    };

    const handleAssign = async (user: UserInfo) => {
        const draft = assignDraft[user.id];
        if (!draft) return;
        setError('');
        try {
            await adminAssignTask(
                user.id,
                draft.noBadge === '__none__' ? null : draft.noBadge,
                draft.badge === '__none__' ? null : draft.badge,
            );
            setAssignDraft(prev => { const n = { ...prev }; delete n[user.id]; return n; });
            await refresh();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to assign task');
        }
    };

    return (
        <div className="ap-root">
            <header className="ap-header">
                <span className="ap-logo">{t('app.logo')}</span>
                <span className="ap-title">{t('admin.title')}</span>
                <button className="ap-back-btn" onClick={onBack}>{t('admin.backButton')}</button>
            </header>

            <div className="ap-body">
                {error && <div className="ap-error">{error}<button className="ap-error-close" onClick={() => setError('')}>✕</button></div>}

                {/* ── Add user ── */}
                <section className="ap-section">
                    <h2 className="ap-section-title">{t('admin.addNewUser')}</h2>
                    <form className="ap-create-form" onSubmit={handleCreate}>
                        <input
                            className="ap-input"
                            placeholder={t('admin.participantIdPlaceholder')}
                            value={newId}
                            onChange={e => setNewId(e.target.value)}
                            required
                            minLength={1}
                            maxLength={64}
                        />
                        <input
                            className="ap-input"
                            type="password"
                            placeholder={t('admin.passwordPlaceholder')}
                            value={newPw}
                            onChange={e => setNewPw(e.target.value)}
                            required
                            minLength={6}
                        />
                        <label className="ap-checkbox-label">
                            <input
                                type="checkbox"
                                checked={newIsAdmin}
                                onChange={e => setNewIsAdmin(e.target.checked)}
                            />
                            {t('admin.adminCheckbox')}
                        </label>
                        <button className="ap-btn ap-btn--primary" type="submit" disabled={creating}>
                            {creating ? t('admin.creatingButton') : t('admin.addButton')}
                        </button>
                    </form>
                </section>

                {/* ── User list ── */}
                <section className="ap-section">
                    <h2 className="ap-section-title">{t('admin.usersSection')}</h2>
                    {loading ? (
                        <div className="ap-spinner" />
                    ) : (
                        <table className="ap-table">
                            <thead>
                                <tr>
                                    <th>{t('admin.idHeader')}</th>
                                    <th>{t('admin.participantHeader')}</th>
                                    <th>{t('admin.roleHeader')}</th>
                                    <th>{t('admin.noBadgeHeader')}</th>
                                    <th>{t('admin.withBadgeHeader')}</th>
                                    <th></th>
                                    <th>{t('admin.passwordHeader')}</th>
                                    <th>{t('admin.deleteHeader')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => {
                                    const draft = assignDraft[u.id];
                                    const isDirty = !!draft;
                                    return (
                                        <tr key={u.id} className={u.is_admin ? 'ap-row--admin' : ''}>
                                            <td className="ap-cell-id">{u.id}</td>
                                            <td className="ap-cell-name">{u.participant_id}</td>
                                            <td>{u.is_admin
                                                ? <span className="ap-badge ap-badge--admin">{t('admin.adminBadge')}</span>
                                                : <span className="ap-badge ap-badge--user">{t('admin.userBadge')}</span>}
                                            </td>
                                            {/* No Badge assignment */}
                                            <td>
                                                <select
                                                    className="ap-select ap-select--no-badge"
                                                    value={draft?.noBadge ?? (u.task_no_badge ?? '__none__')}
                                                    onChange={e => setAssignDraft(prev => ({
                                                        ...prev,
                                                        [u.id]: {
                                                            noBadge: e.target.value,
                                                            badge: prev[u.id]?.badge ?? (u.task_badge ?? '__none__'),
                                                        },
                                                    }))}
                                                >
                                                    <option value="__none__">— None —</option>
                                                    {tasks.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            {/* Badge assignment */}
                                            <td>
                                                <select
                                                    className="ap-select ap-select--badge"
                                                    value={draft?.badge ?? (u.task_badge ?? '__none__')}
                                                    onChange={e => setAssignDraft(prev => ({
                                                        ...prev,
                                                        [u.id]: {
                                                            noBadge: prev[u.id]?.noBadge ?? (u.task_no_badge ?? '__none__'),
                                                            badge: e.target.value,
                                                        },
                                                    }))}
                                                >
                                                    <option value="__none__">— None —</option>
                                                    {tasks.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            {/* Save / Edit */}
                                            <td>
                                                <button
                                                    className={`ap-btn ap-btn--sm${isDirty ? ' ap-btn--primary' : ''}`}
                                                    onClick={() => isDirty ? handleAssign(u) : openDraft(u)}
                                                    style={isDirty ? {} : { background: 'transparent', borderColor: '#334155', color: '#64748b' }}
                                                >
                                                    {isDirty ? t('admin.saveButton') : t('admin.editButton')}
                                                </button>
                                            </td>
                                            <td>
                                                <div className="ap-inline-row">
                                                    <input
                                                        className="ap-input ap-input--sm"
                                                        type="password"
                                                        placeholder={t('admin.newPasswordPlaceholder')}
                                                        value={pwEditing[u.id] ?? ''}
                                                        onChange={e => setPwEditing(prev => ({ ...prev, [u.id]: e.target.value }))}
                                                    />
                                                    <button
                                                        className="ap-btn ap-btn--sm"
                                                        onClick={() => handleChangePw(u)}
                                                        disabled={!pwEditing[u.id]}
                                                    >
                                                        {t('admin.setButton')}
                                                    </button>
                                                </div>
                                            </td>
                                            <td>
                                                <button
                                                    className="ap-btn ap-btn--danger ap-btn--sm"
                                                    onClick={() => handleDelete(u)}
                                                >
                                                    {t('admin.deleteButton')}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>
        </div>
    );
};

export default AdminPanel;
