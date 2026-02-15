import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';

interface DatePickerModalProps {
    value: string; // yyyy-MM-dd
    onSelect: (date: string) => void;
    onClose: () => void;
    min?: string;
    title?: string;
}

const DAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const DatePickerModal: React.FC<DatePickerModalProps> = ({ value, onSelect, onClose, min, title }) => {
    const initial = value ? new Date(value) : new Date();
    const [viewYear, setViewYear] = useState(initial.getFullYear());
    const [viewMonth, setViewMonth] = useState(initial.getMonth());

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const minDate = min ? new Date(min) : null;
    if (minDate) minDate.setHours(0, 0, 0, 0);

    const selectedStr = value || '';

    const calendarDays = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

        const cells: { day: number; month: number; year: number; isCurrentMonth: boolean; isDisabled: boolean }[] = [];

        // Previous month padding
        for (let i = firstDay - 1; i >= 0; i--) {
            const d = prevMonthDays - i;
            const m = viewMonth - 1;
            const y = m < 0 ? viewYear - 1 : viewYear;
            const mm = m < 0 ? 11 : m;
            cells.push({ day: d, month: mm, year: y, isCurrentMonth: false, isDisabled: true });
        }

        // Current month
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isDisabled = minDate ? new Date(dateStr) < minDate : false;
            cells.push({ day: d, month: viewMonth, year: viewYear, isCurrentMonth: true, isDisabled });
        }

        // Next month padding — only enough to complete the grid (max 6 rows)
        const totalNeeded = cells.length <= 35 ? 35 : 42;
        const remaining = totalNeeded - cells.length;
        for (let d = 1; d <= remaining; d++) {
            const m = viewMonth + 1;
            const y = m > 11 ? viewYear + 1 : viewYear;
            const mm = m > 11 ? 0 : m;
            cells.push({ day: d, month: mm, year: y, isCurrentMonth: false, isDisabled: true });
        }

        return cells;
    }, [viewYear, viewMonth, minDate]);

    const goMonth = (delta: number) => {
        let m = viewMonth + delta;
        let y = viewYear;
        if (m < 0) { m = 11; y--; }
        if (m > 11) { m = 0; y++; }
        setViewMonth(m);
        setViewYear(y);
    };

    const handleSelect = (cell: typeof calendarDays[0]) => {
        if (cell.isDisabled) return;
        const dateStr = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
        onSelect(dateStr);
    };

    const isToday = (cell: typeof calendarDays[0]) => {
        return cell.day === today.getDate() && cell.month === today.getMonth() && cell.year === today.getFullYear();
    };

    const isSelected = (cell: typeof calendarDays[0]) => {
        const dateStr = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
        return dateStr === selectedStr;
    };

    const modal = (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-5" onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
            {/* Backdrop — full screen */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />

            {/* Modal Card */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-[340px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="px-4 pt-4 pb-2">
                    <p className="text-[11px] text-slate-400 font-medium mb-1">{title || 'เลือกวันที่'}</p>
                    <div className="flex items-center justify-between">
                        <button onClick={() => goMonth(-1)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors active:scale-95">
                            <span className="material-icons-round text-base text-slate-500">chevron_left</span>
                        </button>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                            {MONTHS_TH[viewMonth]} {viewYear + 543}
                        </h3>
                        <button onClick={() => goMonth(1)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors active:scale-95">
                            <span className="material-icons-round text-base text-slate-500">chevron_right</span>
                        </button>
                    </div>
                </div>

                {/* Day Labels */}
                <div className="grid grid-cols-7 px-3">
                    {DAYS_TH.map((d) => (
                        <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 px-3 pb-1">
                    {calendarDays.map((cell, i) => {
                        const selected = isSelected(cell);
                        const todayMark = isToday(cell);
                        return (
                            <button
                                key={i}
                                disabled={cell.isDisabled}
                                onClick={() => handleSelect(cell)}
                                className={`
                                    h-9 w-full flex items-center justify-center text-[13px] rounded-lg transition-all
                                    ${!cell.isCurrentMonth ? 'text-slate-300 dark:text-slate-600' : ''}
                                    ${cell.isDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-primary/10 active:scale-90'}
                                    ${selected ? 'bg-primary text-white font-bold shadow-md shadow-primary/30 hover:bg-primary' : ''}
                                    ${todayMark && !selected ? 'text-primary font-bold ring-1 ring-primary/40' : ''}
                                    ${cell.isCurrentMonth && !selected && !todayMark ? 'text-slate-700 dark:text-slate-200' : ''}
                                `}
                            >
                                {cell.day}
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-3 pb-3 pt-1 flex gap-2">
                    <button onClick={() => {
                        const t = new Date();
                        const dateStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
                        onSelect(dateStr);
                    }} className="flex-1 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors active:scale-[0.98]">
                        วันนี้
                    </button>
                    <button onClick={onClose} className="flex-1 py-2 text-sm font-semibold text-slate-500 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors active:scale-[0.98]">
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );

    // Use Portal to render at document.body — escapes all parent overflow-hidden
    return ReactDOM.createPortal(modal, document.body);
};

export default DatePickerModal;
