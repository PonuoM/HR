import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import {
    getVoteCandidates, getMyVotes, castVote, removeVote,
    getMyVoteScore, getYearlyVoteRanking, getVoteLeaderboard, checkActivity,
} from '../services/api';

const MONTHS_FULL = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

type Tab = 'vote' | 'leaderboard' | 'ranking';

const VoteScreen: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    const [tab, setTab] = useState<Tab>('vote');
    const [showRules, setShowRules] = useState(false);
    const [activityEnabled, setActivityEnabled] = useState<boolean | null>(null); // null = loading

    // Check if this activity is enabled
    useEffect(() => {
        checkActivity('employee_vote').then(r => setActivityEnabled(r.enabled)).catch(() => setActivityEnabled(true));
    }, []);

    const [candidates, setCandidates] = useState<any[]>([]);
    const [myVotes, setMyVotes] = useState<any[]>([]);
    const [votesRemaining, setVotesRemaining] = useState(3);
    const [loadingCandidates, setLoadingCandidates] = useState(true);
    const [voting, setVoting] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [myScore, setMyScore] = useState<any>(null);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [lbMonth, setLbMonth] = useState((new Date().getMonth()) || 12);
    const [lbYear, setLbYear] = useState(new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear());
    const [lbLoading, setLbLoading] = useState(false);
    const [lbError, setLbError] = useState('');
    const [ranking, setRanking] = useState<any[]>([]);
    const [rankLoading, setRankLoading] = useState(false);

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const loadVoteData = useCallback(async () => {
        setLoadingCandidates(true);
        try {
            const [cands, votes] = await Promise.all([getVoteCandidates(), getMyVotes()]);
            setCandidates(cands);
            setMyVotes(votes.votes);
            setVotesRemaining(votes.votes_remaining);
        } catch (e: any) { toast(e.message || 'โหลดข้อมูลไม่สำเร็จ', 'error'); }
        finally { setLoadingCandidates(false); }
    }, [toast]);

    const loadScore = useCallback(async () => {
        try { setMyScore(await getMyVoteScore()); } catch { /* ignore */ }
    }, []);

    const loadLeaderboard = useCallback(async () => {
        setLbLoading(true); setLbError('');
        try { const d = await getVoteLeaderboard(lbMonth, lbYear); setLeaderboard(d.leaderboard || []); }
        catch (e: any) { setLbError(e.message?.includes('ยังไม่สามารถ') ? 'ยังไม่สามารถดูผลเดือนนี้ได้' : e.message); setLeaderboard([]); }
        finally { setLbLoading(false); }
    }, [lbMonth, lbYear]);

    const loadRanking = useCallback(async () => {
        setRankLoading(true);
        try { const d = await getYearlyVoteRanking(); setRanking(d.ranking || []); } catch { /* ignore */ }
        finally { setRankLoading(false); }
    }, []);

    useEffect(() => { loadVoteData(); loadScore(); }, [loadVoteData, loadScore]);
    useEffect(() => { if (tab === 'leaderboard') loadLeaderboard(); }, [tab, loadLeaderboard]);
    useEffect(() => { if (tab === 'ranking') loadRanking(); }, [tab, loadRanking]);

    const handleVote = async (targetId: string) => {
        if (!user?.id) return;
        setVoting(targetId);
        try { await castVote(user.id, targetId); toast('โหวตสำเร็จ! ⭐', 'success'); await loadVoteData(); loadScore(); }
        catch (e: any) { toast(e.message || 'โหวตไม่สำเร็จ', 'error'); }
        finally { setVoting(null); }
    };

    const handleRemoveVote = async (voteId: number) => {
        try { await removeVote(voteId); toast('ยกเลิกโหวตแล้ว', 'info'); await loadVoteData(); loadScore(); }
        catch (e: any) { toast(e.message || 'ลบโหวตไม่สำเร็จ', 'error'); }
    };

    const votedIds = new Set(myVotes.map((v: any) => v.voted_for_id));
    const filtered = candidates.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.department?.toLowerCase().includes(search.toLowerCase())
    );

    const medals = ['🥇', '🥈', '🥉'];
    const medalBg = [
        'from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20',
        'from-gray-50 to-slate-50 dark:from-gray-800/40 dark:to-slate-800/40',
        'from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20',
    ];

    // If activity is disabled, show blocked message
    if (activityEnabled === null) {
        return (
            <div className="pt-14 md:pt-6 pb-24 min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
                <span className="material-icons-round animate-spin text-3xl text-primary">autorenew</span>
            </div>
        );
    }

    if (activityEnabled === false) {
        return (
            <div className="pt-14 md:pt-6 pb-24 min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center px-6">
                <div className="text-center max-w-sm">
                    <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                        <span className="material-icons-round text-4xl text-gray-400">block</span>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">กิจกรรมนี้ปิดอยู่</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        ผู้ดูแลระบบได้ปิดกิจกรรมโหวตพนักงานดีเด่นไว้ชั่วคราว
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all"
                    >
                        กลับหน้าหลัก
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="pt-14 md:pt-6 pb-24 md:pb-8 min-h-screen bg-white dark:bg-gray-900">

            {/* ═══ Header ═══ */}
            <header className="sticky top-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-4 py-2.5 md:relative md:border-none md:bg-transparent md:dark:bg-transparent">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
                            <span className="text-base">⭐</span>
                        </div>
                        <div className="flex-1">
                            <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight">พนักงานดีเด่น</h1>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {MONTHS_FULL[currentMonth]} {currentYear + 543} · เหลือ <span className="font-bold text-amber-500">{votesRemaining}</span> โหวต
                            </p>
                        </div>
                        {/* Mini score badges */}
                        {myScore && (
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 rounded-full px-2 py-0.5">
                                    <span className="text-xs">🏆</span>
                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{myScore.total_yearly_score}</span>
                                </div>
                                <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/30 rounded-full px-2 py-0.5">
                                    <span className="text-xs">🔥</span>
                                    <span className="text-xs font-bold text-orange-500">{myScore.current_streak}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ═══ Tabs ═══ */}
            <div className="max-w-2xl mx-auto px-4 pt-2">
                <div className="flex bg-white dark:bg-gray-800 rounded-lg p-0.5 border border-gray-100 dark:border-gray-700 shadow-sm">
                    {[
                        { key: 'vote' as Tab, icon: 'how_to_vote', label: 'โหวต' },
                        { key: 'leaderboard' as Tab, icon: 'leaderboard', label: 'Top 5' },
                        { key: 'ranking' as Tab, icon: 'emoji_events', label: 'อันดับปี' },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-medium transition-all ${tab === t.key
                                ? 'bg-blue-500 text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                }`}
                        >
                            <span className="material-icons-round text-sm">{t.icon}</span>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══ Tab Content ═══ */}
            <div className="max-w-2xl mx-auto px-4 pt-3 pb-4">

                {/* ── Animated Rules Button ── */}
                {tab === 'vote' && (
                    <button
                        onClick={() => setShowRules(true)}
                        className="w-full mb-3 flex items-center gap-3 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 dark:from-amber-900/15 dark:via-orange-900/15 dark:to-amber-900/15 border border-amber-200/70 dark:border-amber-700/40 rounded-xl px-3 py-2.5 text-left transition-all hover:shadow-md hover:border-amber-300 group"
                        style={{ animation: 'rulesGlow 3s ease-in-out infinite' }}
                    >
                        {/* Animated Trophy SVG */}
                        <div className="relative w-10 h-10 flex-shrink-0">
                            <svg viewBox="0 0 48 48" className="w-full h-full" style={{ animation: 'trophyBounce 2s ease-in-out infinite' }}>
                                {/* Trophy Cup */}
                                <path d="M14 8h20v4c0 6-4 11-10 13-6-2-10-7-10-13V8z" fill="url(#trophyGold)" stroke="#D97706" strokeWidth="1.5" />
                                {/* Left Handle */}
                                <path d="M14 12H10c-1 0-2 1-2 2v2c0 3 2 5 4 5h2" fill="none" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
                                {/* Right Handle */}
                                <path d="M34 12h4c1 0 2 1 2 2v2c0 3-2 5-4 5h-2" fill="none" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
                                {/* Stem */}
                                <rect x="21" y="25" width="6" height="6" rx="1" fill="#D97706" />
                                {/* Base */}
                                <rect x="16" y="31" width="16" height="4" rx="2" fill="url(#trophyGold)" stroke="#D97706" strokeWidth="1" />
                                {/* Star */}
                                <path d="M24 13l1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5L19 16.5l3.5-.5z" fill="#FFF" opacity="0.9">
                                    <animate attributeName="opacity" values="0.9;0.5;0.9" dur="1.5s" repeatCount="indefinite" />
                                </path>
                                {/* Sparkles */}
                                <circle cx="10" cy="8" r="1.2" fill="#FBBF24">
                                    <animate attributeName="r" values="0;1.5;0" dur="2s" begin="0s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" values="0;1;0" dur="2s" begin="0s" repeatCount="indefinite" />
                                </circle>
                                <circle cx="38" cy="6" r="1" fill="#F59E0B">
                                    <animate attributeName="r" values="0;1.2;0" dur="2s" begin="0.7s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" values="0;1;0" dur="2s" begin="0.7s" repeatCount="indefinite" />
                                </circle>
                                <circle cx="8" cy="20" r="0.8" fill="#FCD34D">
                                    <animate attributeName="r" values="0;1;0" dur="2.5s" begin="1.2s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" values="0;1;0" dur="2.5s" begin="1.2s" repeatCount="indefinite" />
                                </circle>
                                <circle cx="40" cy="18" r="0.8" fill="#FBBF24">
                                    <animate attributeName="r" values="0;1.3;0" dur="2.2s" begin="0.3s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" values="0;1;0" dur="2.2s" begin="0.3s" repeatCount="indefinite" />
                                </circle>
                                <defs>
                                    <linearGradient id="trophyGold" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#FCD34D" />
                                        <stop offset="100%" stopColor="#F59E0B" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 leading-tight">📋 กฎกติกาการโหวต</p>
                            <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60 mt-0.5">กดเพื่ออ่านรายละเอียดคะแนนและรางวัล</p>
                        </div>
                        <span className="material-icons-round text-amber-400 group-hover:text-amber-500 text-lg transition-colors">arrow_forward_ios</span>
                    </button>
                )}

                {/* ── Rules Modal ── */}
                {showRules && (
                    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" onClick={() => setShowRules(false)}>
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }} />
                        <div
                            className="relative w-full max-w-lg max-h-[85vh] bg-white dark:bg-gray-800 rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                            onClick={e => e.stopPropagation()}
                            style={{ animation: 'modalSlideUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}
                        >
                            {/* Modal Header */}
                            <div className="sticky top-0 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 px-5 py-4 flex items-center gap-3 z-10">
                                <svg viewBox="0 0 36 36" className="w-8 h-8 flex-shrink-0">
                                    <path d="M10 6h16v3c0 5-3 9-8 10.5C13 18 10 14 10 9V6z" fill="#FFF" opacity="0.9" />
                                    <path d="M10 9H7c-.5 0-1 .5-1 1v1.5c0 2 1.5 4 3 4H10" fill="none" stroke="#FFF" strokeWidth="1.2" opacity="0.7" />
                                    <path d="M26 9h3c.5 0 1 .5 1 1v1.5c0 2-1.5 4-3 4h-1" fill="none" stroke="#FFF" strokeWidth="1.2" opacity="0.7" />
                                    <rect x="15.5" y="19" width="5" height="4" rx="1" fill="#FFF" opacity="0.7" />
                                    <rect x="12" y="23" width="12" height="3" rx="1.5" fill="#FFF" opacity="0.8" />
                                    <path d="M18 10l1 2.2 2.5.3-1.8 1.8.4 2.5L18 15.5l-2.1 1.3.4-2.5-1.8-1.8 2.5-.3z" fill="#F59E0B" />
                                </svg>
                                <div className="flex-1">
                                    <h2 className="text-base font-bold text-white leading-tight">กฎกติกาการโหวต</h2>
                                    <p className="text-xs text-white/70">พนักงานดีเด่นประจำปี</p>
                                </div>
                                <button onClick={() => setShowRules(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                                    <span className="material-icons-round text-white text-lg">close</span>
                                </button>
                            </div>

                            {/* Modal Body — scrollable */}
                            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm text-gray-600 dark:text-gray-300">

                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0"><span className="text-base">🗳️</span></div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white text-sm">สิทธิ์โหวต</p>
                                        <p className="text-xs mt-0.5 leading-relaxed">ทุกเดือนมี <b>3 คะแนน</b> โหวตให้ใครก็ได้ที่ไม่ใช่ตัวเอง<br />สูงสุด 1 คะแนน/คน/เดือน</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0"><span className="text-base">✏️</span></div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white text-sm">แก้ไขโหวต</p>
                                        <p className="text-xs mt-0.5 leading-relaxed">เปลี่ยนใจได้ตลอดภายในเดือนนั้น กดยกเลิกแล้วโหวตคนใหม่ได้เลย</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0"><span className="text-base">⭐</span></div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white text-sm">การคิดคะแนน</p>
                                        <div className="text-xs mt-1 space-y-1 leading-relaxed">
                                            <div className="flex items-center gap-2"><span className="inline-block w-5 h-5 rounded bg-green-100 dark:bg-green-900/30 text-center text-[10px] leading-5 font-bold text-green-600">+1</span> คนโหวต ได้คะแนนมีส่วนร่วมต่อโหวต</div>
                                            <div className="flex items-center gap-2"><span className="inline-block w-5 h-5 rounded bg-green-100 dark:bg-green-900/30 text-center text-[10px] leading-5 font-bold text-green-600">+1</span> คนถูกโหวต ได้คะแนนต่อโหวต</div>
                                            <div className="flex items-center gap-2"><span className="inline-block w-5 h-5 rounded bg-red-100 dark:bg-red-900/30 text-center text-[10px] leading-5 font-bold text-red-500">-1</span> ไม่โหวต ถูกหักต่อโหวตที่ไม่ได้ใช้</div>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1 italic">คะแนนต่ำสุด = 0 (ไม่ติดลบ)</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0"><span className="text-base">🔥</span></div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white text-sm">Streak Bonus</p>
                                        <p className="text-xs mt-0.5 leading-relaxed">โหวตครบ 3 คะแนนติดต่อกัน <b>3 เดือน</b> ได้โบนัส <b className="text-orange-500">+2 คะแนน</b> ทันที!</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0"><span className="text-base">🎁</span></div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white text-sm">รางวัล Milestone</p>
                                        <p className="text-xs mt-0.5 leading-relaxed">สะสมครบ <b>50 คะแนน</b> รับรางวัลพิเศษ<br />🥇 Top 1 สิ้นปี = <b className="text-amber-500">พนักงานดีเด่นประจำปี!</b></p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center flex-shrink-0"><span className="text-base">🔒</span></div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white text-sm">ความเป็นส่วนตัว</p>
                                        <p className="text-xs mt-0.5 leading-relaxed">การโหวต<b>เป็นความลับ 100%</b> ไม่มีใครเห็นว่าคุณโหวตใคร<br />ผลคะแนนเปิดเผยเฉพาะเมื่อจบเดือน</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0"><span className="text-base">🏖️</span></div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white text-sm">ข้อยกเว้น</p>
                                        <p className="text-xs mt-0.5 leading-relaxed">พนักงานที่ลายาว (≥15 วัน) หรือเข้าใหม่ในเดือนนั้น<br />จะไม่ถูกหักคะแนนและไม่ต้องโหวต</p>
                                    </div>
                                </div>

                            </div>

                            {/* Modal Footer */}
                            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 px-5 py-3">
                                <button onClick={() => setShowRules(false)} className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all active:scale-[0.98] shadow-md shadow-blue-200/50 dark:shadow-blue-900/30">
                                    เข้าใจแล้ว! ไปโหวตเลย ⭐
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Vote Tab ── */}
                {tab === 'vote' && (
                    <div className="space-y-2.5">
                        {/* My Votes — inline chips */}
                        {myVotes.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl px-3 py-2.5 border border-gray-100 dark:border-gray-700 shadow-sm">
                                <p className="text-[11px] font-semibold text-gray-400 mb-1.5 flex items-center gap-1">
                                    <span className="material-icons-round text-amber-500 text-xs">star</span>
                                    โหวตแล้ว ({myVotes.length}/3)
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {myVotes.map((v: any) => (
                                        <div key={v.id} className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40 rounded-full pl-0.5 pr-1.5 py-0.5">
                                            <div className="w-5 h-5 rounded-full bg-white dark:bg-gray-700 overflow-hidden flex-shrink-0 border border-amber-200 dark:border-amber-600">
                                                {v.avatar ? <img src={v.avatar} className="w-full h-full object-cover" alt="" /> : <span className="flex items-center justify-center w-full h-full text-[8px]">⭐</span>}
                                            </div>
                                            <span className="text-[11px] font-medium text-gray-700 dark:text-gray-200 max-w-[72px] truncate">{v.name}</span>
                                            <button onClick={() => handleRemoveVote(v.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                                <span className="material-icons-round text-xs">close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Search */}
                        <div className="relative">
                            <span className="material-icons-round text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 text-base">search</span>
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="ค้นหาชื่อหรือแผนก..."
                                className="w-full pl-8 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>

                        {/* Candidate Grid — compact */}
                        {loadingCandidates ? (
                            <div className="text-center py-10">
                                <span className="material-icons-round animate-spin text-2xl text-blue-500">autorenew</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                                {filtered.map((c: any) => {
                                    const alreadyVoted = votedIds.has(c.id);
                                    const isVoting = voting === c.id;
                                    return (
                                        <div
                                            key={c.id}
                                            className={`flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-2 py-2 border transition-all ${alreadyVoted
                                                ? 'border-amber-200 dark:border-amber-700/50 bg-amber-50/40 dark:bg-amber-900/10'
                                                : 'border-gray-100 dark:border-gray-700'
                                                }`}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {c.avatar ? (
                                                    <img src={c.avatar} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <span className="material-icons-round text-gray-400 text-base">person</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-semibold text-gray-900 dark:text-white truncate leading-tight">{c.name}</p>
                                                <p className="text-[9px] text-gray-400 truncate">{c.department || '-'}</p>
                                            </div>
                                            {alreadyVoted ? (
                                                <span className="text-amber-500 text-xs flex-shrink-0">⭐</span>
                                            ) : (
                                                <button
                                                    onClick={() => handleVote(c.id)}
                                                    disabled={votesRemaining <= 0 || isVoting}
                                                    className="px-2 py-1 bg-blue-500 text-white text-[10px] font-semibold rounded-md hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 flex-shrink-0"
                                                >
                                                    {isVoting ? '...' : 'โหวต'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <div className="col-span-full text-center py-8">
                                        <span className="material-icons-round text-3xl text-gray-300 dark:text-gray-600">person_search</span>
                                        <p className="text-xs text-gray-500 mt-1">ไม่พบพนักงาน</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Leaderboard Tab ── */}
                {tab === 'leaderboard' && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 justify-center">
                            <button onClick={() => { if (lbMonth === 1) { setLbMonth(12); setLbYear(y => y - 1); } else setLbMonth(m => m - 1); }}
                                className="w-7 h-7 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 transition-colors">
                                <span className="material-icons-round text-base">chevron_left</span>
                            </button>
                            <span className="text-xs font-semibold text-gray-900 dark:text-white min-w-[110px] text-center">
                                {MONTHS_FULL[lbMonth]} {lbYear + 543}
                            </span>
                            <button onClick={() => { if (lbMonth === 12) { setLbMonth(1); setLbYear(y => y + 1); } else setLbMonth(m => m + 1); }}
                                className="w-7 h-7 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 transition-colors">
                                <span className="material-icons-round text-base">chevron_right</span>
                            </button>
                        </div>

                        {lbLoading && <div className="text-center py-12"><span className="material-icons-round animate-spin text-2xl text-blue-500">autorenew</span></div>}

                        {lbError && (
                            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                <span className="material-icons-round text-4xl text-gray-300 dark:text-gray-600 block mb-1">lock_clock</span>
                                <p className="text-sm text-gray-500 font-medium">{lbError}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">ผลจะแสดงเมื่อปิดเดือนแล้ว</p>
                            </div>
                        )}

                        {!lbLoading && !lbError && leaderboard.length > 0 && (
                            <div className="space-y-1.5">
                                {leaderboard.map((item: any, idx: number) => (
                                    <div key={item.employee_id}
                                        className={`flex items-center gap-2.5 bg-gradient-to-r ${medalBg[idx] || 'from-white to-white dark:from-gray-800 dark:to-gray-800'} rounded-lg px-3 py-2.5 border border-gray-100 dark:border-gray-700`}
                                        style={{ animationDelay: `${idx * 60}ms`, animation: 'fadeSlideUp 0.3s ease-out forwards', opacity: 0 }}>
                                        <div className="w-6 text-center font-bold text-sm">{idx < 3 ? medals[idx] : <span className="text-gray-400 text-xs">{idx + 1}</span>}</div>
                                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                            {item.avatar ? <img src={item.avatar} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center"><span className="material-icons-round text-gray-400 text-base">person</span></div>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{item.name}</p>
                                            <p className="text-[10px] text-gray-400 truncate">{item.department || '-'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{item.received_score}</p>
                                            <p className="text-[9px] text-gray-400">คะแนน</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!lbLoading && !lbError && leaderboard.length === 0 && (
                            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                <span className="material-icons-round text-4xl text-gray-300 dark:text-gray-600 block mb-1">bar_chart</span>
                                <p className="text-sm text-gray-500">ยังไม่มีข้อมูล</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Yearly Ranking Tab ── */}
                {tab === 'ranking' && (
                    <div className="space-y-3">
                        <div className="text-center">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white">🏆 อันดับประจำปี {currentYear + 543}</p>
                            <p className="text-[10px] text-gray-400">คะแนนสะสมตลอดทั้งปี</p>
                        </div>

                        {rankLoading ? (
                            <div className="text-center py-12"><span className="material-icons-round animate-spin text-2xl text-blue-500">autorenew</span></div>
                        ) : (
                            <div className="space-y-1.5">
                                {ranking.map((item: any, idx: number) => {
                                    const isMe = item.employee_id === user?.id;
                                    return (
                                        <div key={item.employee_id}
                                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 border transition-all ${isMe ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 ring-1 ring-blue-200 dark:ring-blue-700'
                                                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                                                }`}
                                            style={{ animationDelay: `${idx * 40}ms`, animation: 'fadeSlideUp 0.3s ease-out forwards', opacity: 0 }}>
                                            <div className="w-6 text-center font-bold text-sm">{idx < 3 ? medals[idx] : <span className="text-gray-400 text-xs">{idx + 1}</span>}</div>
                                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                                {item.avatar ? <img src={item.avatar} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center"><span className="material-icons-round text-gray-400 text-base">person</span></div>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                                                    {item.name} {isMe && <span className="text-[9px] text-blue-500 font-normal">(คุณ)</span>}
                                                </p>
                                                <p className="text-[10px] text-gray-400 truncate">{item.department || '-'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-bold ${isMe ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>{item.yearly_score}</p>
                                                <p className="text-[9px] text-gray-400">คะแนน</p>
                                            </div>
                                        </div>
                                    );
                                })}
                                {ranking.length === 0 && (
                                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <span className="material-icons-round text-4xl text-gray-300 dark:text-gray-600 block mb-1">emoji_events</span>
                                        <p className="text-sm text-gray-500">ยังไม่มีข้อมูลอันดับ</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">จะแสดงเมื่อปิดเดือน</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
        @keyframes fadeSlideUp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes rulesGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); }
          50% { box-shadow: 0 0 12px 2px rgba(251,191,36,0.25); }
        }
        @keyframes trophyBounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-2px) rotate(-3deg); }
          75% { transform: translateY(-1px) rotate(3deg); }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes modalSlideUp {
          0% { opacity: 0; transform: translateY(40px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
};

export default VoteScreen;
