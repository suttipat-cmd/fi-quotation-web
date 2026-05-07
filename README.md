# FI Quotation Web App v1.7.4

## v1.7.4 Login Timeout Guard + Non-blocking Boot

Release นี้แก้ปัญหาหลังรีเฟรชแล้วระบบกลับหน้า Login จากนั้นกดเข้าสู่ระบบแล้วปุ่มค้างที่ “กำลังเข้าสู่ระบบ...” ไม่สามารถใช้งานต่อได้

## สิ่งที่แก้

- แยกขั้นตอน Login ออกจากการ Render หน้า เพื่อไม่ให้ปุ่ม Login ค้างถ้าหน้าปลายทางโหลดช้า
- เพิ่ม timeout เฉพาะ signIn และ loadProfile เพื่อให้ปุ่ม Login คืนสถานะเสมอ
- หลัง Login สำเร็จจะเข้า App Shell ก่อน แล้วค่อยโหลดหน้าปัจจุบันแบบ background
- ถ้า session ไม่มีหลัง refresh จะกลับหน้า Login แบบ clean ไม่ถือเป็น error หนัก
- Auth boot ไม่ค้างหน้า “กำลังเปิดระบบ”
- คง fix v1.7.2/v1.7.3 ไว้ เช่น Product Form recursion และ Profiles RLS guard
- เพิ่ม cache busting เป็น `script.js?v=1.7.4` และ `style.css?v=1.7.4`

## ไฟล์ใน package

```text
index.html
style.css
script.js
README.md
TEST_CHECKLIST.md
supabase/
  patch_v1_7_2.sql
  patch_v1_7_4.sql
```

## วิธีติดตั้ง

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดไปทับใน repo `fi-quotation-web`
3. ถ้าเคยรัน `patch_v1_7_2.sql` แล้ว รอบนี้ไม่จำเป็นต้องรัน SQL เพิ่ม
4. เปิด Live Server หรือ GitHub Pages แล้ว hard refresh

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Hotfix v1.7.4 login timeout guard"
git push origin main
```

## ตรวจเวอร์ชันใน Console

```js
window.FI_APP_VERSION
```

ต้องได้:

```text
1.7.4
```
