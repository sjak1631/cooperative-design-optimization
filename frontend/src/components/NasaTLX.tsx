import React, { useState } from 'react';
import { submitNasaTlx } from '../api/client';
import type { PairwiseChoice } from '../api/types';
import './NasaTLX.css';

// ── Dimension definitions ────────────────────────────────────────────────────

interface Dimension {
    key: string;
    label: string;
    labelJa: string;
    lowLabel: string;
    highLabel: string;
    description: string;
    reversed?: boolean;
}

const DIMS: Dimension[] = [
    {
        key: 'MD',
        label: 'Mental Demand',
        labelJa: '精神的要求',
        lowLabel: '低',
        highLabel: '高',
        description: 'このタスクはどの程度の精神的・知覚的活動（考える、決める、計算する、覚える、見る、探すなど）を必要としましたか？',
    },
    {
        key: 'PD',
        label: 'Physical Demand',
        labelJa: '身体的要求',
        lowLabel: '低',
        highLabel: '高',
        description: 'このタスクはどの程度の身体的活動（押す、引く、回す、動かす、操作するなど）を必要としましたか？',
    },
    {
        key: 'TD',
        label: 'Temporal Demand',
        labelJa: '時間的切迫感',
        lowLabel: '低',
        highLabel: '高',
        description: 'タスクのペースや速度の速さによって感じた時間的プレッシャーはどの程度でしたか？',
    },
    {
        key: 'P',
        label: 'Performance',
        labelJa: '達成度',
        lowLabel: '良好',
        highLabel: '不良',
        description: '自分自身で設定した目標に対して、どの程度達成できたと思いますか？',
        reversed: true,
    },
    {
        key: 'EF',
        label: 'Effort',
        labelJa: '努力',
        lowLabel: '低',
        highLabel: '高',
        description: '目標を達成するために、精神的・身体的にどの程度頑張る必要がありましたか？',
    },
    {
        key: 'FR',
        label: 'Frustration',
        labelJa: 'フラストレーション',
        lowLabel: '低',
        highLabel: '高',
        description: 'タスク中に、安心・満足・リラックス・落ち着きに対して、不安・落胆・苛立ち・ストレス・煩わしさをどの程度感じましたか？',
    },
];

// ── All 15 pairwise combinations ─────────────────────────────────────────────

const ALL_PAIRS: [string, string][] = (() => {
    const pairs: [string, string][] = [];
    for (let i = 0; i < DIMS.length; i++) {
        for (let j = i + 1; j < DIMS.length; j++) {
            pairs.push([DIMS[i].key, DIMS[j].key]);
        }
    }
    return pairs;
})();

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
    sessionId: number;
    onComplete: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

type Step = 'ratings' | 'pairwise' | 'submitting' | 'done';

