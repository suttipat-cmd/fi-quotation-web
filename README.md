# FI Quotation Web App v1.7.1

## v1.7.1 Auth Session Guard + Profiles RLS Fix

Release นี้แก้ปัญหาหลัง refresh browser แล้ว request ไปอ่าน `public.profiles` ด้วย role `anon` จนเกิด error:

```json
{
  "code": "42501",
  "message": "permission denied for table profiles",
  "hint": "Grant the required privileges to the current role with: GRANT SELECT ON public.profiles TO anon;"
}
```

> สำคัญ: ห้ามแก้ด้วยการ `GRANT SELECT ON public.profiles TO anon` เพราะเสี่ยงเปิดข้อมูลผู้ใช้ให้ public อ่านได้

## สิ่งที่แก้ใน v1.7.1

- แก้ Frontend Auth Boot ให้ไม่ query `profiles` ถ้าไม่มี `session.access_token`
- แก้ `handleLogin()` ให้ส่ง `data.session` เข้า boot flow แทนการส่งแค่ `data.user`
- แก้ `loadProfile()` ให้ validate session ก่อนทุกครั้ง
- ถ้า session หาย/ยังไม่พร้อม จะกลับหน้า Login แบบ clean โดยไม่ยิง `profiles` ด้วย role `anon`
- เพิ่ม SQL patch สำหรับ `profiles` RLS/GRANT เฉพาะ role `authenticated`
- ไม่เปิดสิทธิ์ `profiles` ให้ `anon`
- เพิ่ม helper function `public.fi_current_user_role()` เพื่อให้ policy admin/manager อ่าน profile สำหรับ dashboard/report ได้โดยไม่เกิด RLS recursion
- เพิ่ม cache busting เป็น `script.js?v=1.7.1` และ `style.css?v=1.7.1`

## ไฟล์ใน package

```text
index.html
style.css
script.js
README.md
TEST_CHECKLIST.md
supabase/
  patch_v1_7_1.sql
```

## วิธีติดตั้ง

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดไปทับใน repo `fi-quotation-web`
3. ไปที่ Supabase → SQL Editor
4. รันไฟล์นี้:

```text
supabase/patch_v1_7_1.sql
```

5. เปิด Live Server ทดสอบก่อน push
6. ถ้าผ่านแล้วค่อย push ขึ้น GitHub Pages

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Hotfix v1.7.1 auth session guard and profiles RLS"
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
1.7.1
```
