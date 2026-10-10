import React from 'react';
import type { HealthAssessment } from '../../types';

interface Props {
  assessment?: HealthAssessment | null;
  /** 是否在 Hero 内展示评估摘要 */
  showSummary?: boolean;
  className?: string;
}

export const UserRiskHeroBanner: React.FC<Props> = ({ assessment, showSummary = true, className = '' }) => {
  const risk = assessment?.riskLevel || 'GREEN';
  const gradient =
    risk === 'RED'
      ? 'bg-gradient-to-r from-red-500 to-rose-600'
      : risk === 'YELLOW'
        ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
        : 'bg-gradient-to-r from-teal-500 to-emerald-600';
  const label = risk === 'RED' ? '高风险' : risk === 'YELLOW' ? '中风险' : '低风险';
  const emoji = risk === 'RED' ? '🚨' : risk === 'YELLOW' ? '⚠️' : '🛡️';

  return (
    <div className={`rounded-2xl p-5 text-white shadow-lg ${gradient} ${className}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-xs font-bold uppercase tracking-wider opacity-80">综合风险评估</div>
          <div className="mb-2 text-3xl font-black">{label}</div>
          {assessment?.isCritical ? (
            <div className="mb-2 inline-block rounded bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
              ⚠️ 存在危急/重大异常
            </div>
          ) : null}
          {showSummary && assessment?.summary ? (
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed opacity-90">{assessment.summary}</p>
          ) : null}
        </div>
        <div className="ml-3 shrink-0 text-4xl opacity-30">{emoji}</div>
      </div>
    </div>
  );
};
