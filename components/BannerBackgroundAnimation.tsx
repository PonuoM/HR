import React, { useId, useMemo } from 'react';

type BannerBackgroundAnimationProps = {
    hour: number;
    className?: string;
};

const BannerBackgroundAnimation: React.FC<BannerBackgroundAnimationProps> = ({ hour, className = '' }) => {
    const id = useId().replace(/[^a-zA-Z0-9]/g, '');

    const isMorning = hour >= 5 && hour < 12;
    const isAfternoon = hour >= 12 && hour < 17;
    const isEvening = hour >= 17 && hour < 20;
    const isNight = hour >= 20 || hour < 5;

    const palette = useMemo(() => {
        if (isMorning) return {
            skyTop: '#7ec8e3', skyMid: '#a8d8ea', skyBottom: '#fce38a',
            sunColor: '#ffe066', sunGlow: '#fff9c4',
            hill1: '#5a9e6f', hill2: '#3d7a4f', hill3: '#2d5e3a',
            grassLine: '#6db87c',
        };
        if (isAfternoon) return {
            skyTop: '#4a90d9', skyMid: '#74b9ff', skyBottom: '#dfe6e9',
            sunColor: '#ffeaa7', sunGlow: '#fdcb6e',
            hill1: '#2ecc71', hill2: '#27ae60', hill3: '#1e8449',
            grassLine: '#58d68d',
        };
        if (isEvening) return {
            skyTop: '#2c3e50', skyMid: '#e17055', skyBottom: '#fdcb6e',
            sunColor: '#e17055', sunGlow: '#fab1a0',
            hill1: '#4a3f6b', hill2: '#362e54', hill3: '#2d2545',
            grassLine: '#6c5ce7',
        };
        return {
            skyTop: '#0c1445', skyMid: '#1a1a5e', skyBottom: '#1e3a5f',
            sunColor: '#bdc3c7', sunGlow: '#636e72',
            hill1: '#1a2a3a', hill2: '#0f1f2e', hill3: '#0a1520',
            grassLine: '#2d3436',
        };
    }, [hour]);

    // Stable star positions for night mode
    const stars = useMemo(() => {
        const s = [];
        for (let i = 0; i < 25; i++) {
            s.push({
                x: (i * 47 + 13) % 1200,
                y: (i * 31 + 7) % 160,
                r: ((i % 3) + 1) * 0.6,
                delay: (i * 0.7) % 4,
            });
        }
        return s;
    }, []);

    const sky = `sky-${id}`;
    const sunG = `sunG-${id}`;
    const blr = `blr-${id}`;

    return (
        <div className={`overflow-hidden ${className}`}>
            <svg
                viewBox="0 0 1200 400"
                preserveAspectRatio="xMidYMid slice"
                className="w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
            >
                <style>{`
                    @keyframes drift1{0%{transform:translateX(0)}100%{transform:translateX(-600px)}}
                    @keyframes drift2{0%{transform:translateX(0)}100%{transform:translateX(-400px)}}
                    @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
                    @keyframes twk{0%,100%{opacity:.15}50%{opacity:.9}}
                    @keyframes rayPulse{0%,100%{opacity:.12}50%{opacity:.28}}
                    .d1{animation:drift1 90s linear infinite}
                    .d2{animation:drift2 70s linear infinite}
                    .bob{animation:bob 8s ease-in-out infinite}
                    .twk{animation:twk 3s ease-in-out infinite}
                    .rayP{animation:rayPulse 6s ease-in-out infinite}
                `}</style>

                <defs>
                    <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={palette.skyTop} />
                        <stop offset="50%" stopColor={palette.skyMid} />
                        <stop offset="100%" stopColor={palette.skyBottom} />
                    </linearGradient>
                    <radialGradient id={sunG} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={palette.sunGlow} stopOpacity="0.9" />
                        <stop offset="60%" stopColor={palette.sunColor} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={palette.sunColor} stopOpacity="0" />
                    </radialGradient>
                    <filter id={blr}><feGaussianBlur stdDeviation="12" /></filter>
                </defs>

                {/* Sky */}
                <rect width="1200" height="400" fill={`url(#${sky})`} />

                {/* Stars — night only */}
                {isNight && stars.map((s, i) => (
                    <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" className="twk" style={{ animationDelay: `${s.delay}s` }} />
                ))}

                {/* Celestial body */}
                {isMorning && (
                    <g className="bob">
                        <circle cx="220" cy="160" r="90" fill={`url(#${sunG})`} filter={`url(#${blr})`} />
                        <circle cx="220" cy="160" r="32" fill={palette.sunColor} opacity="0.85" />
                    </g>
                )}
                {isAfternoon && (
                    <g className="bob" style={{ animationDelay: '1s' }}>
                        <circle cx="700" cy="90" r="100" fill={`url(#${sunG})`} filter={`url(#${blr})`} />
                        <circle cx="700" cy="90" r="36" fill={palette.sunColor} opacity="0.9" />
                    </g>
                )}
                {isEvening && (
                    <g className="bob" style={{ animationDelay: '2s' }}>
                        <circle cx="1000" cy="200" r="110" fill={`url(#${sunG})`} filter={`url(#${blr})`} />
                        <circle cx="1000" cy="200" r="40" fill={palette.sunColor} opacity="0.75" />
                    </g>
                )}
                {isNight && (
                    <g className="bob" style={{ animationDelay: '0.5s' }}>
                        <circle cx="950" cy="80" r="60" fill={`url(#${sunG})`} filter={`url(#${blr})`} />
                        <circle cx="950" cy="80" r="22" fill="#e2e8f0" opacity="0.9" />
                        <circle cx="940" cy="74" r="18" fill={palette.skyMid} />
                    </g>
                )}

                {/* Light rays from sun (morning/afternoon) */}
                {(isMorning || isAfternoon) && (
                    <g className="rayP">
                        {[0, 30, 60, 90, 120, 150].map((a, i) => {
                            const cx = isMorning ? 220 : 700;
                            const cy = isMorning ? 160 : 90;
                            const rad = (a * Math.PI) / 180;
                            return (
                                <line
                                    key={i}
                                    x1={cx + Math.cos(rad) * 50}
                                    y1={cy + Math.sin(rad) * 50}
                                    x2={cx + Math.cos(rad) * 300}
                                    y2={cy + Math.sin(rad) * 300}
                                    stroke={palette.sunGlow}
                                    strokeWidth="1.5"
                                    opacity="0.1"
                                />
                            );
                        })}
                    </g>
                )}

                {/* Clouds — two layers drifting at different speeds */}
                {!isNight && (
                    <>
                        {/* Layer 1 — far clouds (duplicated for seamless loop) */}
                        <g className="d2" opacity="0.35">
                            <ellipse cx="100" cy="140" rx="80" ry="28" fill="white" />
                            <ellipse cx="140" cy="130" rx="50" ry="20" fill="white" />
                            <ellipse cx="60" cy="135" rx="40" ry="16" fill="white" />

                            <ellipse cx="500" cy="100" rx="70" ry="24" fill="white" />
                            <ellipse cx="540" cy="90" rx="45" ry="18" fill="white" />

                            <ellipse cx="900" cy="120" rx="90" ry="30" fill="white" />
                            <ellipse cx="950" cy="110" rx="55" ry="22" fill="white" />
                            <ellipse cx="860" cy="115" rx="40" ry="15" fill="white" />

                            {/* Duplicate set shifted +400px for seamless loop */}
                            <ellipse cx="500" cy="140" rx="80" ry="28" fill="white" />
                            <ellipse cx="540" cy="130" rx="50" ry="20" fill="white" />
                        </g>

                        {/* Layer 2 — near clouds */}
                        <g className="d1" opacity="0.5">
                            <ellipse cx="200" cy="180" rx="100" ry="32" fill="white" />
                            <ellipse cx="260" cy="170" rx="60" ry="24" fill="white" />
                            <ellipse cx="150" cy="175" rx="50" ry="20" fill="white" />

                            <ellipse cx="700" cy="160" rx="110" ry="35" fill="white" />
                            <ellipse cx="770" cy="148" rx="65" ry="26" fill="white" />
                            <ellipse cx="640" cy="155" rx="55" ry="22" fill="white" />

                            {/* Duplicate set for seamless loop */}
                            <ellipse cx="800" cy="180" rx="100" ry="32" fill="white" />
                            <ellipse cx="860" cy="170" rx="60" ry="24" fill="white" />
                            <ellipse cx="1300" cy="160" rx="110" ry="35" fill="white" />
                            <ellipse cx="1370" cy="148" rx="65" ry="26" fill="white" />
                        </g>
                    </>
                )}

                {/* Night thin clouds */}
                {isNight && (
                    <g className="d2" opacity="0.12">
                        <ellipse cx="300" cy="160" rx="120" ry="20" fill="white" />
                        <ellipse cx="800" cy="130" rx="100" ry="18" fill="white" />
                        <ellipse cx="1100" cy="170" rx="80" ry="14" fill="white" />
                    </g>
                )}

                {/* Rolling Hills — 3 layers for depth */}
                <path
                    d="M0,400 L0,290 C100,240 200,280 350,250 C500,220 550,270 700,240 C850,210 950,260 1100,230 L1200,250 L1200,400Z"
                    fill={palette.hill1}
                    opacity="0.7"
                />
                <path
                    d="M0,400 L0,310 C80,280 180,330 320,290 C460,250 560,310 720,275 C880,240 980,290 1120,265 L1200,280 L1200,400Z"
                    fill={palette.hill2}
                    opacity="0.85"
                />
                <path
                    d="M0,400 L0,340 C120,310 220,360 380,330 C540,300 640,350 800,320 C960,290 1060,340 1200,310 L1200,400Z"
                    fill={palette.hill3}
                />

                {/* Grass texture line on foreground hill */}
                <path
                    d="M0,345 C60,330 130,355 250,335 C370,315 450,345 600,325 C750,305 850,340 1000,318 C1100,305 1150,330 1200,315"
                    fill="none"
                    stroke={palette.grassLine}
                    strokeWidth="1.5"
                    opacity="0.3"
                    strokeDasharray="8 12"
                />
            </svg>
        </div>
    );
};

export default BannerBackgroundAnimation;
