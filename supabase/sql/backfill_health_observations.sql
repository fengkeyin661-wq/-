-- backfill_health_observations.sql
-- 将既有 health_archives 数据导入 health_observations（幂等，可重复执行）
-- 执行前请先运行 011_continuous_health_data.sql

begin;

-- 从文本提取首个数字（兼容 "8.78 mmol/L"、">5.2" 等）
create or replace function public.parse_health_numeric(raw text)
returns numeric
language sql
immutable
parallel safe
as $$
  select case
    when raw is null or btrim(raw) = '' then null::numeric
    else (regexp_match(btrim(raw), '([-]?[0-9]+(?:\.[0-9]+)?)'))[1]::numeric
  end;
$$;

-- 1) 从 health_record 快照写入
insert into public.health_observations (
  archive_id, checkup_id, metric_code, value_numeric, value_text, unit, observed_at, source, source_ref, entered_by_role
)
select
  ha.id,
  ha.checkup_id,
  'core.sbp',
  public.parse_health_numeric(ha.health_record->'checkup'->'basics'->>'sbp'),
  ha.health_record->'checkup'->'basics'->>'sbp',
  'mmHg',
  coalesce(ha.updated_at, ha.created_at, now()),
  coalesce(ha.last_sync_source, 'system'),
  'backfill:health_record',
  'system'
from public.health_archives ha
where public.parse_health_numeric(ha.health_record->'checkup'->'basics'->>'sbp') is not null
  and public.parse_health_numeric(ha.health_record->'checkup'->'basics'->>'sbp') > 0
on conflict do nothing;

insert into public.health_observations (
  archive_id, checkup_id, metric_code, value_numeric, value_text, unit, observed_at, source, source_ref, entered_by_role
)
select ha.id, ha.checkup_id, 'core.dbp',
  public.parse_health_numeric(ha.health_record->'checkup'->'basics'->>'dbp'),
  ha.health_record->'checkup'->'basics'->>'dbp',
  'mmHg',
  coalesce(ha.updated_at, ha.created_at, now()),
  coalesce(ha.last_sync_source, 'system'), 'backfill:health_record', 'system'
from public.health_archives ha
where public.parse_health_numeric(ha.health_record->'checkup'->'basics'->>'dbp') is not null
  and public.parse_health_numeric(ha.health_record->'checkup'->'basics'->>'dbp') > 0
on conflict do nothing;

insert into public.health_observations (
  archive_id, checkup_id, metric_code, value_numeric, value_text, unit, observed_at, source, source_ref, entered_by_role
)
select ha.id, ha.checkup_id, 'core.weight',
  public.parse_health_numeric(ha.health_record->'checkup'->'basics'->>'weight'),
  ha.health_record->'checkup'->'basics'->>'weight',
  'kg',
  coalesce(ha.updated_at, ha.created_at, now()),
  coalesce(ha.last_sync_source, 'system'), 'backfill:health_record', 'system'
from public.health_archives ha
where public.parse_health_numeric(ha.health_record->'checkup'->'basics'->>'weight') is not null
  and public.parse_health_numeric(ha.health_record->'checkup'->'basics'->>'weight') > 0
on conflict do nothing;

insert into public.health_observations (
  archive_id, checkup_id, metric_code, value_numeric, value_text, unit, observed_at, source, source_ref, entered_by_role
)
select ha.id, ha.checkup_id, 'core.bmi',
  public.parse_health_numeric(ha.health_record->'checkup'->'basics'->>'bmi'),
  ha.health_record->'checkup'->'basics'->>'bmi',
  'kg/m2',
  coalesce(ha.updated_at, ha.created_at, now()),
  coalesce(ha.last_sync_source, 'system'), 'backfill:health_record', 'system'
from public.health_archives ha
where public.parse_health_numeric(ha.health_record->'checkup'->'basics'->>'bmi') is not null
  and public.parse_health_numeric(ha.health_record->'checkup'->'basics'->>'bmi') > 0
on conflict do nothing;

insert into public.health_observations (
  archive_id, checkup_id, metric_code, value_numeric, value_text, unit, observed_at, source, source_ref, entered_by_role
)
select ha.id, ha.checkup_id, 'core.fasting_glucose',
  public.parse_health_numeric(ha.health_record->'checkup'->'labBasic'->'glucose'->>'fasting'),
  ha.health_record->'checkup'->'labBasic'->'glucose'->>'fasting',
  'mmol/L', coalesce(ha.updated_at, ha.created_at, now()),
  coalesce(ha.last_sync_source, 'system'), 'backfill:health_record', 'system'
