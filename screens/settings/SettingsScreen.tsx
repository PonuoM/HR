import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';

const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { confirm: showConfirm } = useToast();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('hr_dark_mode');
    if (saved !== null) return saved === 'true';
    return document.documentElement.classList.contains('dark');
  });


  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('hr_dark_mode', 'false');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('hr_dark_mode', 'true');
      setIsDarkMode(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
      <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 shadow-sm border-b border-gray-100 dark:border-gray-800 pt-4 md:pt-4 sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
          <span className="material-icons-round">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">การตั้งค่า</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-6">

        {/* Appearance */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-2">การแสดงผล</h2>
          <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center">
                  <span className="material-icons-round text-lg">dark_mode</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">โหมดกลางคืน</span>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${isDarkMode ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400 flex items-center justify-center">
                  <span className="material-icons-round text-lg">language</span>
                </div>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white block">ภาษา</span>
                  <span className="text-xs text-gray-400">จะเพิ่มภาษาอื่นในอนาคต</span>
                </div>
              </div>
              <span className="text-sm text-gray-400 dark:text-gray-500 font-medium px-3 py-1 rounded-lg bg-gray-50 dark:bg-gray-700">ไทย</span>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-2">การแจ้งเตือน</h2>
          <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400 flex items-center justify-center">
                  <span className="material-icons-round text-lg">notifications</span>
                </div>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white block">แจ้งเตือนทั่วไป</span>
                  <span className="text-xs text-gray-400">จะเปิดใช้งานในอนาคต</span>
                </div>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium px-3 py-1 rounded-lg bg-gray-50 dark:bg-gray-700">เร็วๆ นี้</span>
            </div>
          </div>
        </section>

        {/* Logout */}
        <section>
          <button
            onClick={async () => {
              if (await showConfirm({ message: 'ต้องการออกจากระบบ?', type: 'warning', confirmText: 'ออกจากระบบ' })) {
                logout();
                navigate('/login', { replace: true });
              }
            }}
            className="w-full p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center gap-2 text-red-500 font-semibold hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          >
            <span className="material-icons-round text-lg">logout</span>
            ออกจากระบบ
          </button>
        </section>

      </main>
    </div>
  );
};

export default SettingsScreen;