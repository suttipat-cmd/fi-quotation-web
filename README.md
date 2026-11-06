# Forward Insight Quotation Management

GitHub Pages frontend, Supabase Auth/PostgreSQL/RLS, and a Google Apps Script bridge for Google Drive PDF storage and email delivery.

## What is implemented

- Owner-scoped quotations with `ADMIN`, `SALE`, and `USER` roles.
- Database-generated concurrent-safe document numbers: `QTYYMM-0001`.
- Unlimited recurring and one-time items with `FIXED_PRICE`, `QUANTITY_X_UNIT_PRICE`, `INCLUDED`, and `MANUAL_AMOUNT` calculation modes.
- Item/quotation discount; VAT/WHT applied after discount; Thai amount-in-words preview.
- Draft, PDF confirmation, email confirmation, document status, revisions, email logs, and audit logs in the database model.
- PDF files live in Google Drive; Supabase stores file metadata only.

## Local run

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

The publishable key is safe to ship to the browser. Never add a Supabase secret/service-role key to a Vite environment variable or GitHub Pages.

## Required Supabase dashboard settings

1. In **Authentication > URL Configuration**, add `https://suttipat-cmd.github.io/fi-quotation-web/` as a redirect URL.
2. Configure the intended email provider and invite/sign up policy.
3. In **Edge Functions > Secrets**, add:

```text
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
GOOGLE_APPS_SCRIPT_SHARED_SECRET=<a-long-random-value>
```

The `quotation-operations` Edge Function is already deployed. It verifies the caller and RLS access before calling Apps Script.

## Deploy Apps Script

1. Create a standalone Apps Script project using the Google account that should send mail and own Drive files.
2. Copy `apps-script/Code.gs` into the project.
3. Create a Google Drive folder for quotation PDFs.
4. Upload the supplied Forward Insight PNG logo to Google Drive and copy its file ID.
5. In **Project Settings > Script properties**, add:

```text
DRIVE_FOLDER_ID=<the-folder-id>
SCRIPT_SHARED_SECRET=<the-same-long-random-value-as-Supabase>
LOGO_FILE_ID=<the-uploaded-logo-file-id>
BANK_ACCOUNT_NAME=<account-name-to-display-on-the-PDF>
BANK_NAME=<bank-name-to-display-on-the-PDF>
BANK_ACCOUNT_NUMBER=<account-number-to-display-on-the-PDF>
```

`LOGO_FILE_ID` and bank values can be changed later without editing code. The first two properties are required; the bank values are optional.

6. Deploy a new **Web app version**, execute as the owner, and grant access only as required for the Edge Function. Copy the `/exec` URL into `GOOGLE_APPS_SCRIPT_URL`.

## Deploy web

Push this branch to `main`, then enable **Settings > Pages > GitHub Actions**. The included workflow publishes the `dist` directory.

## Important operational note

The first user signing up as `suttipat@forwardinsight.co.th` becomes `ADMIN`; all other users start as `USER`. Promote users to `SALE` or `ADMIN` through Supabase after they are created, until the Settings user-management UI is added.

## Android update notices

The Android app checks `https://suttipat-cmd.github.io/fi-quotation-web/android-update.json` at launch and when returning to the foreground (at most once per 15 minutes after a successful check). No update is advertised while `public/android-update.json` has `enabled: false`. Checks fail quietly if the site is unreachable. The APK must be hosted on the existing GitHub Pages site under `/fi-quotation-web/android/`, with an HTTPS `.apk` URL.

To publish an update:

1. Increase `versionCode` and `versionName` in `android/app/build.gradle`, build the web assets and sync Android, then create a **release APK** signed with the same private signing key as earlier releases. Preserve and back up the keystore and passwords securely outside the repository. A debug-signed installation cannot be updated with a differently signed release APK; uninstalling it removes local app data.
2. Publish the signed APK to `https://suttipat-cmd.github.io/fi-quotation-web/android/<filename>.apk` through the existing Pages deployment and verify the download is accessible. Keep the APK out of Git history if preferred by adding it to the Pages artifact in a separate publishing workflow. Do not place signing keys or passwords in the site or repository.
3. Update `public/android-update.json` and deploy the site only after the file is available:

```json
{"schemaVersion":1,"enabled":true,"versionCode":3,"versionName":"1.2","downloadUrl":"https://suttipat-cmd.github.io/fi-quotation-web/android/fi-quotation-1.2.apk","notes":"รายละเอียดการปรับปรุง"}
```

Android requires users to confirm an installation from outside the Play Store. Test the APK on a device and verify the same application ID and signing certificate before publishing the manifest. This repository currently does not contain a signed release APK or an automated APK publishing workflow.

On the configured macOS development machine, `scripts/build-android-release.sh` builds the signed release with JDK 21. It reads the existing signing key and password from `~/Library/Application Support/FI Quotation/android-signing/`; do not commit or share either file. Keep an encrypted, access-controlled backup of both files away from this Mac: future updates must use the same signing key. The script sets the build JVM locale to avoid Android's ZIP date failure under the Thai Buddhist calendar.
