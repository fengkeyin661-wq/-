import React from 'react';
import type { ContentItem } from '../../services/contentService';
import { ResourceCover } from '../user/ResourceCover';
import { isResourceImageUrl } from '../user/ResourceCover';
import { resolveIncludedServiceTitles } from '../../services/userServiceCatalog';

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
  const includedTitles = resolveIncludedServiceTitles(packageItem, allServices);
  const posterSrc = packageItem.details?.posterImage as string | undefined;

  return (
    <div className="min-h-full bg-slate-50 pb-28">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-slate-500 hover:text-slate-800 font-bold text-sm"
        >
          ← 返回
        </button>
        <h2 className="font-bold text-slate-800 line-clamp-1 flex-1">{packageItem.title}</h2>
      </div>

      <div className="p-4 space-y-4">
        {posterSrc && isResourceImageUrl(posterSrc) && (
          <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-white">
            <img src={posterSrc} alt={`${packageItem.title} 海报`} className="w-full max-h-80 object-cover" />
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
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
                {packageItem.details?.price ? `¥${packageItem.details.price}` : '价格待定'}
              </div>
            </div>
          </div>

          {includedTitles.length > 0 && (
            <div className="bg-emerald-50 p-4 rounded-xl mb-4">
              <div className="text-xs text-emerald-600 mb-2 font-bold">套餐包含项目</div>
              <ul className="text-sm text-emerald-900 space-y-1 list-disc pl-4">
                {includedTitles.map((title) => (
                  <li key={title}>{title}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="font-bold text-slate-800 text-sm mb-2">套餐介绍</h4>
            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl whitespace-pre-line">
              {packageItem.description || '暂无详细介绍'}
            </p>
          </div>

          {packageItem.tags?.length ? (
            <div className="mt-4 flex flex-wrap gap-1">
              {packageItem.tags.map((t) => (
                <span key={t} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 max-w-md mx-auto">
        <button
          type="button"
          onClick={onBook}
          className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
        >
          📅 立即预约
        </button>
      </div>
    </div>
  );
};
