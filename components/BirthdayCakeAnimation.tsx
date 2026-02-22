import React from 'react';

/**
 * Animated Birthday Cake SVG Component
 * Shows a cute animated birthday cake with flickering candle flames,
 * floating sparkles, and subtle bounce animation.
 */
const BirthdayCakeAnimation: React.FC<{ name?: string }> = ({ name }) => (
    <div className="flex flex-col items-center gap-3 py-3">
        <svg viewBox="0 0 100 100" className="w-24 h-24 md:w-28 md:h-28" xmlns="http://www.w3.org/2000/svg">
            {/* Soft bounce animation for the cake */}
            <g>
                <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0,0; 0,-2; 0,0"
                    dur="3s"
                    repeatCount="indefinite"
                />

                {/* --- Bottom Tier --- */}
                <rect x="25" y="60" width="50" height="25" rx="3" fill="#FFEFEA" />
                <rect x="25" y="75" width="50" height="4" fill="#FFD6CC" opacity="0.4" />

                {/* Frosting Drip Bottom */}
                <path d="M25,60 C35,68 40,60 50,60 C60,60 65,65 75,60 L75,65 L25,65 Z" fill="#FFE3D9" />

                {/* --- Top Tier --- */}
                <rect x="35" y="40" width="30" height="20" rx="2" fill="#FFF8F6" />
                <rect x="35" y="48" width="30" height="3" fill="#FFE5DF" opacity="0.4" />

                {/* Frosting Drip Top */}
                <path d="M35,40 C42.5,45 45,40 50,40 C55,40 57.5,45 65,40 L65,43 L35,43 Z" fill="#FFD5CB" />

                {/* --- Candle --- */}
                <rect x="48" y="25" width="4" height="15" rx="1" fill="#FFDEE2" />
                <rect x="48" y="28" width="4" height="2" fill="#FFC9D2" />
                <rect x="48" y="34" width="4" height="2" fill="#FFC9D2" />
                <line x1="50" y1="25" x2="50" y2="23" stroke="#A09E9F" strokeWidth="0.8" />

                {/* --- Flame (bouncing/flickering) --- */}
                <g>
                    <ellipse cx="50" cy="18" rx="2" ry="4" fill="#FFB054">
                        <animate attributeName="ry" values="4; 4.5; 3.5; 4" dur="0.8s" repeatCount="indefinite" />
                        <animate attributeName="rx" values="2; 1.8; 2.2; 2" dur="0.8s" repeatCount="indefinite" />
                        <animate attributeName="cy" values="18; 17.5; 18" dur="0.8s" repeatCount="indefinite" />
                    </ellipse>
                    <ellipse cx="50" cy="19" rx="1.2" ry="2" fill="#FFE270">
                        <animate attributeName="ry" values="2; 2.5; 1.8; 2" dur="0.8s" repeatCount="indefinite" />
                    </ellipse>
                </g>

                {/* --- Subtle Confetti Dots Minimal --- */}
                {[
                    { cx: 20, cy: 30, c: '#FFB8B8', dur: '4s' },
                    { cx: 80, cy: 45, c: '#FFDA8A', dur: '3.5s' },
                    { cx: 30, cy: 15, c: '#C4E1FF', dur: '4.5s' },
                    { cx: 75, cy: 25, c: '#FFE3D9', dur: '5s' },
                ].map((dot, i) => (
                    <circle key={i} cx={dot.cx} cy={dot.cy} r="1.5" fill={dot.c}>
                        <animateTransform
                            attributeName="transform"
                            type="translate"
                            values={`0,0; 0,-4; 0,0`}
                            dur={dot.dur}
                            repeatCount="indefinite"
                        />
                    </circle>
                ))}
            </g>

            {/* --- Plate --- */}
            <ellipse cx="50" cy="85" rx="35" ry="3" fill="#F3F0EF" />
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
