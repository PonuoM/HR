import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getFaq } from '../../services/api';

const HelpScreen: React.FC = () => {
  const navigate = useNavigate();
  const { data: faqItems, loading } = useApi(() => getFaq(), []);

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
      <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 shadow-sm border-b border-gray-100 dark:border-gray-800 pt-4 md:pt-4 sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
          <span className="material-icons-round">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">ศูนย์ช่วยเหลือ</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-6">

        {/* Contact Support */}
        <section className="bg-primary rounded-2xl p-6 text-white shadow-lg shadow-primary/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
          <h2 className="text-xl font-bold mb-2">ติดปัญหาการใช้งาน?</h2>
          <p className="text-blue-100 text-sm mb-6">ทีม Support พร้อมช่วยเหลือคุณตลอดเวลาทำการ จันทร์ - ศุกร์</p>
          <div className="flex gap-3">
            <button className="flex-1 bg-white text-primary font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
              <span className="material-icons-round text-lg">call</span>
              โทรหาเรา
            </button>
            <button className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors border border-blue-500">
              <span className="material-icons-round text-lg">chat</span>
              แชทกับ HR
            </button>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-lg">คำถามที่พบบ่อย</h3>
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8 text-gray-400"><span className="material-icons-round animate-spin">autorenew</span></div>
            ) : (faqItems || []).map((item: any, index: number) => (
              <div key={item.id || index} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
                <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-2">{item.question || item.q}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.answer || item.a}</p>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
};

export default HelpScreen;