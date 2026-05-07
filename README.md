# FI Quotation Web App v1.8.0 Corrected Integration Build

## เป้าหมายของ v1.8.0 รอบแก้ไข

รอบนี้สร้างจากไฟล์ v1.7.4 ที่แนบมาเป็นฐาน เพื่อไม่ให้ feature เดิมหายเหมือน build v1.8.0 ชุดก่อนหน้า แล้วเพิ่มชั้นแก้ไข Core Lifecycle ใหม่ด้านท้ายไฟล์ `script.js`

## สิ่งที่แก้

- อัปเดต cache busting เป็น `script.js?v=1.8.0` และ `style.css?v=1.8.0`
- ไม่ block หน้าเปิดระบบด้วย `getSession()` อีกต่อไป
- เปิดหน้า Login ให้ใช้งานได้ทันทีหลัง refresh หาก session ยังไม่พร้อม
- ใช้ `onAuthStateChange` เพื่อ boot เข้า app ถ้ามี session จริง
- ป้องกันปุ่ม Login ค้างโดย reset ปุ่มในทุกเส้นทางสำเร็จ/ผิดพลาด/timeout
- ไม่เรียก `loadProfile()` หากไม่มี `session.access_token`
- `renderCurrentPage()` ไม่พยายาม bootstrap session เองอีก ลด loop ระหว่าง route/render/login
- คง feature v1.7.4 ไว้ครบ เช่น Product form, Quotation, Dashboard, Print, Settings, Excel export, Logo settings, Required star, Status actions
- เพิ่ม SQL patch v1.8.0 สำหรับ profiles RLS, product code duplicate, product name unique index

## ไฟล์ใน package

```text
index.html
style.css
script.js
README.md
TEST_CHECKLIST.md
supabase/
  patch_v1_7_2.sql
  patch_v1_8_0.sql
```

## วิธีติดตั้ง

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. ไปที่ Supabase → SQL Editor
4. รันไฟล์ `supabase/patch_v1_8_0.sql`
5. เปิด Live Server ทดสอบก่อน push

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Release v1.8.0 corrected integration build"
git push origin main
```

## หลัง Push ขึ้น GitHub Pages

ทำ hard refresh:

```text
Mac: Command + Shift + R
Windows: Ctrl + Shift + R
```

## ตรวจเวอร์ชันใน Console

```js
window.FI_APP_VERSION
```

ต้องได้:

```text
1.8.0
```

## หมายเหตุสำคัญ

รอบนี้ตั้งใจแก้จาก v1.7.4 โดยไม่ตัด feature เดิมออก จึงยังเก็บ legacy code block เดิมไว้เพื่อความครบถ้วนของระบบ แต่ Core Auth/Login/Render lifecycle ชุดสุดท้ายของ v1.8.0 จะ override การทำงานหลักเพื่อลดอาการ boot/login ค้าง

ถ้าต้องการ clean code ระยะยาวจริง ๆ แนะนำทำ v1.9 แบบค่อย ๆ แยกไฟล์/โมดูล และทดสอบ regression ทีละส่วน แทนการ rewrite ใหญ่รอบเดียว
