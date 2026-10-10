import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchInteractions,
  updateInteractionStatus,
  type InteractionItem,
} from '../services/contentService';
import { isCheckupBooking, parseBookingDetails } from '../services/bookingContact';
import {
  formatFriendlyDate,
  formatLocalYmd,
  parseCheckupAppointmentFromDetails,
  resolveCheckupSlotDateKey,
} from '../services/checkupBookingScheduleUtils';
import { getCheckupBookingDashboardUrl } from '../services/checkupBookingDashboardRoute';

interface Props {
  onLogout?: () => void;
}

type EnrichedBooking = InteractionItem & {
  contactName: string;
  contactPhone: string;
  slotLabel: string;
  slotDateKey: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  cancelled: '已拒绝',
  completed: '已完成',
};

export const CheckupBookingMobileDashboard: React.FC<Props> = ({ onLogout }) => {
  const [rows, setRows] = useState<InteractionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'today' | 'pending' | 'upcoming' | 'all'>('today');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchInteractions();
      setRows(all.filter(isCheckupBooking));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(id);
  }, [load]);

  const enriched = useMemo((): EnrichedBooking[] => {
    return rows.map((item) => {
      const parsed = parseBookingDetails(item.details);
      const appt = parseCheckupAppointmentFromDetails(item.details);
      return {
        ...item,
        contactName: parsed.contactName || item.userName,
        contactPhone: parsed.contactPhone,
        slotLabel: appt.slotLabel,
        slotDateKey: appt.slotLabel ? resolveCheckupSlotDateKey(appt.slotLabel) : null,
      };
    });
  }, [rows]);

  const todayKey = formatLocalYmd();

  const stats = useMemo(() => {
    const pending = enriched.filter((r) => r.status === 'pending').length;
    const todayVisit = enriched.filter(
      (r) => r.status !== 'cancelled' && r.slotDateKey === todayKey,
    ).length;
    const todayPending = enriched.filter(
      (r) => r.status === 'pending' && r.slotDateKey === todayKey,
    ).length;
    const upcoming = enriched.filter(
      (r) =>
        r.status !== 'cancelled' &&
        r.slotDateKey &&
        r.slotDateKey >= todayKey,
    ).length;
    return { pending, todayVisit, todayPending, upcoming, total: enriched.length };
  }, [enriched, todayKey]);

  const visible = useMemo(() => {
    switch (filter) {
      case 'pending':
        return enriched.filter((r) => r.status === 'pending');
      case 'today':
        return enriched.filter(
          (r) => r.status !== 'cancelled' && r.slotDateKey === todayKey,
        );
      case 'upcoming':
        return enriched.filter(
          (r) =>
            r.status !== 'cancelled' &&
            r.slotDateKey &&
            r.slotDateKey >= todayKey,
        );
      default:
        return enriched;
    }
  }, [enriched, filter, todayKey]);

  const grouped = useMemo(() => {
    const sorted = [...visible].sort((a, b) => {
      const da = a.slotDateKey || '9999-99-99';
      const db = b.slotDateKey || '9999-99-99';
      if (da !== db) return da.localeCompare(db);
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return String(b.date).localeCompare(String(a.date));
    });

    const map = new Map<string, EnrichedBooking[]>();
    for (const item of sorted) {
      const key = item.slotDateKey || '未解析时段';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()];
  }, [visible]);

  const handleStatus = async (id: string, status: InteractionItem['status']) => {
    await updateInteractionStatus(id, status);
    setExpandedId(null);
    await load();
  };

  const dashboardUrl = getCheckupBookingDashboardUrl();

  return (
    <div className="min-h-[100dvh] bg-slate-100 flex flex-col">
      <header className="sticky top-0 z-20 bg-emerald-800 text-white shadow-lg safe-area-top">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold text-emerald-200/90">体检预约 · 手机看板</p>
              <h1 className="text-xl font-black tracking-tight">{formatFriendlyDate(todayKey)}工作安排</h1>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25"
              >
                {loading ? '…' : '刷新'}
              </button>
              {onLogout ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25"
                >
                  退出
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <MiniStat label="待确认" value={stats.pending} highlight={stats.pending > 0} />
            <MiniStat label="今日到检" value={stats.todayVisit} />
            <MiniStat label="今日待审" value={stats.todayPending} warn={stats.todayPending > 0} />
            <MiniStat label="未来预约" value={stats.upcoming} />
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto px-3 pb-3 scrollbar-none">
          {([
            ['today', `今日 ${stats.todayVisit}`],
            ['pending', `待确认 ${stats.pending}`],
            ['upcoming', `未来 ${stats.upcoming}`],
            ['all', `全部 ${stats.total}`],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                filter === id ? 'bg-white text-emerald-800' : 'bg-emerald-700/60 text-emerald-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-3 py-4 pb-8 space-y-4">
        {loading && visible.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400">加载中…</div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center">
            <div className="text-4xl mb-3 opacity-30">📋</div>
            <p className="text-sm text-slate-500">当前筛选下暂无预约</p>
          </div>
        ) : (
          grouped.map(([dateKey, items]) => (
            <section key={dateKey}>
              <h2 className="mb-2 px-1 text-xs font-black uppercase tracking-wider text-slate-500">
                {dateKey === '未解析时段'
                  ? '时段待核对'
                  : formatFriendlyDate(dateKey)}
                <span className="ml-2 font-bold text-slate-400">{items.length} 人</span>
              </h2>
              <div className="space-y-2">
                {items.map((item) => (
                  <BookingCard
                    key={item.id}
                    item={item}
                    expanded={expandedId === item.id}
                    onToggle={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                    onConfirm={() => void handleStatus(item.id, 'confirmed')}
                    onReject={() => void handleStatus(item.id, 'cancelled')}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-4 text-center">
          <p className="text-[11px] font-bold text-slate-500">收藏此链接，每天打开手机即可查看</p>
          <p className="mt-1 break-all text-[10px] text-slate-400 font-mono">{dashboardUrl}</p>
        </div>
      </main>
    </div>
  );
};

const MiniStat: React.FC<{
  label: string;
  value: number;
  highlight?: boolean;
  warn?: boolean;
}> = ({ label, value, highlight, warn }) => (
  <div
    className={`rounded-xl px-2 py-2 text-center ${
      highlight ? 'bg-amber-400/25 ring-1 ring-amber-300/50' : warn ? 'bg-orange-400/20' : 'bg-white/10'
    }`}
  >
    <div className={`text-lg font-black leading-none ${highlight || warn ? 'text-amber-100' : 'text-white'}`}>
      {value}
    </div>
    <div className="mt-1 text-[10px] font-bold text-emerald-100/90">{label}</div>
  </div>
);

const BookingCard: React.FC<{
  item: EnrichedBooking;
  expanded: boolean;
  onToggle: () => void;
  onConfirm: () => void;
  onReject: () => void;
}> = ({ item, expanded, onToggle, onConfirm, onReject }) => {
  const statusClass =
    item.status === 'confirmed'
      ? 'bg-green-100 text-green-700'
      : item.status === 'cancelled'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-800';

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-100">
      <button type="button" onClick={onToggle} className="w-full p-4 text-left active:bg-slate-50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-black text-slate-800">{item.contactName}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass}`}>
                {STATUS_LABEL[item.status] || item.status}
              </span>
              {item.userId?.startsWith('guest_') ? (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">访客</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm font-bold text-emerald-700 truncate">{item.targetName}</p>
            <p className="mt-0.5 text-xs text-slate-500">{item.slotLabel || '时段未解析'}</p>
          </div>
          <span className="shrink-0 text-slate-300 text-lg">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1.5">
            <p>
              <span className="text-slate-400">电话：</span>
              {item.contactPhone ? (
                <a href={`tel:${item.contactPhone}`} className="font-mono font-bold text-teal-700">
                  {item.contactPhone}
                </a>
              ) : (
                '未登记'
              )}
            </p>
            <p>
              <span className="text-slate-400">提交：</span>
              {item.date}
            </p>
          </div>

          {item.contactPhone ? (
            <a
              href={`tel:${item.contactPhone}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-bold text-white"
            >
              📞 一键拨号
            </a>
          ) : null}

          {item.status === 'pending' ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white"
              >
                确认预约
              </button>
              <button
                type="button"
                onClick={onReject}
                className="rounded-xl border border-red-200 py-3 text-sm font-bold text-red-600"
              >
                拒绝
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};
