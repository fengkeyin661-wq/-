import type { HealthRecord } from '../types';
import {
  evaluateLatestCheckupGlucose,
  getLatestCheckupGlucose,
  type GlucoseSeverity,
} from './latestCheckupVitalsService';

export type HighGlucoseSeverity = 'elevated' | 'prediabetes' | 'diabetes';

export interface HighGlucoseTagInfo {
  show: boolean;
  label: string;
  severity: HighGlucoseSeverity;
  summary: string;
  reasons: string[];
}

const mapSeverity = (s: GlucoseSeverity): HighGlucoseSeverity => {
  if (s === 'diabetes') return 'diabetes';
  if (s === 'prediabetes') return 'prediabetes';
  return 'elevated';
};

/** 仅依据最近一次体检 checkup 血糖/HbA1c，严格按参考范围判定 */
export const detectHighGlucoseTag = (record: HealthRecord): HighGlucoseTagInfo => {
  const evalResult = evaluateLatestCheckupGlucose(getLatestCheckupGlucose(record));

  if (!evalResult.abnormal) {
    return { show: false, label: '', severity: 'elevated', summary: '', reasons: [] };
  }

  const severity = mapSeverity(evalResult.severity);
  return {
    show: true,
    label: '高血糖',
    severity,
    summary: evalResult.reasons[0] || '高血糖',
    reasons: evalResult.reasons,
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
