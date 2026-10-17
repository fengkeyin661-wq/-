-- 老年专项筛查独立参与者（无需预先建立 health_archives）
create table if not exists public.elderly_standalone_participants (
  id text primary key,
  participant_key text not null unique,
  checkup_id text,
  name text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_elderly_standalone_checkup_id
  on public.elderly_standalone_participants (checkup_id);

create index if not exists idx_elderly_standalone_updated
  on public.elderly_standalone_participants (updated_at desc);

comment on table public.elderly_standalone_participants is '老年专项 CGA 筛查独立评估，不依赖 health_archives';

alter table public.elderly_standalone_participants enable row level security;

drop policy if exists elderly_standalone_all on public.elderly_standalone_participants;
create policy elderly_standalone_all on public.elderly_standalone_participants
  for all using (true) with check (true);
