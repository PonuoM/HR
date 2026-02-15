import { useEffect, useRef, useState } from 'react';

export interface SelectOption {
    value: string;
    label: string;
    badge?: string;
}

interface CustomSelectProps {
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    name?: string;
    className?: string;
    disabled?: boolean;
}

export default function CustomSelect({ options, value, onChange, placeholder = '-- เลือก --', name, className = '', disabled = false }: CustomSelectProps) {
    const [open, setOpen] = useState(false);
    const [flipUp, setFlipUp] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Auto-flip: open upward when near bottom of viewport
    const handleToggle = () => {
        if (disabled) return;
        if (!open && ref.current) {
            const rect = ref.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const dropdownHeight = Math.min(options.length * 40 + 8, 240); // estimate max-h-60 = 240px
            setFlipUp(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
        }
        setOpen(!open);
    };

    const selected = options.find(o => o.value === value);

    return (
        <div className={`relative ${className}`} ref={ref}>
            {/* Hidden input for form submission */}
            {name && <input type="hidden" name={name} value={value} />}

            <button
                type="button"
                onClick={handleToggle}
                disabled={disabled}
                className={`w-full text-left flex items-center justify-between bg-white dark:bg-[#15202b] border border-slate-200 dark:border-slate-700 text-sm rounded-2xl px-4 py-2.5 shadow-sm transition-all
                    ${open ? 'ring-2 ring-primary/50 border-primary' : ''}
                    ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'}
                    ${!selected ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}
            >
                <span className="truncate">{selected ? (selected.label + (selected.badge ? ` ${selected.badge}` : '')) : placeholder}</span>
                <span className={`material-icons-round text-lg text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>keyboard_arrow_down</span>
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className={`absolute left-0 right-0 z-50 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto
                        ${flipUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
                    >
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => { onChange(opt.value); setOpen(false); }}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between
                                    ${opt.value === value
                                        ? 'bg-primary/10 text-primary font-semibold'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                    }`}
                            >
                                <span>{opt.label}{opt.badge ? ` ${opt.badge}` : ''}</span>
                                {opt.value === value && <span className="material-icons-round text-primary text-base">check</span>}
                            </button>
                        ))}
                        {options.length === 0 && (
                            <div className="px-4 py-3 text-sm text-slate-400 text-center">ไม่มีตัวเลือก</div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
