import React, { useEffect, useRef, useState } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  pendingCount: number;
  accentClass?: string;
  children: React.ReactNode;
};

/** 有待办时默认展开；待办清零后自动折叠，可点击标题展开查看历史 */
export const AuditCollapsibleSection: React.FC<Props> = ({
  title,
  subtitle,
  pendingCount,
  accentClass = 'border-teal-500',
  children,
}) => {
  const [open, setOpen] = useState(() => pendingCount > 0);
  const prevPending = useRef(pendingCount);

  useEffect(() => {
    if (pendingCount === 0) {
      setOpen(false);
    } else if (prevPending.current === 0 && pendingCount > 0) {
      setOpen(true);
    }
    prevPending.current = pendingCount;
  }, [pendingCount]);

  const collapsed = !open;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 p-6 text-left hover:bg-slate-50/80 transition-colors"
        aria-expanded={!collapsed}
      >
        <span
          className={`mt-1 shrink-0 text-slate-400 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          aria-hidden
        >
          ▶
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`text-lg font-bold text-slate-700 border-l-4 pl-3 ${accentClass}`}>{title}</h3>
            {pendingCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-800">
                待处理 {pendingCount}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">
                暂无待办
              </span>
            )}
          </div>
          {subtitle ? <p className="mt-1 pl-4 text-xs text-slate-500">{subtitle}</p> : null}
          {collapsed ? (
            <p className="mt-2 pl-4 text-xs text-slate-400">已折叠 · 点击展开查看列表</p>
          ) : null}
        </div>
      </button>
      {!collapsed ? <div className="border-t border-slate-100 px-6 pb-6 pt-2">{children}</div> : null}
    </section>
  );
};
