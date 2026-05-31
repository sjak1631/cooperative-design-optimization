import React from 'react';
import type { Parameters } from '../types';
import { useI18n } from '../context/i18nContext';
import './WebpagePreview.css';

interface Props {
    params: Parameters;
    taskId?: string;
}

// ── News Portal (default) ───────────────────────────────────────────────────────
const ICONS = ['📊', '📁', '🔔', '⚙️', '📈', '📌'];
const ARTICLE_KEYS = [
    { titleKey: 'webpageNews.article1Title', summaryKey: 'webpageNews.article1Summary' },
    { titleKey: 'webpageNews.article2Title', summaryKey: 'webpageNews.article2Summary' },
    { titleKey: 'webpageNews.article3Title', summaryKey: 'webpageNews.article3Summary' },
];

const NewsPortalPreview: React.FC<{ params: Parameters }> = ({ params }) => {
    const { t } = useI18n();
    const baseFontSize = 10 + params.textSize * 8;
    const gap = 6 + params.distance * 20;
    const iconFontSize = 14 + params.iconSize * 20;
    const cardPadding = 8 + params.boxSize * 20;
    const bgOpacity = 0.25 + params.opacity * 0.65;

    return (
        <div className="wp-root" style={{ fontSize: baseFontSize }}>
            <nav className="wp-nav" style={{ opacity: bgOpacity + 0.1 }}>
                <span className="wp-logo">{t('webpageNews.logo')}</span>
                <div className="wp-nav-icons" style={{ gap }}>
                    {ICONS.slice(0, 4).map((ic, i) => (
                        <span key={i} style={{ fontSize: iconFontSize }}>{ic}</span>
                    ))}
                </div>
            </nav>
            <div className="wp-hero" style={{ padding: cardPadding, opacity: bgOpacity }}>
                <div className="wp-hero-text">
                    <h2 style={{ fontSize: baseFontSize * 1.6, marginBottom: gap * 0.4 }}>
                        {t('webpageNews.heading')}
                    </h2>
                    <p style={{ lineHeight: 1.5 }}>
                        {t('webpageNews.description')}
                    </p>
                </div>
                <span style={{ fontSize: iconFontSize * 1.6 }}>🎨</span>
            </div>
            <div className="wp-cards" style={{ gap }}>
                {ARTICLE_KEYS.map((article, i) => (
                    <div key={i} className="wp-card" style={{ padding: cardPadding, opacity: bgOpacity + 0.05 }}>
                        <div className="wp-card-header" style={{ marginBottom: gap * 0.5 }}>
                            <span style={{ fontSize: iconFontSize }}>{ICONS[i + 3]}</span>
                            <strong style={{ fontSize: baseFontSize * 1.1 }}>{t(article.titleKey)}</strong>
                        </div>
                        <p style={{ lineHeight: 1.55 }}>{t(article.summaryKey)}</p>
                        <button className="wp-btn" style={{ marginTop: gap * 0.5, fontSize: baseFontSize * 0.9 }}>
                            {t('webpageNews.readMore')}
                        </button>
                    </div>
                ))}
            </div>
            <footer className="wp-footer" style={{ padding: cardPadding * 0.6, opacity: 0.5 }}>
                <span>{t('webpageNews.footer')}</span>
                <div style={{ display: 'flex', gap }}>
                    {ICONS.slice(0, 3).map((ic, i) => (
                        <span key={i} style={{ fontSize: iconFontSize * 0.75 }}>{ic}</span>
                    ))}
                </div>
            </footer>
        </div>
    );
};

// ── SNS Feed ────────────────────────────────────────────────────────────────────
const SNS_POSTS = [
    { user: '@alex_m', avatar: '🧑', content: 'Just finished a 10k run! The personalized workout tips really helped 💪', likes: 142, comments: 23 },
    { user: '@yuki_d', avatar: '👩', content: 'Check out this amazing sunset photo from last weekend 🌅 #travel #nature', likes: 387, comments: 61 },
    { user: '@roo_dev', avatar: '🧑‍💻', content: 'Launched a new open-source project today. Would love your feedback!', likes: 95, comments: 18 },
];
const SNS_AD_CONTENT = [
    { brand: '✨ ProGlow', text: 'Upgrade your skincare routine — 30% off today only!' },
    { brand: '🚀 TechPro', text: 'AI-powered productivity tools for teams. Try free for 14 days.' },
];

