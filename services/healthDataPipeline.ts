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
} from './observationMapper';
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
