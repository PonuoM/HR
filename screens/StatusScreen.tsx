import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_BASE } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface LeaveRequest {
  id: number;
  employee_id: string;
  employee_name: string;
  employee_avatar: string | null;
  leave_type_name: string;
  leave_type_color: string;
  department: string | null;
  start_date: string;
  end_date: string;
  total_days: string;
  reason: string | null;
  status: string; // pending, approved, rejected
  tier1_status: string; // pending, approved, rejected
  tier2_status: string; // pending, approved, rejected
  expected_approver1_id: string | null;
  expected_approver2_id: string | null;
  approver1_name: string | null;
  approver1_avatar: string | null;
  approver2_name: string | null;
  approver2_avatar: string | null;
  tier1_by: string | null;
  tier1_by_name: string | null;
  tier1_at: string | null;
  tier2_by: string | null;
  tier2_by_name: string | null;
  tier2_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

function formatThaiDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: undefined });
}

function formatThaiDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function getStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case 'approved': return { label: 'อนุมัติแล้ว', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' };
    case 'rejected': return { label: 'ไม่อนุมัติ', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' };
    default: return { label: 'รออนุมัติ', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' };
  }
}

function getTierIcon(tierStatus: string): { icon: string; style: string; animate?: boolean } {
  switch (tierStatus) {
    case 'approved': return { icon: 'check', style: 'bg-primary text-white shadow-lg shadow-primary/30' };
    case 'rejected': return { icon: 'close', style: 'bg-red-500 text-white shadow-lg shadow-red-500/30' };
    default: return { icon: 'hourglass_empty', style: 'bg-white dark:bg-gray-800 border-[3px] border-primary text-primary', animate: true };
  }
}

const StatusScreen: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user: authUser } = useAuth();
  const empId = authUser?.id || '';
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    // Try fetching by specific ID first
    fetch(`${API_BASE}/leave_requests.php?id=${id}`)
      .then(res => res.json())
      .then((data: LeaveRequest[]) => {
        if (data.length > 0) {
          setRequest(data[0]);
          setLoading(false);
        } else if (empId) {
          // Fallback: fetch the user's most recent leave request
          return fetch(`${API_BASE}/leave_requests.php?employee_id=${empId}`)
            .then(res => res.json())
            .then((empData: LeaveRequest[]) => {
              if (empData.length > 0) {
                setRequest(empData[0]); // most recent (sorted by created_at DESC)
              } else {
                setError('ไม่พบคำขอลา');
              }
              setLoading(false);
            });
        } else {
          setError('ไม่พบคำขอลานี้');
          setLoading(false);
        }
      })
      .catch(() => {
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        setLoading(false);
      });
  }, [id, empId]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-full bg-background-light dark:bg-background-dark font-display items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <p className="text-sm text-gray-500 mt-4">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="flex flex-col min-h-full bg-background-light dark:bg-background-dark font-display items-center justify-center p-6">
        <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-600 mb-4">search_off</span>
        <p className="text-lg font-semibold text-gray-600 dark:text-gray-400">{error || 'ไม่พบข้อมูล'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary font-medium hover:underline">กลับ</button>
      </div>
    );
  }

  const overallStatus = getStatusLabel(request.status);
  const isOT = request.reason?.startsWith('[OT]');
  const dateRange = `${formatThaiDate(request.start_date)} - ${formatThaiDate(request.end_date)}`;
  const totalDaysLabel = isOT ? `${request.total_days} ชั่วโมง` : `${request.total_days} วัน`;

  // Build approval timeline steps
  const hasTier2 = !!request.expected_approver2_id;

  // Step 1: Submitted (always completed)
  const step1 = {
    title: 'ส่งคำขอแล้ว',
    subtitle: 'คำขอของคุณถูกส่งเข้าระบบเรียบร้อยแล้ว',
    date: formatThaiDateTime(request.created_at),
    status: 'approved' as const,
  };

  // Step 2: Tier 1 approver
  const tier1Status = request.tier1_status;
  const tier1Icon = getTierIcon(tier1Status);
  const step2 = {
    title: tier1Status === 'approved' ? 'หัวหน้าอนุมัติแล้ว' : tier1Status === 'rejected' ? 'หัวหน้าไม่อนุมัติ' : 'รอหัวหน้าอนุมัติ',
    approverName: request.approver1_name || 'ไม่ระบุ',
    approverAvatar: request.approver1_avatar,
    approverRole: 'ผู้อนุมัติลำดับ 1',
    date: request.tier1_at ? formatThaiDateTime(request.tier1_at) : null,
    status: tier1Status,
    icon: tier1Icon,
    statusBadge: getStatusLabel(tier1Status),
  };

  // Step 3: Tier 2 or HR (if exists)
  const step3 = hasTier2 ? (() => {
    const tier2Status = request.tier2_status;
    const tier2Icon = getTierIcon(tier1Status === 'approved' ? tier2Status : 'pending');
    return {
      title: tier2Status === 'approved' ? 'ผู้อนุมัติลำดับ 2 อนุมัติแล้ว' : tier2Status === 'rejected' ? 'ผู้อนุมัติลำดับ 2 ไม่อนุมัติ' : 'รอผู้อนุมัติลำดับ 2',
      approverName: request.approver2_name || 'ไม่ระบุ',
      approverAvatar: request.approver2_avatar,
      approverRole: 'ผู้อนุมัติลำดับ 2',
      date: request.tier2_at ? formatThaiDateTime(request.tier2_at) : null,
      status: tier1Status === 'approved' ? tier2Status : 'locked',
      icon: tier2Icon,
      statusBadge: getStatusLabel(tier1Status === 'approved' ? tier2Status : 'pending'),
      locked: tier1Status !== 'approved',
    };
  })() : null;

  return (
    <div className="flex flex-col min-h-full bg-background-light dark:bg-background-dark font-display relative z-50 pb-20">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20 pt-4 md:pt-4 md:bg-white/95">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-primary flex items-center gap-1">
          <span className="material-icons-round">arrow_back_ios_new</span>
          <span className="hidden md:inline text-sm font-medium ml-1">กลับ</span>
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">ติดตามสถานะ</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto p-5 pb-32 w-full">
        <div className="max-w-2xl mx-auto w-full">
          {/* Status Card */}
          <div className="bg-primary/5 dark:bg-gray-800 p-6 md:p-8 rounded-2xl mb-8 border border-primary/10 dark:border-gray-700">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-xs font-medium text-primary uppercase tracking-wider mb-1 block">ประเภทคำขอ</span>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{isOT ? 'ขอทำ OT' : request.leave_type_name}</h2>
              </div>
              <div className="flex flex-col items-end">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${overallStatus.color}`}>
                  {overallStatus.label}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="bg-white dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
                  <span className="material-icons-round text-sm">calendar_today</span>
                  <span>ระยะเวลา</span>
                </div>
                <p className="font-semibold text-sm md:text-base text-gray-900 dark:text-white">{dateRange}</p>
              </div>
              <div className="bg-white dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
                  <span className="material-icons-round text-sm">schedule</span>
                  <span>รวม</span>
                </div>
                <p className="font-semibold text-sm md:text-base text-gray-900 dark:text-white">{totalDaysLabel}</p>
              </div>
            </div>
            {request.reason && !isOT && (
              <div className="mt-4 bg-white dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
                  <span className="material-icons-round text-sm">notes</span>
                  <span>เหตุผล</span>
                </div>
                <p className="text-sm text-gray-900 dark:text-white">{request.reason}</p>
              </div>
            )}
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
                  <h4 className="font-semibold text-gray-900 dark:text-white">{step1.title}</h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{step1.date}</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{step1.subtitle}</p>
              </div>
            </div>

            {/* Step 2: Tier 1 Approver */}
            <div className="timeline-item relative flex gap-4 pb-10">
              <div className={`absolute left-[19px] top-[40px] bottom-[-24px] w-0.5 z-0 ${step2.status === 'approved' ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
              <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${step2.icon.style}`}>
                <span className={`material-icons-round text-xl ${step2.icon.animate ? 'animate-pulse' : ''}`}>{step2.icon.icon}</span>
              </div>
              <div className="flex-1 pt-1 bg-white dark:bg-gray-800 md:p-4 md:rounded-xl md:border md:border-gray-100 md:dark:border-gray-700 md:ml-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{step2.title}</h4>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${step2.statusBadge.color}`}>
                    {step2.statusBadge.label}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                  <img alt="Approver" className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                    src={step2.approverAvatar
                      ? (step2.approverAvatar.startsWith('http') ? step2.approverAvatar : `${API_BASE}/${step2.approverAvatar}`)
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(step2.approverName)}&background=random`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{step2.approverName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{step2.approverRole}</p>
                  </div>
                </div>
                {step2.date && (
                  <p className="text-xs text-gray-400 mt-2">{step2.status === 'approved' ? 'อนุมัติเมื่อ' : step2.status === 'rejected' ? 'ปฏิเสธเมื่อ' : ''} {step2.date}</p>
                )}
                {step2.status === 'pending' && (
                  <p className="text-xs text-gray-400 mt-2 italic">กำลังรอการอนุมัติ...</p>
                )}
              </div>
            </div>

            {/* Step 3: Tier 2 Approver (if exists) */}
            {step3 && (
              <div className="timeline-item relative flex gap-4">
                <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${step3.locked
                  ? 'bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700'
                  : step3.icon.style
                  }`}>
                  <span className={`material-icons-round text-xl ${step3.locked ? 'text-gray-400' : ''} ${!step3.locked && step3.icon.animate ? 'animate-pulse' : ''}`}>
                    {step3.locked ? 'lock' : step3.icon.icon}
                  </span>
                </div>
                <div className={`flex-1 pt-1 bg-white dark:bg-gray-800 md:p-4 md:rounded-xl md:border md:border-gray-100 md:dark:border-gray-700 md:ml-4 ${step3.locked ? 'opacity-50' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{step3.title}</h4>
                    {!step3.locked && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${step3.statusBadge.color}`}>
                        {step3.statusBadge.label}
                      </span>
                    )}
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                    <img alt="Approver" className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                      src={step3.approverAvatar
                        ? (step3.approverAvatar.startsWith('http') ? step3.approverAvatar : `${API_BASE}/${step3.approverAvatar}`)
                        : `https://ui-avatars.com/api/?name=${encodeURIComponent(step3.approverName)}&background=random`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{step3.approverName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{step3.approverRole}</p>
                    </div>
                  </div>
                  {step3.date && !step3.locked && (
                    <p className="text-xs text-gray-400 mt-2">{step3.status === 'approved' ? 'อนุมัติเมื่อ' : step3.status === 'rejected' ? 'ปฏิเสธเมื่อ' : ''} {step3.date}</p>
                  )}
                  {step3.status === 'pending' && !step3.locked && (
                    <p className="text-xs text-gray-400 mt-2 italic">กำลังรอการอนุมัติ...</p>
                  )}
                  {step3.locked && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">รอการอนุมัติจากลำดับก่อนหน้า</p>
                  )}
                </div>
              </div>
            )}

            {/* No Tier 2: Show completion or waiting */}
            {!step3 && step2.status === 'approved' && (
              <div className="timeline-item relative flex gap-4">
                <div className="relative z-10 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shrink-0 shadow-lg shadow-green-500/30 text-white">
                  <span className="material-icons-round text-xl">done_all</span>
                </div>
                <div className="flex-1 pt-1 bg-white dark:bg-gray-800 md:p-4 md:rounded-xl md:border md:border-gray-100 md:dark:border-gray-700 md:ml-4">
                  <h4 className="font-semibold text-green-600 dark:text-green-400">อนุมัติเรียบร้อย</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">คำขอของคุณได้รับการอนุมัติแล้ว</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom action buttons — only show for pending requests */}
      {request.status === 'pending' && (
        <div className="absolute bottom-0 w-full bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 p-4 pb-8 backdrop-blur-lg bg-opacity-95 dark:bg-opacity-95 z-30 md:bg-transparent md:border-none md:pointer-events-none">
          <div className="grid grid-cols-1 gap-3 max-w-2xl mx-auto md:pointer-events-auto">
            <button onClick={() => navigate(-1)} className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 transition-colors md:shadow-sm md:bg-white md:dark:bg-gray-800 md:border md:border-red-100">
              <span className="material-icons-round text-lg">cancel</span>
              ยกเลิกคำขอ
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusScreen;