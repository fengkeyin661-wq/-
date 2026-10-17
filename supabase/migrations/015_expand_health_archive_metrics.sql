-- 015_expand_health_archive_metrics.sql
-- 扩展健康档案指标体系：人体成分、血常规、糖化、同型半胱氨酸、动脉硬化等

insert into public.health_metric_definitions (
  code, label, unit, value_type, category, json_path, valid_min, valid_max, is_core, sort_order
) values
  ('core.hba1c', '糖化血红蛋白', '%', 'number', 'lab',
    'health_record.checkup.labBasic.hba1c', 3, 18, true, 20),
  ('core.homocysteine', '同型半胱氨酸', 'μmol/L', 'number', 'lab',
    'health_record.checkup.labBasic.homocysteine', 1, 100, true, 21),
  ('core.wbc', '白细胞', '10^9/L', 'number', 'lab',
    'health_record.checkup.labBasic.bloodRoutine.wbc', 0.1, 50, true, 22),
  ('core.hgb', '血红蛋白', 'g/L', 'number', 'lab',
    'health_record.checkup.labBasic.bloodRoutine.hgb', 50, 220, true, 23),
  ('core.plt', '血小板', '10^9/L', 'number', 'lab',
    'health_record.checkup.labBasic.bloodRoutine.plt', 10, 800, true, 24),
  ('core.visceral_fat_level', '内脏脂肪等级', '级', 'number', 'body_composition',
    'health_record.checkup.bodyComposition.visceralFatLevel', 1, 30, true, 30),
  ('core.skeletal_muscle_mass', '骨骼肌质量', 'kg', 'number', 'body_composition',
    'health_record.checkup.bodyComposition.skeletalMuscleMass', 5, 80, true, 31),
  ('core.waist_hip_ratio', '腰臀比', '', 'number', 'body_composition',
    'health_record.checkup.bodyComposition.waistHipRatio', 0.5, 1.5, true, 32),
  ('core.inbody_score', 'InBody评分', '分', 'number', 'body_composition',
    'health_record.checkup.bodyComposition.inbodyScore', 0, 100, true, 33),
  ('core.abi', '踝臂指数ABI', '', 'number', 'vascular',
    'health_record.checkup.optional.arteriosclerosis.abi', 0.3, 1.5, true, 40),
  ('core.ba_pwv', '脉搏波传导速度', 'cm/s', 'number', 'vascular',
    'health_record.checkup.optional.arteriosclerosis.pwv', 800, 3500, true, 41)
on conflict (code) do update set
  label = excluded.label,
  unit = excluded.unit,
  category = excluded.category,
  json_path = excluded.json_path,
  valid_min = excluded.valid_min,
  valid_max = excluded.valid_max,
  is_core = excluded.is_core,
  sort_order = excluded.sort_order;
