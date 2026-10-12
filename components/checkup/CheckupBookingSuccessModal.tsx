import React from 'react';
import { ModalPortal } from '../user/ModalPortal';

export type CheckupBookingSuccessAction = 'book' | 'cancel' | 'reschedule';

type Props = {
  open: boolean;
  action?: CheckupBookingSuccessAction;
  packageTitle?: string;
  timeSlot?: string;
  status?: 'confirmed' | 'pending';
  /** 叠在查询/改期弹窗之上 */
  stackAboveManage?: boolean;
  onClose: () => void;
};

export const CheckupBookingSuccessModal: React.FC<Props> = ({
  open,
  action = 'book',
  packageTitle,
  timeSlot,
  status = 'confirmed',
  stackAboveManage = false,
  onClose,
}) => {
  if (!open) return null;

  const isCancel = action === 'cancel';
  const isReschedule = action === 'reschedule';
  const confirmed = action === 'book' ? status === 'confirmed' : true;

  const title = isCancel
    ? '预约已取消'
    : isReschedule
      ? '改期成功'
      : confirmed
        ? '体检已预约成功'
        : '申请已提交';

  const description = isCancel
    ? '您的预约已取消，名额已释放。如需再次预约，请重新选择套餐与时段。'
    : isReschedule
      ? '新时段已确认，请按更新后的时间到检。'
      : confirmed
        ? '欢迎按时参加体检。如需改期或取消，在页面底部输入预约手机号即可办理。'
        : '工作人员将尽快与您联系确认时段。';

  const iconBg = isCancel
    ? 'bg-slate-100 text-slate-600'
    : confirmed
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-amber-100 text-amber-700';

  const btnClass = isCancel
    ? 'bg-slate-700 hover:bg-slate-800'
    : 'bg-emerald-600 hover:bg-emerald-700';

  const overlayZ = stackAboveManage ? 'z-[135]' : 'z-[120]';

  return (
    <ModalPortal>
      <div
        className={`fixed inset-0 ${overlayZ} flex items-center justify-center bg-slate-900/60 px-5 backdrop-blur-sm`}
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full text-3xl ${iconBg}`}>
            {isCancel ? '✕' : '✓'}
          </div>
          <h3 className="text-xl font-black text-slate-800">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
          {packageTitle ? (
            <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">{packageTitle}</p>
          ) : null}
          {timeSlot ? (
            <p className="mt-2 text-xs text-slate-500">
              {isReschedule ? '新预约时段：' : '预约时段：'}
              {timeSlot}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className={`mt-6 h-12 w-full rounded-xl text-sm font-bold text-white ${btnClass}`}
          >
            我知道了
          </button>
        </div>
      </div>
    </ModalPortal>
  );
};
