import React, { useState } from 'react';
import type { HealthAssessment } from '../../types';

interface Props {
  assessment?: HealthAssessment | null;
  /** 是否在 Hero 内展示评估摘要 */
  showSummary?: boolean;
  /** 点击卡片展开/收起完整摘要（仅首页） */
  summaryExpandable?: boolean;
  className?: string;
}

export const UserRiskHeroBanner: React.FC<Props> = ({
  assessment,
  showSummary = true,
  summaryExpandable = false,
  className = '',
}) => {
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const risk = assessment?.riskLevel || 'GREEN';
  const gradient =
    risk === 'RED'
      ? 'bg-gradient-to-r from-red-500 to-rose-600'
      : risk === 'YELLOW'
        ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
        : 'bg-gradient-to-r from-teal-500 to-emerald-600';
  const label = risk === 'RED' ? '高风险' : risk === 'YELLOW' ? '中风险' : '低风险';
  const emoji = risk === 'RED' ? '🚨' : risk === 'YELLOW' ? '⚠️' : '🛡️';
  const summary = assessment?.summary?.trim();
  const showSummaryBlock = showSummary && Boolean(summary);
  const canToggleSummary = summaryExpandable && showSummaryBlock;

  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1 text-left">
          <div className="mb-1 text-xs font-bold uppercase tracking-wider opacity-80">综合风险评估</div>
          <div className="mb-2 text-3xl font-black">{label}</div>
          {assessment?.isCritical ? (
            <div className="mb-2 inline-block rounded bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
              ⚠️ 存在危急/重大异常
            </div>
          ) : null}
          {showSummaryBlock ? (
            <>
              <p
                className={`mt-1 text-xs leading-relaxed opacity-90 ${
                  canToggleSummary && !summaryExpanded ? 'line-clamp-3' : ''
                }`}
              >
                {summary}
              </p>
              {canToggleSummary ? (
                <p className="mt-2 text-[11px] font-bold opacity-75">
                  {summaryExpanded ? '点击收起' : '点击查看全部'}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="ml-3 shrink-0 text-4xl opacity-30">{emoji}</div>
      </div>
    </>
  );

  const shellClass = `rounded-2xl p-5 text-white shadow-lg ${gradient} ${className}`;

  if (canToggleSummary) {
    return (
      <button
        type="button"
        aria-expanded={summaryExpanded}
        onClick={() => setSummaryExpanded((v) => !v)}
        className={`${shellClass} w-full text-left transition-opacity active:opacity-95`}
      >
        {inner}
      </button>
    );
  }

  return <div className={shellClass}>{inner}</div>;
};
