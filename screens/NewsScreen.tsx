import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useApi } from '../hooks/useApi';
import { getNews, toggleNewsLike, getNewsComments, addNewsComment, deleteNewsComment } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';

const NewsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: allNews, loading, refetch } = useApi(() => getNews(user?.id), [user?.id]);

  // Local like state for optimistic UI
  const [likedMap, setLikedMap] = useState<Record<number, boolean>>({});
  const [likeCountMap, setLikeCountMap] = useState<Record<number, number>>({});

  // Expanded text state
  const [expandedPosts, setExpandedPosts] = useState<Set<number>>(new Set());

  // Comment drawer state
  const [openCommentId, setOpenCommentId] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Split pinned vs regular articles from DB data
  const pinnedNews = allNews?.find((a: any) => a.is_pinned) || null;
  const articles = allNews?.filter((a: any) => !a.is_pinned) || [];

  // Helpers
  const isLiked = (article: any) => likedMap[article.id] ?? article.user_liked;
  const getLikes = (article: any) => likeCountMap[article.id] ?? (article.likes || 0);

  const toggleExpand = (id: number) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleLike = async (article: any) => {
    if (!user?.id) return;
    const currentlyLiked = isLiked(article);
    setLikedMap(m => ({ ...m, [article.id]: !currentlyLiked }));
    setLikeCountMap(m => ({ ...m, [article.id]: getLikes(article) + (currentlyLiked ? -1 : 1) }));
    try {
      await toggleNewsLike(article.id, user.id);
    } catch {
      setLikedMap(m => ({ ...m, [article.id]: currentlyLiked }));
      setLikeCountMap(m => ({ ...m, [article.id]: getLikes(article) }));
    }
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

  // ── Render a single post card (Facebook style) ──
  const renderPost = (article: any, isPinned = false) => {
    const likes = getLikes(article);
    const liked = isLiked(article);
    const commentCount = article.comments || 0;
    const isExpanded = expandedPosts.has(article.id);
    const content = article.content || '';
    const shouldTruncate = content.length > 200;

    return (
      <article key={article.id} className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">

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
                  onClick={() => toggleExpand(article.id)}
                  className="text-gray-500 dark:text-gray-400 hover:underline text-[15px] font-medium mt-0.5"
                >
                  {isExpanded ? 'แสดงน้อยลง' : 'ดูเพิ่มเติม'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Post Image (full width like FB) ── */}
        {article.image && (
          <div className="w-full bg-gray-100 dark:bg-gray-900">
            <img
              alt={article.title}
              className="w-full max-h-[500px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
              src={article.image}
              loading="lazy"
            />
          </div>
        )}

        {/* ── Reaction / Comment counts ── */}
        {(likes > 0 || commentCount > 0) && (
          <div className="px-4 pt-2.5 pb-1 flex items-center justify-between">
            {likes > 0 ? (
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1">
                  <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="text-white text-[10px]">❤️</span>
                  </span>
                  <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-[10px]">👍</span>
                  </span>
                </div>
                <span className="text-[13px] text-gray-500 dark:text-gray-400">{likes}</span>
              </div>
            ) : <div />}
            {commentCount > 0 && (
              <button
                onClick={() => openComments(article.id)}
                className="text-[13px] text-gray-500 dark:text-gray-400 hover:underline"
              >
                {commentCount} ความคิดเห็น
              </button>
            )}
          </div>
        )}

        {/* ── Divider ── */}
        <div className="mx-4 border-t border-gray-100 dark:border-gray-700/60" />

        {/* ── Action Bar (Like / Comment / Share) ── */}
        <div className="px-2 py-1 flex items-center">
          <button
            onClick={() => handleLike(article)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-colors font-medium text-[14px]
              ${liked
                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
          >
            <span className={`material-icons-round text-xl ${liked ? 'animate-[likeScale_0.3s_ease-out]' : ''}`}>
              {liked ? 'favorite' : 'favorite_border'}
            </span>
            <span>ถูกใจ</span>
          </button>

          <button
            onClick={() => openComments(article.id)}
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

  return (
    <div className="pt-14 md:pt-8 pb-24 md:pb-8 min-h-full bg-gray-100 dark:bg-gray-950">

      {/* ═══ Header Bar (Facebook-style) ═══ */}
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

        {/* Loading */}
        {loading && (
          <div className="text-center py-20">
            <span className="material-icons-round animate-spin text-4xl text-primary">autorenew</span>
            <p className="text-sm text-gray-400 mt-3">กำลังโหลดข่าวสาร...</p>
          </div>
        )}

        {/* Pinned Post */}
        {!loading && pinnedNews && renderPost(pinnedNews, true)}

        {/* Feed Posts */}
        {!loading && articles.map((article: any) => renderPost(article))}

        {/* Empty state */}
        {!loading && !pinnedNews && articles.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl">
            <span className="material-icons-round text-6xl text-gray-300 dark:text-gray-600 block mb-3">feed</span>
            <p className="text-gray-500 font-medium">ยังไม่มีข่าวสาร</p>
            <p className="text-sm text-gray-400 mt-1">ข่าวจากบริษัทจะแสดงที่นี่</p>
          </div>
        )}
      </div>

      {/* ═══ Comments Bottom Sheet ═══ */}
      {openCommentId !== null && (
        <div className="fixed inset-0 z-50" onClick={() => setOpenCommentId(null)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 md:left-1/2 md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:max-w-lg md:rounded-2xl bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl max-h-[85vh] md:max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'commentSlideUp 0.3s ease-out' }}
          >
            {/* Handle bar (mobile) */}
            <div className="md:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-[16px] text-gray-900 dark:text-white">ความคิดเห็น</h3>
              <button onClick={() => setOpenCommentId(null)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors">
                <span className="material-icons-round text-lg">close</span>
              </button>
            </div>

            {/* Comments list */}
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

            {/* Comment input (FB-style) */}
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
                  <button
                    onClick={submitComment}
                    disabled={submittingComment}
                    className="pr-3 text-primary hover:text-primary-hover disabled:opacity-40 transition-colors"
                  >
                    <span className="material-icons-round text-xl">
                      {submittingComment ? 'autorenew' : 'send'}
                    </span>
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
      `}</style>

      <BottomNav />
    </div>
  );
};

export default NewsScreen;