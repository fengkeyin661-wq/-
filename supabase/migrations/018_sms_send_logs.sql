-- 018_sms_send_logs.sql
-- 职工短信发送日志（外网短信网关回执审计）

begin;

create table if not exists public.sms_send_logs (
  id uuid primary key default gen_random_uuid(),
  checkup_id text,
  phone text not null,
  template_code text,
  content_snapshot text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  provider text,
  provider_biz_id text,
  error_message text,
  sent_by text,
  sent_role text,
  scene text not null default 'manual'
    check (scene in ('followup', 'critical', 'batch', 'manual')),
  created_at timestamptz not null default now()
);

create index if not exists idx_sms_send_logs_phone_created
  on public.sms_send_logs (phone, created_at desc);

create index if not exists idx_sms_send_logs_checkup_created
  on public.sms_send_logs (checkup_id, created_at desc);

create index if not exists idx_sms_send_logs_scene_created
  on public.sms_send_logs (scene, created_at desc);

comment on table public.sms_send_logs is '健康管理后台外网短信发送记录';

-- 内部环境：与 health_archives 一致，Edge Function 使用 service role 写入
alter table public.sms_send_logs disable row level security;
grant usage on schema public to anon, authenticated, public;
grant select, insert, update on table public.sms_send_logs to anon, authenticated, public;

commit;
