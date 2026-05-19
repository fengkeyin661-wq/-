/**
 * 管理端上传体检/检查结果：以体检编号识别同一人，按检查日期写入时序并自动发布评估
 */
import { parseHealthDataFromText } from './geminiService';
import {
  findArchiveByCheckupId,
  updateHealthRecordOnly,
  updateArchiveData,
} from './dataService';
import type { HealthDraftData } from './dataService';
import type { HealthRecord, FollowUpRecord } from '../types';
import { RiskLevel } from '../types';
import { parseExamDateToIso, shouldApplyReportToSnapshot, compareExamDates } from './examDateUtils';
import {
  isValidCheckupId,
  resolveCheckupIdFromReport,
} from './checkupIdUtils';
import { observationsFromHealthRecord } from './observationMapper';
import { upsertObservations } from './observationService';
import { recomputeArchive } from './recomputeArchiveService';

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
        renal: { ...base.checkup.labBasic?.renal, ...(patch.checkup?.labBasic?.renal || {}) },
      },
    },
    riskModelExtras: { ...(base.riskModelExtras || {}), ...(patch.riskModelExtras || {}) },
    questionnaire: patch.questionnaire || base.questionnaire,
  };
};

export type CheckupImportResult = {
  success: boolean;
  message?: string;
  examDate?: string;
  checkupId?: string;
  appliedToSnapshot?: boolean;
  observationCount?: number;
  published?: boolean;
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

const num = (v: unknown): number => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

const buildCheckupImportFollowUp = (
  examDate: string,
  record: HealthRecord,
  assessmentSummary: string,
  riskLevel: RiskLevel
): FollowUpRecord => {
  const b = record.checkup?.basics || {};
  const lipids = record.checkup?.labBasic?.lipids || {};
  const glucose = record.checkup?.labBasic?.glucose?.fasting;
  return {
    id: `checkup_import_${examDate}_${Date.now()}`,
    date: examDate,
    method: '线下',
    mainComplaint: '体检报告导入',
    indicators: {
      sbp: num(b.sbp),
      dbp: num(b.dbp),
      glucose: num(glucose),
      glucoseType: '空腹',
      weight: num(b.weight),
      tc: num(lipids.tc),
      tg: num(lipids.tg),
      ldl: num(lipids.ldl),
      hdl: num(lipids.hdl),
    },
    organRisks: {
      carotidPlaque: '未查',
      carotidStatus: '未查',
      thyroidNodule: '未查',
      thyroidStatus: '未查',
      lungNodule: '未查',
      lungStatus: '未查',
      otherFindings: '体检报告自动归档',
      otherStatus: '已记录',
    },
    medicalCompliance: [],
    medication: { currentDrugs: '', compliance: '未记录', adverseReactions: '无' },
    lifestyle: {
      diet: '未记录',
      exercise: '未记录',
      smokingAmount: 0,
      drinkingAmount: 0,
      sleepHours: 7,
      sleepQuality: '未记录',
      psychology: '未记录',
      stress: '未记录',
    },
    taskCompliance: [],
    otherInfo: `管理端上传体检报告（检查日期 ${examDate}）`,
    assessment: {
      riskLevel,
      riskJustification: '基于本次及历次体检指标 AI 综合评估',
      majorIssues: assessmentSummary.slice(0, 200),
      referral: riskLevel === RiskLevel.RED,
      nextCheckPlan: '按管理计划随访',
      lifestyleGoals: [],
      doctorMessage: '请按健康管理计划执行，指标异常请及时复诊。',
    },
  };
};

/**
 * 健康管家上传检查结果/报告（自动发布，无需医生审核）
 */
export const importCheckupReportForArchive = async (
  selectedCheckupId: string,
  text: string,
  options: {
    examDateIso: string;
    fileName?: string;
    source?: HealthDraftData['source'];
  }
): Promise<CheckupImportResult> => {
  const parsed = await parseHealthDataFromText(text);
  const checkupId = resolveCheckupIdFromReport(parsed.profile?.checkupId, selectedCheckupId);
  parsed.profile.checkupId = checkupId;

  if (!isValidCheckupId(checkupId)) {
    return {
      success: false,
      checkupId: checkupId || undefined,
      message:
        '未能识别合法体检编号（须为 6 位数字）。请勿使用登记流水号；请核对报告封面「体检编号」或手动选择正确档案后重试',
    };
  }

  const archive = await findArchiveByCheckupId(checkupId);
  if (!archive) {
    return {
      success: false,
      checkupId,
      message: `未找到体检编号「${checkupId}」对应档案；请确认 6 位编号一致或先建档`,
    };
  }

  const examIso = parseExamDateToIso(options.examDateIso);
  if (!examIso) return { success: false, checkupId, message: '检查日期无效' };

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
    return { success: false, checkupId, message: obsRes.message || '观测写入失败' };
  }

  const applySnapshot = shouldApplyReportToSnapshot(
    examIso,
    archive.health_record?.profile?.checkupDate
  );

  if (applySnapshot) {
    const merged = mergeRecordForImport(archive.health_record, parsed);
    merged.profile.checkupDate = examIso.slice(0, 10);
    merged.profile.checkupId = checkupId;
    await updateHealthRecordOnly(checkupId, merged, 'checkup_import', { skipPipeline: true });
  }

  const recompute = await recomputeArchive({
    checkupId,
    triggerEvent: 'checkup_import',
    triggerRef: sourceRef,
    publishMode: 'publish',
  });

  if (!recompute.success) {
    return {
      success: false,
      checkupId,
      examDate: examIso.slice(0, 10),
      observationCount: obsRes.inserted,
      message: recompute.message || 'AI 评估发布失败',
    };
  }

  const refreshed = await findArchiveByCheckupId(checkupId);
  if (refreshed?.assessment_data) {
    const followUp = buildCheckupImportFollowUp(
      examIso.slice(0, 10),
      refreshed.health_record,
      refreshed.assessment_data.summary || '',
      refreshed.assessment_data.riskLevel || RiskLevel.GREEN
    );
    const existing = refreshed.follow_ups || [];
    const withoutDup = existing.filter(
      (f) => !(f.id.startsWith('checkup_import_') && f.date === examIso.slice(0, 10))
    );
    await updateArchiveData(checkupId, [...withoutDup, followUp], refreshed.follow_up_schedule || [], {
      assessment: refreshed.assessment_data,
      nextHealthRecord: refreshed.health_record,
      syncSource: 'checkup_import',
    });
  }

  const snapshotNote = applySnapshot
    ? '已更新当前档案快照'
    : '历史报告已写入趋势（未覆盖较新快照）';

  return {
    success: true,
    checkupId,
    examDate: examIso.slice(0, 10),
    appliedToSnapshot: applySnapshot,
    observationCount: obsRes.inserted,
    published: recompute.published,
    message: `体检编号 ${checkupId} · 检查日期 ${examIso.slice(0, 10)}：${snapshotNote}，已自动更新风险评估与随访计划（无需医生审核）`,
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
