import React from 'react';
import type { PackageDisplayGroup } from '../../services/userServiceCatalog';

type Tone = 'emerald' | 'indigo' | 'rose';

const TONE: Record<
  Tone,
  { box: string; title: string; sub: string; item: string; divider: string }
> = {
  emerald: {
    box: 'bg-emerald-50 border-emerald-100',
    title: 'text-emerald-800',
    sub: 'text-emerald-700',
    item: 'text-emerald-950',
    divider: 'border-emerald-100/80',
  },
  indigo: {
    box: 'bg-indigo-50 border-indigo-100',
    title: 'text-indigo-800',
    sub: 'text-indigo-700',
    item: 'text-indigo-950',
    divider: 'border-indigo-100/80',
  },
  rose: {
    box: 'bg-rose-50 border-rose-100',
    title: 'text-rose-800',
    sub: 'text-rose-700',
    item: 'text-rose-950',
    divider: 'border-rose-100/80',
  },
};

interface Props {
  title: string;
  groups: PackageDisplayGroup[];
  tone?: Tone;
  note?: string;
}

/** 套餐项目按临床大类分组展示 */
export const PackageItemGroupedList: React.FC<Props> = ({
  title,
  groups,
  tone = 'emerald',
  note,
}) => {
  if (!groups.length) return null;
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const c = TONE[tone];

  return (
    <div className={`rounded-xl border p-4 mb-4 ${c.box}`}>
      <div className={`text-sm font-black ${c.title} flex items-baseline justify-between gap-2`}>
        <span>{title}</span>
        <span className="text-xs font-bold opacity-70">共 {total} 项</span>
      </div>
      {note ? <p className={`text-[12px] mt-1.5 leading-relaxed opacity-90 ${c.sub}`}>{note}</p> : null}

      <div className="mt-3 space-y-3">
        {groups.map((group) => (
          <div key={group.key}>
            <div
              className={`text-[12px] font-black tracking-wide mb-1.5 pb-1 border-b ${c.sub} ${c.divider}`}
            >
              {group.label}
              <span className="font-semibold opacity-60 ml-1.5">({group.items.length})</span>
            </div>
            <ul className="space-y-0">
              {group.items.map((item) => (
                <li
                  key={`${item.serviceId}-${item.title}`}
                  className={`flex items-start justify-between gap-3 py-1.5 text-[14px] leading-snug ${c.item}`}
                >
                  <span className="min-w-0 flex-1 font-medium">{item.title}</span>
                  <span className="shrink-0 text-[12px] font-semibold opacity-70 tabular-nums">
                    {item.quantity && item.quantity > 1 ? `×${item.quantity}` : ''}
                    {item.note ? (item.quantity && item.quantity > 1 ? ` · ${item.note}` : item.note) : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
