import type { FollowUpRecord, RiskLevel } from '../types';
import type { HealthArchive } from './dataService';
import { buildFollowUpContext, getLatestFollowUp, normalizeFocusItemKey } from './followUpLinkageService';

export type PlanAdherenceGrade = 1 | 2 | 3 | 4 | 5;

export type AbnormalityFollowUpStatus =
  | 'pending'
  | 'retest_done'
  | 'further_exam_done'
  | 'referred'
  | 'declined';

export type AbnormalityFollowUp = {
  key: string;
  item: string;
  lastResult?: string;
  status: AbnormalityFollowUpStatus;
  note?: string;
};

export type SupervisionMetricKey =
  | 'sbp'
  | 'dbp'
  | 'glucose'
  | 'weight'
  | 'tc'
  | 'tg'
  | 'ldl'
  | 'hdl';

export interface SupervisionMetricSlot {
  key: SupervisionMetricKey;
  label: string;
  unit: string;
  refHint?: string;
}

export interface SupervisionBrief {
  riskLevel: RiskLevel | 'UNKNOWN';
  sourceLabel: string;
  riskFocusLines: string[];
  metricSlots: SupervisionMetricSlot[];
  abnormalityTracks: AbnormalityFollowUp[];
  hasCriticalTrack: boolean;
}

export const PLAN_ADHERENCE_LABELS: Record<PlanAdherenceGrade, string> = {
  5: '很好（基本按方案执行）',
  4: '较好（多数做到）',
  3: '一般（时好时坏）',
  2: '较差（明显未跟上）',
  1: '很差（几乎未执行）',
};

const abnormalityKey = (item: string, result?: string) =>
  normalizeFocusItemKey(`${item}|${result || ''}`);

const textBlob = (archive: HealthArchive): string => {
  const a = archive.assessment_data;
  const parts = [
    ...(a?.risks?.red || []),
    ...(a?.risks?.yellow || []),
    ...(a?.followUpPlan?.nextCheckItems || []),
    ...(a?.managementPlan?.monitoring || []),
    archive.critical_track?.critical_item || '',
    archive.critical_track?.critical_desc || '',
  ];
  return parts.join(' ').toLowerCase();
};

const wantsBp = (blob: string) => /血压|高血压|hbp|收缩|舒张/.test(blob);
const wantsGlucose = (blob: string) => /血糖|糖尿病|糖化|hba1c|glucose/.test(blob);
const wantsLipid = (blob: string) => /血脂|胆固醇|ldl|hdl|tg|tc|高脂/.test(blob);
const wantsWeight = (blob: string) =>
  /体重|bmi|肥胖|腰围|减重/.test(blob) || wantsBp(blob) || wantsGlucose(blob);

const buildMetricSlots = (archive: HealthArchive, blob: string): SupervisionMetricSlot[] => {
  const slots: SupervisionMetricSlot[] = [];
  const push = (slot: SupervisionMetricSlot) => {
    if (slots.some((s) => s.key === slot.key)) return;
    if (slots.length >= 4) return;
    slots.push(slot);
  };

  if (wantsBp(blob)) {
    push({ key: 'sbp', label: '收缩压', unit: 'mmHg', refHint: '<140' });
    push({ key: 'dbp', label: '舒张压', unit: 'mmHg', refHint: '<90' });
  }
  if (wantsGlucose(blob)) {
    push({ key: 'glucose', label: '空腹血糖', unit: 'mmol/L', refHint: '3.9–6.1' });
  }
  if (wantsWeight(blob)) {
    push({ key: 'weight', label: '体重', unit: 'kg' });
  }
  if (wantsLipid(blob)) {
    push({ key: 'ldl', label: 'LDL-C', unit: 'mmol/L', refHint: '<3.4' });
    if (slots.length < 4) push({ key: 'tg', label: 'TG', unit: 'mmol/L', refHint: '<1.7' });
  }

  if (slots.length === 0) {
    push({ key: 'sbp', label: '收缩压', unit: 'mmHg', refHint: '<140' });
    push({ key: 'dbp', label: '舒张压', unit: 'mmHg', refHint: '<90' });
    push({ key: 'weight', label: '体重', unit: 'kg' });
  }

  return slots.slice(0, 4);
};

const buildRiskFocusLines = (archive: HealthArchive): string[] => {
  const out: string[] = [];
  const track = archive.critical_track;
  if (track && track.status !== 'archived' && track.critical_item) {
    out.push(`危急/重点：${track.critical_item}`);
  }
  const a = archive.assessment_data;
  for (const line of a?.risks?.red || []) {
    const t = String(line).trim();
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 4) return out;
  }
  for (const line of a?.risks?.yellow || []) {
    const t = String(line).trim();
    if (t && !out.some((x) => normalizeFocusItemKey(x) === normalizeFocusItemKey(t))) out.push(t);
    if (out.length >= 4) break;
  }
  return out.slice(0, 4);
};

