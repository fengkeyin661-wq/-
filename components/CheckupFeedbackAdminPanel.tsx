import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchInteractions,
  updateInteractionStatus,
  type InteractionItem,
} from '../services/contentService';
import {
  isCheckupFeedback,
  parseCheckupFeedbackContent,
  parseCheckupFeedbackContact,
} from '../services/checkupFeedback';

export const CheckupFeedbackAdminPanel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [rows, setRows] = useState<InteractionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const load = async () => {
    setLoading(true);
    try {
      const all = await fetchInteractions();
      setRows(all.filter(isCheckupFeedback));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const list = filter === 'pending' ? rows.filter((r) => r.status === 'pending') : rows;
    return [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [rows, filter]);

  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  const markDone = async (id: string) => {
    await updateInteractionStatus(id, 'completed');
    await load();
  };

  return (
    <div className={compact ? '' : 'p-6'}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800">体检预约意见反馈</h3>
          <p className="mt-0.5 text-xs text-slate-500">来自体检预约站用户端底部反馈栏</p>
        </div>
        <button type="button" onClick={() => void load()} className="text-xs font-bold text-teal-700">
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setFilter('pending')}
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
            filter === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          待处理 {pendingCount}
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
            filter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          全部 {rows.length}
        </button>
      </div>

      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            {loading ? '加载中…' : '暂无反馈'}
          </div>
        ) : (
          visible.map((item) => {
            const parsed = parseCheckupFeedbackContact(item.details);
            const feedback = parseCheckupFeedbackContent(item.details);
            return (
              <article
                key={item.id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="font-bold text-slate-800">{parsed.contactName || item.userName || '匿名用户'}</span>
                    {parsed.contactPhone ? (
                      <a
                        href={`tel:${parsed.contactPhone}`}
                        className="ml-2 font-mono text-xs text-teal-700 hover:underline"
                      >
                        {parsed.contactPhone}
                      </a>
                    ) : (
                      <span className="ml-2 text-xs text-slate-400">未留电话</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{item.date}</span>
                    {item.status === 'pending' ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        待处理
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                        已处理
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{feedback}</p>
                {item.status === 'pending' ? (
                  <button
                    type="button"
                    onClick={() => void markDone(item.id)}
                    className="mt-3 text-xs font-bold text-teal-700 hover:underline"
                  >
                    标记为已处理
                  </button>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};
