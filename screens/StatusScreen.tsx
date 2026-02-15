import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_REQUEST_STATUS, APPROVAL_STEPS } from '../data';

const StatusScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-full bg-background-light dark:bg-background-dark font-display relative z-50 pb-20">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20 pt-4 md:pt-4 md:bg-white/95">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-primary flex items-center gap-1">
          <span className="material-icons-round">arrow_back_ios_new</span>
          <span className="hidden md:inline text-sm font-medium ml-1">กลับ</span>
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">ติดตามสถานะ</h1>
        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-primary opacity-0 pointer-events-none">
          <span className="material-icons-round">more_horiz</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-5 pb-32 w-full">
        <div className="max-w-2xl mx-auto w-full">
          {/* Status Card */}
          <div className="bg-primary/5 dark:bg-gray-800 p-6 md:p-8 rounded-2xl mb-8 border border-primary/10 dark:border-gray-700">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-xs font-medium text-primary uppercase tracking-wider mb-1 block">ประเภทคำขอ</span>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{MOCK_REQUEST_STATUS.type}</h2>
              </div>
              <div className="flex flex-col items-end">
                <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                  {MOCK_REQUEST_STATUS.statusLabel}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="bg-white dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
                  <span className="material-icons-round text-sm">calendar_today</span>
                  <span>ระยะเวลา</span>
                </div>
                <p className="font-semibold text-sm md:text-base">{MOCK_REQUEST_STATUS.dateRange}</p>
              </div>
              <div className="bg-white dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
                  <span className="material-icons-round text-sm">schedule</span>
                  <span>รวม</span>
                </div>
                <p className="font-semibold text-sm md:text-base">{MOCK_REQUEST_STATUS.totalDays}</p>
              </div>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-6 pl-1">เส้นเวลาการอนุมัติ</h3>

          <div className="relative pl-2">
            {/* Step 1: Submitted */}
            <div className="timeline-item relative flex gap-4 pb-10 group">
              <div className="absolute left-[19px] top-[40px] bottom-[-20px] w-0.5 bg-primary z-0"></div>
              <div className="relative z-10 w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/30 text-white">
                <span className="material-icons-round text-xl">check</span>
              </div>
              <div className="flex-1 pt-1 bg-white dark:bg-gray-800 md:p-4 md:rounded-xl md:border md:border-gray-100 md:dark:border-gray-700 md:ml-4">
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-gray-900 dark:text-white">ส่งคำขอแล้ว</h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">10 ต.ค.</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">คำขอของคุณถูกส่งเข้าระบบเรียบร้อยแล้ว</p>
              </div>
            </div>

            {/* Step 2: Supervisor (Active) */}
            <div className="timeline-item relative flex gap-4 pb-10">
              <div className="absolute left-[19px] top-[40px] bottom-[-24px] w-0.5 bg-gray-200 dark:bg-gray-700 z-0"></div>
              <div className="relative z-10 w-10 h-10 rounded-full bg-white dark:bg-gray-800 border-[3px] border-primary flex items-center justify-center shrink-0 shadow-sm">
                <span className="material-icons-round text-primary text-xl animate-pulse">hourglass_empty</span>
              </div>
              <div className="flex-1 pt-1 bg-white dark:bg-gray-800 md:p-4 md:rounded-xl md:border md:border-gray-100 md:dark:border-gray-700 md:ml-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">รอหัวหน้าอนุมัติ</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">รออนุมัติ</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                  <img alt="Supervisor" className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-600" src="https://picsum.photos/id/237/200/200" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">สมชาย ใจดี</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">ผู้จัดการฝ่ายการตลาด</p>
                  </div>
                  <button className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors">
                    <span className="material-icons-round text-lg">chat</span>
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2 italic">กำลังรอการอนุมัติ...</p>
              </div>
            </div>

            {/* Step 3: HR (Pending) */}
            <div className="timeline-item relative flex gap-4">
              <div className="relative z-10 w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0">
                <span className="material-icons-round text-gray-400 text-xl">lock</span>
              </div>
              <div className="flex-1 pt-1 opacity-50 bg-white dark:bg-gray-800 md:p-4 md:rounded-xl md:border md:border-gray-100 md:dark:border-gray-700 md:ml-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">รอ HR อนุมัติ</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">รอการอนุมัติจากหัวหน้างาน</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="absolute bottom-0 w-full bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 p-4 pb-8 backdrop-blur-lg bg-opacity-95 dark:bg-opacity-95 z-30 md:bg-transparent md:border-none md:pointer-events-none">
        <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto md:pointer-events-auto">
          <button className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 transition-colors md:shadow-sm md:bg-white md:dark:bg-gray-800 md:border md:border-red-100">
            <span className="material-icons-round text-lg">cancel</span>
            ยกเลิก
          </button>
          <button className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30">
            <span className="material-icons-round text-lg">edit</span>
            แก้ไขคำขอ
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusScreen;