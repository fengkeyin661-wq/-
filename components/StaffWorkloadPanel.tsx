import React, { useEffect, useMemo, useState } from 'react';
import {
  STAFF_ACTION_LABELS,
  STAFF_ACTION_TYPES,
  StaffActionType,
  StaffWorkLogRow,
  StaffWorkStatsRow,
  countActionsInPeriod,
  fetchStaffWorkLogs,
  fetchStaffWorkStats,
  getPeriodRange,
} from '../services/staffWorkLogService';
import { fetchArchives } from '../services/dataService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
// @ts-ignore
import * as XLSX from 'xlsx';

interface Props {
  staffId?: string;
  staffName?: string;
  title?: string;
  showTeamExport?: boolean;
}

export const StaffWorkloadPanel: React.FC<Props> = ({
  staffId,
  staffName,
  title = '我的工作',
  showTeamExport = false,
}) => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [logs, setLogs] = useState<StaffWorkLogRow[]>([]);
  const [teamStats, setTeamStats] = useState<StaffWorkStatsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayCount, setTodayCount] = useState(0);
  const [weekCount, setWeekCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [nameByCheckupId, setNameByCheckupId] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { from, to } = getPeriodRange(period);
    const [logRows, t, w, m] = await Promise.all([
      fetchStaffWorkLogs({ staffId, from, to, limit: 300 }),
      countActionsInPeriod(staffId, 'today'),
      countActionsInPeriod(staffId, 'week'),
      countActionsInPeriod(staffId, 'month'),
    ]);
    setLogs(logRows);
    setTodayCount(t);
    setWeekCount(w);
    setMonthCount(m);
    if (showTeamExport && !staffId) {
      const stats = await fetchStaffWorkStats({ from, to });
      setTeamStats(stats);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [staffId, period, showTeamExport]);

  useEffect(() => {
    const missingIds = [
      ...new Set(
        logs
          .filter((log) => log.checkup_id && !log.target_name)
          .map((log) => log.checkup_id as string),
      ),
    ];
    if (missingIds.length === 0) return;

    fetchArchives()
      .then((archives) => {
        const map: Record<string, string> = {};
        for (const id of missingIds) {
          const name = archives.find((arch) => arch.checkup_id === id)?.name;
          if (name) map[id] = name;
        }
        if (Object.keys(map).length > 0) {
          setNameByCheckupId((prev) => ({ ...prev, ...map }));
        }
      })
      .catch(() => {
        /* ignore lookup failures */
      });
  }, [logs]);

  const resolveTargetName = (log: StaffWorkLogRow) => {
    const recorded = log.target_name?.trim();
    if (recorded && recorded !== log.checkup_id) return recorded;
    if (log.checkup_id && nameByCheckupId[log.checkup_id]) return nameByCheckupId[log.checkup_id];
    return recorded || undefined;
  };

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, 0);
    }
    for (const log of logs) {
      const key = log.created_at.slice(0, 10);
      if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).map(([date, count]) => ({ date: date.slice(5), count }));
  }, [logs]);

  const typeBreakdown = useMemo(() => {
    const counts = STAFF_ACTION_TYPES.reduce(
      (acc, t) => {
        acc[t] = 0;
        return acc;
      },
      {} as Record<StaffActionType, number>,
    );
    for (const log of logs) {
      if (STAFF_ACTION_TYPES.includes(log.action_type as StaffActionType)) {
        counts[log.action_type as StaffActionType] += 1;
      }
    }
    return STAFF_ACTION_TYPES.map((t) => ({
      type: t,
      label: STAFF_ACTION_LABELS[t],
      count: counts[t],
    })).filter((x) => x.count > 0);
  }, [logs]);

  const handleExportTeam = () => {
    const rows = teamStats.map((s) => ({
      姓名: s.staffName,
      工号ID: s.staffId,
      合计: s.total,
      ...STAFF_ACTION_TYPES.reduce(
        (acc, t) => {
          acc[STAFF_ACTION_LABELS[t]] = s.counts[t];
          return acc;
        },
        {} as Record<string, number>,
      ),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '团队工作量');
    XLSX.writeFile(wb, `团队工作量_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-6 space-y-6 animate-fadeIn max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
          {staffName && <p className="text-sm text-slate-500 mt-1">{staffName}</p>}
        </div>
        <div className="flex gap-2 items-center">
          {(['today', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                period === p
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {p === 'today' ? '今日明细' : p === 'week' ? '近7天' : '近30天'}
            </button>
          ))}
          {showTeamExport && teamStats.length > 0 && (
            <button
              type="button"
              onClick={handleExportTeam}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50"
            >
              导出 Excel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '今日', value: todayCount },
          { label: '近7天', value: weekCount },
          { label: '近30天', value: monthCount },
          { label: '当前时段', value: logs.length },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs text-slate-500">{c.label}</div>
            <div className="text-2xl font-bold text-teal-700 mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      {typeBreakdown.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {typeBreakdown.map((x) => (
            <div key={x.type} className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
              <div className="text-[11px] text-slate-500">{x.label}</div>
              <div className="text-lg font-bold text-slate-800">{x.count}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm h-64">
        <h3 className="text-sm font-bold text-slate-700 mb-3">近 30 日操作趋势</h3>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">加载中…</div>
        ) : (
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {showTeamExport && teamStats.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b bg-slate-50 font-bold text-slate-700 text-sm">团队汇总</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-3">姓名</th>
                  {STAFF_ACTION_TYPES.map((t) => (
                    <th key={t} className="p-3 whitespace-nowrap">
                      {STAFF_ACTION_LABELS[t]}
                    </th>
                  ))}
                  <th className="p-3">合计</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teamStats.map((s) => (
                  <tr key={s.staffId} className="hover:bg-slate-50">
                    <td className="p-3 font-medium">{s.staffName}</td>
                    {STAFF_ACTION_TYPES.map((t) => (
                      <td key={t} className="p-3 text-center">
                        {s.counts[t] || '-'}
                      </td>
                    ))}
                    <td className="p-3 font-bold text-teal-700">{s.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b bg-slate-50 font-bold text-slate-700 text-sm">操作明细</div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">加载中…</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">暂无记录</div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 sticky top-0">
                <tr>
                  <th className="p-3">时间</th>
                  {!staffId && <th className="p-3">操作人</th>}
                  <th className="p-3">类型</th>
                  <th className="p-3">姓名</th>
                  <th className="p-3">体检编号</th>
                  <th className="p-3">摘要</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3 whitespace-nowrap text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    {!staffId && <td className="p-3">{log.staff_name}</td>}
                    <td className="p-3">{STAFF_ACTION_LABELS[log.action_type as StaffActionType] || log.action_type}</td>
                    <td className="p-3 font-medium text-slate-800">{resolveTargetName(log) || '-'}</td>
                    <td className="p-3 font-mono text-slate-600">{log.checkup_id || '-'}</td>
                    <td className="p-3 text-slate-600 max-w-xs truncate">{log.summary || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
