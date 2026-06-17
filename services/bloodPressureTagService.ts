import type { HealthRecord } from '../types';

export type HighBloodPressureSeverity = 'elevated' | 'stage1' | 'stage2' | 'crisis';

export interface HighBloodPressureTagInfo {
  show: boolean;
  label: string;
  severity: HighBloodPressureSeverity;
  summary: string;
  reasons: string[];
}

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const sbpFromRecord = (record: HealthRecord): number | undefined =>
  num(record.checkup?.basics?.sbp) ??
  num(record.riskModelExtras?.sbp) ??
  num(record.hypertensionManagement?.screenings?.[0]?.sbp);

const dbpFromRecord = (record: HealthRecord): number | undefined =>
  num(record.checkup?.basics?.dbp) ??
  num(record.riskModelExtras?.dbp) ??
  num(record.hypertensionManagement?.screenings?.[0]?.dbp);

/** 与 hypertensionAssessmentService inferCohortTag 阈值对齐 */
export const detectHighBloodPressureTag = (record: HealthRecord): HighBloodPressureTagInfo => {
  const reasons: string[] = [];
  let severity: HighBloodPressureSeverity | null = null;

  const sbp = sbpFromRecord(record);
  const dbp = dbpFromRecord(record);

  const diseases = record.questionnaire?.history?.diseases || [];
  if (diseases.some((d) => /高血压/.test(d) && !/家族/.test(d))) {
    reasons.push('既往史：高血压');
    severity = severity || 'stage1';
  }

  const bump = (next: HighBloodPressureSeverity, reason: string) => {
    reasons.push(reason);
    const rank: Record<HighBloodPressureSeverity, number> = {
      elevated: 1,
      stage1: 2,
      stage2: 3,
      crisis: 4,
    };
    if (!severity || rank[next] > rank[severity]) severity = next;
  };

  if ((sbp != null && sbp >= 180) || (dbp != null && dbp >= 110)) {
    bump('crisis', `血压 ${sbp ?? '—'}/${dbp ?? '—'} mmHg（高血压危象阈值）`);
  } else if ((sbp != null && sbp >= 160) || (dbp != null && dbp >= 100)) {
    bump('stage2', `血压 ${sbp}/${dbp} mmHg（≥160/100）`);
  } else if ((sbp != null && sbp >= 140) || (dbp != null && dbp >= 90)) {
    bump('stage1', `血压 ${sbp}/${dbp} mmHg（≥140/90）`);
  } else if ((sbp != null && sbp >= 130) || (dbp != null && dbp >= 80)) {
    bump('elevated', `血压 ${sbp}/${dbp} mmHg（130–139/80–89）`);
  }

  if (!severity) {
    return { show: false, label: '', severity: 'elevated', summary: '', reasons: [] };
  }

  return {
    show: true,
    label: '血压偏高',
    severity,
    summary: reasons[0] || '血压偏高',
    reasons,
  };
};

export const highBloodPressureTagClassName = (severity: HighBloodPressureSeverity): string => {
  if (severity === 'crisis') return 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200';
  if (severity === 'stage2') return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';
  if (severity === 'stage1') return 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200';
  return 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100';
};

export const isHypertensionCohort = (record: HealthRecord): boolean => {
  if (detectHighBloodPressureTag(record).show) return true;
  const diseases = record.questionnaire?.history?.diseases || [];
  if (diseases.some((d) => /高血压/.test(d))) return true;
  if (record.hypertensionManagement?.screenings?.length) return true;
  if (record.hypertensionManagement?.cohortTag) return true;
  return false;
};
