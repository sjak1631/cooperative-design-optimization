import React, { useState, useRef, useEffect } from 'react';
import type { Parameters, ChatMessage } from '../types';
import { PARAM_LABELS } from '../types';
import { getAISuggestion } from '../utils/dummyAI';
import './SetParameters.css';

interface Props {
    params: Parameters;
    onParamsChange: (p: Parameters) => void;
}

const SetParameters: React.FC<Props> = ({ params, onParamsChange }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'assistant', content: "Hello! Describe what you want from the layout and I'll suggest new parameter values." },
    ]);
    const [input, setInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSlider = (key: keyof Parameters, value: number) => {
        onParamsChange({ ...params, [key]: value });
    };

    const handleAsk = async () => {
        const trimmed = input.trim();
        if (!trimmed || aiLoading) return;

        const userMsg: ChatMessage = { role: 'user', content: trimmed };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setAiLoading(true);

        try {
            const result = await getAISuggestion(trimmed, params);
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: result.message },
            ]);
            onParamsChange(result.suggestedParams);
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

    return (
        <div className="sp-root">
            <h2 className="sp-title">Set Parameters</h2>

            {/* Sliders */}
            <section className="sp-sliders">
                {(Object.keys(PARAM_LABELS) as Array<keyof Parameters>).map((key) => (
                    <div key={key} className="sp-slider-row">
                        <div className="sp-slider-header">
                            <span className="sp-label">{PARAM_LABELS[key]}</span>
                            <span className="sp-value">{params[key].toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={params[key]}
                            onChange={(e) => handleSlider(key, Number(e.target.value))}
                            className="sp-range"
                            style={{ '--val': params[key] * 100 } as React.CSSProperties}
                        />
                        <div className="sp-range-labels">
                            <span>0</span><span>1</span>
                        </div>
                    </div>
                ))}
            </section>

            <div className="sp-divider" />

            {/* AI Chat */}
            <section className="sp-chat">
                <h3 className="sp-chat-title">AI Design Assistant</h3>

                <div className="sp-messages">
                    {messages.map((m, i) => (
                        <div key={i} className={`sp-msg sp-msg--${m.role}`}>
                            <span className="sp-msg-role">{m.role === 'user' ? 'You' : 'AI'}</span>
                            <p>{m.content}</p>
                        </div>
                    ))}
                    {aiLoading && (
                        <div className="sp-msg sp-msg--assistant">
                            <span className="sp-msg-role">AI</span>
                            <p className="sp-typing">Thinking…</p>
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
                        placeholder="e.g. 'make it more readable with larger text'"
                        rows={2}
                        disabled={aiLoading}
                    />
                    <button
                        className="sp-ask-btn"
                        onClick={handleAsk}
                        disabled={aiLoading || !input.trim()}
                    >
                        Ask AI for<br />New Design
                    </button>
                </div>
            </section>
        </div>
    );
};

export default SetParameters;
