-- 糖尿病专栏：餐后2小时血糖指标
insert into public.health_metric_definitions (
  code, label, unit, value_type, category, json_path, valid_min, valid_max, is_core, sort_order
) values
  ('core.postprandial_glucose', '餐后2小时血糖', 'mmol/L', 'number', 'lab',
    'health_record.riskModelExtras.postprandialGlucose', 1, 35, true, 13)
on conflict (code) do update set
  label = excluded.label,
  unit = excluded.unit,
  json_path = excluded.json_path,
  valid_min = excluded.valid_min,
  valid_max = excluded.valid_max,
  is_core = excluded.is_core,
  sort_order = excluded.sort_order;
