import type { HealthRecord, FollowUpRecord } from '../types';
import type { HomeMonitoringLog } from './dataService';
import type { ObservationSource } from './metricCatalog';

export interface ObservationInput {
  metricCode: string;
  valueNumeric: number;
  unit?: string;
  observedAt: string;
  source: ObservationSource | string;
  sourceRef?: string;
  enteredByRole?: string;
}

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** 从 health_record 快照提取核心指标观测 */
export const observationsFromHealthRecord = (
  record: HealthRecord,
  source: ObservationSource | string,
  observedAt: string,
  sourceRef?: string,
  enteredByRole?: string,
  onlyMetricCodes?: string[]
): ObservationInput[] => {
  const out: ObservationInput[] = [];
  const b = record.checkup?.basics || {};
  const l = record.checkup?.labBasic || {};
  const lipids = l.lipids || {};
  const push = (metricCode: string, value: number | undefined, unit: string) => {
    if (value == null) return;
    out.push({
      metricCode,
      valueNumeric: value,
      unit,
      observedAt,
      source,
      sourceRef,
      enteredByRole,
    });
  };

  push('core.sbp', num(b.sbp), 'mmHg');
  push('core.dbp', num(b.dbp), 'mmHg');
  push('core.weight', num(b.weight), 'kg');
  push('core.bmi', num(b.bmi), 'kg/m2');
  push('core.fasting_glucose', num(l.glucose?.fasting), 'mmol/L');
  push('core.tc', num(lipids.tc), 'mmol/L');
  push('core.tg', num(lipids.tg), 'mmol/L');
  push('core.ldl', num(lipids.ldl), 'mmol/L');
  push('core.hdl', num(lipids.hdl), 'mmol/L');
  if (!onlyMetricCodes?.length) return out;
  return out.filter((o) => onlyMetricCodes.includes(o.metricCode));
};

export type UserMetricKey =
  | 'height'
  | 'weight'
  | 'bp'
  | 'glucose'
  | 'tc'
  | 'tg'
  | 'ldl'
  | 'hdl'
  | 'waist'
  | 'bodyFat';

export const metricCodesForUserKey = (key: UserMetricKey): string[] => {
  switch (key) {
    case 'bp':
      return ['core.sbp', 'core.dbp'];
    case 'weight':
      return ['core.weight'];
    case 'glucose':
      return ['core.fasting_glucose'];
    case 'tc':
      return ['core.tc'];
    case 'tg':
      return ['core.tg'];
    case 'ldl':
      return ['core.ldl'];
    case 'hdl':
      return ['core.hdl'];
    case 'waist':
    case 'height':
    case 'bodyFat':
      return [];
    default:
      return [];
  }
};

/** 用户单项指标写入：仅生成对应观测 */
export const observationsFromUserMetricEntry = (
  key: UserMetricKey,
  values: {
    sbp?: number;
    dbp?: number;
    weight?: number;
    glucose?: number | string;
    tc?: number | string;
    tg?: number | string;
    ldl?: number | string;
    hdl?: number | string;
  },
  observedAt: string,
  sourceRef?: string
): ObservationInput[] => {
  const out: ObservationInput[] = [];
  const push = (metricCode: string, value: number | undefined, unit: string) => {
    if (value == null) return;
    out.push({
      metricCode,
      valueNumeric: value,
      unit,
      observedAt,
      source: 'user_profile_edit',
      sourceRef,
      enteredByRole: 'user',
    });
  };
  if (key === 'bp') {
    push('core.sbp', num(values.sbp), 'mmHg');
    push('core.dbp', num(values.dbp), 'mmHg');
  } else if (key === 'weight') push('core.weight', num(values.weight), 'kg');
  else if (key === 'glucose') push('core.fasting_glucose', num(values.glucose), 'mmol/L');
  else if (key === 'tc') push('core.tc', num(values.tc), 'mmol/L');
  else if (key === 'tg') push('core.tg', num(values.tg), 'mmol/L');
  else if (key === 'ldl') push('core.ldl', num(values.ldl), 'mmol/L');
  else if (key === 'hdl') push('core.hdl', num(values.hdl), 'mmol/L');
  return out;
};

/** 将单项指标合并进 health_record（仅相关字段） */
export const patchHealthRecordForUserMetric = (
  base: HealthRecord,
  key: UserMetricKey,
  values: {
    sbp?: number;
    dbp?: number;
    weight?: number;
    height?: number;
    waist?: number;
    bodyFatRate?: number;
    glucose?: number | string;
    tc?: number | string;
    tg?: number | string;
    ldl?: number | string;
    hdl?: number | string;
  },
  examDate?: string
): HealthRecord => {
  const next = JSON.parse(JSON.stringify(base)) as HealthRecord;
  const b = next.checkup.basics || ({} as HealthRecord['checkup']['basics']);
  const lab = next.checkup.labBasic || ({} as HealthRecord['checkup']['labBasic']);
  lab.lipids = lab.lipids || {};
  lab.glucose = lab.glucose || {};

  if (key === 'bp') {
    if (values.sbp != null) b.sbp = values.sbp;
    if (values.dbp != null) b.dbp = values.dbp;
  }
  if (key === 'weight' && values.weight != null) b.weight = values.weight;
  if (key === 'height' && values.height != null) b.height = values.height;
  if (key === 'waist' && values.waist != null) b.waist = values.waist;
  if (key === 'bodyFat' && values.bodyFatRate != null) {
    next.riskModelExtras = { ...(next.riskModelExtras || {}), bodyFatRate: values.bodyFatRate };
  }
  if (key === 'glucose' && values.glucose != null) lab.glucose.fasting = String(values.glucose);
  if (key === 'tc' && values.tc != null) lab.lipids.tc = String(values.tc);
  if (key === 'tg' && values.tg != null) lab.lipids.tg = String(values.tg);
  if (key === 'ldl' && values.ldl != null) lab.lipids.ldl = String(values.ldl);
  if (key === 'hdl' && values.hdl != null) lab.lipids.hdl = String(values.hdl);

  if (b.weight && b.height && b.height > 0) {
    b.bmi = Number((b.weight / Math.pow(b.height / 100, 2)).toFixed(1));
  }
  next.checkup.basics = b;
  next.checkup.labBasic = lab;
  if (examDate) next.profile.checkupDate = examDate.slice(0, 10);
  return next;
};

