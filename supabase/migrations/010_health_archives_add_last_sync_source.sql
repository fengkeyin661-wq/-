-- 010_health_archives_add_last_sync_source.sql
-- 新增档案写入来源字段，便于医患双端同步可观测

begin;

alter table if exists public.health_archives
  add column if not exists last_sync_source text;

comment on column public.health_archives.last_sync_source is
  '最近一次写入来源：doctor_followup / user_profile_edit / system';

commit;

