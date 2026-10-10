import React from 'react';
import {
  HEALTH_MANAGEMENT_HOTLINE,
  HEALTH_MANAGEMENT_HOTLINE_TEL,
} from '../../../services/userServiceCatalog';

interface Props {
  className?: string;
}

export const UserHotlineCompact: React.FC<Props> = ({ className = '' }) => (
  <div
    className={`flex items-center justify-between gap-2 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 ${className}`}
  >
    <div className="min-w-0">
      <div className="text-[10px] font-bold text-teal-800">健康管理服务电话</div>
      <a href={HEALTH_MANAGEMENT_HOTLINE_TEL} className="text-sm font-black text-teal-900">
        {HEALTH_MANAGEMENT_HOTLINE}
      </a>
    </div>
    <a
      href={HEALTH_MANAGEMENT_HOTLINE_TEL}
      className="shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white"
    >
      拨打
    </a>
  </div>
);
