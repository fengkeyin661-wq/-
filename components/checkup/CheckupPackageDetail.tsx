import React from 'react';
import type { ContentItem } from '../../services/contentService';
import { ResourceCover } from '../user/ResourceCover';
import { isResourceImageUrl } from '../user/ResourceCover';
import { ModalPortal } from '../user/ModalPortal';
import {
  resolveIncludedServiceLines,
  resolveOptionalGroupLines,
  resolvePackageDisplayPricing,
} from '../../services/userServiceCatalog';

interface Props {
  packageItem: ContentItem;
  allServices: ContentItem[];
  onBack: () => void;
  onBook: () => void;
}

export const CheckupPackageDetail: React.FC<Props> = ({
  packageItem,
  allServices,
  onBack,
  onBook,
}) => {
  const includedLines = resolveIncludedServiceLines(packageItem, allServices);
  const optionalGroups = resolveOptionalGroupLines(packageItem, allServices);
  const posterSrc = packageItem.details?.posterImage as string | undefined;
  const { packagePrice, originalPrice, showOriginalPrice } = resolvePackageDisplayPricing(
    packageItem,
    allServices,
  );

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkup-package-detail-title"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/45"
          aria-label="关闭套餐详情"
          onClick={onBack}
        />

        <div className="relative w-full max-w-md mx-auto max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden animate-[slideUp_0.28s_ease-out]">
          {/* 拖拽指示条 */}
          <div className="shrink-0 pt-3 pb-1 flex justify-center">
            <div className="w-10 h-1 rounded-full bg-slate-200" aria-hidden />
          </div>

          <div className="shrink-0 px-4 pb-3 flex items-center gap-3 border-b border-slate-100">
            <h2
              id="checkup-package-detail-title"
              className="font-bold text-slate-800 line-clamp-1 flex-1 text-base"
            >
              {packageItem.title}
            </h2>
            <button
              type="button"
              onClick={onBack}
              className="shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold text-sm"
              aria-label="关闭"
            >
              ×
            </button>
          </div>

          {/* 可上拉滚动内容区 */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4 [-webkit-overflow-scrolling:touch]">
            {posterSrc && isResourceImageUrl(posterSrc) && (
              <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-white">
                <img
                  src={posterSrc}
                  alt={`${packageItem.title} 海报`}
                  className="w-full max-h-72 object-cover"
                />
              </div>
            )}

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="flex gap-4 mb-4">
                <ResourceCover
                  item={packageItem}
                  fallback={<span className="text-3xl">🩺</span>}
                  className="h-20 w-20 shrink-0 rounded-xl bg-emerald-50 text-3xl"
                  imgClassName="h-full w-full object-cover rounded-xl"
                />
                <div>
                  <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded mb-2">
                    体检套餐
                  </span>
                  <div className="text-2xl font-black text-emerald-700">
                    {packagePrice ? `¥${packagePrice}` : '价格待定'}
                  </div>
                  {showOriginalPrice && (
                    <div className="text-xs text-slate-400 line-through">原价 ¥{originalPrice}</div>
                  )}
                </div>
              </div>

              {includedLines.length > 0 && (
                <div className="bg-emerald-50 p-4 rounded-xl mb-4">
                  <div className="text-xs text-emerald-600 mb-2 font-bold">固定包含项目</div>
                  <ul className="text-sm text-emerald-900 space-y-1.5 list-disc pl-4">
                    {includedLines.map((line) => (
                      <li key={line.title}>
                        {line.title}
                        {line.quantity > 1 ? ` ×${line.quantity}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {optionalGroups.map(({ group, label, titles }) => (
                <div key={group.id} className="bg-indigo-50 p-4 rounded-xl mb-4">
                  <div className="text-xs text-indigo-700 mb-1 font-bold">{label}</div>
                  {group.note ? (
                    <p className="text-[11px] text-indigo-600/90 mb-2">{group.note}</p>
                  ) : (
                    <p className="text-[11px] text-indigo-600/90 mb-2">
                      到检时可在以下候选项目中任选 {Math.min(group.pickCount, titles.length || group.pickCount)} 项
                    </p>
                  )}
                  {titles.length > 0 ? (
                    <ul className="text-sm text-indigo-950 space-y-1.5 list-disc pl-4">
                      {titles.map((title) => (
                        <li key={title}>{title}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-indigo-400">候选项目待配置</p>
                  )}
                </div>
              ))}

              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-2">套餐介绍</h4>
                <p className="text-sm text-slate-600 leading-relaxed bg-white p-4 rounded-xl whitespace-pre-line border border-slate-100">
                  {packageItem.description || '暂无详细介绍'}
                </p>
              </div>

              {packageItem.tags?.length ? (
                <div className="mt-4 flex flex-wrap gap-1">
                  {packageItem.tags.map((t) => (
                    <span key={t} className="bg-white border border-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 mb-2">
              <div className="text-xs font-black text-amber-900 mb-1">预约提醒</div>
              <p className="text-[12px] leading-relaxed text-amber-800/90">
                请携带身份证；体检当天须禁食禁水 8 小时。完整须知与检后服务请在首页点击「体检须知」查看。咨询：0371-67739261 / 67739538。
              </p>
            </div>
          </div>

          <div className="shrink-0 p-4 border-t border-slate-100 bg-white safe-area-pb">
            <button
              type="button"
              onClick={onBook}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-base shadow-lg active:scale-[0.98] transition-transform"
            >
              立即预约
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0.6; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </ModalPortal>
  );
};
