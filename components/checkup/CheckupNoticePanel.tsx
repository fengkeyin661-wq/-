import React, { useState } from 'react';
import {
  CHECKUP_ADDRESS_INFO,
  CHECKUP_CONTACT_FOOTER,
  CHECKUP_CONTACT_PHONES,
  CHECKUP_NOTICE_ITEMS,
  CHECKUP_NOTICE_TITLE,
  CHECKUP_TIME_INFO,
  CHECKUP_TRANSPORT_INFO,
} from './checkupNoticeContent';

interface Props {
  /** 默认是否展开须知全文 */
  defaultExpanded?: boolean;
}

export const CheckupNoticePanel: React.FC<Props> = ({ defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className="mx-4 mb-4 rounded-2xl border border-amber-100 bg-amber-50/80 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg" aria-hidden>
            📋
          </span>
          <div className="min-w-0">
            <div className="text-sm font-black text-amber-900">{CHECKUP_NOTICE_TITLE}</div>
            <div className="text-[11px] text-amber-700/80 truncate">
              空腹须知 · 时间地址 · 乘车路线
            </div>
          </div>
        </div>
        <span className="text-xs font-bold text-amber-800 shrink-0">
          {expanded ? '收起' : '展开'}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-amber-100/80">
          <div className="pt-3">
            <h3 className="text-xs font-black text-amber-900 mb-2">到检注意事项</h3>
            <ol className="space-y-2">
              {CHECKUP_NOTICE_ITEMS.map((item, idx) => (
                <li key={idx} className="flex gap-2 text-[13px] leading-relaxed text-slate-700">
                  <span className="shrink-0 font-bold text-amber-700 w-5 text-right">{idx + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl bg-white/80 border border-amber-100 p-3 space-y-3">
            <InfoBlock title={CHECKUP_TIME_INFO.title} body={CHECKUP_TIME_INFO.content} />
            <InfoBlock title={CHECKUP_ADDRESS_INFO.title} body={CHECKUP_ADDRESS_INFO.content} />
            <div>
              <div className="text-[11px] font-black text-amber-800 mb-1">{CHECKUP_TRANSPORT_INFO.title}</div>
              <ul className="space-y-1.5">
                {CHECKUP_TRANSPORT_INFO.items.map((line) => (
                  <li key={line} className="text-[12px] leading-relaxed text-slate-600">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl bg-white border border-amber-100 p-3">
            <div className="text-[11px] font-black text-amber-800 mb-2">咨询电话</div>
            <div className="flex flex-wrap gap-2 mb-2">
              {CHECKUP_CONTACT_PHONES.map((phone) => (
                <a
                  key={phone}
                  href={`tel:${phone.replace(/-/g, '')}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-900 text-sm font-bold"
                >
                  📞 {phone}
                </a>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{CHECKUP_CONTACT_FOOTER}</p>
          </div>
        </div>
      )}
    </section>
  );
};

const InfoBlock: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div>
    <div className="text-[11px] font-black text-amber-800 mb-0.5">{title}</div>
    <p className="text-[12px] leading-relaxed text-slate-600">{body}</p>
  </div>
);
