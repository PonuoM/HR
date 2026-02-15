# HR Mobile Connect - Project Documentation

เอกสารฉบับนี้สรุปภาพรวมของระบบ HR Mobile Connect ที่ได้ทำการพัฒนาส่วน Frontend (User Interface) เสร็จสิ้นแล้ว รวมถึงโครงสร้างไฟล์ คำแนะนำด้าน Technical Stack และการออกแบบฐานข้อมูล

## 1. สิ่งที่สร้างไปแล้ว (Implemented Features)

เราได้สร้างหน้าจอหลักและระบบการนำทาง (Navigation) โดยเน้น Mobile-First Experience ที่รองรับ Dark Mode ดังนี้:

1.  **Home Screen (Dashboard)**:
    *   แสดงข้อมูลผู้ใช้และรูปโปรไฟล์
    *   **Attendance Card**: การ์ดขนาดใหญ่สำหรับลงเวลาเข้างาน (Check-in) พร้อมแสดงเวลาและสถานที่
    *   **Leave Quota**: แสดงวันลาคงเหลือแบบเลื่อนแนวนอน (Horizontal Scroll)
    *   **Quick Menu**: ปุ่มลัดเข้าเมนูต่างๆ
    *   **News Preview**: แสดงข่าวประชาสัมพันธ์ล่าสุด

2.  **Create Request Screen (ระบบยื่นคำขอ)**:
    *   รองรับทั้งการลา (Leave) และการขอโอที (OT)
    *   ฟอร์มเลือกประเภท วันที่ เวลา และเหตุผล
    *   UI สำหรับแสดงขั้นตอนการอนุมัติ (Approval Timeline Steps)

3.  **Status Screen (ติดตามสถานะ)**:
    *   แสดงสถานะของคำขอ (Pending, Approved, Rejected)
    *   **Timeline View**: แสดงไทม์ไลน์การอนุมัติอย่างละเอียด ว่าเรื่องอยู่ที่ใคร (Supervisor -> HR)

4.  **News Screen (ข่าวประชาสัมพันธ์)**:
    *   ส่วนแสดงข่าวปักหมุด (Pinned News)
    *   News Feed รายการข่าวพร้อมจำนวน Like/Comment

5.  **Profile & Settings (โปรไฟล์และการตั้งค่า)**:
    *   **Menu Hub**: จุดรวมเมนูตั้งค่าและทางเข้า Admin (สำหรับผู้มีสิทธิ์)
    *   **Settings**: ระบบเปลี่ยนธีม (Dark Mode) และภาษา
    *   **Security**: จำลองระบบ **WebAuthn (Passkeys)** สำหรับการลงทะเบียนเข้าสู่ระบบด้วยลายนิ้วมือ/ใบหน้า
    *   **Help Center**: ศูนย์ช่วยเหลือและ FAQ

6.  **Admin Panel (Mobile Responsive)**:
    *   ออกแบบให้ใช้งานได้ดีทั้งบน Desktop และ Mobile Web
    *   **Dashboard**: ภาพรวมสถิติองค์กรและคำขอล่าสุด
    *   **Employee Management**: ค้นหาและจัดการข้อมูลพนักงาน
    *   **Content Management (CMS)**: จัดการข่าวสารและปักหมุดประกาศสำคัญ

7.  **Navigation & Layout**:
    *   **Bottom Navigation**: แถบเมนูด้านล่างที่ซ่อนอัตโนมัติเมื่ออยู่ในหน้าย่อย
    *   **Status Bar**: จำลอง Status bar ของมือถือ
    *   **Responsive Sidebar**: เมนูด้านข้างสำหรับหน้าจอ Desktop

---

## 2. โครงสร้างไฟล์ (Project Structure)

โครงสร้างถูกออกแบบให้เป็น Component-based เพื่อความง่ายในการดูแลรักษา โดยแยกส่วน Admin และ Settings ไว้อย่างชัดเจน

```
/
├── index.html              # Entry Point และการตั้งค่า Tailwind/Fonts
├── index.tsx               # React Root Render
├── App.tsx                 # Routing Logic และ Layout หลัก
├── types.ts                # TypeScript Interface definitions
├── metadata.json           # App Config & Permissions
├── components/             # Reusable Components
│   ├── BottomNav.tsx       # เมนูนำทางด้านล่าง
│   ├── Sidebar.tsx         # เมนูนำทางด้านข้าง (Desktop)
│   └── StatusBar.tsx       # ส่วนแสดงผลด้านบน (Signal/Time)
└── screens/                # หน้าจอหลักของแอปพลิเคชัน
    ├── HomeScreen.tsx      # หน้า Dashboard พนักงาน
    ├── CreateRequestScreen.tsx # หน้าฟอร์มยื่นคำขอ
    ├── StatusScreen.tsx    # หน้าติดตามสถานะ
    ├── NewsScreen.tsx      # หน้าข่าวประชาสัมพันธ์
    ├── ProfileScreen.tsx   # หน้าโปรไฟล์และเมนูหลัก
    ├── admin/              # ส่วนผู้ดูแลระบบ (Admin Modules)
    │   ├── AdminDashboardScreen.tsx
    │   ├── AdminEmployeeScreen.tsx
    │   └── AdminContentScreen.tsx
    └── settings/           # ส่วนการตั้งค่า (Settings Modules)
        ├── SettingsScreen.tsx
        ├── SecurityScreen.tsx
        └── HelpScreen.tsx
```

