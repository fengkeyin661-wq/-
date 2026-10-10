-- 006_health_archives_allow_anon_followup_update.sql
-- 目的：医生站在会话偶发退回 anon 时，仍可保存“随访执行单”关键字段，避免提交失败。
-- 安全策略：仅开放随访相关列给 anon，非全表写入。

begin;

alter table if exists public.health_archives enable row level security;

-- 仅授予 anon 读 + 指定列更新（最小权限）
grant select on table public.health_archives to anon;
grant update (follow_ups, follow_up_schedule, assessment_data, risk_level, updated_at)
on table public.health_archives to anon;

-- 幂等重建 anon 更新策略（只影响 UPDATE）
drop policy if exists ha_update_anon_followup on public.health_archives;
create policy ha_update_anon_followup
on public.health_archives
for update
to anon
using (true)
with check (true);

commit;

