import { useState, useEffect, useCallback } from 'react';
import { getLatestNewsId } from '../services/api';

export function useNewsNotification() {
    const [hasNewNews, setHasNewNews] = useState(false);
    const [newCategories, setNewCategories] = useState<string[]>([]);

    useEffect(() => {
        const checkNews = async () => {
            try {
                const res = await getLatestNewsId();
                if (res) {
                    const lastSeenStr = localStorage.getItem('last_seen_news_state');
                    const lastSeen = lastSeenStr ? JSON.parse(lastSeenStr) : { global: 0, categories: {} };
                    
                    let hasNew = false;
                    const newlyUpdatedCats: string[] = [];
                    
                    if (res.categories) {
                        for (const [catName, maxId] of Object.entries(res.categories)) {
                            const seenId = (lastSeen.categories && lastSeen.categories[catName]) || lastSeen.global || 0; 
                            if (maxId > seenId) {
                                newlyUpdatedCats.push(catName);
                            }
                        }
                    }
                    
                    hasNew = newlyUpdatedCats.length > 0;
                    
                    setHasNewNews(hasNew);
                    setNewCategories(newlyUpdatedCats);
                }
            } catch (err) {
                console.error('Failed to fetch latest news id', err);
            }
        };

        checkNews();
        
        // Check every 5 seconds for near real-time updates
        const interval = setInterval(checkNews, 5000);
        
        // Listen for sync event from other components
        window.addEventListener('news_seen_updated', checkNews);
        
        return () => {
            clearInterval(interval);
            window.removeEventListener('news_seen_updated', checkNews);
        };
    }, []);

    const markAsSeen = useCallback((maxId: number, category?: string | null) => {
        const lastSeenStr = localStorage.getItem('last_seen_news_state');
        const lastSeen = lastSeenStr ? JSON.parse(lastSeenStr) : { global: 0, categories: {} };
        
        if (category) {
            lastSeen.categories[category] = Math.max(lastSeen.categories[category] || 0, maxId);
        } else {
            lastSeen.global = Math.max(lastSeen.global || 0, maxId);
            // Copy global to all specific categories as well so they are considered seen
            if (!lastSeen.categories) lastSeen.categories = {};
        }
        
        localStorage.setItem('last_seen_news_state', JSON.stringify(lastSeen));
        
        // Optimistic UI update
        if (!category) {
           setHasNewNews(false);
           setNewCategories([]);
        } else {
           setNewCategories(prev => {
               const next = prev.filter(c => c !== category);
               if (next.length === 0) setHasNewNews(false);
               return next;
           });
        }
        
        // Notify other instances of the hook to re-fetch/sync state
        window.dispatchEvent(new Event('news_seen_updated'));
    }, []);

    return { hasNewNews, newCategories, markAsSeen };
}
