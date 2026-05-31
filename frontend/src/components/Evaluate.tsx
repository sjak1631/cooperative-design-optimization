import React from 'react';
import type { EvalType } from '../api/types';
import { useI18n } from '../context/i18nContext';
import './Evaluate.css';

interface Props {
    isEvaluating: boolean;
    evaluatingType: EvalType | null;
    onEvaluate: (type: EvalType) => void;
    onCancel: () => void;
}

const Evaluate: React.FC<Props> = ({ isEvaluating, evaluatingType, onEvaluate, onCancel }) => {
    const { t } = useI18n();
    return (
        <div className="ev-root">
            <h2 className="ev-title">{t('panels.evaluate')}</h2>

            <div className="ev-cards">
                {/* Informal */}
                <div className="ev-card ev-card--informal">
                    <div className="ev-card-header">
                        <span className="ev-icon">⚡</span>
                        <span className="ev-card-name">{t('evaluate.informal')}</span>
                    </div>
                    <p className="ev-card-desc">
                        {t('evaluate.informalDescription')}
                    </p>
                    <div className="ev-noise-indicator">
                        <span className="ev-noise-label">{t('evaluate.noiseLevel')}</span>
                        <div className="ev-noise-bar">
                            <div className="ev-noise-fill ev-noise-fill--high" style={{ width: '75%' }} />
                        </div>
                        <span className="ev-noise-val">{t('evaluate.high')}</span>
                    </div>
                    <button
                        className={`ev-btn ${isEvaluating && evaluatingType === 'informal' ? 'ev-btn--cancel-inline' : 'ev-btn--informal'}`}
                        disabled={isEvaluating && evaluatingType !== 'informal'}
                        onClick={() => isEvaluating && evaluatingType === 'informal' ? onCancel() : onEvaluate('informal')}
                    >
                        {isEvaluating && evaluatingType === 'informal' ? (
                            <span className="ev-spinner">{t('evaluate.cancel')}</span>
                        ) : t('evaluate.runInformal')}
                    </button>
                </div>

                {/* Formal */}
                <div className="ev-card ev-card--formal">
                    <div className="ev-card-header">
                        <span className="ev-icon">🔬</span>
                        <span className="ev-card-name">{t('evaluate.formal')}</span>
                    </div>
                    <p className="ev-card-desc">
                        {t('evaluate.formalDescription')}
                    </p>
                    <div className="ev-noise-indicator">
                        <span className="ev-noise-label">{t('evaluate.noiseLevel')}</span>
                        <div className="ev-noise-bar">
                            <div className="ev-noise-fill ev-noise-fill--low" style={{ width: '20%' }} />
                        </div>
                        <span className="ev-noise-val">{t('evaluate.low')}</span>
                    </div>
                    <button
                        className={`ev-btn ${isEvaluating && evaluatingType === 'formal' ? 'ev-btn--cancel-inline' : 'ev-btn--formal'}`}
                        disabled={isEvaluating && evaluatingType !== 'formal'}
                        onClick={() => isEvaluating && evaluatingType === 'formal' ? onCancel() : onEvaluate('formal')}
                    >
                        {isEvaluating && evaluatingType === 'formal' ? (
                            <span className="ev-spinner">{t('evaluate.cancel')}</span>
                        ) : t('evaluate.runFormal')}
                    </button>
                </div>
            </div>

            {isEvaluating && (
                <div className="ev-progress">
                    <div className="ev-progress-bar">
                        <div
                            className={`ev-progress-fill ev-progress-fill--${evaluatingType}`}
                        />
                    </div>
                    <p className="ev-progress-label">
                        {evaluatingType === 'informal'
                            ? t('evaluate.runningInformal')
                            : t('evaluate.runningFormal')}
                    </p>
                </div>
            )}

        </div>
    );
};

export default Evaluate;
