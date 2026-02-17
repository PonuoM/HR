import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';

interface FaceCaptureProps {
    mode: 'register' | 'verify';
    referenceDescriptor?: number[] | null; // For verify mode
    onCapture: (descriptor: number[]) => void;
    onMatch?: (distance: number, matched: boolean) => void;
    onClose: () => void;
    employeeName?: string;
}

const MATCH_THRESHOLD = 0.6; // Euclidean distance threshold

const FaceCapture: React.FC<FaceCaptureProps> = ({
    mode, referenceDescriptor, onCapture, onMatch, onClose, employeeName
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number>(0);

    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [status, setStatus] = useState<'loading' | 'ready' | 'detecting' | 'captured' | 'error'>('loading');
    const [message, setMessage] = useState('กำลังโหลดโมเดล AI...');
    const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null);
    const [matchResult, setMatchResult] = useState<{ distance: number; matched: boolean } | null>(null);

    // Load face-api models
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

    // Start camera when models are loaded
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
                    setMessage('กรุณาหันหน้าตรงกับกล้อง');
                }
            } catch (err) {
                console.error('Camera error:', err);
                setStatus('error');
                setMessage('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง');
            }
        };
        startCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [modelsLoaded]);

    // Auto-capture state for verify mode
    const autoCaptureTriggerRef = useRef(false);
    const consecutiveDetectionsRef = useRef(0);
    const AUTO_CAPTURE_THRESHOLD = 5; // ~5 frames = ~1.5s at typical frame rate

    // Face detection loop
    useEffect(() => {
        if (status !== 'detecting' || !videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        consecutiveDetectionsRef.current = 0;
        autoCaptureTriggerRef.current = false;

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
                    // Draw face box
                    const { x, y, width, height } = detection.detection.box;
                    ctx.strokeStyle = '#22c55e';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(x, y, width, height);

                    // Draw corners
                    const cornerLen = 20;
                    ctx.strokeStyle = '#22c55e';
                    ctx.lineWidth = 4;
                    // Top-left
                    ctx.beginPath(); ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y); ctx.stroke();
                    // Top-right
                    ctx.beginPath(); ctx.moveTo(x + width - cornerLen, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + cornerLen); ctx.stroke();
                    // Bottom-left
                    ctx.beginPath(); ctx.moveTo(x, y + height - cornerLen); ctx.lineTo(x, y + height); ctx.lineTo(x + cornerLen, y + height); ctx.stroke();
                    // Bottom-right
                    ctx.beginPath(); ctx.moveTo(x + width - cornerLen, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - cornerLen); ctx.stroke();

                    // Auto-capture in verify mode after stable detection
                    if (mode === 'verify' && !autoCaptureTriggerRef.current) {
                        consecutiveDetectionsRef.current++;
                        const remaining = AUTO_CAPTURE_THRESHOLD - consecutiveDetectionsRef.current;
                        if (remaining > 0) {
                            setMessage(`กำลังตรวจสอบใบหน้า... (${Math.ceil(remaining * 0.3)}s)`);
                        }
                        if (consecutiveDetectionsRef.current >= AUTO_CAPTURE_THRESHOLD) {
                            autoCaptureTriggerRef.current = true;
                            setMessage('กำลังยืนยันตัวตน...');
                            // Trigger auto-capture
                            handleCapture();
                            return; // Stop detection loop
                        }
                    } else if (mode === 'register') {
                        setMessage('✓ ตรวจพบใบหน้า — กดปุ่มบันทึก');
                    }
                } else {
                    consecutiveDetectionsRef.current = 0;
                    setMessage('กรุณาหันหน้าตรงกับกล้อง');
                }
            }

            animFrameRef.current = requestAnimationFrame(detect);
        };

        detect();

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [status]);

    // Capture face descriptor
    const handleCapture = useCallback(async () => {
        if (!videoRef.current) return;
        setStatus('loading');
        setMessage('กำลังประมวลผลใบหน้า...');

        try {
            const detection = await faceapi
                .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                setStatus('detecting');
                setMessage('ไม่พบใบหน้า กรุณาลองใหม่');
                return;
            }

            const descriptor = Array.from(detection.descriptor);
            setCapturedDescriptor(descriptor);

            if (mode === 'verify' && referenceDescriptor) {
                // Compare with reference
                const refDesc = new Float32Array(referenceDescriptor);
                const distance = faceapi.euclideanDistance(detection.descriptor, refDesc);
                const matched = distance < MATCH_THRESHOLD;
                setMatchResult({ distance, matched });
                onMatch?.(distance, matched);

                if (matched) {
                    setStatus('captured');
                    setMessage(`✅ ยืนยันตัวตนสำเร็จ (ความแม่นยำ: ${Math.round((1 - distance) * 100)}%)`);
                    // Auto-proceed after 1.5s
                    setTimeout(() => onCapture(descriptor), 1500);
                } else {
                    setStatus('detecting');
                    setMessage(`❌ ใบหน้าไม่ตรงกัน (ความคล้าย: ${Math.round((1 - distance) * 100)}%) — ลองใหม่`);
                }
            } else {
                // Registration mode — just capture
                setStatus('captured');
                setMessage('✅ บันทึกใบหน้าเรียบร้อย');
                onCapture(descriptor);
            }
        } catch (err) {
            console.error('Capture error:', err);
            setStatus('detecting');
            setMessage('เกิดข้อผิดพลาด กรุณาลองใหม่');
        }
    }, [mode, referenceDescriptor, onCapture, onMatch]);

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                        <span className="material-icons-round text-primary">face</span>
                        <h3 className="font-bold text-gray-900 dark:text-white">
                            {mode === 'register' ? 'ลงทะเบียนใบหน้า' : 'ยืนยันตัวตน'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <span className="material-icons-round text-gray-500">close</span>
                    </button>
                </div>

                {/* Camera View */}
                <div className="relative bg-black aspect-[4/3]">
                    <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        autoPlay
                        playsInline
                        muted
                        style={{ transform: 'scaleX(-1)' }} // Mirror
                    />
                    <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full"
                        style={{ transform: 'scaleX(-1)' }}
                    />

                    {/* Overlay guide circle */}
                    {status === 'detecting' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-48 h-48 rounded-full border-2 border-dashed border-white/30" />
                        </div>
                    )}

                    {/* Loading overlay */}
                    {status === 'loading' && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <div className="text-center text-white">
                                <span className="material-icons-round text-4xl animate-spin mb-2 block">autorenew</span>
                                <p className="text-sm">{message}</p>
                            </div>
                        </div>
                    )}

                    {/* Success overlay */}
                    {status === 'captured' && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                            <div className="text-center">
                                <span className="material-icons-round text-6xl text-green-400 mb-2 block">check_circle</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Status message */}
                <div className={`px-4 py-3 text-center text-sm font-medium ${status === 'error' ? 'text-red-500 bg-red-50 dark:bg-red-900/20' :
                    status === 'captured' ? 'text-green-600 bg-green-50 dark:bg-green-900/20' :
                        'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800'
                    }`}>
                    {employeeName && mode === 'verify' && (
                        <p className="text-xs text-gray-400 mb-1">กำลังยืนยันตัวตน: <strong>{employeeName}</strong></p>
                    )}
                    {message}
                </div>

                {/* Actions */}
                <div className="p-4 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                    >
                        ยกเลิก
                    </button>
                    {status === 'detecting' && (
                        <button
                            onClick={handleCapture}
                            className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-sm shadow-lg shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-icons-round text-lg">camera_alt</span>
                            {mode === 'register' ? 'บันทึกใบหน้า' : 'ยืนยัน'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FaceCapture;
