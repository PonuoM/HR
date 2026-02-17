import { Notification, LeaveQuota, QuickMenuItem, AttendanceData } from '../types';

/** Initial notifications for the notification panel */
export const INITIAL_NOTIFICATIONS: Notification[] = [
    { id: '1', title: 'คำขอลาอนุมัติแล้ว', message: 'คำขอลาพักร้อนวันที่ 1-3 พ.ย. ได้รับการอนุมัติ', time: '10 นาทีที่แล้ว', icon: 'check_circle', iconBg: 'bg-green-100 dark:bg-green-900/30 text-green-600', isRead: false },
    { id: '2', title: 'สลิปเงินเดือน', message: 'สลิปเงินเดือนเดือนตุลาคมพร้อมดูแล้ว', time: '2 ชั่วโมงที่แล้ว', icon: 'receipt_long', iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600', isRead: false },
    { id: '3', title: 'ประชาสัมพันธ์', message: 'งานเลี้ยงปีใหม่ 20 ธ.ค. ลงทะเบียนได้แล้ว', time: 'เมื่อวาน', icon: 'celebration', iconBg: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600', isRead: true },
];

/** Leave quotas displayed on home screen */
export const LEAVE_QUOTAS: LeaveQuota[] = [
    { type: 'vacation', label: 'พักร้อน', remaining: 12, total: 15, color: 'orange', icon: 'beach_access', unit: 'วัน' },
    { type: 'sick', label: 'ลากิจ', remaining: 5, total: 7, color: 'green', icon: 'local_hospital', unit: 'วัน' },
    { type: 'comp', label: 'ชดเชย', remaining: 2, total: 5, color: 'purple', icon: 'timer', unit: 'ชม.' },
];

/** Quick menu items on home screen */
export const QUICK_MENU_ITEMS: QuickMenuItem[] = [
    { icon: 'event_available', label: 'ยื่นคำขอ', path: '/request/create' },
    { icon: 'receipt_long', label: 'สลิปเงินเดือน', path: '/payslips' },
    { icon: 'calendar_month', label: 'ปฏิทิน', path: '/calendar' },
    { icon: 'history', label: 'ประวัติขออนุมัติ', path: '/approval/history' },
    { icon: 'how_to_reg', label: 'อนุมัติลา', path: '/leave/approvals' },
];

/** Attendance / clock-in data */
export const ATTENDANCE_DATA: AttendanceData = {
    date: 'พุธ, 24 ต.ค.',
    time: '08:45',
    location: 'สำนักงานกรุงเทพฯ',
    lastCheckout: 'ลงเวลาออกล่าสุด: เมื่อวาน, 18:00 น.',
};

/** Featured news article shown on Home page */
export const FEATURED_NEWS = {
    tag: 'ประกาศสำคัญ',
    department: 'ฝ่ายบุคคล',
    timestamp: '2 ชั่วโมงที่แล้ว',
    title: 'สรุปการประชุม Townhall ไตรมาส 3 และประเด็นสำคัญ',
    content: 'นี่คือสรุปสิ่งที่เราได้หารือกันในระหว่างการประชุม townhall ไตรมาสเมื่อวานนี้ รวมถึงสวัสดิการใหม่ที่จะเริ่มใช้ในเดือนหน้า และการปรับโครงสร้างองค์กร...',
    image: 'https://picsum.photos/800/400?random=1',
    likes: 24,
    comments: 5,
};
