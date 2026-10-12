import React from 'react';
import { ModalPortal } from '../user/ModalPortal';

type Props = {
  open: boolean;
  packageTitle?: string;
  timeSlot?: string;
  status?: 'confirmed' | 'pending';
  manageToken?: string;
  bookingId?: string;
  onClose: () => void;
};

export const CheckupBookingSuccessModal: React.FC<Props> = ({
  open,
  packageTitle,
  timeSlot,
  status = 'confirmed',
  manageToken,
  bookingId,
  onClose,
}) => {
  if (!open) return null;
  const confirmed = status === 'confirmed';
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 px-5 backdrop-blur-sm" onClick={onClose}>
        <div
          className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full text-3xl ${
              confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {confirmed ? '✓' : '…'}
          </div>
          <h3 className="text-xl font-black text-slate-800">
            {confirmed ? '体检已预约成功' : '申请已提交'}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {confirmed
              ? '欢迎按时参加体检。如需改期或取消，请保存下方凭证，在「预约查询/变更」中办理。'
              : '工作人员将尽快与您联系确认时段。'}
          </p>
          {packageTitle ? (
            <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">{packageTitle}</p>
          ) : null}
          {timeSlot ? <p className="mt-2 text-xs text-slate-500">预约时段：{timeSlot}</p> : null}
          {manageToken ? (
            <div className="mt-4 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/80 px-3 py-3 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">自助凭证（请截图保存）</p>
              <p className="mt-1 font-mono text-lg font-black tracking-widest text-emerald-900">{manageToken}</p>
              {bookingId ? <p className="mt-1 text-[10px] text-slate-500 break-all">单号 {bookingId}</p> : null}
            </div>
          ) : null}
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
