import type { HealthArchive } from './dataService';
import type {
  CriticalTrackRecord,
  FollowUpContext,
  FollowUpRecord,
  HealthAssessment,
  HealthRecord,
  IndicatorDeltaEntry,
  ScheduledFollowUp,
} from '../types';
import { RiskLevel } from '../types';

const METRIC_DEFS: { key: keyof FollowUpRecord['indicators']; label: string; unit: string }[] = [
  { key: 'sbp', label: '收缩压', unit: 'mmHg' },
  { key: 'dbp', label: '舒张压', unit: 'mmHg' },
  { key: 'glucose', label: '血糖', unit: 'mmol/L' },
  { key: 'weight', label: '体重', unit: 'kg' },
  { key: 'tc', label: '总胆固醇', unit: 'mmol/L' },
  { key: 'tg', label: '甘油三酯', unit: 'mmol/L' },
  { key: 'ldl', label: 'LDL-C', unit: 'mmol/L' },
  { key: 'hdl', label: 'HDL-C', unit: 'mmol/L' },
];

export const parseCriticalWarning = (warning: string): { level: string; desc: string; item: string } => {
  const levelMatch = warning.match(/\[\s*([AB])\s*[12１２]?\s*类\s*\]/);
  const level = levelMatch ? `${levelMatch[1]}类` : 'B类';
  const desc = warning.replace(/\[[AB][12]?类\]\s*/g, '').trim() || '存在危急指标';
  const itemMatch = desc.match(/^([^，,：:\d]+)/);
  const item = itemMatch ? itemMatch[1].trim().slice(0, 40) : '危急值筛查';
  return { level, desc, item };
};

export const sortFollowUps = (followUps: FollowUpRecord[] = []): FollowUpRecord[] =>
  [...followUps].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    if (da !== db) return da - db;
    return Number(a.id) - Number(b.id);
  });

export const getLatestFollowUp = (followUps: FollowUpRecord[] = []): FollowUpRecord | null => {
  const sorted = sortFollowUps(followUps);
  return sorted.length ? sorted[sorted.length - 1] : null;
};

export const computeIndicatorDelta = (
  prior: FollowUpRecord['indicators'] | null | undefined,
  curr: FollowUpRecord['indicators']
): Record<string, IndicatorDeltaEntry> => {
  const deltas: Record<string, IndicatorDeltaEntry> = {};
  if (!prior) return deltas;
  for (const def of METRIC_DEFS) {
    const prevVal = Number(prior[def.key]);
    const currVal = Number(curr[def.key]);
    if (!Number.isFinite(prevVal) || !Number.isFinite(currVal) || prevVal === 0) continue;
    if (prevVal === currVal) continue;
    deltas[def.key] = { prev: prevVal, curr: currVal, unit: def.unit };
  }
  return deltas;
};

export const extractCheckItemsFromText = (text: string): string[] => {
  if (!text) return [];
  return text
    .split(/[，,、;；\n\/|]/)
    .map((s) => s.trim())
    .map((s) => s.replace(/建议|定期|复查|监测|检查|评估|关注|前往|专科|就诊|完善/g, ''))
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
};

