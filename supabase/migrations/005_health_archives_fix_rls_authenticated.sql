-- 005_health_archives_fix_rls_authenticated.sql
-- 修复：医生端 / 匿名 authenticated 会话更新随访时报
-- "role not allowed to update health_archives"（或同类 RLS/权限错误）
-- 做法：幂等重建 health_archives 对 authenticated 的 SELECT/INSERT/UPDATE 策略，
--       并确保 anon 无写权限（与 003 一致）。

begin;

alter table if exists public.health_archives enable row level security;

-- 与 003 命名一致，便于重复执行
drop policy if exists ha_select_authenticated_all on public.health_archives;
drop policy if exists ha_insert_authenticated_all on public.health_archives;
drop policy if exists ha_update_authenticated_all on public.health_archives;

revoke all on table public.health_archives from anon;

grant select on table public.health_archives to authenticated;
grant insert on table public.health_archives to authenticated;
grant update on table public.health_archives to authenticated;

create policy ha_select_authenticated_all
on public.health_archives
for select
to authenticated
using (true);

create policy ha_insert_authenticated_all
on public.health_archives
for insert
to authenticated
with check (true);

create policy ha_update_authenticated_all
on public.health_archives
for update
to authenticated
using (true)
with check (true);

commit;

-- 部署后请在 Supabase SQL Editor 执行本文件，或合并进现有迁移流水线。
