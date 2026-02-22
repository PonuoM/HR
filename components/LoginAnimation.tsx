import React, { useId } from 'react';

const LoginAnimation: React.FC<{ className?: string }> = ({ className = '' }) => {
    const id = useId().replace(/[^a-zA-Z0-9]/g, '');
    const pGrad = `primaryGrad-${id}`;
    const gGrad = `glassGrad-${id}`;
    const gcGrad = `glassCardGrad-${id}`;
    const aGrad = `accentGrad-${id}`;
    const fGlow = `glow-${id}`;
    const fSoftShadow = `softShadow-${id}`;
    const fHardShadow = `hardShadow-${id}`;

    return (
        <div className={`relative ${className} flex items-center justify-center`}>
            <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-2xl overflow-visible">
                <style>
                    {`
                        @keyframes floatUp {
                            0% { transform: translateY(20px); opacity: 0; }
                            20% { opacity: 1; }
                            50% { transform: translateY(-16px); opacity: 1; }
                            100% { transform: translateY(0px); opacity: 1; }
                        }
                        @keyframes floatDown {
                            0% { transform: translateY(-20px); opacity: 0; }
                            20% { opacity: 1; }
                            50% { transform: translateY(12px); opacity: 1; }
                            100% { transform: translateY(0px); opacity: 1; }
                        }
                        @keyframes fadeInFloatDelay {
                            0% { transform: translateY(20px); opacity: 0; }
                            50% { opacity: 0; }
                            70% { opacity: 1; }
                            100% { transform: translateY(-16px); opacity: 1; }
                        }
                        @keyframes ringPulse {
                            0% { r: 100px; opacity: 0.1; }
                            50% { r: 125px; opacity: 0.25; }
                            100% { r: 100px; opacity: 0.1; }
                        }
                        @keyframes ringPulseLarger {
                            0% { r: 130px; opacity: 0.05; }
                            50% { r: 160px; opacity: 0.15; }
                            100% { r: 130px; opacity: 0.05; }
                        }
                        @keyframes spinSlow {
                            0% { transform: rotate(0deg); opacity: 0; }
                            10% { opacity: 1; }
                            100% { transform: rotate(360deg); opacity: 1; }
                        }
                        @keyframes spinSlowReverse {
                            0% { transform: rotate(0deg); opacity: 0; }
                            10% { opacity: 1; }
                            100% { transform: rotate(-360deg); opacity: 1; }
                        }
                        .anim-float-up { animation: floatUp 6s cubic-bezier(0.4, 0, 0.2, 1) infinite; animation-fill-mode: both; }
                        .anim-float-down { animation: floatDown 7s cubic-bezier(0.4, 0, 0.2, 1) infinite; animation-fill-mode: both; }
                        .anim-float-delay { animation: fadeInFloatDelay 7s cubic-bezier(0.4, 0, 0.2, 1) infinite; animation-fill-mode: both; }
                        .anim-pulse { animation: ringPulse 4s ease-in-out infinite; }
                        .anim-pulse-large { animation: ringPulseLarger 5s ease-in-out infinite; animation-delay: 1s; }
                        .anim-spin { animation: spinSlow 25s linear infinite; transform-origin: 200px 150px; animation-fill-mode: both; }
                        .anim-spin-reverse { animation: spinSlowReverse 30s linear infinite; transform-origin: 200px 150px; animation-fill-mode: both; }
                    `}
                </style>

                <defs>
                    <linearGradient id={pGrad} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#93C5FD" />
                        <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                    <linearGradient id={gGrad} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255, 255, 255, 0.3)" />
                        <stop offset="100%" stopColor="rgba(255, 255, 255, 0.05)" />
                    </linearGradient>
                    <linearGradient id={gcGrad} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255, 255, 255, 0.9)" />
                        <stop offset="100%" stopColor="rgba(255, 255, 255, 0.6)" />
                    </linearGradient>
                    <linearGradient id={aGrad} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#34D399" />
                        <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                    <filter id={fGlow} x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="15" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <filter id={fSoftShadow} x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#000" floodOpacity="0.15" />
                    </filter>
                    <filter id={fHardShadow} x="-10%" y="-10%" width="120%" height="120%">
                        <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.1" />
                    </filter>
                </defs>

                {/* Animated Background Orbs / Rings */}
                <circle cx="200" cy="150" r="100" fill="none" stroke={`url(#${pGrad})`} strokeWidth="1.5" strokeDasharray="6 12" className="anim-spin" style={{ opacity: 0 }} />
                <circle cx="200" cy="150" r="140" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="2 8" className="anim-spin-reverse" style={{ opacity: 0 }} />
                <circle cx="200" cy="150" r="130" fill={`url(#${pGrad})`} className="anim-pulse" filter={`url(#${fGlow})`} style={{ opacity: 0 }} />
                <circle cx="200" cy="150" r="160" fill="white" className="anim-pulse-large" style={{ opacity: 0 }} />

                {/* Main Employee ID Card */}
                <g className="anim-float-up" filter={`url(#${fSoftShadow})`} style={{ opacity: 0 }}>
                    {/* Glass Backing */}
                    <rect x="110" y="60" width="180" height="200" rx="24" fill={`url(#${gGrad})`} stroke="rgba(255,255,255,0.4)" strokeWidth="2" style={{ backdropFilter: 'blur(8px)' }} />

                    {/* Top Header */}
                    <path d="M110 84 C110 70.745 120.745 60 134 60 L266 60 C279.255 60 290 70.745 290 84 L290 100 L110 100 L110 84 Z" fill="rgba(255,255,255,0.2)" />
                    <circle cx="130" cy="80" r="5" fill="#FCA5A5" />
                    <circle cx="146" cy="80" r="5" fill="#FCD34D" />
                    <circle cx="162" cy="80" r="5" fill="#86EFAC" />

                    {/* Logo/Badge inside Card */}
                    <text x="268" y="85" fill="white" fontSize="16" fontWeight="bold" fontFamily="sans-serif" opacity="0.8" textAnchor="end">HR</text>

                    {/* Profile Avatar */}
                    <circle cx="200" cy="140" r="32" fill="white" filter={`url(#${fHardShadow})`} />
                    <circle cx="200" cy="140" r="28" fill={`url(#${pGrad})`} opacity="0.2" />
                    {/* Avatar Silhouette */}
                    <path d="M200 128 A10 10 0 1 0 200 148 A10 10 0 1 0 200 128 Z" fill={`url(#${pGrad})`} />
                    <path d="M182 165 C182 153 189 146 200 146 C211 146 218 153 218 165 C218 167 217 169 216 169 L184 169 C183 169 182 167 182 165 Z" fill={`url(#${pGrad})`} />

                    {/* Skeleton Text Lines */}
                    <rect x="140" y="195" width="120" height="10" rx="5" fill="white" opacity="0.9" />
                    <rect x="150" y="215" width="100" height="8" rx="4" fill="white" opacity="0.6" />
                    <rect x="165" y="233" width="70" height="6" rx="3" fill="white" opacity="0.4" />
                </g>

                {/* Floating Elements Around */}

                {/* 1. Time/Clock (Top Right) */}
                <g className="anim-float-down" filter={`url(#${fSoftShadow})`} style={{ transformOrigin: '300px 90px', opacity: 0 }}>
                    <circle cx="310" cy="80" r="26" fill="white" />
                    <circle cx="310" cy="80" r="20" fill={`url(#${pGrad})`} opacity="0.1" />
                    {/* Clock hands */}
                    <path d="M310 70 V80 L318 86" stroke={`url(#${pGrad})`} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="310" cy="80" r="2" fill={`url(#${pGrad})`} />
                </g>

                {/* 2. Notification / Message (Center Left) */}
                <g className="anim-float-delay" filter={`url(#${fSoftShadow})`} style={{ opacity: 0 }}>
                    <rect x="50" y="130" width="56" height="46" rx="14" fill="white" />
                    <path d="M64 174 L70 162 L84 174 Z" fill="white" />
                    <rect x="64" y="144" width="28" height="5" rx="2.5" fill={`url(#${pGrad})`} opacity="0.6" />
                    <rect x="64" y="157" width="18" height="5" rx="2.5" fill={`url(#${pGrad})`} opacity="0.3" />
                </g>

                {/* 3. Security Shield (Bottom Left) */}
                <g className="anim-float-up" filter={`url(#${fSoftShadow})`} style={{ animationDelay: '0.8s', opacity: 0 }}>
                    <path d="M80 230 C80 230 70 220 70 206 V190 L90 182 L110 190 V206 C110 220 100 230 80 230 Z" fill={`url(#${aGrad})`} />
                    <path d="M80 192 V226 C72 216 74 206 74 206 V194 L80 192 Z" fill="#6EE7B7" opacity="0.4" />
                    <path d="M78 206 L84 212 L96 198" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </g>

                {/* 4. Success Checkmark Ring (Bottom Right) */}
                <g className="anim-float-down" filter={`url(#${fSoftShadow})`} style={{ animationDelay: '1.2s', opacity: 0 }}>
                    <circle cx="295" cy="215" r="24" fill="white" />
                    <circle cx="295" cy="215" r="24" fill={`url(#${aGrad})`} opacity="0.1" />
                    <path d="M285 215 L292 222 L306 206" stroke={`url(#${aGrad})`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </g>

                {/* Sparkling Stars */}
                <path d="M 280 50 Q 285 50 285 45 Q 285 50 290 50 Q 285 50 285 55 Q 285 50 280 50" fill="white" className="anim-pulse" style={{ animationDelay: '0.5s', opacity: 0 }} />
                <path d="M 100 80 Q 103 80 103 77 Q 103 80 106 80 Q 103 80 103 83 Q 103 80 100 80" fill="white" className="anim-pulse" style={{ animationDelay: '1.5s', opacity: 0 }} />
                <path d="M 320 180 Q 323 180 323 177 Q 323 180 326 180 Q 323 180 323 183 Q 323 180 320 180" fill="white" className="anim-pulse" style={{ animationDelay: '2.5s', opacity: 0 }} />

            </svg>
        </div>
    );
};

export default LoginAnimation;
