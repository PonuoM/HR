import { LeaveTypeOption, ApprovalStep } from '../types';

/** Leave type options for the create request form */
export const LEAVE_TYPE_OPTIONS: LeaveTypeOption[] = [
    { value: 'vacation', label: 'ลาพักร้อน (Vacation)' },
    { value: 'sick', label: 'ลาป่วย (Sick Leave)' },
    { value: 'business', label: 'ลากิจ (Business Leave)' },
    { value: 'no_pay', label: 'ลาไม่รับค่าจ้าง (No Pay)' },
];

/** Approval workflow steps */
export const APPROVAL_STEPS: ApprovalStep[] = [
    { label: 'ส่งคำขอ', status: 'completed' },
    { label: 'หัวหน้างาน', status: 'pending' },
    { label: 'HR', status: 'pending' },
];

/** Mock status screen data for a demo request */
export const MOCK_REQUEST_STATUS = {
    type: 'ลาพักร้อน',
    statusLabel: 'กำลังดำเนินการ',
    dateRange: '24 ต.ค. - 26 ต.ค.',
    totalDays: '3 วัน',
    timeline: [
        {
            step: 'submitted',
            title: 'ส่งคำขอแล้ว',
            date: '10 ต.ค.',
            description: 'คำขอของคุณถูกส่งเข้าระบบเรียบร้อยแล้ว',
            status: 'completed' as const,
        },
        {
            step: 'supervisor',
            title: 'รอหัวหน้าอนุมัติ',
            statusLabel: 'รออนุมัติ',
            description: 'กำลังรอการอนุมัติ...',
            status: 'active' as const,
            approver: {
                name: 'สมชาย ใจดี',
                position: 'ผู้จัดการฝ่ายการตลาด',
                avatar: 'https://picsum.photos/id/237/200/200',
            },
        },
        {
            step: 'hr',
            title: 'รอ HR อนุมัติ',
            description: 'รอการอนุมัติจากหัวหน้างาน',
            status: 'pending' as const,
        },
    ],
};

/** Leave remaining info for CreateRequestScreen */
export const LEAVE_REMAINING = {
    vacation: 12,
};

/** Mock date/time for create request form */
export const MOCK_FORM_DATES = {
    startDisplay: '24 ต.ค., 09:00',
    endDisplay: '24 ต.ค., 13:00',
    leaveDuration: '2 วัน',
    otDuration: '4 ชม.',
};
