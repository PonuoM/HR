/**
 * POC for migrating face recognition from face-api → @vladmandic/human.
 *
 * Standalone test page (no DB integration). Stores the test descriptor in
 * localStorage so registration + verification can be exercised without
 * touching production data.
 *
 * Reads model files from the official CDN — for production we would mirror
 * them under /public/models-v2/ to keep the app fully self-hosted.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// @ts-ignore — types ship with the package but resolve only when used at runtime
import Human from '@vladmandic/human';

const HUMAN_CDN = 'https://vladmandic.github.io/human/models/';
const STORAGE_KEY = 'face_test_v2_descriptor';
const MATCH_THRESHOLD = 0.45; // matches Phase 1 face-api threshold for fair comparison

const humanConfig: any = {
    modelBasePath: HUMAN_CDN,
    backend: 'webgl',
    cacheSensitivity: 0,
    face: {
        enabled: true,
        detector: { rotation: false, maxDetected: 1, minConfidence: 0.4 },
        mesh: { enabled: true },
        iris: { enabled: false },
        description: { enabled: true },   // 1024-d MobileFaceNet descriptor
        emotion: { enabled: false },
        antispoof: { enabled: true },     // detect printed photos / screen replay
        liveness: { enabled: true },      // detect static images vs live video
    },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: false },
};

type Phase = 'idle' | 'loading' | 'ready' | 'detecting' | 'done';

const AdminFaceTestScreen: React.FC = () => {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const humanRef = useRef<any>(null);
    const rafRef = useRef<number>(0);
    const mountedRef = useRef(false);

    const [phase, setPhase] = useState<Phase>('idle');
    const [mode, setMode] = useState<'register' | 'verify' | null>(null);
    const [message, setMessage] = useState('');
    const [storedDescriptor, setStoredDescriptor] = useState<number[] | null>(null);
    const [result, setResult] = useState<{
        similarity: number;
        matched: boolean;
        liveness: number;
        antispoof: number;
        elapsedMs: number;
    } | null>(null);

    // Load stored descriptor from localStorage on mount
    useEffect(() => {
        mountedRef.current = true;
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            try { setStoredDescriptor(JSON.parse(raw)); } catch { /* ignore */ }
        }
        return () => { mountedRef.current = false; };
    }, []);

    // Cleanup camera + animation on unmount
    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            const stream = videoRef.current?.srcObject as MediaStream | null;
            stream?.getTracks().forEach(t => t.stop());
        };
    }, []);

    const startSession = async (m: 'register' | 'verify') => {
        setMode(m);
        setResult(null);
        setMessage('กำลังโหลดโมเดล Human (~12 MB ครั้งแรก)...');
        setPhase('loading');

        try {
            if (!humanRef.current) {
                humanRef.current = new Human(humanConfig);
                await humanRef.current.load();
                await humanRef.current.warmup();
            }
            if (!mountedRef.current) return;

            setMessage('กำลังเปิดกล้อง...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
            });
            if (!mountedRef.current) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setPhase('detecting');
            setMessage(m === 'register' ? 'มองตรงไปที่กล้อง — ถือนิ่งๆ' : 'ยืนยันตัวตน — มองตรงกล้อง');
            detectLoop();
        } catch (err: any) {
            console.error(err);
            setPhase('idle');
            setMessage('Error: ' + (err?.message || 'ไม่สามารถเปิดกล้องได้'));
        }
    };

    const detectLoop = async () => {
        if (!mountedRef.current || !humanRef.current || !videoRef.current) return;
        const tStart = performance.now();
        try {
            await humanRef.current.detect(videoRef.current);
            const interp = humanRef.current.next(humanRef.current.result);
            if (canvasRef.current && videoRef.current) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                await humanRef.current.draw.canvas(videoRef.current, canvasRef.current);
                await humanRef.current.draw.face(canvasRef.current, interp.face);
            }

            const face = interp.face?.[0];
            if (face?.embedding && face.embedding.length > 0) {
                const live = face.live ?? 1;     // 0..1, 1 = live
                const spoof = face.real ?? 1;    // 0..1, 1 = real (not printed/screen)

                if (mode === 'register') {
                    if (live < 0.5 || spoof < 0.5) {
                        setMessage(`⚠️ ตรวจพบความผิดปกติ (liveness=${live.toFixed(2)}, real=${spoof.toFixed(2)}) — ลองใหม่`);
                    } else {
                        const desc = Array.from(face.embedding) as number[];
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(desc));
                        setStoredDescriptor(desc);
                        setResult({
                            similarity: 1,
                            matched: true,
                            liveness: live,
                            antispoof: spoof,
                            elapsedMs: Math.round(performance.now() - tStart),
                        });
                        setPhase('done');
                        setMessage(`✅ ลงทะเบียนสำเร็จ — descriptor ${desc.length} มิติ`);
                        stopCamera();
                        return;
                    }
                } else if (mode === 'verify' && storedDescriptor) {
                    const sim = humanRef.current.match.similarity(face.embedding, storedDescriptor);
                    const matched = sim >= (1 - MATCH_THRESHOLD); // similarity is 0..1
                    if (matched && live >= 0.5 && spoof >= 0.5) {
                        setResult({
                            similarity: sim,
                            matched: true,
                            liveness: live,
                            antispoof: spoof,
                            elapsedMs: Math.round(performance.now() - tStart),
                        });
                        setPhase('done');
                        setMessage(`✅ ตรงกัน — similarity ${(sim * 100).toFixed(1)}%`);
                        stopCamera();
                        return;
                    } else if (!matched) {
                        setMessage(`ค้นหา... similarity=${(sim * 100).toFixed(1)}% (ต้อง ≥ ${((1 - MATCH_THRESHOLD) * 100).toFixed(0)}%)`);
                    } else {
                        setMessage(`⚠️ ตรงกันแต่ liveness ต่ำ (${live.toFixed(2)}) — ห้ามใช้รูปถ่าย`);
                    }
                }
            }
        } catch (err) {
            console.error('detect frame error', err);
        }
        rafRef.current = requestAnimationFrame(detectLoop);
    };

    const stopCamera = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        const stream = videoRef.current?.srcObject as MediaStream | null;
        stream?.getTracks().forEach(t => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
    };

    const reset = () => {
        stopCamera();
        setPhase('idle');
        setMode(null);
        setResult(null);
        setMessage('');
    };

    const clearStored = () => {
        localStorage.removeItem(STORAGE_KEY);
        setStoredDescriptor(null);
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 pb-20">
            {/* Header */}
            <div className="bg-primary text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-10 shadow">
                <button onClick={() => navigate(-1)} className="p-1">
                    <span className="material-icons-round">arrow_back</span>
                </button>
                <div>
                    <h1 className="text-lg font-bold">Face Test (Human library)</h1>
                    <p className="text-xs opacity-80">POC — ทดสอบ MobileFaceNet + liveness</p>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Status panel */}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-300">สถานะ descriptor</span>
                        <span className={`text-sm font-bold ${storedDescriptor ? 'text-green-600' : 'text-slate-400'}`}>
                            {storedDescriptor ? `✓ มีแล้ว (${storedDescriptor.length}d)` : 'ยังไม่ได้ลงทะเบียน'}
                        </span>
                    </div>
                    {storedDescriptor && (
                        <button onClick={clearStored} className="mt-2 text-xs text-red-500 hover:underline">
                            ลบ descriptor (เริ่มใหม่)
                        </button>
                    )}
                </div>

                {/* Action buttons */}
                {phase === 'idle' && (
                    <div className="space-y-3">
                        <button
                            onClick={() => startSession('register')}
                            className="w-full bg-primary text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
                        >
                            <span className="material-icons-round">app_registration</span>
                            ลงทะเบียนใบหน้า (POC)
                        </button>
                        <button
                            onClick={() => startSession('verify')}
                            disabled={!storedDescriptor}
                            className="w-full bg-green-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <span className="material-icons-round">verified_user</span>
                            ทดสอบยืนยันตัวตน
                        </button>
                    </div>
                )}

                {/* Camera view */}
                {(phase === 'loading' || phase === 'detecting' || phase === 'done') && (
                    <div className="bg-black rounded-xl overflow-hidden relative aspect-[3/4]">
                        <video
                            ref={videoRef}
                            playsInline muted autoPlay
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{ transform: 'scaleX(-1)' }}
                        />
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full"
                            style={{ transform: 'scaleX(-1)' }}
                        />
                        {phase === 'loading' && (
                            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                                <div className="text-center text-white">
                                    <span className="material-icons-round text-5xl animate-spin block mb-2">autorenew</span>
                                    <p className="text-sm">{message}</p>
                                </div>
                            </div>
                        )}
                        {(phase === 'detecting' || phase === 'done') && (
                            <div className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur p-3 text-center">
                                <p className="text-white text-sm font-medium">{message}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Result panel */}
                {result && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow space-y-2">
                        <h3 className="font-bold text-slate-800 dark:text-white">ผลการทดสอบ</h3>
                        <Row label="Similarity" value={`${(result.similarity * 100).toFixed(2)}%`} />
                        <Row label="Liveness score" value={result.liveness.toFixed(3)}
                            warn={result.liveness < 0.5} />
                        <Row label="Anti-spoof score" value={result.antispoof.toFixed(3)}
                            warn={result.antispoof < 0.5} />
                        <Row label="Match" value={result.matched ? '✓ Pass' : '✗ Fail'} />
                        <Row label="Frame time" value={`${result.elapsedMs} ms`} />
                    </div>
                )}

                {/* Reset button */}
                {phase === 'done' && (
                    <button
                        onClick={reset}
                        className="w-full bg-slate-700 text-white font-bold py-3 rounded-xl"
                    >
                        ทดสอบอีกครั้ง
                    </button>
                )}

                {/* Info card */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <p className="font-bold">ℹ️ หมายเหตุ POC</p>
                    <p>• Descriptor เก็บที่ localStorage (ไม่กระทบ DB)</p>
                    <p>• โมเดลโหลดจาก vladmandic.github.io ครั้งแรก ~12 MB (cache หลังจากนั้น)</p>
                    <p>• Liveness/Antispoof ทำงานอัตโนมัติ ป้องกันใช้รูปถ่ายแทน</p>
                    <p>• ถ้า POC ผ่าน → migrate เข้า DB โดย Soft migration (Phase 3)</p>
                </div>
            </div>
        </div>
    );
};

const Row: React.FC<{ label: string; value: string; warn?: boolean }> = ({ label, value, warn }) => (
    <div className="flex justify-between items-center text-sm">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className={`font-mono font-bold ${warn ? 'text-amber-600' : 'text-slate-800 dark:text-white'}`}>
            {value}
        </span>
    </div>
);

export default AdminFaceTestScreen;
