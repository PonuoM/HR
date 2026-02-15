import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ADMIN_QUICK_ACTIONS } from '../../data';
import { useApi } from '../../hooks/useApi';
import { getDashboardStats, getLeaveRequests, updateLeaveRequest } from '../../services/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../contexts/AuthContext';

const AdminDashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const { data: dashboardData } = useApi(() => getDashboardStats(), []);
  const { data: rawPendingRequests } = useApi(() => getLeaveRequests({ status: 'pending' }), []);

  const stats = dashboardData?.stats || [];

  // Map pending requests from DB
  const pendingRequests = (rawPendingRequests || []).map((req: any) => ({
    id: req.id,
    name: req.employee_name || 'Unknown',
    role: req.department || '',
    avatar: req.avatar || `https://picsum.photos/id/${(req.id % 50) + 10}/40/40`,
    type: req.leave_type_name || req.type || '',
    date: req.start_date && req.end_date ? `${new Date(req.start_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${new Date(req.end_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}` : '',
    duration: req.total_days ? `${req.total_days} วัน` : '',
    reason: req.reason || '',
  }));

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
                          <p className="text-xs text-gray-500">{req.role}</p>
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
                      <p className="text-xs text-gray-500">{req.role} • {req.type}</p>
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
                  <p className="text-gray-500 dark:text-gray-400">{selectedRequest.role}</p>
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
                      <p className="text-xs text-gray-400 uppercase font-bold mb-1">วันที่</p>
                      <p className="text-gray-900 dark:text-white font-medium flex items-center gap-2">
                        <span className="material-icons-round text-gray-400 text-sm">event</span>
                        {selectedRequest.date}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">เหตุผลการลา</p>
                  <p className="text-gray-600 dark:text-gray-300 text-sm bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                    {selectedRequest.reason}
                  </p>
                </div>
              </div>
            </div>

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
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardScreen;