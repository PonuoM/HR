import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getEmployees, registerFace, getFaceDescriptor, deleteFaceDescriptor } from '../../services/api';
import { useToast } from '../../components/Toast';
import FaceCapture from '../../components/FaceCapture';

interface Employee {
    id: string;
    name: string;
    department: string;
    face_registered_at?: string;
}

const AdminFaceRegistrationScreen: React.FC = () => {
    const { isAdmin } = useAuth();
    const navigate = useNavigate();
    const { toast, confirm: showConfirm } = useToast();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [faceStatus, setFaceStatus] = useState<Record<string, boolean>>({});

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const data = await getEmployees();
            setEmployees(data);
            // Check face status for each
            const statuses: Record<string, boolean> = {};
            for (const emp of data) {
                try {
                    const face = await getFaceDescriptor(emp.id);
                    statuses[emp.id] = face.has_face;
                } catch {
                    statuses[emp.id] = false;
                }
            }
            setFaceStatus(statuses);
        } catch (err: any) {
            toast(err.message, 'error');
        }
        setLoading(false);
    };

    useEffect(() => { fetchEmployees(); }, []);

    if (!isAdmin) {
        return (
            <div className="p-6 text-center">
                <span className="material-icons-round text-5xl text-red-400 mb-3 block">lock</span>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
                <p className="text-gray-500">เฉพาะ Admin เท่านั้น</p>
            </div>
        );
    }

    const handleRegister = (emp: Employee) => {
        setSelectedEmployee(emp);
        setShowCamera(true);
    };

    const handleCapture = async (descriptor: number[]) => {
        if (!selectedEmployee) return;
        try {
            await registerFace(selectedEmployee.id, descriptor);
            toast(`ลงทะเบียนใบหน้า ${selectedEmployee.name} เรียบร้อย`, 'success');
            setFaceStatus(prev => ({ ...prev, [selectedEmployee.id]: true }));
        } catch (err: any) {
            toast(err.message, 'error');
        }
        setShowCamera(false);
        setSelectedEmployee(null);
    };

    const handleDelete = async (emp: Employee) => {
        if (!(await showConfirm({ message: `ลบข้อมูลใบหน้าของ ${emp.name}?`, type: 'danger', confirmText: 'ลบ' }))) return;
        try {
            await deleteFaceDescriptor(emp.id);
            toast('ลบข้อมูลใบหน้าเรียบร้อย', 'success');
            setFaceStatus(prev => ({ ...prev, [emp.id]: false }));
        } catch (err: any) {
            toast(err.message, 'error');
        }
    };

    return (
        <div className="p-4 pb-24 max-w-xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate('/profile')} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
                    <span className="material-icons-round">arrow_back</span>
                </button>
                <span className="material-icons-round text-3xl text-primary">face</span>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">ลงทะเบียนใบหน้า</h1>
                    <p className="text-sm text-gray-500">จัดการข้อมูล Face Recognition สำหรับ Clock-in</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="rounded-2xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 text-center">
                    <span className="text-2xl font-bold text-green-600">{Object.values(faceStatus).filter(Boolean).length}</span>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-1">ลงทะเบียนแล้ว</p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-4 text-center">
                    <span className="text-2xl font-bold text-orange-600">{Object.values(faceStatus).filter(v => !v).length}</span>
                    <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">ยังไม่ลงทะเบียน</p>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="text-center py-10">
                    <span className="material-icons-round text-4xl animate-spin text-primary">autorenew</span>
                </div>
            )}

            {/* Employee list */}
            <div className="space-y-2">
                {employees.map(emp => (
                    <div
                        key={emp.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm"
                    >
                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${faceStatus[emp.id] ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                            }`}>
                            <span className="material-icons-round text-xl">
                                {faceStatus[emp.id] ? 'face' : 'person'}
                            </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{emp.name}</p>
                            <p className="text-xs text-gray-500">{emp.id} • {emp.department || '-'}</p>
                        </div>

                        {/* Status & actions */}
                        <div className="flex items-center gap-2">
                            {faceStatus[emp.id] ? (
                                <>
                                    <span className="text-xs text-green-500 font-medium">✓ ลงทะเบียนแล้ว</span>
                                    <button
                                        onClick={() => handleDelete(emp)}
                                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        title="ลบข้อมูลใบหน้า"
                                    >
                                        <span className="material-icons-round text-lg">delete</span>
                                    </button>
                                    <button
                                        onClick={() => handleRegister(emp)}
                                        className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                        title="ลงทะเบียนใหม่"
                                    >
                                        <span className="material-icons-round text-lg">refresh</span>
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => handleRegister(emp)}
                                    className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold flex items-center gap-1 shadow-md shadow-primary/20 active:scale-95 transition-all"
                                >
                                    <span className="material-icons-round text-sm">camera_alt</span>
                                    ลงทะเบียน
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Face Capture Modal */}
            {showCamera && selectedEmployee && (
                <FaceCapture
                    mode="register"
                    onCapture={handleCapture}
                    onClose={() => { setShowCamera(false); setSelectedEmployee(null); }}
                    employeeName={selectedEmployee.name}
                />
            )}
        </div>
    );
};

export default AdminFaceRegistrationScreen;
