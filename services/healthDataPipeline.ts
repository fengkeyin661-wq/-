/**
 * 健康数据闭环统一入口：双写 JSON 快照 + 时序观测 + 触发再评估
 */
import type { HealthRecord, HealthAssessment } from '../types';
import type { FollowUpRecord } from '../types';
import type { HomeMonitoringLog } from './dataService';
import {
  observationsFromHealthRecord,
  observationsFromFollowUp,
  observationsFromHomeLog,
  observationsFromUserMetricEntry,
  patchHealthRecordForUserMetric,
  type UserMetricKey,
} from './observationMapper';
import { shouldApplyReportToSnapshot, parseExamDateToIso } from './examDateUtils';
import { findArchiveByCheckupId, updateHealthRecordOnly } from './dataService';
import { upsertObservationsAndEnqueue } from './assessmentPipelineService';
import type { PublishMode, TriggerEvent } from './recomputeArchiveService';

export const pipelineAfterHealthRecordEdit = async (
  checkupId: string,
  record: HealthRecord,
  syncSource: 'user_profile_edit' | 'doctor_followup' | 'system' = 'user_profile_edit'
) => {
  const inputs = observationsFromHealthRecord(
    record,
    syncSource,
    new Date().toISOString(),
    `snapshot:${Date.now()}`,
    syncSource === 'user_profile_edit' ? 'user' : 'doctor'
  );
  const publishMode: PublishMode =
    syncSource === 'doctor_followup' ? 'publish' : 'auto';
  return upsertObservationsAndEnqueue(checkupId, inputs, {
    triggerEvent: syncSource as TriggerEvent,
    publishMode,
  });
};

export const pipelineAfterFollowUp = async (
  checkupId: string,
  record: HealthRecord,
  follow: Omit<FollowUpRecord, 'id'>,
  followUpId: string,
  assessment?: HealthAssessment
) => {
  const fromRecord = observationsFromHealthRecord(
    record,
    'doctor_followup',
    new Date().toISOString(),
    followUpId,
    'doctor'
  );
  const fromFollow = observationsFromFollowUp(follow, followUpId);
  const merged = [...fromRecord, ...fromFollow];
  return upsertObservationsAndEnqueue(checkupId, merged, {
    triggerEvent: 'doctor_followup',
    publishMode: 'publish',
    assessmentOverride: assessment,
    preserveSchedule: true,
    skipDebounce: true,
  });
};

export const pipelineAfterHomeMonitoring = async (
  checkupId: string,
  log: HomeMonitoringLog
) => {
  const inputs = observationsFromHomeLog(log);
  return upsertObservationsAndEnqueue(checkupId, inputs, {
    triggerEvent: 'home_monitoring',
    publishMode: 'auto',
  });
};

/** 用户端：仅更新所选单项指标 */
export const pipelineAfterUserMetricEntry = async (
  checkupId: string,
  baseRecord: HealthRecord,
  entry: {
    metric: UserMetricKey;
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
    };
    measuredAt: string;
  }
) => {
  const measuredIso = parseExamDateToIso(entry.measuredAt) || new Date().toISOString();
  const inputs = observationsFromUserMetricEntry(
    entry.metric,
    entry.values,
    measuredIso,
    `user:${entry.metric}:${measuredIso.slice(0, 10)}`
  );
  const archive = await findArchiveByCheckupId(checkupId);
  const applySnapshot = shouldApplyReportToSnapshot(
    measuredIso,
    archive?.health_record?.profile?.checkupDate || measuredIso
  );

  if (!inputs.length) {
    if (entry.metric === 'height' || entry.metric === 'bodyFat') {
      const patched = patchHealthRecordForUserMetric(
        baseRecord,
        entry.metric,
        entry.values,
        applySnapshot ? measuredIso.slice(0, 10) : undefined
      );
      await updateHealthRecordOnly(checkupId, patched, 'user_profile_edit', { skipPipeline: true });
      return {
        observationsInserted: 0,
        recompute: { success: true, published: false, usedDraft: false, message: '档案已更新' },
      };
    }
    return { observationsInserted: 0, recompute: { success: false, published: false, usedDraft: false, message: '无有效数值' } };
  }

  if (applySnapshot) {
    const patched = patchHealthRecordForUserMetric(
      baseRecord,
      entry.metric,
      entry.values,
      measuredIso.slice(0, 10)
    );
    await updateHealthRecordOnly(checkupId, patched, 'user_profile_edit', { skipPipeline: true });
  }

  return upsertObservationsAndEnqueue(checkupId, inputs, {
    triggerEvent: 'user_profile_edit',
    publishMode: 'auto',
  });
};

export type { UserMetricKey };
