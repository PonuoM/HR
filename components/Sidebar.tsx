import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SIDEBAR_NAV_ITEMS, SIDEBAR_ADMIN_ITEMS } from '../data';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user: authUser, isAdmin, logout } = useAuth();

    const toggle = () => {
        onToggle();
    };

    return (
        <aside
            className={`hidden md:flex flex-col bg-white dark:bg-gray-900 h-screen border-r border-gray-200 dark:border-gray-800 fixed left-0 top-0 z-30 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-[72px]' : 'w-64'
                }`}
        >
            {/* Logo + Toggle */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'justify-center w-full' : ''}`}>
                    <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-primary/30 shrink-0">
                        HR
                    </div>
                    {!isCollapsed && (
                        <div className="whitespace-nowrap">
                            <h1 className="font-bold text-gray-900 dark:text-white">HR Connect</h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Mobile</p>
                        </div>
                    )}
                </div>
                {!isCollapsed && (
                    <button
                        onClick={toggle}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                        title="ย่อเมนู"
                    >
                        <span className="material-icons-round text-xl">chevron_left</span>
                    </button>
                )}
            </div>

            {/* Expand button when collapsed */}
            {isCollapsed && (
                <div className="px-2 pt-3 pb-1">
                    <button
                        onClick={toggle}
                        className="w-full flex items-center justify-center p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary transition-colors"
                        title="ขยายเมนู"
                    >
                        <span className="material-icons-round text-xl">chevron_right</span>
                    </button>
                </div>
            )}

            {/* Main Nav */}
            <nav className="flex-1 p-2 overflow-y-auto">
                <ul className="space-y-1">
                    {SIDEBAR_NAV_ITEMS.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <li key={item.path}>
                                <button
                                    onClick={() => navigate(item.path)}
                                    title={isCollapsed ? item.label : undefined}
                                    className={`w-full flex items-center gap-3 rounded-xl text-left transition-all ${isCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'
                                        } ${isActive
                                            ? 'bg-primary/10 text-primary font-semibold'
                                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                        }`}
                                >
                                    <span className="material-icons-round text-xl shrink-0">{item.icon}</span>
                                    {!isCollapsed && <span className="text-sm whitespace-nowrap">{item.label}</span>}
                                </button>
                            </li>
                        );
                    })}
                </ul>

                {/* Admin Section */}
                {isAdmin && (
                    <>
                        <div className={`mt-6 mb-2 ${isCollapsed ? 'flex justify-center' : 'px-4'}`}>
                            {isCollapsed ? (
                                <div className="w-6 h-px bg-gray-200 dark:bg-gray-700"></div>
                            ) : (
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Admin Panel</span>
                            )}
                        </div>
                        <ul className="space-y-1">
                            {SIDEBAR_ADMIN_ITEMS.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <li key={item.path}>
                                        <button
                                            onClick={() => navigate(item.path)}
                                            title={isCollapsed ? item.label : undefined}
                                            className={`w-full flex items-center gap-3 rounded-xl text-left transition-all ${isCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'
                                                } ${isActive
                                                    ? 'bg-primary/10 text-primary font-semibold'
                                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                }`}
                                        >
                                            <span className="material-icons-round text-xl shrink-0">{item.icon}</span>
                                            {!isCollapsed && <span className="text-sm whitespace-nowrap">{item.label}</span>}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </nav>

            {/* User Footer */}
            <div className="p-3 border-t border-gray-100 dark:border-gray-800">
                <button
                    onClick={() => navigate('/profile')}
                    title={isCollapsed ? (authUser?.name || '') : undefined}
                    className={`w-full flex items-center gap-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${isCollapsed ? 'justify-center p-2' : 'px-3 py-3'
                        }`}
                >
                    <img
                        src={authUser?.avatar || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23e2e8f0'/%3E%3Ccircle cx='50' cy='38' r='16' fill='%2394a3b8'/%3E%3Cellipse cx='50' cy='75' rx='28' ry='20' fill='%2394a3b8'/%3E%3C/svg%3E"}
                        onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23e2e8f0'/%3E%3Ccircle cx='50' cy='38' r='16' fill='%2394a3b8'/%3E%3Cellipse cx='50' cy='75' rx='28' ry='20' fill='%2394a3b8'/%3E%3C/svg%3E"; }}
                        className="w-9 h-9 rounded-full object-cover shrink-0"
                        alt="avatar"
                    />
                    {!isCollapsed && (
                        <>
                            <div className="text-left flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{authUser?.name || ''}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{authUser?.position || ''}</p>
                            </div>
                        </>
                    )}
                </button>
                {/* Logout */}
                <button
                    onClick={() => { logout(); navigate('/login', { replace: true }); }}
                    title={isCollapsed ? 'ออกจากระบบ' : undefined}
                    className={`w-full flex items-center gap-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mt-1 ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2.5'
                        }`}
                >
                    <span className="material-icons-round text-xl shrink-0">logout</span>
                    {!isCollapsed && <span className="text-sm font-medium">ออกจากระบบ</span>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;