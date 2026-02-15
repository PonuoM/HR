import { AdminStat, AdminQuickAction, AdminPendingRequest, AdminLeaveType, Payslip, ContentStats, ContentPost } from '../types';

/** Dashboard stats cards */
export const DASHBOARD_STATS: AdminStat[] = [
    { title: 'พนักงานทั้งหมด', value: '142', unit: 'คน', icon: 'groups', color: 'blue' },
    { title: 'ลางานวันนี้', value: '8', unit: 'คน', icon: 'beach_access', color: 'orange' },
    { title: 'คำขอรออนุมัติ', value: '12', unit: 'รายการ', icon: 'pending_actions', color: 'red' },
    { title: 'เข้างานสาย', value: '3', unit: 'คน', icon: 'timer_off', color: 'purple' },
];

/** Quick actions for admin dashboard */
export const ADMIN_QUICK_ACTIONS: AdminQuickAction[] = [
    { key: 'review_requests', icon: 'fact_check', label: 'ตรวจสอบคำขอ', subtitle: 'อนุมัติ/ปฏิเสธคำขอพนักงาน', iconBg: 'bg-orange-100 dark:bg-orange-900/30', iconColor: 'text-orange-600' },
    { key: 'add_employee', icon: 'person_add', label: 'เพิ่มพนักงานใหม่', subtitle: 'สร้างบัญชีผู้ใช้', iconBg: 'bg-green-100 dark:bg-green-900/30', iconColor: 'text-green-600' },
    { key: 'announce', icon: 'campaign', label: 'ประกาศข่าวสาร', subtitle: 'สร้างโพสต์ประชาสัมพันธ์', iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600' },
    { key: 'quota', icon: 'settings', label: 'ตั้งค่าโควต้า', subtitle: 'จัดการสิทธิ์การลา', iconBg: 'bg-purple-100 dark:bg-purple-900/30', iconColor: 'text-purple-600' },
];

/** Mock pending requests for admin dashboard */
export const PENDING_REQUESTS: AdminPendingRequest[] = [
    { id: 1, name: 'สมศรี มีสุข', role: 'Marketing', avatar: 'https://picsum.photos/id/51/40/40', type: 'ลาป่วย', date: '24 ต.ค. - 25 ต.ค.', duration: '2 วัน', reason: 'มีอาการไข้สูงและปวดศีรษะ แพทย์แนะนำให้พักผ่อน' },
    { id: 2, name: 'สมศรี มีสุข', role: 'Marketing', avatar: 'https://picsum.photos/id/52/40/40', type: 'ลาป่วย', date: '24 ต.ค. - 25 ต.ค.', duration: '2 วัน', reason: 'มีอาการไข้สูงและปวดศีรษะ แพทย์แนะนำให้พักผ่อน' },
    { id: 3, name: 'สมศรี มีสุข', role: 'Marketing', avatar: 'https://picsum.photos/id/53/40/40', type: 'ลาป่วย', date: '24 ต.ค. - 25 ต.ค.', duration: '2 วัน', reason: 'มีอาการไข้สูงและปวดศีรษะ แพทย์แนะนำให้พักผ่อน' },
    { id: 4, name: 'สมศรี มีสุข', role: 'Marketing', avatar: 'https://picsum.photos/id/54/40/40', type: 'ลาป่วย', date: '24 ต.ค. - 25 ต.ค.', duration: '2 วัน', reason: 'มีอาการไข้สูงและปวดศีรษะ แพทย์แนะนำให้พักผ่อน' },
];

/** Initial departments for employee management */
export const INITIAL_DEPARTMENTS = ['ฝ่ายไอที', 'ฝ่ายการตลาด', 'ฝ่ายบัญชี', 'ฝ่ายบุคคล', 'ฝ่ายขาย'];

/** Initial positions for employee management */
export const INITIAL_POSITIONS = ['Software Engineer', 'Marketing Manager', 'Accountant', 'HR Specialist', 'Sales Executive', 'Team Lead'];

/** Month options for payslip management */
export const MONTH_OPTIONS = [
    { value: '01', label: 'มกราคม' }, { value: '02', label: 'กุมภาพันธ์' },
    { value: '03', label: 'มีนาคม' }, { value: '04', label: 'เมษายน' },
    { value: '05', label: 'พฤษภาคม' }, { value: '06', label: 'มิถุนายน' },
    { value: '07', label: 'กรกฎาคม' }, { value: '08', label: 'สิงหาคม' },
    { value: '09', label: 'กันยายน' }, { value: '10', label: 'ตุลาคม' },
    { value: '11', label: 'พฤศจิกายน' }, { value: '12', label: 'ธันวาคม' },
];

/** Mock employee database for admin payslip */
export const EMPLOYEE_DATABASE = [
    { id: 'EMP001', name: 'สาระ วิลสัน', department: 'ฝ่ายไอที', position: 'Software Engineer' },
    { id: 'EMP002', name: 'สมศรี มีสุข', department: 'ฝ่ายการตลาด', position: 'Marketing Manager' },
    { id: 'EMP003', name: 'ประยุทธ์ จันทร์', department: 'ฝ่ายบัญชี', position: 'Accountant' },
    { id: 'EMP004', name: 'มณีรัตน์ แก้ว', department: 'ฝ่ายบุคคล', position: 'HR Specialist' },
];

/** Initial payslip history items */
export const INITIAL_PAYSLIP_HISTORY: Payslip[] = [
    { id: 'h1', employeeId: 'EMP001', employeeName: 'สาระ วิลสัน', month: 'กันยายน', year: '2024', amount: '55,000', status: 'read', sentAt: '2024-09-25T10:00:00Z', imageUrl: 'https://picsum.photos/600/800?random=201' },
    { id: 'h2', employeeId: 'EMP002', employeeName: 'สมศรี มีสุข', month: 'กันยายน', year: '2024', amount: '48,000', status: 'read', sentAt: '2024-09-25T10:00:00Z', imageUrl: 'https://picsum.photos/600/800?random=202' },
];

/** Default leave types for admin quota screen */
export const DEFAULT_LEAVE_TYPES: AdminLeaveType[] = [
    { id: 1, name: 'ลาพักร้อน (Vacation)', defaultQuota: 6, unit: 'days', type: 'seniority', resetCycle: 'year', color: 'orange', icon: 'beach_access', iconUrl: null, isActive: true, requiresDoc: false, probationMonths: 6, grantTiming: 'immediate', prorateFirstYear: true, advanceNoticeDays: 3, seniorityTiers: [{ minYears: 1, days: 6 }, { minYears: 3, days: 8 }, { minYears: 5, days: 10 }, { minYears: 10, days: 15 }] },
    { id: 2, name: 'ลาป่วย (Sick Leave)', defaultQuota: 30, unit: 'days', type: 'annual', resetCycle: 'year', color: 'green', icon: 'local_hospital', iconUrl: null, isActive: true, requiresDoc: true, probationMonths: 0, grantTiming: 'next_year', prorateFirstYear: false, advanceNoticeDays: 0, seniorityTiers: [] },
    { id: 3, name: 'ลากิจ (Business)', defaultQuota: 3, unit: 'days', type: 'annual', resetCycle: 'year', color: 'blue', icon: 'business_center', iconUrl: null, isActive: true, requiresDoc: false, probationMonths: 0, grantTiming: 'next_year', prorateFirstYear: false, advanceNoticeDays: 0, seniorityTiers: [] },
    { id: 4, name: 'ลาทำหมัน (Sterilization)', defaultQuota: 1, unit: 'days', type: 'lifetime', resetCycle: 'never', color: 'pink', icon: 'pregnant_woman', iconUrl: null, isActive: true, requiresDoc: true, probationMonths: 0, grantTiming: 'next_year', prorateFirstYear: false, advanceNoticeDays: 0, seniorityTiers: [] },
    { id: 5, name: 'ลาไม่รับค่าจ้าง (No Pay)', defaultQuota: 0, unit: 'days', type: 'unpaid', resetCycle: 'year', color: 'gray', icon: 'money_off', iconUrl: null, isActive: true, requiresDoc: false, probationMonths: 0, grantTiming: 'next_year', prorateFirstYear: false, advanceNoticeDays: 0, seniorityTiers: [] },
];

/** Content management stats */
export const CONTENT_STATS: ContentStats = {
    totalPosts: 42,
    pinnedPosts: 3,
    totalViews: 1205,
};

/** Content management posts */
export const CONTENT_POSTS: ContentPost[] = [
    {
        id: 'cms-1',
        title: 'กำหนดการงานเลี้ยงปีใหม่ประจำปี 2024',
        content: 'รายละเอียดกำหนดการงานเลี้ยงสังสรรค์ส่งท้ายปีเก่าต้อนรับปีใหม่ ในธีม Neon Galaxy ณ ห้องบอลรูม...',
        image: 'https://picsum.photos/300/200?random=1',
        isPinned: true,
        publishedAt: 'เผยแพร่เมื่อ: 24 ต.ค. 2024',
        views: 245,
        likes: 56,
    },
    {
        id: 'cms-2',
        title: 'ประกาศวันหยุดสงกรานต์',
        content: 'บริษัทขอประกาศวันหยุดเนื่องในเทศกาลสงกรานต์ ตั้งแต่วันที่...',
        image: 'https://picsum.photos/300/200?random=2',
        isPinned: false,
        publishedAt: '2 ชั่วโมงที่แล้ว',
        views: 120,
        likes: 24,
    },
];

/** Employee payslip list for employee PayslipScreen */
export const EMPLOYEE_PAYSLIPS: Payslip[] = [
    {
        id: '1', employeeId: 'EMP001', employeeName: 'สาระ วิลสัน',
        month: 'ตุลาคม', year: '2024', amount: '55,000.00', status: 'new',
        sentAt: '2024-10-25T10:00:00Z', imageUrl: 'https://picsum.photos/600/800?random=101',
    },
    {
        id: '2', employeeId: 'EMP001', employeeName: 'สาระ วิลสัน',
        month: 'กันยายน', year: '2024', amount: '55,000.00', status: 'read',
        sentAt: '2024-09-25T10:00:00Z', imageUrl: 'https://picsum.photos/600/800?random=102',
    },
    {
        id: '3', employeeId: 'EMP001', employeeName: 'สาระ วิลสัน',
        month: 'สิงหาคม', year: '2024', amount: '55,000.00', status: 'read',
        sentAt: '2024-08-25T10:00:00Z', imageUrl: 'https://picsum.photos/600/800?random=103',
    },
    {
        id: '4', employeeId: 'EMP001', employeeName: 'สาระ วิลสัน',
        month: 'กรกฎาคม', year: '2024', amount: '54,000.00', status: 'read',
        sentAt: '2024-07-25T10:00:00Z', imageUrl: 'https://picsum.photos/600/800?random=104',
    },
];
