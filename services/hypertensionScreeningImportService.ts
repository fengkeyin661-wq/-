/**
 * 社区高血压专项筛查 Excel 汇总导入：固定列映射 + AI 逐行解析 → 独立专项评估
 */
// @ts-ignore
import * as XLSX from 'xlsx';
import type { HypertensionScreeningRecord } from '../types';
import { createHypertensionScreeningId } from './hypertensionAssessmentService';
import { formatCheckupId } from './checkupIdUtils';
import { parseHypertensionScreeningRowWithAI } from './geminiService';
import {
  applyHypertensionDirectExcelRowMapping,
  mergeHypertensionScreeningParseResults,
  normalizeHypertensionScreeningRecord,
} from './hypertensionFieldMapping';
import { upsertHypertensionStandaloneFromScreening } from './hypertensionStandaloneService';

export type HypertensionImportResult = {
  success: boolean;
  message?: string;
  imported: number;
  skipped: number;
  logs: string[];
};

export type HypertensionImportProgress = (line: string) => void;

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
  partial: Partial<HypertensionScreeningRecord>,
  meta: { fileName: string; rowIndex: number }
): HypertensionScreeningRecord => ({
  id: createHypertensionScreeningId(),
  screeningDate: partial.screeningDate || partial.registrationDate || new Date().toISOString().slice(0, 10),
  activityName: partial.activityName || '社区高血压专项筛查',
  source: 'excel_import',
  ...partial,
  importMeta: { fileName: meta.fileName, rowIndex: meta.rowIndex },
});

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
};

const formatImportSaveError = (e: unknown): string => {
  const msg = e instanceof Error ? e.message : String(e);
  const quota =
    (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) ||
    /quota|QuotaExceeded/i.test(msg);
  if (quota) {
    return '浏览器本地存储空间已满（非 AI 解析失败）。评估已计算但未能写入本地；请删除部分旧档案、清空浏览器本站数据，或启用云端存储后重试';
  }
  return msg;
};

/** 上传 Excel 汇总表，AI 逐行读取并写入独立专项评估库 */
export const importHypertensionScreeningExcel = async (
  file: File,
  options?: { onProgress?: HypertensionImportProgress }
): Promise<HypertensionImportResult> => {
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

    log(`📂 高血压专项筛查独立导入 ${file.name}，共 ${rows.length - 1} 行（无需预先建档）…`);

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

      const directMapped = applyHypertensionDirectExcelRowMapping(headers, row);

      let parsed;
      try {
        parsed = await parseHypertensionScreeningRowWithAI(rowText);
      } catch (e) {
        skipped++;
        log(`第 ${i + 1} 行：AI 解析失败 — ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }

      parsed.checkupId = formatCheckupId(parsed.checkupId) || directMapped.checkupId || parsed.checkupId;
      parsed.name = parsed.name || directMapped.name;
      parsed.gender = parsed.gender || directMapped.gender;
      parsed.age = parsed.age ?? directMapped.age;

      const mergedScreening = normalizeHypertensionScreeningRecord(
        mergeHypertensionScreeningParseResults(parsed.screening, directMapped.screening)
      );
      parsed.screening = mergedScreening;

      const participantName = parsed.name || '未命名';
      const checkupId = formatCheckupId(parsed.checkupId) || undefined;
      const idCard = parsed.screening?.idCard;
      const phone = parsed.screening?.screeningPhone;

      if (!checkupId && !idCard && !phone && participantName === '未命名') {
        skipped++;
        log(`第 ${i + 1} 行：跳过（无法识别参与者：需体检编号、身份证或联系电话）`);
        continue;
      }

      const screening = toScreeningRecord(parsed.screening, { fileName: file.name, rowIndex: i + 1 });

      try {
        const { participant } = await upsertHypertensionStandaloneFromScreening({
          checkupId: checkupId || parsed.checkupId,
          name: participantName,
          gender: parsed.gender,
          age: num(parsed.age),
          phone,
          idCard,
          checkupCount: num(parsed.screening?.checkupCount),
          checkStatus: parsed.screening?.checkStatus,
          activityName: screening.activityName,
          screening,
        });

        imported++;
        log(
          `第 ${i + 1} 行：✅ ${participant.name}（${participant.checkupId || participant.participantKey}）专项评估已生成`
        );
      } catch (e) {
        skipped++;
        log(`第 ${i + 1} 行：保存失败 — ${formatImportSaveError(e)}`);
      }
    }

    return {
      success: imported > 0,
      message: `处理完成：成功 ${imported} 条，跳过 ${skipped} 条（独立专项评估，未写入健康档案）`,
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
