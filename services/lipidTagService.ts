import type { HealthRecord } from '../types';
import {
  evaluateLatestCheckupLipids,
  getLatestCheckupLipids,
} from './latestCheckupVitalsService';

export type DyslipidemiaSeverity = 'abnormal';

export interface DyslipidemiaTagInfo {
  show: boolean;
  label: string;
  severity: DyslipidemiaSeverity;
  summary: string;
  reasons: string[];
}

/** 仅依据最近一次体检 checkup 血脂，按体检报告参考范围判定 */
export const detectDyslipidemiaTag = (record: HealthRecord): DyslipidemiaTagInfo => {
  const evalResult = evaluateLatestCheckupLipids(
    getLatestCheckupLipids(record),
    record.profile?.gender
  );

  if (!evalResult.abnormal) {
    return { show: false, label: '', severity: 'abnormal', summary: '', reasons: [] };
  }

  return {
    show: true,
    label: '血脂异常',
    severity: 'abnormal',
    summary: evalResult.reasons[0] || '血脂异常',
    reasons: evalResult.reasons,
  };
};

export const isLipidCohort = (record: HealthRecord): boolean =>
  detectDyslipidemiaTag(record).show || !!record.lipidManagement?.screenings?.length;

export const dyslipidemiaTagClassName = (_severity: DyslipidemiaSeverity): string =>
  'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200';