/** 规范化后用于去重（忽略「复查/监测」等填充词与空白差异） */
export const normalizeFocusItemKey = (s: string): string =>
  String(s || '')
    .trim()
    .replace(/建议|定期|复查|监测|检查|评估|关注|前往|专科|就诊|完善|项目/g, '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

/** 将数组或整段文案展开为条目（数组元素内若含顿号也会拆开） */
export const expandFocusItems = (src: string[] | string | undefined | null): string[] => {
  if (!src) return [];
  const parts = Array.isArray(src) ? src : [src];
  const out: string[] = [];
  for (const part of parts) {
    const raw = String(part || '').trim();
    if (!raw) continue;
    const split = raw
      .split(/[，,、;；\n\/|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (split.length > 1) out.push(...split);
    else out.push(raw);
  }
  return out;
};

export const mergeFocusItems = (...sources: (string[] | string | undefined | null)[]): string[] => {
  const byKey = new Map<string, string>();
  for (const src of sources) {
    if (!src) continue;
    for (const item of expandFocusItems(src)) {
      const key = normalizeFocusItemKey(item);
      if (key.length < 2) continue;
      // 保留更短、更干净的展示文案（去掉填充词后的版本优先）
      const cleaned = item
        .replace(/建议|定期/g, '')
        .trim();
      const display = cleaned.length > 1 ? cleaned : item.trim();
      const existing = byKey.get(key);
      if (!existing || display.length < existing.length) {
        byKey.set(key, display);
      }
    }
  }
  return Array.from(byKey.values());
};

/** 危急值名单检索：姓名、体检编号、危急项目/描述/等级/警示 */
export const matchesCriticalArchiveSearch = (arch: HealthArchive, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const track = arch.critical_track;
  const haystack = [
    arch.name,
    arch.checkup_id,
    track?.critical_item,
    track?.critical_desc,
    track?.critical_level,
    arch.assessment_data?.criticalWarning,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
};

export const formatArchiveCheckupDate = (arch: HealthArchive): string => {
  const raw = arch.health_record?.profile?.checkupDate;
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString('zh-CN');
};

/** 当前评估是否仍标记为危急值 */
export const hasCurrentCriticalFlag = (arch: HealthArchive): boolean => {
  if (arch.assessment_data?.isCritical) return true;
  const warning = arch.assessment_data?.criticalWarning || '';
  return /\[\s*[AB]\s*[12１２]?\s*类\s*\]/.test(warning);
};

/** 危急值 track 是否已有实际处置/回访记录 */
export const hasCriticalTrackActivity = (track?: CriticalTrackRecord | null): boolean => {
  if (!track) return false;
  return !!(
    track.initial_feedback?.trim() ||
    track.secondary_feedback?.trim() ||
    track.initial_notify_time?.trim() ||
    track.secondary_notify_time?.trim() ||
    track.resolvedAt
  );
};

/** 是否应出现在「待随访追踪」名单 */
export const isCriticalFollowUpPending = (arch: HealthArchive): boolean => {
  if (hasCurrentCriticalFlag(arch)) return true;
  const track = arch.critical_track;
  if (!track) return false;
  return track.status === 'pending_initial' || track.status === 'pending_secondary';
};

/** 是否应出现在「已归档结案」名单（须已完成处置流程） */
export const isCriticalFollowUpArchived = (arch: HealthArchive): boolean => {
  const track = arch.critical_track;
  if (!track || track.status !== 'archived') return false;
  return hasCriticalTrackActivity(track);
};

/** 解析危急值处置状态（无 track 但有危急标记 → 待初次通知） */
export const resolveCriticalTrackStatus = (
  arch: HealthArchive
): CriticalTrackRecord['status'] | null => {
  const track = arch.critical_track;
  if (!track) {
    return hasCurrentCriticalFlag(arch) ? 'pending_initial' : null;
  }
  if (
    track.status === 'pending_initial' ||
    track.status === 'pending_secondary' ||
    track.status === 'archived'
  ) {
    return track.status;
  }
  return hasCurrentCriticalFlag(arch) ? 'pending_initial' : null;
};

export const getCriticalStatusLabel = (status: CriticalTrackRecord['status']): string => {
  switch (status) {
    case 'pending_initial':
      return '待初次通知';
    case 'pending_secondary':
      return '待二次追踪';
    case 'archived':
      return '已归档结案';
    default:
      return '待初次通知';
  }
};

/** 列表展示用状态徽章（待追踪名单禁止显示「已归档结案」） */
export const getCriticalStatusBadge = (
  arch: HealthArchive,
  tab: 'pending' | 'archived'
): { label: string; className: string } => {
  const raw = resolveCriticalTrackStatus(arch);
  if (tab === 'archived') {
    return {
      label: `✅ ${getCriticalStatusLabel('archived')}`,
      className: 'bg-green-50 text-green-600 border border-green-100',
    };
  }
  if (isCriticalContactRetryDue(arch)) {
    return {
      label: '📞 再联系到期',
      className: 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse',
    };
  }
  if (isCriticalContactDeferred(arch)) {
    const due = arch.critical_track?.contact_retry_due || '';
    return {
      label: due ? `延期至 ${due}` : '已延期再联系',
      className: 'bg-amber-50 text-amber-700 border border-amber-200',
    };
  }
  const status =
    raw === 'pending_secondary' ? 'pending_secondary' : 'pending_initial';
  if (status === 'pending_secondary') {
    return {
      label: '🕒 待二次回访',
      className: 'bg-blue-50 text-blue-600 border border-blue-100',
    };
  }
  return {
    label: '🔥 待初次通知',
    className: 'bg-red-100 text-red-600 border border-red-200 animate-pulse',
  };
};

/** 本地日历日 YYYY-MM-DD */
export const formatLocalYmd = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** 自今天起加 N 天（本地日历） */
export const addLocalDaysYmd = (days: number, from = new Date()): string => {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return formatLocalYmd(d);
};

/** 是否已设置「电话联系不上」延期，且尚未到再联系日 */
export const isCriticalContactDeferred = (arch: HealthArchive, today = formatLocalYmd(new Date())): boolean => {
  const due = arch.critical_track?.contact_retry_due?.trim();
  if (!due) return false;
  const status = resolveCriticalTrackStatus(arch);
  if (status !== 'pending_initial' && status !== 'pending_secondary') return false;
  return due > today;
};

/** 延期再联系日是否已到期（含当天） */
export const isCriticalContactRetryDue = (arch: HealthArchive, today = formatLocalYmd(new Date())): boolean => {
  const due = arch.critical_track?.contact_retry_due?.trim();
  if (!due) return false;
  const status = resolveCriticalTrackStatus(arch);
  if (status !== 'pending_initial' && status !== 'pending_secondary') return false;
  return due <= today;
};

/** 到期需弹窗再提醒的危急值人员 */
export const listCriticalContactRetryDue = (archives: HealthArchive[]): HealthArchive[] =>
  archives.filter((a) => isCriticalFollowUpPending(a) && isCriticalContactRetryDue(a));

/** 清除联系不上延期标记（成功通知/归档后调用；保留累计次数便于追溯） */
export const clearCriticalContactRetry = (track: CriticalTrackRecord): CriticalTrackRecord => {
  const next = { ...track };
  delete next.contact_retry_due;
  delete next.contact_unreachable_at;
  return next;
};

/** 当 isCritical 且无 track 时自动创建危急值工单 */
export const ensureCriticalTrackOnAssessment = (archive: HealthArchive): CriticalTrackRecord | null => {
  const assessment = archive.assessment_data;
  if (!assessment?.isCritical) return archive.critical_track || null;
  if (archive.critical_track && archive.critical_track.status !== 'archived') {
    const existing = archive.critical_track;
    if (
      existing.status === 'pending_initial' ||
      existing.status === 'pending_secondary'
    ) {
      return existing;
    }
    return { ...existing, status: 'pending_initial' as const };
  }

  const warning = assessment.criticalWarning || '';
  const parsed = parseCriticalWarning(warning);
  const due = new Date();
  due.setMonth(due.getMonth() + 1);

  return {
    id: archive.critical_track?.id || `crit_${crypto.randomUUID?.() || Date.now()}`,
    status: 'pending_initial',
    critical_item: archive.critical_track?.critical_item || parsed.item,
    critical_desc: archive.critical_track?.critical_desc || parsed.desc,
    critical_level: archive.critical_track?.critical_level || parsed.level,
    initial_notify_time: '',
    initial_feedback: '',
    secondary_due_date: archive.critical_track?.secondary_due_date || due.toISOString().split('T')[0],
    linkedFollowUpIds: archive.critical_track?.linkedFollowUpIds || [],
    autoCreated: true,
  };
};

export const buildFollowUpChainSummary = (followUps: FollowUpRecord[] = [], limit = 3): string => {
  const sorted = sortFollowUps(followUps);
  const recent = sorted.slice(-limit);
  if (!recent.length) return '（无历史随访记录）';

  return recent
    .map((r, idx) => {
      const n = sorted.length - recent.length + idx + 1;
      const ind = r.indicators;
      const tasks = r.taskCompliance || [];
      const achieved = tasks.filter((t) => t.status === 'achieved').length;
      const failed = tasks.filter((t) => t.status === 'failed').length;
      const med = (r.medicalCompliance || [])
        .map((m) => `${m.item}:${m.status}`)
        .join('；');
      return [
        `第${n}次 ${r.date} (${r.method})`,
        `指标: BP ${ind.sbp}/${ind.dbp}, 血糖 ${ind.glucose}, 体重 ${ind.weight}`,
        med ? `复查项: ${med}` : '',
        tasks.length ? `生活方式任务: ${achieved}达标/${failed}未做/共${tasks.length}项` : '',
        r.assessment?.majorIssues ? `主要问题: ${r.assessment.majorIssues}` : '',
        r.assessment?.nextCheckPlan ? `下期计划: ${r.assessment.nextCheckPlan}` : '',
        r.assessment?.continuitySummary ? `进展: ${r.assessment.continuitySummary}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
    })
    .join('\n');
};

export const resolveFollowUpSourceLabel = (
  archive: HealthArchive,
  pendingSchedule: ScheduledFollowUp | null
): string => {
  const track = archive.critical_track;
  if (track && track.status === 'pending_secondary') return '危急值二次回访';
  if (pendingSchedule?.source === 'critical') return '危急值转化随访';
  if (!getLatestFollowUp(archive.follow_ups)) return '新评估后首次随访';
  return '常规排期随访';
};

export const buildFollowUpContext = (archive: HealthArchive): FollowUpContext => {
  const followUps = archive.follow_ups || [];
  const priorRecord = getLatestFollowUp(followUps);
  const sorted = sortFollowUps(followUps);
  const secondLast = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const pendingSchedule = (archive.follow_up_schedule || []).find((s) => s.status === 'pending') || null;
  const criticalTrack =
    archive.critical_track && archive.critical_track.status !== 'archived'
      ? archive.critical_track
      : null;

  const focusItems = mergeFocusItems(
    pendingSchedule?.focusItems,
    priorRecord?.assessment?.adjustedFocusItems,
    priorRecord?.assessment?.nextCheckPlan,
    criticalTrack?.critical_item
  );

  const indicatorDeltas = priorRecord && secondLast
    ? computeIndicatorDelta(secondLast.indicators, priorRecord.indicators)
    : {};

  const tasks = priorRecord?.taskCompliance || [];
  const failedTasks = tasks.filter((t) => t.status === 'failed');
  const partialTasks = tasks.filter((t) => t.status === 'partial');

  return {
    sourceLabel: resolveFollowUpSourceLabel(archive, pendingSchedule),
    focusItems,
    priorRecord,
    pendingSchedule,
    criticalTrack,
    indicatorDeltas,
    failedTasks,
    partialTasks,
    chainSummaryText: buildFollowUpChainSummary(followUps, 3),
  };
};

export const linkFollowUpToCritical = (
  track: CriticalTrackRecord,
  followUpId: string
): CriticalTrackRecord => {
  const ids = track.linkedFollowUpIds || [];
  if (ids.includes(followUpId)) return track;
  return { ...track, linkedFollowUpIds: [...ids, followUpId] };
};

/** 危急值归档后清除 assessment 中的 isCritical（若指标未再达危急阈值由 AI 判定，此处仅处理归档闭环） */
export const clearCriticalFromAssessment = (assessment: HealthAssessment): HealthAssessment => ({
  ...assessment,
  isCritical: false,
  criticalWarning: '',
});

export const resolveCriticalIfApplicable = (
  archive: HealthArchive,
  newFollowUp: FollowUpRecord
): { track: CriticalTrackRecord | null; assessmentPatch: HealthAssessment | null } => {
  let track = archive.critical_track;
  if (!track) return { track: null, assessmentPatch: null };

  track = linkFollowUpToCritical(track, newFollowUp.id);

  if (newFollowUp.followUpType === 'critical_secondary' && track.status === 'pending_secondary') {
    track = {
      ...track,
      status: 'archived',
      secondary_feedback: newFollowUp.otherInfo || newFollowUp.mainComplaint || track.secondary_feedback,
      secondary_notify_time: new Date().toLocaleString(),
      resolvedAt: new Date().toISOString(),
      resolutionNote: newFollowUp.assessment?.criticalStatusNote || '二次回访已同步至常规随访',
    };
    return {
      track,
      assessmentPatch: clearCriticalFromAssessment(archive.assessment_data),
    };
  }

  if (track.status === 'archived') {
    return { track, assessmentPatch: null };
  }

  return { track, assessmentPatch: null };
};

export const getIndicatorValuesFromRecord = (
  record: HealthRecord | null | undefined,
  priorFollowUp: FollowUpRecord | null
): Partial<FollowUpRecord['indicators']> => {
  if (priorFollowUp?.indicators) {
    return { ...priorFollowUp.indicators };
  }
  const basics = record?.checkup?.basics;
  const lab = record?.checkup?.labBasic;
  return {
    sbp: Number(basics?.sbp || 0),
    dbp: Number(basics?.dbp || 0),
    glucose: Number(lab?.glucose?.fasting || 0),
    weight: Number(basics?.weight || 0),
    tc: lab?.lipids?.tc ? Number(lab.lipids.tc) : undefined,
    tg: lab?.lipids?.tg ? Number(lab.lipids.tg) : undefined,
    ldl: lab?.lipids?.ldl ? Number(lab.lipids.ldl) : undefined,
    hdl: lab?.lipids?.hdl ? Number(lab.lipids.hdl) : undefined,
  };
};

export const buildTaskComplianceFromPrior = (
  prior: FollowUpRecord | null,
  assessment: HealthAssessment | null,
  isAssessmentNewer: boolean
): NonNullable<FollowUpRecord['taskCompliance']> => {
  const baseItems: NonNullable<FollowUpRecord['taskCompliance']> = [];
  if (isAssessmentNewer && assessment?.managementPlan) {
    const plan = assessment.managementPlan;
    for (const d of plan.dietary || []) baseItems.push({ taskId: `d_${baseItems.length}`, description: `饮食：${d}`, status: 'achieved' });
    for (const e of plan.exercise || []) baseItems.push({ taskId: `e_${baseItems.length}`, description: `运动：${e}`, status: 'achieved' });
    for (const m of plan.monitoring || []) baseItems.push({ taskId: `m_${baseItems.length}`, description: `监测：${m}`, status: 'achieved' });
  } else if (prior?.assessment?.lifestyleGoals?.length) {
    prior.assessment.lifestyleGoals.forEach((g, i) => {
      baseItems.push({ taskId: `g_${i}`, description: g, status: 'achieved' });
    });
  }

  if (!prior?.taskCompliance?.length) return baseItems.length ? baseItems : [];

  const priorMap = new Map(prior.taskCompliance.map((t) => [t.description, t.status]));
  return (baseItems.length ? baseItems : prior.taskCompliance).map((t) => {
    const prevStatus = priorMap.get(t.description);
    if (prevStatus === 'failed' || prevStatus === 'partial') {
      return { ...t, status: 'partial' as const };
    }
    return t;
  });
};

export interface TimelineNode {
  id: string;
  date: string;
  type: 'follow_up' | 'critical_initial' | 'critical_secondary' | 'critical_archived';
  title: string;
  summary: string;
  riskLevel?: RiskLevel;
  linkedCritical?: boolean;
}

export const buildMergedTimeline = (archive: HealthArchive): TimelineNode[] => {
  const nodes: TimelineNode[] = [];
  for (const r of sortFollowUps(archive.follow_ups || [])) {
    nodes.push({
      id: r.id,
      date: r.date,
      type: 'follow_up',
      title: `${r.method}随访`,
      summary: r.assessment?.majorIssues || r.mainComplaint || '',
      riskLevel: r.assessment?.riskLevel,
      linkedCritical: !!r.linkedCriticalTrackId,
    });
  }
  const track = archive.critical_track;
  if (track) {
    if (track.initial_notify_time || track.initial_feedback) {
      nodes.push({
        id: `${track.id}_init`,
        date: track.initial_notify_time?.slice(0, 10) || track.secondary_due_date,
        type: 'critical_initial',
        title: '危急值初次通知',
        summary: track.initial_feedback || track.critical_desc,
      });
    }
    if (track.secondary_notify_time || track.secondary_feedback) {
      nodes.push({
        id: `${track.id}_sec`,
        date: track.secondary_notify_time?.slice(0, 10) || track.secondary_due_date,
        type: 'critical_secondary',
        title: '危急值二次回访',
        summary: track.secondary_feedback || '',
      });
    }
    if (track.status === 'archived' && track.resolvedAt) {
      nodes.push({
        id: `${track.id}_arch`,
        date: track.resolvedAt.slice(0, 10),
        type: 'critical_archived',
        title: '危急值归档',
        summary: track.resolutionNote || '已结案',
      });
    }
  }
  return nodes.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};
