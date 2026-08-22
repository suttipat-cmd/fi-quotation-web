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
