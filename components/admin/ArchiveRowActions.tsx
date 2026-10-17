import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
interface Props {
  onOpenAssessment: () => void;
  onFollowUp: () => void;
  onChronicDiabetes: () => void;
  onChronicHypertension: () => void;
  onChronicLipid: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const ArchiveRowActions: React.FC<Props> = ({
  onOpenAssessment,
  onFollowUp,
  onChronicDiabetes,
  onChronicHypertension,
  onChronicLipid,
  onEdit,
  onDelete,
}) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = 176;
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - menuWidth),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const run = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    fn();
  };

  const itemClass =
    'w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="更多操作"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-lg leading-none"
      >
        ⋯
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden />
            <div
              className="fixed z-[61] min-w-[11rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              style={{ top: menuPos.top, left: menuPos.left }}
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" className={itemClass} onClick={run(onOpenAssessment)}>
                打开档案（评估）
              </button>
              <button type="button" className={itemClass} onClick={run(onFollowUp)}>
                随访监测
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button type="button" className={itemClass} onClick={run(onChronicDiabetes)}>
                慢性病 · 糖尿病
              </button>
              <button type="button" className={itemClass} onClick={run(onChronicHypertension)}>
                慢性病 · 高血压
              </button>
              <button type="button" className={itemClass} onClick={run(onChronicLipid)}>
                慢性病 · 血脂
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button type="button" className={itemClass} onClick={run(onEdit)}>
                编辑档案
              </button>
              <button
                type="button"
                className={`${itemClass} text-red-600 hover:bg-red-50`}
                onClick={run(onDelete)}
              >
                删除
              </button>
            </div>
          </>,
          document.body,
        )}
    </>
  );
};
