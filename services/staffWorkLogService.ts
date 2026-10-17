import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getCurrentStaff, restoreStaffFromStorage } from './staffContext';

export const STAFF_ACTION_TYPES = [
  'archive_create',
  'archive_update',
  'profile_edit',
  'assessment_run',
  'critical_handle',
  'followup_record',
  'sms_send',
  'report_import',
] as const;

export type StaffActionType = (typeof STAFF_ACTION_TYPES)[number];

export const STAFF_ACTION_LABELS: Record<StaffActionType, string> = {
  archive_create: '新建档案',
  archive_update: '更新档案',
  profile_edit: '编辑基本信息',
  assessment_run: '完成评估',
  critical_handle: '危急值处置',
  followup_record: '随访记录',
  sms_send: '发送短信',
  report_import: '导入体检报告',
};

export interface StaffWorkLogRow {
  id: string;
  staff_id: string;
  staff_name: string;
  staff_role: string;
  action_type: StaffActionType;
  checkup_id?: string | null;
  target_name?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface LogStaffWorkInput {
  actionType: StaffActionType;
  checkupId?: string;
  targetName?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface StaffWorkStatsRow {
  staffId: string;
  staffName: string;
  counts: Record<StaffActionType, number>;
  total: number;
}

const resolveStaff = () => getCurrentStaff() || restoreStaffFromStorage();

export const logStaffWork = async (input: LogStaffWorkInput): Promise<void> => {
  const staff = resolveStaff();
  if (!staff) return;

  const row = {
    staff_id: staff.id,
    staff_name: staff.name,
    staff_role: staff.role,
    action_type: input.actionType,
    checkup_id: input.checkupId || null,
    target_name: input.targetName || null,
    summary: input.summary || STAFF_ACTION_LABELS[input.actionType],
    metadata: input.metadata || null,
  };

  if (!isSupabaseConfigured()) {
    try {
      const key = 'HEALTH_STAFF_WORK_LOGS_LOCAL';
      const raw = localStorage.getItem(key);
      const all: typeof row[] = raw ? JSON.parse(raw) : [];
      all.unshift({ ...row, id: `local_${Date.now()}`, created_at: new Date().toISOString() } as any);
      localStorage.setItem(key, JSON.stringify(all.slice(0, 500)));
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    const { error } = await supabase.from('staff_work_logs').insert(row);
    if (error) console.warn('[logStaffWork]', error.message);
  } catch (e) {
    console.warn('[logStaffWork]', e);
  }
};

export const fetchStaffWorkLogs = async (options: {
  staffId?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<StaffWorkLogRow[]> => {
  const limit = options.limit ?? 200;

  if (!isSupabaseConfigured()) {
    try {
      const raw = localStorage.getItem('HEALTH_STAFF_WORK_LOGS_LOCAL');
      let rows: StaffWorkLogRow[] = raw ? JSON.parse(raw) : [];
      if (options.staffId) rows = rows.filter((r) => r.staff_id === options.staffId);
      if (options.from) rows = rows.filter((r) => r.created_at >= options.from!);
      if (options.to) rows = rows.filter((r) => r.created_at <= options.to!);
      return rows.slice(0, limit);
    } catch {
      return [];
    }
  }

  try {
    let query = supabase
      .from('staff_work_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (options.staffId) query = query.eq('staff_id', options.staffId);
    if (options.from) query = query.gte('created_at', options.from);
    if (options.to) query = query.lte('created_at', options.to);

    const { data, error } = await query;
    if (error) {
      console.warn('[fetchStaffWorkLogs]', error.message);
      return [];
    }
    return (data || []) as StaffWorkLogRow[];
  } catch {
    return [];
  }
};

export const fetchStaffWorkStats = async (options: {
  staffId?: string;
  from?: string;
  to?: string;
}): Promise<StaffWorkStatsRow[]> => {
  const logs = await fetchStaffWorkLogs({ ...options, limit: 5000 });
  const map = new Map<string, StaffWorkStatsRow>();

  for (const log of logs) {
    let row = map.get(log.staff_id);
    if (!row) {
      row = {
        staffId: log.staff_id,
        staffName: log.staff_name,
        counts: STAFF_ACTION_TYPES.reduce(
          (acc, t) => {
            acc[t] = 0;
            return acc;
          },
          {} as Record<StaffActionType, number>,
        ),
        total: 0,
      };
      map.set(log.staff_id, row);
    }
    if (STAFF_ACTION_TYPES.includes(log.action_type as StaffActionType)) {
      row.counts[log.action_type as StaffActionType] += 1;
      row.total += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
};

export const getPeriodRange = (period: 'today' | 'week' | 'month'): { from: string; to: string } => {
  const now = new Date();
  const to = now.toISOString();
  const start = new Date(now);
  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start.setDate(start.getDate() - 7);
  } else {
    start.setMonth(start.getMonth() - 1);
  }
  return { from: start.toISOString(), to };
};

export const countActionsInPeriod = async (
  staffId: string | undefined,
  period: 'today' | 'week' | 'month',
  actionTypes?: StaffActionType[],
): Promise<number> => {
  const { from, to } = getPeriodRange(period);
  const logs = await fetchStaffWorkLogs({ staffId, from, to, limit: 5000 });
  const types = actionTypes || STAFF_ACTION_TYPES;
  return logs.filter((l) => types.includes(l.action_type as StaffActionType)).length;
};
