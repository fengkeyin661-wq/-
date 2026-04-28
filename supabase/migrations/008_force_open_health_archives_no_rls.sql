-- 008_force_open_health_archives_no_rls.sql
-- 强制全开放（内部环境专用）：
-- 1) 关闭 health_archives 的 RLS
-- 2) 对 anon/authenticated/public 全量授予 CRUD
-- 3) 清理可能残留的策略，避免干扰

begin;

-- 先清策略（即使后续关闭 RLS，也清理掉历史噪音）
drop policy if exists ha_select_authenticated_all on public.health_archives;
drop policy if exists ha_insert_authenticated_all on public.health_archives;
drop policy if exists ha_update_authenticated_all on public.health_archives;
drop policy if exists ha_delete_authenticated_all on public.health_archives;
drop policy if exists ha_update_anon_followup on public.health_archives;
drop policy if exists ha_select_anon_all on public.health_archives;
drop policy if exists ha_insert_anon_all on public.health_archives;
drop policy if exists ha_update_anon_all on public.health_archives;
drop policy if exists ha_delete_anon_all on public.health_archives;

-- 强制关闭 RLS（最直接）
alter table if exists public.health_archives disable row level security;

-- schema 访问权（避免 schema 级阻断）
grant usage on schema public to anon, authenticated, public;

-- table 全权限
grant select, insert, update, delete on table public.health_archives to anon, authenticated, public;

-- 如果有 serial/identity 序列，给序列权限（幂等处理）
do $$
declare
  seq_name text;
begin
  select pg_get_serial_sequence('public.health_archives', 'id') into seq_name;
  if seq_name is not null then
    execute format('grant usage, select, update on sequence %s to anon, authenticated, public', seq_name);
  end if;
exception
  when others then
    -- ignore
    null;
end $$;

commit;

