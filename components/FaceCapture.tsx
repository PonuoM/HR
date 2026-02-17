import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';

interface FaceCaptureProps {
    mode: 'register' | 'verify';
    referenceDescriptor?: number[] | null; // For verify mode
    onCapture: (descriptor: number[]) => void;
    onMatch?: (distance: number, matched: boolean) => void;
    onClose: () => void;
    employeeName?: string;
    // Verify-mode clock-in integration
    onClockIn?: (coords: { latitude: number; longitude: number }, locationName: string) => Promise<void>;
    checkLocationFn?: (lat: number, lng: number) => Promise<{ matched: boolean; location_name: string; distance: number }>;
}

const MATCH_THRESHOLD = 0.6;

// ───── Registration steps ─────
type RegStep = 'center' | 'left' | 'right';
const REG_STEPS: { key: RegStep; label: string; icon: string; instruction: string }[] = [
    { key: 'center', label: 'หน้าตรง', icon: 'person', instruction: 'มองตรงไปที่กล้อง' },
    { key: 'left', label: 'หันซ้าย', icon: 'undo', instruction: 'ค่อยๆ หันหน้าไปทางซ้าย' },
    { key: 'right', label: 'redo', icon: 'redo', instruction: 'ค่อยๆ หันหน้าไปทางขวา' },
];

// ───── Head pose detection using landmarks ─────
function detectHeadPose(landmarks: faceapi.FaceLandmarks68, box: faceapi.Box): 'center' | 'left' | 'right' | null {
    // nose tip = landmark 30, face bounding box
    const noseTip = landmarks.positions[30];
    const faceCenterX = box.x + box.width / 2;
    const relativeNose = (noseTip.x - box.x) / box.width; // 0..1, 0.5 = center

    if (relativeNose >= 0.42 && relativeNose <= 0.58) return 'center';
    // Camera is mirrored (scaleX -1), so directions are swapped:
    // nose < 0.43 in raw frame = user turned RIGHT (from their perspective)
    // nose > 0.57 in raw frame = user turned LEFT
    if (relativeNose < 0.43) return 'right';
    if (relativeNose > 0.57) return 'left';
    return null;
}

// ───── Average multiple descriptors ─────
function averageDescriptors(descriptors: number[][]): number[] {
    const len = descriptors[0].length;
    const avg = new Array(len).fill(0);
    for (const d of descriptors) {
        for (let i = 0; i < len; i++) avg[i] += d[i];
    }
    return avg.map(v => v / descriptors.length);
}

