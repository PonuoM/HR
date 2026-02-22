import React, { useId } from 'react';

type GreetingAnimationProps = {
    className?: string;
    greeting: string;
    clockStr: string;
};

const GreetingAnimation: React.FC<GreetingAnimationProps> = ({ className = '', greeting, clockStr }) => {
    const id = useId().replace(/[^a-zA-Z0-9]/g, '');
    const isMorning = greeting.includes('เช้า');
    const isAfternoon = greeting.includes('บ่าย');
    const isEvening = greeting.includes('เย็น');
    const isNight = greeting.includes('ค่ำ');

    // Dynamic Colors based on time of day
    const getColors = () => {
        if (isMorning) return {
            primary: '#FBBF24', // Amber
            secondary: '#F59E0B',
            bgGlow: '#FEF3C7',
            element: '#FDE68A'
        };
        if (isAfternoon) return {
            primary: '#F97316', // Orange
            secondary: '#EA580C',
            bgGlow: '#FFEDD5',
            element: '#FED7AA'
        };
        if (isEvening) return {
            primary: '#8B5CF6', // Purple
            secondary: '#7C3AED',
            bgGlow: '#EDE9FE',
            element: '#DDD6FE'
        };
        // Night
        return {
            primary: '#3B82F6', // Blue
            secondary: '#2563EB',
            bgGlow: '#DBEAFE',
            element: '#BFDBFE'
        };
    };

    const colors = getColors();
    const pGrad = `greetGrad-${id}`;
    const fSoftShadow = `greetShadow-${id}`;

    return (
        <div className={`relative ${className} flex items-center justify-center overflow-hidden`}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-md overflow-visible">
                <style>
                    {`
                        @keyframes greetFloat {
                            0% { transform: translateY(5px); opacity: 0; }
                            20% { opacity: 1; }
                            50% { transform: translateY(-5px); opacity: 1; }
                            100% { transform: translateY(0px); opacity: 1; }
                        }
                        @keyframes greetPulse {
                            0% { transform: scale(0.95); opacity: 0.5; }
                            50% { transform: scale(1.05); opacity: 0.8; }
                            100% { transform: scale(0.95); opacity: 0.5; }
                        }
                        @keyframes greetSpin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        @keyframes greetSpinReverse {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(-360deg); }
                        }
                        .anim-greet-float { animation: greetFloat 6s ease-in-out infinite; animation-fill-mode: both; transform-origin: center; }
                        .anim-greet-pulse { animation: greetPulse 4s ease-in-out infinite; transform-origin: center; }
                        .anim-greet-spin { animation: greetSpin 20s linear infinite; transform-origin: 50px 50px; }
                        .anim-greet-spin-reverse { animation: greetSpinReverse 25s linear infinite; transform-origin: 50px 50px; }
                        .anim-greet-delay { animation-delay: 1s; }
                    `}
                </style>

                <defs>
                    <linearGradient id={pGrad} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={colors.primary} />
                        <stop offset="100%" stopColor={colors.secondary} />
                    </linearGradient>
                    <filter id={fSoftShadow} x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.1" />
                    </filter>
                </defs>

                {/* Background Rotating Rings */}
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="4 6" className="anim-greet-spin" style={{ opacity: 0 }} />
                <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" strokeDasharray="2 4" className="anim-greet-spin-reverse" style={{ opacity: 0 }} />

                {/* Central Glowing Orb */}
                <circle cx="50" cy="50" r="22" fill={colors.bgGlow} className="anim-greet-pulse" />

                {/* Floating Central Element based on Time */}
                <g className="anim-greet-float" filter={`url(#${fSoftShadow})`} style={{ opacity: 0 }}>
                    <circle cx="50" cy="50" r="18" fill="white" />

                    {/* Time-based Icon */}
                    {(isMorning || isAfternoon) && (
                        // Sun
                        <g>
                            <circle cx="50" cy="50" r="6" fill={`url(#${pGrad})`} />
                            {/* Rays */}
                            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                                <line
                                    key={i}
                                    x1="50" y1="41" x2="50" y2="38"
                                    stroke={`url(#${pGrad})`} strokeWidth="1.5" strokeLinecap="round"
                                    transform={`rotate(${angle} 50 50)`}
                                />
                            ))}
                        </g>
                    )}

                    {(isEvening || isNight) && (
                        // Moon
                        <path
                            d="M 53 42 C 48 42 43 46 43 51 C 43 56 48 60 53 60 C 51 60 48 58 48 51 C 48 44 51 42 53 42 Z"
                            fill={`url(#${pGrad})`} transform="scale(1.2) translate(-8, -8)"
                        />
                    )}
                </g>

                {/* Floating Decorative Elements */}
                <circle cx="20" cy="30" r="3" fill="white" className="anim-greet-pulse anim-greet-delay" />
                <circle cx="80" cy="70" r="2" fill="white" className="anim-greet-pulse" />
                <circle cx="75" cy="25" r="4" fill="white" className="anim-greet-pulse anim-greet-delay" opacity="0.6" />
                <circle cx="25" cy="75" r="2" fill="white" className="anim-greet-pulse" opacity="0.8" />

            </svg>
        </div>
    );
};

export default GreetingAnimation;
