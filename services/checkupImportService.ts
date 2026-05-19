/**
 * 管理端上传体检/检查结果：以体检编号识别同一人，按检查日期写入时序并自动发布评估
 */
import { parseHealthDataFromText, generateHealthAssessment, generateFollowUpSchedule } from './geminiService';
import {
  findArchiveByCheckupId,
  updateHealthRecordOnly,
  updateArchiveData,
  saveArchive,
} from './dataService';
import type { HealthDraftData } from './dataService';
import type { HealthRecord, FollowUpRecord } from '../types';
import { RiskLevel } from '../types';
import { parseExamDateToIso, shouldApplyReportToSnapshot, compareExamDates } from './examDateUtils';
import { resolveExamDateIso } from './examDateExtract';
import {
  isValidCheckupId,
  normalizeCheckupId,
  resolveCheckupIdFromReport,
} from './checkupIdUtils';
import { observationsFromHealthRecord } from './observationMapper';
import { upsertObservations } from './observationService';
import { recomputeArchive } from './recomputeArchiveService';
import { generateSystemPortraits, evaluateRiskModels } from './riskModelService';

export { resolveExamDateIso, extractExamDateFromText } from './examDateExtract';

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

export type BatchImportPrepared = {
  fileName: string;
  text: string;
  parsed: HealthRecord;
  checkupId: string;
  examDateIso: string;
  examDateDay: string;
};

export type BatchImportResult = {
  success: boolean;
  message?: string;
  checkupId?: string;
  imported: number;
  skipped: number;
  logs: string[];
};

export type BatchImportProgress = (line: string) => void;

const num = (v: unknown): number => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

