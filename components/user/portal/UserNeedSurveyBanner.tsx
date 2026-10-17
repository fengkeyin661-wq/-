import React from 'react';

interface Props {
  onClick: () => void;
  className?: string;
}

/** 配置开启需求调查时的紧凑入口 */
export const UserNeedSurveyBanner: React.FC<Props> = ({ onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-left active:scale-[0.99] ${className}`}
  >
    <div className="min-w-0">
      <p className="text-xs font-bold text-teal-800">教职工健康需求调查</p>
      <p className="mt-0.5 text-[11px] text-slate-600">约 12—15 分钟 · 手机填写</p>
    </div>
    <span className="shrink-0 text-sm font-bold text-teal-700">填写 →</span>
  </button>
);