const NasaTLX: React.FC<Props> = ({ sessionId, onComplete }) => {
    const [step, setStep] = useState<Step>('ratings');
    const [ratings, setRatings] = useState<Record<string, number>>({
        MD: 50, PD: 50, TD: 50, P: 50, EF: 50, FR: 50,
    });
    const [pairIndex, setPairIndex] = useState(0);
    const [choices, setChoices] = useState<PairwiseChoice[]>([]);
    const [error, setError] = useState('');

    const dimByKey = (key: string) => DIMS.find((d) => d.key === key)!;

    // ── Rating phase ────────────────────────────────────────────────────────────

    const handleSliderChange = (key: string, value: number) => {
        setRatings((prev) => ({ ...prev, [key]: value }));
    };

    const handleRatingsDone = () => {
        setStep('pairwise');
        setPairIndex(0);
        setChoices([]);
    };

    // ── Pairwise phase ──────────────────────────────────────────────────────────

    const handlePairChoice = (chosen: string) => {
        const pair = ALL_PAIRS[pairIndex];
        const newChoices = [...choices, { pair: pair as [string, string], chosen }];
        setChoices(newChoices);
        if (pairIndex + 1 < ALL_PAIRS.length) {
            setPairIndex((i) => i + 1);
        } else {
            handleSubmit(newChoices);
        }
    };

    // ── Submit ──────────────────────────────────────────────────────────────────

    const handleSubmit = async (finalChoices: PairwiseChoice[]) => {
        setStep('submitting');
        setError('');
        try {
            await submitNasaTlx({
                session_id: sessionId,
                mental_demand: ratings['MD'],
                physical_demand: ratings['PD'],
                temporal_demand: ratings['TD'],
                performance: ratings['P'],
                effort: ratings['EF'],
                frustration: ratings['FR'],
                pairwise_choices: finalChoices,
            });
            setStep('done');
        } catch (e) {
            setError(e instanceof Error ? e.message : '送信に失敗しました');
            setStep('pairwise');
            setChoices([]);
            setPairIndex(0);
        }
    };

    // ── Render: Ratings ─────────────────────────────────────────────────────────

    if (step === 'ratings') {
        return (
            <div className="tlx-root">
                <div className="tlx-card">
                    <div className="tlx-header">
                        <div className="tlx-step-badge">ステップ 1 / 2</div>
                        <h1 className="tlx-title">NASA-TLX ワークロード評価</h1>
                        <p className="tlx-subtitle">
                            各項目について、このタスクでの体験を 0〜100 のスライダーで評価してください。
                        </p>
                    </div>

                    <div className="tlx-sliders">
                        {DIMS.map((dim) => (
                            <div key={dim.key} className="tlx-slider-row">
                                <div className="tlx-dim-header">
                                    <span className="tlx-dim-label">{dim.labelJa}</span>
                                    <span className="tlx-dim-en">({dim.label})</span>
                                    {dim.reversed && (
                                        <span className="tlx-reversed-badge">逆転項目</span>
                                    )}
                                    <span className="tlx-dim-value">{ratings[dim.key]}</span>
                                </div>
                                <p className="tlx-dim-desc">{dim.description}</p>
                                <div className="tlx-slider-track">
                                    <span className="tlx-range-label">{dim.lowLabel}</span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={ratings[dim.key]}
                                        onChange={(e) => handleSliderChange(dim.key, Number(e.target.value))}
                                        className="tlx-slider"
                                    />
                                    <span className="tlx-range-label tlx-range-label--right">{dim.highLabel}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button className="tlx-btn tlx-btn--primary" onClick={handleRatingsDone}>
                        次へ：比較タスク →
                    </button>
                </div>
            </div>
        );
    }

    // ── Render: Pairwise ────────────────────────────────────────────────────────

    if (step === 'pairwise') {
        const pair = ALL_PAIRS[pairIndex];
        const dimA = dimByKey(pair[0]);
        const dimB = dimByKey(pair[1]);
        const progress = ((pairIndex) / ALL_PAIRS.length) * 100;

        return (
            <div className="tlx-root">
                <div className="tlx-card">
                    <div className="tlx-header">
                        <div className="tlx-step-badge">ステップ 2 / 2 — {pairIndex + 1} / {ALL_PAIRS.length}</div>
                        <h1 className="tlx-title">重み付け：ペア比較</h1>
                        <p className="tlx-subtitle">
                            2つの項目のうち、このタスクのワークロードに<strong>より大きく寄与した</strong>と思う方を選んでください。
                        </p>
                    </div>

                    <div className="tlx-progress-bar">
                        <div className="tlx-progress-fill" style={{ width: `${progress}%` }} />
                    </div>

                    {error && <p className="tlx-error">{error}</p>}

                    <div className="tlx-pair-container">
                        <button
                            className="tlx-pair-btn"
                            onClick={() => handlePairChoice(dimA.key)}
                        >
                            <span className="tlx-pair-label">{dimA.labelJa}</span>
                            <span className="tlx-pair-en">{dimA.label}</span>
                            <span className="tlx-pair-desc">{dimA.description}</span>
                        </button>

                        <div className="tlx-pair-vs">VS</div>

                        <button
                            className="tlx-pair-btn"
                            onClick={() => handlePairChoice(dimB.key)}
                        >
                            <span className="tlx-pair-label">{dimB.labelJa}</span>
                            <span className="tlx-pair-en">{dimB.label}</span>
                            <span className="tlx-pair-desc">{dimB.description}</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Render: Submitting ──────────────────────────────────────────────────────

    if (step === 'submitting') {
        return (
            <div className="tlx-root">
                <div className="tlx-card tlx-card--center">
                    <div className="tlx-spinner" />
                    <p className="tlx-subtitle">送信中…</p>
                </div>
            </div>
        );
    }

    // ── Render: Done ────────────────────────────────────────────────────────────

    return (
        <div className="tlx-root">
            <div className="tlx-card tlx-card--center">
                <div className="tlx-done-icon">✅</div>
                <h1 className="tlx-title">アンケート完了</h1>
                <p className="tlx-subtitle">ご回答ありがとうございました。</p>
                <button className="tlx-btn tlx-btn--primary" onClick={onComplete}>
                    続ける →
                </button>
            </div>
        </div>
    );
};

export default NasaTLX;
