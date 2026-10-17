-- 009_remove_health_archives_guard_trigger.sql
-- 目的：移除 health_archives 的自定义更新拦截触发器（内部环境）

begin;

-- 先禁用（立即生效，幂等）
alter table if exists public.health_archives disable trigger trg_health_archives_guard_update;

-- 再删除触发器（幂等）
drop trigger if exists trg_health_archives_guard_update on public.health_archives;

-- 若函数仅用于该触发器，可一并删除
drop function if exists public.health_archives_guard_update();

commit;

