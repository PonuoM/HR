import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

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
    searchable?: boolean;
}

export default function CustomSelect({ options, value, onChange, placeholder = '-- เลือก --', name, className = '', disabled = false, searchable = false }: CustomSelectProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const ref = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Compute dropdown position based on trigger button's bounding rect
    const computePosition = useCallback(() => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const dropdownHeight = Math.min(options.length * 40 + 8, 240);
        const spaceBelow = window.innerHeight - rect.bottom;
        const flipUp = spaceBelow < dropdownHeight && rect.top > spaceBelow;

        setDropdownStyle({
            position: 'fixed',
            left: rect.left,
            width: rect.width,
            zIndex: 9999,
            ...(flipUp
                ? { bottom: window.innerHeight - rect.top + 4 }
                : { top: rect.bottom + 4 }
            ),
        });
    }, [options.length]);

    // Close on outside click
    useEffect(() => {
        if (!open) {
            setSearchQuery(''); // Reset search when closed
            return;
        }
        const handler = (e: MouseEvent) => {
            if (
                ref.current && !ref.current.contains(e.target as Node) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Focus search input when opened
    useEffect(() => {
        if (open && searchable && searchInputRef.current) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
        }
    }, [open, searchable]);

    // Reposition on scroll/resize while open
    useEffect(() => {
        if (!open) return;
        const reposition = () => computePosition();
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
        return () => {
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        };
    }, [open, computePosition]);

    const handleToggle = () => {
        if (disabled) return;
        if (!open) {
            computePosition();
        }
        setOpen(!open);
    };

    const selected = options.find(o => o.value === value);

    const filteredOptions = searchable 
        ? options.filter(o => (o.label + (o.badge || '')).toLowerCase().includes(searchQuery.toLowerCase()))
        : options;

    const dropdownContent = open ? createPortal(
        <>
            <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
            <div
                ref={dropdownRef}
                style={dropdownStyle}
                className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden max-h-60 flex flex-col"
            >
                {searchable && (
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                        <div className="relative">
                            <span className="material-icons-round absolute left-2.5 top-2 text-slate-400 text-sm">search</span>
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:text-white"
                                placeholder="ค้นหา..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                )}
                <div className="overflow-y-auto flex-1">
                    {filteredOptions.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value === value ? '' : opt.value); setOpen(false); }}
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
                    {filteredOptions.length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-400 text-center">ไม่มีตัวเลือก</div>
                    )}
                </div>
            </div>
        </>,
        document.body
    ) : null;

    return (
        <div className={`relative ${className}`} ref={ref}>
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

            {dropdownContent}
        </div>
    );
}
