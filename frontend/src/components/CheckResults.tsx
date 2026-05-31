import React, { useState, useCallback, useMemo } from 'react';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { EvaluationPoint, Parameters } from '../types';
import { useI18n } from '../context/i18nContext';
import './CheckResults.css';

// Compute Pareto front indices (maximise both objectives)
function computeParetoFront(points: { speed: number; accuracy: number }[]): number[] {
    const n = points.length;
    const dominated = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i === j) continue;
            if (points[j].speed >= points[i].speed && points[j].accuracy >= points[i].accuracy &&
                (points[j].speed > points[i].speed || points[j].accuracy > points[i].accuracy)) {
                dominated[i] = true;
                break;
            }
        }
    }
    return points.map((_, i) => i).filter((i) => !dominated[i]);
}

interface Props {
    history: EvaluationPoint[];
    currentParams: Parameters;
    onRestoreParams?: (params: Parameters) => void;
    metricLabels?: { x: string; y: string };
}

// Custom dot renderer
const renderDot = (
    props: { cx?: number; cy?: number; parameters?: Parameters; id?: number },
    isLatest: boolean,
    color: string,
    selectedId: number | null,
    hoveredId: number | null,
    onHover: (id: number | null) => void,
    onRestoreParams?: (params: Parameters, id: number) => void,
) => {
    const { cx = 0, cy = 0, parameters, id } = props;
    const isSelected = id !== undefined && id === selectedId;
    const isHovered = id !== undefined && id === hoveredId;
    const dimmed = hoveredId !== null && !isHovered;
    const size = isSelected || isHovered ? 7 : 3;
    const clickable = !!onRestoreParams && !!parameters && id !== undefined;
    return (
        <g
            cursor={clickable ? 'pointer' : undefined}
            onClick={clickable ? () => onRestoreParams!(parameters!, id!) : undefined}
            onMouseEnter={id !== undefined ? () => onHover(id) : undefined}
            onMouseLeave={() => onHover(null)}
        >
            {clickable && <circle cx={cx} cy={cy} r={10} fill="transparent" stroke="none" />}
            <circle
                cx={cx}
                cy={cy}
                r={size}
                fill={isLatest ? color : 'transparent'}
                stroke={color}
                strokeWidth={isSelected || isHovered ? 2.5 : isLatest ? 2 : 1.5}
                opacity={dimmed ? 0.1 : (isLatest || isSelected || isHovered ? 1 : 0.65)}
                style={{ transition: 'opacity 0.12s, r 0.12s' }}
            />
        </g>
    );
};

// Custom tooltip
const CustomTooltip = ({ active, payload, xLabel, yLabel }: { active?: boolean; payload?: Array<{ payload: EvaluationPoint }>; xLabel: string; yLabel: string }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="cr-tooltip">
            <p className="cr-tooltip-type">
                {d.type === 'formal' ? '🔬 ' : '⚡ '}
                {d.type === 'formal' ? 'Formal' : 'Informal'}
                {d.isLatent ? ' · latest' : ' · previous'}
            </p>
            <p>{xLabel}: <strong>{d.speed.toFixed(3)}</strong></p>
            <p>{yLabel}: <strong>{d.accuracy.toFixed(3)}</strong></p>
        </div>
    );
};

// PCP color palette
const PCP_COLORS = {
    current: '#f8fafc',
    pareto: '#7dd3fc',
    formalLatest: '#34d399',
    formalPrev: '#34d399',
    informalLatest: '#fbbf24',
    informalPrev: '#fbbf24',
};

