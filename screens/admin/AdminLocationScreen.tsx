import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getWorkLocations, createWorkLocation, updateWorkLocation, deleteWorkLocation } from '../../services/api';
import { useToast } from '../../components/Toast';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

    // Map refs
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const circleRef = useRef<L.Circle | null>(null);

    // Update map marker + circle when form lat/lng/radius changes
    const updateMapMarker = (lat: number, lng: number, radius: number) => {
        const map = mapRef.current;
        if (!map) return;

        if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
        } else {
            markerRef.current = L.marker([lat, lng], {
                draggable: true,
                icon: L.divIcon({
                    className: 'custom-map-marker',
                    html: '<div style="width:32px;height:32px;background:#137fec;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                }),
            }).addTo(map);

            // Drag handler
            markerRef.current.on('dragend', () => {
                const pos = markerRef.current!.getLatLng();
                setForm(prev => ({
                    ...prev,
                    latitude: pos.lat.toFixed(7),
                    longitude: pos.lng.toFixed(7),
                }));
            });
        }

        if (circleRef.current) {
            circleRef.current.setLatLng([lat, lng]);
            circleRef.current.setRadius(radius);
        } else {
            circleRef.current = L.circle([lat, lng], {
                radius: radius,
                color: '#137fec',
                fillColor: '#137fec',
                fillOpacity: 0.15,
                weight: 2,
            }).addTo(map);
        }

        map.setView([lat, lng], map.getZoom());
    };

    // Initialize map when modal opens
    useEffect(() => {
        if (!showModal || !mapContainerRef.current) return;

        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
                circleRef.current = null;
            }

            const lat = parseFloat(form.latitude) || 13.7563;
            const lng = parseFloat(form.longitude) || 100.5018;
            const radius = parseInt(form.radius_meters) || 200;

            const map = L.map(mapContainerRef.current!, {
                center: [lat, lng],
                zoom: 16,
                zoomControl: false,
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 19,
            }).addTo(map);

            L.control.zoom({ position: 'bottomright' }).addTo(map);

            // Click to set location
            map.on('click', (e: L.LeafletMouseEvent) => {
                setForm(prev => ({
                    ...prev,
                    latitude: e.latlng.lat.toFixed(7),
                    longitude: e.latlng.lng.toFixed(7),
                }));
            });

            mapRef.current = map;

            // Place initial marker if we have coords
            if (form.latitude && form.longitude) {
                updateMapMarker(lat, lng, radius);
            }
        }, 100);

        return () => {
            clearTimeout(timer);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
                circleRef.current = null;
            }
        };
    }, [showModal]); // eslint-disable-line react-hooks/exhaustive-deps

    // Update marker when form lat/lng/radius changes (after map is initialized)
    useEffect(() => {
        if (!mapRef.current || !form.latitude || !form.longitude) return;
        const lat = parseFloat(form.latitude);
        const lng = parseFloat(form.longitude);
        const radius = parseInt(form.radius_meters) || 200;
        if (!isNaN(lat) && !isNaN(lng)) {
            updateMapMarker(lat, lng, radius);
        }
    }, [form.latitude, form.longitude, form.radius_meters]); // eslint-disable-line react-hooks/exhaustive-deps

    // Get user's current location for the map
    const useCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast('เบราว์เซอร์ไม่รองรับ GPS', 'error');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setForm(prev => ({
                    ...prev,
                    latitude: pos.coords.latitude.toFixed(7),
                    longitude: pos.coords.longitude.toFixed(7),
                }));
                if (mapRef.current) {
                    mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 17);
                }
            },
            () => toast('ไม่สามารถดึงตำแหน่งได้', 'error'),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

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
                toast('อัปเดตสถานที่เรียบร้อย', 'success');
            } else {
                await createWorkLocation(payload);
                toast('เพิ่มสถานที่เรียบร้อย', 'success');
            }
            setShowModal(false);
            refetch();
        } catch (err) {
            console.error(err);
            toast('เกิดข้อผิดพลาด', 'error');
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

                            <div className="flex gap-1">
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
                                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Lat</p>
                                <p className="text-xs font-mono font-medium text-gray-700 dark:text-gray-300 mt-0.5">{Number(loc.latitude).toFixed(5)}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Lng</p>
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

            {/* Modal with Map */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center" onClick={() => setShowModal(false)}>
                    <div
                        className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                        style={{ animation: 'locFormSlideUp 0.3s ease-out' }}
                    >
                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editingLoc ? 'แก้ไขสถานที่' : 'เพิ่มสถานที่ใหม่'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-full">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Map */}
                            <div className="relative">
                                <div ref={mapContainerRef} className="w-full h-56 sm:h-64 bg-gray-100 dark:bg-gray-900" />

                                {/* Use Current Location button */}
                                <button
                                    onClick={useCurrentLocation}
                                    className="absolute top-3 left-3 z-[1000] bg-white dark:bg-gray-800 shadow-lg rounded-xl px-3 py-2 flex items-center gap-2 text-sm font-medium text-primary hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
                                >
                                    <span className="material-icons-round text-lg">my_location</span>
                                    ตำแหน่งปัจจุบัน
                                </button>

                                {/* Map helper text */}
                                <div className="absolute bottom-3 left-3 right-3 z-[1000]">
                                    <div className="bg-black/60 backdrop-blur text-white text-xs px-3 py-1.5 rounded-lg text-center">
                                        📍 แตะบนแผนที่ หรือลากหมุดเพื่อเลือกตำแหน่ง
                                    </div>
                                </div>
                            </div>

                            {/* Form */}
                            <div className="p-5 space-y-4">
                                {/* Name */}
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

                                {/* Lat/Lng (readonly, set by map) */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Latitude</label>
                                        <input
                                            type="text"
                                            value={form.latitude}
                                            readOnly
                                            placeholder="เลือกจากแผนที่"
                                            className="w-full bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-mono text-gray-500 cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Longitude</label>
                                        <input
                                            type="text"
                                            value={form.longitude}
                                            readOnly
                                            placeholder="เลือกจากแผนที่"
                                            className="w-full bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-mono text-gray-500 cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                {/* Radius */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                                        รัศมี: <span className="text-primary font-bold">{form.radius_meters || 200} เมตร</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="50"
                                        max="1000"
                                        step="50"
                                        value={form.radius_meters || '200'}
                                        onChange={(e) => setForm({ ...form, radius_meters: e.target.value })}
                                        className="w-full accent-primary h-2 rounded-full"
                                    />
                                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                        <span>50m</span>
                                        <span>500m</span>
                                        <span>1000m</span>
                                    </div>
                                </div>

                                {/* Active toggle */}
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
                        </div>

                        {/* Actions — sticky at bottom */}
                        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 shrink-0">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !form.name || !form.latitude || !form.longitude}
                                className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-blue-600 disabled:opacity-50 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <span className="material-icons-round animate-spin text-lg">autorenew</span>
                                ) : (
                                    <>
                                        <span className="material-icons-round text-lg">save</span>
                                        {editingLoc ? 'อัปเดต' : 'เพิ่มสถานที่'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Animation */}
            <style>{`
                @keyframes locFormSlideUp {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default AdminLocationScreen;
