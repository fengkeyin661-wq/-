import type { HealthRecord } from '../types';

export type HighGlucoseSeverity = 'elevated' | 'prediabetes' | 'diabetes';

export interface HighGlucoseTagInfo {
  show: boolean;
  label: string;
  severity: HighGlucoseSeverity;
  /** 用于 Tooltip / 副标题 */
  summary: string;
  reasons: string[];
}

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const fastingFromRecord = (record: HealthRecord): number | undefined =>
  num(record.checkup?.labBasic?.glucose?.fasting);

const hba1cFromRecord = (record: HealthRecord): number | undefined =>
  num(record.checkup?.labBasic?.hba1c) ?? num(record.checkup?.optional?.hba1c);

const postFromRecord = (record: HealthRecord): number | undefined =>
  num(record.riskModelExtras?.postprandialGlucose);

/** 与糖尿病专栏 inferCohortTag 阈值对齐，并纳入 HbA1c */
export const detectHighGlucoseTag = (record: HealthRecord): HighGlucoseTagInfo => {
  const reasons: string[] = [];
  let severity: HighGlucoseSeverity | null = null;

  const fasting = fastingFromRecord(record);
  const hba1c = hba1cFromRecord(record);
  const post = postFromRecord(record);

  const bump = (next: HighGlucoseSeverity, reason: string) => {
    reasons.push(reason);
    if (!severity) {
      severity = next;
      return;
    }
    const rank: Record<HighGlucoseSeverity, number> = {
      elevated: 1,
      prediabetes: 2,
      diabetes: 3,
    };
    if (rank[next] > rank[severity]) severity = next;
  };

  if (fasting != null && fasting >= 7.0) {
    bump('diabetes', `空腹血糖 ${fasting} mmol/L（≥7.0）`);
  } else if (fasting != null && fasting >= 6.1) {
    bump('prediabetes', `空腹血糖 ${fasting} mmol/L（≥6.1）`);
  }

  if (post != null && post >= 11.1) {
    bump('diabetes', `餐后血糖 ${post} mmol/L（≥11.1）`);
  } else if (post != null && post >= 7.8) {
    bump('prediabetes', `餐后血糖 ${post} mmol/L（≥7.8）`);
  }

  if (hba1c != null && hba1c >= 6.5) {
    bump('diabetes', `HbA1c ${hba1c}%（≥6.5）`);
  } else if (hba1c != null && hba1c >= 6.0) {
    bump('prediabetes', `HbA1c ${hba1c}%（≥6.0）`);
  }

  if (!severity) {
    return { show: false, label: '', severity: 'elevated', summary: '', reasons: [] };
  }

  const label = severity === 'diabetes' ? '高血糖' : '高血糖';
  return {
    show: true,
    label,
    severity,
    summary: reasons[0] || label,
    reasons,
  };
};

export const highGlucoseTagClassName = (severity: HighGlucoseSeverity): string => {
  if (severity === 'diabetes') {
    return 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200';
  }
  if (severity === 'prediabetes') {
    return 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200';
  }
  return 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100';
};