// Parallel Coordinates Plot — vertical layout (params as rows)
const ParallelCoordinates: React.FC<{
    history: EvaluationPoint[];
    currentParams: Parameters;
    paretoIds: Set<number>;
    latestFormalId: number | null;
    latestInformalId: number | null;
    hoveredId: number | null;
}> = ({ history, currentParams, paretoIds, latestFormalId, latestInformalId, hoveredId }) => {
    const paramKeys = useMemo(() => {
        if (history.length === 0) return [] as Array<keyof Parameters>;
        return Object.keys(history[0].parameters) as Array<keyof Parameters>;
    }, [history]);

    const ROW_H = 34;
    const PAD_L = 72, PAD_R = 18, PAD_T = 14, PAD_B = 14;
    const n = paramKeys.length;
    const W = 400;
    const H = n <= 1 ? PAD_T + PAD_B + ROW_H : PAD_T + PAD_B + (n - 1) * ROW_H;
    const innerW = W - PAD_L - PAD_R;

    const axisY = (i: number) => n <= 1 ? PAD_T : PAD_T + i * ROW_H;
    const valueX = (v: number) => PAD_L + Math.max(0, Math.min(1, v)) * innerW;

    const makePath = (params: Parameters) =>
        paramKeys.map((k, i) => {
            const v = (params as Record<string, number>)[k as string] ?? 0.5;
            return `${i === 0 ? 'M' : 'L'}${valueX(v).toFixed(1)},${axisY(i).toFixed(1)}`;
        }).join(' ');

    const formalPrev = history.filter(h => h.type === 'formal' && h.id !== latestFormalId && !paretoIds.has(h.id));
    const formalLatest = history.filter(h => h.type === 'formal' && h.id === latestFormalId && !paretoIds.has(h.id));
    const informalPrev = history.filter(h => h.type === 'informal' && h.id !== latestInformalId);
    const informalLatest = history.filter(h => h.type === 'informal' && h.id === latestInformalId);
    const paretoHistory = history.filter(h => paretoIds.has(h.id));

    if (paramKeys.length === 0) return null;

    // Opacity helpers based on hover state
    const lineOp = (h: EvaluationPoint, baseOp: number) => {
        if (hoveredId === null) return baseOp;
        return h.id === hoveredId ? 1 : 0.04;
    };

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* Scale labels on top axis */}
            {[0, 0.5, 1].map(t => (
                <text key={t} x={valueX(t)} y={PAD_T - 4}
                    textAnchor="middle" fill="#475569" fontSize={8}>{t}</text>
            ))}

            {/* Axes (horizontal lines per parameter) */}
            {paramKeys.map((k, i) => (
                <g key={String(k)}>
                    <line x1={PAD_L} y1={axisY(i)} x2={PAD_L + innerW} y2={axisY(i)}
                        stroke="#334155" strokeWidth={1} />
                    {[0, 0.5, 1].map(t => (
                        <line key={t}
                            x1={valueX(t)} y1={axisY(i) - 3}
                            x2={valueX(t)} y2={axisY(i) + 3}
                            stroke="#475569" strokeWidth={1} />
                    ))}
                    <text x={PAD_L - 6} y={axisY(i) + 4}
                        textAnchor="end" fill="#64748b" fontSize={9} fontFamily="monospace">
                        {String(k)}
                    </text>
                </g>
            ))}

            {/* Lines — drawn back-to-front */}
            {informalPrev.map(h => (
                <path key={h.id} d={makePath(h.parameters)}
                    fill="none" stroke={PCP_COLORS.informalPrev}
                    strokeWidth={1} strokeDasharray="3 3"
                    opacity={lineOp(h, 0.3)}
                    style={{ transition: 'opacity 0.12s' }} />
            ))}
            {formalPrev.map(h => (
                <path key={h.id} d={makePath(h.parameters)}
                    fill="none" stroke={PCP_COLORS.formalPrev}
                    strokeWidth={1} strokeDasharray="3 3"
                    opacity={lineOp(h, 0.3)}
                    style={{ transition: 'opacity 0.12s' }} />
            ))}
            {informalLatest.map(h => (
                <path key={h.id} d={makePath(h.parameters)}
                    fill="none" stroke={PCP_COLORS.informalLatest}
                    strokeWidth={h.id === hoveredId ? 2 : 1}
                    opacity={lineOp(h, 0.3)}
                    style={{ transition: 'opacity 0.12s' }} />
            ))}
            {formalLatest.map(h => (
                <path key={h.id} d={makePath(h.parameters)}
                    fill="none" stroke={PCP_COLORS.formalLatest}
                    strokeWidth={h.id === hoveredId ? 2 : 1}
                    opacity={lineOp(h, 0.3)}
                    style={{ transition: 'opacity 0.12s' }} />
            ))}
            {paretoHistory.map(h => (
                <path key={h.id} d={makePath(h.parameters)}
                    fill="none" stroke={PCP_COLORS.pareto}
                    strokeWidth={h.id === hoveredId ? 3 : 2.5}
                    opacity={lineOp(h, 1)}
                    style={{ transition: 'opacity 0.12s' }} />
            ))}
            {/* Current slider — always fully visible */}
            <path d={makePath(currentParams)}
                fill="none" stroke={PCP_COLORS.current}
                strokeWidth={2.5}
                opacity={hoveredId !== null ? 0.3 : 1}
                strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: 'opacity 0.12s' }} />
        </svg>
    );
};