const SNSPreview: React.FC<{ params: Parameters }> = ({ params }) => {
    const { t } = useI18n();
    const adDensity = params.adDensity ?? 0.5;
    const notifFrequency = params.notificationFrequency ?? 0.5;
    const personalization = params.personalizationRate ?? 0.5;
    const moderation = params.moderationRate ?? 0.5;
    const refreshTime = params.refreshTime ?? 0.5;

    // Derived visual values
    const notifCount = Math.round(notifFrequency * 12);        // 0–12 badge count
    const showAdBanner = adDensity > 0.3;
    const adOpacity = 0.4 + adDensity * 0.6;
    const adFontSize = 9 + adDensity * 4;
    const personColor = `hsl(${200 + personalization * 60}, 70%, ${45 + personalization * 15}%)`;
    const showModWarning = moderation > 0.5;
    const refreshLabel = refreshTime < 0.25 ? '15s' : refreshTime < 0.5 ? '30s' : refreshTime < 0.75 ? '1m' : '5m';
    const refreshBarW = (1 - refreshTime) * 100; // wider = faster refresh
    const matchPercent = Math.round(personalization * 100);

    return (
        <div className="sns-root">
            {/* Nav */}
            <nav className="sns-nav">
                <span className="sns-logo">{t('webpageSNS.logo')}</span>
                <div className="sns-nav-right">
                    <span className="sns-refresh-label" title="Content refresh interval">
                        {t('webpageSNS.refresh', { label: refreshLabel })}
                    </span>
                    <div className="sns-refresh-bar">
                        <div className="sns-refresh-fill" style={{ width: `${refreshBarW}%` }} />
                    </div>
                    <div className="sns-notif-wrap">
                        <span className="sns-notif-icon">{t('webpageSNS.notification')}</span>
                        {notifCount > 0 && (
                            <span className="sns-notif-badge">{notifCount > 9 ? '9+' : notifCount}</span>
                        )}
                    </div>
                </div>
            </nav>

            {/* Personalization bar */}
            <div className="sns-personalization-bar" style={{ background: personColor }}>
                <span style={{ fontSize: 9, opacity: 0.9 }}>
                    {t('webpageSNS.personalized', { match: matchPercent })}
                </span>
            </div>

            {/* Feed */}
            <div className="sns-feed">
                {SNS_POSTS.map((post, i) => (
                    <React.Fragment key={i}>
                        <div className="sns-post">
                            {showModWarning && moderation > 0.75 && i === 2 && (
                                <div className="sns-mod-warning">
                                    {t('webpageSNS.moderation')}
                                </div>
                            )}
                            <div className="sns-post-header">
                                <span className="sns-avatar">{post.avatar}</span>
                                <span className="sns-username">{post.user}</span>
                            </div>
                            <p className="sns-post-content">{post.content}</p>
                            <div className="sns-post-actions">
                                <span>{t('webpageSNS.likeButton')} {t('webpageSNS.likes', { count: post.likes })}</span>
                                <span>{t('webpageSNS.commentButton')} {t('webpageSNS.comments', { count: post.comments })}</span>
                                <span>{t('webpageSNS.shareButton')}</span>
                            </div>
                        </div>

                        {/* Ad banner between posts */}
                        {showAdBanner && i < SNS_POSTS.length - 1 && i < Math.ceil(adDensity * 2) && (
                            <div className="sns-ad" style={{ opacity: adOpacity, fontSize: adFontSize }}>
                                <span className="sns-ad-label">{t('webpageSNS.sponsored')}</span>
                                <strong>{SNS_AD_CONTENT[i % SNS_AD_CONTENT.length].brand}</strong>
                                <p>{SNS_AD_CONTENT[i % SNS_AD_CONTENT.length].text}</p>
                                <button className="sns-ad-btn">{t('webpageSNS.learnMore')}</button>
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

// ── Q&A Message Board ──────────────────────────────────────────────────────────
const QA_QUESTIONS = [
    {
        title: 'How does Bayesian optimization handle noisy observations?',
        preview: 'I am trying to optimize a black-box function where evaluations are expensive and the observations contain significant noise. What acquisition functions work best in this setting?',
        tags: ['bayesian-opt', 'noise', 'acquisition', 'gp', 'botorch'],
        votes: 34, answers: 5,
    },
    {
        title: 'What is the difference between formal and informal evaluation in HCI?',
        preview: 'In cooperative design optimization experiments, participants alternate between formal and informal evaluations. I am confused about the purpose of each mode.',
        tags: ['hci', 'evaluation', 'user-study', 'methodology'],
        votes: 18, answers: 2,
    },
    {
        title: 'Why does the Pareto front shrink when I add more constraints?',
        preview: 'After adding two extra constraints to my multi-objective problem the Pareto front went from 12 solutions down to 3. Is this expected behavior and how can I recover diversity?',
        tags: ['pareto', 'multi-objective', 'constraints', 'optimization'],
        votes: 27, answers: 7,
    },
    {
        title: 'Best way to encode categorical design parameters as continuous values?',
        preview: 'I need to pass categorical choices (e.g. font family, color scheme) into a BoTorch surrogate model. Should I use one-hot encoding or ordinal encoding?',
        tags: ['encoding', 'categorical', 'surrogate-model'],
        votes: 11, answers: 1,
    },
];

const QA_CATEGORY_SETS = [
    ['All'],
    ['All', 'Optimization'],
    ['All', 'Optimization', 'HCI'],
    ['All', 'Optimization', 'HCI', 'Machine Learning'],
    ['All', 'Optimization', 'HCI', 'Machine Learning', 'Statistics'],
    ['All', 'Optimization', 'HCI', 'Machine Learning', 'Statistics', 'UI/UX'],
];

const QABoardPreview: React.FC<{ params: Parameters }> = ({ params }) => {
    const { t } = useI18n();
    const categories = params.questionCategories ?? 0.5;
    const refreshTime = params.refreshTime ?? 0.5;
    const previewLength = params.previewLength ?? 0.5;
    const maxTagsParam = params.maxTags ?? 0.5;
    const activityThreshold = params.activityThreshold ?? 0.5;

    // Derived values
    const categorySetIndex = Math.min(
        QA_CATEGORY_SETS.length - 1,
        Math.floor(categories * QA_CATEGORY_SETS.length),
    );
    const shownCategories = QA_CATEGORY_SETS[categorySetIndex];
    const refreshLabel = refreshTime < 0.25 ? '10s' : refreshTime < 0.5 ? '30s' : refreshTime < 0.75 ? '2m' : '10m';
    const previewChars = Math.floor(60 + previewLength * 120);   // 60–180 chars
    const maxTagsCount = Math.floor(1 + maxTagsParam * 4);       // 1–5 tags
    const thresholdPct = Math.round(activityThreshold * 100);
    const canAnswer = activityThreshold < 0.65;                  // user qualifies if threshold not too high
    const questionsVisible = 2 + Math.floor(categories * 2);     // 2–4 questions shown

    const getCategoryLabel = (cat: string): string => {
        const categoryMap: { [key: string]: string } = {
            'All': t('webpageQA.all'),
            'Optimization': t('webpageQA.optimization'),
            'HCI': t('webpageQA.hci'),
            'Machine Learning': t('webpageQA.machineLearning'),
            'Statistics': t('webpageQA.statistics'),
            'UI/UX': t('webpageQA.uiux'),
        };
        return categoryMap[cat] || cat;
    };

    return (
        <div className="qa-root">
            {/* Nav */}
            <nav className="qa-nav">
                <span className="qa-logo">{t('webpageQA.logo')}</span>
                <div className="qa-nav-right">
                    <span className="qa-refresh-label">{t('webpageQA.refresh', { label: refreshLabel })}</span>
                    <span className="qa-stat-badge">{t('webpageQA.questionCount', { count: questionsVisible * 12 })}</span>
                </div>
            </nav>

            {/* Category filter */}
            <div className="qa-categories">
                {shownCategories.map((cat, i) => (
                    <span key={i} className={`qa-cat-tag ${i === 0 ? 'qa-cat-tag--active' : ''}`}>
                        {getCategoryLabel(cat)}
                    </span>
                ))}
            </div>

            {/* Activity threshold bar */}
            <div className="qa-threshold-row">
                <span className="qa-threshold-label">
                    {t('webpageQA.threshold', { label: (canAnswer ? t('webpageQA.canAnswer') : t('webpageQA.locked')), value: thresholdPct })}
                </span>
                <div className="qa-threshold-bar">
                    <div className="qa-threshold-fill" style={{ width: `${thresholdPct}%` }} />
                </div>
            </div>

            {/* Question list */}
            <div className="qa-questions">
                {QA_QUESTIONS.slice(0, questionsVisible).map((q, i) => {
                    const shownTags = q.tags.slice(0, maxTagsCount);
                    const previewText = q.preview.slice(0, previewChars);
                    const truncated = q.preview.length > previewChars;
                    return (
                        <div key={i} className="qa-question">
                            <div className="qa-question-header">
                                <span className="qa-question-title">{q.title}</span>
                                <div className="qa-tags">
                                    {shownTags.map((tag, t) => (
                                        <span key={t} className="qa-tag">{tag}</span>
                                    ))}
                                </div>
                            </div>
                            <p className="qa-preview">
                                {previewText}{truncated && <span className="qa-preview-ellipsis">{t('webpageQA.preview')}</span>}
                            </p>
                            <div className="qa-question-footer">
                                <span className="qa-vote">{t('webpageQA.votes', { count: q.votes })}</span>
                                <span className="qa-answers">{t('webpageQA.answers', { count: q.answers })}</span>
                                <button
                                    className={`qa-answer-btn ${canAnswer ? '' : 'qa-answer-btn--locked'}`}
                                    disabled={!canAnswer}
                                >
                                    {canAnswer ? t('webpageQA.answerButton') : t('webpageQA.answerButtonLocked')}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ── Tutorial: Simple Personal Web Page ────────────────────────────────────────
const TUTORIAL_IMAGES = ['🌄', '🖼️', '🎨', '📷', '🌆', '🏞️'];

const TutorialPreview: React.FC<{ params: Parameters }> = ({ params }) => {
    const imageCount = params.imageCount ?? 0.5;
    const animationLevel = params.animationLevel ?? 0.5;

    // Derived values
    const shownImageCount = Math.round(imageCount * 5) + 1; // 1–6
    const animDuration = animationLevel > 0.05 ? (3 - animationLevel * 2.5).toFixed(1) + 's' : '0s';
    const heroPulse = animationLevel > 0.3;
    const cardSlide = animationLevel > 0.6;
    const bgShift = animationLevel > 0.8;
    const headerBg = `linear-gradient(135deg, hsl(${210 + imageCount * 30}, 60%, ${20 + imageCount * 8}%), hsl(${250 + imageCount * 20}, 55%, ${15 + imageCount * 8}%))`;
    const heroBgAnim = bgShift ? 'tut-bgshift 4s ease-in-out infinite alternate' : 'none';
    const cardAnim = cardSlide ? 'tut-slidein 0.5s ease-out both' : 'none';
    const badgeAnim = heroPulse ? `tut-pulse ${animDuration} ease-in-out infinite` : 'none';

    return (
        <div className="tut-root">
            <style>{`
                @keyframes tut-pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }
                @keyframes tut-slidein { from{transform:translateY(12px);opacity:0} to{transform:none;opacity:1} }
                @keyframes tut-bgshift { from{filter:hue-rotate(0deg)} to{filter:hue-rotate(30deg)} }
            `}</style>
            <nav className="tut-nav" style={{ background: headerBg, animation: heroBgAnim }}>
                <span className="tut-logo">✦ MyPage</span>
                <div className="tut-nav-links">
                    <span>About</span>
                    <span>Gallery</span>
                    <span>Contact</span>
                </div>
            </nav>

            <div className="tut-hero">
                <div className="tut-hero-text">
                    <h2 className="tut-hero-title" style={{ animation: badgeAnim }}>Welcome!</h2>
                    <p className="tut-hero-sub">A personal portfolio page</p>
                </div>
            </div>

            <div className="tut-gallery">
                {TUTORIAL_IMAGES.slice(0, shownImageCount).map((img, i) => (
                    <div
                        key={i}
                        className="tut-img-card"
                        style={{
                            animation: cardAnim,
                            animationDelay: cardSlide ? `${i * 0.08}s` : '0s',
                        }}
                    >
                        <span className="tut-img-emoji">{img}</span>
                        <span className="tut-img-label">Photo {i + 1}</span>
                    </div>
                ))}
            </div>

            <div className="tut-info-bar">
                <span>🖼 Images: {shownImageCount}</span>
                <span>🎬 Animations: {animationLevel > 0.05 ? `on (${animDuration})` : 'off'}</span>
            </div>
        </div>
    );
};

// ── Main Component ──────────────────────────────────────────────────────────────
const WebpagePreview: React.FC<Props> = ({ params, taskId }) => {
    if (taskId?.startsWith('task_tutorial')) {
        return <TutorialPreview params={params} />;
    }
    if (taskId?.startsWith('task_sns')) {
        return <SNSPreview params={params} />;
    }
    if (taskId?.startsWith('task_qa')) {
        return <QABoardPreview params={params} />;
    }
    return <NewsPortalPreview params={params} />;
};

export default WebpagePreview;
