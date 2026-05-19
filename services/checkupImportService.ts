/**
 * 管理端上传体检/检查结果：按检查日期写入时序，较新报告才更新当前快照
 */
import { parseHealthDataFromText } from './geminiService';
import { findArchiveByCheckupId, saveHealthDraft, updateHealthRecordOnly } from './dataService';
import type { HealthDraftData } from './dataService';
import type { HealthRecord } from '../types';
import { parseExamDateToIso, shouldApplyReportToSnapshot, compareExamDates } from './examDateUtils';
import { observationsFromHealthRecord } from './observationMapper';
import { upsertObservations } from './observationService';
import { generateFollowUpSchedule, generateHealthAssessment } from './geminiService';
import { generateDraftFromText } from './healthDraftService';

const mergeRecordForImport = (base: HealthRecord, patch: Partial<HealthRecord>): HealthRecord => {
  return {
    ...base,
    profile: { ...base.profile, ...(patch.profile || {}) },
    checkup: {
      ...base.checkup,
      ...(patch.checkup || {}),
      basics: { ...base.checkup.basics, ...(patch.checkup?.basics || {}) },
      labBasic: {
        ...base.checkup.labBasic,
        ...(patch.checkup?.labBasic || {}),
        lipids: { ...base.checkup.labBasic?.lipids, ...(patch.checkup?.labBasic?.lipids || {}) },
        glucose: { ...base.checkup.labBasic?.glucose, ...(patch.checkup?.labBasic?.glucose || {}) },
      },
    },
    questionnaire: patch.questionnaire || base.questionnaire,
  };
};

export type CheckupImportResult = {
  success: boolean;
  message?: string;
  examDate?: string;
  appliedToSnapshot?: boolean;
  observationCount?: number;
};

/** 从文本解析检查日期（AI + 正则兜底） */
export const extractExamDateFromText = (text: string, parsed?: HealthRecord): string | null => {
  const fromProfile = parseExamDateToIso(parsed?.profile?.checkupDate);
  if (fromProfile) return fromProfile;
  const patterns = [
    /(?:体检|检查|报告)(?:日期|时间)?[:：\s]*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)/i,
    /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const iso = parseExamDateToIso(m[1] || m[0]);
      if (iso) return iso;
    }
  }
  return null;
};

/**
 * 健康管家上传检查结果/报告
 * @param examDateIso 检查日期（必填，用于 observed_at 排序）
 */
export const importCheckupReportForArchive = async (
  checkupId: string,
  text: string,
  options: {
    examDateIso: string;
    fileName?: string;
    source?: HealthDraftData['source'];
  }
): Promise<CheckupImportResult> => {
  const archive = await findArchiveByCheckupId(checkupId);
  if (!archive) return { success: false, message: '未找到档案' };

  const examIso = parseExamDateToIso(options.examDateIso);
  if (!examIso) return { success: false, message: '检查日期无效' };

  const parsed = await parseHealthDataFromText(text);
  parsed.profile.checkupId = checkupId;
  parsed.profile.checkupDate = examIso.slice(0, 10);

  const sourceRef = options.fileName
    ? `upload:${options.fileName}:${examIso.slice(0, 10)}`
    : `upload:${examIso.slice(0, 10)}`;

  const observations = observationsFromHealthRecord(
    parsed,
    'checkup_import',
    examIso,
    sourceRef,
    'manager'
  );

  const obsRes = await upsertObservations(checkupId, observations);
  if (!obsRes.success) {
    return { success: false, message: obsRes.message || '观测写入失败' };
  }

  const applySnapshot = shouldApplyReportToSnapshot(
    examIso,
    archive.health_record?.profile?.checkupDate
  );

  if (applySnapshot) {
    const merged = mergeRecordForImport(archive.health_record, parsed);
    merged.profile.checkupDate = examIso.slice(0, 10);
    await updateHealthRecordOnly(checkupId, merged, 'system', { skipPipeline: true });
    const draft = await generateDraftFromText(
      checkupId,
      text,
      options.source || 'upload',
      `检查日期 ${examIso.slice(0, 10)}${options.fileName ? ` · ${options.fileName}` : ''}`
    );
    if (!draft.success) {
      return {
        success: true,
        examDate: examIso.slice(0, 10),
        appliedToSnapshot: true,
        observationCount: obsRes.inserted,
        message: '观测已入库；AI 草案生成失败，请手动评估',
      };
    }
    return {
      success: true,
      examDate: examIso.slice(0, 10),
      appliedToSnapshot: true,
      observationCount: obsRes.inserted,
      message: '已按检查日期入库并生成待审核草案（已更新当前档案快照）',
    };
  }

  const note = `历史检查报告 ${examIso.slice(0, 10)} 已加入趋势（未覆盖当前快照）${
    options.fileName ? ` · ${options.fileName}` : ''
  }`;
  const assessment = await generateHealthAssessment(
    mergeRecordForImport(archive.health_record, parsed)
  );
  const schedule = generateFollowUpSchedule(assessment);
  const mergedRecord = mergeRecordForImport(archive.health_record, parsed);
  const draft: HealthDraftData = {
    generatedAt: new Date().toISOString(),
    source: options.source || 'upload',
    note,
    assessment,
    follow_up_schedule: schedule,
    management_plan: assessment.managementPlan,
    merged_record: mergedRecord,
  };
  await saveHealthDraft(checkupId, draft);

  return {
    success: true,
    examDate: examIso.slice(0, 10),
    appliedToSnapshot: false,
    observationCount: obsRes.inserted,
    message: `历史报告（${examIso.slice(0, 10)}）已按时间序写入趋势；当前展示仍以较新检查为准`,
  };
};

/** 列出档案已入库的检查日期（去重排序） */
export const listExamDatesForArchive = async (checkupId: string): Promise<string[]> => {
  const { fetchObservationSeries } = await import('./observationService');
  const rows = await fetchObservationSeries(checkupId, [], 500);
  const dates = new Set<string>();
  for (const r of rows) {
    if (r.source === 'checkup_import' || r.source === 'upload' || r.source === 'annual_checkup') {
      dates.add(r.observed_at.slice(0, 10));
    }
  }
  const archive = await findArchiveByCheckupId(checkupId);
  if (archive?.health_record?.profile?.checkupDate) {
    dates.add(archive.health_record.profile.checkupDate.slice(0, 10));
  }
  return Array.from(dates).sort((a, b) => a.localeCompare(b));
};

export const sortArchivesByExamDate = <T extends { health_record?: HealthRecord; updated_at?: string }>(
  list: T[]
): T[] => {
  return [...list].sort((a, b) => {
    const da = a.health_record?.profile?.checkupDate || a.updated_at || '';
    const db = b.health_record?.profile?.checkupDate || b.updated_at || '';
    return compareExamDates(db, da);
  });
};
