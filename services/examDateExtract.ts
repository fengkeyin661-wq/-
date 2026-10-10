/**
 * 从体检报告文本/文件名解析检查日期（非登记日、非打印日）
 */
import type { HealthRecord } from '../types';
import { parseExamDateToIso } from './examDateUtils';

const EXCLUDE_LINE_RE = /出生日期|打印时间|打印日期|采样时间|采样日期|登记日期|登记时间|流水号|条码/i;
const EXAM_LABEL_RE = /(?:体检|检查|报告)(?:日期|时间)/i;

const isReasonableExamDate = (iso: string): boolean => {
  const day = iso.slice(0, 10);
  const t = Date.parse(`${day}T12:00:00.000Z`);
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  const min = new Date('1970-01-01').getTime();
  if (t < min) return false;
  if (t > now + 7 * 24 * 60 * 60 * 1000) return false;
  return true;
};

const tryParseDateStr = (raw: string): string | null => {
  const iso = parseExamDateToIso(raw);
  if (!iso || !isReasonableExamDate(iso)) return null;
  return iso;
};

/** 明确标签后的日期 */
const extractLabeledExamDate = (text: string): string | null => {
  const patterns = [
    /(?:体检|检查|报告)(?:日期|时间)\s*[:：]?\s*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)/gi,
    /(?:总检|体检)(?:日期|时间)\s*[:：]?\s*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)/gi,
  ];
  for (const p of patterns) {
    let m: RegExpExecArray | null;
    const re = new RegExp(p.source, p.flags);
    while ((m = re.exec(text)) !== null) {
      const lineStart = text.lastIndexOf('\n', m.index) + 1;
      const lineEnd = text.indexOf('\n', m.index);
      const line = text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
      if (EXCLUDE_LINE_RE.test(line) && !EXAM_LABEL_RE.test(line)) continue;
      const iso = tryParseDateStr(m[1] || m[0]);
      if (iso) return iso;
    }
  }
  return null;
};

/** 从文件名提取 YYYY-MM-DD 或 YYYYMMDD */
export const extractExamDateFromFileName = (fileName: string): string | null => {
  const base = fileName.replace(/\.[^.]+$/, '');
  const isoDash = base.match(/(20\d{2})[-_/](\d{1,2})[-_/](\d{1,2})/);
  if (isoDash) {
    const iso = tryParseDateStr(`${isoDash[1]}-${isoDash[2]}-${isoDash[3]}`);
    if (iso) return iso;
  }
  const compact = base.match(/(20\d{2})(\d{2})(\d{2})/);
  if (compact) {
    const iso = tryParseDateStr(`${compact[1]}-${compact[2]}-${compact[3]}`);
    if (iso) return iso;
  }
  return null;
};

/**
 * 解析检查日期 ISO（含时间中午 UTC）
 * 优先级：标签 > AI profile > 文件名 > fallback
 */
export const resolveExamDateIso = (
  text: string,
  parsed?: HealthRecord,
  fileName?: string,
  fallback?: string | null
): string | null => {
  const labeled = extractLabeledExamDate(text);
  if (labeled) return labeled;

  const fromProfile = parseExamDateToIso(parsed?.profile?.checkupDate);
  if (fromProfile && isReasonableExamDate(fromProfile)) return fromProfile;

  if (fileName) {
    const fromFile = extractExamDateFromFileName(fileName);
    if (fromFile) return fromFile;
  }

  const fb = fallback ? parseExamDateToIso(fallback) : null;
  if (fb && isReasonableExamDate(fb)) return fb;

  const today = new Date().toISOString().slice(0, 10);
  const todayIso = parseExamDateToIso(today);
  if (todayIso && isReasonableExamDate(todayIso)) return todayIso;

  return null;
};

/** @deprecated 使用 resolveExamDateIso */
export const extractExamDateFromText = (
  text: string,
  parsed?: HealthRecord,
  fileName?: string,
  fallback?: string | null
): string | null => resolveExamDateIso(text, parsed, fileName, fallback);
