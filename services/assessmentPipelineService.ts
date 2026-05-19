import { supabase, isSupabaseConfigured } from './supabaseClient';
import { upsertObservations } from './observationService';
import type { ObservationInput } from './observationMapper';
import {
  recomputeArchive,
  type PublishMode,
  type TriggerEvent,
} from './recomputeArchiveService';
import type { HealthAssessment } from '../types';

const DEBOUNCE_MS = 2000;
const pendingByCheckup = new Map<string, ReturnType<typeof setTimeout>>();

export interface PipelineResult {
  observationsInserted: number;
  recompute?: {
    success: boolean;
    published: boolean;
    usedDraft: boolean;
    runId?: string;
    message?: string;
  };
}

/** 写入观测并排队再评估（去抖） */
export const upsertObservationsAndEnqueue = async (
  checkupId: string,
  inputs: ObservationInput[],
  options: {
    triggerEvent: TriggerEvent;
    triggerRef?: string;
    publishMode?: PublishMode;
    assessmentOverride?: HealthAssessment;
    skipDebounce?: boolean;
  }
): Promise<PipelineResult> => {
  const obsRes = await upsertObservations(checkupId, inputs);
  if (!obsRes.success) {
    return { observationsInserted: 0, recompute: { success: false, published: false, usedDraft: false, message: obsRes.message } };
  }

  const run = () =>
    recomputeArchive({
      checkupId,
      triggerEvent: options.triggerEvent,
      triggerRef: options.triggerRef,
      publishMode: options.publishMode,
      assessmentOverride: options.assessmentOverride,
    });

  if (options.skipDebounce) {
    const recompute = await run();
    return { observationsInserted: obsRes.inserted, recompute };
  }

  return new Promise((resolve) => {
    const prev = pendingByCheckup.get(checkupId);
    if (prev) clearTimeout(prev);
    pendingByCheckup.set(
      checkupId,
      setTimeout(async () => {
        pendingByCheckup.delete(checkupId);
        const recompute = await run();
        resolve({ observationsInserted: obsRes.inserted, recompute });
      }, DEBOUNCE_MS)
    );
  });
};

/** 尝试调用 Edge Function；失败则本地 recompute */
export const invokeRecomputeEdge = async (
  checkupId: string,
  triggerEvent: TriggerEvent,
  publishMode?: PublishMode
): Promise<{ success: boolean; channel: 'edge' | 'local'; message?: string }> => {
  if (!isSupabaseConfigured()) {
    const local = await recomputeArchive({ checkupId, triggerEvent, publishMode });
    return { success: local.success, channel: 'local', message: local.message };
  }
  try {
    const { data, error } = await supabase.functions.invoke('recompute-archive', {
      body: { checkupId, triggerEvent, publishMode },
    });
    if (!error && data?.success) {
      return { success: true, channel: 'edge' };
    }
  } catch {
    /* fallback */
  }
  const local = await recomputeArchive({ checkupId, triggerEvent, publishMode });
  return { success: local.success, channel: 'local', message: local.message };
};

export const invokeUpsertObservationsEdge = async (
  checkupId: string,
  inputs: ObservationInput[],
  triggerEvent: TriggerEvent
): Promise<PipelineResult> => {
  if (!isSupabaseConfigured()) {
    return upsertObservationsAndEnqueue(checkupId, inputs, { triggerEvent, skipDebounce: false });
  }
  try {
    const { data, error } = await supabase.functions.invoke('upsert-observations', {
      body: { checkupId, observations: inputs, triggerEvent },
    });
    if (!error && data?.success) {
      return {
        observationsInserted: data.inserted || inputs.length,
        recompute: data.recompute,
      };
    }
  } catch {
    /* fallback */
  }
  return upsertObservationsAndEnqueue(checkupId, inputs, { triggerEvent });
};

export type AssessmentRunRow = {
  id: string;
  status: string;
  publish_mode: string;
  created_at: string;
  finished_at?: string;
  error_message?: string;
};

export const fetchLatestAssessmentRun = async (
  checkupId: string
): Promise<AssessmentRunRow | null> => {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase
    .from('health_assessment_runs')
    .select('id, status, publish_mode, created_at, finished_at, error_message')
    .eq('checkup_id', checkupId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as AssessmentRunRow) || null;
};
