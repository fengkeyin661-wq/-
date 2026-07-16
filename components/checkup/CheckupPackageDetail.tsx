import React, { useState } from 'react';
import type { ContentItem } from '../../services/contentService';
import { ResourceCover } from '../user/ResourceCover';
import { isResourceImageUrl } from '../user/ResourceCover';
import { ModalPortal } from '../user/ModalPortal';
import {
  resolveOptionalGroupLines,
  resolvePackageDisplayPricing,
  getPackageKind,
  resolveIncludedServiceGroups,
  resolveGiftItemGroups,
} from '../../services/userServiceCatalog';
import { CHECKUP_CONTACT_PHONES } from './checkupNoticeContent';
import { PackageItemGroupedList } from './PackageItemGroupedList';
import { CheckupPosterPreview } from './CheckupPosterPreview';

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
  const includedGroups = resolveIncludedServiceGroups(packageItem, allServices);
  const optionalGroups = resolveOptionalGroupLines(packageItem, allServices);
  const giftGroups = resolveGiftItemGroups(packageItem, allServices);
  const posterSrc = packageItem.details?.posterImage as string | undefined;
  const { packagePrice, originalPrice, showOriginalPrice } = resolvePackageDisplayPricing(
    packageItem,
    allServices,
  );
  const isGroup = getPackageKind(packageItem) === 'group';
  const primaryTel = `tel:${CHECKUP_CONTACT_PHONES[0].replace(/-/g, '')}`;
  const [posterPreviewOpen, setPosterPreviewOpen] = useState(false);

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
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="flex gap-4 mb-4">
                <ResourceCover
                  item={packageItem}
                  fallback={<span className="text-3xl">🩺</span>}
                  className="h-20 w-20 shrink-0 rounded-xl bg-emerald-50 text-3xl"
                  imgClassName="h-full w-full object-cover rounded-xl"
                />
                <div>
                  <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded mb-2 ${
                    isGroup ? 'bg-teal-100 text-teal-800' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {isGroup ? '团体体检' : '个人体检'}
                  </span>
                  {isGroup ? (
                    <div className="text-xl font-black text-teal-700">面议 / 电话咨询</div>
                  ) : (
                    <>
                      <div className="text-2xl font-black text-emerald-700">
                        {packagePrice ? `¥${packagePrice}` : '价格待定'}
                      </div>
                      {showOriginalPrice && (
                        <div className="text-xs text-slate-400 line-through">原价 ¥{originalPrice}</div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {includedGroups.length > 0 && (
                <PackageItemGroupedList title="固定包含项目" groups={includedGroups} tone="emerald" />
              )}

              {optionalGroups.map(({ group, label, categoryGroups }) => (
                <PackageItemGroupedList
                  key={group.id}
                  title={label}
                  groups={categoryGroups}
                  tone="indigo"
                  note={
                    group.note ||
                    `到检时可在以下候选项目中任选 ${Math.min(group.pickCount, categoryGroups.reduce((n, g) => n + g.items.length, 0) || group.pickCount)} 项`
                  }
                />
              ))}

              {giftGroups.length > 0 && (
                <PackageItemGroupedList title="赠送项目" groups={giftGroups} tone="rose" />
              )}

              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-2">套餐介绍</h4>
                <p className="text-sm text-slate-600 leading-relaxed bg-white p-4 rounded-xl whitespace-pre-line border border-slate-100">
                  {packageItem.description || '暂无详细介绍'}
                </p>
              </div>

              {posterSrc && isResourceImageUrl(posterSrc) && (
                <button
                  type="button"
                  onClick={() => setPosterPreviewOpen(true)}
                  className="mt-4 w-full rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-white text-left active:scale-[0.99] transition-transform relative group"
                  aria-label={`查看${packageItem.title}详情海报大图`}
                >
                  <img
                    src={posterSrc}
                    alt={`${packageItem.title} 海报`}
                    className="w-full max-h-72 object-cover"
                  />
                  <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/55 text-white text-xs font-bold backdrop-blur-sm">
                    点击查看大图
                  </span>
                </button>
              )}

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
            {isGroup ? (
              <a
                href={primaryTel}
                className="block w-full py-3.5 rounded-2xl bg-teal-600 text-white font-bold text-base text-center shadow-lg active:scale-[0.98] transition-transform"
              >
                电话咨询预约
              </a>
            ) : (
              <button
                type="button"
                onClick={onBook}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-base shadow-lg active:scale-[0.98] transition-transform"
              >
                立即预约
              </button>
            )}
          </div>
        </div>
      </div>

      {posterSrc && isResourceImageUrl(posterSrc) && (
        <CheckupPosterPreview
          src={posterSrc}
          alt={`${packageItem.title} 详情海报`}
          open={posterPreviewOpen}
          onClose={() => setPosterPreviewOpen(false)}
        />
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0.6; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </ModalPortal>
  );
};
