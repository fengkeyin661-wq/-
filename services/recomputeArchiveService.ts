import {
  findArchiveByCheckupId,
  saveArchive,
  saveHealthDraft,
  type HealthArchive,
  type HealthDraftData,
} from './dataService';
import { applyLatestObservationsToRecord } from './observationMapper';
import { getLatestObservationsMap } from './observationService';
import { generateHealthAssessment, generateFollowUpSchedule } from './geminiService';
import { generateSystemPortraits, evaluateRiskModels } from './riskModelService';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { HealthAssessment, RiskAnalysisData } from '../types';
import { RiskLevel } from '../types';

export type PublishMode = 'draft' | 'auto' | 'publish';
export type TriggerEvent =
  | 'observation_batch'
  | 'doctor_followup'
  | 'user_profile_edit'
  | 'home_monitoring'
  | 'manual';

export interface RecomputeOptions {
  checkupId: string;
  triggerEvent: TriggerEvent;
  triggerRef?: string;
  publishMode?: PublishMode;
  /** 随访写入时可直接传入已合并的 assessment */
  assessmentOverride?: HealthAssessment;
}

/** 低风险：仅体重/BMI 小幅变化且无 RED */
export const isLowRiskObservationChange = (
  prev: HealthAssessment | undefined,
  next: HealthAssessment
): boolean => {
  if (next.riskLevel === RiskLevel.RED || next.isCritical) return false;
  if (prev?.riskLevel === RiskLevel.RED) return false;
  return true;
};

const resolvePublishMode = (
  trigger: TriggerEvent,
  requested?: PublishMode
): PublishMode => {
  if (requested) return requested;
  if (trigger === 'doctor_followup') return 'publish';
  if (trigger === 'user_profile_edit' || trigger === 'home_monitoring') return 'auto';
  return 'draft';
};

export const recomputeArchive = async (
  options: RecomputeOptions
): Promise<{
  success: boolean;
  runId?: string;
  published: boolean;
  usedDraft: boolean;
  message?: string;
}> => {
  const { checkupId, triggerEvent, triggerRef, assessmentOverride } = options;
  const publishMode = resolvePublishMode(triggerEvent, options.publishMode);

  const archive = await findArchiveByCheckupId(checkupId);
  if (!archive) return { success: false, published: false, usedDraft: false, message: '未找到档案' };

  let runId: string | undefined;
  if (isSupabaseConfigured()) {
    const { data: runRow } = await supabase
      .from('health_assessment_runs')
      .insert({
        archive_id: archive.id,
        checkup_id: checkupId,
        trigger_event: triggerEvent,
        trigger_ref: triggerRef || null,
        status: 'running',
        publish_mode: publishMode,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    runId = runRow?.id;
    await supabase
      .from('health_archives')
      .update({ recompute_status: 'running', current_assessment_run_id: runId || null })
      .eq('checkup_id', checkupId);
  }

  try {
    const latestMap = await getLatestObservationsMap(checkupId);
    const materialized = applyLatestObservationsToRecord(archive.health_record, latestMap);

    const portraits = generateSystemPortraits(materialized);
    const models = evaluateRiskModels(materialized);
    const ruleOutput: RiskAnalysisData = { portraits, models };

    const assessment =
      assessmentOverride || (await generateHealthAssessment(materialized));
    const schedule = generateFollowUpSchedule(assessment);

    const shouldPublish =
      publishMode === 'publish' ||
      (publishMode === 'auto' && isLowRiskObservationChange(archive.assessment_data, assessment));

    let published = false;
    let usedDraft = false;

    if (shouldPublish) {
      const saveRes = await saveArchive(
        materialized,
        assessment,
        schedule,
        archive.follow_ups || [],
        ruleOutput
      );
      if (!saveRes.success) {
        throw new Error(saveRes.message || '发布评估失败');
      }
      published = true;
    } else {
      const draft: HealthDraftData = {
        generatedAt: new Date().toISOString(),
        source:
          triggerEvent === 'home_monitoring'
            ? 'home_monitoring'
            : triggerEvent === 'user_profile_edit'
            ? 'manual_review'
            : 'manual_review',
        note: `自动草案 trigger=${triggerEvent}`,
        assessment,
        follow_up_schedule: schedule,
        management_plan: assessment.managementPlan,
        merged_record: materialized,
      };
      await saveHealthDraft(checkupId, draft);
      if (isSupabaseConfigured()) {
        await supabase
          .from('health_archives')
          .update({
            risk_analysis: ruleOutput,
            updated_at: new Date().toISOString(),
            last_sync_source: triggerEvent === 'doctor_followup' ? 'doctor_followup' : 'user_profile_edit',
          })
          .eq('checkup_id', checkupId);
      }
      usedDraft = true;
    }

    if (isSupabaseConfigured() && runId) {
      await supabase
        .from('health_assessment_runs')
        .update({
          status: 'succeeded',
          rule_output: ruleOutput,
          ai_output: assessment,
          finished_at: new Date().toISOString(),
          input_snapshot: { metricCount: latestMap.size, triggerEvent },
        })
        .eq('id', runId);
      await supabase
        .from('health_archives')
        .update({ recompute_status: 'succeeded' })
        .eq('checkup_id', checkupId);
    }

    return { success: true, runId, published, usedDraft };
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (isSupabaseConfigured() && runId) {
      await supabase
        .from('health_assessment_runs')
        .update({ status: 'failed', error_message: msg, finished_at: new Date().toISOString() })
        .eq('id', runId);
      await supabase
        .from('health_archives')
        .update({ recompute_status: 'failed' })
        .eq('checkup_id', checkupId);
    }
    return { success: false, published: false, usedDraft: false, message: msg, runId };
  }
};

export const materializeArchiveFromObservations = async (
  checkupId: string
): Promise<HealthArchive | null> => {
  const archive = await findArchiveByCheckupId(checkupId);
  if (!archive) return null;
  const latestMap = await getLatestObservationsMap(checkupId);
  const materialized = applyLatestObservationsToRecord(archive.health_record, latestMap);
  return { ...archive, health_record: materialized };
};