---

## 3. Recommended Tech Stack (เพื่อการพัฒนาต่อที่ง่ายที่สุด)

เพื่อให้ทีมสามารถพัฒนาต่อได้รวดเร็ว ดูแลรักษาง่าย และรองรับการขยายตัว แนะนำให้ใช้ Stack ดังนี้:

### **Option A: Modern Full-Stack (แนะนำสูงสุด)**
*   **Framework**: **Next.js** (React Framework)
    *   *เหตุผล*: จัดการ Routing ง่าย, มี API Routes ในตัว (ไม่ต้องทำ Backend แยก), ประสิทธิภาพสูง (SSR/ISR)
*   **Database & Auth**: **Supabase**
    *   *เหตุผล*: เป็นทางเลือก Open Source ของ Firebase แต่ใช้ PostgreSQL ซึ่งเหมาะกับระบบ HR ที่มี Relation ซับซ้อน มีระบบ Auth และ Storage ในตัว
*   **Styling**: **Tailwind CSS** (มีอยู่แล้ว)
*   **State Management**: **Zustand** (ง่ายกว่า Redux มาก)

### **Option B: Separate Backend (สำหรับองค์กรขนาดใหญ่)**
*   **Frontend**: React (Vite) + Tailwind
*   **Backend**: **NestJS** (Node.js) หรือ **Go (Golang)**
*   **Database**: PostgreSQL
*   **Communication**: REST API หรือ GraphQL

---

## 4. Database Schema (.sql)

นี่คือโครงสร้างฐานข้อมูล PostgreSQL ที่ออกแบบมารองรับ Logic ระบบ HR, Geofencing และ Approval Flow

```sql
-- 1. Users & Organization Structure
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'employee', -- 'employee', 'hr', 'manager', 'admin'
    department_id INTEGER REFERENCES departments(id),
    manager_id UUID REFERENCES users(id), -- Self-referencing for hierarchy
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Leave System Setup
CREATE TABLE leave_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL, -- 'Sick', 'Vacation', 'Business'
    default_quota_days INTEGER NOT NULL,
    is_lifetime_limit BOOLEAN DEFAULT FALSE -- For specific leaves like 'Ordination'
);

CREATE TABLE user_leave_quotas (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    leave_type_id INTEGER REFERENCES leave_types(id),
    year INTEGER NOT NULL,
    total_days DECIMAL(5,2) NOT NULL,
    used_days DECIMAL(5,2) DEFAULT 0,
    remaining_days DECIMAL(5,2) GENERATED ALWAYS AS (total_days - used_days) STORED,
    UNIQUE(user_id, leave_type_id, year)
);

-- 3. Requests & Approvals
CREATE TYPE request_status AS ENUM ('draft', 'pending_manager', 'pending_hr', 'approved', 'rejected', 'cancelled');

CREATE TABLE requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(20) NOT NULL, -- 'leave' or 'ot'
    leave_type_id INTEGER REFERENCES leave_types(id), -- Nullable if type is OT
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    total_days DECIMAL(5,2),
    reason TEXT,
    attachment_url TEXT,
    current_status request_status DEFAULT 'pending_manager',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE request_approvals (
    id SERIAL PRIMARY KEY,
    request_id UUID REFERENCES requests(id),
    approver_id UUID REFERENCES users(id),
    step_order INTEGER NOT NULL, -- 1 = Manager, 2 = HR
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    comment TEXT,
    updated_at TIMESTAMP
);

-- 4. Attendance & Geofencing
CREATE TABLE work_locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    radius_meters INTEGER DEFAULT 500
);

CREATE TABLE attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    check_in_lat DECIMAL(10,8),
    check_in_long DECIMAL(11,8),
    check_out_lat DECIMAL(10,8),
    check_out_long DECIMAL(11,8),
    is_offsite BOOLEAN DEFAULT FALSE,
    is_late BOOLEAN DEFAULT FALSE,
    date DATE DEFAULT CURRENT_DATE
);

-- 5. News & CMS
CREATE TABLE news_posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    author_id UUID REFERENCES users(id),
    is_pinned BOOLEAN DEFAULT FALSE,
    is_urgent BOOLEAN DEFAULT FALSE,
    target_department_id INTEGER REFERENCES departments(id), -- NULL for all
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    view_count INTEGER DEFAULT 0
);

CREATE TABLE news_interactions (
    id SERIAL PRIMARY KEY,
    news_id INTEGER REFERENCES news_posts(id),
    user_id UUID REFERENCES users(id),
    type VARCHAR(20) NOT NULL -- 'like', 'comment'
);
```