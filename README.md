# HR Mobile Connect

ระบบ HR สำหรับพนักงาน **Primapassion49** — เว็บแอปพลิเคชันแบบ Mobile-First พร้อม PWA รองรับการติดตั้งลงมือถือ

🌐 **Production:** [https://hr.prima49.com](https://hr.prima49.com)

---

## ✨ ฟีเจอร์หลัก

### 👤 สำหรับพนักงาน
- **ลงเวลาเข้า/ออก** — ด้วย GPS ตรวจสอบตำแหน่ง, ระบุสถานที่ (On-site / Off-site)
- **ยื่นลา / ขอ OT** — สร้างคำขอลา-ลาป่วย-ลากิจ-OT พร้อมแนบหลักฐาน
- **ติดตามสถานะคำขอ** — ดูสถานะอนุมัติแบบ 2 ขั้น (หัวหน้า → HR)
- **วันลาคงเหลือ** — สรุปโควต้าลาทุกประเภท (รายปี)
- **สลิปเงินเดือน** — ดูสลิปรายเดือนจาก Admin
- **ปฏิทินทำงาน** — แสดงวันลา, วันหยุดราชการ, สถานะเข้างาน, วันขาด
- **ข่าวประชาสัมพันธ์** — อ่านข่าวสาร/ประกาศจากบริษัท
- **การแจ้งเตือน** — แยกแท็บ อ่านแล้ว/ยังไม่อ่าน, ลบ, อ่านทั้งหมด
- **โปรไฟล์** — อัปโหลดรูปโปรไฟล์, เปลี่ยนรหัสผ่าน, Biometric login (Fingerprint/FaceID)
- **ธีมมืด/สว่าง** — ปรับ Dark Mode ได้

### 🛡️ สำหรับ Admin
- **แดชบอร์ด** — ภาพรวมพนักงาน, คำขอรออนุมัติ
- **จัดการพนักงาน** — เพิ่ม/แก้ไข/ระงับ/Reset Password, กำหนดหัวหน้าอนุมัติ 2 ขั้น
- **จัดการโควต้าลา** — กำหนดวันลาของทุกประเภท, ตั้งค่าตามอายุงาน (Seniority Tiers)
- **จัดการเนื้อหา (CMS)** — สร้าง/แก้ไขข่าว, จัดการประเภทลา (ไอคอน, สี, หน่วย)
- **อัปโหลดสลิปเงินเดือน** — อัปโหลดเป็นรายคน/รายเดือน
- **จัดการสถานที่ทำงาน** — เพิ่ม/แก้ไข Work Location (พิกัด GPS, รัศมี)
- **จัดการแผนก/ตำแหน่ง** — ตั้งเวลาเข้า-ออกงานรายแผนก
- **อนุมัติคำขอ** — อนุมัติ/ปฏิเสธ ลา/OT พร้อมดูหลักฐาน, Bypass ได้

### 📱 PWA
- ติดตั้งลงหน้าจอมือถือ (Add to Home Screen)
- Push Notification
- Offline caching (Service Worker)

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + TypeScript + Vite |
| **Styling** | Tailwind CSS (CDN) + Kanit Font |
| **Routing** | React Router v7 (HashRouter) |
| **Backend** | PHP (Native REST API) |
| **Database** | MySQL (utf8mb4) |
| **PWA** | Service Worker + Web Manifest |

---

## 📂 โครงสร้างโปรเจค

```
hr-mobile-connect/
├── api/                    # PHP REST API
│   ├── config.php          # DB config (dev)
│   ├── config.production.php # DB config (production)
│   ├── auth.php            # Login / เปลี่ยนรหัสผ่าน
│   ├── employees.php       # CRUD พนักงาน
│   ├── attendance.php      # ลงเวลาเข้า-ออก
│   ├── leave_requests.php  # คำขอลา/OT
│   ├── leave_types.php     # ประเภทการลา
│   ├── leave_quotas.php    # โควต้าลา
│   ├── calendar.php        # ข้อมูลปฏิทิน
│   ├── departments.php     # แผนก/ตำแหน่ง
│   ├── notifications.php   # การแจ้งเตือน
│   ├── news.php            # ข่าวสาร
│   ├── payslips.php        # สลิปเงินเดือน
│   ├── uploads.php         # อัปโหลดไฟล์
│   ├── work_locations.php  # สถานที่ทำงาน
│   └── schema.sql          # Database schema ทั้งหมด
├── screens/                # หน้าจอทั้งหมด
│   ├── HomeScreen.tsx      # หน้าแรก (Dashboard)
│   ├── LoginScreen.tsx     # หน้า Login
│   ├── CalendarScreen.tsx  # ปฏิทิน
│   ├── CreateRequestScreen.tsx  # ยื่นลา/OT
│   ├── StatusScreen.tsx    # สถานะคำขอ
│   ├── NewsScreen.tsx      # ข่าวสาร
│   ├── PayslipScreen.tsx   # สลิปเงินเดือน
│   ├── ProfileScreen.tsx   # โปรไฟล์
│   ├── admin/              # หน้า Admin ทั้งหมด
│   └── settings/           # ตั้งค่า, ความปลอดภัย, ช่วยเหลือ
├── components/             # Components ที่ใช้ซ้ำ
├── services/api.ts         # API Service Layer
├── contexts/AuthContext.tsx # Authentication Context
├── database/               # SQL Migrations
├── public/                 # PWA assets (manifest, sw.js, icons)
├── build-host.js           # Build script สำหรับ production
├── vite.config.ts          # Vite config (dev + host mode)
└── package.json
```

---

## 🚀 การติดตั้ง (Development)

### 1. ติดตั้ง Dependencies

```bash
npm install
```

### 2. สร้าง Database

สร้าง database `hr_mobile_connect` แล้วรัน:

```bash
# รัน schema หลัก
mysql -u root -p hr_mobile_connect < api/schema.sql

# รัน migrations ทั้งหมด
php database/run_migration.php
```

### 3. ตั้งค่า Database (Dev)

แก้ไขไฟล์ `api/config.php`:

```php
$DB_HOST = 'localhost';
$DB_USER = 'root';
$DB_PASS = 'your_password';
$DB_NAME = 'hr_mobile_connect';
```

### 4. รัน Dev Server

```bash
npm run dev
```

เปิดเบราว์เซอร์ที่ `http://localhost:3000`

> ⚠️ ต้องมี Apache/PHP รันอยู่ที่ port 80 สำหรับ API (Vite proxy `/hr-mobile-connect/api` → `localhost:80`)

### 5. Login เริ่มต้น

- **รหัสพนักงาน:** (ตามที่สร้างใน DB)
- **รหัสผ่านเริ่มต้น:** `1234`

---

## 🏗️ Build & Deploy (Production)

### 1. Build

```bash
npm run host:build
```

จะสร้างโฟลเดอร์ `host-build/` ที่รวมทุกอย่าง:
- Frontend (Vite build) — ทุก path ใช้ `/HR/` prefix
- Backend (PHP API) — ใช้ credentials production อัตโนมัติ
- PWA (manifest, service worker, icons)
- `.htaccess` สำหรับ SPA routing

### 2. Upload ขึ้น Server

อัปโหลด **เนื้อหาทั้งหมด** ใน `host-build/` ไปที่:

```
/domains/prima49.com/public_html/HR/
```

### 3. ตั้งค่า Server

- ✅ Apache + PHP + MySQL
- ✅ `mod_rewrite` ต้องเปิด
- ✅ สร้าง database `primacom_hr_mobile_connect`
- ✅ รัน `schema.sql` และ migrations ทั้งหมด
- ✅ โฟลเดอร์ `uploads/` ต้อง writable (`chmod 755`)

### 4. Database Production

```
Host:     localhost
Database: primacom_hr_mobile_connect
Username: primacom_bloguser
Password: pJnL53Wkhju2LaGPytw8
```

---

## 📝 คำสั่งที่ใช้บ่อย

| คำสั่ง | คำอธิบาย |
|--------|----------|
| `npm run dev` | รัน dev server (port 3000) |
| `npm run build` | Build frontend ปกติ |
| `npm run host:build` | Build ทั้งหมดสำหรับ production |
| `npm run preview` | Preview build ที่ build แล้ว |

---

## 📄 License

Private — Primapassion49 Internal Use Only