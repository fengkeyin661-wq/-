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
  enteredByRole?: string
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
  return out;
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
