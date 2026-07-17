// @ts-ignore
import * as XLSX from 'xlsx';
import type { LipidScreeningRecord } from '../types';
import { createLipidScreeningId } from './lipidAssessmentService';
import { formatCheckupId } from './checkupIdUtils';
import { parseLipidScreeningRowWithAI } from './geminiService';
import {
  applyLipidDirectExcelRowMapping,
  mergeLipidScreeningParseResults,
  normalizeLipidScreeningRecord,
} from './lipidFieldMapping';
import { upsertLipidStandaloneFromScreening } from './lipidStandaloneService';

export type LipidImportResult = {
  success: boolean;
  message?: string;
  imported: number;
  skipped: number;
  logs: string[];
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

const isEmptyRow = (row: unknown[]): boolean => row.every((v) => v == null || String(v).trim() === '');

const toScreeningRecord = (
  partial: Partial<LipidScreeningRecord>,
  meta: { fileName: string; rowIndex: number }
): LipidScreeningRecord => ({
  id: createLipidScreeningId(),
  screeningDate: partial.screeningDate || partial.registrationDate || new Date().toISOString().slice(0, 10),
  activityName: partial.activityName || '社区血脂异常专项筛查',
  source: 'excel_import',
  ...partial,
  importMeta: { fileName: meta.fileName, rowIndex: meta.rowIndex },
});

const formatImportSaveError = (e: unknown): string => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/quota|QuotaExceeded/i.test(msg)) {
    return '浏览器本地存储空间已满。请删除部分旧档案或启用云端存储后重试';
  }
  return msg;
};

export const importLipidScreeningExcel = async (
  file: File,
  options?: { onProgress?: (line: string) => void }
): Promise<LipidImportResult> => {
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
    if (rows.length < 2) return { success: false, message: 'Excel 无数据行', imported: 0, skipped: 0, logs };

    const rawHeaders = rows[0] as string[];
    const headers = rawHeaders.map((h, i) => String(h ?? '').trim() || `列${i + 1}`);
    log(`📂 血脂专项独立导入 ${file.name}，共 ${rows.length - 1} 行…`);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      if (isEmptyRow(row)) {
        skipped++;
        continue;
      }
      const rowText = rowToReadableText(headers, row);
      if (!rowText) {
        skipped++;
        continue;
      }
      log(`第 ${i + 1} 行：AI 解析中…`);
      const directMapped = applyLipidDirectExcelRowMapping(headers, row);
      let parsed;
      try {
        parsed = await parseLipidScreeningRowWithAI(rowText);
      } catch (e) {
        skipped++;
        log(`第 ${i + 1} 行：AI 解析失败 — ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      parsed.checkupId = formatCheckupId(parsed.checkupId) || directMapped.checkupId || parsed.checkupId;
      parsed.name = parsed.name || directMapped.name;
      parsed.gender = parsed.gender || directMapped.gender;
      parsed.age = parsed.age ?? directMapped.age;
      parsed.screening = normalizeLipidScreeningRecord(
        mergeLipidScreeningParseResults(parsed.screening, directMapped.screening)
      );

      const checkupId = formatCheckupId(parsed.checkupId) || undefined;
      const idCard = parsed.screening?.idCard;
      const phone = parsed.screening?.screeningPhone;
      const participantName = parsed.name || '未命名';
      if (!checkupId && !idCard && !phone && participantName === '未命名') {
        skipped++;
        log(`第 ${i + 1} 行：跳过（无法识别参与者）`);
        continue;
      }

      const screening = toScreeningRecord(parsed.screening, { fileName: file.name, rowIndex: i + 1 });
      try {
        const { participant } = await upsertLipidStandaloneFromScreening({
          checkupId: checkupId || parsed.checkupId,
          name: participantName,
          gender: parsed.gender,
          age: typeof parsed.age === 'number' ? parsed.age : undefined,
          phone,
          idCard,
          checkupCount: typeof parsed.screening?.checkupCount === 'number' ? parsed.screening.checkupCount : undefined,
          checkStatus: parsed.screening?.checkStatus,
          activityName: screening.activityName,
          screening,
        });
        imported++;
        log(`第 ${i + 1} 行：✅ ${participant.name} 专项评估已生成`);
      } catch (e) {
        skipped++;
        log(`第 ${i + 1} 行：保存失败 — ${formatImportSaveError(e)}`);
      }
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
