import React, { useState, useRef, useEffect } from 'react';
import type { Parameters } from '../types';
import type { ParameterInfo, SessionInfo, CandidatePoint } from '../api/types';
import { boSuggest, llmSelect } from '../api/client';
import { useI18n } from '../context/i18nContext';
import './SetParameters.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  badge?: string | null;
}

interface Props {
  params: Parameters;
  paramDefs: ParameterInfo[];
  onParamsChange: (p: Parameters) => void;
  session: SessionInfo | null;
}

const MIN_FORMAL_EVALS = 5;

const SetParameters: React.FC<Props> = ({ params, paramDefs, onParamsChange, session }) => {
  const { t } = useI18n();
  const formalCount = session?.formal_eval_count ?? 0;
  const llmLocked = formalCount < MIN_FORMAL_EVALS;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: t('setParameters.aiGreeting'),
    },
  ]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSlider = (key: string, value: number) => {
    onParamsChange({ ...params, [key]: value } as Parameters);
  };

  const handleAsk = async () => {
    const trimmed = input.trim();
    if (!trimmed || aiLoading || !session) return;

    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setAiLoading(true);

    try {
      // 1. Get batch candidates from BO
      const boRes = await boSuggest(session.session_id);
      const candidates: CandidatePoint[] = boRes.candidates;

      // 2. LLM selects best candidate
      const llmRes = await llmSelect(session.session_id, trimmed, candidates);

      // 3. Update sliders
      onParamsChange(llmRes.selected_parameters as Parameters);

      // 4. Show badge if present
      const selectedCandidate = candidates[llmRes.selected_index];
      const badge = selectedCandidate?.confidence_badge ?? null;

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: llmRes.assistant_message, badge },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI request failed';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ ${msg}` },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  // Use paramDefs from task config if available, otherwise fall back to params keys
  const sliderDefs: { key: string; label: string; min: number; max: number }[] =
    paramDefs.length > 0
      ? paramDefs.map((p) => ({ key: p.key, label: p.label, min: p.range_min, max: p.range_max }))
      : Object.keys(params).map((k) => ({ key: k, label: k, min: 0, max: 1 }));

  return (
    <div className="sp-root">
      <h2 className="sp-title">{t('panels.setParameters')}</h2>

      {/* Sliders */}
      <section className="sp-sliders">
        {sliderDefs.map(({ key, label, min, max }) => {
          const val = (params as Record<string, number>)[key] ?? 0.5;
          const pct = ((val - min) / (max - min)) * 100;
          return (
            <div key={key} className="sp-slider-row">
              <div className="sp-slider-header">
                <span className="sp-label">{label}</span>
                <span className="sp-value">{val.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={(max - min) / 100}
                value={val}
                onChange={(e) => handleSlider(key, Number(e.target.value))}
                className="sp-range"
                style={{ '--val': pct } as React.CSSProperties}
              />
              <div className="sp-range-labels">
                <span>{min}</span><span>{max}</span>
              </div>
            </div>
          );
        })}
      </section>

      <div className="sp-divider" />

      {/* AI Chat */}
      <section className="sp-chat">
        <h3 className="sp-chat-title">{t('setParameters.aiAssistant')}</h3>

        {llmLocked && (
          <div className="sp-lock-notice">
            {t('setParameters.aiLocked')}
            <span className="sp-lock-progress">{t('setParameters.aiProgress', { count: formalCount })}</span>
          </div>
        )}

        <div className="sp-messages">
          {messages.map((m, i) => (
            <div key={i} className={`sp-msg sp-msg--${m.role}`}>
              <span className="sp-msg-role">{m.role === 'user' ? t('setParameters.userRole') : t('setParameters.aiRole')}</span>
              <p>{m.content}</p>
              {m.badge && (
                <span className={`sp-badge sp-badge--${m.badge.toLowerCase()}`}>
                  {t('setParameters.uncertainty', { badge: m.badge })}
                </span>
              )}
            </div>
          ))}
          {aiLoading && (
            <div className="sp-msg sp-msg--assistant">
              <span className="sp-msg-role">{t('setParameters.aiRole')}</span>
              <p className="sp-typing">{t('setParameters.thinking')}</p>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="sp-chat-input-row">
          <textarea
            className="sp-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('setParameters.askPlaceholder')}
            rows={2}
            disabled={aiLoading || !session || llmLocked}
          />
          <button
            className="sp-ask-btn"
            onClick={handleAsk}
            disabled={aiLoading || !input.trim() || !session || llmLocked}
          >
            {t('setParameters.askButton')}
          </button>
        </div>
      </section>
    </div>
  );
};

export default SetParameters;
