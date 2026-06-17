import type { HealthRecord } from '../types';

const EMPTY = new Set(['', '未查', '无', '—', '-', 'N/A', 'n/a']);

export const profileFmt = (v: unknown, unit?: string): string | undefined => {
  if (v == null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const t = Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
    return unit ? `${t} ${unit}` : t;
  }
  const s = String(v).trim();
  return s.length > 0 && !EMPTY.has(s) ? s : undefined;
};

export const getByPath = (obj: unknown, path: string): unknown =>
  path.split('.').reduce((acc: unknown, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);

/** 多路径取首个有效值，避免 labBasic / optional 重复 */
export const firstCheckupPathValue = (
  record: HealthRecord,
  paths: string[],
  unit?: string
): { value?: string; hasCheckup: boolean } => {
  for (const p of paths) {
    const f = profileFmt(getByPath(record, p), unit);
    if (f) return { value: f, hasCheckup: true };
  }
  return { hasCheckup: false };
};

/** 有体检数据时优先展示体检，避免与同源专项筛查重复拼接 */
export const mergeProfileValues = (
  fromScreening: { value?: string; hasScreening: boolean },
  fromCheckup: { value?: string; hasCheckup: boolean },
  checkupOnly?: boolean
): string | undefined => {
  if (checkupOnly) return fromCheckup.value;
  if (fromCheckup.hasCheckup) return fromCheckup.value;
  return fromScreening.value;
};

export const formatLiverEnzymesCheckup = (record: HealthRecord): { value?: string; hasCheckup: boolean } => {
  const liver = record.checkup?.labBasic?.liver;
  const parts = [
    liver?.alt != null && liver.alt !== '' ? `ALT ${liver.alt}` : '',
    liver?.ast != null && liver.ast !== '' ? `AST ${liver.ast}` : '',
  ].filter(Boolean);
  return parts.length ? { value: parts.join('；'), hasCheckup: true } : { hasCheckup: false };
};

export const formatRenalCheckup = (
  record: HealthRecord,
  extraPaths?: string[]
): { value?: string; hasCheckup: boolean } => {
  const renal = record.checkup?.labBasic?.renal;
  const parts = [
    renal?.creatinine != null && renal.creatinine !== '' ? `肌酐 ${renal.creatinine}` : '',
    renal?.urea != null && renal.urea !== '' ? `尿素 ${renal.urea}` : '',
    renal?.ua != null && renal.ua !== '' ? `尿酸 ${renal.ua}` : '',
  ].filter(Boolean);

  if (extraPaths?.length) {
    for (const p of extraPaths) {
      const raw = getByPath(record, p);
      if (p.includes('uacr') && raw != null && String(raw).trim()) {
        parts.push(`UACR ${raw}`);
      }
    }
  }

  return parts.length ? { value: parts.join('；'), hasCheckup: true } : { hasCheckup: false };
};