export const buildCheckupImportFollowUp = (
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

/** 仅写入观测与条件快照，不触发 recompute */
export const importCheckupReportObservations = async (
  checkupId: string,
  parsed: HealthRecord,
  options: {
    examDateIso: string;
    fileName?: string;
    source?: HealthDraftData['source'];
  }
): Promise<CheckupImportResult> => {
  const examIso = parseExamDateToIso(options.examDateIso);
  if (!examIso) return { success: false, checkupId, message: '检查日期无效' };

  const archive = await findArchiveByCheckupId(checkupId);
  if (!archive) {
    return { success: false, checkupId, message: `未找到体检编号「${checkupId}」对应档案` };
  }

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

  return {
    success: true,
    checkupId,
    examDate: examIso.slice(0, 10),
    appliedToSnapshot: applySnapshot,
    observationCount: obsRes.inserted,
  };
};

/** 批量导入结束后：一次评估 + 随访归档 */
export const finalizeCheckupImportBatch = async (
  checkupId: string,
  examDates: string[]
): Promise<CheckupImportResult> => {
  const recompute = await recomputeArchive({
    checkupId,
    triggerEvent: 'checkup_import',
    triggerRef: `batch:${examDates.join(',')}`,
    publishMode: 'publish',
  });

  if (!recompute.success) {
    return { success: false, checkupId, message: recompute.message || 'AI 评估发布失败' };
  }

  const refreshed = await findArchiveByCheckupId(checkupId);
  if (refreshed?.assessment_data) {
    let followUps = refreshed.follow_ups || [];
    for (const examDate of examDates) {
      followUps = followUps.filter(
        (f) => !(f.id.startsWith('checkup_import_') && f.date === examDate)
      );
      followUps.push(
        buildCheckupImportFollowUp(
          examDate,
          refreshed.health_record,
          refreshed.assessment_data.summary || '',
          refreshed.assessment_data.riskLevel || RiskLevel.GREEN
        )
      );
    }
    await updateArchiveData(checkupId, followUps, refreshed.follow_up_schedule || [], {
      assessment: refreshed.assessment_data,
      nextHealthRecord: refreshed.health_record,
      syncSource: 'checkup_import',
    });
  }

  return {
    success: true,
    checkupId,
    published: recompute.published,
    message: `已完成 ${examDates.length} 份历年报告导入并更新风险评估`,
  };
};

/**
 * 健康管家上传单份报告（自动日期 + 自动发布）
 */
export const importCheckupReportForArchive = async (
  selectedCheckupId: string,
  text: string,
  options: {
    examDateIso?: string;
    fileName?: string;
    source?: HealthDraftData['source'];
  }
): Promise<CheckupImportResult> => {
  const parsed = await parseHealthDataFromText(text);
  const checkupId = resolveCheckupIdFromReport(parsed.profile?.checkupId, selectedCheckupId);

  if (!isValidCheckupId(checkupId)) {
    return {
      success: false,
      checkupId: checkupId || undefined,
      message:
        '未能识别合法体检编号（须为 6 位数字）。请勿使用登记流水号；请核对报告封面「体检编号」',
    };
  }

  const examIso =
    (options.examDateIso && parseExamDateToIso(options.examDateIso)) ||
    resolveExamDateIso(text, parsed, options.fileName, selectedCheckupId);

  if (!examIso) {
    return { success: false, checkupId, message: '未能从报告识别检查日期，请核对报告封面体检日期' };
  }

  let archive = await findArchiveByCheckupId(checkupId);
  if (!archive) {
    parsed.profile.checkupId = checkupId;
    parsed.profile.checkupDate = examIso.slice(0, 10);
    const assessment = await generateHealthAssessment(parsed);
    const schedule = generateFollowUpSchedule(assessment);
    const portraits = generateSystemPortraits(parsed);
    const models = evaluateRiskModels(parsed);
    const saveRes = await saveArchive(parsed, assessment, schedule, [], { portraits, models }, {
      completeProfileOnSave: true,
    });
    if (!saveRes.success) {
      return { success: false, checkupId, message: saveRes.message || '自动建档失败' };
    }
    archive = await findArchiveByCheckupId(checkupId);
  }

  const obsResult = await importCheckupReportObservations(checkupId, parsed, {
    examDateIso: examIso,
    fileName: options.fileName,
    source: options.source,
  });

  if (!obsResult.success) return obsResult;

  const fin = await finalizeCheckupImportBatch(checkupId, [examIso.slice(0, 10)]);

  const snapshotNote = obsResult.appliedToSnapshot
    ? '已更新当前档案快照'
    : '历史报告已写入趋势';

  return {
    ...fin,
    examDate: examIso.slice(0, 10),
    appliedToSnapshot: obsResult.appliedToSnapshot,
    observationCount: obsResult.observationCount,
    message: `体检编号 ${checkupId} · ${examIso.slice(0, 10)}：${snapshotNote}。${fin.message || ''}`,
  };
};

/**
 * 批量上传历年体检报告（升序导入，末次统一评估；无档案则首份自动建档）
 */
export const importCheckupReportsBatch = async (
  items: { fileName: string; text: string }[],
  options: {
    selectedCheckupId?: string;
    onProgress?: BatchImportProgress;
  }
): Promise<BatchImportResult> => {
  const logs: string[] = [];
  const log = (line: string) => {
    logs.push(line);
    options.onProgress?.(line);
  };

  if (!items.length) {
    return { success: false, message: '未选择文件', imported: 0, skipped: 0, logs };
  }

  log(`开始处理 ${items.length} 个文件…`);

  const prepared: BatchImportPrepared[] = [];
  let skipped = 0;

  for (const item of items) {
    log(`📄 解析: ${item.fileName}`);
    try {
      const parsed = await parseHealthDataFromText(item.text);
      const fallbackId = options.selectedCheckupId || '';
      const checkupId = normalizeCheckupId(parsed.profile?.checkupId, item.text, fallbackId);

      if (!isValidCheckupId(checkupId)) {
        log(`❌ 跳过 ${item.fileName}：未识别 6 位体检编号`);
        skipped++;
        continue;
      }

      if (
        options.selectedCheckupId &&
        isValidCheckupId(options.selectedCheckupId) &&
        checkupId !== options.selectedCheckupId
      ) {
        log(
          `⚠️ ${item.fileName}：报告编号 ${checkupId} 与勾选档案 ${options.selectedCheckupId} 不一致，以报告为准`
        );
      }

      const examIso = resolveExamDateIso(
        item.text,
        parsed,
        item.fileName,
        options.selectedCheckupId
      );

      if (!examIso) {
        log(`❌ 跳过 ${item.fileName}：未能识别检查日期`);
        skipped++;
        continue;
      }

      const examDay = examIso.slice(0, 10);
      log(`✓ ${item.fileName} → 编号 ${checkupId}，检查日 ${examDay}`);
      prepared.push({
        fileName: item.fileName,
        text: item.text,
        parsed,
        checkupId,
        examDateIso: examIso,
        examDateDay: examDay,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`❌ 跳过 ${item.fileName}：${msg}`);
      skipped++;
    }
  }

  if (!prepared.length) {
    return {
      success: false,
      message: '没有可导入的文件（请检查体检编号与检查日期）',
      imported: 0,
      skipped,
      logs,
    };
  }

  const checkupIds = new Set(prepared.map((p) => p.checkupId));
  if (checkupIds.size > 1) {
    return {
      success: false,
      message: `批次内含多个体检编号（${[...checkupIds].join('、')}），请仅上传同一人的历年报告`,
      imported: 0,
      skipped,
      logs,
    };
  }

  const checkupId = prepared[0].checkupId;
  prepared.sort((a, b) => compareExamDates(a.examDateIso, b.examDateIso));

  let archive = await findArchiveByCheckupId(checkupId);
  if (!archive) {
    const first = prepared[0];
    first.parsed.profile.checkupId = checkupId;
    first.parsed.profile.checkupDate = first.examDateDay;
    log(`📁 自动建档：${checkupId}（${first.parsed.profile.name || '待完善'}）`);
    const assessment = await generateHealthAssessment(first.parsed);
    const schedule = generateFollowUpSchedule(assessment);
    const portraits = generateSystemPortraits(first.parsed);
    const models = evaluateRiskModels(first.parsed);
    const saveRes = await saveArchive(first.parsed, assessment, schedule, [], { portraits, models }, {
      completeProfileOnSave: true,
    });
    if (!saveRes.success) {
      return {
        success: false,
        checkupId,
        message: saveRes.message || '自动建档失败',
        imported: 0,
        skipped,
        logs,
      };
    }
    archive = await findArchiveByCheckupId(checkupId);
  }

  let imported = 0;
  const examDates: string[] = [];

  for (const row of prepared) {
    log(`📥 入库: ${row.fileName} (${row.examDateDay})`);
    const res = await importCheckupReportObservations(checkupId, row.parsed, {
      examDateIso: row.examDateIso,
      fileName: row.fileName,
      source: 'upload',
    });
    if (res.success) {
      imported++;
      examDates.push(row.examDateDay);
    } else {
      log(`❌ 入库失败 ${row.fileName}：${res.message}`);
      skipped++;
    }
  }

  if (!imported) {
    return {
      success: false,
      checkupId,
      message: '观测写入均失败',
      imported: 0,
      skipped,
      logs,
    };
  }

  log('🤖 正在根据历次指标生成风险评估…');
  const fin = await finalizeCheckupImportBatch(checkupId, [...new Set(examDates)].sort());

  if (!fin.success) {
    return {
      success: false,
      checkupId,
      message: fin.message,
      imported,
      skipped,
      logs,
    };
  }

  log(`✅ 完成：${imported} 份报告已按时间序入库`);
  return {
    success: true,
    checkupId,
    imported,
    skipped,
    logs,
    message: `体检编号 ${checkupId}：成功导入 ${imported} 份历年报告${skipped ? `，跳过 ${skipped} 份` : ''}`,
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
