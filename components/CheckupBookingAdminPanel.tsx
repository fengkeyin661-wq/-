import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchInteractions,
  updateInteractionStatus,
  type InteractionItem,
} from '../services/contentService';
import { isCheckupBooking, parseBookingDetails } from '../services/bookingContact';

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'cancelled';

const STATUS_LABEL: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  cancelled: '已拒绝',
  completed: '已完成',
};

const maskPhone = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  if (d.length < 7) return '点击查看';
  return `${d.slice(0, 3)}****${d.slice(-4)}`;
};

const todayKey = () => new Date().toISOString().slice(0, 10);

export const CheckupBookingAdminPanel: React.FC<{
  title?: string;
  compact?: boolean;
}> = ({ title = '体检预约情况汇总', compact = false }) => {
  const [rows, setRows] = useState<InteractionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<InteractionItem | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const all = await fetchInteractions();
      setRows(all.filter(isCheckupBooking));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const today = todayKey();
    const pending = rows.filter((r) => r.status === 'pending').length;
    const confirmed = rows.filter((r) => r.status === 'confirmed').length;
    const cancelled = rows.filter((r) => r.status === 'cancelled').length;
    const todayCount = rows.filter((r) => r.status !== 'cancelled' && r.date === today).length;
    const byPackage = rows
      .filter((r) => r.status !== 'cancelled')
      .reduce<Record<string, number>>((acc, r) => {
        const name = r.targetName || '未命名套餐';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});
    const topPackages = Object.entries(byPackage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    return {
      total: rows.length,
      pending,
      confirmed,
      cancelled,
      todayCount,
      topPackages,
    };
  }, [rows]);

  const visible = useMemo(() => {
    const list = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
    return [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [rows, filter]);

  const handleStatus = async (id: string, status: InteractionItem['status']) => {
    await updateInteractionStatus(id, status);
    setSelected(null);
    await load();
  };

  const selectedParsed = selected ? parseBookingDetails(selected.details) : null;

  return (
    <div className={compact ? '' : 'h-full overflow-y-auto p-6'}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">点击预约人姓名可查看联系电话。来自体检预约站与用户端体检套餐。</p>
        </div>
        <button type="button" onClick={() => void load()} className="text-xs font-bold text-teal-700">
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="预约总数" value={stats.total} />
        <StatCard label="待确认" value={stats.pending} accent="amber" />
        <StatCard label="已确认" value={stats.confirmed} accent="emerald" />
        <StatCard label="今日预约" value={stats.todayCount} accent="teal" />
      </div>

      {stats.topPackages.length > 0 ? (
        <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="mb-3 text-xs font-bold text-slate-500">套餐预约量</p>
          <div className="space-y-2">
            {stats.topPackages.map(([name, count]) => {
              const max = stats.topPackages[0][1] || 1;
              return (
                <div key={name}>
                  <div className="mb-0.5 flex justify-between text-xs">
                    <span className="truncate pr-2 font-medium text-slate-700">{name}</span>
                    <b className="shrink-0">{count}</b>
                  </div>
                  <div className="h-1.5 rounded-full bg-white">
                    <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-2">
        {([
          ['all', `全部 ${stats.total}`],
          ['pending', `待确认 ${stats.pending}`],
          ['confirmed', `已确认 ${stats.confirmed}`],
          ['cancelled', `已拒绝 ${stats.cancelled}`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              filter === id ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-slate-500">
              <th className="px-3 py-2.5">预约人</th>
              <th className="px-3 py-2.5">联系电话</th>
              <th className="px-3 py-2.5">套餐</th>
              <th className="px-3 py-2.5">时段 / 价格</th>
              <th className="px-3 py-2.5">提交日</th>
              <th className="px-3 py-2.5">状态</th>
              <th className="px-3 py-2.5 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-slate-400">
                  {loading ? '加载中…' : '暂无体检预约记录'}
                </td>
              </tr>
            ) : (
              visible.map((item) => {
                const parsed = parseBookingDetails(item.details);
                const phone = parsed.contactPhone;
                return (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setSelected(item)}
                        className="text-left font-bold text-teal-700 hover:underline"
                      >
                        {parsed.contactName || item.userName}
                      </button>
                      {item.userId?.startsWith('guest_') ? (
                        <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">访客</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setSelected(item)}
                        className="font-mono text-xs text-slate-500 hover:text-teal-700"
                      >
                        {phone ? maskPhone(phone) : '点击查看'}
                      </button>
                    </td>
                    <td className="px-3 py-3">{item.targetName}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{parsed.business || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-400">{item.date}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          item.status === 'confirmed'
                            ? 'bg-green-100 text-green-700'
                            : item.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {STATUS_LABEL[item.status] || item.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {item.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleStatus(item.id, 'confirmed')}
                            className="font-bold text-green-600 hover:underline"
                          >
                            确认
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatus(item.id, 'cancelled')}
                            className="font-bold text-red-600 hover:underline"
                          >
                            拒绝
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setSelected(item)} className="text-xs font-bold text-teal-700">
                          查看电话
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selected && selectedParsed ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 px-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-bold text-emerald-700">预约人员</p>
            <h4 className="mt-1 text-xl font-black text-slate-800">{selectedParsed.contactName || selected.userName}</h4>
            <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
              <p>
                <span className="text-slate-500">联系电话：</span>
                {selectedParsed.contactPhone ? (
                  <a className="font-mono font-bold text-teal-700" href={`tel:${selectedParsed.contactPhone}`}>
                    {selectedParsed.contactPhone}
                  </a>
                ) : (
                  '未登记'
                )}
              </p>
              <p>
                <span className="text-slate-500">套餐：</span>
                {selected.targetName}
              </p>
              <p>
                <span className="text-slate-500">时段：</span>
                {selectedParsed.business || '—'}
              </p>
              <p>
                <span className="text-slate-500">状态：</span>
                {STATUS_LABEL[selected.status] || selected.status}
              </p>
            </div>
            <div className="mt-5 flex gap-2">
              {selected.status === 'pending' ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleStatus(selected.id, 'confirmed')}
                    className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white"
                  >
                    确认预约
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatus(selected.id, 'cancelled')}
                    className="flex-1 rounded-xl border border-red-200 py-2.5 text-sm font-bold text-red-600"
                  >
                    拒绝
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; accent?: 'amber' | 'emerald' | 'teal' }> = ({
  label,
  value,
  accent,
}) => {
  const color =
    accent === 'amber'
      ? 'text-amber-600'
      : accent === 'emerald'
        ? 'text-emerald-700'
        : accent === 'teal'
          ? 'text-teal-700'
          : 'text-slate-800';
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
};
