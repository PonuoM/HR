import { NavItem, ProfileMenuItem } from '../types';

/** Mobile bottom navigation items */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
    { path: '/', icon: 'dashboard', label: 'หน้าหลัก' },
    { path: '/request/create', icon: 'description', label: 'คำขอ' },
    { path: '/news', icon: 'campaign', label: 'ประชาสัมพันธ์' },
    { path: '/profile', icon: 'person_outline', label: 'โปรไฟล์' },
];

/** Desktop sidebar main navigation items */
export const SIDEBAR_NAV_ITEMS: NavItem[] = [
    { path: '/', icon: 'dashboard', label: 'หน้าหลัก' },
    { path: '/request/create', icon: 'description', label: 'คำขอ & วันลา' },
    { path: '/leave/history', icon: 'history', label: 'ประวัติการลา' },
    { path: '/leave/approvals', icon: 'how_to_reg', label: 'อนุมัติลา' },
    { path: '/payslips', icon: 'receipt_long', label: 'สลิปเงินเดือน' },
    { path: '/calendar', icon: 'calendar_month', label: 'ปฏิทิน' },
    { path: '/news', icon: 'campaign', label: 'ประชาสัมพันธ์' },
    { path: '/profile', icon: 'person_outline', label: 'โปรไฟล์' },
];

/** Desktop sidebar admin section items */
export const SIDEBAR_ADMIN_ITEMS: NavItem[] = [
    { path: '/admin/dashboard', icon: 'admin_panel_settings', label: 'ภาพรวมระบบ' },
    { path: '/admin/employees', icon: 'people', label: 'จัดการพนักงาน' },
    { path: '/admin/quotas', icon: 'timelapse', label: 'ตั้งค่าโควต้า' },
    { path: '/admin/payslips', icon: 'payments', label: 'จัดการเงินเดือน' },
    { path: '/admin/cms', icon: 'article', label: 'จัดการข่าวสาร' },
    { path: '/admin/locations', icon: 'location_on', label: 'พื้นที่ทำงาน' },
    { path: '/admin/departments', icon: 'apartment', label: 'แผนกและตำแหน่ง' },
    { path: '/admin/attendance-report', icon: 'summarize', label: 'รายงานเข้างาน' },
];

/** Profile page — general menu items */
export const PROFILE_MENU_ITEMS: ProfileMenuItem[] = [
    { icon: 'settings', label: 'การตั้งค่า', subtitle: 'ภาษา, ธีม, การแจ้งเตือน', color: 'bg-gray-100 text-gray-600', path: '/settings' },
    { icon: 'lock', label: 'ความปลอดภัย', subtitle: 'เปลี่ยนรหัสผ่าน, PIN', color: 'bg-gray-100 text-gray-600', path: '/security' },
    { icon: 'help', label: 'ช่วยเหลือ', subtitle: 'คำถามที่พบบ่อย, ติดต่อ HR', color: 'bg-gray-100 text-gray-600', path: '/help' },
];

/** Profile page — admin menu items (mobile access point) */
export const PROFILE_ADMIN_ITEMS: ProfileMenuItem[] = [
    { icon: 'dashboard', label: 'Admin Dashboard', path: '/admin/dashboard', color: 'bg-blue-100 text-blue-600' },
    { icon: 'people', label: 'จัดการพนักงาน', path: '/admin/employees', color: 'bg-purple-100 text-purple-600' },
    { icon: 'timelapse', label: 'ตั้งค่าโควต้า', path: '/admin/quotas', color: 'bg-pink-100 text-pink-600' },
    { icon: 'payments', label: 'จัดการเงินเดือน', path: '/admin/payslips', color: 'bg-green-100 text-green-600' },
    { icon: 'article', label: 'จัดการข่าวสาร', path: '/admin/cms', color: 'bg-orange-100 text-orange-600' },
    { icon: 'location_on', label: 'พื้นที่ทำงาน', path: '/admin/locations', color: 'bg-teal-100 text-teal-600' },
    { icon: 'apartment', label: 'แผนกและตำแหน่ง', path: '/admin/departments', color: 'bg-indigo-100 text-indigo-600' },
    { icon: 'summarize', label: 'รายงานเข้างาน', path: '/admin/attendance-report', color: 'bg-emerald-100 text-emerald-600' },
];