/** 从随访记录提取 */
export const observationsFromFollowUp = (
  follow: Omit<FollowUpRecord, 'id'> | FollowUpRecord,
  followUpId: string
): ObservationInput[] => {
  const ind = follow.indicators || ({} as FollowUpRecord['indicators']);
  const observedAt = follow.date
    ? new Date(follow.date).toISOString()
    : new Date().toISOString();
  const out: ObservationInput[] = [];
  const push = (metricCode: string, value: number | undefined, unit: string) => {
    if (value == null) return;
    out.push({
      metricCode,
      valueNumeric: value,
      unit,
      observedAt,
      source: 'doctor_followup',
      sourceRef: followUpId,
      enteredByRole: 'doctor',
    });
  };
  push('core.sbp', num(ind.sbp), 'mmHg');
  push('core.dbp', num(ind.dbp), 'mmHg');
  push('core.weight', num(ind.weight), 'kg');
  push('core.fasting_glucose', num(ind.glucose), 'mmol/L');
  push('core.tc', num(ind.tc), 'mmol/L');
  push('core.tg', num(ind.tg), 'mmol/L');
  push('core.ldl', num(ind.ldl), 'mmol/L');
  push('core.hdl', num(ind.hdl), 'mmol/L');
  return out;
};

/** 从居家监测单条日志提取 */
export const observationsFromHomeLog = (log: HomeMonitoringLog): ObservationInput[] => {
  const observedAt = log.timestamp || new Date().toISOString();
  const out: ObservationInput[] = [];
  if (log.type === 'bp') {
    const parts = String(log.value).split(/[\/\s]+/);
    const sbp = num(parts[0]);
    const dbp = num(parts[1]);
    if (sbp != null) {
      out.push({
        metricCode: 'core.sbp',
        valueNumeric: sbp,
        unit: 'mmHg',
        observedAt,
        source: 'home_monitoring',
        sourceRef: log.id,
        enteredByRole: log.source || 'user',
      });
    }
    if (dbp != null) {
      out.push({
        metricCode: 'core.dbp',
        valueNumeric: dbp,
        unit: 'mmHg',
        observedAt,
        source: 'home_monitoring',
        sourceRef: log.id,
        enteredByRole: log.source || 'user',
      });
    }
  } else if (log.type === 'weight') {
    const w = num(log.value);
    if (w != null) {
      out.push({
        metricCode: 'core.weight',
        valueNumeric: w,
        unit: 'kg',
        observedAt,
        source: 'home_monitoring',
        sourceRef: log.id,
        enteredByRole: log.source || 'user',
      });
    }
  } else if (log.type === 'fbg') {
    const g = num(log.value);
    if (g != null) {
      out.push({
        metricCode: 'core.fasting_glucose',
        valueNumeric: g,
        unit: 'mmol/L',
        observedAt,
        source: 'home_monitoring',
        sourceRef: log.id,
        enteredByRole: log.source || 'user',
      });
    }
  }
  return out;
};

/** 将最新观测合并回 health_record 快照（用于 materialize） */
export const applyLatestObservationsToRecord = (
  base: HealthRecord,
  latestByMetric: Map<string, number>
): HealthRecord => {
  const next = JSON.parse(JSON.stringify(base)) as HealthRecord;
  const b = next.checkup.basics || ({} as HealthRecord['checkup']['basics']);
  const lab = next.checkup.labBasic || ({} as HealthRecord['checkup']['labBasic']);
  lab.lipids = lab.lipids || {};
  lab.glucose = lab.glucose || {};

  const set = (code: string, v: number) => {
    switch (code) {
      case 'core.sbp':
        b.sbp = v;
        break;
      case 'core.dbp':
        b.dbp = v;
        break;
      case 'core.weight':
        b.weight = v;
        break;
      case 'core.bmi':
        b.bmi = v;
        break;
      case 'core.fasting_glucose':
        lab.glucose!.fasting = String(v);
        break;
      case 'core.tc':
        lab.lipids!.tc = String(v);
        break;
      case 'core.tg':
        lab.lipids!.tg = String(v);
        break;
      case 'core.ldl':
        lab.lipids!.ldl = String(v);
        break;
      case 'core.hdl':
        lab.lipids!.hdl = String(v);
        break;
      default:
        break;
    }
  };

  latestByMetric.forEach((v, code) => set(code, v));

  if (b.weight && b.height && b.height > 0) {
    b.bmi = Number((b.weight / Math.pow(b.height / 100, 2)).toFixed(1));
  }

  next.checkup.basics = b;
  next.checkup.labBasic = lab;
  return next;
};
