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
      <div className="bg-emerald-600 px-4 py-3">
        <h2 className="text-base font-black text-white tracking-wide">到检信息</h2>
      </div>

      <div className="divide-y divide-slate-100 px-4">
        <div className="py-4">
          <div className="text-sm font-black text-emerald-800 mb-2">体检时间</div>
          <ul className="space-y-1.5">
            {CHECKUP_TIME_LINES.map((line) => (
              <li key={line} className="text-[15px] leading-snug text-slate-800 font-semibold">
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="py-4">
          <div className="text-sm font-black text-emerald-800 mb-2">{CHECKUP_ADDRESS_INFO.title}</div>
          <p className="text-[15px] leading-relaxed text-slate-800 font-semibold">
            {CHECKUP_ADDRESS_INFO.content}
          </p>
        </div>

        <div className="py-4">
          <div className="text-sm font-black text-emerald-800 mb-2">咨询电话</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {CHECKUP_CONTACT_PHONES.map((phone, idx) => (
              <React.Fragment key={phone}>
                {idx > 0 && <span className="text-emerald-500/50 font-bold text-lg">/</span>}
                <a
                  href={`tel:${phone.replace(/-/g, '')}`}
                  className="text-lg font-black text-emerald-700 tracking-wide"
                >
                  {phone}
                </a>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
