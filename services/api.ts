/**
 * HR Mobile Connect - API Service Layer
 * Centralized API communication with PHP backend
 */

// Dynamic API base: '/api' in production (host mode), '/hr-mobile-connect/api' in dev
export const API_BASE = import.meta.env.MODE === 'host'
    ? '/api'
    : '/hr-mobile-connect/api';

// --- Auth headers helper (exported for raw fetch calls) ---
export function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
    let companyId = '1';
    let employeeId = '';
    let sessionToken = '';
    try {
        const stored = localStorage.getItem('hr_auth');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.company?.id) companyId = String(parsed.company.id);
            if (parsed?.user?.id) employeeId = parsed.user.id;
            if (parsed?.token) sessionToken = parsed.token;
        }
    } catch { /* fallback */ }
    return {
        'X-Company-Id': companyId,
        ...(employeeId ? { 'X-Employee-Id': employeeId } : {}),
        ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
        ...extra,
    };
}

// --- Generic fetch wrapper ---
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // Prevent mobile browser (especially iOS Safari) caching for GET requests
    const isGet = !options?.method || options.method === 'GET';
    const separator = endpoint.includes('?') ? '&' : '?';
    const finalEndpoint = isGet ? `${endpoint}${separator}_t=${Date.now()}` : endpoint;
    const url = `${API_BASE}/${finalEndpoint}`;

    const headers: Record<string, string> = {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string> || {}),
    };

    const res = await fetch(url, {
        ...options,
        headers,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

// --- Employees ---
export async function getEmployees(showInactive = false, allCompanies = false) {
    const params = new URLSearchParams();
    if (showInactive) params.set('show_inactive', '1');
    if (allCompanies) params.set('all_companies', '1');
    const qs = params.toString();
    return fetchApi<any[]>(`employees.php${qs ? '?' + qs : ''}`);
}

export async function createEmployee(data: { id: string; name: string; email?: string; password?: string; department_id?: number; position_id?: number; base_salary?: number | null; hire_date?: string | null; approver_id?: string | null; approver2_id?: string | null; company_id?: number; is_admin?: number }) {
    return fetchApi<any>('employees.php', { method: 'POST', body: JSON.stringify(data) });
}

export async function getEmployee(id: string) {
    return fetchApi<any>(`employees.php?id=${id}`);
}

export async function resetEmployeePassword(id: string) {
    return fetchApi<any>(`employees.php?id=${id}&action=reset_password`, { method: 'PUT' });
}

export async function updateEmployee(id: string, data: { name: string; email: string; department_id: number; position_id: number; base_salary?: number | null; hire_date?: string | null; approver_id?: string | null; approver2_id?: string | null; is_admin?: number }) {
    return fetchApi<any>(`employees.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteEmployee(id: string) {
    return fetchApi<any>(`employees.php?id=${id}`, { method: 'DELETE' });
}

export async function suspendEmployee(id: string, terminatedAt?: string) {
    return fetchApi<any>(`employees.php?id=${id}&action=suspend`, {
        method: 'PUT',
        body: JSON.stringify({ terminated_at: terminatedAt || null }),
    });
}

export async function unsuspendEmployee(id: string) {
    return fetchApi<any>(`employees.php?id=${id}&action=unsuspend`, { method: 'PUT' });
}

// --- Leave Types ---
export async function getLeaveTypes() {
    return fetchApi<any[]>('leave_types.php');
}

export async function createLeaveType(data: any) {
    return fetchApi<any>('leave_types.php', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateLeaveType(id: number, data: any) {
    return fetchApi<any>(`leave_types.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteLeaveType(id: number) {
    return fetchApi<any>(`leave_types.php?id=${id}`, { method: 'DELETE' });
}

// --- Leave Quotas ---
export async function getLeaveQuotas(employeeId: string, year?: number) {
    const y = year || new Date().getFullYear();
    return fetchApi<any[]>(`leave_quotas.php?employee_id=${employeeId}&year=${y}`);
}

// Company-wide quota overview — all active employees + their used/remaining for each leave type.
// Read-only (no auto-provisioning) — much faster than calling getLeaveQuotas per employee.
export async function getQuotaOverview(year?: number, allCompanies = false) {
    const y = year || new Date().getFullYear();
    const params = new URLSearchParams({ action: 'summary', year: String(y) });
    if (allCompanies) params.set('all_companies', '1');
    return fetchApi<{
        year: number;
        leave_types: { id: number; name: string; color: string; icon: string; type: string; default_quota: number }[];
        employees: {
            employee_id: string;
            name: string;
            nickname: string | null;
            department: string;
            hire_date: string | null;
            company_id?: number;
            company_name?: string;
            quotas: {
                leave_type_id: number;
                leave_type_name: string;
                color: string;
                icon: string;
                category: string;
                total: number | null;
                used: number;
                remaining: number | null;
            }[];
        }[];
    }>(`leave_quotas.php?${params.toString()}`);
}

export async function updateLeaveQuota(data: { employee_id: string; leave_type_id: number; total: number; year?: number }) {
    return fetchApi<any>('leave_quotas.php', { method: 'PUT', body: JSON.stringify(data) });
}

// --- Leave Requests ---
export async function getLeaveRequests(filters?: { employee_id?: string; status?: string; approver_id?: string }) {
    const params = new URLSearchParams();
    if (filters?.employee_id) params.set('employee_id', filters.employee_id);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.approver_id) params.set('approver_id', filters.approver_id);
    const qs = params.toString();
    return fetchApi<any[]>(`leave_requests.php${qs ? '?' + qs : ''}`);
}

export async function createLeaveRequest(data: any) {
    return fetchApi<any>('leave_requests.php', { method: 'POST', body: JSON.stringify(data) });
}

// HR records leave on behalf of an employee — bypasses approval, auto-approved
export async function createLeaveRequestAsAdmin(data: {
    employee_id: string;
    leave_type_id: number;
    start_date: string;
    end_date: string;
    total_days: number;
    reason: string;
}) {
    return fetchApi<any>('leave_requests.php', {
        method: 'POST',
        body: JSON.stringify({ ...data, admin_create: true }),
    });
}

export async function updateLeaveRequest(id: number, data: { status: string; approved_by?: string; is_bypass?: number }) {
    return fetchApi<any>(`leave_requests.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

// HR-only: change OT multiplier on an existing OT leave_request
export async function updateOtRate(id: number, otRate: number) {
    return fetchApi<any>(`leave_requests.php?action=update_ot_rate&id=${id}`, {
        method: 'POST',
        body: JSON.stringify({ ot_rate: otRate }),
    });
}

export async function deleteLeaveRequest(id: number) {
    return fetchApi<any>(`leave_requests.php?id=${id}`, { method: 'DELETE' });
}

// HR/Superadmin only: delete a leave_request in ANY status with audit log.
// Requires a reason string. Snapshot is saved server-side in leave_request_deletions.
export async function adminDeleteLeaveRequest(id: number, reason: string) {
    return fetchApi<any>(`leave_requests.php?id=${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
    });
}

// --- Time Records ---
export async function getTimeRecords(filters?: { employee_id?: string; status?: string; approver_id?: string }) {
    const params = new URLSearchParams();
    if (filters?.employee_id) params.set('employee_id', filters.employee_id);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.approver_id) params.set('approver_id', filters.approver_id);
    const qs = params.toString();
    return fetchApi<any[]>(`time_records.php${qs ? '?' + qs : ''}`);
}

export async function updateTimeRecord(id: number, data: { status: string; approved_by?: string; is_bypass?: number }) {
    return fetchApi<any>(`time_records.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteTimeRecord(id: number) {
    return fetchApi<any>(`time_records.php?id=${id}`, { method: 'DELETE' });
}

// --- Notifications ---
export async function getNotifications(employeeId: string) {
    return fetchApi<any[]>(`notifications.php?employee_id=${employeeId}`);
}

export async function markNotificationRead(id: number) {
    return fetchApi<any>(`notifications.php?id=${id}`, { method: 'PUT' });
}

export async function markAllNotificationsRead(employeeId: string) {
    return fetchApi<any>(`notifications.php?mark_all=1&employee_id=${employeeId}`, { method: 'PUT' });
}

export async function deleteNotification(id: number) {
    return fetchApi<any>(`notifications.php?id=${id}`, { method: 'DELETE' });
}

// --- News ---
export async function getNews(employeeId?: string) {
    const qs = employeeId ? `?employee_id=${employeeId}` : '';
    return fetchApi<any[]>(`news.php${qs}`);
}

export async function createNewsArticle(data: any) {
    return fetchApi<any>('news.php', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateNewsArticle(id: number, data: any) {
    return fetchApi<any>(`news.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteNewsArticle(id: number) {
    return fetchApi<any>(`news.php?id=${id}`, { method: 'DELETE' });
}

export async function toggleNewsLike(articleId: number, employeeId: string, reactionType: string = 'like') {
    return fetchApi<{ liked: boolean; reaction_type: string | null }>(`news.php?action=like&id=${articleId}`, {
        method: 'POST',
        body: JSON.stringify({ employee_id: employeeId, reaction_type: reactionType }),
    });
}

export async function getNewsComments(articleId: number) {
    return fetchApi<any[]>(`news.php?action=comments&id=${articleId}`);
}

export async function addNewsComment(articleId: number, employeeId: string, content: string) {
    return fetchApi<any>(`news.php?action=comment&id=${articleId}`, {
        method: 'POST',
        body: JSON.stringify({ employee_id: employeeId, content }),
    });
}

export async function deleteNewsComment(commentId: number) {
    return fetchApi<any>(`news.php?action=comment&id=${commentId}`, { method: 'DELETE' });
}

// --- Payslips ---
export async function getPayslips(employeeId?: string) {
    const qs = employeeId ? `?employee_id=${employeeId}` : '';
    return fetchApi<any[]>(`payslips.php${qs}`);
}

export async function createPayslip(data: any) {
    return fetchApi<any>('payslips.php', { method: 'POST', body: JSON.stringify(data) });
}

export async function markPayslipRead(id: number) {
    return fetchApi<any>(`payslips.php?id=${id}`, { method: 'PUT' });
}

// --- Attendance ---
export async function getAttendance(employeeId: string, date?: string) {
    const params = new URLSearchParams({ employee_id: employeeId });
    if (date) params.set('date', date);
    return fetchApi<any>(`attendance.php?${params}`);
}

export async function checkLocation(lat: number, lng: number) {
    return fetchApi<{ matched: boolean; location_name: string; distance: number }>(
        `attendance.php?action=check_location&lat=${lat}&lng=${lng}`
    );
}

export async function clockIn(data: { employee_id: string; latitude?: number; longitude?: number }) {
    return fetchApi<any>('attendance.php', { method: 'POST', body: JSON.stringify(data) });
}

export async function clockOut(id: number, coords?: { latitude: number; longitude: number }) {
    return fetchApi<any>(`attendance.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(coords || {}),
    });
}

// Clock-out without prior clock-in (use case: forgot morning scan, arrives in evening).
// Backend records clock_out and leaves clock_in as NULL — employee should later file
// a "ลืมลงเข้า" time_record to add the morning clock-in retroactively.
export async function clockOutOnly(data: { employee_id: string; latitude?: number; longitude?: number }) {
    return fetchApi<any>('attendance.php?action=clock_out_only', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function getWorkLocations() {
    return fetchApi<any[]>('work_locations.php');
}

export async function createWorkLocation(data: any) {
    return fetchApi<any>('work_locations.php', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateWorkLocation(id: number, data: any) {
    return fetchApi<any>(`work_locations.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteWorkLocation(id: number) {
    return fetchApi<any>(`work_locations.php?id=${id}`, { method: 'DELETE' });
}

export async function resolveGoogleMapsLink(url: string): Promise<{ latitude: number; longitude: number; resolved_url?: string; error?: string }> {
    return fetchApi<any>(`resolve_gmaps.php?url=${encodeURIComponent(url)}`);
}

export async function searchPlaces(query: string): Promise<{ name: string; latitude: number; longitude: number; error?: string }> {
    return fetchApi<any>(`search_places.php?q=${encodeURIComponent(query)}`);
}

// --- Time Records ---
export async function createTimeRecord(data: any) {
    return fetchApi<any>('time_records.php', { method: 'POST', body: JSON.stringify(data) });
}

// --- Allowance Requests ---
export async function getAllowanceTypes() {
    return fetchApi<any[]>('allowance_requests.php?action=types');
}
export async function createAllowanceRequest(data: any) {
    return fetchApi<any>('allowance_requests.php', { method: 'POST', body: JSON.stringify(data) });
}
export async function getAllowanceRequests(filters?: { employee_id?: string; status?: string; approver_id?: string }) {
    const params = new URLSearchParams();
    if (filters?.employee_id) params.append('employee_id', filters.employee_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.approver_id) params.append('approver_id', filters.approver_id);
    return fetchApi<any[]>(`allowance_requests.php?${params.toString()}`);
}
export async function updateAllowanceRequest(id: number, data: { status: string; approved_by?: string; is_bypass?: number }) {
    return fetchApi<any>(`allowance_requests.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

// --- Dashboard (Admin) ---
export async function getDashboardStats() {
    return fetchApi<{ stats: any[]; pendingRequests: any[] }>('dashboard.php');
}

export async function getClockInStatus(departmentId?: number) {
    const params = new URLSearchParams({ action: 'clock_status' });
    if (departmentId) params.set('department_id', String(departmentId));
    return fetchApi<{
        employees: any[];
        summary: { total: number; clocked_in: number; not_clocked_in: number; completed: number; on_leave: number; late: number };
        departments: { id: number; name: string }[];
        date: string;
    }>(`dashboard.php?${params}`);
}

// --- Departments & Positions ---
export async function getDepartments() {
    return fetchApi<any[]>('departments.php');
}

export async function createDepartment(data: { name: string; work_start_time: string; work_end_time: string; is_admin_system?: number }) {
    return fetchApi<any>('departments.php', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateDepartment(id: number, data: { name: string; work_start_time: string; work_end_time: string; is_admin_system?: number }) {
    return fetchApi<any>(`departments.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteDepartment(id: number) {
    return fetchApi<any>(`departments.php?id=${id}`, { method: 'DELETE' });
}

export async function getPositions() {
    return fetchApi<any[]>('departments.php?type=positions');
}

export async function createPosition(data: { name: string; can_have_subordinates?: number }) {
    return fetchApi<any>('departments.php?type=positions', { method: 'POST', body: JSON.stringify(data) });
}

export async function updatePosition(id: number, data: { name: string; can_have_subordinates?: number }) {
    return fetchApi<any>(`departments.php?type=positions&id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deletePosition(id: number) {
    return fetchApi<any>(`departments.php?type=positions&id=${id}`, { method: 'DELETE' });
}

// --- FAQ ---
export async function getFaq() {
    return fetchApi<any[]>('faq.php');
}

// --- Calendar ---
export async function getCalendarData(employeeId: string, year: number, month: number) {
    return fetchApi<{ holidays: any[]; attendance: any[]; leaves: any[] }>(
        `calendar.php?employee_id=${employeeId}&year=${year}&month=${month}`
    );
}

// --- Uploads ---
export async function uploadFile(file: File, category: string, relatedId?: string): Promise<{ id: number; url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    if (relatedId) formData.append('related_id', relatedId);

    // Get company_id for multi-company header
    let companyId = '1';
    try {
        const stored = localStorage.getItem('hr_auth');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.company?.id) companyId = String(parsed.company.id);
        }
    } catch { /* fallback */ }

    const url = `${API_BASE}/uploads.php`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'X-Company-Id': companyId },
        body: formData,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export async function getUploads(category?: string, relatedId?: string) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (relatedId) params.set('related_id', relatedId);
    const qs = params.toString();
    return fetchApi<any[]>(`uploads.php${qs ? '?' + qs : ''}`);
}

export async function deleteUpload(id: number) {
    return fetchApi<any>(`uploads.php?id=${id}`, { method: 'DELETE' });
}

// --- Companies (Superadmin) ---
export async function getCompanies() {
    return fetchApi<any[]>('companies.php');
}

export async function createCompany(data: { code: string; name: string; logo_url?: string }) {
    return fetchApi<any>('companies.php', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateCompany(id: number, data: { code: string; name: string; logo_url?: string; is_active?: boolean }) {
    return fetchApi<any>(`companies.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function toggleCompanyActive(id: number) {
    return fetchApi<any>(`companies.php?id=${id}`, { method: 'DELETE' });
}

// --- Security: Session Validation ---
export async function validateSession(): Promise<{ valid: boolean; error?: string }> {
    // Let errors propagate — AuthContext handles them gracefully
    return await fetchApi<{ valid: boolean; error?: string }>('auth.php?action=validate_session');
}

export async function logoutSession(): Promise<void> {
    const token = getAuthHeaders()['X-Session-Token'];
    if (token) {
        await fetch(`${API_BASE}/auth.php`, {
            method: 'DELETE',
            headers: { 'X-Session-Token': token },
        }).catch(() => { });
    }
}

// --- Security Alerts (Superadmin) ---
export async function getSecurityAlerts(status: 'unresolved' | 'resolved' | 'all' = 'unresolved') {
    return fetchApi<any[]>(`security_alerts.php?status=${status}`);
}

export async function resolveSecurityAlert(id: number) {
    return fetchApi<any>(`security_alerts.php?id=${id}`, { method: 'PUT' });
}

export async function resetDeviceBinding(employeeId: string) {
    return fetchApi<any>(`security_alerts.php?employee_id=${employeeId}`, { method: 'DELETE' });
}

// --- Face Recognition ---
export async function registerFace(employeeId: string, descriptor: number[]) {
    return fetchApi<any>('face.php', {
        method: 'POST',
        body: JSON.stringify({ employee_id: employeeId, descriptor }),
    });
}

export async function getFaceDescriptor(employeeId: string) {
    return fetchApi<{ has_face: boolean; descriptor: number[] | null; registered_at: string | null }>(
        `face.php?employee_id=${employeeId}`
    );
}

export async function deleteFaceDescriptor(employeeId: string) {
    return fetchApi<any>(`face.php?employee_id=${employeeId}`, { method: 'DELETE' });
}

// --- Employee Star Vote ---
export async function getVoteCandidates() {
    return fetchApi<any[]>('employee_votes.php?action=candidates');
}

export async function getMyVotes(month?: number, year?: number) {
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();
    return fetchApi<{ votes: any[]; votes_used: number; votes_remaining: number }>(`employee_votes.php?action=my_votes&month=${m}&year=${y}`);
}

export async function castVote(voterId: string, votedForId: string) {
    const now = new Date();
    return fetchApi<any>('employee_votes.php?action=vote', {
        method: 'POST',
        body: JSON.stringify({ voter_id: voterId, voted_for_id: votedForId, month: now.getMonth() + 1, year: now.getFullYear() }),
    });
}

export async function removeVote(voteId: number) {
    return fetchApi<any>(`employee_votes.php?action=vote&id=${voteId}`, { method: 'DELETE' });
}

export async function getVoteStatus(month?: number, year?: number) {
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();
    return fetchApi<any>(`employee_votes.php?action=status&month=${m}&year=${y}`);
}

export async function getVoteLeaderboard(month: number, year: number) {
    return fetchApi<any>(`employee_votes.php?action=leaderboard&month=${month}&year=${year}`);
}

export async function getMyVoteScore(year?: number) {
    const y = year || new Date().getFullYear();
    return fetchApi<any>(`employee_votes.php?action=my_score&year=${y}`);
}

export async function getYearlyVoteRanking(year?: number) {
    const y = year || new Date().getFullYear();
    return fetchApi<any>(`employee_votes.php?action=yearly_ranking&year=${y}`);
}

export async function closeVoteMonth(month: number, year: number) {
    return fetchApi<any>('employee_votes.php?action=close_month', {
        method: 'POST',
        body: JSON.stringify({ month, year }),
    });
}

// ─── Activity Settings ───
export async function getActivitySettings() {
    return fetchApi<any[]>('activity_settings.php?action=list');
}

export async function toggleActivity(key: string, enabled: boolean) {
    return fetchApi<any>('activity_settings.php?action=toggle', {
        method: 'POST',
        body: JSON.stringify({ key, enabled: enabled ? 1 : 0 }),
    });
}

export async function checkActivity(key: string) {
    return fetchApi<{ key: string; enabled: boolean; start_date: string | null }>(`activity_settings.php?action=check&key=${key}`);
}

// HR-only: edit external_url and/or audience for a link-style activity.
export async function updateActivityLink(opts: {
    key: string;
    external_url?: string;
    audience?: 'all' | 'admin';
}) {
    return fetchApi<{ success: boolean; affected: number }>('activity_settings.php?action=update_link', {
        method: 'POST',
        body: JSON.stringify(opts),
    });
}

// HR-only: grant a non-admin employee access to an admin-only activity.
export async function addActivityViewer(key: string, employee_id: string) {
    return fetchApi<{ success: boolean; added: boolean }>('activity_settings.php?action=add_viewer', {
        method: 'POST',
        body: JSON.stringify({ key, employee_id }),
    });
}

// HR-only: revoke an extra viewer.
export async function removeActivityViewer(key: string, employee_id: string) {
    return fetchApi<{ success: boolean; removed: number }>('activity_settings.php?action=remove_viewer', {
        method: 'POST',
        body: JSON.stringify({ key, employee_id }),
    });
}

export async function checkAttendanceAlerts(employeeId: string) {
    return fetchApi<{ alerts: any[]; total: number; is_birthday?: boolean; birthday_colleagues?: string[] }>(`attendance_alerts.php?action=check`);
}

export async function setSystemStartDate(startDate: string) {
    return fetchApi<any>('activity_settings.php?action=set_start_date', {
        method: 'POST',
        body: JSON.stringify({ start_date: startDate }),
    });
}

export async function getSystemStartDate() {
    return fetchApi<{ start_date: string | null }>('activity_settings.php?action=get_start_date');
}

// --- Extra Working Days (วันทำงานพิเศษ) ---
export interface WorkDay {
    id: number;
    date: string;
    scope: 'company' | 'department' | 'employee';
    department_id: number | null;
    department_name: string | null;
    employee_id: string | null;
    employee_name: string | null;
    note: string | null;
}

export interface WorkDayDepartment {
    id: number;
    name: string;
}

export interface WorkDayData {
    work_days: WorkDay[];
    departments: WorkDayDepartment[];
    year: number;
    available_years: number[];
}

export interface CreateWorkDayPayload {
    date: string;
    scope: 'company' | 'department' | 'employee';
    department_id?: number;
    employee_id?: string;
    note?: string;
}

export async function getWorkDays(year: number) {
    return fetchApi<WorkDayData>(`work_days.php?year=${year}`);
}

export async function createWorkDay(payload: CreateWorkDayPayload) {
    return fetchApi<{ id: number; message: string }>('work_days.php', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function deleteWorkDay(id: number) {
    return fetchApi<{ message: string }>(`work_days.php?id=${id}`, { method: 'DELETE' });
}
