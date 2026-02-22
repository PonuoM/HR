import React from 'react';

/**
 * Animated Birthday Cake SVG Component
 * Shows a cute animated birthday cake with flickering candle flames,
 * floating sparkles, and subtle bounce animation.
 */
const BirthdayCakeAnimation: React.FC<{ name?: string }> = ({ name }) => (
    <div className="flex flex-col items-center gap-2 py-2">
        <svg viewBox="0 0 200 200" className="w-28 h-28 md:w-32 md:h-32" xmlns="http://www.w3.org/2000/svg">
            <defs>
                {/* Candle flame glow */}
                <radialGradient id="flameGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FFA500" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#FFA500" stopOpacity="0" />
                </radialGradient>
                {/* Sparkle filter */}
                <filter id="sparkleBlur">
                    <feGaussianBlur stdDeviation="1" />
                </filter>
            </defs>

            {/* Floating sparkles */}
            {[
                { cx: 30, cy: 40, delay: '0s' },
                { cx: 170, cy: 50, delay: '0.5s' },
                { cx: 50, cy: 25, delay: '1s' },
                { cx: 150, cy: 30, delay: '1.5s' },
                { cx: 85, cy: 15, delay: '0.3s' },
                { cx: 120, cy: 20, delay: '0.8s' },
            ].map((s, i) => (
                <g key={i}>
                    <circle cx={s.cx} cy={s.cy} r="2" fill="#FFD700" filter="url(#sparkleBlur)">
                        <animate attributeName="opacity" values="0;1;0" dur="2s" begin={s.delay} repeatCount="indefinite" />
                        <animate attributeName="cy" values={`${s.cy};${s.cy - 15};${s.cy}`} dur="3s" begin={s.delay} repeatCount="indefinite" />
                    </circle>
                    {/* Star shape */}
                    <text x={s.cx} y={s.cy} textAnchor="middle" dominantBaseline="central" fontSize="8" fill="#FFD700">
                        <animate attributeName="opacity" values="0;1;0" dur="2s" begin={s.delay} repeatCount="indefinite" />
                        ✦
                    </text>
                </g>
            ))}

            {/* Cake base - bottom tier */}
            <rect x="45" y="130" width="110" height="40" rx="8" fill="#E8A87C" stroke="#D4956B" strokeWidth="1.5" />
            <rect x="45" y="130" width="110" height="12" rx="4" fill="#F0C8A0" opacity="0.5" />

            {/* Frosting drips - bottom */}
            {[55, 75, 95, 115, 135].map((x, i) => (
                <ellipse key={i} cx={x} cy="130" rx="6" ry={4 + (i % 2) * 3} fill="#FCEAE0" />
            ))}

            {/* Cake top tier */}
            <rect x="60" y="95" width="80" height="38" rx="6" fill="#F4A8C1" stroke="#E8929B" strokeWidth="1.5" />
            <rect x="60" y="95" width="80" height="10" rx="4" fill="#F8C8D8" opacity="0.5" />

            {/* Frosting drips - top */}
            {[70, 88, 105, 122].map((x, i) => (
                <ellipse key={i} cx={x} cy="95" rx="5" ry={3 + (i % 2) * 2} fill="#FFE4EE" />
            ))}

            {/* Decorations - dots on cake */}
            {[58, 73, 88, 103, 118, 133, 148].map((x, i) => (
                <circle key={i} cx={x} cy="150" r="3" fill={i % 2 === 0 ? '#FF6B9D' : '#FFD700'} />
            ))}

            {/* Candle 1 (left) */}
            <rect x="80" y="70" width="5" height="27" rx="2" fill="#FFD700" />
            <rect x="80" y="70" width="5" height="8" rx="2" fill="#FFE44D" opacity="0.6" />
            {/* Wick */}
            <line x1="82.5" y1="70" x2="82.5" y2="65" stroke="#333" strokeWidth="1" />
            {/* Flame */}
            <g>
                <ellipse cx="82.5" cy="58" rx="8" ry="10" fill="url(#flameGlow)">
                    <animate attributeName="ry" values="10;12;10" dur="0.5s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="82.5" cy="60" rx="4" ry="7" fill="#FF8C00">
                    <animate attributeName="ry" values="7;8;6;7" dur="0.4s" repeatCount="indefinite" />
                    <animate attributeName="rx" values="4;3;4" dur="0.3s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="82.5" cy="61" rx="2.5" ry="5" fill="#FFDD44">
                    <animate attributeName="ry" values="5;6;4;5" dur="0.35s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="82.5" cy="62" rx="1.5" ry="3" fill="#FFF8DC">
                    <animate attributeName="ry" values="3;4;3" dur="0.3s" repeatCount="indefinite" />
                </ellipse>
            </g>

            {/* Candle 2 (center) */}
            <rect x="97" y="72" width="5" height="25" rx="2" fill="#87CEEB" />
            <rect x="97" y="72" width="5" height="8" rx="2" fill="#ADD8E6" opacity="0.6" />
            <line x1="99.5" y1="72" x2="99.5" y2="67" stroke="#333" strokeWidth="1" />
            <g>
                <ellipse cx="99.5" cy="60" rx="8" ry="10" fill="url(#flameGlow)">
                    <animate attributeName="ry" values="10;12;10" dur="0.6s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="99.5" cy="62" rx="4" ry="7" fill="#FF8C00">
                    <animate attributeName="ry" values="7;6;8;7" dur="0.45s" repeatCount="indefinite" />
                    <animate attributeName="rx" values="4;3.5;4" dur="0.35s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="99.5" cy="63" rx="2.5" ry="5" fill="#FFDD44">
                    <animate attributeName="ry" values="5;4;6;5" dur="0.4s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="99.5" cy="64" rx="1.5" ry="3" fill="#FFF8DC">
                    <animate attributeName="ry" values="3;4;3" dur="0.35s" repeatCount="indefinite" />
                </ellipse>
            </g>

            {/* Candle 3 (right) */}
            <rect x="114" y="68" width="5" height="29" rx="2" fill="#FF69B4" />
            <rect x="114" y="68" width="5" height="8" rx="2" fill="#FFB6C1" opacity="0.6" />
            <line x1="116.5" y1="68" x2="116.5" y2="63" stroke="#333" strokeWidth="1" />
            <g>
                <ellipse cx="116.5" cy="56" rx="8" ry="10" fill="url(#flameGlow)">
                    <animate attributeName="ry" values="10;12;10" dur="0.55s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="116.5" cy="58" rx="4" ry="7" fill="#FF8C00">
                    <animate attributeName="ry" values="7;8;6;7" dur="0.5s" repeatCount="indefinite" />
                    <animate attributeName="rx" values="4;3;4" dur="0.25s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="116.5" cy="59" rx="2.5" ry="5" fill="#FFDD44">
                    <animate attributeName="ry" values="5;6;4;5" dur="0.3s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="116.5" cy="60" rx="1.5" ry="3" fill="#FFF8DC">
                    <animate attributeName="ry" values="3;4;3" dur="0.25s" repeatCount="indefinite" />
                </ellipse>
            </g>

            {/* Plate */}
            <ellipse cx="100" cy="172" rx="70" ry="8" fill="#E8E8E8" stroke="#D0D0D0" strokeWidth="1" />
            <ellipse cx="100" cy="170" rx="65" ry="5" fill="#F5F5F5" />

            {/* Subtle bounce animation on the whole cake */}
            <animateTransform
                attributeName="transform"
                type="translate"
                values="0,0; 0,-3; 0,0"
                dur="2s"
                repeatCount="indefinite"
            />
        </svg>
        <div className="text-center">
            <p className="text-lg font-bold bg-gradient-to-r from-pink-500 via-amber-500 to-pink-500 bg-clip-text text-transparent animate-pulse">
                🎉 สุขสันต์วันเกิด! 🎉
            </p>
            {name && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    ขอให้มีความสุขมากๆ นะ {name}
                </p>
            )}
        </div>
    </div>
);

export default BirthdayCakeAnimation;
