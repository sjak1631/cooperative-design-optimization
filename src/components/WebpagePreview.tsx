import React from 'react';
import type { Parameters } from '../types';
import './WebpagePreview.css';

interface Props {
    params: Parameters;
}

const ICONS = ['📊', '📁', '🔔', '⚙️', '📈', '📌'];
const ARTICLES = [
    { title: 'Adaptive Interface Study', summary: 'Exploring how layout parameters affect task performance and user satisfaction in HCI research.' },
    { title: 'Bayesian Optimization Loop', summary: 'Cooperative BO allows humans and AI to jointly navigate design spaces with minimal evaluations.' },
    { title: 'Formal vs Informal Probes', summary: 'Noisy informal feedback combined with precise formal measurements drives efficient convergence.' },
];

const WebpagePreview: React.FC<Props> = ({ params }) => {
    const baseFontSize = 10 + params.textSize * 8;       // 10–18 px
    const gap = 6 + params.distance * 20;      // 6–26 px
    const iconFontSize = 14 + params.iconSize * 20;      // 14–34 px
    const cardPadding = 8 + params.boxSize * 20;      // 8–28 px
    const bgOpacity = 0.25 + params.opacity * 0.65;   // 0.25–0.9

    return (
        <div className="wp-root" style={{ fontSize: baseFontSize }}>
            {/* Nav */}
            <nav className="wp-nav" style={{ opacity: bgOpacity + 0.1 }}>
                <span className="wp-logo">◈ DesignLab</span>
                <div className="wp-nav-icons" style={{ gap }}>
                    {ICONS.slice(0, 4).map((ic, i) => (
                        <span key={i} style={{ fontSize: iconFontSize }}>{ic}</span>
                    ))}
                </div>
            </nav>

            {/* Hero */}
            <div
                className="wp-hero"
                style={{ padding: cardPadding, opacity: bgOpacity }}
            >
                <div className="wp-hero-text">
                    <h2 style={{ fontSize: baseFontSize * 1.6, marginBottom: gap * 0.4 }}>
                        Cooperative Design Optimization
                    </h2>
                    <p style={{ lineHeight: 1.5 }}>
                        Jointly explore the design space with an AI assistant to find layouts
                        that maximise speed and accuracy.
                    </p>
                </div>
                <span style={{ fontSize: iconFontSize * 1.6 }}>🎨</span>
            </div>

            {/* Article cards */}
            <div className="wp-cards" style={{ gap }}>
                {ARTICLES.map((a, i) => (
                    <div
                        key={i}
                        className="wp-card"
                        style={{ padding: cardPadding, opacity: bgOpacity + 0.05 }}
                    >
                        <div className="wp-card-header" style={{ marginBottom: gap * 0.5 }}>
                            <span style={{ fontSize: iconFontSize }}>{ICONS[i + 3]}</span>
                            <strong style={{ fontSize: baseFontSize * 1.1 }}>{a.title}</strong>
                        </div>
                        <p style={{ lineHeight: 1.55 }}>{a.summary}</p>
                        <button className="wp-btn" style={{ marginTop: gap * 0.5, fontSize: baseFontSize * 0.9 }}>
                            Read more →
                        </button>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <footer className="wp-footer" style={{ padding: cardPadding * 0.6, opacity: 0.5 }}>
                <span>© 2026 DesignLab Research</span>
                <div style={{ display: 'flex', gap }}>
                    {ICONS.slice(0, 3).map((ic, i) => (
                        <span key={i} style={{ fontSize: iconFontSize * 0.75 }}>{ic}</span>
                    ))}
                </div>
            </footer>
        </div>
    );
};

export default WebpagePreview;
