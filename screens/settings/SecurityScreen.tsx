import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../contexts/AuthContext';

const BIOMETRIC_KEY = 'hr_biometric_enabled';

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

  // Biometric
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);

  useEffect(() => {
    // Check WebAuthn support
    setBiometricSupported(!!window.PublicKeyCredential);
    // Restore saved state
    setBiometricEnabled(localStorage.getItem(BIOMETRIC_KEY) === 'true');
  }, []);

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
        headers: { 'Content-Type': 'application/json' },
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
    } finally {
      setSaving(false);
    }
  };

  // --- Biometric Toggle ---
  const handleBiometricToggle = async () => {
    if (biometricEnabled) {
      if (await showConfirm({ message: 'ต้องการยกเลิกการเข้าสู่ระบบด้วยลายนิ้วมือ?', type: 'warning', confirmText: 'ยกเลิก' })) {
        setBiometricEnabled(false);
        localStorage.removeItem(BIOMETRIC_KEY);
        toast('ยกเลิกการใช้งานลายนิ้วมือแล้ว', 'success');
      }
      return;
    }

    if (!biometricSupported) {
      toast('อุปกรณ์นี้ไม่รองรับลายนิ้วมือ/FaceID', 'warning');
      return;
    }

    setIsEnrolling(true);
    try {
      // Try to trigger WebAuthn platform authenticator
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'HR Connect', id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(authUser?.id || 'user'),
            name: authUser?.id || 'user',
            displayName: authUser?.name || 'User',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },   // ES256
            { alg: -257, type: 'public-key' },  // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // Force built-in (fingerprint/face)
            userVerification: 'required',
          },
          timeout: 60000,
        },
      });

      if (credential) {
        setBiometricEnabled(true);
        localStorage.setItem(BIOMETRIC_KEY, 'true');
        toast('ลงทะเบียนลายนิ้วมือเรียบร้อย! ครั้งถัดไปสามารถสแกนเพื่อเข้าสู่ระบบได้', 'success');
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        toast('ผู้ใช้ยกเลิกการลงทะเบียน', 'info');
      } else if (err.name === 'NotSupportedError') {
        toast('อุปกรณ์นี้ไม่รองรับลายนิ้วมือ', 'warning');
      } else {
        toast('ไม่สามารถลงทะเบียนได้: ' + (err.message || ''), 'error');
      }
    } finally {
      setIsEnrolling(false);
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

        {/* Biometrics Section */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${biometricEnabled ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'}`}>
                <span className="material-icons-round text-xl">fingerprint</span>
              </div>
              <div>
                <span className="font-medium text-gray-900 dark:text-white block">เข้าสู่ระบบด้วยลายนิ้วมือ</span>
                <span className="text-xs text-gray-500">
                  {biometricSupported ? 'รองรับ Passkeys (WebAuthn)' : 'อุปกรณ์ไม่รองรับ'}
                </span>
              </div>
            </div>

            <button
              onClick={handleBiometricToggle}
              disabled={isEnrolling || !biometricSupported}
              className={`relative w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${biometricEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'} ${!biometricSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {isEnrolling ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${biometricEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
              )}
            </button>
          </div>
          {biometricEnabled && (
            <div className="px-4 pb-4">
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                <span className="material-icons-round text-sm">check_circle</span>
                อุปกรณ์นี้ถูกลงทะเบียนเรียบร้อยแล้ว
              </p>
            </div>
          )}
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