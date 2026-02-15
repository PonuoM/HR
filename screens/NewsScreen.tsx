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

  const handleLike = async (article: any) => {
    if (!user?.id) return;
    const currentlyLiked = isLiked(article);
    // Optimistic update
    setLikedMap(m => ({ ...m, [article.id]: !currentlyLiked }));
    setLikeCountMap(m => ({ ...m, [article.id]: getLikes(article) + (currentlyLiked ? -1 : 1) }));
    try {
      await toggleNewsLike(article.id, user.id);
    } catch {
      // Revert on error
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
      // Reload comments
      const data = await getNewsComments(openCommentId);
      setComments(data);
      refetch(); // Update comment counts
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
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} วันที่แล้ว`;
    return d.toLocaleDateString('th-TH');
  };

  return (
    <div className="pt-4 md:pt-8 pb-24 md:pb-8 px-4 md:px-8 max-w-7xl mx-auto min-h-full">
      <header className="mb-6 pt-4 flex justify-between items-center sticky top-0 z-10 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm pb-2 md:relative md:bg-transparent md:backdrop-blur-none">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">ประชาสัมพันธ์</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">ข่าวสารและประกาศจากบริษัท</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative p-2 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <span className="material-icons-round text-gray-600 dark:text-gray-300">search</span>
          </button>
        </div>
      </header>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-gray-400"><span className="material-icons-round animate-spin text-3xl">autorenew</span></div>
      )}

      {/* Pinned News */}
      {!loading && pinnedNews && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-icons-round text-primary text-sm -rotate-45">push_pin</span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">ปักหมุด</h3>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group cursor-pointer hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>
            <div className="flex gap-4">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl overflow-hidden flex-shrink-0">
                <img alt="Pinned" className="w-full h-full object-cover" src={pinnedNews.image} />
              </div>
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    {pinnedNews.is_urgent && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 mb-1 inline-block">ด่วน</span>
                    )}
                    <span className="text-xs text-gray-400">{pinnedNews.published_at ? new Date(pinnedNews.published_at).toLocaleDateString('th-TH') : ''}</span>
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-base md:text-xl line-clamp-2 leading-tight md:mt-1">{pinnedNews.title}</h4>
                  <p className="hidden md:block text-sm text-gray-500 mt-2 line-clamp-2">{pinnedNews.content}</p>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => handleLike(pinnedNews)}
                    className={`flex items-center gap-1 text-xs transition-colors ${isLiked(pinnedNews) ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
                  >
                    <span className="material-icons-round text-[14px]">{isLiked(pinnedNews) ? 'favorite' : 'favorite_border'}</span>
                    <span>{getLikes(pinnedNews)}</span>
                  </button>
                  <button
                    onClick={() => openComments(pinnedNews.id)}
                    className="flex items-center gap-1 text-gray-500 text-xs hover:text-primary transition-colors"
                  >
                    <span className="material-icons-round text-[14px]">comment</span>
                    <span>{pinnedNews.comments || 0}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Latest Updates */}
      {!loading && (
        <section className="pb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">อัพเดทล่าสุด</h3>
            <div className="flex gap-2">
              <button className="p-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                <span className="material-icons-round text-gray-500 text-lg">filter_list</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map((article: any) => (
              <div key={article.id} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center bg-gray-50 text-gray-400 text-xs font-bold">{article.department_code || (article.department || '').substring(0, 2)}</div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{article.department}</p>
                    <p className="text-xs text-gray-500">{article.published_at ? new Date(article.published_at).toLocaleDateString('th-TH') : ''}</p>
                  </div>
                  <button className="ml-auto text-gray-400">
                    <span className="material-icons-round">more_horiz</span>
                  </button>
                </div>
                <div className="px-4 pb-2">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">{article.title}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">
                    {article.content}
                  </p>
                  {article.content && article.content.length > 100 && (
                    <span className="text-primary text-sm font-medium cursor-pointer">อ่านเพิ่มเติม</span>
                  )}
                </div>
                {article.image && (
                  <div className="relative h-48 mt-2 mx-4 rounded-xl overflow-hidden">
                    <img alt={article.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" src={article.image} />
                  </div>
                )}
                <div className="px-4 py-3 mt-1 flex items-center justify-between">
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleLike(article)}
                      className={`flex items-center gap-1.5 transition-colors group ${isLiked(article) ? 'text-red-500' : 'text-gray-600 dark:text-gray-400 hover:text-red-500'}`}
                    >
                      <span className={`material-icons-round text-xl ${isLiked(article) ? 'text-red-500 animate-[pulse_0.3s]' : 'group-hover:text-red-500'}`}>
                        {isLiked(article) ? 'favorite' : 'favorite_border'}
                      </span>
                      <span className="text-sm font-medium">{getLikes(article)}</span>
                    </button>
                    <button
                      onClick={() => openComments(article.id)}
                      className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:text-primary transition-colors group"
                    >
                      <span className="material-icons-round text-xl group-hover:text-primary">chat_bubble_outline</span>
                      <span className="text-sm font-medium">{article.comments || 0}</span>
                    </button>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <span className="material-icons-round">share</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Comments Drawer */}
      {openCommentId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpenCommentId(null)}>
          <div
            className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'toast-scale-in 0.2s ease-out' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white">ความคิดเห็น</h3>
              <button onClick={() => setOpenCommentId(null)} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                <span className="material-icons-round">close</span>
              </button>
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
              {loadingComments && (
                <div className="text-center py-8 text-gray-400">
                  <span className="material-icons-round animate-spin">autorenew</span>
                </div>
              )}
              {!loadingComments && comments.length === 0 && (
                <div className="text-center py-8">
                  <span className="material-icons-round text-4xl text-gray-300 dark:text-gray-600 block mb-2">chat_bubble_outline</span>
                  <p className="text-sm text-gray-400">ยังไม่มีความคิดเห็น</p>
                  <p className="text-xs text-gray-400 mt-1">เป็นคนแรกที่แสดงความคิดเห็น!</p>
                </div>
              )}
              {comments.map((c: any) => (
                <div key={c.id} className="flex gap-3 group">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
                    {c.avatar ? (
                      <img src={c.avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="material-icons-round text-lg">person</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{c.employee_name || c.employee_id}</span>
                      <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
                      {c.employee_id === user?.id && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="ml-auto opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-0.5"
                        >
                          <span className="material-icons-round text-sm">close</span>
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 break-words">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Comment input */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                ) : (
                  <span className="material-icons-round text-lg">person</span>
                )}
              </div>
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !submittingComment && submitComment()}
                placeholder="เขียนความคิดเห็น..."
                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                disabled={submittingComment}
              />
              <button
                onClick={submitComment}
                disabled={!commentText.trim() || submittingComment}
                className="p-2 rounded-full bg-primary text-white disabled:opacity-40 hover:bg-primary-hover transition-colors"
              >
                <span className="material-icons-round text-lg">
                  {submittingComment ? 'autorenew' : 'send'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default NewsScreen;