/** 核心指标目录（与 health_metric_definitions 种子一致） */

export interface MetricDefinition {
  code: string;
  label: string;
  unit: string;
  validMin?: number;
  validMax?: number;
  isCore: boolean;
}

export const CORE_METRICS: MetricDefinition[] = [
  { code: 'core.sbp', label: '收缩压', unit: 'mmHg', validMin: 40, validMax: 300, isCore: true },
  { code: 'core.dbp', label: '舒张压', unit: 'mmHg', validMin: 30, validMax: 200, isCore: true },
  { code: 'core.weight', label: '体重', unit: 'kg', validMin: 20, validMax: 300, isCore: true },
  { code: 'core.bmi', label: 'BMI', unit: 'kg/m2', validMin: 10, validMax: 80, isCore: true },
  {
    code: 'core.fasting_glucose',
    label: '空腹血糖',
    unit: 'mmol/L',
    validMin: 1,
    validMax: 35,
    isCore: true,
  },
  {
    code: 'core.postprandial_glucose',
    label: '餐后2小时血糖',
    unit: 'mmol/L',
    validMin: 1,
    validMax: 35,
    isCore: true,
  },
  { code: 'core.tc', label: '总胆固醇', unit: 'mmol/L', validMin: 1, validMax: 20, isCore: true },
  { code: 'core.tg', label: '甘油三酯', unit: 'mmol/L', validMin: 0.1, validMax: 20, isCore: true },
  { code: 'core.ldl', label: '低密度脂蛋白', unit: 'mmol/L', validMin: 0.1, validMax: 15, isCore: true },
  { code: 'core.hdl', label: '高密度脂蛋白', unit: 'mmol/L', validMin: 0.1, validMax: 10, isCore: true },
  { code: 'core.waist', label: '腰围', unit: 'cm', validMin: 40, validMax: 200, isCore: true },
  { code: 'core.body_fat_rate', label: '体脂率', unit: '%', validMin: 3, validMax: 60, isCore: true },
  { code: 'core.creatinine', label: '血肌酐', unit: 'μmol/L', validMin: 20, validMax: 2000, isCore: true },
];

export type ObservationSource =
  | 'doctor_followup'
  | 'user_profile_edit'
  | 'home_monitoring'
  | 'checkup_import'
  | 'system';

export const validateMetricValue = (
  code: string,
  value: number
): { ok: boolean; message?: string } => {
  const def = CORE_METRICS.find((m) => m.code === code);
  if (!def || !Number.isFinite(value)) return { ok: false, message: '无效数值' };
  if (def.validMin != null && value < def.validMin) {
    return { ok: false, message: `${def.label} 低于有效范围 (${def.validMin})` };
  }
  if (def.validMax != null && value > def.validMax) {
    return { ok: false, message: `${def.label} 高于有效范围 (${def.validMax})` };
  }
  return { ok: true };
};
