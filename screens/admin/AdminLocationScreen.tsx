import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getWorkLocations, createWorkLocation, updateWorkLocation, deleteWorkLocation } from '../../services/api';
import { useToast } from '../../components/Toast';

interface WorkLocation {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    is_active: boolean;
}

const AdminLocationScreen: React.FC = () => {
    const navigate = useNavigate();
    const { toast, confirm: showConfirm } = useToast();
    const { data: locations, refetch } = useApi(() => getWorkLocations(), []);

    const [showModal, setShowModal] = useState(false);
    const [editingLoc, setEditingLoc] = useState<WorkLocation | null>(null);
    const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radius_meters: '200', is_active: true });
    const [saving, setSaving] = useState(false);

    const openCreate = () => {
        setEditingLoc(null);
        setForm({ name: '', latitude: '', longitude: '', radius_meters: '200', is_active: true });
        setShowModal(true);
    };

    const openEdit = (loc: WorkLocation) => {
        setEditingLoc(loc);
        setForm({
            name: loc.name,
            latitude: String(loc.latitude),
            longitude: String(loc.longitude),
            radius_meters: String(loc.radius_meters),
            is_active: loc.is_active,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.latitude || !form.longitude) return;
        setSaving(true);
        try {
            const payload = {
                name: form.name,
                latitude: parseFloat(form.latitude),
                longitude: parseFloat(form.longitude),
                radius_meters: parseInt(form.radius_meters) || 200,
                is_active: form.is_active ? 1 : 0,
            };
            if (editingLoc) {
                await updateWorkLocation(editingLoc.id, payload);
            } else {
                await createWorkLocation(payload);
            }
            setShowModal(false);
            refetch();
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!(await showConfirm({ message: 'ต้องการลบสถานที่นี้?', type: 'danger', confirmText: 'ลบ' }))) return;
        await deleteWorkLocation(id);
        toast('ลบสถานที่เรียบร้อย', 'success');
        refetch();
    };

    return (
        <div className="pt-6 md:pt-8 pb-24 md:pb-8 px-4 md:px-8 max-w-5xl mx-auto min-h-full font-display">
            {/* Header */}
            <header className="mb-8">
                <button onClick={() => navigate('/admin/dashboard')} className="text-slate-500 hover:text-primary transition-colors mb-4 flex items-center gap-1 text-sm">
                    <span className="material-icons-round text-lg">arrow_back</span>
                    <span>กลับหน้า Admin</span>
                </button>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ตั้งค่าพื้นที่ทำงาน</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">จัดการสถานที่ที่อนุญาตให้ลงเวลา</p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="bg-primary hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-[0.97]"
                    >
                        <span className="material-icons-round text-lg">add_location_alt</span>
                        เพิ่มสถานที่
                    </button>
                </div>
            </header>

            {/* Location Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(locations || []).map((loc: any) => (
                    <div
                        key={loc.id}
                        className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group hover:shadow-md transition-shadow"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none"></div>

                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${loc.is_active ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                    <span className={`material-icons-round text-lg ${loc.is_active ? 'text-green-600' : 'text-gray-400'}`}>location_on</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">{loc.name}</h3>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mt-0.5 ${loc.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                                        {loc.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(loc)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-primary transition-colors">
                                    <span className="material-icons-round text-base">edit</span>
                                </button>
                                <button onClick={() => handleDelete(loc.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors">
                                    <span className="material-icons-round text-base">delete</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mt-4">
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Latitude</p>
                                <p className="text-xs font-mono font-medium text-gray-700 dark:text-gray-300 mt-0.5">{Number(loc.latitude).toFixed(5)}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Longitude</p>
                                <p className="text-xs font-mono font-medium text-gray-700 dark:text-gray-300 mt-0.5">{Number(loc.longitude).toFixed(5)}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">รัศมี</p>
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-0.5">{loc.radius_meters}m</p>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Empty state */}
                {(!locations || locations.length === 0) && (
                    <div className="col-span-full py-16 text-center">
                        <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-600 mb-3 block">wrong_location</span>
                        <p className="text-gray-400 dark:text-gray-500">ยังไม่มีสถานที่ทำงาน</p>
                        <button onClick={openCreate} className="mt-3 text-primary font-semibold text-sm hover:text-blue-700">+ เพิ่มสถานที่แรก</button>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editingLoc ? 'แก้ไขสถานที่' : 'เพิ่มสถานที่ใหม่'}
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">ชื่อสถานที่</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="เช่น สำนักงานใหญ่ กรุงเทพฯ"
                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Latitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={form.latitude}
                                        onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                                        placeholder="13.7563"
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Longitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={form.longitude}
                                        onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                                        placeholder="100.5018"
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">รัศมี (เมตร)</label>
                                <input
                                    type="number"
                                    value={form.radius_meters}
                                    onChange={(e) => setForm({ ...form, radius_meters: e.target.value })}
                                    placeholder="200"
                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setForm({ ...form, is_active: !form.is_active })}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                >
                                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'left-[22px]' : 'left-0.5'}`}></span>
                                </button>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{form.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}</span>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex gap-3">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !form.name || !form.latitude || !form.longitude}
                                className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-blue-600 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                            >
                                {saving ? 'กำลังบันทึก...' : editingLoc ? 'อัปเดต' : 'เพิ่มสถานที่'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLocationScreen;
