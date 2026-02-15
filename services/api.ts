/**
 * HR Mobile Connect - API Service Layer
 * Centralized API communication with PHP backend
 */

// Dynamic API base: '/api' in production (host mode), '/hr-mobile-connect/api' in dev
export const API_BASE = import.meta.env.MODE === 'host'
    ? '/api'
    : '/hr-mobile-connect/api';

// --- Generic fetch wrapper ---
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}/${endpoint}`;
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

// --- Employees ---
export async function getEmployees() {
    return fetchApi<any[]>('employees.php');
}

export async function getEmployee(id: string) {
    return fetchApi<any>(`employees.php?id=${id}`);
}

export async function resetEmployeePassword(id: string) {
    return fetchApi<any>(`employees.php?id=${id}&action=reset_password`, { method: 'PUT' });
}

export async function updateEmployee(id: string, data: { name: string; email: string; department_id: number; position_id: number; base_salary?: number | null; hire_date?: string | null; approver_id?: string | null; approver2_id?: string | null }) {
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

export async function updateLeaveQuota(data: { employee_id: string; leave_type_id: number; total: number; year?: number }) {
    return fetchApi<any>('leave_quotas.php', { method: 'PUT', body: JSON.stringify(data) });
}

// --- Leave Requests ---
export async function getLeaveRequests(filters?: { employee_id?: string; status?: string }) {
    const params = new URLSearchParams();
    if (filters?.employee_id) params.set('employee_id', filters.employee_id);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();
    return fetchApi<any[]>(`leave_requests.php${qs ? '?' + qs : ''}`);
}

export async function createLeaveRequest(data: any) {
    return fetchApi<any>('leave_requests.php', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateLeaveRequest(id: number, data: { status: string; approved_by?: string; is_bypass?: number }) {
    return fetchApi<any>(`leave_requests.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
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
export async function getNews() {
    return fetchApi<any[]>('news.php');
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

// --- Time Records ---
export async function createTimeRecord(data: any) {
    return fetchApi<any>('time_records.php', { method: 'POST', body: JSON.stringify(data) });
}

// --- Dashboard (Admin) ---
export async function getDashboardStats() {
    return fetchApi<{ stats: any[]; pendingRequests: any[] }>('dashboard.php');
}

// --- Departments & Positions ---
export async function getDepartments() {
    return fetchApi<any[]>('departments.php');
}

export async function updateDepartment(id: number, data: { name: string; work_start_time: string; work_end_time: string; is_admin_system?: number }) {
    return fetchApi<any>(`departments.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function getPositions() {
    return fetchApi<any[]>('departments.php?type=positions');
}

export async function updatePosition(id: number, data: { name: string; can_have_subordinates?: number }) {
    return fetchApi<any>(`departments.php?type=positions&id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
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

    const url = `${API_BASE}/uploads.php`;
    const res = await fetch(url, { method: 'POST', body: formData });
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
