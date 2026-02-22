import React, { useState, useEffect, useRef } from 'react';
import { resolveGoogleMapsLink, API_BASE } from '../services/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface LocationData {
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
    link: string;
}

interface LocationPickerModalProps {
    onSelect: (data: LocationData) => void;
    onClose: () => void;
    initialName?: string;
}

const LocationPickerModal: React.FC<LocationPickerModalProps> = ({ onSelect, onClose, initialName = '' }) => {
    const [locationName, setLocationName] = useState(initialName);
    const [address, setAddress] = useState('');
    const [reverseLoading, setReverseLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [gmapsLink, setGmapsLink] = useState('');
    const [resolving, setResolving] = useState(false);
    const [lat, setLat] = useState<number | null>(null);
    const [lng, setLng] = useState<number | null>(null);
    const [hasPin, setHasPin] = useState(false);

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);

    // Reverse geocode: lat/lng → address
    const reverseGeocode = async (rLat: number, rLng: number) => {
        setReverseLoading(true);
        try {
            const res = await fetch(`${API_BASE}/geocode.php?lat=${rLat}&lon=${rLng}&reverse=1`);
            const data = await res.json();
            if (data && data.display_name) {
                setAddress(data.display_name);
                // Extract short name if no location name set yet
                if (!locationName) {
                    const parts = (data.display_name || '').split(',');
                    setLocationName(parts[0]?.trim() || '');
                }
            }
        } catch { }
        setReverseLoading(false);
    };

    const updateMarker = (newLat: number, newLng: number, doReverse = true) => {
        const map = mapRef.current;
        if (!map) return;
        setLat(newLat);
        setLng(newLng);
        setHasPin(true);

        if (markerRef.current) {
            markerRef.current.setLatLng([newLat, newLng]);
        } else {
            markerRef.current = L.marker([newLat, newLng], {
                draggable: true,
                icon: L.divIcon({
                    className: 'custom-map-marker',
                    html: '<div style="width:32px;height:32px;background:#137fec;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                }),
            }).addTo(map);
            markerRef.current.on('dragend', () => {
                const pos = markerRef.current!.getLatLng();
                setLat(pos.lat);
                setLng(pos.lng);
                reverseGeocode(pos.lat, pos.lng);
            });
        }
        map.setView([newLat, newLng], map.getZoom());
        if (doReverse) reverseGeocode(newLat, newLng);
    };

    // Init map
    useEffect(() => {
        if (!mapContainerRef.current) return;
        const timer = setTimeout(() => {
            if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
            const defaultLat = 13.7563, defaultLng = 100.5018;
            const map = L.map(mapContainerRef.current!, { center: [defaultLat, defaultLng], zoom: 14, zoomControl: false });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
            L.control.zoom({ position: 'bottomright' }).addTo(map);
            map.on('click', (e: L.LeafletMouseEvent) => {
                updateMarker(e.latlng.lat, e.latlng.lng);
            });
            mapRef.current = map;
        }, 100);
        return () => { clearTimeout(timer); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; } };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Search via Nominatim
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        setSearchResults([]);
        try {
            const res = await fetch(`${API_BASE}/geocode.php?q=${encodeURIComponent(searchQuery.trim())}&limit=5&countrycodes=th`);
            const data = await res.json();
            if (data.length > 0) setSearchResults(data);
        } catch { }
        setSearching(false);
    };

    const selectPlace = (place: any) => {
        const pLat = parseFloat(place.lat);
        const pLng = parseFloat(place.lon);
        updateMarker(pLat, pLng, false); // Don't reverse geocode — we already have address
        setLocationName(place.display_name?.split(',')[0] || searchQuery);
        setAddress(place.display_name || '');
        setSearchResults([]);
        setSearchQuery('');
    };

    // GPS
    const useGPS = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => { updateMarker(pos.coords.latitude, pos.coords.longitude); },
            () => { },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // Resolve Google Maps link
    const handleResolve = async () => {
        if (!gmapsLink.trim()) return;
        setResolving(true);
        try {
            const result = await resolveGoogleMapsLink(gmapsLink.trim());
            if (result.latitude && result.longitude) {
                updateMarker(result.latitude, result.longitude);
            } else if ((result as any).needs_geocoding && (result as any).address) {
                const addr = (result as any).address as string;
                const parts = addr.split(/\s+/).filter((p: string) => p.length > 1);
                const queries = [addr, parts.slice(-4).join(' '), parts.slice(-3).join(' '), parts.slice(-2).join(' ')].filter(Boolean);
                for (const q of queries) {
                    const res = await fetch(`${API_BASE}/geocode.php?q=${encodeURIComponent(q)}&limit=1&countrycodes=th`);
                    const data = await res.json();
                    if (data.length > 0) {
                        updateMarker(parseFloat(data[0].lat), parseFloat(data[0].lon));
                        break;
                    }
                }
            }
            // Store the Google Maps link
            setGmapsLink('');
        } catch { }
        setResolving(false);
    };

    const openGMaps = () => {
        const q = searchQuery.trim() || locationName.trim() || 'ประเทศไทย';
        window.open(`https://www.google.com/maps/search/${encodeURIComponent(q)}`, '_blank');
    };

    const handleConfirm = () => {
        const name = locationName.trim() || searchQuery.trim() || (lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : '');
        // Build Google Maps link from coordinates if we have them
        let link = gmapsLink.trim();
        if (!link && lat && lng) {
            link = `https://www.google.com/maps?q=${lat},${lng}`;
        }
        onSelect({
            name,
            address: address.trim(),
            lat,
            lng,
            link,
        });
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-icons-round text-primary">location_on</span>
                        เลือกสถานที่
                    </h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-full">
                        <span className="material-icons-round">close</span>
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto">
                    {/* Map */}
                    <div className="relative">
                        <div ref={mapContainerRef} className="w-full h-52 sm:h-60 bg-gray-100 dark:bg-gray-900" />

                        {/* Search overlay on map */}
                        <div className="absolute top-3 left-3 right-3 z-[1000] flex gap-2">
                            <div className="flex-1 relative">
                                <div className="flex bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        placeholder="ค้นหาสถานที่..."
                                        className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none min-w-0"
                                    />
                                    <button onClick={handleSearch} disabled={searching || !searchQuery.trim()}
                                        className="px-3 text-primary hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40">
                                        <span className="material-icons-round text-lg">{searching ? 'autorenew' : 'search'}</span>
                                    </button>
                                </div>
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-600 overflow-hidden max-h-48 overflow-y-auto">
                                        {searchResults.map((place: any, idx: number) => (
                                            <button key={idx} onClick={() => selectPlace(place)}
                                                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-gray-700 text-sm border-b border-gray-100 dark:border-gray-700 last:border-0 flex items-start gap-2">
                                                <span className="material-icons-round text-red-400 text-base mt-0.5 shrink-0">place</span>
                                                <span className="text-gray-700 dark:text-gray-300 line-clamp-2">{place.display_name}</span>
                                            </button>
                                        ))}
                                        <button onClick={openGMaps}
                                            className="w-full text-left px-3 py-2.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-sm flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
                                            <span className="material-icons-round text-base">open_in_new</span>
                                            หาไม่เจอ? เปิด Google Maps
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                                <button onClick={openGMaps} className="bg-white dark:bg-gray-800 shadow-lg rounded-xl px-2.5 py-2 text-emerald-600 hover:bg-emerald-50 border border-gray-200 dark:border-gray-600" title="เปิด Google Maps">
                                    <span className="material-icons-round text-lg">map</span>
                                </button>
                                <button onClick={useGPS} className="bg-white dark:bg-gray-800 shadow-lg rounded-xl px-2.5 py-2 text-primary hover:bg-blue-50 border border-gray-200 dark:border-gray-600" title="ตำแหน่งปัจจุบัน">
                                    <span className="material-icons-round text-lg">my_location</span>
                                </button>
                            </div>
                        </div>

                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[1000]">
                            <div className="bg-black/50 backdrop-blur text-white text-[10px] px-2.5 py-1 rounded-full">
                                📍 แตะหรือลากหมุด
                            </div>
                        </div>
                    </div>

                    {/* Address extracted from pin — auto-populated */}
                    {hasPin && (
                        <div className="px-4 pt-3">
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                                <div className="flex items-start gap-2">
                                    <span className="material-icons-round text-blue-500 text-lg mt-0.5 shrink-0">pin_drop</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-0.5">ที่อยู่จากพิกัด</p>
                                        {reverseLoading ? (
                                            <div className="flex items-center gap-2 text-xs text-blue-500">
                                                <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                                กำลังดึงที่อยู่...
                                            </div>
                                        ) : (
                                            <p className="text-xs text-blue-600 dark:text-blue-400 break-words">{address || 'ไม่พบข้อมูลที่อยู่'}</p>
                                        )}
                                        {lat && lng && (
                                            <p className="text-[10px] text-blue-400 dark:text-blue-500 mt-1 font-mono">
                                                {lat.toFixed(6)}, {lng.toFixed(6)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Google Maps Link */}
                    <div className="px-4 pt-3">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                            <span className="material-icons-round text-sm align-middle mr-1">link</span>
                            วาง Google Maps Link
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={gmapsLink}
                                onChange={(e) => setGmapsLink(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleResolve()}
                                placeholder="https://maps.app.goo.gl/... หรือ Google Maps URL"
                                className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            <button onClick={handleResolve} disabled={resolving || !gmapsLink.trim()}
                                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-1.5 shadow-sm whitespace-nowrap">
                                {resolving ? (
                                    <span className="material-icons-round animate-spin text-base">autorenew</span>
                                ) : (
                                    <span className="material-icons-round text-base">travel_explore</span>
                                )}
                                ดึงพิกัด
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">หาไม่เจอ? กดปุ่ม 🗺️ บนแผนที่เพื่อเปิด Google Maps → แชร์ลิงก์ → วางลิงก์ที่นี่</p>
                    </div>

                    {/* Location name */}
                    <div className="px-4 pt-3 pb-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                            ชื่อสถานที่
                        </label>
                        <input
                            type="text"
                            value={locationName}
                            onChange={(e) => setLocationName(e.target.value)}
                            placeholder="เช่น สวนลูกค้า คุณสมชาย / สำนักงานใหญ่"
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>

                {/* Footer buttons */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-3 shrink-0">
                    <button onClick={onClose}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        ยกเลิก
                    </button>
                    <button onClick={handleConfirm}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-blue-600 transition-colors shadow-sm flex items-center justify-center gap-1.5">
                        <span className="material-icons-round text-base">check</span>
                        เลือกสถานที่นี้
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LocationPickerModal;
