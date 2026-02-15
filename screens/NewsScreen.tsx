import React from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useApi } from '../hooks/useApi';
import { getNews } from '../services/api';

const NewsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { data: allNews, loading } = useApi(() => getNews(), []);

  // Split pinned vs regular articles from DB data
  const pinnedNews = allNews?.find((a: any) => a.is_pinned) || null;
  const articles = allNews?.filter((a: any) => !a.is_pinned) || [];

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
                  <div className="flex items-center gap-1 text-gray-500 text-xs">
                    <span className="material-icons-round text-[14px]">favorite</span>
                    <span>{pinnedNews.likes || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500 text-xs">
                    <span className="material-icons-round text-[14px]">comment</span>
                    <span>{pinnedNews.comments || 0}</span>
                  </div>
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
                    <button className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:text-red-500 transition-colors group">
                      <span className="material-icons-round text-xl group-hover:text-red-500">favorite_border</span>
                      <span className="text-sm font-medium">{article.likes || 0}</span>
                    </button>
                    <button className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:text-primary transition-colors group">
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
      <BottomNav />
    </div>
  );
};

export default NewsScreen;