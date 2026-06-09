/**
 * 社区糖尿病并发症筛查 Excel 汇总导入：AI 逐行解析并生成评估报告
 */
// @ts-ignore
import * as XLSX from 'xlsx';
import type { DiabetesScreeningRecord } from '../types';
import {
  findArchiveByCheckupId,
  saveArchive,
  updateHealthRecordOnly,
} from './dataService';
import {
  applyScreeningToHealthRecord,
  createScreeningId,
  evaluateDiabetesScreening,
  mergeDiabetesResultToAssessment,
} from './diabetesAssessmentService';
import { observationsFromHealthRecord, observationsFromDiabetesScreening } from './observationMapper';
import { upsertObservations } from './observationService';
import { formatCheckupId } from './checkupIdUtils';
import { parseDiabetesScreeningRowWithAI } from './geminiService';

export type DiabetesImportResult = {
  success: boolean;
  message?: string;
  imported: number;
  skipped: number;
  logs: string[];
};

export type DiabetesImportProgress = (line: string) => void;

const appendScreening = (
  existing: DiabetesScreeningRecord[],
  incoming: DiabetesScreeningRecord
): DiabetesScreeningRecord[] => {
  const dup = existing.find(
    (s) => s.screeningDate === incoming.screeningDate && s.activityName === incoming.activityName
  );
  if (dup) {
    return existing.map((s) =>
      s.screeningDate === incoming.screeningDate && s.activityName === incoming.activityName
        ? { ...s, ...incoming, id: s.id || incoming.id }
        : s
    );
  }
  return [...existing, incoming];
};

const rowToReadableText = (headers: string[], row: unknown[]): string => {
  const pairs = headers
    .map((h, i) => {
      const v = row[i];
      if (v == null || String(v).trim() === '') return null;
      return `${h}: ${v}`;
    })
    .filter(Boolean);
  if (!pairs.length) return '';
  return `【Excel 汇总行】\n表头：${headers.join(' | ')}\n${pairs.join('\n')}`;
};

const isEmptyRow = (row: unknown[]): boolean =>
  row.every((v) => v == null || String(v).trim() === '');

const toScreeningRecord = (
  partial: Partial<DiabetesScreeningRecord>,
  meta: { fileName: string; rowIndex: number }
): DiabetesScreeningRecord => ({
  id: createScreeningId(),
  screeningDate: partial.screeningDate || new Date().toISOString().slice(0, 10),
  activityName: partial.activityName || '社区糖尿病并发症筛查',
  source: 'excel_import',
  glucoseUnit: 'mmol/L',
  ...partial,
  importMeta: { fileName: meta.fileName, rowIndex: meta.rowIndex },
});

/** 上传已整理的 Excel 汇总表，AI 逐行读取并自动生成评估报告 */
export const importDiabetesScreeningExcel = async (
  file: File,
  options?: { onProgress?: DiabetesImportProgress }
): Promise<DiabetesImportResult> => {
  const logs: string[] = [];
  const log = (line: string) => {
    logs.push(line);
    options?.onProgress?.(line);
  };

  let imported = 0;
  let skipped = 0;

  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rows.length < 2) {
      return { success: false, message: 'Excel 无数据行', imported: 0, skipped: 0, logs };
    }

    const rawHeaders = rows[0] as string[];
    const headers = rawHeaders.map((h, i) => {
      const label = String(h ?? '').trim();
      return label || `列${i + 1}`;
    });
    const hasNamedHeader = rawHeaders.some((h) => String(h ?? '').trim().length > 0);
    if (!hasNamedHeader) {
      return { success: false, message: 'Excel 表头为空', imported: 0, skipped: 0, logs };
    }

    log(`📂 开始处理 ${file.name}，共 ${rows.length - 1} 行，AI 逐行解析并生成评估报告…`);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      if (isEmptyRow(row)) {
        skipped++;
        continue;
      }

      const rowText = rowToReadableText(headers, row);
      if (!rowText) {
        skipped++;
        log(`第 ${i + 1} 行：跳过（无有效数据）`);
        continue;
      }

      log(`第 ${i + 1} 行：AI 解析中…`);

      let parsed;
      try {
        parsed = await parseDiabetesScreeningRowWithAI(rowText);
      } catch (e) {
        skipped++;
        log(`第 ${i + 1} 行：AI 解析失败 — ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }

      const checkupId = formatCheckupId(parsed.checkupId);
      if (!checkupId) {
        skipped++;
        log(`第 ${i + 1} 行：跳过（未识别到 6 位体检编号）`);
        continue;
      }

      const archive = await findArchiveByCheckupId(checkupId);
      if (!archive) {
        skipped++;
        log(`第 ${i + 1} 行：跳过（未找到档案 ${checkupId}${parsed.name ? ` / ${parsed.name}` : ''}）`);
        continue;
      }

      const screening = toScreeningRecord(parsed.screening, { fileName: file.name, rowIndex: i + 1 });
      const dm = archive.health_record.diabetesManagement || { screenings: [] };
      const mergedDm = {
        ...dm,
        screenings: appendScreening(dm.screenings || [], screening),
      };
      const mergedRecord = applyScreeningToHealthRecord(archive.health_record, mergedDm);

      const examIso = `${screening.screeningDate}T08:00:00.000Z`;
      const obs = [
        ...observationsFromHealthRecord(
          mergedRecord,
          'checkup_import',
          examIso,
          `diabetes_screening:${file.name}`,
          'manager'
        ),
        ...observationsFromDiabetesScreening(screening, examIso, `diabetes_screening:${file.name}`),
      ];
      await upsertObservations(checkupId, obs);
      await updateHealthRecordOnly(checkupId, mergedRecord, 'checkup_import', { skipPipeline: true });

      const result = evaluateDiabetesScreening(mergedRecord);
      const mergedAssessment = mergeDiabetesResultToAssessment(archive.assessment_data, result);
      await saveArchive(
        mergedRecord,
        mergedAssessment,
        archive.follow_up_schedule || [],
        archive.follow_ups || [],
        archive.risk_analysis
      );

      imported++;
      log(
        `第 ${i + 1} 行：✅ ${archive.name}（${checkupId}）已导入并生成评估 — ${result.riskLevel === 'RED' ? '高风险' : result.riskLevel === 'YELLOW' ? '中风险' : '低风险'}`
      );
    }

    return {
      success: imported > 0,
      message: `处理完成：成功 ${imported} 条，跳过 ${skipped} 条`,
      imported,
      skipped,
      logs,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`导入异常：${msg}`);
    return { success: false, message: msg, imported, skipped, logs };
  }
};
