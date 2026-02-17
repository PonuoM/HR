import React, { useState } from 'react';
import { API_BASE, getAuthHeaders } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../contexts/AuthContext';

const PasswordInput = ({ value, onChange, show, onToggle, placeholder }: {
  value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string;
}) => (
  <div className="relative">
    <input
      type={show ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 pr-10 focus:ring-2 focus:ring-primary/50 focus:outline-none dark:text-white text-sm"
    />
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
    >
      <span className="material-icons-round text-lg">{show ? 'visibility_off' : 'visibility'}</span>
    </button>
  </div>
);

const SecurityScreen: React.FC = () => {
  const navigate = useNavigate();
  const { toast, confirm: showConfirm } = useToast();
  const { user: authUser } = useAuth();

  // Password change
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- Change Password ---
  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      toast('กรุณากรอกข้อมูลให้ครบ', 'warning');
      return;
    }
    if (newPw.length < 4) {
      toast('รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร', 'warning');
      return;
    }
    if (newPw !== confirmPw) {
      toast('รหัสผ่านใหม่ไม่ตรงกัน', 'warning');
      return;
    }
    if (currentPw === newPw) {
      toast('รหัสผ่านใหม่ต้องไม่เหมือนรหัสเดิม', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/auth.php`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          employee_id: authUser?.id,
          current_password: currentPw,
          new_password: newPw,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
      toast('เปลี่ยนรหัสผ่านเรียบร้อย', 'success');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      toast(err.message || 'เกิดข้อผิดพลาด', 'error');
    }
  };


  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
      <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 shadow-sm border-b border-gray-100 dark:border-gray-800 pt-4 md:pt-4 sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
          <span className="material-icons-round">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">ความปลอดภัย</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-6">

        {/* Password Change */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="material-icons-round text-primary">lock</span>
            เปลี่ยนรหัสผ่าน
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">รหัสผ่านปัจจุบัน</label>
              <PasswordInput value={currentPw} onChange={setCurrentPw} show={showCurrent} onToggle={() => setShowCurrent(!showCurrent)} placeholder="กรอกรหัสผ่านปัจจุบัน" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">รหัสผ่านใหม่</label>
              <PasswordInput value={newPw} onChange={setNewPw} show={showNew} onToggle={() => setShowNew(!showNew)} placeholder="อย่างน้อย 4 ตัวอักษร" />
              {newPw && newPw.length < 4 && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <span className="material-icons-round text-xs">warning</span>
                  ต้องมีอย่างน้อย 4 ตัวอักษร
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ยืนยันรหัสผ่านใหม่</label>
              <PasswordInput value={confirmPw} onChange={setConfirmPw} show={showConfirmPw} onToggle={() => setShowConfirmPw(!showConfirmPw)} placeholder="กรอกรหัสผ่านใหม่อีกครั้ง" />
              {confirmPw && newPw !== confirmPw && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <span className="material-icons-round text-xs">warning</span>
                  รหัสผ่านไม่ตรงกัน
                </p>
              )}
            </div>
            <button
              onClick={handleChangePassword}
              disabled={saving || !currentPw || !newPw || !confirmPw || newPw !== confirmPw || newPw.length < 4}
              className="w-full bg-primary text-white font-semibold py-3 rounded-xl mt-2 shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <><span className="material-icons-round animate-spin text-lg">autorenew</span> กำลังบันทึก...</>
              ) : (
                <><span className="material-icons-round text-lg">save</span> บันทึกรหัสผ่าน</>
              )}
            </button>
          </div>
        </section>

        {/* Biometrics Section - Coming Soon */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                <span className="material-icons-round text-xl">fingerprint</span>
              </div>
              <div>
                <span className="font-medium text-gray-900 dark:text-white block">เข้าสู่ระบบด้วยลายนิ้วมือ</span>
                <span className="text-xs text-gray-400">จะเปิดใช้งานในอนาคต</span>
              </div>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium px-3 py-1 rounded-lg bg-gray-50 dark:bg-gray-700">เร็วๆ นี้</span>
          </div>
        </section>

        {/* Info */}
        <div className="text-center text-xs text-gray-400 dark:text-gray-500 px-4">
          <span className="material-icons-round text-sm align-middle mr-1">info</span>
          รหัสผ่านเริ่มต้นของพนักงานทุกคนคือ <strong>1234</strong>
        </div>

      </main>
    </div>
  );
};

export default SecurityScreen;