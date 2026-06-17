import type { HealthRecord } from '../types';

export type DyslipidemiaSeverity =
  | 'borderline'
  | 'hypercholesterolemia'
  | 'hypertriglyceridemia'
  | 'mixed'
  | 'very_high_risk';

export interface DyslipidemiaTagInfo {
  show: boolean;
  label: string;
  severity: DyslipidemiaSeverity;
  summary: string;
  reasons: string[];
}

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const tcFromRecord = (r: HealthRecord) => num(r.checkup?.labBasic?.lipids?.tc);
const tgFromRecord = (r: HealthRecord) => num(r.checkup?.labBasic?.lipids?.tg);
const ldlFromRecord = (r: HealthRecord) => num(r.checkup?.labBasic?.lipids?.ldl);
const hdlFromRecord = (r: HealthRecord) => num(r.checkup?.labBasic?.lipids?.hdl);

const hdlLowThreshold = (gender?: string) => (/女/.test(gender || '') ? 1.3 : 1.0);

/** 参照《中国成人血脂异常防治指南》常用切点 */
export const detectDyslipidemiaTag = (record: HealthRecord): DyslipidemiaTagInfo => {
  const reasons: string[] = [];
  let severity: DyslipidemiaSeverity | null = null;

  const tc = tcFromRecord(record);
  const tg = tgFromRecord(record);
  const ldl = ldlFromRecord(record);
  const hdl = hdlFromRecord(record);
  const hdlLow = hdlLowThreshold(record.profile?.gender);

  const bump = (next: DyslipidemiaSeverity, reason: string) => {
    reasons.push(reason);
    if (!severity) {
      severity = next;
      return;
    }
    const rank: Record<DyslipidemiaSeverity, number> = {
      borderline: 1,
      hypercholesterolemia: 2,
      hypertriglyceridemia: 2,
      mixed: 3,
      very_high_risk: 4,
    };
    if (rank[next] > rank[severity]) severity = next;
  };

  const hasHighChol = (ldl != null && ldl >= 4.1) || (tc != null && tc >= 6.2);
  const hasHighTg = tg != null && tg >= 2.3;
  const hasVeryHigh = (ldl != null && ldl >= 4.9) || (tg != null && tg >= 5.6);
  const hasBorderlineChol =
    (ldl != null && ldl >= 3.4 && ldl < 4.1) || (tc != null && tc >= 5.2 && tc < 6.2);
  const hasBorderlineTg = tg != null && tg >= 1.7 && tg < 2.3;

  if (hasVeryHigh) {
    bump('very_high_risk', `极高危血脂：LDL-C≥4.9 或 TG≥5.6 mmol/L`);
  }
  if (hasHighChol && hasHighTg) {
    bump('mixed', `混合型血脂异常（高胆固醇+高甘油三酯）`);
  } else if (hasHighChol) {
    bump('hypercholesterolemia', `高胆固醇血症（LDL-C≥4.1 或 TC≥6.2 mmol/L）`);
  } else if (hasHighTg) {
    bump('hypertriglyceridemia', `高甘油三酯血症（TG≥2.3 mmol/L）`);
  }

  if (hasBorderlineChol || hasBorderlineTg) {
    bump('borderline', `血脂边缘升高（LDL/TC 或 TG 达边缘切点）`);
  }

  if (hdl != null && hdl < hdlLow) {
    bump(severity === 'very_high_risk' ? 'very_high_risk' : 'borderline', `HDL-C 偏低（<${hdlLow} mmol/L）`);
  }

  const onStatin = record.questionnaire?.medication?.details?.lipidLowering === true;
  if (onStatin && !severity) {
    bump('borderline', '已规律服用调脂药物，建议专项随访管理');
  }

  if (!severity) {
    return { show: false, label: '', severity: 'borderline', summary: '', reasons: [] };
  }

  return {
    show: true,
    label: '血脂异常',
    severity,
    summary: reasons[0] || '血脂异常',
    reasons,
  };
};

export const isLipidCohort = (record: HealthRecord): boolean =>
  detectDyslipidemiaTag(record).show || !!record.lipidManagement?.screenings?.length;

export const dyslipidemiaTagClassName = (severity: DyslipidemiaSeverity): string => {
  if (severity === 'very_high_risk') {
    return 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200';
  }
  if (severity === 'mixed' || severity === 'hypercholesterolemia' || severity === 'hypertriglyceridemia') {
    return 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200';
  }
  return 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100';
};
