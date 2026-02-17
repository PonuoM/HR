
export interface User {
  id: string;
  name: string;
  position: string;
  avatar: string;
  department: string;
  isAdmin?: boolean;
  employmentType?: string;
}

export interface LeaveQuota {
  type: string;
  label: string;
  remaining: number;
  total: number;
  color: string;
  icon: string;
  unit: string;
}

export interface RequestItem {
  id: string;
  type: 'leave' | 'ot';
  title: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: 'pending_supervisor' | 'pending_hr' | 'approved' | 'rejected' | 'in_progress';
  approver?: {
    name: string;
    avatar: string;
    position: string;
  };
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  image: string;
  department: string;
  departmentCode?: string;
  timestamp: string;
  likes: number;
  comments: number;
  isPinned?: boolean;
  isUrgent?: boolean;
  views?: number;
}

export interface Payslip {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  year: string;
  amount: string; // Encrypted or masked in real app
  status: 'new' | 'read';
  sentAt: string;
  imageUrl: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  icon: string;
  iconBg: string;
  isRead: boolean;
}

export interface NavItem {
  path: string;
  icon: string;
  label: string;
  hasNotif?: boolean;
}

export interface QuickMenuItem {
  icon: string;
  label: string;
  path?: string;
  hasNotif?: boolean;
  adminOnly?: boolean;
}

export interface LeaveTypeOption {
  value: string;
  label: string;
}

export interface ApprovalStep {
  label: string;
  status: 'completed' | 'active' | 'pending';
}

export interface AttendanceData {
  date: string;
  time: string;
  location: string;
  lastCheckout: string;
}

export interface AdminStat {
  title: string;
  value: string;
  unit: string;
  icon: string;
  color: string;
}

export interface AdminQuickAction {
  key: string;
  icon: string;
  label: string;
  subtitle: string;
  iconBg: string;
  iconColor: string;
}

export interface AdminPendingRequest {
  id: number;
  name: string;
  role: string;
  avatar: string;
  type: string;
  date: string;
  duration: string;
  reason: string;
}

export interface ProfileMenuItem {
  icon: string;
  label: string;
  subtitle?: string;
  color: string;
  path: string;
  superadminOnly?: boolean;
}

export interface FAQItem {
  q: string;
  a: string;
}

export interface AdminLeaveType {
  id: number;
  name: string;
  defaultQuota: number;
  unit: 'days' | 'hours';
  type: 'annual' | 'seniority' | 'lifetime' | 'unpaid';
  resetCycle: 'year' | 'never';
  color: string;
  icon: string;
  iconUrl: string | null;
  isActive: boolean;
  requiresDoc: boolean;
  probationMonths: number;
  grantTiming: 'immediate' | 'next_year';
  prorateFirstYear: boolean;
  advanceNoticeDays: number;
  seniorityTiers: { minYears: number; days: number }[];
}

export interface ContentStats {
  totalPosts: number;
  pinnedPosts: number;
  totalViews: number;
}

export interface ContentPost {
  id: string;
  title: string;
  content: string;
  image: string;
  isPinned: boolean;
  publishedAt: string;
  views: number;
  likes: number;
}
