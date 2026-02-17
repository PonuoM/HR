import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Payslip } from '../../types';
import { useApi } from '../../hooks/useApi';
import { getEmployees, getPayslips } from '../../services/api';
import { useToast } from '../../components/Toast';
import CustomSelect from '../../components/CustomSelect';

// Interface for Queue Item with extra UI state
interface QueueItem extends Partial<Payslip> {
    isCustomDate?: boolean;
    fileName?: string;
}

// Hoisted to module scope (rendering-hoist-jsx)
const MONTH_OPTIONS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const AdminPayslipScreen: React.FC = () => {
    const navigate = useNavigate();
    const { toast, confirm: showConfirm } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');

    // Fetch employees from API
    const { data: employeeList } = useApi(() => getEmployees(), []);
    const employees = (employeeList || []).map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        position: emp.position || '',
    }));

    // Fetch payslip history from API
    const { data: rawHistory, refetch: refetchHistory } = useApi(() => getPayslips(), []);
    const historyFromApi = (rawHistory || []).map((p: any) => ({
        id: String(p.id),
        employeeId: p.employee_id,
        employeeName: p.employee_name || '',
        month: p.month || '',
        year: p.year || '',
        amount: p.amount || '',
        status: p.is_read ? 'read' : 'new',
        sentAt: p.created_at || new Date().toISOString(),
        imageUrl: p.file_url || '',
    })) as Payslip[];

    // Global Settings State
    const [globalMonth, setGlobalMonth] = useState('ตุลาคม');
    const [globalYear, setGlobalYear] = useState('2024');

    // State for Upload Queue
    const [uploadQueue, setUploadQueue] = useState<QueueItem[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);

    // State for History (merged from API + locally sent)
    const [localHistoryItems, setLocalHistoryItems] = useState<Payslip[]>([]);
    const historyItems = [...localHistoryItems, ...historyFromApi];

    // Helper: Try to find Employee ID inside filename
    const matchEmployeeFromFilename = (filename: string) => {
        const nameUpper = filename.toUpperCase();
        const matchedEmployee = employees.find((emp: any) => nameUpper.includes(emp.id.toUpperCase()));
        return matchedEmployee;
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(Array.from(e.target.files));
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const processFiles = (files: File[]) => {
        const newQueue = files.map(file => {
            const matchedEmp = matchEmployeeFromFilename(file.name);
            return {
                id: Math.random().toString(36).substr(2, 9),
                employeeId: matchedEmp ? matchedEmp.id : '',
                employeeName: matchedEmp ? matchedEmp.name : '',
                // Default to Global Settings
                month: globalMonth,
                year: globalYear,
                isCustomDate: false,
                imageUrl: URL.createObjectURL(file),
                status: 'new' as const,
                fileName: file.name
            };
        });
        setUploadQueue(prev => [...prev, ...newQueue]);
        setUploadSuccess(false);
    };

    // Handle Global Setting Change
    const handleGlobalChange = (field: 'month' | 'year', value: string) => {
        if (field === 'month') setGlobalMonth(value);
        if (field === 'year') setGlobalYear(value);

        // Update all items in queue that are NOT custom, or maybe update all? 
        // Requirement: "Selected -> all lines change". 
        // Usually, global change overrides everything to ensure consistency.
        setUploadQueue(prev => prev.map(item => ({
            ...item,
            [field]: value,
            isCustomDate: false // Reset custom flag as they now align with global
        })));
    };

    // Handle Individual Item Change
    const updateQueueItem = (id: string, field: keyof QueueItem, value: string) => {
        setUploadQueue(prev => prev.map(item => {
            if (item.id === id) {
                const updates: any = { [field]: value };

                // If updating employeeId, find name
                if (field === 'employeeId') {
                    const emp = employees.find((e: any) => e.id === value);
                    updates.employeeId = value;
                    updates.employeeName = emp?.name || '';
                }

                // If updating date, check if it differs from global
                if (field === 'month' || field === 'year') {
                    const newMonth = field === 'month' ? value : item.month;
                    const newYear = field === 'year' ? value : item.year;
                    // If matches global, not custom. If differs, it is custom.
                    updates.isCustomDate = (newMonth !== globalMonth || newYear !== globalYear);
                }

                return { ...item, ...updates };
            }
            return item;
        }));
    };

    const removeQueueItem = useCallback((id: string | undefined) => {
        if (!id) return;
        setUploadQueue(prev => prev.filter(item => item.id !== id));
    }, []);

    const handleSendAll = async () => {
        const invalidItems = uploadQueue.filter(item => !item.employeeId);
        if (invalidItems.length > 0) {
            toast(`ไม่สามารถส่งได้! มี ${invalidItems.length} รายการที่ยังไม่ได้ระบุพนักงาน`, 'error');
            return;
        }

        if (await showConfirm({ message: `ยืนยันการส่งสลิปเงินเดือนจำนวน ${uploadQueue.length} รายการ?`, type: 'info', confirmText: 'ส่งเลย' })) {
            const sentItems = uploadQueue.map(item => ({
                ...item,
                sentAt: new Date().toISOString(),
                amount: 'xxxxx',
                status: 'new' as const
            })) as Payslip[];

            setLocalHistoryItems(prev => [...sentItems, ...prev]);
            setUploadQueue([]);
            setUploadSuccess(true);
            setTimeout(() => setUploadSuccess(false), 3000);
        }
    };

    const monthOptions = MONTH_OPTIONS;

    return (
        <div className="pt-14 md:pt-8 pb-8 px-4 md:px-8 max-w-[1600px] mx-auto min-h-full flex flex-col h-full">
            <header className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/profile')} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
                        <span className="material-icons-round">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">จัดการเงินเดือน</h1>
                        <p className="text-xs md:text-base text-gray-500 dark:text-gray-400">ส่งสลิปเงินเดือนและดูประวัติการส่ง</p>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 mb-6">
                <button
                    onClick={() => setActiveTab('upload')}
                    className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${activeTab === 'upload' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                >
                    อัปโหลดสลิป
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                >
                    ประวัติการส่ง
                </button>
            </div>

            {activeTab === 'upload' ? (
                <div className="flex-1 flex flex-col pb-20 md:pb-0">

                    {/* GLOBAL SETTINGS BAR */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                            <div className="flex items-center gap-2 text-primary font-bold min-w-max">
                                <span className="material-icons-round">tune</span>
                                ตั้งค่าทั้งหมด (Global)
                            </div>
                            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden md:block"></div>
                            <div className="flex-1 w-full grid grid-cols-2 md:flex gap-4 pt-3">
                                <div className="relative flex-1 md:max-w-xs">
                                    <label className="absolute -top-3 left-3 bg-white dark:bg-gray-800 px-1 text-[10px] text-primary font-bold z-10">งวดเดือน</label>
                                    <CustomSelect
                                        value={globalMonth}
                                        onChange={(val) => handleGlobalChange('month', val)}
                                        options={monthOptions.map(m => ({ value: m, label: m }))}
                                    />
                                </div>
                                <div className="relative flex-1 md:max-w-[120px]">
                                    <label className="absolute -top-3 left-3 bg-white dark:bg-gray-800 px-1 text-[10px] text-primary font-bold z-10">ปี</label>
                                    <CustomSelect
                                        value={globalYear}
                                        onChange={(val) => handleGlobalChange('year', val)}
                                        options={[
                                            { value: '2024', label: '2024' },
                                            { value: '2023', label: '2023' },
                                        ]}
                                    />
                                </div>
                            </div>
                            <div className="text-xs text-gray-400">
                                *เปลี่ยนค่าตรงนี้เพื่ออัปเดตทุกรายการ
                            </div>
                        </div>
                    </div>

                    {/* Upload Area */}
                    <div
                        className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer mb-6 ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files));
                        }}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileSelect} />
                        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                            <span className="material-icons-round text-2xl">cloud_upload</span>
                            <span className="text-sm font-medium">คลิกเพื่อเพิ่มไฟล์ หรือลากไฟล์มาวาง (Auto-match ID จากชื่อไฟล์)</span>
                        </div>
                    </div>

                    {uploadSuccess && (
                        <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 flex items-center gap-2 animate-bounce">
                            <span className="material-icons-round">check_circle</span>
                            ส่งสลิปเรียบร้อยแล้ว!
                        </div>
                    )}

                    {/* Queue List */}
                    {uploadQueue.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                                <h3 className="font-bold text-gray-900 dark:text-white">รายการตรวจสอบ ({uploadQueue.length})</h3>
                                <button
                                    onClick={handleSendAll}
                                    className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg shadow-primary/30 flex items-center gap-2"
                                >
                                    <span className="material-icons-round text-sm">send</span>
                                    ส่งข้อมูล
                                </button>
                            </div>
                            <div className="overflow-y-auto p-2 space-y-3 flex-1">
                                {uploadQueue.map((item) => {
                                    const isMatched = !!item.employeeId;
                                    return (
                                        <div key={item.id} className={`flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border transition-colors ${isMatched ? 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800' : 'border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10'}`}>
                                            {/* Preview & Status */}
                                            <div className="flex items-center gap-4">
                                                <img src={item.imageUrl} className="w-16 h-20 object-cover rounded bg-gray-200 border border-gray-200 dark:border-gray-600" alt="Preview" />
                                                <div className="md:w-48 overflow-hidden">
                                                    <p className="text-xs text-gray-500 truncate mb-1" title={item.fileName}>{item.fileName}</p>
                                                    {isMatched ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-bold">
                                                            <span className="material-icons-round text-[10px]">check</span> จับคู่แล้ว
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold">
                                                            <span className="material-icons-round text-[10px]">priority_high</span> ระบุตัวตนไม่ได้
                                                        </span>
                                                    )}

                                                    {/* Custom Date Indicator */}
                                                    {item.isCustomDate && (
                                                        <div className="mt-1">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-bold">
                                                                <span className="material-icons-round text-[10px]">edit</span> กำหนดเอง
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Controls */}
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                                                {/* Employee Selector */}
                                                <div className="flex flex-col">
                                                    <label className="text-[10px] text-gray-400 uppercase font-bold mb-1">พนักงาน</label>
                                                    <CustomSelect
                                                        value={item.employeeId}
                                                        onChange={(val) => updateQueueItem(item.id!, 'employeeId', val)}
                                                        placeholder="-- กรุณาเลือกพนักงาน --"
                                                        options={employees.map((emp: any) => ({
                                                            value: emp.id,
                                                            label: `${emp.id} - ${emp.name}`,
                                                        }))}
                                                    />
                                                </div>

                                                {/* Month Selector */}
                                                <div className="flex flex-col">
                                                    <label className="text-[10px] text-gray-400 uppercase font-bold mb-1">เดือน</label>
                                                    <CustomSelect
                                                        value={item.month}
                                                        onChange={(val) => updateQueueItem(item.id!, 'month', val)}
                                                        options={monthOptions.map(m => ({ value: m, label: m }))}
                                                    />
                                                </div>

                                                {/* Year Selector */}
                                                <div className="flex flex-col">
                                                    <label className="text-[10px] text-gray-400 uppercase font-bold mb-1">ปี</label>
                                                    <CustomSelect
                                                        value={item.year}
                                                        onChange={(val) => updateQueueItem(item.id!, 'year', val)}
                                                        options={[
                                                            { value: '2024', label: '2024' },
                                                            { value: '2023', label: '2023' },
                                                        ]}
                                                    />
                                                </div>
                                            </div>

                                            {/* Delete Action */}
                                            <button
                                                onClick={() => removeQueueItem(item.id)}
                                                className="self-end md:self-center p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            >
                                                <span className="material-icons-round">delete</span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* History Tab */
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex-1">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-3">
                        <input type="text" placeholder="ค้นหาชื่อพนักงาน..." className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        <CustomSelect
                            value=""
                            onChange={() => { }}
                            placeholder="ตุลาคม 2024"
                            options={[
                                { value: 'oct24', label: 'ตุลาคม 2024' },
                                { value: 'sep24', label: 'กันยายน 2024' },
                            ]}
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                                    <th className="p-4 font-medium">พนักงาน</th>
                                    <th className="p-4 font-medium">งวดเดือน</th>
                                    <th className="p-4 font-medium">ส่งเมื่อ</th>
                                    <th className="p-4 font-medium">สถานะ</th>
                                    <th className="p-4 font-medium text-right">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {historyItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                                                    {item.employeeName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white text-sm">{item.employeeName}</p>
                                                    <p className="text-xs text-gray-500">{item.employeeId}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{item.month} {item.year}</td>
                                        <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{new Date(item.sentAt).toLocaleString('th-TH')}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.status === 'read' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                                                {item.status === 'read' ? 'เปิดอ่านแล้ว' : 'ส่งแล้ว'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
                                                <span className="material-icons-round text-lg">delete</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPayslipScreen;