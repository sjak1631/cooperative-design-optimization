import React, { useState } from 'react';
import { login } from '../api/client';
import { useI18n } from '../context/i18nContext';
import './Login.css';

interface Props {
    onLogin: (participantId: string) => void;
}

const Login: React.FC<Props> = ({ onLogin }) => {
    const { t } = useI18n();
    const [participantId, setParticipantId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await login(participantId.trim(), password);
            sessionStorage.setItem('access_token', res.access_token);
            sessionStorage.setItem('participant_id', res.participant_id);
            onLogin(res.participant_id);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Login failed';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-root">
            <div className="login-card">
                <div className="login-logo">{t('app.logo')}</div>
                <h1 className="login-title">{t('login.title')}</h1>
                <p className="login-subtitle">
                    {t('login.subtitle')}
                </p>

                <form className="login-form" onSubmit={handleSubmit}>
                    <label className="login-label">
                        {t('login.participantId')}
                        <input
                            className="login-input"
                            type="text"
                            value={participantId}
                            onChange={(e) => setParticipantId(e.target.value)}
                            placeholder={t('login.participantIdPlaceholder')}
                            autoComplete="username"
                            required
                        />
                    </label>
                    <label className="login-label">
                        {t('login.password')}
                        <input
                            className="login-input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </label>

                    {error && <p className="login-error">{error}</p>}

                    <button className="login-btn" type="submit" disabled={loading}>
                        {loading ? t('login.signingIn') : t('login.signIn')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
