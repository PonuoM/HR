import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLeaveRequests, getDepartments, getCompanies } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { formatLeaveDuration } from '../../utils/leaveHelpers';
import CustomSelect from '../../components/CustomSelect';

interface LeaveRow {
  id: number;
  employee_id: string;
  employee_name: string;
  employee_avatar: string | null;
  leave_type_id: number | null;
  leave_type_name: string;
  leave_type_color: string;
  department: string | null;
  company_name: string | null;
  company_code: string | null;
  start_date: string;
  end_date: string;
  total_days: string | number;
  ot_rate: number | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | string;
  tier1_status: string;
  tier2_status: string;
  approver1_name: string | null;
  approver2_name: string | null;
  approved_by: string | null;
  approved_at: string | null;
  is_bypass: number;
  created_at: string;
}

function statusBadge(status: string): { label: string; cls: string; dot: string } {
  switch (status) {
    case 'approved':
      return {
        label: 'อนุมัติแล้ว',
        cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
        dot: 'bg-green-500',
      };
    case 'rejected':
      return {
        label: 'ไม่อนุมัติ',
        cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
        dot: 'bg-red-500',
      };
    default:
      return {
        label: 'รออนุมัติ',
        cls: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
        dot: 'bg-yellow-500',
      };
  }
}

