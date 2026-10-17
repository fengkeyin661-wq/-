import React, { useMemo, useState } from 'react';
import {
  NEED_OPTIONS,
  closeNeedSurvey,
  doorServices,
  getNeedSurveyShareUrl,
  missingRequiredIds,
  surveySections,
  type SurveyAnswers,
  type SurveyQuestion,
} from '../../services/staffNeedSurveyCatalog';
import {
  hasLocalNeedSurveySubmitted,
  loadNeedSurveyDraft,
  saveNeedSurveyDraft,
  submitNeedSurvey,
} from '../../services/staffNeedSurveyService';

type Props = {
  checkupId?: string;
  userName?: string;
  onClose?: () => void;
};

const RESPONDENT_OPTIONS = ['教职工本人', '配偶', '子女', '其他家属'];
const CONTACT_OPTIONS = ['不留联系方式', '愿意接受后续回访'];

const Choice: React.FC<{
  q: SurveyQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
  extra?: string;
  onExtra?: (v: string) => void;
}> = ({ q, value, onChange, extra, onExtra }) => {
  if (q.text) {
    return (
      <textarea
        value={String(value || '')}
        onChange={(e) => onChange(e.target.value)}
        placeholder={q.hint || '请填写'}
        rows={3}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base leading-relaxed outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
    );
  }
  if (q.number) {
    return (
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        placeholder="请输入金额"
        className="h-12 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
    );
  }
  const selected = q.multi ? ((value as string[]) || []) : [];
  const isActive = (opt: string) => (q.multi ? selected.includes(opt) : value === opt);
  const toggle = (opt: string) => {
    if (q.multi) {
      onChange(isActive(opt) ? selected.filter((x) => x !== opt) : [...selected, opt]);
    } else {
      onChange(opt);
    }
  };
  const showOther = q.otherId && (q.multi ? selected.includes('其他') : value === '其他');
  const showMore = q.moreId && value === '可更高';
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2">
        {q.options?.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`min-h-[48px] rounded-xl border px-4 py-3 text-left text-[15px] font-medium transition-colors active:scale-[0.99] ${
              isActive(opt)
                ? 'border-teal-500 bg-teal-50 text-teal-800'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            <span className="mr-2 inline-block w-4 text-teal-600">{isActive(opt) ? (q.multi ? '☑' : '●') : q.multi ? '☐' : '○'}</span>
            {opt}
          </button>
        ))}
      </div>
      {showOther && (
        <input
          value={extra || ''}
          onChange={(e) => onExtra?.(e.target.value)}
          placeholder="请注明"
          className="h-12 w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-teal-500"
        />
      )}
      {showMore && (
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={extra || ''}
          onChange={(e) => onExtra?.(e.target.value)}
          placeholder="可接受的更高价格（元）"
          className="h-12 w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-teal-500"
        />
      )}
    </div>
  );
};

const MiniSelect: React.FC<{
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}> = ({ label, options, value, onChange }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-bold text-slate-500">{label}</span>
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
    >
      <option value="">请选择</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  </label>
);

export const StaffNeedSurveyForm: React.FC<Props> = ({ checkupId, userName, onClose }) => {
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<SurveyAnswers>(() => loadNeedSurveyDraft());
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: string; risk: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const shareUrl = useMemo(() => (typeof window !== 'undefined' ? getNeedSurveyShareUrl() : ''), []);

  const setField = (id: string, value: unknown) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      saveNeedSurveyDraft(next);
      return next;
    });
  };

  const totalSteps = surveySections.length;
  const progress = step < 0 ? 0 : Math.round(((step + 1) / totalSteps) * 100);
  const section = step >= 0 ? surveySections[step] : null;

  const saveDraft = () => {
    saveNeedSurveyDraft(answers);
    setStatus('草稿已保存在本机');
    setTimeout(() => setStatus(''), 2000);
  };

  const goNext = () => {
    if (!section) return;
    if (section.key === 'F') {
      const missing = missingRequiredIds(answers, [
        ...doorServices.map((s) => `${s.id}_need`),
        'F11',
        'F12',
        'F13',
      ]);
      if (missing.length) {
        setStatus('请为每一项上门服务选择需要程度');
        return;
      }
    } else {
      const required = section.questions.filter((q) => !q.text && !q.number).map((q) => q.id);
      const extraRequired = section.key === 'C' ? ['C10'] : [];
      const missing = missingRequiredIds(answers, [...required, ...extraRequired]);
      if (missing.length) {
        setStatus(`请完成本页：${missing.join('、')}`);
        return;
      }
    }
    setStatus('');
    setStep((s) => s + 1);
    const scroller = document.getElementById('need-survey-scroll');
    if (scroller) scroller.scrollTop = 0;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setStatus('正在提交…');
    const result = await submitNeedSurvey(answers, checkupId);
    setSubmitting(false);
    if (!result.ok) {
      setStatus(result.message);
      return;
    }
    setDone({ id: result.row.id.slice(0, 8), risk: result.row.risk_level });
    setStatus('');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('复制下方链接', shareUrl);
    }
  };

  const handleClose = () => {
    if (onClose) onClose();
    else closeNeedSurvey();
  };

  if (done) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-5 py-12 text-center">
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl">✓</div>
        <h2 className="text-2xl font-black text-slate-800">提交成功，感谢参与</h2>
        <p className="mt-3 text-sm text-slate-600">
          记录编号 {done.id} · 初步分层 <b>{done.risk}</b>
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">该结果只用于服务分层，不构成医疗诊断。</p>
        <button
          type="button"
          onClick={handleClose}
          className="mt-8 h-12 w-full max-w-sm rounded-xl bg-teal-600 font-bold text-white"
        >
          返回
        </button>
      </div>
    );
  }

  if (step < 0) {
    return (
      <div className="px-4 pb-10 pt-4">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-100 text-2xl">📋</div>
          <div>
            <h2 className="text-xl font-black text-slate-800">需求调查问卷</h2>
            <p className="mt-1 text-sm text-slate-500">约 12—15 分钟 · 不采集姓名和详细门牌号</p>
            {userName ? <p className="mt-1 text-xs text-teal-700">当前登录：{userName}</p> : null}
          </div>
        </div>
        <div className="rounded-2xl bg-teal-50 p-4 text-sm leading-7 text-slate-700">
          <b>调查说明</b>
          <br />
          本调查用于了解郑州大学教职工及家属的健康管理、就医、康复、照护和上门服务需求，为中心下一阶段服务设计、人员配置和运营测算提供依据。问卷不用于疾病诊断，所有结果仅作汇总分析。
        </div>
        {hasLocalNeedSurveySubmitted() ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">本机已提交过问卷。如需更正，可重新填写后再次提交。</p>
        ) : null}
        <div className="mt-5 space-y-3">
          <p className="text-sm font-bold text-slate-700">受访对象</p>
          <div className="grid grid-cols-2 gap-2">
            {RESPONDENT_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setField('respondent', opt)}
                className={`min-h-[44px] rounded-xl border px-3 py-2 text-sm font-medium ${
                  answers.respondent === opt ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <p className="pt-2 text-sm font-bold text-slate-700">联系方式</p>
          <p className="text-xs text-slate-500">如愿意回访，请另行告知健康管家；本页不强制采集电话。</p>
          <div className="grid grid-cols-1 gap-2">
            {CONTACT_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setField('contactPref', opt)}
                className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-sm font-medium ${
                  answers.contactPref === opt ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-teal-600"
            checked={answers.consent === '同意参加'}
            onChange={(e) => setField('consent', e.target.checked ? '同意参加' : '')}
          />
          <span className="text-sm leading-6 text-slate-700">我已阅读调查说明，自愿参加本调查。</span>
        </label>
        <button
          type="button"
          disabled={answers.consent !== '同意参加'}
          onClick={() => setStep(0)}
          className="mt-6 h-12 w-full rounded-xl bg-teal-600 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          进入问卷
        </button>
        <button type="button" onClick={copyLink} className="mt-3 w-full text-center text-xs font-bold text-teal-700">
          {copied ? '链接已复制' : '复制手机填写链接'}
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pb-28 pt-3">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wide text-teal-700">
            第 {step + 1} / {totalSteps} 部分
          </p>
          <h2 className="mt-0.5 text-lg font-black text-slate-800">
            {section?.key}. {section?.title}
          </h2>
        </div>
        <span className="text-sm font-bold text-teal-700">{progress}%</span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
      {section?.note ? (
        <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">{section.note}</div>
      ) : null}

      {section?.key === 'F' ? (
        <div className="space-y-4">
          {doorServices.map((svc, i) => (
            <div key={svc.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="font-bold text-slate-800">{svc.label}</h3>
              </div>
              <p className="mb-2 text-xs font-bold text-slate-500">需要程度</p>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {NEED_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setField(`${svc.id}_need`, opt)}
                    className={`min-h-[40px] rounded-lg border text-xs font-bold ${
                      answers[`${svc.id}_need`] === opt
                        ? 'border-teal-500 bg-teal-50 text-teal-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {answers[`${svc.id}_need`] && answers[`${svc.id}_need`] !== '不需要' ? (
                <div className="grid grid-cols-1 gap-3">
                  <MiniSelect
                    label="期望频次"
                    options={svc.freqOptions}
                    value={String(answers[`${svc.id}_freq`] || '')}
                    onChange={(v) => setField(`${svc.id}_freq`, v)}
                  />
                  <MiniSelect
                    label="优先时段"
                    options={svc.timeOptions}
                    value={String(answers[`${svc.id}_time`] || '')}
                    onChange={(v) => setField(`${svc.id}_time`, v)}
                  />
                </div>
              ) : null}
            </div>
          ))}
          {section.questions.map((q) => (
            <div key={q.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-teal-700">{q.id}</p>
              <h3 className="mb-3 mt-1 font-bold text-slate-800">{q.label}</h3>
              <Choice q={q} value={answers[q.id]} onChange={(v) => setField(q.id, v)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {section?.questions.map((q) => (
            <div key={q.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-teal-700">{q.id}</p>
              <h3 className="mb-1 mt-1 font-bold text-slate-800">{q.label}</h3>
              {q.hint ? <p className="mb-3 text-xs leading-5 text-slate-500">{q.hint}</p> : null}
              <Choice
                q={q}
                value={answers[q.id]}
                extra={String(answers[q.otherId || q.moreId || ''] || '')}
                onChange={(v) => setField(q.id, v)}
                onExtra={(v) => setField(q.otherId || q.moreId || '', v)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white/95 p-3 pb-[calc(env(safe-area-inset-bottom)+10px)] backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setStatus('');
              setStep((s) => s - 1);
            }}
            className="h-11 flex-1 rounded-xl border border-slate-200 font-bold text-slate-600"
          >
            上一步
          </button>
          <button type="button" onClick={saveDraft} className="h-11 rounded-xl px-3 text-xs font-bold text-slate-500">
            保存
          </button>
          {step < totalSteps - 1 ? (
            <button type="button" onClick={goNext} className="h-11 flex-[1.4] rounded-xl bg-teal-600 font-bold text-white">
              下一步
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="h-11 flex-[1.4] rounded-xl bg-teal-600 font-bold text-white disabled:opacity-60"
            >
              {submitting ? '提交中…' : '提交问卷'}
            </button>
          )}
        </div>
        {status ? <p className="mt-2 text-center text-xs font-bold text-teal-700">{status}</p> : null}
      </div>
    </div>
  );
};
