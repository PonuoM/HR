import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getDepartments, getPositions, getEmployees, createEmployee, resetEmployeePassword, deleteEmployee, suspendEmployee, unsuspendEmployee, getCompanies } from '../../services/api';
import { useToast } from '../../components/Toast';
import CustomSelect from '../../components/CustomSelect';
import { useAuth } from '../../contexts/AuthContext';

const AdminEmployeeScreen: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { toast, confirm } = useToast();
    const { isSuperAdmin } = useAuth();
    const [showAddModal, setShowAddModal] = useState(false);

    const [editingEmployee, setEditingEmployee] = useState<any>(null);
    const [suspendingEmployee, setSuspendingEmployee] = useState<any>(null);
    const [suspendDate, setSuspendDate] = useState(new Date().toISOString().split('T')[0]);

    // Dynamic Data from API
    const { data: rawDepts, refetch: refetchDepts } = useApi(() => getDepartments(), []);
    const { data: rawPositions, refetch: refetchPositions } = useApi(() => getPositions(), []);
    const { data: employees, loading: loadingEmployees } = useApi(() => getEmployees(), []);

    const departments = (rawDepts || []).map((d: any) => d.name || d);
    const positions = (rawPositions || []).map((p: any) => p.name || p);



    // Filter states
    const [filterDept, setFilterDept] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Company list for superadmin
    const { data: companiesList } = useApi(() => isSuperAdmin ? getCompanies() : Promise.resolve([]), [isSuperAdmin]);

    // Add Modal states
    const [addPosition, setAddPosition] = useState('');
    const [addDepartment, setAddDepartment] = useState('');
    const [addCompanyId, setAddCompanyId] = useState('');
    const [addIsAdmin, setAddIsAdmin] = useState(false);
    const [addApprover, setAddApprover] = useState('');

    // Edit Modal states
    const [editDept, setEditDept] = useState('');
    const [editPos, setEditPos] = useState('');
    const [editApprover, setEditApprover] = useState('');
    const [editApprover2, setEditApprover2] = useState('');
    const [editIsAdmin, setEditIsAdmin] = useState(false);

    // Initialize edit modal state when employee selected
    useEffect(() => {
        if (editingEmployee) {
            setEditDept(editingEmployee.department_id ? String(editingEmployee.department_id) : '');
            setEditPos(editingEmployee.position_id ? String(editingEmployee.position_id) : '');
            setEditApprover(editingEmployee.approver_id || '');
            setEditApprover2(editingEmployee.approver2_id || '');
            setEditIsAdmin(editingEmployee.is_admin === 1 || editingEmployee.is_admin === '1');
        }
    }, [editingEmployee]);

    // Handle Navigation State from Dashboard
    useEffect(() => {
        if (location.state) {
            const state = location.state as { openAddModal?: boolean };
            if (state.openAddModal) {
                setShowAddModal(true);
            }
            // Clear state to avoid reopening on refresh (optional, but good practice)
            window.history.replaceState({}, document.title);
        }
    }, [location]);



    return (
        <div className="pt-6 md:pt-8 pb-8 px-4 md:px-8 max-w-[1600px] mx-auto min-h-full">
            <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/profile')} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
                        <span className="material-icons-round">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">จัดการพนักงาน</h1>
                        <p className="text-xs md:text-base text-gray-500 dark:text-gray-400">รายชื่อพนักงานและโครงสร้างองค์กร</p>
                    </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    {/* Add Employee Button */}
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex-1 md:flex-none bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary/30 transition-all active:scale-95"
                    >
                        <span className="material-icons-round text-xl">add</span>
                        <span>เพิ่มพนักงาน</span>
                    </button>
                </div>
            </header>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-center">
                <div className="relative flex-1">
                    <span className="material-icons-round absolute left-3 top-2.5 text-gray-400">search</span>
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อ, รหัสพนักงาน..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm dark:text-white"
                    />
                </div>
                <div className="flex gap-2 md:gap-4">
                    <CustomSelect
                        className="flex-1"
                        value={filterDept}
                        onChange={setFilterDept}
                        placeholder="ทุกแผนก"
                        options={departments.map(dept => ({ value: dept, label: dept }))}
                    />
                    <CustomSelect
                        className="flex-1"
                        value={filterStatus}
                        onChange={setFilterStatus}
                        placeholder="สถานะ: ทั้งหมด"
                        options={[
                            { value: 'active', label: 'ปกติ' },
                            { value: 'inactive', label: 'ลาออก' },
                        ]}
                    />
                </div>
            </div>

            {/* DESKTOP VIEW: Table */}
            <div className="hidden md:block bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                                <th className="p-4 font-medium">รหัส</th>
                                <th className="p-4 font-medium">ชื่อ-นามสกุล</th>
                                <th className="p-4 font-medium">ตำแหน่ง</th>
                                <th className="p-4 font-medium">แผนก</th>
                                <th className="p-4 font-medium">วันที่เริ่มงาน</th>
                                <th className="p-4 font-medium">สถานะ</th>
                                <th className="p-4 font-medium text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {(employees || []).map((emp: any) => (
                                <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                                    <td className="p-4 text-sm font-mono text-gray-500">{emp.id}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <img src={emp.avatar || `https://picsum.photos/id/${(emp.id?.charCodeAt?.(3) || 60)}/40/40`} className="w-9 h-9 rounded-full object-cover" alt="avatar" />
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white text-sm">{emp.name}</p>
                                                <p className="text-xs text-gray-400">{emp.email || ''}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{emp.position}</td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{emp.department}</td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{emp.hire_date ? new Date(emp.hire_date).toLocaleDateString('th-TH') : ''}</td>
                                    <td className="p-4">
                                        {emp.is_active === '0' || emp.is_active === 0 ? (
                                            <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-semibold">
                                                ระงับ {emp.terminated_at ? `(${new Date(emp.terminated_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})` : ''}
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-semibold">ปกติ</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={async () => { if (await confirm({ message: `รีเซ็ตรหัสผ่านของ ${emp.name} เป็น 1234?`, type: 'warning', confirmText: 'รีเซ็ต' })) { await resetEmployeePassword(emp.id); toast(`รีเซ็ตรหัสผ่านของ ${emp.name} เรียบร้อย (รหัสใหม่: 1234)`, 'success'); } }}
                                                className="p-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-500 hover:text-orange-600 transition-colors"
                                                title="รีเซ็ตรหัสผ่าน"
                                            >
                                                <span className="material-icons-round text-lg">lock_reset</span>
                                            </button>
                                            <button
                                                onClick={() => setEditingEmployee(emp)}
                                                className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 hover:text-blue-600 transition-colors"
                                                title="แก้ไข"
                                            >
                                                <span className="material-icons-round text-lg">edit</span>
                                            </button>
                                            {emp.is_active === '0' || emp.is_active === 0 ? (
                                                <button
                                                    onClick={async () => { if (await confirm({ message: `ยกเลิกระงับ ${emp.name}?`, type: 'info', confirmText: 'ยืนยัน' })) { await unsuspendEmployee(emp.id); toast('คืนสถานะเรียบร้อย', 'success'); window.location.reload(); } }}
                                                    className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-500 hover:text-green-600 transition-colors"
                                                    title="คืนสถานะ"
                                                >
                                                    <span className="material-icons-round text-lg">check_circle</span>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => { setSuspendingEmployee(emp); setSuspendDate(new Date().toISOString().split('T')[0]); }}
                                                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-colors"
                                                    title="ระงับ"
                                                >
                                                    <span className="material-icons-round text-lg">block</span>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MOBILE VIEW: Card List */}
            <div className="md:hidden space-y-4 pb-20">
                {(employees || []).map((emp: any) => (
                    <div key={emp.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <img src={emp.avatar || `https://picsum.photos/id/${(emp.id?.charCodeAt?.(3) || 60)}/60/60`} className="w-12 h-12 rounded-xl object-cover" alt="avatar" />
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">{emp.name}</h3>
                                    <p className="text-xs text-gray-500">{emp.position}</p>
                                </div>
                            </div>
                            {emp.is_active === '0' || emp.is_active === 0 ? (
                                <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] font-bold">
                                    ระงับ {emp.terminated_at ? `(${new Date(emp.terminated_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })})` : ''}
                                </span>
                            ) : (
                                <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] font-bold">ปกติ</span>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mb-4 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700/50">
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase">รหัสพนักงาน</p>
                                <p className="font-medium text-gray-700 dark:text-gray-300 font-mono">{emp.id}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase">แผนก</p>
                                <p className="font-medium text-gray-700 dark:text-gray-300">{emp.department}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-[10px] text-gray-400 uppercase">อีเมล</p>
                                <p className="font-medium text-gray-700 dark:text-gray-300 truncate">{emp.email || ''}</p>
                            </div>
                        </div>

                        <div className="flex gap-1.5 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                            <button
                                onClick={async () => { if (await confirm({ message: `รีเซ็ตรหัสผ่านของ ${emp.name} เป็น 1234?`, type: 'warning', confirmText: 'รีเซ็ต' })) { await resetEmployeePassword(emp.id); toast('รีเซ็ตรหัสผ่านเรียบร้อย (รหัสใหม่: 1234)', 'success'); } }}
                                className="flex-1 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400 text-[11px] font-medium hover:bg-orange-100 dark:hover:bg-orange-900/20 flex items-center justify-center gap-1 active:scale-95 transition-all"
                            >
                                <span className="material-icons-round text-[14px]">lock_reset</span>
                                รีเซ็ต
                            </button>
                            <button
                                onClick={() => setEditingEmployee(emp)}
                                className="flex-1 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 text-[11px] font-medium hover:bg-blue-100 dark:hover:bg-blue-900/20 flex items-center justify-center gap-1 active:scale-95 transition-all"
                            >
                                <span className="material-icons-round text-[14px]">edit</span>
                                แก้ไข
                            </button>
                            {emp.is_active === '0' || emp.is_active === 0 ? (
                                <button
                                    onClick={async () => { if (await confirm({ message: `ยกเลิกระงับ ${emp.name}?`, type: 'info', confirmText: 'ยืนยัน' })) { await unsuspendEmployee(emp.id); toast('คืนสถานะเรียบร้อย', 'success'); window.location.reload(); } }}
                                    className="flex-1 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 text-[11px] font-medium hover:bg-green-100 dark:hover:bg-green-900/20 flex items-center justify-center gap-1 active:scale-95 transition-all"
                                >
                                    <span className="material-icons-round text-[14px]">check_circle</span>
                                    คืนสถานะ
                                </button>
                            ) : (
                                <button
                                    onClick={() => { setSuspendingEmployee(emp); setSuspendDate(new Date().toISOString().split('T')[0]); }}
                                    className="flex-1 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-[11px] font-medium hover:bg-red-100 dark:hover:bg-red-900/20 flex items-center justify-center gap-1 active:scale-95 transition-all"
                                >
                                    <span className="material-icons-round text-[14px]">block</span>
                                    ระงับ
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                <div className="flex justify-center pt-2">
                    <button className="text-sm text-gray-500">แสดงเพิ่มเติม...</button>
                </div>
            </div>

            {/* --- MODAL 1: ADD EMPLOYEE --- */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 w-full md:w-[600px] rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-slide-up md:animate-scale-in">
                        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-100 dark:border-gray-800">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">เพิ่มพนักงานใหม่</h2>
                            <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                                <span className="material-icons-round text-gray-500">close</span>
                            </button>
                        </div>

                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            const form = e.target as HTMLFormElement;
                            const formData = new FormData(form);
                            const firstName = (formData.get('first_name') as string || '').trim();
                            const lastName = (formData.get('last_name') as string || '').trim();
                            const empId = (formData.get('emp_id') as string || '').trim();
                            const email = (formData.get('email') as string || '').trim();
                            const salary = formData.get('base_salary') as string;

                            if (!empId) { toast('กรุณาระบุรหัสพนักงาน', 'error'); return; }
                            if (!firstName) { toast('กรุณาระบุชื่อจริง', 'error'); return; }

                            const fullName = lastName ? `${firstName} ${lastName}` : firstName;

                            // Find department_id and position_id from name
                            const deptObj = (rawDepts || []).find((d: any) => (d.name || d) === addDepartment);
                            const posObj = (rawPositions || []).find((p: any) => (p.name || p) === addPosition);

                            try {
                                const result = await createEmployee({
                                    id: empId,
                                    name: fullName,
                                    email: email || undefined,
                                    password: '1234',
                                    department_id: deptObj?.id ? Number(deptObj.id) : undefined,
                                    position_id: posObj?.id ? Number(posObj.id) : undefined,
                                    base_salary: salary ? Number(salary) : null,
                                    approver_id: addApprover || null,
                                    ...(addCompanyId ? { company_id: Number(addCompanyId) } : {}),
                                    ...(addIsAdmin ? { is_admin: 1 } : {}),
                                });
                                if (result?.error) {
                                    toast(result.error, 'error');
                                    return;
                                }
                                toast('เพิ่มพนักงานเรียบร้อย', 'success');
                                setShowAddModal(false);
                                setAddPosition('');
                                setAddDepartment('');
                                setAddApprover('');
                                setAddCompanyId('');
                                setAddIsAdmin(false);
                                window.location.reload();
                            } catch (err: any) {
                                toast(err?.message || 'เกิดข้อผิดพลาด', 'error');
                            }
                        }} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-4 md:p-6 overflow-y-auto space-y-4 md:space-y-6 flex-1">
                                <div className="flex justify-center mb-2">
                                    <div className="relative group cursor-pointer">
                                        <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                                            <span className="material-icons-round text-gray-400 text-3xl">add_a_photo</span>
                                        </div>
                                        <div className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full shadow-sm">
                                            <span className="material-icons-round text-sm block">edit</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Company Selector (Superadmin only) */}
                                {isSuperAdmin && companiesList && companiesList.length > 0 && (
                                    <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                                        <label className="block text-sm font-medium text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                                            <span className="material-icons-round text-base">domain</span>
                                            บริษัท
                                        </label>
                                        <CustomSelect
                                            value={addCompanyId}
                                            onChange={setAddCompanyId}
                                            placeholder="-- ใช้บริษัทปัจจุบัน --"
                                            options={companiesList.filter((c: any) => c.is_active).map((c: any) => ({ value: String(c.id), label: `${c.name} (${c.code})` }))}
                                        />
                                        <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1">ตัวเลือก Superadmin: เลือกบริษัทที่ต้องการสร้างพนักงาน (ว่าง = บริษัทปัจจุบัน)</p>

                                        {/* is_admin toggle */}
                                        <label className="flex items-center gap-2.5 mt-3 pt-3 border-t border-amber-200 dark:border-amber-800 cursor-pointer">
                                            <div className={`relative w-10 h-5 rounded-full transition-colors ${addIsAdmin ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`} onClick={() => setAddIsAdmin(!addIsAdmin)}>
                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${addIsAdmin ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">สิทธิ์ Admin</span>
                                                <p className="text-[10px] text-amber-600 dark:text-amber-500">เปิดให้พนักงานมีสิทธิ์เข้า Admin Panel</p>
                                            </div>
                                        </label>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อจริง <span className="text-red-500">*</span></label>
                                        <input type="text" name="first_name" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 focus:outline-none text-gray-900 dark:text-white" placeholder="เช่น สมชาย" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">นามสกุล</label>
                                        <input type="text" name="last_name" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 focus:outline-none text-gray-900 dark:text-white" placeholder="เช่น ใจดี" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">รหัสพนักงาน <span className="text-red-500">*</span></label>
                                        <input type="text" name="emp_id" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 focus:outline-none text-gray-900 dark:text-white" placeholder="เช่น EMP006" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">อีเมล</label>
                                        <input type="email" name="email" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 focus:outline-none text-gray-900 dark:text-white" placeholder="email@company.com" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ตำแหน่ง</label>
                                        <CustomSelect
                                            value={addPosition}
                                            onChange={setAddPosition}
                                            placeholder="-- เลือกตำแหน่ง --"
                                            options={(rawPositions || []).map((p: any) => ({ value: p.name || p, label: p.name || p }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">แผนก</label>
                                        <CustomSelect
                                            value={addDepartment}
                                            onChange={setAddDepartment}
                                            placeholder="-- เลือกแผนก --"
                                            options={(rawDepts || []).map((d: any) => ({ value: d.name || d, label: d.name || d }))}
                                        />
                                    </div>
                                </div>

                                {/* SALARY INPUT */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เงินเดือนพื้นฐาน (บาท)</label>
                                    <div className="relative">
                                        <input type="number" name="base_salary" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 focus:outline-none text-gray-900 dark:text-white pl-10" placeholder="0.00" />
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-gray-500 font-bold">฿</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1 absolute right-1 -bottom-5">ใช้สำหรับคำนวณ OT</p>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-2">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <span className="material-icons-round text-primary text-base">supervisor_account</span>
                                        ผู้อนุมัติ (ขั้น 1)
                                    </h3>
                                    <div>
                                        <CustomSelect
                                            value={addApprover}
                                            onChange={setAddApprover}
                                            placeholder="-- ไม่มี (ส่งตรงไป HR) --"
                                            options={(employees || []).filter((emp: any) =>
                                                (String(emp.can_have_subordinates) === '1' || String(emp.is_admin) === '1') &&
                                                (String(emp.is_active) !== '0')
                                            ).map((emp: any) => ({
                                                value: emp.id,
                                                label: `${emp.name} (${emp.position || 'ไม่ระบุตำแหน่ง'})`,
                                            }))}
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">เลือกหัวหน้าที่จะอนุมัติคำขอลา/OT ก่อนส่งต่อ HR</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">รหัสผ่านเริ่มต้น</label>
                                    <div className="relative">
                                        <input type="text" value="1234" readOnly className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-gray-500 dark:text-gray-400" />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">พนักงานสามารถเปลี่ยนรหัสผ่านได้ภายหลัง</p>
                                </div>
                            </div>

                            <div className="p-4 md:p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">ยกเลิก</button>
                                <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover shadow-lg shadow-primary/30 transition-all">บันทึกข้อมูล</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


            {/* --- MODAL 3: EDIT EMPLOYEE --- */}
            {
                editingEmployee && (
                    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4 animate-fade-in">
                        <div className="bg-white dark:bg-gray-900 w-full md:w-[500px] rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-slide-up md:animate-scale-in">
                            <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-100 dark:border-gray-800">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">แก้ไขพนักงาน</h2>
                                <button onClick={() => setEditingEmployee(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                                    <span className="material-icons-round text-gray-500">close</span>
                                </button>
                            </div>
                            <form
                                className="p-4 md:p-6 overflow-y-auto space-y-4 flex-1"
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    const form = e.target as HTMLFormElement;
                                    const formData = new FormData(form);
                                    const { updateEmployee } = await import('../../services/api');
                                    const approverVal = formData.get('approver_id') as string;
                                    const approver2Val = formData.get('approver2_id') as string;
                                    await updateEmployee(editingEmployee.id, {
                                        name: formData.get('name') as string,
                                        email: formData.get('email') as string,
                                        department_id: Number(formData.get('department_id')),
                                        position_id: Number(formData.get('position_id')),
                                        base_salary: formData.get('base_salary') ? Number(formData.get('base_salary')) : null,
                                        hire_date: (formData.get('hire_date') as string) || null,
                                        approver_id: approverVal || null,
                                        approver2_id: approver2Val || null,
                                        is_admin: editIsAdmin ? 1 : 0,
                                    });
                                    toast('แก้ไขข้อมูลเรียบร้อย', 'success');
                                    setEditingEmployee(null);
                                    window.location.reload();
                                }}
                            >
                                <div className="flex justify-center mb-2">
                                    <img src={editingEmployee.avatar || `https://picsum.photos/id/60/80/80`} className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700" alt="avatar" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อ-นามสกุล</label>
                                    <input name="name" type="text" defaultValue={editingEmployee.name} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 focus:outline-none text-gray-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">อีเมล</label>
                                    <input name="email" type="email" defaultValue={editingEmployee.email || ''} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 focus:outline-none text-gray-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">วันที่เริ่มงาน</label>
                                    <input name="hire_date" type="date" defaultValue={editingEmployee.hire_date || ''} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 focus:outline-none text-gray-900 dark:text-white" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">แผนก</label>
                                        <CustomSelect
                                            name="department_id"
                                            value={editDept}
                                            onChange={setEditDept}
                                            placeholder="-- เลือก --"
                                            options={(rawDepts || []).map((d: any) => ({ value: String(d.id), label: d.name }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ตำแหน่ง</label>
                                        <CustomSelect
                                            name="position_id"
                                            value={editPos}
                                            onChange={setEditPos}
                                            placeholder="-- เลือก --"
                                            options={(rawPositions || []).map((p: any) => ({ value: String(p.id), label: p.name }))}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เงินเดือนพื้นฐาน (บาท)</label>
                                    <div className="relative">
                                        <input name="base_salary" type="number" step="0.01" defaultValue={editingEmployee.base_salary || ''} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 pl-10 focus:ring-2 focus:ring-primary/50 focus:outline-none text-gray-900 dark:text-white" placeholder="0.00" />
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-gray-500 font-bold">฿</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">ใช้สำหรับคำนวณ OT</p>
                                </div>

                                {/* Approver Dropdown */}
                                <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                                        <span className="material-icons-round text-primary text-base">supervisor_account</span>
                                        ผู้อนุมัติ (ขั้น 1)
                                    </label>
                                    <CustomSelect
                                        name="approver_id"
                                        value={editApprover}
                                        onChange={setEditApprover}
                                        placeholder="-- ไม่มี (ส่งตรงไป HR) --"
                                        options={(employees || []).filter((emp: any) =>
                                            emp.id !== editingEmployee.id &&
                                            (String(emp.can_have_subordinates) === '1' || String(emp.is_admin) === '1') &&
                                            (String(emp.is_active) !== '0')
                                        ).map((emp: any) => ({
                                            value: emp.id,
                                            label: `${emp.name} (${emp.position || 'ไม่ระบุตำแหน่ง'})`,
                                        }))}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">หัวหน้างานโดยตรงที่อนุมัติก่อนส่งต่อขั้นที่ 2</p>
                                </div>

                                {/* Approver 2 Dropdown */}
                                <div className="mt-3">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                                        <span className="material-icons-round text-amber-500 text-base">verified_user</span>
                                        ผู้อนุมัติ (ขั้น 2)
                                    </label>
                                    <CustomSelect
                                        name="approver2_id"
                                        value={editApprover2}
                                        onChange={setEditApprover2}
                                        placeholder="-- ไม่มี --"
                                        options={(employees || []).filter((emp: any) =>
                                            emp.id !== editingEmployee.id &&
                                            (String(emp.is_active) !== '0')
                                        ).map((emp: any) => ({
                                            value: emp.id,
                                            label: `${emp.name} (${emp.position || 'ไม่ระบุตำแหน่ง'})`,
                                            badge: emp.is_admin_system === '1' ? '★ HR' : undefined,
                                        }))}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">ผู้อนุมัติลำดับที่ 2 (เช่น HR หรือผู้บริหาร)</p>
                                </div>

                                {/* Admin Toggle */}
                                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-2">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div
                                            className={`relative w-11 h-6 rounded-full transition-colors ${editIsAdmin ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                                            onClick={() => setEditIsAdmin(!editIsAdmin)}
                                        >
                                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${editIsAdmin ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="material-icons-round text-base text-amber-500">admin_panel_settings</span>
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">สิทธิ์ Admin</span>
                                                {editIsAdmin && (
                                                    <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold">เปิด</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-0.5">เปิดให้พนักงานสามารถเข้า Admin Panel ได้</p>
                                        </div>
                                    </label>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setEditingEmployee(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                        ยกเลิก
                                    </button>
                                    <button type="submit" className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium shadow-lg shadow-primary/30 transition-colors">
                                        บันทึก
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* --- MODAL: SUSPEND EMPLOYEE --- */}
            {
                suspendingEmployee && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 mx-auto mb-4 flex items-center justify-center">
                                    <span className="material-icons-round text-3xl text-red-500">block</span>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">ระงับพนักงาน</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                    ยืนยันระงับ <span className="font-semibold text-gray-700 dark:text-gray-300">{suspendingEmployee.name}</span>
                                </p>

                                <div className="text-left mb-6">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">วันที่ออก / วันที่มีผลระงับ</label>
                                    <input
                                        type="date"
                                        value={suspendDate}
                                        onChange={(e) => setSuspendDate(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500/50 outline-none"
                                    />
                                    <p className="text-xs text-gray-400 mt-1.5">ระบุวันที่พนักงานออก/ระงับ เพื่อบันทึกเป็นประวัติ</p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setSuspendingEmployee(null)}
                                        className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await suspendEmployee(suspendingEmployee.id, suspendDate);
                                                setSuspendingEmployee(null);
                                                window.location.reload();
                                            } catch (err) {
                                                toast('เกิดข้อผิดพลาด: ' + (err as Error).message, 'error');
                                            }
                                        }}
                                        className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold shadow-lg shadow-red-500/30 transition-colors"
                                    >
                                        ยืนยันระงับ
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default AdminEmployeeScreen;