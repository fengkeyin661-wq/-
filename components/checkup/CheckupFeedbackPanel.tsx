import React, { useState } from 'react';
import { submitCheckupFeedback } from '../../services/checkupFeedback';
import { validateChinaMobile } from '../../services/bookingContact';
import { ModalPortal } from '../user/ModalPortal';

export const CheckupFeedbackPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const resetForm = () => {
    setContent('');
    setName('');
    setPhone('');
    setSubmitted(false);
  };

  const handleClose = () => {
    if (submitting) return;
    setOpen(false);
    window.setTimeout(resetForm, 200);
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      alert('请填写您的意见建议');
      return;
    }
    if (trimmed.length < 5) {
      alert('请至少输入 5 个字，便于我们理解您的建议');
      return;
    }
    const p = phone.trim();
    if (p && !validateChinaMobile(p)) {
      alert('如填写手机号，请输入 11 位有效号码');
      return;
    }

    setSubmitting(true);
    try {
      await submitCheckupFeedback({
        content: trimmed,
        contactName: name.trim() || undefined,
        contactPhone: p || undefined,
      });
      setSubmitted(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm hover:border-emerald-200 hover:bg-emerald-50/50 active:scale-[0.99]"
      >
        <span aria-hidden>💬</span>
        意见反馈
      </button>

      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[115] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={handleClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkup-feedback-title"
          >
            <div
              className="w-full max-w-md rounded-t-[1.75rem] bg-white shadow-2xl animate-slideUp sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="checkup-feedback-title" className="text-lg font-black text-slate-800">
                      意见反馈
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                      欢迎提出预约流程、到检体验、套餐内容等方面的建议
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-full px-3 py-1 text-sm font-bold text-slate-400 hover:bg-slate-100"
                  >
                    关闭
                  </button>
                </div>
              </div>

              <div className="max-h-[70dvh] overflow-y-auto p-5">
                {submitted ? (
                  <div className="py-6 text-center">
                    <div className="text-4xl mb-3">✅</div>
                    <p className="text-sm font-bold text-emerald-800">感谢您的反馈！</p>
                    <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                      我们已收到您的意见建议，将用于持续改进体检预约与到检服务。
                    </p>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="mt-6 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white"
                    >
                      完成
                    </button>
                  </div>
                ) : (
                  <>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value.slice(0, 500))}
                      placeholder="请描述您的建议或遇到的问题…"
                      rows={5}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none resize-none"
                    />
                    <p className="mt-1 text-right text-[10px] text-slate-400">{content.length}/500</p>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="姓名（选填）"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
                      />
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="手机（选填）"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={submitting || !content.trim()}
                      onClick={() => void handleSubmit()}
                      className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? '提交中…' : '提交反馈'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};