const FaceCapture: React.FC<FaceCaptureProps> = ({
    mode, referenceDescriptor, onCapture, onMatch, onClose, employeeName,
    onClockIn, checkLocationFn,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number>(0);

    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [status, setStatus] = useState<'loading' | 'ready' | 'detecting' | 'captured' | 'error'>('loading');
    const [message, setMessage] = useState('กำลังโหลดโมเดล AI...');

    // ── Register state ──
    const [regStepIdx, setRegStepIdx] = useState(0);
    const [capturedDescriptors, setCapturedDescriptors] = useState<number[][]>([]);
    const regConsecutiveRef = useRef(0);
    const REG_CONSECUTIVE_THRESHOLD = 5;

    // ── Verify state ──
    const [matchResult, setMatchResult] = useState<{ distance: number; matched: boolean } | null>(null);
    const verifyConsecutiveRef = useRef(0);
    const verifyTriggerRef = useRef(false);
    const VERIFY_CONSECUTIVE_THRESHOLD = 5;

    // ── Clock-in state (verify mode) ──
    const [clockInState, setClockInState] = useState<'idle' | 'gps' | 'ready' | 'clocking' | 'done' | 'error'>('idle');
    const [locationInfo, setLocationInfo] = useState<{ name: string; matched: boolean; distance: number } | null>(null);
    const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);

    // ━━━ Load face-api models ━━━
    useEffect(() => {
        const loadModels = async () => {
            try {
                const MODEL_URL = '/models';
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                setModelsLoaded(true);
                setStatus('ready');
                setMessage('กำลังเปิดกล้อง...');
            } catch (err) {
                console.error('Failed to load face models:', err);
                setStatus('error');
                setMessage('ไม่สามารถโหลดโมเดลได้ กรุณาลองใหม่');
            }
        };
        loadModels();
    }, []);

    // ━━━ Start camera ━━━
    useEffect(() => {
        if (!modelsLoaded) return;
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                    setStatus('detecting');
                    setMessage(mode === 'register' ? REG_STEPS[0].instruction : 'กรุณาหันหน้าตรงกับกล้อง');
                }
            } catch (err) {
                console.error('Camera error:', err);
                setStatus('error');
                setMessage('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง');
            }
        };
        startCamera();
        return () => {
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [modelsLoaded]);

    // ━━━ GPS helper ━━━
    const requestGPS = useCallback(async () => {
        setClockInState('gps');
        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, (err) => {
                    if (err.code === 2 || err.code === 3) {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10000 });
                    } else { reject(err); }
                }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
            });
            const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setGpsCoords(coords);

            if (checkLocationFn) {
                const locResult = await checkLocationFn(coords.latitude, coords.longitude);
                setLocationInfo({ name: locResult.location_name, matched: locResult.matched, distance: locResult.distance });
            }
            setClockInState('ready');
        } catch (err) {
            console.error('GPS error:', err);
            setClockInState('error');
            setMessage('ไม่สามารถดึงตำแหน่งได้ กรุณาเปิด GPS');
        }
    }, [checkLocationFn]);

    // ━━━ Handle clock-in button press ━━━
    const handleClockInPress = useCallback(async () => {
        if (!gpsCoords || !onClockIn) return;
        setClockInState('clocking');
        try {
            await onClockIn(gpsCoords, locationInfo?.name || 'ไม่ระบุ');
            setClockInState('done');
        } catch (err: any) {
            setClockInState('error');
            setMessage(err.message || 'บันทึกไม่สำเร็จ');
        }
    }, [gpsCoords, onClockIn, locationInfo]);

    // ━━━ Handle register step auto-capture ━━━
    const handleRegAutoCapture = useCallback(async () => {
        if (!videoRef.current) return;
        const detection = await faceapi
            .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
        if (!detection) return;

        const desc = Array.from(detection.descriptor);
        const newDescriptors = [...capturedDescriptors, desc];
        setCapturedDescriptors(newDescriptors);

        if (regStepIdx < REG_STEPS.length - 1) {
            // Move to next step
            const nextIdx = regStepIdx + 1;
            setRegStepIdx(nextIdx);
            regConsecutiveRef.current = 0;
            setMessage(REG_STEPS[nextIdx].instruction);
        } else {
            // All steps done → auto-save
            setStatus('captured');
            setMessage('✅ ลงทะเบียนใบหน้าเรียบร้อย!');
            const avg = averageDescriptors(newDescriptors);
            // Stop camera
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            setTimeout(() => onCapture(avg), 1200);
        }
    }, [capturedDescriptors, regStepIdx, onCapture]);

    // ━━━ Handle verify auto-capture ━━━
    const handleVerifyAutoCapture = useCallback(async () => {
        if (!videoRef.current || !referenceDescriptor) return;
        const detection = await faceapi
            .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
        if (!detection) return;

        const refDesc = new Float32Array(referenceDescriptor);
        const distance = faceapi.euclideanDistance(detection.descriptor, refDesc);
        const matched = distance < MATCH_THRESHOLD;
        setMatchResult({ distance, matched });
        onMatch?.(distance, matched);

        if (matched) {
            setStatus('captured');
            setMessage(`✅ ยืนยันตัวตนสำเร็จ (${Math.round((1 - distance) * 100)}%)`);
            // Start GPS request immediately
            if (onClockIn && checkLocationFn) {
                requestGPS();
            } else {
                // No clock-in integration → just return descriptor
                const desc = Array.from(detection.descriptor);
                setTimeout(() => onCapture(desc), 1500);
            }
        } else {
            verifyTriggerRef.current = false;
            verifyConsecutiveRef.current = 0;
            setMessage(`❌ ใบหน้าไม่ตรงกัน (${Math.round((1 - distance) * 100)}%) — ลองใหม่`);
        }
    }, [referenceDescriptor, onCapture, onMatch, onClockIn, checkLocationFn, requestGPS]);

    // ━━━ Main detection loop ━━━
    useEffect(() => {
        if (status !== 'detecting' || !videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        regConsecutiveRef.current = 0;
        verifyConsecutiveRef.current = 0;
        verifyTriggerRef.current = false;

        const detect = async () => {
            if (video.paused || video.ended) return;

            const detection = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (detection) {
                    const { x, y, width, height } = detection.detection.box;
                    const pose = detectHeadPose(detection.landmarks, detection.detection.box);

                    if (mode === 'register') {
                        const currentStep = REG_STEPS[regStepIdx];
                        const isCorrectPose = pose === currentStep.key;

                        // Draw face box with color based on pose match
                        const color = isCorrectPose ? '#22c55e' : '#f59e0b';
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 3;
                        ctx.strokeRect(x, y, width, height);

                        // Draw corner brackets
                        drawCorners(ctx, x, y, width, height, color, 20);

                        if (isCorrectPose) {
                            regConsecutiveRef.current++;
                            const remaining = REG_CONSECUTIVE_THRESHOLD - regConsecutiveRef.current;
                            if (remaining > 0) {
                                setMessage(`${currentStep.instruction} — ค้างไว้...`);
                            }
                            if (regConsecutiveRef.current >= REG_CONSECUTIVE_THRESHOLD) {
                                regConsecutiveRef.current = 0;
                                handleRegAutoCapture();
                                return;
                            }
                        } else {
                            regConsecutiveRef.current = 0;
                            setMessage(currentStep.instruction);
                        }
                    } else {
                        // Verify mode
                        ctx.strokeStyle = '#3b82f6';
                        ctx.lineWidth = 3;
                        ctx.strokeRect(x, y, width, height);
                        drawCorners(ctx, x, y, width, height, '#3b82f6', 20);

                        if (!verifyTriggerRef.current) {
                            verifyConsecutiveRef.current++;
                            const remaining = VERIFY_CONSECUTIVE_THRESHOLD - verifyConsecutiveRef.current;
                            if (remaining > 0) {
                                setMessage(`กำลังตรวจสอบใบหน้า...`);
                            }
                            if (verifyConsecutiveRef.current >= VERIFY_CONSECUTIVE_THRESHOLD) {
                                verifyTriggerRef.current = true;
                                setMessage('กำลังยืนยันตัวตน...');
                                handleVerifyAutoCapture();
                                return;
                            }
                        }
                    }
                } else {
                    regConsecutiveRef.current = 0;
                    verifyConsecutiveRef.current = 0;
                    if (mode === 'register') {
                        setMessage(REG_STEPS[regStepIdx].instruction);
                    } else {
                        setMessage('กรุณาหันหน้าตรงกับกล้อง');
                    }
                }
            }

            animFrameRef.current = requestAnimationFrame(detect);
        };

        detect();
        return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
    }, [status, regStepIdx, mode]);

    // Cleanup camera on unmount
    useEffect(() => {
        return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
    }, []);

    // ═══════════════════════════════════════════
    // ──────────── RENDER ────────────
    // ═══════════════════════════════════════════
    const currentRegStep = mode === 'register' ? REG_STEPS[regStepIdx] : null;
    const isVerifySuccess = mode === 'verify' && status === 'captured' && matchResult?.matched;

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm z-10 safe-top">
                <div className="flex items-center gap-2 text-white">
                    <span className="material-icons-round text-xl">
                        {mode === 'register' ? 'app_registration' : 'verified_user'}
                    </span>
                    <h3 className="font-bold text-base">
                        {mode === 'register' ? 'ลงทะเบียนใบหน้า' : 'ยืนยันตัวตน'}
                    </h3>
                </div>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                    <span className="material-icons-round text-white text-xl">close</span>
                </button>
            </div>

            {/* ── Step indicator (register only) ── */}
            {mode === 'register' && (
                <div className="flex items-center justify-center gap-3 py-3 bg-black/60 backdrop-blur">
                    {REG_STEPS.map((step, i) => (
                        <div key={step.key} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${i < regStepIdx ? 'bg-green-500 text-white scale-90' :
                                i === regStepIdx ? 'bg-white text-black scale-110 ring-2 ring-white/50' :
                                    'bg-white/20 text-white/50'
                                }`}>
                                {i < regStepIdx ? (
                                    <span className="material-icons-round text-sm">check</span>
                                ) : (
                                    i + 1
                                )}
                            </div>
                            {i < REG_STEPS.length - 1 && (
                                <div className={`w-8 h-0.5 rounded transition-colors ${i < regStepIdx ? 'bg-green-500' : 'bg-white/20'}`} />
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Camera View ── */}
            <div className="flex-1 relative overflow-hidden">
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay playsInline muted
                    style={{ transform: 'scaleX(-1)' }}
                />
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                    style={{ transform: 'scaleX(-1)' }}
                />

                {/* Oval guide + large instruction overlay */}
                {status === 'detecting' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-56 h-72 rounded-[50%] border-2 border-dashed border-white/25" />

                        {/* ── Large instruction banner on camera ── */}
                        {mode === 'register' && currentRegStep && (
                            <>
                                {/* Top instruction */}
                                <div className="absolute top-6 left-0 right-0 flex justify-center">
                                    <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-6 py-3 mx-4">
                                        <p className="text-white text-xl font-bold text-center">
                                            {currentRegStep.key === 'center' && '👤 มองตรงไปที่กล้อง'}
                                            {currentRegStep.key === 'left' && '👈 หันหน้าไปทางซ้าย'}
                                            {currentRegStep.key === 'right' && '👉 หันหน้าไปทางขวา'}
                                        </p>
                                        <p className="text-white/60 text-sm text-center mt-1">
                                            ขั้นตอน {regStepIdx + 1} / {REG_STEPS.length}
                                        </p>
                                    </div>
                                </div>

                                {/* Side arrows for left/right */}
                                {currentRegStep.key === 'left' && (
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 animate-side-bounce-left">
                                        <div className="bg-white/20 backdrop-blur rounded-full p-3">
                                            <span className="material-icons-round text-white text-6xl">arrow_back</span>
                                        </div>
                                    </div>
                                )}
                                {currentRegStep.key === 'right' && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-side-bounce-right">
                                        <div className="bg-white/20 backdrop-blur rounded-full p-3">
                                            <span className="material-icons-round text-white text-6xl">arrow_forward</span>
                                        </div>
                                    </div>
                                )}
                                {currentRegStep.key === 'center' && (
                                    <div className="absolute bottom-12 left-0 right-0 flex justify-center animate-bounce">
                                        <div className="bg-white/20 backdrop-blur rounded-full p-3">
                                            <span className="material-icons-round text-white text-5xl">person</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Loading overlay */}
                {status === 'loading' && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <div className="text-center text-white">
                            <span className="material-icons-round text-5xl animate-spin mb-3 block">autorenew</span>
                            <p className="text-sm font-medium">{message}</p>
                        </div>
                    </div>
                )}

                {/* ──── Success overlay (Register) ──── */}
                {mode === 'register' && status === 'captured' && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <div className="text-center animate-scale-in">
                            <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-green-500/40">
                                <span className="material-icons-round text-white text-5xl">check</span>
                            </div>
                            <p className="text-white text-lg font-bold">ลงทะเบียนสำเร็จ!</p>
                            <p className="text-white/60 text-sm mt-1">บันทึกข้อมูลใบหน้า {capturedDescriptors.length + 1} มุมแล้ว</p>
                        </div>
                    </div>
                )}

                {/* ──── Success overlay (Verify) with clock-in ──── */}
                {isVerifySuccess && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                        <div className="text-center w-full max-w-xs px-6 animate-scale-in">
                            {/* Checkmark */}
                            <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-3 shadow-xl shadow-green-500/40 animate-pulse-once">
                                <span className="material-icons-round text-white text-4xl">check</span>
                            </div>
                            <p className="text-white text-lg font-bold mb-1">ยืนยันตัวตนสำเร็จ</p>
                            {employeeName && (
                                <p className="text-white/60 text-sm mb-5">{employeeName}</p>
                            )}

                            {/* Clock-in section */}
                            {onClockIn && (
                                <div className="space-y-3">
                                    {clockInState === 'gps' && (
                                        <div className="flex items-center justify-center gap-2 text-blue-400 text-sm py-3">
                                            <span className="material-icons-round text-lg animate-spin">my_location</span>
                                            กำลังหาตำแหน่ง GPS...
                                        </div>
                                    )}

                                    {clockInState === 'ready' && locationInfo && (
                                        <>
                                            {/* Location badge */}
                                            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${locationInfo.matched
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                                }`}>
                                                <span className="material-icons-round text-lg">
                                                    {locationInfo.matched ? 'location_on' : 'wrong_location'}
                                                </span>
                                                <span className="truncate flex-1 text-left">{locationInfo.name}</span>
                                                {!locationInfo.matched && (
                                                    <span className="text-xs opacity-70 shrink-0">({Math.round(locationInfo.distance)}m)</span>
                                                )}
                                            </div>

                                            {/* Clock-in button */}
                                            <button
                                                onClick={handleClockInPress}
                                                className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/40 active:scale-[0.97] transition-all flex items-center justify-center gap-2 text-base"
                                            >
                                                <span className="material-icons-round text-xl">fingerprint</span>
                                                บันทึกลงเวลาเข้า
                                            </button>
                                        </>
                                    )}

                                    {clockInState === 'clocking' && (
                                        <div className="flex items-center justify-center gap-2 text-white py-4">
                                            <span className="material-icons-round animate-spin">autorenew</span>
                                            กำลังบันทึก...
                                        </div>
                                    )}

                                    {clockInState === 'done' && (
                                        <div className="text-center py-3">
                                            <p className="text-green-400 text-base font-bold">✅ บันทึกลงเวลาเรียบร้อย!</p>
                                        </div>
                                    )}

                                    {clockInState === 'error' && (
                                        <div className="space-y-2">
                                            <p className="text-red-400 text-sm">{message}</p>
                                            <button onClick={requestGPS}
                                                className="w-full py-3 rounded-xl border border-white/20 text-white font-medium text-sm hover:bg-white/10 transition-colors">
                                                ลองดึง GPS ใหม่
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Close / Cancel */}
                            {(clockInState === 'done' || !onClockIn) && (
                                <button onClick={onClose}
                                    className="mt-4 w-full py-3 rounded-xl border border-white/20 text-white/70 font-medium text-sm hover:bg-white/10 transition-colors">
                                    ปิด
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ──── Verify fail overlay ──── */}
                {mode === 'verify' && status === 'captured' && matchResult && !matchResult.matched && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <div className="text-center animate-scale-in">
                            <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-4">
                                <span className="material-icons-round text-white text-4xl">close</span>
                            </div>
                            <p className="text-white text-lg font-bold">ใบหน้าไม่ตรงกัน</p>
                            <p className="text-red-400 text-sm mt-1">ความคล้าย {Math.round((1 - matchResult.distance) * 100)}%</p>
                        </div>
                    </div>
                )}

                {/* Error overlay */}
                {status === 'error' && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <div className="text-center text-white px-8">
                            <span className="material-icons-round text-5xl text-red-400 mb-3 block">error_outline</span>
                            <p className="text-sm">{message}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Bottom bar ── */}
            <div className="bg-black/80 backdrop-blur-sm px-4 py-4 safe-bottom">
                {/* Status message */}
                {status === 'detecting' && (
                    <div className="text-center mb-3">
                        <p className="text-white text-base font-bold">{message}</p>
                        {mode === 'verify' && employeeName && (
                            <p className="text-white/40 text-xs mt-1">กำลังยืนยัน: {employeeName}</p>
                        )}
                    </div>
                )}

                {/* Progress dots (register) */}
                {mode === 'register' && status === 'detecting' && (
                    <div className="flex justify-center gap-1.5 mb-3">
                        {REG_STEPS.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i < regStepIdx ? 'w-8 bg-green-500' :
                                i === regStepIdx ? 'w-8 bg-white' :
                                    'w-4 bg-white/20'
                                }`} />
                        ))}
                    </div>
                )}

                {/* Cancel button */}
                <button
                    onClick={onClose}
                    className="w-full py-3.5 rounded-xl border border-white/20 text-white/70 font-semibold text-sm hover:bg-white/10 transition-colors"
                >
                    ยกเลิก
                </button>
            </div>

            {/* Animation keyframes */}
            <style>{`
                @keyframes scale-in {
                    from { opacity: 0; transform: scale(0.7); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-scale-in {
                    animation: scale-in 0.4s ease-out;
                }
                @keyframes pulse-once {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
                .animate-pulse-once {
                    animation: pulse-once 0.6s ease-in-out;
                }
                @keyframes side-bounce-left {
                    0%, 100% { transform: translateY(-50%) translateX(0); }
                    50% { transform: translateY(-50%) translateX(-12px); }
                }
                @keyframes side-bounce-right {
                    0%, 100% { transform: translateY(-50%) translateX(0); }
                    50% { transform: translateY(-50%) translateX(12px); }
                }
                .animate-side-bounce-left {
                    animation: side-bounce-left 1s ease-in-out infinite;
                }
                .animate-side-bounce-right {
                    animation: side-bounce-right 1s ease-in-out infinite;
                }
                .safe-top { padding-top: max(12px, env(safe-area-inset-top)); }
                .safe-bottom { padding-bottom: max(16px, env(safe-area-inset-bottom)); }
            `}</style>
        </div>
    );
};

// ───── Draw corner brackets ─────
function drawCorners(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, len: number) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    // Top-left
    ctx.beginPath(); ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len); ctx.stroke();
}

export default FaceCapture;
