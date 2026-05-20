import { supabase, isSupabaseConfigured } from './supabaseClient';
import { validateMetricValue, CORE_METRICS, type ObservationSource } from './metricCatalog';
import type { ObservationInput } from './observationMapper';
import { findArchiveByCheckupId } from './dataService';

export interface HealthObservationRow {
  id: string;
  archive_id: string;
  checkup_id: string;
  metric_code: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  observed_at: string;
  recorded_at: string;
  source: string;
  source_ref: string | null;
  entered_by_role: string | null;
  status: 'active' | 'voided';
}

export interface ChartPoint {
  date: string;
  label: string;
  value: number;
  source?: string;
}

/** 趋势图横轴：年月日（如 2024年4月24日） */
export const formatObservationChartLabel = (observedAt: string): string => {
  const day = observedAt.slice(0, 10);
  const match = day.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    return `${match[1]}年${parseInt(match[2], 10)}月${parseInt(match[3], 10)}日`;
  }
  const d = new Date(observedAt);
  if (Number.isNaN(d.getTime())) return day;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

const OBSERVATIONS_CACHE_PREFIX = 'HEALTH_OBSERVATIONS_CACHE_';

const cacheKey = (checkupId: string) => `${OBSERVATIONS_CACHE_PREFIX}${checkupId}`;

