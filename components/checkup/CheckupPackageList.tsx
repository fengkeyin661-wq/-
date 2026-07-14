import React from 'react';
import type { ContentItem } from '../../services/contentService';
import { ResourceCover } from '../user/ResourceCover';
import { resolvePackageDisplayPricing } from '../../services/userServiceCatalog';

interface Props {
  packages: ContentItem[];
  allServices?: ContentItem[];
  onSelect: (item: ContentItem) => void;
  onBook: (item: ContentItem) => void;
}

export const CheckupPackageList: React.FC<Props> = ({
  packages,
  allServices = [],
  onSelect,
  onBook,
}) => {
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
    <div className="px-4 py-4 space-y-3">
      {packages.map((pkg) => {
        const { packagePrice, originalPrice, showOriginalPrice } = resolvePackageDisplayPricing(
          pkg,
          allServices,
        );
        return (
          <div
            key={pkg.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(pkg)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(pkg);
              }
            }}
            className="w-full bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex gap-3 text-left active:scale-[0.99] transition-transform hover:border-emerald-200 cursor-pointer"
          >
            <ResourceCover
              item={pkg}
              fallback={<span className="text-4xl">🩺</span>}
              className="h-28 w-28 shrink-0 rounded-2xl bg-emerald-50 text-4xl"
              imgClassName="h-full w-full object-cover rounded-2xl"
            />
            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
              <h3 className="font-bold text-slate-800 text-base line-clamp-2 leading-snug">
                {pkg.title}
              </h3>
              <div className="flex items-end justify-between gap-2 mt-2">
                <div className="min-w-0">
                  <span className="text-lg font-black text-emerald-600">
                    {packagePrice ? `¥${packagePrice}` : '价格待定'}
                  </span>
                  {showOriginalPrice && originalPrice > 0 && (
                    <span className="ml-1.5 text-xs text-slate-400 line-through">
                      ¥{originalPrice}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBook(pkg);
                  }}
                  className="shrink-0 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 active:scale-95 transition-transform"
                >
                  预约
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