function formatThaiDateShort(s: string | null): string {
  if (!s) return '-';
  const d = new Date(s);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

function formatThaiDateTime(s: string | null): string {
  if (!s) return '-';
  const d = new Date(s);
  return (
    d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  );
}

const PAGE_SIZE = 50;

const AdminLeaveListScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();

  // Data
  const { data: requests, loading, refetch } = useApi<LeaveRow[]>(() => getLeaveRequests(), []);
  const { data: rawDepts } = useApi<any[]>(() => getDepartments(), []);
  const { data: rawCompanies } = useApi<any[]>(
    () => (isSuperAdmin ? getCompanies() : Promise.resolve([] as any[])),
    [isSuperAdmin]
  );

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchText, filterDept, filterCompany, filterMonth, filterStatus]);

  // Distinct dept/company names from current dataset (fallback if API list empty)
  const deptOptions = useMemo(() => {
    const fromApi = (rawDepts || []).map((d: any) => d.name).filter(Boolean);
    const fromData = Array.from(
      new Set((requests || []).map((r) => r.department).filter(Boolean) as string[])
    );
    const merged = Array.from(new Set([...fromApi, ...fromData])).sort();
    return [{ value: '', label: 'ทุกแผนก' }, ...merged.map((n) => ({ value: n, label: n }))];
  }, [rawDepts, requests]);

  const companyOptions = useMemo(() => {
    const fromApi = (rawCompanies || []).map((c: any) => c.name).filter(Boolean);
    const fromData = Array.from(
      new Set((requests || []).map((r) => r.company_name).filter(Boolean) as string[])
    );
    const merged = Array.from(new Set([...fromApi, ...fromData])).sort();
    return [{ value: '', label: 'ทุกบริษัท' }, ...merged.map((n) => ({ value: n, label: n }))];
  }, [rawCompanies, requests]);

  const monthOptions = useMemo(() => {
    // Build distinct YYYY-MM from start_date
    const set = new Set<string>();
    (requests || []).forEach((r) => {
      const m = (r.start_date || '').substring(0, 7);
      if (m) set.add(m);
    });
    const sorted = Array.from(set).sort((a, b) => b.localeCompare(a));
    return [
      { value: '', label: 'ทุกเดือน' },
      ...sorted.map((m) => {
        const [y, mo] = m.split('-');
        const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
        return {
          value: m,
          label: d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }),
        };
      }),
    ];
  }, [requests]);

  const statusOptions = [
    { value: '', label: 'ทุกสถานะ' },
    { value: 'pending', label: 'รออนุมัติ' },
    { value: 'approved', label: 'อนุมัติแล้ว' },
    { value: 'rejected', label: 'ไม่อนุมัติ' },
  ];

  // Filtered list (created_at DESC is server default, preserved)
  const filtered = useMemo(() => {
    return (requests || []).filter((r) => {
      if (searchText) {
        const q = searchText.toLowerCase();
        const name = (r.employee_name || '').toLowerCase();
        const eid = (r.employee_id || '').toLowerCase();
        if (!name.includes(q) && !eid.includes(q)) return false;
      }
      if (filterDept && (r.department || '') !== filterDept) return false;
      if (filterCompany && (r.company_name || '') !== filterCompany) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterMonth) {
        const m = (r.start_date || '').substring(0, 7);
        if (m !== filterMonth) return false;
      }
      return true;
    });
  }, [requests, searchText, filterDept, filterCompany, filterStatus, filterMonth]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats — based on full dataset (unfiltered)
  const stats = useMemo(() => {
    const list = requests || [];
    return {
      total: list.length,
      pending: list.filter((r) => r.status === 'pending').length,
      approved: list.filter((r) => r.status === 'approved').length,
      rejected: list.filter((r) => r.status === 'rejected').length,
    };
  }, [requests]);

  const handleClearFilters = () => {
    setSearchText('');
    setFilterDept('');
    setFilterCompany('');
    setFilterMonth('');
    setFilterStatus('');
  };

  const isFiltered =
    !!searchText || !!filterDept || !!filterCompany || !!filterMonth || !!filterStatus;

  return (
    <div className="flex flex-col min-h-full bg-background-light dark:bg-background-dark font-display">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-primary flex items-center gap-1"
        >
          <span className="material-icons-round">arrow_back_ios_new</span>
          <span className="hidden md:inline text-sm font-medium ml-1">กลับ</span>
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">รายการใบลาทั้งหมด</h1>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-primary"
          title="รีโหลด"
        >
          <span className="material-icons-round">refresh</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-20">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="ทั้งหมด" value={stats.total} icon="list_alt" color="text-gray-600 dark:text-gray-300" bg="bg-gray-100 dark:bg-gray-800" />
          <StatCard label="รออนุมัติ" value={stats.pending} icon="hourglass_empty" color="text-yellow-600" bg="bg-yellow-100 dark:bg-yellow-900/30" />
          <StatCard label="อนุมัติแล้ว" value={stats.approved} icon="check_circle" color="text-green-600" bg="bg-green-100 dark:bg-green-900/30" />
          <StatCard label="ไม่อนุมัติ" value={stats.rejected} icon="cancel" color="text-red-600" bg="bg-red-100 dark:bg-red-900/30" />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 mb-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">
              search
            </span>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="ค้นหาด้วยชื่อ, รหัสพนักงาน, ชื่อเล่น..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
          </div>

          {/* Filter row */}
          <div className={`grid grid-cols-2 ${isSuperAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-2`}>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">แผนก</label>
              <CustomSelect options={deptOptions} value={filterDept} onChange={setFilterDept} placeholder="ทุกแผนก" />
            </div>
            {isSuperAdmin && (
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">บริษัท</label>
                <CustomSelect options={companyOptions} value={filterCompany} onChange={setFilterCompany} placeholder="ทุกบริษัท" />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">เดือน</label>
              <CustomSelect options={monthOptions} value={filterMonth} onChange={setFilterMonth} placeholder="ทุกเดือน" />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">สถานะ</label>
              <CustomSelect options={statusOptions} value={filterStatus} onChange={setFilterStatus} placeholder="ทุกสถานะ" />
            </div>
          </div>

          {/* Result count + clear */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              พบ <span className="font-semibold text-gray-700 dark:text-gray-200">{filtered.length}</span> รายการ
              {isFiltered && ` (จากทั้งหมด ${stats.total})`}
            </span>
            {isFiltered && (
              <button
                onClick={handleClearFilters}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                <span className="material-icons-round text-sm">clear</span>
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>

        {/* Table (desktop) / Card list (mobile) */}
        {loading ? (
          <div className="flex flex-col items-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            <p className="text-sm text-gray-500 mt-3">กำลังโหลดข้อมูล...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-600 mb-3">search_off</span>
            <p className="text-base font-semibold text-gray-600 dark:text-gray-400">ไม่พบรายการที่ตรงกับเงื่อนไข</p>
            {isFiltered && (
              <button onClick={handleClearFilters} className="mt-3 text-sm text-primary hover:underline">
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">วันที่สร้าง</th>
                      <th className="px-4 py-3 text-left font-medium">พนักงาน</th>
                      <th className="px-4 py-3 text-left font-medium">แผนก</th>
                      {isSuperAdmin && <th className="px-4 py-3 text-left font-medium">บริษัท</th>}
                      <th className="px-4 py-3 text-left font-medium">ประเภท</th>
                      <th className="px-4 py-3 text-left font-medium">วันที่ลา</th>
                      <th className="px-4 py-3 text-left font-medium">ระยะเวลา</th>
                      <th className="px-4 py-3 text-left font-medium">สถานะ</th>
                      <th className="px-4 py-3 text-right font-medium">การกระทำ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {pageRows.map((r) => {
                      const sb = statusBadge(r.status);
                      const isOT = (r.reason || '').startsWith('[OT]');
                      return (
                        <tr
                          key={r.id}
                          onClick={() => navigate(`/request/status/${r.id}`)}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {formatThaiDateTime(r.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {r.employee_avatar ? (
                                <img src={r.employee_avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">
                                  {(r.employee_name || '?').charAt(0)}
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white">{r.employee_name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{r.employee_id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.department || '-'}</td>
                          {isSuperAdmin && (
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.company_name || '-'}</td>
                          )}
                          <td className="px-4 py-3">
                            <span className="text-gray-900 dark:text-white font-medium">
                              {isOT ? 'OT' : r.leave_type_name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">
                            {formatThaiDateShort(r.start_date)}
                            {r.start_date !== r.end_date && ` - ${formatThaiDateShort(r.end_date)}`}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">
                            {isOT
                              ? `${r.total_days} ชม.`
                              : formatLeaveDuration(Number(r.total_days), 8, r.start_date, r.end_date)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sb.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sb.dot}`}></span>
                              {sb.label}
                            </span>
                            {r.is_bypass === 1 && (
                              <span className="ml-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                HR บันทึก
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="material-icons-round text-gray-400 text-base">chevron_right</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {pageRows.map((r) => {
                const sb = statusBadge(r.status);
                const isOT = (r.reason || '').startsWith('[OT]');
                return (
                  <div
                    key={r.id}
                    onClick={() => navigate(`/request/status/${r.id}`)}
                    className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800/50"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {r.employee_avatar ? (
                          <img src={r.employee_avatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {(r.employee_name || '?').charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 dark:text-white text-sm truncate">{r.employee_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {r.employee_id} · {r.department || '-'}
                          </div>
                        </div>
                      </div>
                      <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sb.cls}`}>
                        <span className={`w-1 h-1 rounded-full ${sb.dot}`}></span>
                        {sb.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">ประเภท: </span>
                        <span className="text-gray-900 dark:text-white font-medium">{isOT ? 'OT' : r.leave_type_name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">รวม: </span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {isOT
                            ? `${r.total_days} ชม.`
                            : formatLeaveDuration(Number(r.total_days), 8, r.start_date, r.end_date)}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500 dark:text-gray-400">วันที่: </span>
                        <span className="text-gray-900 dark:text-white">
                          {formatThaiDateShort(r.start_date)}
                          {r.start_date !== r.end_date && ` - ${formatThaiDateShort(r.end_date)}`}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500 dark:text-gray-400">สร้างเมื่อ: </span>
                        <span className="text-gray-700 dark:text-gray-300">{formatThaiDateTime(r.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="material-icons-round text-base">chevron_left</span>
                  ก่อนหน้า
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  หน้า <span className="font-semibold text-gray-900 dark:text-white">{page}</span> จาก{' '}
                  <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  ถัดไป
                  <span className="material-icons-round text-base">chevron_right</span>
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; icon: string; color: string; bg: string }> = ({
  label,
  value,
  icon,
  color,
  bg,
}) => (
  <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 border border-gray-100 dark:border-gray-800">
    <div className="flex items-center gap-2.5">
      <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center`}>
        <span className={`material-icons-round ${color}`}>{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</div>
        <div className="text-xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</div>
      </div>
    </div>
  </div>
);

export default AdminLeaveListScreen;
