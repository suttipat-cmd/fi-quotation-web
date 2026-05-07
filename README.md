# FI Quotation Web App v1.9.0

## v1.9.0 Clean Codebase Stabilization

Release นี้ต่อยอดจาก v1.8.0 Corrected Integration Build โดยโฟกัสที่การจัด Core Lifecycle ให้คาดเดาได้มากขึ้น และลดความเสี่ยงของ bug กลุ่มเดิม เช่น boot ค้าง, login ค้าง, refresh แล้วหลุด flow, route/render ซ้อนกัน และ product form recursion

> หมายเหตุ: v1.9.0 ยังรักษา feature parity จาก v1.8.0 ไว้ก่อน จึงยังไม่ได้ rewrite ทุก feature ให้เป็น module แยกไฟล์ทั้งหมด แต่เพิ่ม final stabilization layer ที่เป็น Auth / Router / Render flow หลักชุดเดียวสำหรับ runtime

## สิ่งที่ปรับใน v1.9.0

- อัปเดต cache busting เป็น `script.js?v=1.9.0` และ `style.css?v=1.9.0`
- เพิ่ม `window.FI_APP_VERSION = "1.9.0"`
- เพิ่ม route table กลาง `FI_ROUTES_V19` สำหรับ page routing หลัก
- ปรับ Auth / Login / Logout / Resume flow ชุดสุดท้ายให้คาดเดาได้มากขึ้น
- ป้องกันหน้า boot ค้าง โดยซ่อน boot page ตั้งแต่ init และให้ Login พร้อมใช้งานเสมอ
- Login button reset ทุก success/error/timeout path
- `loadProfile(session)` ต้องมี session/access token ก่อน query `profiles`
- `renderCurrentPage()` ตรวจ role ผ่าน route table ก่อน render
- Error state มีปุ่ม `โหลดข้อมูลใหม่` และ `กลับแดชบอร์ด`
- คง feature เดิมจาก v1.8.0 corrected ไว้ เช่น Quotation, Product, Print, Excel Export, Settings, Logo/Branding, Required star และ Status actions

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
  patch_v1_9_0.sql
```

## วิธีติดตั้ง

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. ไปที่ Supabase → SQL Editor
4. รันไฟล์ `supabase/patch_v1_9_0.sql`
5. เปิด Live Server ทดสอบก่อน push

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Release v1.9.0 clean codebase stabilization"
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
1.9.0
```

## หมายเหตุสำคัญ

ถ้า v1.9.0 ผ่าน QA แล้ว เวอร์ชันถัดไปที่เหมาะสมคือ v2.0 แยกไฟล์/โมดูลจริง เช่น `auth.js`, `router.js`, `quotations.js`, `products.js`, `ui.js` และเริ่มเพิ่ม automated smoke test เพื่อกัน regression
