-- Keep an auditable record for every email attempt and reserve a send before
-- calling the external mail provider. The reservation prevents double-clicks
-- and concurrent browser tabs from sending the same quotation repeatedly.
alter table public.email_logs
  drop constraint if exists email_logs_status_check;

alter table public.email_logs
  add constraint email_logs_status_check
  check (status in ('PENDING', 'SENT', 'FAILED'));

create index if not exists email_logs_quotation_status_sent_at_idx
  on public.email_logs (quotation_id, status, sent_at desc);

create or replace function public.reserve_quotation_email_send(
  p_quotation_id uuid,
  p_revision_id uuid,
  p_recipient_to text[],
  p_recipient_cc text[],
  p_recipient_bcc text[],
  p_subject text,
  p_message text,
  p_sent_by uuid
)
returns table (email_log_id uuid, prior_sent_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_last_attempt_at timestamptz;
  v_log_id uuid;
  v_prior_sent_count integer;
  v_wait_seconds integer;
begin
  -- Serialise reservations for one quotation while keeping unrelated sends
  -- independent. The function is only executable by the Edge Function role.
  perform pg_advisory_xact_lock(hashtextextended(p_quotation_id::text, 0));

  select max(sent_at)
    into v_last_attempt_at
  from public.email_logs
  where quotation_id = p_quotation_id
    and status in ('PENDING', 'SENT')
    and sent_at > now() - interval '60 seconds';

  if v_last_attempt_at is not null then
    v_wait_seconds := greatest(1, ceil(extract(epoch from (v_last_attempt_at + interval '60 seconds' - now())))::integer);
    raise exception using
      errcode = 'P0001',
      message = format('เพิ่งส่งอีเมลใบเสนอราคานี้ กรุณารออีก %s วินาทีก่อนส่งซ้ำ', v_wait_seconds);
  end if;

  select count(*)::integer
    into v_prior_sent_count
  from public.email_logs
  where quotation_id = p_quotation_id
    and status = 'SENT';

  insert into public.email_logs (
    quotation_id,
    revision_id,
    recipient_to,
    recipient_cc,
    recipient_bcc,
    subject,
    message,
    status,
    sent_by
  ) values (
    p_quotation_id,
    p_revision_id,
    coalesce(p_recipient_to, '{}'),
    coalesce(p_recipient_cc, '{}'),
    coalesce(p_recipient_bcc, '{}'),
    p_subject,
    p_message,
    'PENDING',
    p_sent_by
  ) returning id into v_log_id;

  return query select v_log_id, v_prior_sent_count;
end;
$$;

revoke all on function public.reserve_quotation_email_send(uuid, uuid, text[], text[], text[], text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_quotation_email_send(uuid, uuid, text[], text[], text[], text, text, uuid)
  to service_role;
