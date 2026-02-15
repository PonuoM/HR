import { useState, useEffect } from 'react';

/**
 * Generic data-fetching hook.
 * Calls `fetcher()` on mount (and whenever `deps` change),
 * and exposes { data, loading, error, refetch }.
 */
export function useApi<T>(
    fetcher: () => Promise<T>,
    deps: any[] = []
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetcher();
            setData(result);
        } catch (err: any) {
            setError(err.message || 'เกิดข้อผิดพลาด');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, deps);

    return { data, loading, error, refetch: load };
}
