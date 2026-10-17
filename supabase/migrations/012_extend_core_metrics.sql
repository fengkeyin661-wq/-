-- 扩展核心指标：腰围、体脂率、肌酐（肾功能）
insert into public.health_metric_definitions (
  code, label, unit, value_type, category, json_path, valid_min, valid_max, is_core, sort_order
) values
  ('core.waist', '腰围', 'cm', 'number', 'vitals',
    'health_record.checkup.basics.waist', 40, 200, true, 10),
  ('core.body_fat_rate', '体脂率', '%', 'number', 'vitals',
    'health_record.riskModelExtras.bodyFatRate', 3, 60, true, 11),
  ('core.creatinine', '血肌酐', 'μmol/L', 'number', 'lab',
    'health_record.checkup.labBasic.renal.creatinine', 20, 2000, true, 12)
on conflict (code) do update set
  label = excluded.label,
  unit = excluded.unit,
  json_path = excluded.json_path,
  valid_min = excluded.valid_min,
  valid_max = excluded.valid_max,
  is_core = excluded.is_core,
  sort_order = excluded.sort_order;
