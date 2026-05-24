import React from 'react';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { EvaluationPoint, Parameters } from '../types';
import { PARAM_LABELS } from '../types';
import './CheckResults.css';

interface Props {
    history: EvaluationPoint[];
}

// Custom dot renderer
const renderDot = (
    props: { cx?: number; cy?: number },
    isLatent: boolean,
    type: 'formal' | 'informal',
) => {
    const { cx = 0, cy = 0 } = props;
    const color = type === 'formal' ? '#34d399' : '#fbbf24';
    const size = 3;
    return (
        <circle
            cx={cx}
            cy={cy}
            r={size}
            fill={isLatent ? color : 'transparent'}
            stroke={color}
            strokeWidth={isLatent ? 2 : 1.5}
            opacity={isLatent ? 1 : 0.65}
        />
    );
};

// Custom tooltip
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: EvaluationPoint }> }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="cr-tooltip">
            <p className="cr-tooltip-type">
                {d.type === 'formal' ? '🔬 Formal' : '⚡ Informal'}
                {d.isLatent ? ' · latent' : ' · previous'}
            </p>
            <p>Speed:    <strong>{d.speed.toFixed(1)}</strong></p>
            <p>Accuracy: <strong>{d.accuracy.toFixed(1)}</strong></p>
        </div>
    );
};

// Mini sparkline for parameter history
const ParamHistory: React.FC<{ history: EvaluationPoint[]; paramKey: keyof Parameters }> = ({
    history,
    paramKey,
}) => {
    const WIDTH = 140;
    const HEIGHT = 28;
    const RADIUS = 3.5;
    const PAD = 6;

    if (history.length === 0) {
        return <span className="cr-no-data">—</span>;
    }

    return (
        <svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
            {/* axis line */}
            <line x1={PAD} y1={HEIGHT / 2} x2={WIDTH - PAD} y2={HEIGHT / 2}
                stroke="#334155" strokeWidth={1} />
            {/* tick marks */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const x = PAD + t * (WIDTH - PAD * 2);
                return <line key={t} x1={x} y1={HEIGHT / 2 - 3} x2={x} y2={HEIGHT / 2 + 3}
                    stroke="#334155" strokeWidth={1} />;
            })}
            {/* dots for each evaluation */}
            {history.map((pt, idx) => {
                const val = pt.parameters[paramKey];
                const x = PAD + val * (WIDTH - PAD * 2);
                const color = pt.type === 'formal' ? '#34d399' : '#fbbf24';
                const r = pt.isLatent ? RADIUS + 1.5 : RADIUS;
                return (
                    <circle key={idx} cx={x} cy={HEIGHT / 2} r={r}
                        fill={pt.isLatent ? color : 'transparent'}
                        stroke={color}
                        strokeWidth={pt.isLatent ? 2 : 1.5}
                        opacity={pt.isLatent ? 1 : 0.7}
                    />
                );
            })}
        </svg>
    );
};

const CheckResults: React.FC<Props> = ({ history }) => {
    // Split into four series for recharts
    const formalPrev = history.filter((h) => h.type === 'formal' && !h.isLatent);
    const formalLatent = history.filter((h) => h.type === 'formal' && h.isLatent);
    const informalPrev = history.filter((h) => h.type === 'informal' && !h.isLatent);
    const informalLatent = history.filter((h) => h.type === 'informal' && h.isLatent);

    const makeDot = (isLatent: boolean, type: 'formal' | 'informal') =>
        (props: { cx?: number; cy?: number }) => renderDot(props, isLatent, type);

    return (
        <div className="cr-root">
            <h2 className="cr-title">Check &amp; Analyze Results</h2>

            {/* ── Scatter plot ── */}
            <section className="cr-section">
                <h3 className="cr-section-title">Check Results</h3>
                <div className="cr-chart-wrap">
                    {history.length === 0 ? (
                        <div className="cr-empty">No evaluations yet.<br />Run an evaluation to see results.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 10, right: 10, bottom: 40, left: 10 }}>
                                <CartesianGrid stroke="#1e293b" />
                                <XAxis
                                    type="number" dataKey="speed"
                                    name="Speed" domain={[0, 100]}
                                    label={{ value: 'Speed', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 11 }}
                                    tick={{ fill: '#475569', fontSize: 10 }}
                                    tickLine={false}
                                />
                                <YAxis
                                    type="number" dataKey="accuracy"
                                    name="Accuracy" domain={[0, 100]}
                                    label={{ value: 'Accuracy', angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 11 }}
                                    tick={{ fill: '#475569', fontSize: 10 }}
                                    tickLine={false}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#334155' }} />
                                <Legend
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: '0.7rem', color: '#64748b', paddingTop: '16px' }}
                                />
                                <Scatter name="Formal · previous" data={formalPrev} shape={makeDot(false, 'formal')} />
                                <Scatter name="Formal · latent" data={formalLatent} shape={makeDot(true, 'formal')} />
                                <Scatter name="Informal · previous" data={informalPrev} shape={makeDot(false, 'informal')} />
                                <Scatter name="Informal · latent" data={informalLatent} shape={makeDot(true, 'informal')} />
                            </ScatterChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </section>

            {/* ── Parameter history ── */}
            <section className="cr-section cr-section--params">
                <h3 className="cr-section-title">Parameters Explored So Far</h3>
                {history.length === 0 ? (
                    <p className="cr-empty-small">No data yet.</p>
                ) : (
                    <div className="cr-param-table">
                        {(Object.keys(PARAM_LABELS) as Array<keyof Parameters>).map((key) => (
                            <div key={key} className="cr-param-row">
                                <span className="cr-param-name">{PARAM_LABELS[key]}</span>
                                <div className="cr-param-chart">
                                    <ParamHistory history={history} paramKey={key} />
                                    <div className="cr-axis-labels">
                                        <span>0</span><span>0.5</span><span>1</span>
                                    </div>
                                </div>
                                <span className="cr-param-count">n={history.length}</span>
                            </div>
                        ))}
                        <div className="cr-param-legend">
                            <span className="cr-dot cr-dot--formal-filled" /> Formal·latent
                            <span className="cr-dot cr-dot--formal-empty" /> Formal·prev
                            <span className="cr-dot cr-dot--informal-filled" /> Informal·latent
                            <span className="cr-dot cr-dot--informal-empty" /> Informal·prev
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};

export default CheckResults;
