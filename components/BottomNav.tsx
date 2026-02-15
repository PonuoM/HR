import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BOTTOM_NAV_ITEMS } from '../data';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
              <span className={`material-icons-round ${isActive ? 'text-2xl' : 'text-xl'}`}>{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;