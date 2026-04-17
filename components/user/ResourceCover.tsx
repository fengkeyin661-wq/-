import React from 'react';
import type { ContentItem } from '../../services/contentService';

/** 资源维护台上传的 http(s) 或 data URL 封面图 */
export function isResourceImageUrl(s?: string): boolean {
  if (!s?.trim()) return false;
  const v = s.trim();
  return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:image');
}

export function resourceImageSrc(item: ContentItem): string {
  const src = item.image || '';
  if (!src || src.startsWith('data:image')) return src;
  const ver = encodeURIComponent(item.updatedAt || '');
  if (!ver) return src;
  return src.includes('?') ? `${src}&v=${ver}` : `${src}?v=${ver}`;
}

interface ResourceCoverProps {
  item: ContentItem;
  /** 无图或非 URL（走智能 emoji）时展示 */
  fallback: React.ReactNode;
  /** 外层：尺寸、圆角、背景；emoji/回退时用于 flex 居中 */
  className?: string;
  imgClassName?: string;
}

/**
 * 优先展示维护台配置的封面图（URL / base64），否则展示 emoji 文本，最后用 fallback。
 */
export const ResourceCover: React.FC<ResourceCoverProps> = ({ item, fallback, className = '', imgClassName }) => {
  const raw = item.image?.trim();
  if (raw && isResourceImageUrl(raw)) {
    return (
      <div className={`overflow-hidden ${className}`}>
        <img
          src={resourceImageSrc(item)}
          alt={item.title}
          className={imgClassName ?? 'h-full w-full object-cover'}
        />
      </div>
    );
  }
  if (raw) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <span className="select-none leading-none">{raw}</span>
      </div>
    );
  }
  return <div className={`flex items-center justify-center ${className}`}>{fallback}</div>;
};
