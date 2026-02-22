import React from 'react';

/**
 * Animated Birthday Cake SVG Component
 * Shows a cute animated birthday cake with flickering candle flames,
 * floating sparkles, and subtle bounce animation.
 */
const BirthdayCakeAnimation: React.FC<{ name?: string }> = ({ name }) => (
    <div className="flex flex-col items-center gap-2 py-2">
        <svg viewBox="0 0 100 100" className="w-20 h-20 md:w-24 md:h-24" xmlns="http://www.w3.org/2000/svg">

            {/* --- Fireworks / Party Poppers Background --- */}
            <g strokeLinecap="round">
                {/* Left Firework */}
                <g stroke="#FF6B6B" strokeWidth="1.5">
                    <path d="M 20 40 L 10 30" strokeDasharray="15" strokeDashoffset="15">
                        <animate attributeName="stroke-dashoffset" values="15; -15" dur="1.5s" repeatCount="indefinite" />
                    </path>
                    <path d="M 25 35 L 15 20" strokeDasharray="15" strokeDashoffset="15" stroke="#4ECDC4">
                        <animate attributeName="stroke-dashoffset" values="15; -15" dur="1.5s" begin="0.2s" repeatCount="indefinite" />
                    </path>
                    <path d="M 15 45 L 5 40" strokeDasharray="15" strokeDashoffset="15" stroke="#FFE66D">
                        <animate attributeName="stroke-dashoffset" values="15; -15" dur="1.5s" begin="0.4s" repeatCount="indefinite" />
                    </path>
                </g>

                {/* Right Firework */}
                <g stroke="#FF6B6B" strokeWidth="1.5">
                    <path d="M 80 40 L 90 30" strokeDasharray="15" strokeDashoffset="15">
                        <animate attributeName="stroke-dashoffset" values="15; -15" dur="1.5s" begin="0.1s" repeatCount="indefinite" />
                    </path>
                    <path d="M 75 35 L 85 20" strokeDasharray="15" strokeDashoffset="15" stroke="#4ECDC4">
                        <animate attributeName="stroke-dashoffset" values="15; -15" dur="1.5s" begin="0.3s" repeatCount="indefinite" />
                    </path>
                    <path d="M 85 45 L 95 40" strokeDasharray="15" strokeDashoffset="15" stroke="#FFE66D">
                        <animate attributeName="stroke-dashoffset" values="15; -15" dur="1.5s" begin="0.5s" repeatCount="indefinite" />
                    </path>
                </g>

                {/* Center Top Firework */}
                <g stroke="#A8E6CF" strokeWidth="1.5">
                    <path d="M 45 20 L 40 5" strokeDasharray="15" strokeDashoffset="15">
                        <animate attributeName="stroke-dashoffset" values="15; -15" dur="1.5s" begin="0.4s" repeatCount="indefinite" />
                    </path>
                    <path d="M 50 15 L 50 0" strokeDasharray="15" strokeDashoffset="15" stroke="#FFD3B6">
                        <animate attributeName="stroke-dashoffset" values="15; -15" dur="1.5s" begin="0.6s" repeatCount="indefinite" />
                    </path>
                    <path d="M 55 20 L 60 5" strokeDasharray="15" strokeDashoffset="15" stroke="#FFAAA5">
                        <animate attributeName="stroke-dashoffset" values="15; -15" dur="1.5s" begin="0.8s" repeatCount="indefinite" />
                    </path>
                </g>
            </g>

            {/* --- Star Pop/Burst --- */}
            {[
                { cx: 15, cy: 25, d: '0s', c: '#FF9FF3' },
                { cx: 85, cy: 20, d: '0.5s', c: '#54A0FF' },
                { cx: 50, cy: 10, d: '1s', c: '#1DD1A1' },
            ].map((star, i) => (
                <g key={i}>
                    <circle cx={star.cx} cy={star.cy} r="2" fill={star.c}>
                        <animate attributeName="r" values="0; 4; 0" dur="1s" begin={star.d} repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0; 1; 0" dur="1s" begin={star.d} repeatCount="indefinite" />
                    </circle>
                </g>
            ))}

            {/* Soft bounce animation for the cake */}
            <g>
                <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0,0; 0,-2; 0,0"
                    dur="2s"
                    repeatCount="indefinite"
                />

                {/* --- Bottom Tier --- */}
                <rect x="30" y="65" width="40" height="20" rx="2" fill="#FFEFEA" />
                <rect x="30" y="78" width="40" height="3" fill="#FFD6CC" opacity="0.4" />

                {/* Frosting Drip Bottom */}
                <path d="M30,65 C38,72 42,65 50,65 C58,65 62,72 70,65 L70,69 L30,69 Z" fill="#FFE3D9" />

                {/* --- Top Tier --- */}
                <rect x="38" y="50" width="24" height="15" rx="1.5" fill="#FFF8F6" />
                <rect x="38" y="55" width="24" height="2" fill="#FFE5DF" opacity="0.4" />

                {/* Frosting Drip Top */}
                <path d="M38,50 C43,54 45,50 50,50 C55,50 57,54 62,50 L62,52 L38,52 Z" fill="#FFD5CB" />

                {/* --- Candle --- */}
                <rect x="48.5" y="38" width="3" height="12" rx="1" fill="#FFDEE2" />
                <rect x="48.5" y="40" width="3" height="1.5" fill="#FFC9D2" />
                <rect x="48.5" y="45" width="3" height="1.5" fill="#FFC9D2" />
                <line x1="50" y1="38" x2="50" y2="36" stroke="#A09E9F" strokeWidth="0.8" />

                {/* --- Flame (bouncing/flickering) --- */}
                <g>
                    <ellipse cx="50" cy="32" rx="1.5" ry="3" fill="#FFB054">
                        <animate attributeName="ry" values="3; 3.5; 2.5; 3" dur="0.8s" repeatCount="indefinite" />
                        <animate attributeName="rx" values="1.5; 1.2; 1.8; 1.5" dur="0.8s" repeatCount="indefinite" />
                        <animate attributeName="cy" values="32; 31.5; 32" dur="0.8s" repeatCount="indefinite" />
                    </ellipse>
                    <ellipse cx="50" cy="33" rx="1" ry="1.5" fill="#FFE270">
                        <animate attributeName="ry" values="1.5; 2; 1.2; 1.5" dur="0.8s" repeatCount="indefinite" />
                    </ellipse>
                </g>

                {/* --- Subtle Confetti Dots Minimal --- */}
                {[
                    { cx: 35, cy: 35, c: '#FFB8B8', dur: '4s' },
                    { cx: 65, cy: 45, c: '#FFDA8A', dur: '3.5s' },
                    { cx: 40, cy: 25, c: '#C4E1FF', dur: '4.5s' },
                    { cx: 60, cy: 30, c: '#FFE3D9', dur: '5s' },
                ].map((dot, i) => (
                    <circle key={i} cx={dot.cx} cy={dot.cy} r="1" fill={dot.c}>
                        <animateTransform
                            attributeName="transform"
                            type="translate"
                            values={`0,0; 0,-3; 0,0`}
                            dur={dot.dur}
                            repeatCount="indefinite"
                        />
                    </circle>
                ))}
            </g>

            {/* --- Plate --- */}
            <ellipse cx="50" cy="85" rx="28" ry="2.5" fill="#F3F0EF" />
        </svg>

        <div className="text-center">
            <h3 className="text-lg font-bold text-rose-500 tracking-wide">
                Happy Birthday! 🎂
            </h3>
            {name && (
                <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
                    ขอให้มีความสุขมากๆ นะ {name}
                </p>
            )}
        </div>
    </div>
);

export default BirthdayCakeAnimation;
