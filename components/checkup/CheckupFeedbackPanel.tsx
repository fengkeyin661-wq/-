import React, { useState } from 'react';
import { submitCheckupFeedback } from '../../services/checkupFeedback';
import { validateChinaMobile } from '../../services/bookingContact';

export const CheckupFeedbackPanel: React.FC = () => {
  const [content, setContent] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      setContent('');
      setName('');
      setPhone('');
      setSubmitted(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="mx-4 mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <div className="text-3xl mb-2">✅</div>
        <p className="text-sm font-bold text-emerald-800">感谢您的反馈！</p>
        <p className="mt-1 text-xs text-emerald-700/80 leading-relaxed">
          我们已收到您的意见建议，将用于持续改进体检预约与到检服务。
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-4 text-xs font-bold text-emerald-700 underline"
        >
          继续反馈
        </button>
      </section>
    );
  }

  return (
    <section className="mx-4 mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
          <span aria-hidden>💬</span>
          意见反馈
        </h2>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          欢迎提出预约流程、到检体验、套餐内容等方面的意见建议，帮助我们改进体检工作。
        </p>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, 500))}
        placeholder="请描述您的建议或遇到的问题，例如：预约时段、到检指引、套餐说明等…"
        rows={4}
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
          placeholder="手机（选填，便于回复）"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
        />
      </div>

      <button
        type="button"
        disabled={submitting || !content.trim()}
        onClick={() => void handleSubmit()}
        className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] transition-transform"
      >
        {submitting ? '提交中…' : '提交反馈'}
      </button>
    </section>
  );
};
