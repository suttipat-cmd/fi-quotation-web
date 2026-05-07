# FI Quotation Web App v1.7.2

## v1.7.2 Stability Fix

Release นี้แก้ปัญหาเสถียรภาพ 2 จุดหลักจาก v1.7.1:

1. Refresh browser แล้ว Auth boot/session guard ทำงานแรงเกินไปจนกลับหน้า Login พร้อม console error `AUTH_SESSION_MISSING`
2. กด `+ เพิ่มสินค้า` แล้วเกิด `RangeError: Maximum call stack size exceeded` จาก `renderProductFormPage()` เรียกตัวเองวนซ้ำ

## สิ่งที่แก้ใน v1.7.2

- เอา timeout ออกจาก initial `getSession()` ตอนเปิดระบบ
- ถ้าไม่มี session ให้กลับหน้า Login แบบ clean โดยไม่ถือเป็น system error
- ไม่เรียก `loadProfile()` ถ้าไม่มี `session.access_token`
- ปรับ `loadProfile(session)` ให้รับ session ที่แน่นอนและยิง `profiles` เฉพาะตอน authenticated แล้วเท่านั้น
- Resume recovery จะไม่ทำงานบนหน้า Login
- จำ hash เดิม เช่น `#customers`, `#products`, `#product-new` ไว้ และหลัง login สำเร็จจะกลับไปหน้าที่ต้องการ
- แก้ `renderProductFormPage()` ไม่ให้ wrap/เรียกตัวเองอีก
- `Product Code` ซ้ำได้ แต่ `ชื่อสินค้า/บริการ` ยังต้องไม่ซ้ำตาม requirement
- เพิ่ม cache busting เป็น `script.js?v=1.7.2` และ `style.css?v=1.7.2`

## ไฟล์ใน package

```text
index.html
style.css
script.js
README.md
TEST_CHECKLIST.md
supabase/
  patch_v1_7_2.sql
```

## วิธีติดตั้ง

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดไปทับใน repo `fi-quotation-web`
3. ไปที่ Supabase → SQL Editor
4. รันไฟล์นี้:

```text
supabase/patch_v1_7_2.sql
```

5. เปิด Live Server ทดสอบก่อน push
6. ถ้าผ่านแล้วค่อย push ขึ้น GitHub Pages

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Hotfix v1.7.2 auth boot and product form stability"
git push origin main
```

## หลัง Push ขึ้น GitHub Pages

ทำ hard refresh 1 ครั้ง:

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
1.7.2
```
