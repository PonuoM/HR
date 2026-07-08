import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ImageLightbox from '../components/ImageLightbox';

const NewsDetailScreen: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const article = location.state?.article;
    const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

    if (!article) {
        return (
            <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark">
                <div className="flex items-center p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-500 hover:text-primary transition-colors">
                        <span className="material-icons-round text-2xl">arrow_back</span>
                    </button>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white ml-2">รายละเอียดประกาศ</h1>
                </div>
                <div className="flex-1 flex items-center justify-center text-gray-500">
                    ไม่พบข้อมูลประกาศ
                </div>
            </div>
        );
    }

    let urls: string[] = [];
    if (article.image) {
        try {
            const parsed = JSON.parse(article.image);
            urls = Array.isArray(parsed) ? parsed : [article.image];
        } catch {
            if (typeof article.image === 'string' && article.image.startsWith('[')) {
                urls = [];
            } else {
                urls = [article.image];
            }
        }
    }

    // Safety fallback for date
    const formattedDate = article.published_at ? new Date(article.published_at).toLocaleString('th-TH') : '';
    const authorName = article.employee_name || article.department || 'แอดมิน';

    return (
        <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark pb-safe">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 md:relative md:border-none md:bg-transparent md:dark:bg-transparent pt-4 md:pt-4">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <button 
                        onClick={() => {
                            if (window.history.state && window.history.state.idx > 0) {
                                navigate(-1);
                            } else {
                                navigate('/news', { replace: true });
                            }
                        }} 
                        className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <span className="material-icons-round text-gray-700 dark:text-gray-300">arrow_back</span>
                    </button>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">รายละเอียดประกาศ</h1>
                </div>
            </header>
            
            <div className="flex-1 overflow-y-auto">
                <div className="bg-white dark:bg-gray-800 p-4 mb-2 max-w-3xl mx-auto md:my-6 md:rounded-2xl md:shadow-sm md:p-6 border border-transparent md:border-gray-100 dark:md:border-gray-700/60">
                    {/* Author Header */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full border-2 border-gray-100 dark:border-gray-700 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 text-primary font-bold overflow-hidden shrink-0">
                            {article.avatar ? (
                                <img src={article.avatar} alt="avatar" className="w-full h-full object-cover rounded-full" />
                            ) : (
                                <span>{(authorName).substring(0, 2)}</span>
                            )}
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900 dark:text-white text-[16px]">
                                {authorName}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                                {formattedDate}
                            </div>
                        </div>
                    </div>
                    
                    {/* Content */}
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-3">{article.title}</h2>
                    {article.content && (
                        <p className="text-[15px] md:text-base text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line mb-6">
                            {article.content}
                        </p>
                    )}

                    {/* Images */}
                    {urls.length > 0 && (
                        <div className="flex flex-col gap-4 mt-4">
                            {urls.map((u, i) => {
                                if (typeof u !== 'string') return null;
                                const isPdf = u.toLowerCase().endsWith('.pdf');
                                if (isPdf) {
                                    return (
                                        <a
                                            key={i}
                                            href={u}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto h-48 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            <span className="material-icons-round text-5xl text-red-500 mb-2">picture_as_pdf</span>
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">เปิดดูเอกสาร PDF</span>
                                        </a>
                                    )
                                }
                                return (
                                    <div key={i} className="w-full flex justify-center bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-2">
                                        <img
                                            src={u}
                                            alt={`รูปภาพ ${i + 1}`}
                                            onClick={() => setLightbox({ urls, index: i })}
                                            className="w-full max-w-2xl max-h-[600px] h-auto rounded-xl object-contain shadow-sm cursor-pointer hover:opacity-95 transition-opacity"
                                            loading="lazy"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Image Lightbox */}
            {lightbox && (
                <ImageLightbox
                    urls={lightbox.urls}
                    startIndex={lightbox.index}
                    onClose={() => setLightbox(null)}
                />
            )}
        </div>
    );
};

export default NewsDetailScreen;
