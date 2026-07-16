import React from 'react';
import {
  CHECKUP_ADDRESS_INFO,
  CHECKUP_CONTACT_PHONES,
  CHECKUP_TIME_LINES,
} from './checkupNoticeContent';

/** 首页突出展示：体检时间 / 地址 / 咨询电话 */
export const CheckupVenueInfo: React.FC = () => {
  return (
    <section className="mx-4 mb-4 rounded-2xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
      <div className="bg-emerald-600 px-4 py-2.5">
        <h2 className="text-sm font-black text-white tracking-wide">到检信息</h2>
      </div>

      <div className="divide-y divide-slate-100">
        <div className="flex gap-3 px-4 py-3.5">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg" aria-hidden>
            🕒
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black text-emerald-800 mb-1">体检时间</div>
            <ul className="space-y-0.5">
              {CHECKUP_TIME_LINES.map((line) => (
                <li key={line} className="text-[13px] leading-snug text-slate-700 font-medium">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex gap-3 px-4 py-3.5">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg" aria-hidden>
            📍
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black text-emerald-800 mb-1">{CHECKUP_ADDRESS_INFO.title}</div>
            <p className="text-[13px] leading-relaxed text-slate-700 font-medium">
              {CHECKUP_ADDRESS_INFO.content}
            </p>
          </div>
        </div>

        <div className="flex gap-3 px-4 py-3.5">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg" aria-hidden>
            📞
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black text-emerald-800 mb-1.5">咨询电话</div>
            <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
              {CHECKUP_CONTACT_PHONES.map((phone, idx) => (
                <React.Fragment key={phone}>
                  {idx > 0 && <span className="text-emerald-500/60 font-bold px-0.5">/</span>}
                  <a
                    href={`tel:${phone.replace(/-/g, '')}`}
                    className="text-base font-black text-emerald-700 tracking-wide"
                  >
                    {phone}
                  </a>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
