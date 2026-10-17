-- 尿素氮、尿酸作为核心指标
insert into public.health_metric_definitions (
  code, label, unit, value_type, category, json_path, valid_min, valid_max, is_core, sort_order
) values
  ('core.urea', '尿素氮', 'mmol/L', 'number', 'lab',
    'health_record.checkup.labBasic.renal.urea', 0.1, 50, true, 13),
  ('core.uric_acid', '尿酸', 'μmol/L', 'number', 'lab',
    'health_record.checkup.labBasic.renal.ua', 20, 1500, true, 14)
on conflict (code) do update set
  label = excluded.label,
  unit = excluded.unit,
  json_path = excluded.json_path,
  valid_min = excluded.valid_min,
  valid_max = excluded.valid_max,
  is_core = excluded.is_core,
  sort_order = excluded.sort_order;
