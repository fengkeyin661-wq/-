-- 郑州大学教职工健康服务中心需求调查问卷（匿名自填 + 登录用户关联）
create table if not exists public.staff_need_survey_submissions (
  id text primary key,
  created_at timestamptz not null default now(),
  mode text not null default 'self' check (mode in ('self', 'interview')),
  checkup_id text,
  age_group text,
  family_type text,
  risk_level text not null,
  service_priorities text not null default '',
  price_value integer,
  questionnaire_version text not null default '2026-v1',
  batch text not null default '正式调查-2026',
  followup_status text not null default '待评估',
  device_token text,
  data jsonb not null default '{}'::jsonb
);

create index if not exists idx_staff_need_survey_created
  on public.staff_need_survey_submissions (created_at desc);

create index if not exists idx_staff_need_survey_device
  on public.staff_need_survey_submissions (device_token, created_at desc);

create index if not exists idx_staff_need_survey_checkup
  on public.staff_need_survey_submissions (checkup_id);

comment on table public.staff_need_survey_submissions is '教职工健康与居家照护需求调查问卷提交记录，不采集详细门牌号';

alter table public.staff_need_survey_submissions enable row level security;

drop policy if exists staff_need_survey_all on public.staff_need_survey_submissions;
create policy staff_need_survey_all on public.staff_need_survey_submissions
  for all using (true) with check (true);