const CheckResults: React.FC<Props> = ({ history, currentParams, onRestoreParams, metricLabels }) => {
    const { t } = useI18n();
    const xLabel = metricLabels?.x ?? t('checkResults.speed');
    const yLabel = metricLabels?.y ?? t('checkResults.accuracy');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [hoveredId, setHoveredId] = useState<number | null>(null);

    const handleRestore = useCallback((params: Parameters, id: number) => {
        onRestoreParams?.(params);
        setSelectedId(id);
    }, [onRestoreParams]);

    // Pareto front from formal evaluations only
    const formalHistory = history.filter((h) => h.type === 'formal');
    const paretoIndices = new Set(computeParetoFront(formalHistory));
    const paretoPoints = formalHistory.filter((_, i) => paretoIndices.has(i));
    const paretoIds = new Set(Array.from(paretoIndices).map(i => formalHistory[i].id));
    const sortedParetoPoints = [...paretoPoints].sort((a, b) => a.speed - b.speed);

    // Compute latest per type independently on the frontend
    const informalHistory = history.filter((h) => h.type === 'informal');
    const latestFormalId = formalHistory.length > 0 ? Math.max(...formalHistory.map(h => h.id)) : null;
    const latestInformalId = informalHistory.length > 0 ? Math.max(...informalHistory.map(h => h.id)) : null;

    // Split into series for recharts (pareto separated)
    const formalPrev = history.filter((h) => h.type === 'formal' && h.id !== latestFormalId && !paretoIds.has(h.id));
    const formalLatest = history.filter((h) => h.type === 'formal' && h.id === latestFormalId && !paretoIds.has(h.id));
    const informalPrev = history.filter((h) => h.type === 'informal' && h.id !== latestInformalId);
    const informalLatest = history.filter((h) => h.type === 'informal' && h.id === latestInformalId);

    const makeDot = (isLatest: boolean, color: string) =>
        (props: { cx?: number; cy?: number; parameters?: Parameters; id?: number }) =>
            renderDot(props, isLatest, color, selectedId, hoveredId, setHoveredId, onRestoreParams ? handleRestore : undefined);

    return (
        <div className="cr-root">
            <h2 className="cr-title">{t('panels.checkResults')}</h2>

            {/* ── Scatter plot ── */}
            <section className="cr-section">
                <h3 className="cr-section-title">
                    {t('checkResults.checkResults')}
                    {onRestoreParams && (
                        <span className="cr-hint">{t('checkResults.clickHint')}</span>
                    )}
                </h3>
                <div className="cr-chart-wrap">
                    {history.length === 0 ? (
                        <div className="cr-empty">{t('checkResults.noEvaluations')}</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                                <CartesianGrid stroke="#1e293b" />
                                <XAxis
                                    type="number" dataKey="speed"
                                    name={xLabel} domain={[0, 1]}
                                    label={{ value: xLabel, position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 11 }}
                                    tick={{ fill: '#475569', fontSize: 10 }}
                                    tickLine={false}
                                />
                                <YAxis
                                    type="number" dataKey="accuracy"
                                    name={yLabel} domain={[0, 1]}
                                    label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 11 }}
                                    tick={{ fill: '#475569', fontSize: 10 }}
                                    tickLine={false}
                                />
                                <Tooltip content={<CustomTooltip xLabel={xLabel} yLabel={yLabel} />} cursor={{ stroke: '#334155' }} />
                                {sortedParetoPoints.length > 1 && sortedParetoPoints.slice(0, -1).map((pt, i) => (
                                    <ReferenceLine
                                        key={i}
                                        segment={[
                                            { x: pt.speed, y: pt.accuracy },
                                            { x: sortedParetoPoints[i + 1].speed, y: sortedParetoPoints[i + 1].accuracy },
                                        ]}
                                        stroke="#7dd3fc"
                                        strokeWidth={2}
                                        opacity={0.85}
                                    />
                                ))}
                                <Scatter name="Formal · previous" data={formalPrev} shape={makeDot(false, '#34d399')} />
                                <Scatter name="Formal · latest" data={formalLatest} shape={makeDot(true, '#34d399')} />
                                <Scatter name="Informal · previous" data={informalPrev} shape={makeDot(false, '#fbbf24')} />
                                <Scatter name="Informal · latest" data={informalLatest} shape={makeDot(true, '#fbbf24')} />
                                <Scatter name="Pareto front" data={paretoPoints} shape={makeDot(true, '#7dd3fc')} />
                            </ScatterChart>
                        </ResponsiveContainer>
                    )}
                </div>
                {history.length > 0 && (
                    <div className="cr-scatter-legend">
                        <span className="cr-scatter-dot cr-scatter-dot--pareto" />Pareto front
                        <span className="cr-scatter-dot cr-scatter-dot--formal-filled" />Formal · latest
                        <span className="cr-scatter-dot cr-scatter-dot--formal-open" />Formal · prev
                        <span className="cr-scatter-dot cr-scatter-dot--informal-filled" />Informal · latest
                        <span className="cr-scatter-dot cr-scatter-dot--informal-open" />Informal · prev
                    </div>
                )}
            </section>

            {/* ── Parallel Coordinates ── */}
            <section className="cr-section cr-section--params">
                <h3 className="cr-section-title">{t('checkResults.explored')}</h3>
                <div className="cr-pcp-wrap">
                    <ParallelCoordinates
                        history={history}
                        currentParams={currentParams}
                        paretoIds={paretoIds}
                        latestFormalId={latestFormalId}
                        latestInformalId={latestInformalId}
                        hoveredId={hoveredId}
                    />
                    <div className="cr-pcp-legend">
                        <span className="cr-pcp-swatch cr-pcp-swatch--current" />Current
                        <span className="cr-pcp-swatch cr-pcp-swatch--pareto" />Pareto
                        <span className="cr-pcp-swatch cr-pcp-swatch--formal-solid" />Formal·latest
                        <span className="cr-pcp-swatch cr-pcp-swatch--formal-dashed" />Formal·prev
                        <span className="cr-pcp-swatch cr-pcp-swatch--informal-solid" />Informal·latest
                        <span className="cr-pcp-swatch cr-pcp-swatch--informal-dashed" />Informal·prev
                    </div>
                </div>
            </section>
        </div>
    );
};

export default CheckResults;
