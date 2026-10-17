-- 003_health_archives_cloud_rw.sql
-- 目标：彻底打通 health_archives 云端读写（适配当前后台 signInAnonymously 会话）
-- 说明：
-- 1) anon 仍禁止读写
-- 2) authenticated 允许 select/insert/update
-- 3) 适用于当前“后台本地登录 + Supabase 匿名会话”模式

begin;

-- 字段兜底（幂等）
alter table if exists public.health_archives
  add column if not exists password_hash text,
  add column if not exists profile_complete boolean default true,
  add column if not exists health_manager_content_id text,
  add column if not exists home_monitoring_logs jsonb default '[]'::jsonb,
  add column if not exists draft_data jsonb;

alter table if exists public.health_archives enable row level security;

-- 清理旧策略（避免历史策略互相冲突）
drop policy if exists ha_select_staff on public.health_archives;
drop policy if exists ha_select_own on public.health_archives;
drop policy if exists ha_insert_staff on public.health_archives;
drop policy if exists ha_update_staff on public.health_archives;
drop policy if exists ha_update_own_limited on public.health_archives;
drop policy if exists ha_select_authenticated on public.health_archives;
drop policy if exists ha_select_own_by_checkup on public.health_archives;
drop policy if exists ha_update_staff_portal_fields on public.health_archives;
drop policy if exists ha_update_own_password on public.health_archives;
drop policy if exists user_updates_own_portal_fields on public.health_archives;
drop policy if exists ha_update_anon_temp on public.health_archives;

-- 回收 anon 权限
revoke all on table public.health_archives from anon;
revoke update (home_monitoring_logs, draft_data) on public.health_archives from anon;

-- 授予 authenticated 基础权限
grant select on public.health_archives to authenticated;
grant insert on public.health_archives to authenticated;
grant update on public.health_archives to authenticated;

-- RLS：authenticated 可读
create policy ha_select_authenticated_all
on public.health_archives
for select
to authenticated
using (true);

-- RLS：authenticated 可新增
create policy ha_insert_authenticated_all
on public.health_archives
for insert
to authenticated
with check (true);

-- RLS：authenticated 可更新
create policy ha_update_authenticated_all
on public.health_archives
for update
to authenticated
using (true)
with check (true);

commit;

