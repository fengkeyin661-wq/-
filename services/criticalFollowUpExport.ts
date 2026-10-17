import type { HealthArchive } from './dataService';
import {
  formatArchiveCheckupDate,
  getCriticalStatusBadge,
} from './followUpLinkageService';
import { formatCriticalRecorder } from '../components/CriticalHandleModal';
// @ts-ignore
import * as XLSX from 'xlsx';

export type CriticalExportTab = 'pending' | 'archived';

export const exportCriticalFollowUpArchives = (
  data: HealthArchive[],
  type: CriticalExportTab,
  filenamePrefix = '危急值随访',
) => {
  if (data.length === 0) {
    alert('名单为空，无法导出');
    return;
  }
  const rows = data.map((arch) => {
    const track = arch.critical_track;
    return {
      体检编号: arch.checkup_id,
      姓名: arch.name,
      性别: arch.gender,
      年龄: arch.age,
      '单位/部门': arch.department,
      联系电话: arch.phone || '-',
      危急项目: track?.critical_item || '待定',
      异常描述: track?.critical_desc || arch.assessment_data?.criticalWarning || '-',
      当前状态: getCriticalStatusBadge(arch, type).label.replace(/^[🔥🕒✅📞]\s*/, ''),
      计划回访日期: track?.secondary_due_date || '-',
      初次记录人: track?.initial_recorder_name
        ? formatCriticalRecorder(track.initial_recorder_name, track.initial_recorder_role)
        : '-',
      二次记录人: track?.secondary_recorder_name
        ? formatCriticalRecorder(track.secondary_recorder_name, track.secondary_recorder_role)
        : '-',
      体检日期: formatArchiveCheckupDate(arch),
      处置记录: track?.initial_feedback || '-',
      最后更新: new Date(arch.updated_at || arch.created_at).toLocaleString(),
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '危急值随访名单');
  XLSX.writeFile(
    wb,
    `${filenamePrefix}_${type === 'pending' ? '待处理' : '已结案'}_${new Date().toISOString().split('T')[0]}.xlsx`,
  );
};

export const exportFollowUpWorklistRows = (
  rows: Array<{
    archive: HealthArchive;
    kind: string;
    routine?: { date: string; daysLeft: number; focus: string };
    critical?: { item: string; desc: string; statusLabel: string };
  }>,
) => {
  if (rows.length === 0) {
    alert('名单为空，无法导出');
    return;
  }
  const sheetRows = rows.map((row) => ({
    体检编号: row.archive.checkup_id,
    姓名: row.archive.name,
    部门: row.archive.department,
    随访类别: row.critical && row.routine ? '危急+计划' : row.critical ? '危急重点' : '计划随访',
    危急项目: row.critical?.item || '-',
    危急状态: row.critical?.statusLabel || '-',
    危急描述: row.critical?.desc || '-',
    计划日期: row.routine?.date || '-',
    距计划天数: row.routine != null ? row.routine.daysLeft : '-',
    重点复查: row.routine?.focus || '-',
  }));
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '随访工作列表');
  XLSX.writeFile(wb, `随访工作列表_${new Date().toISOString().split('T')[0]}.xlsx`);
};
