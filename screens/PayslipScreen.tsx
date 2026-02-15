import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Payslip } from '../types';
import { useApi } from '../hooks/useApi';
import { getPayslips } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const SEEN_KEY = 'hr_payslips_seen';

const getSeenIds = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch { return new Set(); }
};

const markSeen = (id: string): Set<string> => {
  const seen = getSeenIds();
  seen.add(id);
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  return seen;
};

const PayslipScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [selectedSlip, setSelectedSlip] = useState<Payslip | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(getSeenIds);
  const { data: rawPayslips, loading } = useApi(() => getPayslips(authUser?.id || ''), [authUser?.id]);

  // Map DB fields to frontend Payslip type
  const payslips: Payslip[] = (rawPayslips || []).map((p: any) => ({
    id: String(p.id),
    employeeId: p.employee_id,
    employeeName: p.employee_name,
    month: p.month,
    year: p.year,
    amount: p.amount,
    status: p.status,
    sentAt: p.sent_at,
    imageUrl: p.image_url,
  }));

  const handleSlipClick = useCallback((slip: Payslip) => {
    setSelectedSlip(slip);
    // Mark as seen in localStorage
    const updated = markSeen(slip.id);
    setSeenIds(new Set(updated));
  }, []);

  const isNew = (slip: Payslip) => !seenIds.has(slip.id);

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark relative">
      <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 shadow-sm border-b border-gray-100 dark:border-gray-800 pt-4 md:pt-4 sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
          <span className="material-icons-round">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">สลิปเงินเดือน</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
        {/* Banner / Info */}
        <div className="bg-primary/10 rounded-2xl p-4 flex items-start gap-4 mb-6 border border-primary/20">
          <div className="p-2 bg-primary rounded-lg text-white">
            <span className="material-icons-round text-xl">lock</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-primary mb-1">เอกสารลับเฉพาะบุคคล</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300">กรุณาเก็บรักษาข้อมูลนี้เป็นความลับ ห้ามเผยแพร่ต่อบุคคลภายนอก</p>
          </div>
        </div>

        {/* List by Year */}
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">ปี 2024</h2>
        <div className="space-y-3">
          {payslips.map((slip) => {
            const slipIsNew = isNew(slip);
            return (
              <button
                key={slip.id}
                onClick={() => handleSlipClick(slip)}
                className="w-full bg-white dark:bg-gray-800 rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all group relative overflow-hidden"
              >
                {/* New Indicator */}
                {slipIsNew && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-red-500 text-white text-[9px] font-bold px-2 py-1 rounded-bl-lg shadow-sm">ใหม่</div>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center border border-gray-200 dark:border-gray-600 shrink-0">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{slip.month}</span>
                    <span className="material-icons-round text-gray-400 text-lg">receipt</span>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900 dark:text-white text-base">เงินเดือน {slip.month}</p>
                    <p className="text-xs text-gray-500">ส่งเมื่อ: {new Date(slip.sentAt).toLocaleDateString('th-TH')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {slipIsNew ? (
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                  ) : (
                    <span className="material-icons-round text-green-500 text-lg">check_circle</span>
                  )}
                  <span className="material-icons-round text-gray-300 group-hover:text-primary transition-colors">chevron_right</span>
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {/* Image Modal */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">สลิปเงินเดือน: {selectedSlip.month} {selectedSlip.year}</h3>
                <p className="text-xs text-gray-500">{selectedSlip.employeeName}</p>
              </div>
              <button onClick={() => setSelectedSlip(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <span className="material-icons-round text-gray-500">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950 p-4 flex items-center justify-center">
              <img src={selectedSlip.imageUrl} alt="Payslip" className="w-full h-auto shadow-lg rounded" />
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
              <button className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <span className="material-icons-round text-lg">download</span>
                บันทึกรูปภาพ
              </button>
              <button className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30">
                <span className="material-icons-round text-lg">share</span>
                แชร์
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayslipScreen;