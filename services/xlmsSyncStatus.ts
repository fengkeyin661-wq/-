import { listExamDatesForArchive } from './checkupImportService';
import { findArchiveByCheckupId } from './dataService';
import { formatCheckupId, isValidCheckupId } from './checkupIdUtils';

export interface SyncedExamMark {
  examDate: string;
  tjcs: string;
}

export async function listSyncedExamMarks(checkupIdRaw: string): Promise<Record<string, unknown>> {
  const checkupId = formatCheckupId(checkupIdRaw);
  if (!isValidCheckupId(checkupId)) {
    return { success: false, ok: false, httpStatus: 400, message: '体检编号须为 6 位数字', exams: [] };
  }

  const exams: SyncedExamMark[] = [];
  const seen = new Set<string>();
  const push = (examDate: string, tjcs: string) => {
    const day = examDate.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || seen.has(day)) return;
    seen.add(day);
    exams.push({ examDate: day, tjcs });
  };

  const archive = await findArchiveByCheckupId(checkupId);
  for (const exam of archive?.health_record?.xlmsExams || []) {
    push(exam.examDate || '', String(exam.tjcs ?? ''));
  }
  const dates = await listExamDatesForArchive(checkupId);
  for (const examDate of dates) push(examDate, '');

  return { success: true, ok: true, httpStatus: 200, checkupId, exams };
}
