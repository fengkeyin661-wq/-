-- 019_staff_work_logs.sql
-- 健康管理师 / 管理员工作量审计日志

begin;

create table if not exists public.staff_work_logs (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null,
  staff_name text not null,
  staff_role text not null default 'health_manager',
  action_type text not null check (
    action_type in (
      'archive_create',
      'archive_update',
      'profile_edit',
      'assessment_run',
      'critical_handle',
      'followup_record',
      'sms_send',
      'report_import'
    )
  ),
  checkup_id text,
  target_name text,
  summary text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_staff_work_logs_staff_created
  on public.staff_work_logs (staff_id, created_at desc);

create index if not exists idx_staff_work_logs_action_created
  on public.staff_work_logs (action_type, created_at desc);

create index if not exists idx_staff_work_logs_created
  on public.staff_work_logs (created_at desc);

comment on table public.staff_work_logs is '健康管理师工作量与操作审计';

alter table public.staff_work_logs disable row level security;
grant usage on schema public to anon, authenticated, public;
grant select, insert, update on table public.staff_work_logs to anon, authenticated, public;

commit;
