import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE, validateSession, logoutSession } from '../services/api';
import { getDeviceFingerprint } from '../services/deviceFingerprint';

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
    company_id: number;
    is_superadmin: number;
}

interface Company {
    id: number;
    code: string;
    name: string;
    logo_url: string | null;
}

interface AuthContextValue {
    user: AuthUser | null;
    company: Company | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    loading: boolean;
    login: (employeeId: string, password: string) => Promise<{ device_warning?: string }>;
    logout: () => void;
    updateUser: (updates: Partial<AuthUser>) => void;
    setActiveCompany: (company: Company) => void;
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
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);
    const sessionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Restore session from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.user) {
                    setUser(parsed.user);
                }
                if (parsed?.company) {
                    setCompany(parsed.company);
                }
            }
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
        setLoading(false);
    }, []);

    // ─── Session Validation Polling (Layer 2) ───
    // Check every 30 seconds if our session is still valid
    // If another device logs in, our session gets invalidated
    useEffect(() => {
        if (!user) {
            // Not logged in, stop polling
            if (sessionCheckRef.current) {
                clearInterval(sessionCheckRef.current);
                sessionCheckRef.current = null;
            }
            return;
        }

        const checkSession = async () => {
            try {
                const result = await validateSession();
                if (result && result.valid === false) {
                    // Session was explicitly invalidated by another login
                    setUser(null);
                    setCompany(null);
                    localStorage.removeItem(STORAGE_KEY);
                    alert('⚠️ บัญชีของคุณถูกเข้าสู่ระบบจากอุปกรณ์อื่น\nกรุณาเข้าสู่ระบบใหม่');
                    window.location.href = '/login';
                }
            } catch {
                // Server error (500, network, table not found) → ignore silently
                // Don't kick user out for server-side issues
            }
        };

        // Start polling
        sessionCheckRef.current = setInterval(checkSession, 30000); // every 30 seconds

        return () => {
            if (sessionCheckRef.current) {
                clearInterval(sessionCheckRef.current);
            }
        };
    }, [user]);

    const login = useCallback(async (employeeId: string, password: string) => {
        // Get device fingerprint for device binding
        let deviceFp: string | undefined;
        try {
            deviceFp = await getDeviceFingerprint();
        } catch {
            // Fingerprint generation failed, proceed without it
        }

        const res = await fetch(`${API_BASE}/auth.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employee_id: employeeId,
                password,
                device_fingerprint: deviceFp || null,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
        }

        setUser(data.user);
        setCompany(data.company || null);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            user: data.user,
            company: data.company,
            token: data.token,
        }));

        return { device_warning: data.device_warning };
    }, []);

    const logout = useCallback(async () => {
        // Invalidate session on server
        try {
            await logoutSession();
        } catch { /* ignore */ }
        setUser(null);
        setCompany(null);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    // Allow superadmin to switch active company
    const setActiveCompany = useCallback((newCompany: Company) => {
        setCompany(newCompany);
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                parsed.company = newCompany;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            }
        } catch { /* ignore */ }
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
            company,
            isAuthenticated: !!user,
            isAdmin: !!user && user.is_admin === 1,
            isSuperAdmin: !!user && (user.is_superadmin === 1 || user.is_superadmin === (1 as any)),
            loading,
            login,
            logout,
            updateUser,
            setActiveCompany,
        }}>
            {children}
        </AuthContext.Provider>
    );
};
