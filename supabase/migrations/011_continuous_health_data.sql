-- 011_continuous_health_data.sql
-- 持续健康数据：指标目录、时序观测、评估任务、用户指标偏好
-- 幂等；RLS 草案与当前 health_archives 一致（authenticated/anon 过渡开放）

begin;

alter table if exists public.health_archives
  add column if not exists last_observation_at timestamptz,
  add column if not exists recompute_status text default 'idle',
  add column if not exists current_assessment_run_id uuid;

comment on column public.health_archives.last_observation_at is '最近一次观测写入时间';
comment on column public.health_archives.recompute_status is 'idle | pending | running | succeeded | failed';
comment on column public.health_archives.current_assessment_run_id is '当前/最近一次评估任务';

create table if not exists public.health_metric_definitions (
  code text primary key,
  label text not null,
  unit text,
  value_type text not null default 'number'
    check (value_type in ('number', 'string', 'boolean', 'json')),
  category text not null default 'vitals',
  json_path text not null,
  valid_min numeric,
  valid_max numeric,
  is_core boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.health_observations (
  id uuid primary key default gen_random_uuid(),
  archive_id uuid not null,
  checkup_id text not null,
  metric_code text not null references public.health_metric_definitions (code),
  value_numeric numeric,
  value_text text,
  unit text,
  observed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source text not null,
  source_ref text,
  entered_by_role text,
  status text not null default 'active'
    check (status in ('active', 'voided')),
  voided_at timestamptz,
  void_reason text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_obs_archive_metric_time
  on public.health_observations (archive_id, metric_code, observed_at desc);

create index if not exists idx_obs_checkup_time
  on public.health_observations (checkup_id, observed_at desc);

create index if not exists idx_obs_status_active
  on public.health_observations (checkup_id, status)
  where status = 'active';

create unique index if not exists uq_obs_active_dedupe
  on public.health_observations (
    archive_id,
    metric_code,
    observed_at,
    source,
    coalesce(source_ref, '')
  )
  where status = 'active';

create table if not exists public.user_metric_preferences (
  archive_id uuid not null,
  metric_code text not null references public.health_metric_definitions (code),
  enabled boolean not null default true,
  display_order int not null default 0,
  primary key (archive_id, metric_code)
);

create table if not exists public.health_assessment_runs (
  id uuid primary key default gen_random_uuid(),
  archive_id uuid not null,
  checkup_id text not null,
  trigger_event text not null,
  trigger_ref text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  publish_mode text not null default 'draft'
    check (publish_mode in ('draft', 'auto', 'publish')),
  input_snapshot jsonb,
  rule_output jsonb,
  ai_output jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_assessment_runs_archive_created
  on public.health_assessment_runs (archive_id, created_at desc);

create table if not exists public.health_data_events (
  id uuid primary key default gen_random_uuid(),
  archive_id uuid not null,
  checkup_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_health_data_events_archive
  on public.health_data_events (archive_id, created_at desc);

insert into public.health_metric_definitions (
  code, label, unit, value_type, category, json_path, valid_min, valid_max, is_core, sort_order
) values
  ('core.sbp', '收缩压', 'mmHg', 'number', 'vitals',
    'health_record.checkup.basics.sbp', 40, 300, true, 1),
  ('core.dbp', '舒张压', 'mmHg', 'number', 'vitals',
    'health_record.checkup.basics.dbp', 30, 200, true, 2),
  ('core.weight', '体重', 'kg', 'number', 'vitals',
    'health_record.checkup.basics.weight', 20, 300, true, 3),
  ('core.bmi', 'BMI', 'kg/m2', 'number', 'vitals',
    'health_record.checkup.basics.bmi', 10, 80, true, 4),
  ('core.fasting_glucose', '空腹血糖', 'mmol/L', 'number', 'lab',
    'health_record.checkup.labBasic.glucose.fasting', 1.0, 35.0, true, 5),
  ('core.tc', '总胆固醇', 'mmol/L', 'number', 'lab',
    'health_record.checkup.labBasic.lipids.tc', 1.0, 20.0, true, 6),
  ('core.tg', '甘油三酯', 'mmol/L', 'number', 'lab',
    'health_record.checkup.labBasic.lipids.tg', 0.1, 20.0, true, 7),
  ('core.ldl', '低密度脂蛋白', 'mmol/L', 'number', 'lab',
    'health_record.checkup.labBasic.lipids.ldl', 0.1, 15.0, true, 8),
  ('core.hdl', '高密度脂蛋白', 'mmol/L', 'number', 'lab',
    'health_record.checkup.labBasic.lipids.hdl', 0.1, 10.0, true, 9)
on conflict (code) do update set
  label = excluded.label,
  unit = excluded.unit,
  json_path = excluded.json_path,
  valid_min = excluded.valid_min,
  valid_max = excluded.valid_max,
  is_core = excluded.is_core,
  sort_order = excluded.sort_order;

grant select, insert, update, delete on public.health_metric_definitions to anon, authenticated;
grant select, insert, update, delete on public.health_observations to anon, authenticated;
grant select, insert, update, delete on public.user_metric_preferences to anon, authenticated;
grant select, insert, update, delete on public.health_assessment_runs to anon, authenticated;
grant select, insert, update on public.health_data_events to anon, authenticated;

alter table public.health_metric_definitions enable row level security;
alter table public.health_observations enable row level security;
alter table public.user_metric_preferences enable row level security;
alter table public.health_assessment_runs enable row level security;
alter table public.health_data_events enable row level security;

drop policy if exists hmd_select_all on public.health_metric_definitions;
drop policy if exists hmd_write_all on public.health_metric_definitions;
create policy hmd_select_all on public.health_metric_definitions for select to anon, authenticated using (true);
create policy hmd_write_all on public.health_metric_definitions for all to anon, authenticated using (true) with check (true);

drop policy if exists ho_select_all on public.health_observations;
drop policy if exists ho_write_all on public.health_observations;
create policy ho_select_all on public.health_observations for select to anon, authenticated using (true);
create policy ho_write_all on public.health_observations for all to anon, authenticated using (true) with check (true);

drop policy if exists ump_select_all on public.user_metric_preferences;
drop policy if exists ump_write_all on public.user_metric_preferences;
create policy ump_select_all on public.user_metric_preferences for select to anon, authenticated using (true);
create policy ump_write_all on public.user_metric_preferences for all to anon, authenticated using (true) with check (true);

drop policy if exists har_select_all on public.health_assessment_runs;
drop policy if exists har_write_all on public.health_assessment_runs;
create policy har_select_all on public.health_assessment_runs for select to anon, authenticated using (true);
create policy har_write_all on public.health_assessment_runs for all to anon, authenticated using (true) with check (true);

drop policy if exists hde_select_all on public.health_data_events;
drop policy if exists hde_insert_all on public.health_data_events;
create policy hde_select_all on public.health_data_events for select to anon, authenticated using (true);
create policy hde_insert_all on public.health_data_events for insert to anon, authenticated with check (true);

do $$
begin
  alter publication supabase_realtime add table public.health_observations;
exception
  when duplicate_object then null;
  when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.health_assessment_runs;
exception
  when duplicate_object then null;
  when others then null;
end $$;

commit;
