-- 007_health_archives_open_all_internal.sql
-- 内部环境全开放版本：
-- 不区分 anon / authenticated，health_archives 全表读写放开。
-- 注意：仅建议内网或受控环境使用。

begin;

alter table if exists public.health_archives enable row level security;

-- 清理历史策略（幂等）
drop policy if exists ha_select_authenticated_all on public.health_archives;
drop policy if exists ha_insert_authenticated_all on public.health_archives;
drop policy if exists ha_update_authenticated_all on public.health_archives;
drop policy if exists ha_update_anon_followup on public.health_archives;
drop policy if exists ha_select_anon_all on public.health_archives;
drop policy if exists ha_insert_anon_all on public.health_archives;
drop policy if exists ha_update_anon_all on public.health_archives;
drop policy if exists ha_delete_anon_all on public.health_archives;
drop policy if exists ha_delete_authenticated_all on public.health_archives;

-- 表权限：anon/authenticated 全开放
grant select, insert, update, delete on table public.health_archives to anon;
grant select, insert, update, delete on table public.health_archives to authenticated;

-- RLS 策略：anon 全开放
create policy ha_select_anon_all
on public.health_archives
for select
to anon
using (true);

create policy ha_insert_anon_all
on public.health_archives
for insert
to anon
with check (true);

create policy ha_update_anon_all
on public.health_archives
for update
to anon
using (true)
with check (true);

create policy ha_delete_anon_all
on public.health_archives
for delete
to anon
using (true);

-- RLS 策略：authenticated 全开放
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

create policy ha_delete_authenticated_all
on public.health_archives
for delete
to authenticated
using (true);

commit;

