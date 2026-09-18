import React from 'react';
import { ModalPortal } from '../user/ModalPortal';

type Props = {
  open: boolean;
  packageTitle?: string;
  timeSlot?: string;
  onClose: () => void;
};

export const CheckupBookingSuccessModal: React.FC<Props> = ({
  open,
  packageTitle,
  timeSlot,
  onClose,
}) => {
  if (!open) return null;
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 px-5 backdrop-blur-sm" onClick={onClose}>
        <div
          className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
            ✓
          </div>
          <h3 className="text-xl font-black text-slate-800">体检已预约成功</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">欢迎按时参加体检。</p>
          {packageTitle ? (
            <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">{packageTitle}</p>
          ) : null}
          {timeSlot ? <p className="mt-2 text-xs text-slate-500">预约时段：{timeSlot}</p> : null}
          <button
            type="button"
            onClick={onClose}
            className="mt-6 h-12 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white"
          >
            我知道了
          </button>
        </div>
      </div>
    </ModalPortal>
  );
};
