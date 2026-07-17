-- 动态健康管理闭环：档案扩展字段（草案 + 居家监测）
alter table if exists public.health_archives
    add column if not exists home_monitoring_logs jsonb default '[]'::jsonb,
    add column if not exists draft_data jsonb;

comment on column public.health_archives.home_monitoring_logs is '居家监测日志数组';
comment on column public.health_archives.draft_data is 'AI自动生成待医生审核发布的草案';

-- 过渡阶段最小权限：允许登录主体读取/更新新增字段
grant select (home_monitoring_logs, draft_data) on public.health_archives to anon, authenticated;
grant update (home_monitoring_logs, draft_data) on public.health_archives to anon, authenticated;

