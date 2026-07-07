import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useApi } from '../hooks/useApi';
import { getNews, toggleNewsLike, getNewsComments, addNewsComment, deleteNewsComment } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';

// ── Reaction Types ──
const REACTIONS = [
  { type: 'like', emoji: '👍', label: 'ถูกใจ', color: '#2563eb' },
  { type: 'love', emoji: '❤️', label: 'รักเลย', color: '#ef4444' },
  { type: 'haha', emoji: '😆', label: 'ฮ่าๆ', color: '#f59e0b' },
  { type: 'wow', emoji: '😮', label: 'ว้าว', color: '#f59e0b' },
  { type: 'sad', emoji: '😢', label: 'สะเทือนใจ', color: '#f59e0b' },
  { type: 'angry', emoji: '😠', label: 'โกรธ', color: '#ea580c' },
];

const getReactionEmoji = (type: string | null) => REACTIONS.find(r => r.type === type)?.emoji || '👍';
const getReactionColor = (type: string | null) => REACTIONS.find(r => r.type === type)?.color || '#2563eb';
const getReactionLabel = (type: string | null) => REACTIONS.find(r => r.type === type)?.label || 'ถูกใจ';

// ── Emoji Picker Component ──
const EmojiReactionPicker: React.FC<{
  visible: boolean;
  onSelect: (type: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}> = ({ visible, onSelect, onClose, anchorRef }) => {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (pickerRef.current && !pickerRef.current.contains(target) &&
        anchorRef.current && !anchorRef.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [visible, onClose, anchorRef]);

  if (!visible) return null;

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full left-0 mb-2 z-50"
      style={{ animation: 'emojiPickerIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-full shadow-2xl border border-gray-200 dark:border-gray-600 px-2 py-1.5 flex items-center gap-0.5">
        {REACTIONS.map((r, idx) => (
          <button
            key={r.type}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            onTouchStart={() => setHoveredIdx(idx)}
            onClick={() => { onSelect(r.type); setHoveredIdx(null); }}
            className="relative flex flex-col items-center transition-transform duration-200 ease-out px-1"
            style={{
              transform: hoveredIdx === idx ? 'scale(1.45) translateY(-12px)' : 'scale(1)',
              animationDelay: `${idx * 50}ms`,
              animation: `emojiPopIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 50}ms forwards, emojiWiggle 1.8s ease-in-out ${0.3 + idx * 0.12}s infinite`,
              opacity: 0,
            }}
          >
            <span className="text-[28px] md:text-[32px] select-none cursor-pointer filter drop-shadow-sm">
              {r.emoji}
            </span>
            {hoveredIdx === idx && (
              <span
                className="absolute -top-7 bg-black/80 text-white text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ animation: 'tooltipFade 0.15s ease-out forwards' }}
              >
                {r.label}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Image Lightbox (full-screen viewer with zoom) ──
const ImageLightbox: React.FC<{
  urls: string[];
  startIndex: number;
  onClose: () => void;
}> = ({ urls, startIndex, onClose }) => {
  const [index, setIndex] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  // gesture refs
  const lastTap = useRef(0);
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const resetZoom = useCallback(() => { setScale(1); setTx(0); setTy(0); }, []);

  const goTo = useCallback((next: number) => {
    if (next < 0 || next >= urls.length) return;
    setIndex(next);
    resetZoom();
  }, [urls.length, resetZoom]);

  // keyboard support (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goTo(index - 1);
      else if (e.key === 'ArrowRight') goTo(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, goTo, onClose]);

  const dist = (t: TouchList) => {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.hypot(dx, dy);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStart.current = { dist: dist(e.touches), scale };
      panStart.current = null;
      swipeStart.current = null;
    } else if (e.touches.length === 1) {
      if (scale > 1) {
        panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx, ty };
      } else {
        swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current) {
      const next = Math.min(4, Math.max(1, pinchStart.current.scale * (dist(e.touches) / pinchStart.current.dist)));
      setScale(next);
      if (next === 1) { setTx(0); setTy(0); }
    } else if (e.touches.length === 1 && panStart.current && scale > 1) {
      setTx(panStart.current.tx + (e.touches[0].clientX - panStart.current.x));
      setTy(panStart.current.ty + (e.touches[0].clientY - panStart.current.y));
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    pinchStart.current = null;
    panStart.current = null;
    // swipe to change image (only when not zoomed)
    if (swipeStart.current && scale === 1) {
      const dx = e.changedTouches[0].clientX - swipeStart.current.x;
      const dy = e.changedTouches[0].clientY - swipeStart.current.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goTo(index + 1); else goTo(index - 1);
      }
    }
    swipeStart.current = null;
    // double-tap to zoom
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (scale > 1) resetZoom(); else setScale(2.5);
    }
    lastTap.current = now;
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center select-none"
      style={{ animation: 'lightboxFade 0.2s ease-out' }}
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10 bg-gradient-to-b from-black/60 to-transparent">
        {urls.length > 1 ? (
          <span className="text-white/90 text-sm font-medium">{index + 1} / {urls.length}</span>
        ) : <span />}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <span className="material-icons-round">close</span>
        </button>
      </div>

      {/* Image */}
      <img
        src={urls[index]}
        alt=""
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={(e) => { e.stopPropagation(); if (scale > 1) resetZoom(); else setScale(2.5); }}
        className="max-w-full max-h-full object-contain"
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transition: pinchStart.current || panStart.current ? 'none' : 'transform 0.2s ease-out',
          touchAction: 'none',
          cursor: scale > 1 ? 'grab' : 'zoom-in',
        }}
      />

      {/* Prev / Next (desktop / multi-image) */}
      {urls.length > 1 && (
        <>
          {index > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); goTo(index - 1); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 hidden md:flex items-center justify-center text-white transition-colors"
            >
              <span className="material-icons-round">chevron_left</span>
            </button>
          )}
          {index < urls.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goTo(index + 1); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 hidden md:flex items-center justify-center text-white transition-colors"
            >
              <span className="material-icons-round">chevron_right</span>
            </button>
          )}
          {/* dots */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {urls.map((_, i) => (
              <span key={i} className={`rounded-full transition-all ${i === index ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/40'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ── Long Press Hook ──
function useLongPress(onLongPress: () => void, onClick: () => void, delay = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const start = useCallback((_e: React.TouchEvent | React.MouseEvent) => {
    isLongPress.current = false;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isLongPress.current) onClick();
  }, [onClick]);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: clear,
  };
}

// ── Time Ago Helper ──
const timeAgo = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชม.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} วัน`;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
};

// ── Post Card Component (proper component for hooks) ──
const PostCard: React.FC<{
  article: any;
  isPinned?: boolean;
  userReaction: string | null;
  likes: number;
  reactionSummary: Record<string, number>;
  pickerOpen: boolean;
  onReaction: (type: string) => void;
  onLike: () => void;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onOpenComments: (id: number) => void;
  onToggleExpand: (id: number) => void;
  isExpanded: boolean;
  onOpenImage: (urls: string[], index: number) => void;
}> = ({
  article, isPinned, userReaction, likes, reactionSummary,
  pickerOpen, onReaction, onLike, onOpenPicker, onClosePicker,
  onOpenComments, onToggleExpand, isExpanded, onOpenImage
}) => {
    const likeButtonRef = useRef<HTMLButtonElement>(null);
    const longPressHandlers = useLongPress(onOpenPicker, onLike);

    const commentCount = article.comments || 0;
    const content = article.content || '';
    const shouldTruncate = content.length > 200;
    const topReactions = Object.entries(reactionSummary).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 3);

    return (
      <article className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">

        {/* ── Post Header ── */}
        <div className="px-4 pt-4 pb-2 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full border-2 border-gray-100 dark:border-gray-600 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-primary font-bold text-sm flex-shrink-0 overflow-hidden">
            {article.avatar ? (
              <img src={article.avatar} className="w-full h-full object-cover rounded-full" alt="" />
            ) : (
              <span>{article.department_code || (article.department || 'HR').substring(0, 2)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-semibold text-gray-900 dark:text-white truncate">{article.department || 'ฝ่ายบุคคล'}</p>
              {isPinned && (
                <span className="material-icons-round text-primary text-sm -rotate-45">push_pin</span>
              )}
              {article.is_urgent && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white leading-none">ด่วน</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span>{timeAgo(article.published_at)}</span>
              <span>·</span>
              <span className="material-icons-round text-[13px]">public</span>
            </div>
          </div>
          <button className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors">
            <span className="material-icons-round text-xl">more_horiz</span>
          </button>
        </div>

        {/* ── Post Content ── */}
        <div className="px-4 pb-3">
          <h3 className="text-[16px] font-bold text-gray-900 dark:text-white leading-snug mb-1">{article.title}</h3>
          {content && (
            <div>
              <p className={`text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line ${!isExpanded && shouldTruncate ? 'line-clamp-3' : ''}`}>
                {content}
              </p>
              {shouldTruncate && (
                <button
                  onClick={() => onToggleExpand(article.id)}
                  className="text-gray-500 dark:text-gray-400 hover:underline text-[15px] font-medium mt-0.5"
                >
                  {isExpanded ? 'แสดงน้อยลง' : 'ดูเพิ่มเติม'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Post Image ── */}
        {article.image && (() => {
          let urls: string[] = [];
          try {
              const parsed = JSON.parse(article.image);
              urls = Array.isArray(parsed) ? parsed : [article.image];
          } catch { urls = [article.image]; }
          
          if (urls.length === 0) return null;
          
          return (
            <div className={`w-full bg-gray-100 dark:bg-gray-900 ${urls.length > 1 ? 'grid grid-cols-2 gap-1' : ''}`}>
              {urls.map((u, i) => (
                <div
                  key={i}
                  className={`relative group ${urls.length > 1 && i === 0 && urls.length % 2 !== 0 ? 'col-span-2' : ''}`}
                >
                  <img
                    alt={`${article.title} - ${i+1}`}
                    className="w-full max-h-[500px] object-cover cursor-zoom-in group-hover:opacity-95 transition-opacity"
                    src={u}
                    loading="lazy"
                    onClick={() => onOpenImage(urls, i)}
                  />
                  {/* zoom affordance — always visible so users know the image is tappable */}
                  <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white pointer-events-none">
                    <span className="material-icons-round text-[18px]">zoom_in</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── Reaction / Comment counts ── */}
        {(likes > 0 || commentCount > 0) && (
          <div className="px-4 pt-2.5 pb-1 flex items-center justify-between">
            {likes > 0 ? (
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1">
                  {topReactions.length > 0
                    ? topReactions.map(([type]) => {
                      const emoji = getReactionEmoji(type);
                      const bgColor = type === 'love' ? 'bg-red-500'
                        : type === 'like' ? 'bg-blue-500'
                          : type === 'angry' ? 'bg-orange-500'
                            : 'bg-amber-400';
                      return (
                        <span key={type} className={`w-5 h-5 rounded-full ${bgColor} flex items-center justify-center ring-2 ring-white dark:ring-gray-800`}>
                          <span className="text-[10px]">{emoji}</span>
                        </span>
                      );
                    })
                    : (
                      <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                        <span className="text-[10px]">👍</span>
                      </span>
                    )
                  }
                </div>
                <span className="text-[13px] text-gray-500 dark:text-gray-400">{likes}</span>
              </div>
            ) : <div />}
            {commentCount > 0 && (
              <button onClick={() => onOpenComments(article.id)} className="text-[13px] text-gray-500 dark:text-gray-400 hover:underline">
                {commentCount} ความคิดเห็น
              </button>
            )}
          </div>
        )}

        {/* ── Divider ── */}
        <div className="mx-4 border-t border-gray-100 dark:border-gray-700/60" />

        {/* ── Action Bar ── */}
        <div className="px-2 py-1 flex items-center">
          <div className="relative flex-1">
            <EmojiReactionPicker
              visible={pickerOpen}
              onSelect={onReaction}
              onClose={onClosePicker}
              anchorRef={likeButtonRef}
            />
            <button
              ref={likeButtonRef}
              {...longPressHandlers}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-colors font-medium text-[14px] select-none
              ${userReaction
                  ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              style={userReaction ? { color: getReactionColor(userReaction) } : undefined}
            >
              {userReaction ? (
                <span className="text-xl animate-[likeScale_0.3s_ease-out]">{getReactionEmoji(userReaction)}</span>
              ) : (
                <span className="material-icons-round text-xl">favorite_border</span>
              )}
              <span>{userReaction ? getReactionLabel(userReaction) : 'ถูกใจ'}</span>
            </button>
          </div>

          <button
            onClick={() => onOpenComments(article.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors font-medium text-[14px]"
          >
            <span className="material-icons-round text-xl">chat_bubble_outline</span>
            <span>ความคิดเห็น</span>
          </button>

          <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors font-medium text-[14px]">
            <span className="material-icons-round text-xl">share</span>
            <span>แชร์</span>
          </button>
        </div>
      </article>
    );
  };


// ═══════════════════════════════════════════════
// ── Main NewsScreen Component ──
// ═══════════════════════════════════════════════
const NewsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: allNews, loading, refetch } = useApi(() => getNews(user?.id), [user?.id]);

  // Local reaction state
  const [reactionMap, setReactionMap] = useState<Record<number, string | null>>({});
  const [likeCountMap, setLikeCountMap] = useState<Record<number, number>>({});
  const [reactionSummaryMap, setReactionSummaryMap] = useState<Record<number, Record<string, number>>>({});

  // Expanded text state
  const [expandedPosts, setExpandedPosts] = useState<Set<number>>(new Set());

  // Comment drawer state
  const [openCommentId, setOpenCommentId] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Emoji picker state
  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null);

  // Image lightbox state
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const openImage = (urls: string[], index: number) => setLightbox({ urls, index });

  // Split pinned vs regular articles
  const pinnedNews = allNews?.find((a: any) => a.is_pinned) || null;
  const articles = allNews?.filter((a: any) => !a.is_pinned) || [];

  // Helpers
  const getUserReaction = (article: any): string | null => {
    if (reactionMap[article.id] !== undefined) return reactionMap[article.id];
    return article.user_reaction || null;
  };
  const getLikes = (article: any) => likeCountMap[article.id] ?? (article.likes || 0);
  const getReactionSummary = (article: any): Record<string, number> => {
    return reactionSummaryMap[article.id] ?? (article.reaction_summary || {});
  };

  const toggleExpand = (id: number) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleReaction = async (article: any, type: string) => {
    if (!user?.id) return;
    setPickerOpenFor(null);

    const currentReaction = getUserReaction(article);
    const currentLikes = getLikes(article);
    const currentSummary = { ...getReactionSummary(article) };

    if (currentReaction === type) {
      setReactionMap(m => ({ ...m, [article.id]: null }));
      setLikeCountMap(m => ({ ...m, [article.id]: Math.max(0, currentLikes - 1) }));
      const newSummary = { ...currentSummary };
      if (newSummary[type]) { newSummary[type]--; if (newSummary[type] <= 0) delete newSummary[type]; }
      setReactionSummaryMap(m => ({ ...m, [article.id]: newSummary }));
    } else {
      setReactionMap(m => ({ ...m, [article.id]: type }));
      if (!currentReaction) {
        setLikeCountMap(m => ({ ...m, [article.id]: currentLikes + 1 }));
      }
      const newSummary = { ...currentSummary };
      if (currentReaction && newSummary[currentReaction]) {
        newSummary[currentReaction]--;
        if (newSummary[currentReaction] <= 0) delete newSummary[currentReaction];
      }
      newSummary[type] = (newSummary[type] || 0) + 1;
      setReactionSummaryMap(m => ({ ...m, [article.id]: newSummary }));
    }

    try {
      await toggleNewsLike(article.id, user.id, type);
    } catch {
      setReactionMap(m => ({ ...m, [article.id]: currentReaction }));
      setLikeCountMap(m => ({ ...m, [article.id]: currentLikes }));
      setReactionSummaryMap(m => ({ ...m, [article.id]: currentSummary }));
    }
  };

  const handleLike = (article: any) => {
    const current = getUserReaction(article);
    handleReaction(article, current || 'like');
  };

  const openComments = async (articleId: number) => {
    setOpenCommentId(articleId);
    setComments([]);
    setCommentText('');
    setLoadingComments(true);
    try {
      const data = await getNewsComments(articleId);
      setComments(data);
    } catch {
      toast('ไม่สามารถโหลดความคิดเห็นได้', 'error');
    } finally {
      setLoadingComments(false);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !user?.id || !openCommentId) return;
    setSubmittingComment(true);
    try {
      await addNewsComment(openCommentId, user.id, commentText.trim());
      setCommentText('');
      const data = await getNewsComments(openCommentId);
      setComments(data);
      refetch();
    } catch {
      toast('ไม่สามารถส่งความคิดเห็นได้', 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await deleteNewsComment(commentId);
      setComments(c => c.filter(x => x.id !== commentId));
      refetch();
    } catch {
      toast('ไม่สามารถลบความคิดเห็นได้', 'error');
    }
  };

  return (
    <div className="pt-14 md:pt-8 pb-24 md:pb-8 min-h-full bg-gray-100 dark:bg-gray-950">

      {/* ═══ Header Bar ═══ */}
      <header className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 md:relative md:border-none md:bg-transparent md:dark:bg-transparent">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">ประชาสัมพันธ์</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 md:text-sm">ข่าวสารและประกาศจากบริษัท</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <span className="material-icons-round text-gray-700 dark:text-gray-300 text-[20px]">search</span>
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Feed Content ═══ */}
      <div className="max-w-2xl mx-auto px-0 md:px-4 pt-3 space-y-3">
        {loading && (
          <div className="text-center py-20">
            <span className="material-icons-round animate-spin text-4xl text-primary">autorenew</span>
            <p className="text-sm text-gray-400 mt-3">กำลังโหลดข่าวสาร...</p>
          </div>
        )}

        {!loading && pinnedNews && (
          <PostCard
            key={pinnedNews.id}
            article={pinnedNews}
            isPinned
            userReaction={getUserReaction(pinnedNews)}
            likes={getLikes(pinnedNews)}
            reactionSummary={getReactionSummary(pinnedNews)}
            pickerOpen={pickerOpenFor === pinnedNews.id}
            onReaction={(type) => handleReaction(pinnedNews, type)}
            onLike={() => handleLike(pinnedNews)}
            onOpenPicker={() => setPickerOpenFor(pinnedNews.id)}
            onClosePicker={() => setPickerOpenFor(null)}
            onOpenComments={openComments}
            onToggleExpand={toggleExpand}
            isExpanded={expandedPosts.has(pinnedNews.id)}
            onOpenImage={openImage}
          />
        )}

        {!loading && articles.map((article: any) => (
          <PostCard
            key={article.id}
            article={article}
            userReaction={getUserReaction(article)}
            likes={getLikes(article)}
            reactionSummary={getReactionSummary(article)}
            pickerOpen={pickerOpenFor === article.id}
            onReaction={(type) => handleReaction(article, type)}
            onLike={() => handleLike(article)}
            onOpenPicker={() => setPickerOpenFor(article.id)}
            onClosePicker={() => setPickerOpenFor(null)}
            onOpenComments={openComments}
            onToggleExpand={toggleExpand}
            isExpanded={expandedPosts.has(article.id)}
            onOpenImage={openImage}
          />
        ))}

        {!loading && !pinnedNews && articles.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl">
            <span className="material-icons-round text-6xl text-gray-300 dark:text-gray-600 block mb-3">feed</span>
            <p className="text-gray-500 font-medium">ยังไม่มีข่าวสาร</p>
            <p className="text-sm text-gray-400 mt-1">ข่าวจากบริษัทจะแสดงที่นี่</p>
          </div>
        )}
      </div>

      {/* ═══ Image Lightbox ═══ */}
      {lightbox && (
        <ImageLightbox
          urls={lightbox.urls}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* ═══ Comments Bottom Sheet ═══ */}
      {openCommentId !== null && (
        <div className="fixed inset-0 z-50" onClick={() => setOpenCommentId(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 md:left-1/2 md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:max-w-lg md:rounded-2xl bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl max-h-[85vh] md:max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'commentSlideUp 0.3s ease-out' }}
          >
            <div className="md:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-[16px] text-gray-900 dark:text-white">ความคิดเห็น</h3>
              <button onClick={() => setOpenCommentId(null)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors">
                <span className="material-icons-round text-lg">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-[200px]">
              {loadingComments && (
                <div className="text-center py-10 text-gray-400">
                  <span className="material-icons-round animate-spin text-3xl">autorenew</span>
                </div>
              )}
              {!loadingComments && comments.length === 0 && (
                <div className="text-center py-10">
                  <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-600 block mb-2">forum</span>
                  <p className="text-sm text-gray-500 font-medium">ยังไม่มีความคิดเห็น</p>
                  <p className="text-xs text-gray-400 mt-1">เป็นคนแรกที่แสดงความคิดเห็น!</p>
                </div>
              )}
              {comments.map((c: any) => (
                <div key={c.id} className="flex gap-2.5 group">
                  <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
                    {c.avatar ? (
                      <img src={c.avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="material-icons-round text-gray-400 text-lg">person</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-3.5 py-2.5 inline-block max-w-full">
                      <p className="text-[13px] font-semibold text-gray-900 dark:text-white">{c.employee_name || c.employee_id}</p>
                      <p className="text-[14px] text-gray-700 dark:text-gray-300 mt-0.5 break-words whitespace-pre-line">{c.content}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 ml-1">
                      <span className="text-[11px] text-gray-400">{timeAgo(c.created_at)}</span>
                      <button className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">ถูกใจ</button>
                      <button className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">ตอบกลับ</button>
                      {c.employee_id === user?.id && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all text-[11px] font-semibold"
                        >
                          ลบ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2.5 bg-white dark:bg-gray-900">
              <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                ) : (
                  <span className="material-icons-round text-gray-400 text-lg">person</span>
                )}
              </div>
              <div className="flex-1 flex items-center bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-transparent focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <input
                  type="text"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !submittingComment && submitComment()}
                  placeholder="เขียนความคิดเห็น..."
                  className="flex-1 bg-transparent px-4 py-2.5 text-[14px] text-gray-900 dark:text-white focus:outline-none placeholder-gray-400"
                  disabled={submittingComment}
                />
                {commentText.trim() && (
                  <button onClick={submitComment} disabled={submittingComment} className="pr-3 text-primary hover:text-primary-hover disabled:opacity-40 transition-colors">
                    <span className="material-icons-round text-xl">{submittingComment ? 'autorenew' : 'send'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Animations ═══ */}
      <style>{`
        @keyframes commentSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (min-width: 768px) {
          @keyframes commentSlideUp {
            from { transform: translate(-50%, -45%); opacity: 0; }
            to { transform: translate(-50%, -50%); opacity: 1; }
          }
        }
        @keyframes likeScale {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        @keyframes emojiPickerIn {
          0% { opacity: 0; transform: scale(0.5) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes emojiPopIn {
          0% { opacity: 0; transform: scale(0) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes emojiWiggle {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-4px) rotate(-6deg); }
          50% { transform: translateY(0) rotate(0deg); }
          75% { transform: translateY(-3px) rotate(5deg); }
        }
        @keyframes tooltipFade {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes lightboxFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      <BottomNav />
    </div>
  );
};

export default NewsScreen;