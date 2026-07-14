import React from 'react';
import type { ContentItem, InteractionItem } from '../../services/contentService';
import { ResourceCover } from '../user/ResourceCover';
import {
  SLOT_MAP,
  getNextMonthSlotsForService,
  getServiceSlotQuota,
} from '../../services/doctorScheduleUtils';
import { resolvePackageDisplayPricing, summarizePackageComposition } from '../../services/userServiceCatalog';

interface Props {
  packages: ContentItem[];
  allServices?: ContentItem[];
  interactions: InteractionItem[];
  onSelect: (item: ContentItem) => void;
}

function getEarliestSlotLabel(item: ContentItem, interactions: InteractionItem[]): string {
  const slots = getNextMonthSlotsForService(item);
  for (const slot of slots) {
    const fragment = `${slot.displayDate}${SLOT_MAP[slot.slotId]}`;
    const count = interactions.filter(
      (i) =>
        i.type === 'service_booking' &&
        i.targetId === item.id &&
        i.status !== 'cancelled' &&
        i.details?.includes(fragment),
    ).length;
    const quota = getServiceSlotQuota(item.details, slot.dayKey, slot.slotId);
    if (count < quota) {
      const mmdd = slot.displayDate.split(' ')[0];
      return `最早可约：${mmdd} ${SLOT_MAP[slot.slotId]}`;
    }
  }
  return '当前无可预约时段';
}

export const CheckupPackageList: React.FC<Props> = ({ packages, allServices = [], interactions, onSelect }) => {
  if (packages.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <div className="text-5xl mb-4 opacity-30">🩺</div>
        <p className="text-slate-500 font-medium">暂无上架体检套餐</p>
        <p className="text-xs text-slate-400 mt-2">请稍后再来或致电健康管理热线咨询</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {packages.map((pkg) => (
        <button
          key={pkg.id}
          type="button"
          onClick={() => onSelect(pkg)}
          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-4 text-left active:scale-[0.98] transition-transform hover:border-emerald-200"
        >
          <ResourceCover
            item={pkg}
            fallback={<span className="text-2xl">🩺</span>}
            className="h-16 w-16 shrink-0 rounded-xl bg-emerald-50 text-2xl"
            imgClassName="h-full w-full object-cover rounded-xl"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 line-clamp-1 mb-1">{pkg.title}</h3>
            <p className="text-xs text-slate-500 line-clamp-2 mb-2">{pkg.description || '暂无简介'}</p>
            <div className="flex justify-between items-center">
              {(() => {
                const { packagePrice, originalPrice, showOriginalPrice } = resolvePackageDisplayPricing(pkg, allServices);
                return (
                  <div>
                    <span className="text-base font-bold text-emerald-600">
                      {packagePrice ? `¥${packagePrice}` : '价格待定'}
                    </span>
                    {showOriginalPrice && (
                      <span className="ml-2 text-xs text-slate-400 line-through">¥{originalPrice}</span>
                    )}
                  </div>
                );
              })()}
              {summarizePackageComposition(pkg) !== '未配置项目' ? (
                <span className="text-xs text-slate-400">
                  {summarizePackageComposition(pkg)}
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-[11px] font-semibold text-emerald-600 line-clamp-1">
              {getEarliestSlotLabel(pkg, interactions)}
            </div>
            {pkg.tags?.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {pkg.tags.slice(0, 3).map((t) => (
                  <span key={t} className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px]">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  );
};
