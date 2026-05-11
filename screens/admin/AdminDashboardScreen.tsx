import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ADMIN_QUICK_ACTIONS } from '../../data';
import { useApi } from '../../hooks/useApi';
import { getDashboardStats, getLeaveRequests, updateLeaveRequest, getClockInStatus } from '../../services/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { formatLeaveDuration } from '../../utils/leaveHelpers';

const AdminDashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const { data: dashboardData } = useApi(() => getDashboardStats(), []);
  const { data: rawPendingRequests } = useApi(() => getLeaveRequests({ status: 'pending' }), []);

  const stats = dashboardData?.stats || [];

  // ─── Live Clock-in Status ───
  const [clockData, setClockData] = useState<any>(null);
  const [clockDeptFilter, setClockDeptFilter] = useState<number | undefined>(undefined);
  const [clockTab, setClockTab] = useState<'not_clocked_in' | 'all'>('not_clocked_in');
  const [clockLoading, setClockLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const fetchClockStatus = useCallback(async () => {
    setClockLoading(true);
    try {
      const data = await getClockInStatus(clockDeptFilter);
      setClockData(data);
      setLastRefresh(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
    } catch { }
    setClockLoading(false);
  }, [clockDeptFilter]);

  useEffect(() => {
    fetchClockStatus();
    const interval = setInterval(fetchClockStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchClockStatus]);

  // Map pending requests from DB
  const pendingRequests = (rawPendingRequests || []).map((req: any) => {
    let tText = '';
    if (req.start_date && req.end_date && typeof req.start_date === 'string') {
      const stTime = req.start_date.includes(' ') ? req.start_date.split(' ')[1].substring(0, 5) : '';
      const enTime = req.end_date.includes(' ') ? req.end_date.split(' ')[1].substring(0, 5) : '';
      if (stTime && enTime && stTime !== '00:00') {
        tText = `${stTime} - ${enTime} น.`;
      }
    }
    return {
      id: req.id,
      name: req.employee_name || 'Unknown',
      role: req.department || '',
      company: req.company_name || '',
      avatar: req.employee_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.employee_name || 'U')}&background=random&size=40`,
      type: req.leave_type_name || req.type || '',
      date: req.start_date && req.end_date ? `${new Date(req.start_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${new Date(req.end_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}` : '',
      timeText: tText,
      duration: req.total_days ? ((req.leave_type_id == 0 || req.leave_type_id == null) ? `${req.total_days} ชม.` : formatLeaveDuration(req.total_days, 8, req.start_date, req.end_date)) : '',
      reason: req.reason || '',
      status: req.status || 'pending',
      tier1_status: req.tier1_status,
      tier2_status: req.tier2_status,
      expected_approver1_id: req.expected_approver1_id,
      expected_approver2_id: req.expected_approver2_id,
      approver1_name: req.approver1_name,
      approver2_name: req.approver2_name,
      tier1_by_name: req.tier1_by_name,
      tier2_by_name: req.tier2_by_name,
    };
  });

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'add_employee':
        navigate('/admin/employees', { state: { openAddModal: true } });
        break;
      case 'announce':
        navigate('/admin/cms');
        break;
      case 'quota':
        navigate('/admin/quotas');
        break;
      case 'review_requests':
        navigate('/requests');
        break;
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    try {
      await updateLeaveRequest(selectedRequest.id, { status: 'approved', approved_by: authUser?.id || '' });
      toast('อนุมัติคำขอเรียบร้อยแล้ว', 'success');
      setSelectedRequest(null);
      window.location.reload();
    } catch {
      toast('เกิดข้อผิดพลาด', 'error');
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    try {
      await updateLeaveRequest(selectedRequest.id, { status: 'rejected', approved_by: authUser?.id || '' });
      toast('ปฏิเสธคำขอเรียบร้อยแล้ว', 'warning');
      setSelectedRequest(null);
      window.location.reload();
    } catch {
      toast('เกิดข้อผิดพลาด', 'error');
    }
  };

  return (
    <div className="pt-6 md:pt-8 pb-8 px-4 md:px-8 max-w-[1600px] mx-auto min-h-full">
      {/* Mobile Header with Back Button */}
      <header className="mb-6 md:mb-8 flex items-center gap-3">
        <button onClick={() => navigate('/profile')} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
          <span className="material-icons-round">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-xs md:text-base text-gray-500 dark:text-gray-400">ภาพรวมระบบและการจัดการทรัพยากรบุคคล</p>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0">
            <div className="order-2 md:order-1">
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">{stat.title}</p>
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {stat.value} <span className="text-xs md:text-sm font-normal text-gray-400">{stat.unit}</span>
              </h3>
            </div>
            <div className={`order-1 md:order-2 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-500 flex items-center justify-center`}>
              <span className="material-icons-round text-xl md:text-2xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ═══════════════════ LIVE CLOCK-IN STATUS ═══════════════════ */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-6 md:mb-8">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-green-500">schedule</span>
            <h3 className="font-bold text-gray-900 dark:text-white text-base md:text-lg">สถานะลงเวลาวันนี้</h3>
            {lastRefresh && <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-2">อัปเดต {lastRefresh}</span>}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={clockDeptFilter ?? ''}
              onChange={e => setClockDeptFilter(e.target.value ? Number(e.target.value) : undefined)}
              className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary/30 focus:outline-none"
            >
              <option value="">ทุกแผนก</option>
              {(clockData?.departments || []).map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button
              onClick={fetchClockStatus}
              disabled={clockLoading}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
              title="รีเฟรช"
            >
              <span className={`material-icons-round text-lg ${clockLoading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          </div>
        </div>

        {/* Summary Bar */}
        {clockData?.summary && (
          <div className="p-3 md:px-6 md:py-4 grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
            {[
              { label: 'ทั้งหมด', value: clockData.summary.total, color: 'blue', icon: 'groups' },
              { label: 'ลงแล้ว', value: clockData.summary.clocked_in, color: 'green', icon: 'check_circle' },
              { label: 'ยังไม่ลง', value: clockData.summary.not_clocked_in, color: 'red', icon: 'cancel' },
              { label: 'เสร็จสิ้น', value: clockData.summary.completed, color: 'teal', icon: 'task_alt' },
              { label: 'ลางาน', value: clockData.summary.on_leave, color: 'orange', icon: 'beach_access' },
              { label: 'สาย', value: clockData.summary.late, color: 'purple', icon: 'timer_off' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <span className={`material-icons-round text-sm text-${item.color}-500`}>{item.icon}</span>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{item.label}</p>
                  <p className={`text-sm font-bold text-${item.color}-600 dark:text-${item.color}-400`}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Bar */}
        <div className="flex border-b border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setClockTab('not_clocked_in')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors border-b-2 ${clockTab === 'not_clocked_in' ? 'border-red-500 text-red-600 dark:text-red-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            ยังไม่ลงเวลา {clockData?.summary?.not_clocked_in ? `(${clockData.summary.not_clocked_in})` : ''}
          </button>
          <button
            onClick={() => setClockTab('all')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors border-b-2 ${clockTab === 'all' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            ทั้งหมด {clockData?.summary?.total ? `(${clockData.summary.total})` : ''}
          </button>
        </div>

        {/* Employee List */}
        <div className="max-h-[360px] overflow-y-auto">
          {(() => {
            const employees = clockData?.employees || [];
            const filtered = clockTab === 'not_clocked_in'
              ? employees.filter((e: any) => e.status === 'not_clocked_in')
              : employees;

            if (filtered.length === 0) {
              return (
                <div className="p-8 text-center text-gray-400 dark:text-gray-500">
                  <span className="material-icons-round text-4xl mb-2 block opacity-50">
                    {clockTab === 'not_clocked_in' ? 'celebration' : 'groups'}
                  </span>
                  <p className="text-sm">
                    {clockTab === 'not_clocked_in' ? 'ทุกคนลงเวลาแล้ว! 🎉' : 'ไม่มีข้อมูล'}
                  </p>
                </div>
              );
            }

            return filtered.map((emp: any) => {
              const statusConfig: Record<string, { label: string; bg: string; text: string; icon: string }> = {
                not_clocked_in: { label: 'ยังไม่ลง', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', icon: 'cancel' },
                clocked_in: { label: emp.clock_in?.substring(0, 5) || 'ลงแล้ว', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', icon: 'check_circle' },
                completed: { label: `${emp.clock_in?.substring(0, 5) || ''} - ${emp.clock_out?.substring(0, 5) || ''}`, bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400', icon: 'task_alt' },
                on_leave: { label: 'ลางาน', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', icon: 'beach_access' },
              };
              const st = statusConfig[emp.status] || statusConfig.not_clocked_in;

              return (
                <div key={emp.employee_id} className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <img
                    src={emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=random&size=40`}
                    alt={emp.name}
                    className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-gray-700 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {emp.name}
                      {emp.is_late && <span className="ml-1.5 text-[10px] text-purple-500 font-bold">สาย</span>}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{emp.department}</p>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${st.bg} ${st.text} shrink-0`}>
                    <span className="material-icons-round text-sm">{st.icon}</span>
                    <span className="hidden sm:inline">{st.label}</span>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Recent Requests */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-bold text-gray-900 dark:text-white text-base md:text-lg">คำขอล่าสุด</h3>
            <button className="text-primary text-xs md:text-sm font-medium hover:underline">ดูทั้งหมด</button>
          </div>

          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">พนักงาน</th>
                  <th className="p-4 font-medium">ประเภท</th>
                  <th className="p-4 font-medium">วันที่</th>
                  <th className="p-4 font-medium">สถานะ</th>
                  <th className="p-4 font-medium text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {pendingRequests.map((req: any) => (
                  <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={req.avatar} className="w-8 h-8 rounded-full" alt="avatar" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{req.name}</p>
                          <p className="text-xs text-gray-500">{req.role}{req.company ? ` • ${req.company}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{req.type}</td>
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{req.date}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs font-semibold whitespace-nowrap">รออนุมัติ HR</span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedRequest(req)}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-semibold text-sm transition-colors"
                      >
                        ตรวจสอบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE LIST VIEW */}
          <div className="md:hidden">
            {pendingRequests.map((req: any) => (
              <div key={req.id} className="p-4 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <img src={req.avatar} className="w-10 h-10 rounded-full object-cover" alt="avatar" />
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm">{req.name}</h4>
                      <p className="text-xs text-gray-500">{req.role}{req.company ? ` • ${req.company}` : ''} • {req.type}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-[10px] font-bold">
                    รออนุมัติ HR
                  </span>
                </div>
                <div className="flex items-center justify-between pl-[52px]">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-md">
                    <span className="material-icons-round text-sm">event</span>
                    <span>{req.date}</span>
                  </div>
                  <button
                    onClick={() => setSelectedRequest(req)}
                    className="text-sm font-semibold text-primary"
                  >
                    ตรวจสอบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-6 h-fit">
          <h3 className="font-bold text-gray-900 dark:text-white text-base md:text-lg mb-4">เมนูด่วน</h3>
          <div className="space-y-3">
            {ADMIN_QUICK_ACTIONS.map((action) => (
              <button
                key={action.key}
                onClick={() => handleQuickAction(action.key)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left border border-gray-200 dark:border-gray-700"
              >
                <div className={`w-10 h-10 rounded-lg ${action.iconBg} ${action.iconColor} flex items-center justify-center shrink-0`}>
                  <span className="material-icons-round">{action.icon}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{action.label}</p>
                  <p className="text-xs text-gray-500">{action.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* VERIFY REQUEST MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">ตรวจสอบคำขอ</h2>
              <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500">
                <span className="material-icons-round">close</span>
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <img src={selectedRequest.avatar} className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm" alt="avatar" />
                <div>
                  <h3 className="font-bold text-xl text-gray-900 dark:text-white">{selectedRequest.name}</h3>
                  <p className="text-gray-500 dark:text-gray-400">{selectedRequest.role}{selectedRequest.company ? ` • ${selectedRequest.company}` : ''}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-bold mb-1">ประเภท</p>
                      <p className="text-gray-900 dark:text-white font-medium">{selectedRequest.type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-bold mb-1">ระยะเวลา</p>
                      <p className="text-gray-900 dark:text-white font-medium">{selectedRequest.duration}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400 uppercase font-bold mb-1">วันที่ / เวลา</p>
                      <div className="text-gray-900 dark:text-white font-medium flex items-center gap-4 flex-wrap">
                        <span className="flex items-center gap-2">
                          <span className="material-icons-round text-gray-400 text-sm">event</span>
                          {selectedRequest.date}
                        </span>
                        {selectedRequest.timeText && (
                          <span className="flex items-center gap-1.5 text-primary bg-primary/10 px-2 py-0.5 rounded-md text-sm">
                            <span className="material-icons-round text-sm">schedule</span>
                            {selectedRequest.timeText}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* สายการอนุมัติ */}
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">สายการอนุมัติ</p>
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
                    {/* Tier 1 */}
                    <div className="flex items-start gap-3">
                       <div className="mt-1 flex flex-col items-center">
                         {selectedRequest.tier1_status === 'approved' ? (
                           <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                             <span className="material-icons-round text-white text-[12px]">check</span>
                           </div>
                         ) : selectedRequest.tier1_status === 'rejected' ? (
                           <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                             <span className="material-icons-round text-white text-[12px]">close</span>
                           </div>
                         ) : (
                           <div className="w-4 h-4 rounded-full border-2 border-orange-400 mt-0.5 shrink-0" />
                         )}
                         {selectedRequest.expected_approver2_id && <div className="w-0.5 h-6 bg-gray-200 dark:bg-gray-700 my-1" />}
                       </div>
                       <div>
                         <p className="text-sm font-medium text-gray-900 dark:text-white">
                           ระดับที่ 1: {selectedRequest.tier1_by_name || selectedRequest.approver1_name || '...'}
                         </p>
                         <p className="text-xs text-gray-500 dark:text-gray-400">
                           {selectedRequest.tier1_status === 'approved' ? '✅ อนุมัติแล้ว' : selectedRequest.tier1_status === 'rejected' ? '❌ ปฏิเสธ' : '⏳ รอตรวจสอบ'}
                         </p>
                       </div>
                    </div>
                    {/* Tier 2 */}
                    {selectedRequest.expected_approver2_id && (
                    <div className="flex items-start gap-3">
                       <div className="mt-1 flex flex-col items-center">
                         {selectedRequest.tier2_status === 'approved' ? (
                           <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                             <span className="material-icons-round text-white text-[12px]">check</span>
                           </div>
                         ) : selectedRequest.tier2_status === 'rejected' ? (
                           <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                             <span className="material-icons-round text-white text-[12px]">close</span>
                           </div>
                         ) : (
                           <div className={`w-4 h-4 rounded-full border-2 ${selectedRequest.tier1_status === 'approved' ? 'border-orange-400' : 'border-gray-300 dark:border-gray-600'} shrink-0`} />
                         )}
                       </div>
                       <div>
                         <p className="text-sm font-medium text-gray-900 dark:text-white">
                           ระดับที่ 2: {selectedRequest.tier2_by_name || selectedRequest.approver2_name || '...'}
                         </p>
                         <p className="text-xs text-gray-500 dark:text-gray-400">
                           {selectedRequest.tier2_status === 'approved' ? '✅ อนุมัติแล้ว' : selectedRequest.tier2_status === 'rejected' ? '❌ ปฏิเสธ' : '⏳ รอตรวจสอบ'}
                         </p>
                       </div>
                    </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">เหตุผลการลา</p>
                  <p className="text-gray-600 dark:text-gray-300 text-sm bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 text-wrap break-words">
                    {selectedRequest.reason}
                  </p>
                </div>
              </div>
            </div>

            {(() => {
              const strAuthId = String(authUser?.id);
              const isTier1Turn = selectedRequest.tier1_status === 'pending' && String(selectedRequest.expected_approver1_id) === strAuthId;
              const isTier2Turn = selectedRequest.tier1_status === 'approved' && selectedRequest.tier2_status === 'pending' && String(selectedRequest.expected_approver2_id) === strAuthId;
              const isMyTurn = isTier1Turn || isTier2Turn;

              if (!isMyTurn) {
                return (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex justify-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">คุณมีสิทธิ์เพียงแค่เข้าชมสถานะตั๋วใบนี้เท่านั้น</p>
                  </div>
                );
              }

              return (
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                  <button
                    onClick={handleReject}
                    className="flex-1 py-3 rounded-xl border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                  >
                    ปฏิเสธ
                  </button>
                  <button
                    onClick={handleApprove}
                    className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg shadow-green-500/30 transition-colors"
                  >
                    อนุมัติคำขอ
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardScreen;