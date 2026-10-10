-- 血脂异常专项管理独立参与者（无需预先建立 health_archives）
create table if not exists public.lipid_standalone_participants (
  id text primary key,
  participant_key text not null unique,
  checkup_id text,
  name text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lipid_standalone_checkup_id
  on public.lipid_standalone_participants (checkup_id);

create index if not exists idx_lipid_standalone_updated
  on public.lipid_standalone_participants (updated_at desc);

comment on table public.lipid_standalone_participants is '血脂异常专项管理独立评估，不依赖 health_archives';

alter table public.lipid_standalone_participants enable row level security;

drop policy if exists lipid_standalone_all on public.lipid_standalone_participants;
create policy lipid_standalone_all on public.lipid_standalone_participants
  for all using (true) with check (true);
