import React from 'react';
import type { HealthRecord } from '../types';
import {
  detectHighBloodPressureTag,
  highBloodPressureTagClassName,
} from '../services/bloodPressureTagService';

interface Props {
  record: HealthRecord;
  onClick?: () => void;
  className?: string;
}

export const HighBloodPressureTag: React.FC<Props> = ({ record, onClick, className = '' }) => {
  const tag = detectHighBloodPressureTag(record);
  if (!tag.show) return null;

  const title = [tag.summary, ...tag.reasons.slice(1), onClick ? '点击进入高血压专项筛查' : '']
    .filter(Boolean)
    .join('\n');

  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold transition-colors ${highBloodPressureTagClassName(tag.severity)} ${className}`}
    >
      <span>🫀</span>
      <span>{tag.label}</span>
      {onClick && <span className="opacity-70">→</span>}
    </button>
  );
};