from public.health_archives ha
where public.parse_health_numeric(ha.health_record->'checkup'->'labBasic'->'glucose'->>'fasting') is not null
on conflict do nothing;

-- lipids tc/tg/ldl/hdl
insert into public.health_observations (
  archive_id, checkup_id, metric_code, value_numeric, value_text, unit, observed_at, source, source_ref, entered_by_role
)
select ha.id, ha.checkup_id, v.code,
  public.parse_health_numeric(v.val),
  v.val,
  'mmol/L',
  coalesce(ha.updated_at, ha.created_at, now()),
  coalesce(ha.last_sync_source, 'system'), 'backfill:health_record', 'system'
from public.health_archives ha
cross join lateral (
  values
    ('core.tc', ha.health_record->'checkup'->'labBasic'->'lipids'->>'tc'),
    ('core.tg', ha.health_record->'checkup'->'labBasic'->'lipids'->>'tg'),
    ('core.ldl', ha.health_record->'checkup'->'labBasic'->'lipids'->>'ldl'),
    ('core.hdl', ha.health_record->'checkup'->'labBasic'->'lipids'->>'hdl')
) as v(code, val)
where public.parse_health_numeric(v.val) is not null
on conflict do nothing;

-- 2) follow_ups 指标
insert into public.health_observations (
  archive_id, checkup_id, metric_code, value_numeric, value_text, unit, observed_at, source, source_ref, entered_by_role
)
select ha.id, ha.checkup_id, v.code,
  public.parse_health_numeric(v.val),
  v.val,
  v.unit,
  coalesce((fu.elem->>'date')::timestamptz, ha.updated_at, now()),
  'doctor_followup', fu.elem->>'id', 'doctor'
from public.health_archives ha
cross join lateral jsonb_array_elements(coalesce(ha.follow_ups, '[]'::jsonb)) as fu(elem)
cross join lateral (
  values
    ('core.sbp', fu.elem->'indicators'->>'sbp', 'mmHg'),
    ('core.dbp', fu.elem->'indicators'->>'dbp', 'mmHg'),
    ('core.weight', fu.elem->'indicators'->>'weight', 'kg'),
    ('core.fasting_glucose', fu.elem->'indicators'->>'glucose', 'mmol/L'),
    ('core.tc', fu.elem->'indicators'->>'tc', 'mmol/L'),
    ('core.tg', fu.elem->'indicators'->>'tg', 'mmol/L'),
    ('core.ldl', fu.elem->'indicators'->>'ldl', 'mmol/L'),
    ('core.hdl', fu.elem->'indicators'->>'hdl', 'mmol/L')
) as v(code, val, unit)
where public.parse_health_numeric(v.val) is not null
  and public.parse_health_numeric(v.val) > 0
on conflict do nothing;

-- 3) home_monitoring_logs
insert into public.health_observations (
  archive_id, checkup_id, metric_code, value_numeric, value_text, unit, observed_at, source, source_ref, entered_by_role
)
select
  ha.id,
  ha.checkup_id,
  case log.elem->>'type'
    when 'bp' then 'core.sbp'
    when 'weight' then 'core.weight'
    when 'fbg' then 'core.fasting_glucose'
    else 'core.weight'
  end,
  case log.elem->>'type'
    when 'bp' then public.parse_health_numeric(split_part(log.elem->>'value', '/', 1))
    when 'weight' then public.parse_health_numeric(log.elem->>'value')
    when 'fbg' then public.parse_health_numeric(log.elem->>'value')
    else public.parse_health_numeric(log.elem->>'value')
  end,
  log.elem->>'value',
  case log.elem->>'type' when 'bp' then 'mmHg' when 'weight' then 'kg' when 'fbg' then 'mmol/L' else null end,
  coalesce((log.elem->>'timestamp')::timestamptz, ha.updated_at, now()),
  'home_monitoring',
  log.elem->>'id',
  coalesce(log.elem->>'source', 'user')
from public.health_archives ha
cross join lateral jsonb_array_elements(coalesce(ha.home_monitoring_logs, '[]'::jsonb)) as log(elem)
where log.elem->>'value' is not null
  and public.parse_health_numeric(log.elem->>'value') is not null
on conflict do nothing;

-- 默认启用全部核心指标偏好
insert into public.user_metric_preferences (archive_id, metric_code, enabled, display_order)
select ha.id, d.code, true, d.sort_order
from public.health_archives ha
cross join public.health_metric_definitions d
where d.is_core = true
on conflict (archive_id, metric_code) do nothing;

commit;
