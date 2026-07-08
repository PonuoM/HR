import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BOTTOM_NAV_ITEMS } from '../data';
import { useNewsNotification } from '../hooks/useNewsNotification';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasNewNews } = useNewsNotification();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 pb-safe z-50">
      <div className="flex justify-around items-center h-16">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'}`}
            >
              <div className="relative flex items-center justify-center">
                <span className={`material-icons-round ${isActive ? 'text-2xl' : 'text-xl'}`}>{item.icon}</span>
                {item.path === '/news' && hasNewNews && (
                  <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-gray-900 animate-pulse"></span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;