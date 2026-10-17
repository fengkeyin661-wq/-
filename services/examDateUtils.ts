/** 解析体检/检查日期为 ISO 时间（默认当天中午，避免时区偏移） */
export const parseExamDateToIso = (raw?: string | null): string | null => {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  const m1 = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m1) {
    const y = m1[1];
    const mo = m1[2].padStart(2, '0');
    const d = m1[3].padStart(2, '0');
    return `${y}-${mo}-${d}T12:00:00.000Z`;
  }
  const m2 = s.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m2) {
    const y = m2[1];
    const mo = m2[2].padStart(2, '0');
    const d = m2[3].padStart(2, '0');
    return `${y}-${mo}-${d}T12:00:00.000Z`;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString();
  return null;
};

export const examDateToDay = (iso?: string | null): string => {
  if (!iso) return '';
  return iso.slice(0, 10);
};

export const compareExamDates = (a?: string | null, b?: string | null): number => {
  const da = examDateToDay(parseExamDateToIso(a) || a);
  const db = examDateToDay(parseExamDateToIso(b) || b);
  if (!da && !db) return 0;
  if (!da) return -1;
  if (!db) return 1;
  return da.localeCompare(db);
};

/** 是否应将报告数据写入当前档案快照（仅较新或同日检查） */
export const shouldApplyReportToSnapshot = (
  reportExamDate: string,
  currentCheckupDate?: string | null
): boolean => {
  const reportIso = parseExamDateToIso(reportExamDate);
  if (!reportIso) return true;
  if (!currentCheckupDate) return true;
  return compareExamDates(reportIso, currentCheckupDate) >= 0;
};
