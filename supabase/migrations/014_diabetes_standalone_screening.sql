-- 糖尿病专项筛查独立参与者（无需预先建立 health_archives）
create table if not exists public.diabetes_standalone_participants (
  id text primary key,
  participant_key text not null unique,
  checkup_id text,
  name text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_diabetes_standalone_checkup_id
  on public.diabetes_standalone_participants (checkup_id);

create index if not exists idx_diabetes_standalone_updated
  on public.diabetes_standalone_participants (updated_at desc);

comment on table public.diabetes_standalone_participants is '社区糖尿病专项筛查独立评估，不依赖 health_archives';

alter table public.diabetes_standalone_participants enable row level security;

drop policy if exists diabetes_standalone_all on public.diabetes_standalone_participants;
create policy diabetes_standalone_all on public.diabetes_standalone_participants
  for all using (true) with check (true);
