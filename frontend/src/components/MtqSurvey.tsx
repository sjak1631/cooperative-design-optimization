import React, { useState } from 'react';
import { submitMtq } from '../api/client';
import './MtqSurvey.css';

// ── Question definitions ──────────────────────────────────────────────────────

interface Question {
    key: string;
    text: string;
    reversed: boolean;
}

interface Dimension {
    key: string;
    label: string;
    labelEn: string;
    questions: Question[];
}

const DIMENSIONS: Dimension[] = [
    {
        key: 'purpose',
        label: '目的性',
        labelEn: 'Purpose',
        questions: [
            { key: 'purpose_q1', text: 'このシステムの意図はポジティブである。', reversed: false },
            { key: 'purpose_q2', text: 'このシステムは全体的なパフォーマンスの向上を助けることを意図している。', reversed: false },
            { key: 'purpose_q3', text: 'このシステムは私を助けるために実装されている。', reversed: false },
        ],
    },
    {
        key: 'transparency',
        label: '透明性',
        labelEn: 'Transparency',
        questions: [
            { key: 'transparency_q1', text: 'システムがどのように動作しているかは私にとって明確である。', reversed: false },
            { key: 'transparency_q2', text: '私はシステムがどのように動作しているかについて十分に知らされている。', reversed: false },
            { key: 'transparency_q3', text: '私はシステムの動作方法を理解している。', reversed: false },
        ],
    },
    {
        key: 'utility',
        label: '有用性',
        labelEn: 'Utility',
        questions: [
            { key: 'utility_q1', text: 'このシステムは私の作業をより難しくする。', reversed: true },
            { key: 'utility_q2', text: 'このシステムは私の作業に役立つ。', reversed: false },
            { key: 'utility_q3', text: 'このシステムは私の作業を支援していると思う。', reversed: false },
        ],
    },
];

const LIKERT_LABELS = [
    { value: 1, label: '全く同意しない' },
    { value: 2, label: '同意しない' },
    { value: 3, label: '同意する' },
    { value: 4, label: '強く同意する' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
    sessionId: number;
    onComplete: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

type Step = 'survey' | 'submitting' | 'done';

const ALL_QUESTION_KEYS = DIMENSIONS.flatMap((d) => d.questions.map((q) => q.key));

const MtqSurvey: React.FC<Props> = ({ sessionId, onComplete }) => {
    const [step, setStep] = useState<Step>('survey');
    const [responses, setResponses] = useState<Record<string, number | null>>(
        Object.fromEntries(ALL_QUESTION_KEYS.map((k) => [k, null])),
    );
    const [error, setError] = useState('');

    const allAnswered = ALL_QUESTION_KEYS.every((k) => responses[k] !== null);

    const handleSelect = (key: string, value: number) => {
        setResponses((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async () => {
        if (!allAnswered) return;
        setStep('submitting');
        setError('');
        try {
            await submitMtq({
                session_id: sessionId,
                purpose_q1: responses['purpose_q1']!,
                purpose_q2: responses['purpose_q2']!,
                purpose_q3: responses['purpose_q3']!,
                transparency_q1: responses['transparency_q1']!,
                transparency_q2: responses['transparency_q2']!,
                transparency_q3: responses['transparency_q3']!,
                utility_q1: responses['utility_q1']!,
                utility_q2: responses['utility_q2']!,
                utility_q3: responses['utility_q3']!,
            });
            setStep('done');
        } catch (e) {
            setError(e instanceof Error ? e.message : '送信に失敗しました');
            setStep('survey');
        }
    };

    if (step === 'submitting') {
        return (
            <div className="mtq-root">
                <div className="mtq-card mtq-card--center">
                    <div className="mtq-spinner" />
                    <p className="mtq-subtitle">送信中…</p>
                </div>
            </div>
        );
    }

    if (step === 'done') {
        return (
            <div className="mtq-root">
                <div className="mtq-card mtq-card--center">
                    <div className="mtq-done-icon">✅</div>
                    <h1 className="mtq-title">アンケート完了</h1>
                    <p className="mtq-subtitle">ご回答ありがとうございました。</p>
                    <button className="mtq-btn mtq-btn--primary" onClick={onComplete}>
                        続ける →
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mtq-root">
            <div className="mtq-card">
                <div className="mtq-header">
                    <div className="mtq-step-badge">信頼性アンケート</div>
                    <h1 className="mtq-title">MTQ — システムへの信頼評価</h1>
                    <p className="mtq-subtitle">
                        各項目について、このタスクで使用したシステムへの印象を選んでください。
                    </p>
                </div>

                {error && <p className="mtq-error">{error}</p>}

                <div className="mtq-dimensions">
                    {DIMENSIONS.map((dim) => (
                        <div key={dim.key} className="mtq-dimension">
                            <div className="mtq-dim-heading">
                                <span className="mtq-dim-label">{dim.label}</span>
                                <span className="mtq-dim-en">({dim.labelEn})</span>
                            </div>

                            <div className="mtq-questions">
                                {dim.questions.map((q, qi) => (
                                    <div key={q.key} className="mtq-question">
                                        <p className="mtq-question-text">
                                            <span className="mtq-q-index">Q{qi + 1}.</span>
                                            {q.text}
                                            {q.reversed && (
                                                <span className="mtq-reversed-badge">逆転項目</span>
                                            )}
                                        </p>
                                        <div className="mtq-likert">
                                            {LIKERT_LABELS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    className={`mtq-likert-btn${responses[q.key] === opt.value ? ' mtq-likert-btn--selected' : ''}`}
                                                    onClick={() => handleSelect(q.key, opt.value)}
                                                >
                                                    <span className="mtq-likert-num">{opt.value}</span>
                                                    <span className="mtq-likert-label">{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mtq-footer">
                    {!allAnswered && (
                        <p className="mtq-warn">すべての項目に回答してください</p>
                    )}
                    <button
                        className="mtq-btn mtq-btn--primary"
                        onClick={handleSubmit}
                        disabled={!allAnswered}
                    >
                        送信 →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MtqSurvey;
