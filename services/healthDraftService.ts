import { generateFollowUpSchedule, generateHealthAssessment, parseHealthDataFromText } from './geminiService';
import {
    findArchiveByCheckupId,
    saveHealthDraft,
    type HealthDraftData,
    type HomeMonitoringLog,
} from './dataService';
import type { HealthRecord } from '../types';

const mergeRecordForDraft = (
    base: HealthRecord,
    patch: Partial<HealthRecord>
): HealthRecord => {
    return {
        ...base,
        profile: { ...base.profile, ...(patch.profile || {}) },
        checkup: {
            ...base.checkup,
            ...(patch.checkup || {}),
            basics: { ...base.checkup.basics, ...(patch.checkup?.basics || {}) },
            labBasic: { ...base.checkup.labBasic, ...(patch.checkup?.labBasic || {}) },
            imagingBasic: {
                ...base.checkup.imagingBasic,
                ...(patch.checkup?.imagingBasic || {}),
            },
            optional: { ...base.checkup.optional, ...(patch.checkup?.optional || {}) },
        },
        questionnaire: { ...base.questionnaire, ...(patch.questionnaire || {}) },
        elderlyAssessment: patch.elderlyAssessment || base.elderlyAssessment,
        riskModelExtras: { ...(base.riskModelExtras || {}), ...(patch.riskModelExtras || {}) },
    };
};

export const generateDraftFromText = async (
    checkupId: string,
    text: string,
    source: HealthDraftData['source'],
    note?: string
) => {
    const archive = await findArchiveByCheckupId(checkupId);
    if (!archive) return { success: false, message: '未找到档案' };
    const parsed = await parseHealthDataFromText(text);
    const mergedRecord = mergeRecordForDraft(archive.health_record, parsed as any);
    const assessment = await generateHealthAssessment(mergedRecord);
    const schedule = generateFollowUpSchedule(assessment);
    const draft: HealthDraftData = {
        generatedAt: new Date().toISOString(),
        source,
        note,
        assessment,
        follow_up_schedule: schedule,
        management_plan: assessment.managementPlan,
        merged_record: mergedRecord,
    };
    const ok = await saveHealthDraft(checkupId, draft);
    return ok ? { success: true, draft } : { success: false, message: '草案保存失败' };
};

export const generateDraftFromMonitoring = async (
    checkupId: string,
    logs: HomeMonitoringLog[],
    note?: string
) => {
    const archive = await findArchiveByCheckupId(checkupId);
    if (!archive) return { success: false, message: '未找到档案' };
    const latest = logs[0];
    const patch: Partial<HealthRecord> = { checkup: { basics: {}, labBasic: {} } as any };
    if (latest) {
        if (latest.type === 'weight') (patch.checkup as any).basics.weight = Number(latest.value) || undefined;
        if (latest.type === 'bp') {
            const parts = String(latest.value).split(/[\/\s]+/);
            (patch.checkup as any).basics.sbp = Number(parts[0]) || undefined;
            (patch.checkup as any).basics.dbp = Number(parts[1]) || undefined;
        }
        if (latest.type === 'fbg') {
            (patch.checkup as any).labBasic.glucose = { fasting: String(latest.value) };
        }
    }
    const mergedRecord = mergeRecordForDraft(archive.health_record, patch);
    const assessment = await generateHealthAssessment(mergedRecord);
    const schedule = generateFollowUpSchedule(assessment);
    const draft: HealthDraftData = {
        generatedAt: new Date().toISOString(),
        source: 'home_monitoring',
        note,
        assessment,
        follow_up_schedule: schedule,
        management_plan: assessment.managementPlan,
        merged_record: mergedRecord,
    };
    const ok = await saveHealthDraft(checkupId, draft);
    return ok ? { success: true, draft } : { success: false, message: '草案保存失败' };
};

