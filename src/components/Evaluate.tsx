import React from 'react';
import type { EvaluationType } from '../types';
import './Evaluate.css';

interface Props {
    isEvaluating: boolean;
    evaluatingType: EvaluationType | null;
    onEvaluate: (type: EvaluationType) => void;
}

const Evaluate: React.FC<Props> = ({ isEvaluating, evaluatingType, onEvaluate }) => {
    return (
        <div className="ev-root">
            <h2 className="ev-title">Evaluate</h2>

            <div className="ev-cards">
                {/* Informal */}
                <div className="ev-card ev-card--informal">
                    <div className="ev-card-header">
                        <span className="ev-icon">⚡</span>
                        <span className="ev-card-name">Informal</span>
                    </div>
                    <p className="ev-card-desc">
                        Fast probe (~3 s). Returns a quick estimate with higher noise.
                        Good for rapid exploration.
                    </p>
                    <div className="ev-noise-indicator">
                        <span className="ev-noise-label">Noise level</span>
                        <div className="ev-noise-bar">
                            <div className="ev-noise-fill ev-noise-fill--high" style={{ width: '75%' }} />
                        </div>
                        <span className="ev-noise-val">High</span>
                    </div>
                    <button
                        className="ev-btn ev-btn--informal"
                        disabled={isEvaluating}
                        onClick={() => onEvaluate('informal')}
                    >
                        {isEvaluating && evaluatingType === 'informal' ? (
                            <span className="ev-spinner">Evaluating…</span>
                        ) : 'Run Informal Evaluation'}
                    </button>
                </div>

                {/* Formal */}
                <div className="ev-card ev-card--formal">
                    <div className="ev-card-header">
                        <span className="ev-icon">🔬</span>
                        <span className="ev-card-name">Formal</span>
                    </div>
                    <p className="ev-card-desc">
                        Precise measurement (~20 s). Low noise, high confidence.
                        Use when you want reliable data.
                    </p>
                    <div className="ev-noise-indicator">
                        <span className="ev-noise-label">Noise level</span>
                        <div className="ev-noise-bar">
                            <div className="ev-noise-fill ev-noise-fill--low" style={{ width: '20%' }} />
                        </div>
                        <span className="ev-noise-val">Low</span>
                    </div>
                    <button
                        className="ev-btn ev-btn--formal"
                        disabled={isEvaluating}
                        onClick={() => onEvaluate('formal')}
                    >
                        {isEvaluating && evaluatingType === 'formal' ? (
                            <span className="ev-spinner">Evaluating…</span>
                        ) : 'Run Formal Evaluation'}
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
                            ? 'Running informal probe… (~3 s)'
                            : 'Running formal evaluation… (~20 s)'}
                    </p>
                </div>
            )}

        </div>
    );
};

export default Evaluate;
