-- Forward Insight quotation management: initial relational model and RLS.
create schema if not exists app;
revoke all on schema app from public;

create extension if not exists pgcrypto;

create type public.app_role as enum ('ADMIN', 'SALE', 'USER');
create type public.quotation_status as enum ('DRAFT', 'READY', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');
create type public.item_category as enum ('RECURRING', 'ONE_TIME');
create type public.calculation_mode as enum ('FIXED_PRICE', 'QUANTITY_X_UNIT_PRICE', 'INCLUDED', 'MANUAL_AMOUNT');
create type public.discount_type as enum ('NONE', 'PERCENTAGE', 'FIXED_AMOUNT');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role public.app_role not null default 'USER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_settings (
  id boolean primary key default true check (id),
  company_name text not null default 'บริษัท ฟอร์เวิร์ด อินไซท์ จำกัด',
  company_name_en text default 'Forward Insight Co., Ltd.',
  tax_id text,
  branch text default 'สำนักงานใหญ่',
  address text,
  phone text,
  email text,
  website text,
  logo_url text,
  default_vat_rate numeric(5,2) not null default 7 check (default_vat_rate between 0 and 100),
  default_wht_rate numeric(5,2) not null default 3 check (default_wht_rate between 0 and 100),
  default_validity_days integer not null default 30 check (default_validity_days between 1 and 365),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.company_settings (id) values (true) on conflict (id) do nothing;

create table public.services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  default_description text,
  default_category public.item_category not null default 'RECURRING',
  default_billing_type text not null default 'MONTHLY',
  default_calculation_mode public.calculation_mode not null default 'FIXED_PRICE',
  default_unit text,
  suggested_price_satang bigint check (suggested_price_satang >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_terms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  body text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.note_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  body text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  branch text,
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index bank_accounts_one_default_idx on public.bank_accounts (is_default) where is_default;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  name text not null,
  tax_id text,
  branch text,
  address text,
  default_payment_term_id uuid references public.payment_terms(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id)
);
create index customers_owner_id_idx on public.customers(owner_id);
create index customers_name_idx on public.customers using gin (to_tsvector('simple', name));

create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  position text,
  email text,
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_contacts_customer_id_idx on public.customer_contacts(customer_id);

create table public.quote_counters (
  period char(4) primary key,
  last_value integer not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now()
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  document_no text not null,
  revision_no integer not null default 0 check (revision_no >= 0),
  root_quotation_id uuid references public.quotations(id),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  status public.quotation_status not null default 'DRAFT',
  issued_at date not null default current_date,
  valid_until date not null default (current_date + 30),
  customer_id uuid references public.customers(id),
  customer_name text not null,
  customer_tax_id text,
  customer_branch text,
  customer_address text,
  contact_name text,
  contact_position text,
  contact_email text,
  contact_phone text,
  sales_name text,
  quotation_discount_type public.discount_type not null default 'NONE',
  quotation_discount_value numeric(12,2) not null default 0 check (quotation_discount_value >= 0),
  quotation_discount_satang bigint not null default 0 check (quotation_discount_satang >= 0),
  vat_rate numeric(5,2) not null default 7 check (vat_rate between 0 and 100),
  wht_rate numeric(5,2) not null default 3 check (wht_rate between 0 and 100),
  subtotal_satang bigint not null default 0 check (subtotal_satang >= 0),
  tax_base_satang bigint not null default 0 check (tax_base_satang >= 0),
  vat_amount_satang bigint not null default 0 check (vat_amount_satang >= 0),
  wht_amount_satang bigint not null default 0 check (wht_amount_satang >= 0),
  net_amount_satang bigint not null default 0 check (net_amount_satang >= 0),
  notes text,
  payment_terms text,
  bank_account_id uuid references public.bank_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id),
  updated_by uuid references public.profiles(id),
  constraint quotation_validity_check check (valid_until >= issued_at)
);
create unique index quotations_document_revision_key on public.quotations(document_no, revision_no);
create index quotations_owner_status_idx on public.quotations(owner_id, status, issued_at desc);
create index quotations_customer_name_idx on public.quotations using gin (to_tsvector('simple', customer_name));
create index quotations_document_no_idx on public.quotations(document_no);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  category public.item_category not null,
  service_id uuid references public.services(id),
  service_code text,
  service_name text not null,
  description text,
  billing_type text not null,
  calculation_mode public.calculation_mode not null,
  reference_quantity numeric(12,2),
  quantity numeric(12,2),
  unit text,
  unit_price_satang bigint check (unit_price_satang >= 0),
  manual_amount_satang bigint check (manual_amount_satang >= 0),
  discount_type public.discount_type not null default 'NONE',
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  discount_amount_satang bigint not null default 0 check (discount_amount_satang >= 0),
  line_subtotal_satang bigint not null default 0 check (line_subtotal_satang >= 0),
  line_net_satang bigint not null default 0 check (line_net_satang >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotation_items_quote_id_idx on public.quotation_items(quotation_id, category, sort_order);

create table public.quotation_revisions (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  revision_no integer not null,
  snapshot jsonb not null,
  pdf_drive_file_id text unique,
  pdf_drive_url text,
  pdf_generated_at timestamptz,
  generated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (quotation_id, revision_no)
);
create index quotation_revisions_quote_id_idx on public.quotation_revisions(quotation_id, revision_no desc);

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  revision_id uuid references public.quotation_revisions(id),
  recipient_to text[] not null default '{}',
  recipient_cc text[] not null default '{}',
  recipient_bcc text[] not null default '{}',
  subject text not null,
  message text,
  status text not null check (status in ('SENT', 'FAILED')),
  error_message text,
  sent_by uuid references public.profiles(id),
  sent_at timestamptz not null default now()
);
create index email_logs_quotation_id_idx on public.email_logs(quotation_id, sent_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references public.quotations(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_quotation_id_idx on public.audit_logs(quotation_id, created_at desc);

create or replace function app.set_updated_at()
returns trigger language plpgsql security invoker as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function app.next_document_no(p_date date)
returns text language plpgsql security definer set search_path = public, app as $$
declare
  v_period char(4) := to_char(p_date, 'YYMM');
  v_sequence integer;
begin
  insert into public.quote_counters as c (period, last_value)
  values (v_period, 1)
  on conflict (period) do update set last_value = c.last_value + 1, updated_at = now()
  returning last_value into v_sequence;
  return 'QT' || v_period || '-' || lpad(v_sequence::text, 4, '0');
end;
$$;

create or replace function app.assign_quotation_defaults()
returns trigger language plpgsql security definer set search_path = public, app as $$
declare v_days integer;
begin
  if new.issued_at is null then new.issued_at := current_date; end if;
  select default_validity_days into v_days from public.company_settings where id = true;
  if new.valid_until is null then new.valid_until := new.issued_at + coalesce(v_days, 30); end if;
  if new.root_quotation_id is null then
    new.document_no := app.next_document_no(new.issued_at);
    new.revision_no := 0;
  end if;
  return new;
end;
$$;

create or replace function app.is_admin()
returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'ADMIN');
$$;

create or replace function app.can_access_quotation(p_quote_id uuid)
returns boolean language sql stable security definer set search_path = public, app as $$
  select app.is_admin() or exists (
    select 1 from public.quotations q where q.id = p_quote_id and q.owner_id = (select auth.uid())
  );
$$;

create or replace function app.can_edit_draft(p_quote_id uuid)
returns boolean language sql stable security definer set search_path = public, app as $$
  select app.is_admin() or exists (
    select 1 from public.quotations q
    where q.id = p_quote_id and q.owner_id = (select auth.uid()) and q.status = 'DRAFT'
  );
$$;

create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, app, auth as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when lower(coalesce(new.email, '')) = 'suttipat@forwardinsight.co.th' then 'ADMIN'::public.app_role else 'USER'::public.app_role end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.change_quotation_status(p_quotation_id uuid, p_status public.quotation_status)
returns public.quotations language plpgsql security definer set search_path = public, app as $$
declare v_quote public.quotations;
begin
  select * into v_quote from public.quotations where id = p_quotation_id for update;
  if not found or not (app.is_admin() or v_quote.owner_id = (select auth.uid())) then
    raise exception 'Quotation not found or access denied';
  end if;
  if not (
    (v_quote.status = 'DRAFT' and p_status in ('READY', 'CANCELLED')) or
    (v_quote.status = 'READY' and p_status in ('SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED')) or
    (v_quote.status = 'SENT' and p_status in ('ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'))
  ) then
    raise exception 'Invalid status transition from % to %', v_quote.status, p_status;
  end if;
  update public.quotations set status = p_status, updated_at = now(), updated_by = (select auth.uid()) where id = p_quotation_id returning * into v_quote;
  insert into public.audit_logs (quotation_id, actor_id, action, metadata)
  values (p_quotation_id, (select auth.uid()), 'STATUS_CHANGED', jsonb_build_object('status', p_status));
  return v_quote;
end;
$$;

create or replace function public.create_quotation_revision(p_quotation_id uuid)
returns public.quotations language plpgsql security definer set search_path = public, app as $$
declare v_source public.quotations; v_new public.quotations;
begin
  select * into v_source from public.quotations where id = p_quotation_id for update;
  if not found or not (app.is_admin() or v_source.owner_id = (select auth.uid())) then
    raise exception 'Quotation not found or access denied';
  end if;
  if v_source.status = 'DRAFT' then
    raise exception 'Create a revision only after the original quotation has left DRAFT';
  end if;
  insert into public.quotations (
    document_no, revision_no, root_quotation_id, owner_id, status, issued_at, valid_until,
    customer_id, customer_name, customer_tax_id, customer_branch, customer_address,
    contact_name, contact_position, contact_email, contact_phone, sales_name,
    quotation_discount_type, quotation_discount_value, quotation_discount_satang,
    vat_rate, wht_rate, subtotal_satang, tax_base_satang, vat_amount_satang, wht_amount_satang,
    net_amount_satang, notes, payment_terms, bank_account_id, created_by, updated_by
  ) values (
    v_source.document_no, v_source.revision_no + 1, coalesce(v_source.root_quotation_id, v_source.id),
    (select auth.uid()), 'DRAFT', current_date, current_date + 30,
    v_source.customer_id, v_source.customer_name, v_source.customer_tax_id, v_source.customer_branch, v_source.customer_address,
    v_source.contact_name, v_source.contact_position, v_source.contact_email, v_source.contact_phone, v_source.sales_name,
    v_source.quotation_discount_type, v_source.quotation_discount_value, v_source.quotation_discount_satang,
    v_source.vat_rate, v_source.wht_rate, v_source.subtotal_satang, v_source.tax_base_satang, v_source.vat_amount_satang, v_source.wht_amount_satang,
    v_source.net_amount_satang, v_source.notes, v_source.payment_terms, v_source.bank_account_id, (select auth.uid()), (select auth.uid())
  ) returning * into v_new;
  insert into public.quotation_items (
    quotation_id, category, service_id, service_code, service_name, description, billing_type, calculation_mode,
    reference_quantity, quantity, unit, unit_price_satang, manual_amount_satang, discount_type, discount_value,
    discount_amount_satang, line_subtotal_satang, line_net_satang, sort_order
  ) select v_new.id, category, service_id, service_code, service_name, description, billing_type, calculation_mode,
    reference_quantity, quantity, unit, unit_price_satang, manual_amount_satang, discount_type, discount_value,
    discount_amount_satang, line_subtotal_satang, line_net_satang, sort_order
  from public.quotation_items where quotation_id = v_source.id;
  insert into public.audit_logs (quotation_id, actor_id, action, metadata)
  values (v_new.id, (select auth.uid()), 'REVISION_CREATED', jsonb_build_object('source_quotation_id', v_source.id, 'revision_no', v_new.revision_no));
  return v_new;
end;
$$;

create or replace function app.audit_quotation_change()
returns trigger language plpgsql security definer set search_path = public, app as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (quotation_id, actor_id, action, metadata)
    values (new.id, new.created_by, 'QUOTATION_CREATED', jsonb_build_object('document_no', new.document_no));
  elsif old.status is distinct from new.status then
    insert into public.audit_logs (quotation_id, actor_id, action, metadata)
    values (new.id, new.updated_by, 'STATUS_CHANGED', jsonb_build_object('from', old.status, 'to', new.status));
  else
    insert into public.audit_logs (quotation_id, actor_id, action, metadata)
    values (new.id, new.updated_by, 'QUOTATION_UPDATED', '{}'::jsonb);
  end if;
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function app.set_updated_at();
create trigger services_updated_at before update on public.services for each row execute function app.set_updated_at();
create trigger payment_terms_updated_at before update on public.payment_terms for each row execute function app.set_updated_at();
create trigger note_presets_updated_at before update on public.note_presets for each row execute function app.set_updated_at();
create trigger bank_accounts_updated_at before update on public.bank_accounts for each row execute function app.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function app.set_updated_at();
create trigger customer_contacts_updated_at before update on public.customer_contacts for each row execute function app.set_updated_at();
create trigger quotations_updated_at before update on public.quotations for each row execute function app.set_updated_at();
create trigger quotation_items_updated_at before update on public.quotation_items for each row execute function app.set_updated_at();
create trigger quotations_assign_defaults before insert on public.quotations for each row execute function app.assign_quotation_defaults();
create trigger quotations_audit after insert or update on public.quotations for each row execute function app.audit_quotation_change();
create trigger on_auth_user_created after insert on auth.users for each row execute function app.handle_new_user();

-- Existing historical data is deliberately not imported. These are editable operational defaults only.
insert into public.services (code, name, default_category, default_billing_type, default_calculation_mode, default_unit, suggested_price_satang, sort_order) values
  ('ERP_TRANSPORT', 'ERP ขนส่ง', 'RECURRING', 'MONTHLY', 'FIXED_PRICE', 'คัน', 450000, 10),
  ('MAINTENANCE', 'อู่ซ่อมบำรุง', 'RECURRING', 'MONTHLY', 'FIXED_PRICE', 'คัน', null, 20),
  ('AI', 'AI', 'RECURRING', 'MONTHLY', 'FIXED_PRICE', 'เดือน', null, 30),
  ('WMS', 'WMS', 'RECURRING', 'MONTHLY', 'FIXED_PRICE', 'เดือน', null, 40),
  ('VEHICLE_SETUP', 'Setup ทะเบียนรถ', 'ONE_TIME', 'ONE_TIME', 'FIXED_PRICE', 'ครั้ง', 450000, 50),
  ('DATA_SETUP', 'Setup ข้อมูลทั่วไป', 'ONE_TIME', 'ONE_TIME', 'FIXED_PRICE', 'ครั้ง', null, 60),
  ('ONSITE_TRAINING', 'Onsite Training', 'ONE_TIME', 'ONE_TIME', 'QUANTITY_X_UNIT_PRICE', 'ครั้ง', null, 70),
  ('CUSTOM_FORM', 'Custom Form', 'ONE_TIME', 'ONE_TIME', 'QUANTITY_X_UNIT_PRICE', 'แบบฟอร์ม', 300000, 80)
on conflict (code) do nothing;

insert into public.payment_terms (name, body, sort_order) values
  ('Monthly Service Standard', 'ค่าบริการรายเดือนชำระทุกวันที่ 1 ของเดือน โดยเริ่มชำระเมื่อทำการย้ายข้อมูล', 10),
  ('Setup Fee 100% Before Start', 'ค่านำเข้าข้อมูลเดิมและค่าฝึกอบรม ชำระ 100% เมื่อทำสัญญา', 20),
  ('Annual Service Standard', 'การชำระรายปีเป็นไปตามเงื่อนไขที่ระบุในใบเสนอราคา', 30)
on conflict (name) do nothing;

insert into public.note_presets (name, body, sort_order) values
  ('Annual Promotion', 'ชำระรายปี รับสิทธิ์ใช้งานเพิ่มตามเงื่อนไขที่ระบุในใบเสนอราคา', 10),
  ('Additional Vehicle', 'กรณีเพิ่มรถ คิดค่าบริการต่อคันตามที่ระบุในใบเสนอราคา', 20),
  ('Additional User', 'จำนวนผู้ใช้งานและค่าบริการผู้ใช้เพิ่มเติมเป็นไปตามที่ระบุในใบเสนอราคา', 30),
  ('Custom Form', 'การปรับแก้หรือจัดทำแบบฟอร์มเฉพาะนอกเหนือจากมาตรฐานของระบบ มีค่าพัฒนาตามที่ระบุในใบเสนอราคา', 40)
on conflict (name) do nothing;

alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.services enable row level security;
alter table public.payment_terms enable row level security;
alter table public.note_presets enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.quote_counters enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.quotation_revisions enable row level security;
alter table public.email_logs enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.profiles, public.company_settings, public.services, public.payment_terms, public.note_presets, public.bank_accounts, public.customers, public.customer_contacts, public.quotations, public.quotation_items, public.quotation_revisions, public.email_logs, public.audit_logs to authenticated;
grant insert, update, delete on public.customers, public.customer_contacts, public.quotations, public.quotation_items to authenticated;
grant execute on function public.change_quotation_status(uuid, public.quotation_status) to authenticated;
grant execute on function public.create_quotation_revision(uuid) to authenticated;
grant usage on type public.quotation_status to authenticated;
grant execute on function app.is_admin(), app.can_access_quotation(uuid), app.can_edit_draft(uuid) to authenticated;

create policy "profiles visible to self or admin" on public.profiles for select to authenticated using (id = (select auth.uid()) or app.is_admin());
create policy "settings readable to signed-in users" on public.company_settings for select to authenticated using (true);
create policy "admins manage company settings" on public.company_settings for update to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "masters readable to signed-in users" on public.services for select to authenticated using (true);
create policy "admins manage services" on public.services for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "payment terms readable to signed-in users" on public.payment_terms for select to authenticated using (true);
create policy "admins manage payment terms" on public.payment_terms for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "note presets readable to signed-in users" on public.note_presets for select to authenticated using (true);
create policy "admins manage note presets" on public.note_presets for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "bank accounts readable to signed-in users" on public.bank_accounts for select to authenticated using (true);
create policy "admins manage bank accounts" on public.bank_accounts for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "customers visible to owner or admin" on public.customers for select to authenticated using (owner_id = (select auth.uid()) or app.is_admin());
create policy "customers created by owner" on public.customers for insert to authenticated with check (owner_id = (select auth.uid()) or app.is_admin());
create policy "customers updated by owner or admin" on public.customers for update to authenticated using (owner_id = (select auth.uid()) or app.is_admin()) with check (owner_id = (select auth.uid()) or app.is_admin());
create policy "customers deleted by owner or admin" on public.customers for delete to authenticated using (owner_id = (select auth.uid()) or app.is_admin());
create policy "contacts visible with customer" on public.customer_contacts for select to authenticated using (exists (select 1 from public.customers c where c.id = customer_id and (c.owner_id = (select auth.uid()) or app.is_admin())));
create policy "contacts managed with customer" on public.customer_contacts for all to authenticated using (exists (select 1 from public.customers c where c.id = customer_id and (c.owner_id = (select auth.uid()) or app.is_admin()))) with check (exists (select 1 from public.customers c where c.id = customer_id and (c.owner_id = (select auth.uid()) or app.is_admin())));
create policy "quotations visible to owner or admin" on public.quotations for select to authenticated using (owner_id = (select auth.uid()) or app.is_admin());
create policy "quotations created by owner" on public.quotations for insert to authenticated with check (owner_id = (select auth.uid()) and created_by = (select auth.uid()) and status = 'DRAFT');
create policy "draft quotations updated by owner" on public.quotations for update to authenticated using (app.can_edit_draft(id)) with check (owner_id = (select auth.uid()) and status = 'DRAFT');
create policy "quotations deleted by owner while draft" on public.quotations for delete to authenticated using (app.can_edit_draft(id));
create policy "quotation items visible with quotation" on public.quotation_items for select to authenticated using (app.can_access_quotation(quotation_id));
create policy "draft quotation items managed by owner" on public.quotation_items for all to authenticated using (app.can_edit_draft(quotation_id)) with check (app.can_edit_draft(quotation_id));
create policy "revisions visible with quotation" on public.quotation_revisions for select to authenticated using (app.can_access_quotation(quotation_id));
create policy "email logs visible with quotation" on public.email_logs for select to authenticated using (app.can_access_quotation(quotation_id));
create policy "audit logs visible with quotation" on public.audit_logs for select to authenticated using (app.can_access_quotation(quotation_id));

-- Do not allow browser clients to call security-definer helpers except the intentional status transition RPC.
revoke all on function app.next_document_no(date), app.assign_quotation_defaults(), app.handle_new_user(), app.audit_quotation_change() from public, authenticated;
revoke all on function public.change_quotation_status(uuid, public.quotation_status), public.create_quotation_revision(uuid) from public;
