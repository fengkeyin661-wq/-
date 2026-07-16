import React, { useState } from 'react';
import { ModalPortal } from '../user/ModalPortal';
import type { CheckupPortalGuide } from '../../services/checkupPortalContentService';

interface Props {
  guide: CheckupPortalGuide;
}

export const CheckupNoticePanel: React.FC<Props> = ({ guide }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="mx-4 mb-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-2xl border border-amber-100 bg-amber-50/80 flex items-center justify-between gap-3 px-4 py-3.5 text-left active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg" aria-hidden>
              📋
            </span>
            <div className="min-w-0">
              <div className="text-sm font-black text-amber-900">{guide.noticeTitle}</div>
              <div className="text-[11px] text-amber-700/80 truncate">
                到检须知 · 时间地址 · 检后服务（点击查看全文）
              </div>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-800 shrink-0">查看</span>
        </button>
      </section>

      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkup-notice-title"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/45"
              aria-label="关闭体检须知"
              onClick={() => setOpen(false)}
            />

            <div className="relative w-full max-w-md mx-auto max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden">
              <div className="shrink-0 pt-3 pb-1 flex justify-center">
                <div className="w-10 h-1 rounded-full bg-slate-200" aria-hidden />
              </div>

              <div className="shrink-0 px-4 pb-3 flex items-center gap-3 border-b border-amber-100">
                <div className="flex-1 min-w-0">
                  <h2 id="checkup-notice-title" className="text-base font-black text-amber-900">
                    {guide.noticeTitle}
                  </h2>
                  <p className="text-[11px] text-amber-700/80">上拉或下滑可查看完整内容</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold text-sm"
                  aria-label="关闭"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4 [-webkit-overflow-scrolling:touch] bg-amber-50/40">
                <div>
                  <h3 className="text-xs font-black text-amber-900 mb-2">到检注意事项</h3>
                  <ol className="space-y-2">
                    {guide.noticeItems.map((item, idx) => (
                      <li key={idx} className="flex gap-2 text-[13px] leading-relaxed text-slate-700">
                        <span className="shrink-0 font-bold text-amber-700 w-5 text-right">{idx + 1}.</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="rounded-xl bg-white border border-amber-100 p-3 space-y-3">
                  <InfoBlock title="体检时间" body={guide.timeInfoContent} />
                  <InfoBlock title={guide.addressTitle} body={guide.addressContent} />
                  <div>
                    <div className="text-[11px] font-black text-amber-800 mb-1">{guide.transportTitle}</div>
                    <ul className="space-y-1.5">
                      {guide.transportItems.map((line) => (
                        <li key={line} className="text-[12px] leading-relaxed text-slate-600">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                  <h3 className="text-xs font-black text-emerald-900 mb-3 flex items-center gap-1.5">
                    <span aria-hidden>💚</span>
                    {guide.postServiceTitle}
                  </h3>
                  <ol className="space-y-3">
                    {guide.postServiceItems.map((item, idx) => (
                      <li key={`${item.title}-${idx}`} className="text-[13px] leading-relaxed text-slate-700">
                        <div className="font-bold text-emerald-800 mb-0.5">
                          {idx + 1}. {item.title}
                        </div>
                        <p className="text-[12px] text-slate-600">{item.content}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="rounded-xl bg-white border border-amber-100 p-3 mb-2">
                  <div className="text-[11px] font-black text-amber-800 mb-2">咨询电话</div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {guide.phones.map((phone) => (
                      <a
                        key={phone}
                        href={`tel:${phone.replace(/-/g, '')}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-900 text-sm font-bold"
                      >
                        📞 {phone}
                      </a>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{guide.contactFooter}</p>
                </div>
              </div>

              <div className="shrink-0 p-3 border-t border-slate-100 bg-white">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full py-3 rounded-2xl bg-amber-600 text-white font-bold text-sm"
                >
                  我知道了
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};

const InfoBlock: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div>
    <div className="text-[11px] font-black text-amber-800 mb-0.5">{title}</div>
    <p className="text-[12px] leading-relaxed text-slate-600">{body}</p>
  </div>
);
