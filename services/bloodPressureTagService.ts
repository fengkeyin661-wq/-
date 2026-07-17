import type { HealthRecord } from '../types';
import {
  evaluateLatestCheckupBloodPressure,
  getLatestCheckupBloodPressure,
  type BloodPressureSeverity,
} from './latestCheckupVitalsService';

export type HighBloodPressureSeverity = 'stage1' | 'stage2' | 'crisis';

export interface HighBloodPressureTagInfo {
  show: boolean;
  label: string;
  severity: HighBloodPressureSeverity;
  summary: string;
  reasons: string[];
}

const mapSeverity = (s: BloodPressureSeverity): HighBloodPressureSeverity => {
  if (s === 'crisis') return 'crisis';
  if (s === 'stage2') return 'stage2';
  return 'stage1';
};

/** 仅依据最近一次体检 checkup 诊室血压，≥140/90 为偏高 */
export const detectHighBloodPressureTag = (record: HealthRecord): HighBloodPressureTagInfo => {
  const evalResult = evaluateLatestCheckupBloodPressure(getLatestCheckupBloodPressure(record));

  if (!evalResult.abnormal) {
    return { show: false, label: '', severity: 'stage1', summary: '', reasons: [] };
  }

  return {
    show: true,
    label: '血压偏高',
    severity: mapSeverity(evalResult.severity),
    summary: evalResult.reasons[0] || '血压偏高',
    reasons: evalResult.reasons,
  };
};

export const highBloodPressureTagClassName = (severity: HighBloodPressureSeverity): string => {
  if (severity === 'crisis') return 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200';
  if (severity === 'stage2') return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';
  return 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200';
};

export const isHypertensionCohort = (record: HealthRecord): boolean => {
  if (detectHighBloodPressureTag(record).show) return true;
  if (record.hypertensionManagement?.screenings?.length) return true;
  if (record.hypertensionManagement?.cohortTag) return true;
  return false;
};
