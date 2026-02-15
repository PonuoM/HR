import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getNews } from '../../services/api';

const AdminContentScreen: React.FC = () => {
    const navigate = useNavigate();
    const { data: rawNews, loading } = useApi(() => getNews(), []);

    // Map news articles from DB
    const contentPosts = (rawNews || []).map((post: any) => ({
        id: post.id,
        title: post.title,
        content: post.content || '',
        image: post.image || `https://picsum.photos/600/400?random=${post.id}`,
        isPinned: !!post.is_pinned,
        publishedAt: post.published_at ? new Date(post.published_at).toLocaleDateString('th-TH') : '',
        views: post.views || 0,
        likes: post.likes || 0,
    }));

    // Compute stats from data
    const contentStats = {
        totalPosts: contentPosts.length,
        pinnedPosts: contentPosts.filter((p: any) => p.isPinned).length,
        totalViews: contentPosts.reduce((sum: number, p: any) => sum + (p.views || 0), 0),
    };
    return (
        <div className="pt-6 md:pt-8 pb-8 px-4 md:px-8 max-w-[1600px] mx-auto min-h-full">
            <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/profile')} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
                        <span className="material-icons-round">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">จัดการข่าวสาร</h1>
                        <p className="text-xs md:text-base text-gray-500 dark:text-gray-400">ประชาสัมพันธ์และประกาศภายในองค์กร</p>
                    </div>
                </div>
                <button className="w-full md:w-auto bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary/30 transition-all active:scale-95">
                    <span className="material-icons-round text-xl">post_add</span>
                    สร้างประกาศ
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* News List */}
                <div className="lg:col-span-2 space-y-4">
                    {contentPosts.map((post: any) => (
                        <div key={post.id} className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border ${post.isPinned ? 'border-l-4 border-l-primary border-y-gray-100 border-r-gray-100 dark:border-y-gray-700 dark:border-r-gray-700' : 'border-gray-100 dark:border-gray-700'} flex flex-col md:flex-row gap-4`}>
                            <div className={`w-full ${post.isPinned ? 'md:w-48 h-32' : 'md:w-32 h-32 md:h-24'} bg-gray-200 rounded-lg overflow-hidden shrink-0`}>
                                <img src={post.image} className="w-full h-full object-cover" alt="news" />
                            </div>
                            <div className="flex-1 py-1 flex flex-col justify-between">
                                <div>
                                    {post.isPinned && (
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wide">ปักหมุด</span>
                                            <span className="text-xs text-gray-400">{post.publishedAt}</span>
                                        </div>
                                    )}
                                    <h3 className={`${post.isPinned ? 'text-lg' : 'text-base'} font-bold text-gray-900 dark:text-white line-clamp-1`}>{post.title}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">{post.content}</p>
                                </div>
                                <div className="flex items-center justify-between mt-4 md:mt-2">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                            <span className="material-icons-round text-sm">visibility</span>
                                            {post.views}
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                            <span className="material-icons-round text-sm">thumb_up</span>
                                            {post.likes}
                                        </div>
                                        {!post.isPinned && <span className="text-xs text-gray-400">{post.publishedAt}</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="text-gray-400 hover:text-primary bg-gray-50 dark:bg-gray-700/50 p-1.5 rounded-lg"><span className="material-icons-round">edit</span></button>
                                        <button className="text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-gray-700/50 p-1.5 rounded-lg"><span className="material-icons-round">delete</span></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Sidebar / Stats */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4">สถานะการเผยแพร่</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">โพสต์ทั้งหมด</span>
                                <span className="font-bold text-gray-900 dark:text-white">{contentStats.totalPosts}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">ปักหมุด</span>
                                <span className="font-bold text-primary">{contentStats.pinnedPosts}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">ยอดคนอ่านรวม</span>
                                <span className="font-bold text-gray-900 dark:text-white">{contentStats.totalViews.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminContentScreen;