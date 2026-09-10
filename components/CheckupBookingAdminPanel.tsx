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

export const CheckupBookingAdminPanel: React.FC<{
  title?: string;
  compact?: boolean;
}> = ({ title = '体检预约', compact = false }) => {
  const [rows, setRows] = useState<InteractionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('pending');

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

  const visible = useMemo(() => {
    const list = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
    return [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [rows, filter]);

  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  const handleStatus = async (id: string, status: InteractionItem['status']) => {
    await updateInteractionStatus(id, status);
    await load();
  };

  return (
    <div className={compact ? '' : 'h-full overflow-y-auto p-6'}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            来自体检预约站与用户端「健康体检」套餐预约。待确认 {pendingCount} 条。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ['pending', '待确认'],
            ['confirmed', '已确认'],
            ['cancelled', '已拒绝'],
            ['all', '全部'],
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
              {id === 'pending' ? ` ${pendingCount}` : ''}
            </button>
          ))}
          <button type="button" onClick={() => void load()} className="text-xs font-bold text-teal-700">
            {loading ? '刷新中…' : '刷新'}
          </button>
        </div>
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
                  {loading
                    ? '加载中…'
                    : filter === 'pending'
                      ? '暂无待确认的体检预约。请确认套餐已上架并配置了可预约时段。'
                      : '暂无记录'}
                </td>
              </tr>
            ) : (
              visible.map((item) => {
                const parsed = parseBookingDetails(item.details);
                return (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-3 py-3 font-bold text-slate-800">
                      {parsed.contactName || item.userName}
                      {item.userId?.startsWith('guest_') ? (
                        <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">访客</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {parsed.contactPhone ? (
                        <a className="font-mono text-teal-700" href={`tel:${parsed.contactPhone}`}>
                          {parsed.contactPhone}
                        </a>
                      ) : (
                        '—'
                      )}
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
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
