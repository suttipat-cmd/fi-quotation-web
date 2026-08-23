alter table public.profiles
  add column if not exists job_title text,
  add column if not exists phone text,
  add column if not exists work_email text,
  add column if not exists active boolean not null default true;
update public.profiles set work_email = email where work_email is null;

alter table public.quotations
  add column if not exists sales_profile_id uuid references public.profiles(id),
  add column if not exists sales_title text,
  add column if not exists sales_phone text,
  add column if not exists sales_email text;

create table if not exists public.user_sales_scopes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  all_sales boolean not null default false,
  sales_profile_ids uuid[] not null default '{}'::uuid[],
  updated_at timestamptz not null default now(),
  check (all_sales or cardinality(sales_profile_ids) > 0)
);
create table if not exists public.email_templates (
  code text primary key,
  subject_template text not null,
  body_template text not null,
  fixed_cc text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);
insert into public.email_templates (code, subject_template, body_template)
values ('QUOTATION_SEND', 'ใบเสนอราคา {document_no} | บริษัท ฟอร์เวิร์ด อินไซต์ จำกัด', E'เรียน {recipient_name}\n{customer_name}\n\nสวัสดีครับ\n\nบริษัท ฟอร์เวิร์ด อินไซต์ จำกัด ขอนำส่งใบเสนอราคาเลขที่ {document_no}\nสำหรับค่าบริการระบบ: {main_services}\n\nได้แนบใบเสนอราคาในรูปแบบ PDF มากับอีเมลฉบับนี้เพื่อประกอบการพิจารณา\nหากมีข้อสงสัย หรือต้องการข้อมูลเพิ่มเติม เรายินดีให้คำแนะนำอย่างเต็มที่\n\nสามารถติดต่อกลับได้ที่\n{sales_name} ({sales_title})\nโทร. {sales_phone}\n\nขอขอบพระคุณที่ให้ความสนใจในบริการของเรา\n\nขอแสดงความนับถือ\n\nฟาด้า เลาะเหม็ง\nศาสณิต แซ่พ่าน\nCustomer Service\nบริษัท ฟอร์เวิร์ด อินไซต์ จำกัด\nอีเมล: fada@forwardinsight.co.th, sasanit@forwardinsight.co.th')
on conflict (code) do nothing;

alter table public.user_sales_scopes enable row level security;
alter table public.email_templates enable row level security;
grant select on public.user_sales_scopes, public.email_templates to authenticated;
grant insert, update, delete on public.user_sales_scopes, public.email_templates to authenticated;
create policy "admins manage sales scopes" on public.user_sales_scopes for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "admins manage email templates" on public.email_templates for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "email templates readable to signed-in users" on public.email_templates for select to authenticated using (true);
drop policy if exists "profiles visible to self or admin" on public.profiles;
create policy "profiles visible to signed-in users" on public.profiles for select to authenticated using (true);
create policy "admins manage profiles" on public.profiles for update to authenticated using (app.is_admin()) with check (app.is_admin());

create or replace function app.can_access_quotation(p_quote_id uuid)
returns boolean language sql stable security definer set search_path = public, app as $$
  select app.is_admin() or exists (
    select 1 from public.quotations q
    where q.id = p_quote_id and (
      q.owner_id = (select auth.uid())
      or q.sales_profile_id = (select auth.uid())
      or exists (select 1 from public.user_sales_scopes s where s.user_id = (select auth.uid()) and (s.all_sales or q.sales_profile_id = any(s.sales_profile_ids)))
    )
  );
$$;
drop policy if exists "quotations visible to owner or admin" on public.quotations;
create policy "quotations visible by owner sales scope or admin" on public.quotations for select to authenticated using (app.can_access_quotation(id));