const mergeAbnormalityTracks = (archive: HealthArchive): AbnormalityFollowUp[] => {
  const byKey = new Map<string, AbnormalityFollowUp>();
  const prior = getLatestFollowUp(archive.follow_ups);

  for (const row of prior?.abnormalityFollowUps || []) {
    byKey.set(row.key, { ...row });
  }

  const checkupAbn = archive.health_record?.checkup?.abnormalities || [];
  for (const ab of checkupAbn.slice(0, 8)) {
    const item = ab.item?.trim() || ab.category?.trim() || '异常项';
    const lastResult = [ab.result, ab.clinicalSig].filter(Boolean).join(' · ').slice(0, 120);
    const key = abnormalityKey(item, lastResult);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        item,
        lastResult: lastResult || undefined,
        status: 'pending',
        note: '',
      });
    }
  }

  return Array.from(byKey.values()).slice(0, 8);
};

export const buildSupervisionBrief = (archive: HealthArchive | null | undefined): SupervisionBrief => {
  if (!archive) {
    return {
      riskLevel: 'UNKNOWN',
      sourceLabel: '',
      riskFocusLines: [],
      metricSlots: [],
      abnormalityTracks: [],
      hasCriticalTrack: false,
    };
  }

  const ctx = buildFollowUpContext(archive);
  const blob = textBlob(archive);
  const track = archive.critical_track;
  const hasCriticalTrack = Boolean(track && track.status !== 'archived');

  return {
    riskLevel: archive.assessment_data?.riskLevel || 'UNKNOWN',
    sourceLabel: ctx.sourceLabel,
    riskFocusLines: buildRiskFocusLines(archive),
    metricSlots: buildMetricSlots(archive, blob),
    abnormalityTracks: mergeAbnormalityTracks(archive),
    hasCriticalTrack,
  };
};

export const resolveSupervisionPriorityFocus = (archive: HealthArchive): string[] =>
  buildSupervisionBrief(archive).riskFocusLines.slice(0, 3);

export const deriveLegacyComplianceSummary = (record: FollowUpRecord | null | undefined): string | null => {
  if (!record) return null;
  const med = record.medicalCompliance || [];
  const tasks = record.taskCompliance || [];
  if (!med.length && !tasks.length) return null;
  const medPart = med.length
    ? `复查核对 ${med.filter((m) => m.status === 'improved').length}/${med.length} 项改善`
    : '';
  const taskPart = tasks.length
    ? `方案任务 ${tasks.filter((t) => t.status === 'achieved').length}/${tasks.length} 达标`
    : '';
  return [medPart, taskPart].filter(Boolean).join(' · ');
};

export const formatPlanAdherenceGrade = (grade?: PlanAdherenceGrade | null): string =>
  grade ? PLAN_ADHERENCE_LABELS[grade] : '未评价';

export const countClosedAbnormalityTracks = (rows: AbnormalityFollowUp[] | undefined): number =>
  (rows || []).filter((r) => r.status !== 'pending').length;

/** 从上次随访判断是否需要本期追问（新模型 + 旧 taskCompliance 兼容） */
export const resolveSupervisionFollowUpFlags = (prior: FollowUpRecord | null | undefined) => {
  const lowAdherence =
    prior?.planAdherenceGrade != null && prior.planAdherenceGrade <= 2;
  const pendingAbn = (prior?.abnormalityFollowUps || []).filter((a) => a.status === 'pending');
  const failedTasks = (prior?.taskCompliance || []).filter((t) => t.status === 'failed');
  const partialTasks = (prior?.taskCompliance || []).filter((t) => t.status === 'partial');
  return { lowAdherence, pendingAbn, failedTasks, partialTasks };
};

export const buildSupervisionChainLine = (r: FollowUpRecord): string => {
  const grade = r.planAdherenceGrade
    ? `方案总评 ${r.planAdherenceGrade}/5`
    : deriveLegacyComplianceSummary(r) || '';
  const abn = r.abnormalityFollowUps?.length
    ? `异常跟踪 ${countClosedAbnormalityTracks(r.abnormalityFollowUps)}/${r.abnormalityFollowUps.length} 已更新`
    : '';
  const ind = r.indicators;
  const metric =
    ind.sbp || ind.dbp
      ? `BP ${ind.sbp || '-'}/${ind.dbp || '-'}`
      : ind.glucose
        ? `血糖 ${ind.glucose}`
        : '';
  return [grade, abn, metric].filter(Boolean).join(' · ');
};
