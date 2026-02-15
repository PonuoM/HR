import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../services/api';

interface AuthUser {
    id: string;
    name: string;
    email: string | null;
    avatar: string | null;
    department: string | null;
    position: string | null;
    employment_type: string | null;
    is_admin: number;
    is_active: number;
}

interface AuthContextValue {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    loading: boolean;
    login: (employeeId: string, password: string) => Promise<void>;
    logout: () => void;
    updateUser: (updates: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}

const STORAGE_KEY = 'hr_auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    // Restore session from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.user) {
                    setUser(parsed.user);
                }
            }
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
        setLoading(false);
    }, []);

    const login = useCallback(async (employeeId: string, password: string) => {
        const res = await fetch(`${API_BASE}/auth.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_id: employeeId, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
        }

        setUser(data.user);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: data.user, token: data.token }));
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    const updateUser = useCallback((updates: Partial<AuthUser>) => {
        setUser(prev => {
            if (!prev) return prev;
            const updated = { ...prev, ...updates };
            // Also update localStorage
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                parsed.user = updated;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            }
            return updated;
        });
    }, []);

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isAdmin: !!user && user.is_admin === 1,
            loading,
            login,
            logout,
            updateUser,
        }}>
            {children}
        </AuthContext.Provider>
    );
};
