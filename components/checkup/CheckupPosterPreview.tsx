import React from 'react';
import { ModalPortal } from '../user/ModalPortal';

interface Props {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}

/** 体检套餐详情海报全屏预览 */
export const CheckupPosterPreview: React.FC<Props> = ({ src, alt, open, onClose }) => {
  if (!open) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[95] flex flex-col bg-black/90"
        role="dialog"
        aria-modal="true"
        aria-label="海报大图预览"
      >
        <button
          type="button"
          className="absolute inset-0"
          aria-label="关闭预览"
          onClick={onClose}
        />

        <div className="relative z-10 shrink-0 flex items-center justify-between px-4 py-3 safe-area-pt">
          <span className="text-sm font-bold text-white/90 truncate pr-4">{alt}</span>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-full bg-white/15 text-white font-bold text-lg hover:bg-white/25"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div
          className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-6 [-webkit-overflow-scrolling:touch]"
          onClick={onClose}
        >
          <img
            src={src}
            alt={alt}
            className="mx-auto w-full max-w-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </ModalPortal>
  );
};
