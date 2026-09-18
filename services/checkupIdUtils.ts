/**
 * 体检编号：固定为 6 位数字（如 240188），与登记流水号/条码等无关
 */

const SERIAL_LABEL_RE = /登记流水|流水号|条码|条形码|顺序号|报告单号|检号流水|LIS|标本号/i;

/** 是否为合法体检编号（恰好 6 位数字） */
export const isValidCheckupId = (id?: string | null): boolean => {
  const s = String(id ?? '').trim().replace(/\s+/g, '');
  return /^\d{6}$/.test(s);
};

/** 规范为 6 位数字字符串，非法则返回空串 */
export const formatCheckupId = (raw?: string | null): string => {
  const s = String(raw ?? '').trim().replace(/\s+/g, '');
  const m = s.match(/^(\d{6})$/);
  return m ? m[1] : '';
};

const splitRow = (line: string, delimiter: '\t' | ','): string[] => {
  if (delimiter === '\t') return line.split('\t').map((v) => v.trim());
  return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((v) => v.trim());
};

const unquote = (s: string) => s.replace(/^['"\s]+|['"\s]+$/g, '');

/** 问卷/表格导出：读取「1.体检编号」列 */
const extractTabularCheckupId = (raw: string): string | undefined => {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex((l) => l.includes('1.体检编号') && l.includes('2.性别'));
  if (headerIdx < 0 || headerIdx + 1 >= lines.length) return undefined;

  const headerLine = lines[headerIdx];
  const valueLine = lines[headerIdx + 1];
  const delimiter: '\t' | ',' = headerLine.includes('\t') ? '\t' : ',';
  const headers = splitRow(headerLine, delimiter);
  const values = splitRow(valueLine, delimiter);
  const idx = headers.findIndex((h) => unquote(h) === '1.体检编号');
  if (idx < 0 || idx >= values.length) return undefined;
  const val = unquote(values[idx]);
  return isValidCheckupId(val) ? formatCheckupId(val) : undefined;
};

/**
 * 从报告原文提取体检编号（仅 6 位数字，且须贴近「体检编号」标签）
 */
export const extractCheckupIdFromRaw = (raw: string): string | undefined => {
  const fromTable = extractTabularCheckupId(raw);
  if (fromTable) return fromTable;

  const global = raw.match(/体检编号\s*[:：]?\s*(\d{6})\b/);
  if (global?.[1]) return global[1];

  const lines = raw.split(/\r?\n/).slice(0, 300);
  for (const line of lines) {
    if (!/体检编号/.test(line)) continue;
    if (SERIAL_LABEL_RE.test(line) && !/体检编号\s*[:：]/.test(line)) continue;

    const labeled = line.match(/体检编号\s*[:：]?\s*(\d{6})\b/);
    if (labeled?.[1]) return labeled[1];

    const onLine = line.match(/\b(\d{6})\b/g);
    if (onLine?.length === 1 && isValidCheckupId(onLine[0])) return onLine[0];
  }

  return undefined;
};

/**
 * 合并 AI 与规则结果：仅接受 6 位数字；规则优先于 AI
 */
export const normalizeCheckupId = (
  aiId: string | undefined,
  raw: string,
  fallback?: string
): string => {
  const ruleId = extractCheckupIdFromRaw(raw);
  if (ruleId) return ruleId;

  const aiNorm = formatCheckupId(aiId);
  if (aiNorm) return aiNorm;

  const fb = formatCheckupId(fallback);
  if (fb) return fb;

  return '';
};

export const resolveCheckupIdFromReport = (
  parsedCheckupId: string | undefined,
  selectedCheckupId: string
): string => {
  const fromReport = formatCheckupId(parsedCheckupId);
  if (fromReport) return fromReport;
  return formatCheckupId(selectedCheckupId) || selectedCheckupId.trim();
};
