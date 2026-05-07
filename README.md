# FI Quotation Web App v1.7.0

## v1.7.0 Clean Stabilization Build

Release นี้โฟกัสแก้ปัญหาเสถียรภาพหลัง v1.6.2 โดยไม่เพิ่ม feature ใหม่ จุดหลักคือแก้ระบบ Login/Auth Boot, ปัญหา `applySystemBrandingToHeader is not defined`, และปัญหา Supabase `permission denied for table profiles` ที่ทำให้ Dashboard ค้างอยู่ที่ “กำลังโหลดข้อมูล...”

## สิ่งที่แก้ใน v1.7.0

- เพิ่ม compatibility function `applySystemBrandingToHeader()` เพื่อหยุด JavaScript runtime crash หลัง login
- ปรับ `showAppShell()` ให้ปลอดภัยขึ้นและไม่เรียก function ที่ไม่มีอยู่จริง
- ปรับ `loadProfile()` ให้แสดง error ที่ชัดเจนถ้า `profiles` ยังไม่มีสิทธิ์อ่าน
- ปรับ Auth Boot ให้ session เก่าที่เสียไม่ทำให้ Login page ค้าง error ผิดบริบท
- ปรับ Resume Recovery หลังกลับจาก tab อื่นให้ render หน้าเดิมใหม่โดยไม่ค้าง loading
- เพิ่ม cache busting เป็น `script.js?v=1.7.0` และ `style.css?v=1.7.0`
- เพิ่ม SQL patch `supabase/patch_v1_7_0.sql` สำหรับ `profiles` GRANT/RLS
- คง feature เดิมจาก v1.6.x เช่น required `*` สีแดง, Product Code ซ้ำได้แต่ Product Name ห้ามซ้ำ, Excel Export 5 sheets, และ Print Layout v1.5.x

## ไฟล์ใน package

```text
index.html
style.css
script.js
README.md
TEST_CHECKLIST.md
supabase/
  patch_v1_5.sql
  patch_v1_5_1.sql
  patch_v1_6.sql
  patch_v1_6_1.sql
  patch_v1_6_2.sql
  patch_v1_7_0.sql
```

## วิธีติดตั้ง

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดไปทับใน repo `fi-quotation-web`
3. ไปที่ Supabase → SQL Editor
4. รันไฟล์นี้:

```text
supabase/patch_v1_7_0.sql
```

> สำคัญ: รอบนี้ต้องรัน SQL เพราะ error ล่าสุดมี `permission denied for table profiles`

5. เปิด Live Server ทดสอบก่อน push
6. ถ้าทดสอบผ่านแล้วค่อย push ขึ้น GitHub Pages

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Release v1.7.0 stabilization build"
git push origin main
```

## หลัง Push ขึ้น GitHub Pages

ให้ทำ hard refresh 1 ครั้ง:

```text
Mac: Command + Shift + R
Windows: Ctrl + Shift + R
```

## ตรวจเวอร์ชันใน Console

เปิด DevTools → Console แล้วรัน:

```js
window.FI_APP_VERSION
```

ต้องได้:

```text
1.7.0
```