const readCache = (checkupId: string): HealthObservationRow[] => {
  try {
    const raw = localStorage.getItem(cacheKey(checkupId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeCache = (checkupId: string, rows: HealthObservationRow[]) => {
  try {
    localStorage.setItem(cacheKey(checkupId), JSON.stringify(rows));
  } catch {
    /* ignore */
  }
};

export const upsertObservations = async (
  checkupId: string,
  inputs: ObservationInput[]
): Promise<{ success: boolean; inserted: number; message?: string; observationIds?: string[] }> => {
  if (!inputs.length) return { success: true, inserted: 0 };

  const archive = await findArchiveByCheckupId(checkupId);
  if (!archive) return { success: false, inserted: 0, message: '未找到档案' };

  const validRows: Record<string, unknown>[] = [];
  for (const inp of inputs) {
    const v = validateMetricValue(inp.metricCode, inp.valueNumeric);
    if (!v.ok) continue;
    const def = CORE_METRICS.find((m) => m.code === inp.metricCode);
    validRows.push({
      archive_id: archive.id,
      checkup_id: checkupId,
      metric_code: inp.metricCode,
      value_numeric: inp.valueNumeric,
      value_text: String(inp.valueNumeric),
      unit: inp.unit || def?.unit || null,
      observed_at: inp.observedAt,
      source: inp.source,
      source_ref: inp.sourceRef || null,
      entered_by_role: inp.enteredByRole || null,
      status: 'active',
    });
  }

  if (!validRows.length) return { success: true, inserted: 0 };

  const cached = readCache(checkupId);
  const newLocal: HealthObservationRow[] = validRows.map((r, i) => ({
    id: `local-${Date.now()}-${i}`,
    archive_id: String(r.archive_id),
    checkup_id: checkupId,
    metric_code: String(r.metric_code),
    value_numeric: r.value_numeric as number,
    value_text: r.value_text as string,
    unit: (r.unit as string) || null,
    observed_at: String(r.observed_at),
    recorded_at: new Date().toISOString(),
    source: String(r.source),
    source_ref: (r.source_ref as string) || null,
    entered_by_role: (r.entered_by_role as string) || null,
    status: 'active',
  }));
  writeCache(checkupId, [...cached, ...newLocal]);

  if (!isSupabaseConfigured()) {
    return { success: true, inserted: validRows.length, observationIds: newLocal.map((x) => x.id) };
  }

  const { data, error } = await supabase.from('health_observations').insert(validRows).select('id');
  if (error) {
    if (error.message.includes('Could not find') || error.code === '42P01') {
      return { success: true, inserted: validRows.length, message: '观测表未迁移，已缓存本地' };
    }
    return { success: false, inserted: 0, message: error.message };
  }

  const now = new Date().toISOString();
  await supabase
    .from('health_archives')
    .update({ last_observation_at: now, updated_at: now })
    .eq('checkup_id', checkupId);

  await supabase.from('health_data_events').insert({
    archive_id: archive.id,
    checkup_id: checkupId,
    event_type: 'observation_created',
    payload: { count: validRows.length, source: validRows[0]?.source },
  });

  return {
    success: true,
    inserted: data?.length || validRows.length,
    observationIds: (data || []).map((r: { id: string }) => r.id),
  };
};

export const voidObservation = async (
  observationId: string,
  reason?: string
): Promise<{ success: boolean; message?: string }> => {
  if (!isSupabaseConfigured() || observationId.startsWith('local-')) {
    return { success: true, message: '本地观测已忽略' };
  }
  const { error } = await supabase
    .from('health_observations')
    .update({
      status: 'voided',
      voided_at: new Date().toISOString(),
      void_reason: reason || 'user_void',
    })
    .eq('id', observationId);
  if (error) return { success: false, message: error.message };
  return { success: true };
};

export const fetchObservationSeries = async (
  checkupId: string,
  metricCodes: string[],
  limit = 120
): Promise<HealthObservationRow[]> => {
  let rows: HealthObservationRow[] = [];
  if (isSupabaseConfigured()) {
    try {
      let q = supabase
        .from('health_observations')
        .select('*')
        .eq('checkup_id', checkupId)
        .eq('status', 'active')
        .order('observed_at', { ascending: true })
        .limit(limit);
      if (metricCodes.length === 1) q = q.eq('metric_code', metricCodes[0]);
      else if (metricCodes.length > 1) q = q.in('metric_code', metricCodes);
      const { data, error } = await q;
      if (!error && data) rows = data as HealthObservationRow[];
    } catch {
      /* fallback cache */
    }
  }
  if (!rows.length) rows = readCache(checkupId).filter((r) => r.status === 'active');
  if (metricCodes.length) {
    rows = rows.filter((r) => metricCodes.includes(r.metric_code));
  }
  return rows;
};

export const buildChartSeries = (
  rows: HealthObservationRow[],
  metricCode: string
): ChartPoint[] => {
  return rows
    .filter((r) => r.metric_code === metricCode && r.value_numeric != null)
    .map((r) => ({
      date: r.observed_at.slice(0, 10),
      label: formatObservationChartLabel(r.observed_at),
      value: Number(r.value_numeric),
      source: r.source,
    }));
};

export const buildBpChartData = (
  rows: HealthObservationRow[]
): { date: string; label: string; sbp?: number; dbp?: number }[] => {
  const byDate = new Map<string, { date: string; label: string; sbp?: number; dbp?: number }>();
  for (const r of rows) {
    const key = r.observed_at.slice(0, 10);
    const label = formatObservationChartLabel(r.observed_at);
    const cur = byDate.get(key) || { date: key, label };
    if (r.metric_code === 'core.sbp' && r.value_numeric != null) cur.sbp = Number(r.value_numeric);
    if (r.metric_code === 'core.dbp' && r.value_numeric != null) cur.dbp = Number(r.value_numeric);
    byDate.set(key, cur);
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
};

/** 按指标汇总历次观测，供 AI 结合趋势分析 */
export const buildObservationTrendsSummary = async (checkupId: string): Promise<string> => {
  const codes = CORE_METRICS.map((m) => m.code);
  const rows = await fetchObservationSeries(checkupId, codes, 500);
  if (!rows.length) return '';

  const byMetric = new Map<string, { date: string; value: number; source: string }[]>();
  for (const r of rows) {
    if (r.value_numeric == null) continue;
    const list = byMetric.get(r.metric_code) || [];
    list.push({
      date: r.observed_at.slice(0, 10),
      value: Number(r.value_numeric),
      source: r.source,
    });
    byMetric.set(r.metric_code, list);
  }

  const lines: string[] = [];
  for (const def of CORE_METRICS) {
    const points = byMetric.get(def.code);
    if (!points?.length) continue;
    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
    const series = sorted.map((p) => `${p.date}:${p.value}${def.unit}`).join(' → ');
    lines.push(`${def.label}(${def.code}): ${series}`);
  }
  return lines.join('\n');
};

export const getLatestObservationsMap = async (
  checkupId: string
): Promise<Map<string, number>> => {
  const rows = await fetchObservationSeries(checkupId, CORE_METRICS.map((m) => m.code), 500);
  const map = new Map<string, number>();
  const sorted = [...rows].sort(
    (a, b) => new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime()
  );
  for (const r of sorted) {
    if (!map.has(r.metric_code) && r.value_numeric != null) {
      map.set(r.metric_code, Number(r.value_numeric));
    }
  }
  return map;
};

export const ensureDefaultMetricPreferences = async (archiveId: string): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const rows = CORE_METRICS.map((m, i) => ({
    archive_id: archiveId,
    metric_code: m.code,
    enabled: true,
    display_order: i + 1,
  }));
  await supabase.from('user_metric_preferences').upsert(rows, {
    onConflict: 'archive_id,metric_code',
    ignoreDuplicates: true,
  });
};

export interface MetricPreference {
  metric_code: string;
  enabled: boolean;
  display_order: number;
}

export const fetchMetricPreferences = async (
  archiveId: string
): Promise<MetricPreference[]> => {
  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from('user_metric_preferences')
      .select('metric_code, enabled, display_order')
      .eq('archive_id', archiveId)
      .order('display_order', { ascending: true });
    if (data?.length) return data as MetricPreference[];
  }
  return CORE_METRICS.map((m, i) => ({
    metric_code: m.code,
    enabled: true,
    display_order: i + 1,
  }));
};

export const saveMetricPreferences = async (
  archiveId: string,
  prefs: MetricPreference[]
): Promise<boolean> => {
  if (!isSupabaseConfigured()) return true;
  const { error } = await supabase.from('user_metric_preferences').upsert(
    prefs.map((p) => ({
      archive_id: archiveId,
      metric_code: p.metric_code,
      enabled: p.enabled,
      display_order: p.display_order,
    })),
    { onConflict: 'archive_id,metric_code' }
  );
  return !error;
};

export type { ObservationSource };
