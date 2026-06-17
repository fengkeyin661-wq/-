import type { HealthRecord } from '../types';
import {
  evaluateLatestCheckupLipids,
  getLatestCheckupLipids,
  type LipidSeverity,
} from './latestCheckupVitalsService';

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

const mapSeverity = (s: LipidSeverity): DyslipidemiaSeverity => {
  if (s === 'very_high_risk') return 'very_high_risk';
  if (s === 'mixed') return 'mixed';
  if (s === 'hypercholesterolemia') return 'hypercholesterolemia';
  if (s === 'hypertriglyceridemia') return 'hypertriglyceridemia';
  return 'borderline';
};

/** 仅依据最近一次体检 checkup 血脂四项，严格按参考范围判定 */
export const detectDyslipidemiaTag = (record: HealthRecord): DyslipidemiaTagInfo => {
  const evalResult = evaluateLatestCheckupLipids(
    getLatestCheckupLipids(record),
    record.profile?.gender
  );

  if (!evalResult.abnormal) {
    return { show: false, label: '', severity: 'borderline', summary: '', reasons: [] };
  }

  return {
    show: true,
    label: '血脂异常',
    severity: mapSeverity(evalResult.severity),
    summary: evalResult.reasons[0] || '血脂异常',
    reasons: evalResult.reasons,
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
