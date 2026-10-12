import React, { useMemo, useState } from 'react';
import type { ContentItem, InteractionItem } from '../../services/contentService';
import { parseBookingDetails } from '../../services/bookingContact';
import {
  cancelGuestBooking,
  findGuestBooking,
  loadAllInteractions,
  readCurrentSlotFragment,
  rescheduleGuestBooking,
} from '../../services/bookingGuestManage';
import { fetchCheckupGlobalClosedDates } from '../../services/checkupGlobalClosedDatesService';
import { ModalPortal } from '../user/ModalPortal';
import { CheckupSlotPicker } from './CheckupSlotPicker';

type Props = {
  open: boolean;
  /** 体检套餐 + 其它可预约资源（服务/医生），用于改期时加载排班 */
  bookableCatalog: ContentItem[];
  interactions: InteractionItem[];
  onClose: () => void;
  onUpdated: () => void;
};

export const CheckupBookingManageModal: React.FC<Props> = ({
  open,
  bookableCatalog,
  interactions,
  onClose,
  onUpdated,
}) => {
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [booking, setBooking] = useState<InteractionItem | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const targetContent = useMemo(
    () => (booking ? bookableCatalog.find((p) => p.id === booking.targetId) : undefined),
    [booking, bookableCatalog],
  );

  if (!open) return null;

  const reset = () => {
    setPhone('');
    setToken('');
    setMessage('');
    setBooking(null);
    setRescheduleOpen(false);
  };

  const handleLookup = () => {
    setMessage('');
    const found = findGuestBooking(interactions, phone, token);
    if (!found) {
      setBooking(null);
      setMessage('未找到预约，请核对预约手机号与凭证码（预约成功弹窗内）。');
      return;
    }
    if (!bookableCatalog.some((p) => p.id === found.targetId)) {
      setMessage('未加载到该预约项目，请刷新后重试或致电健康管理热线协助改期。');
    }
    setBooking(found);
  };

  const handleCancel = async () => {
    if (!booking || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await cancelGuestBooking(booking, phone, token);
      setMessage(res.message);
      if (res.ok) {
        onUpdated();
        setBooking(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRescheduleSlot = async (timeSlot: string) => {
    if (!booking || !targetContent || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const closed = await fetchCheckupGlobalClosedDates();
      const all = await loadAllInteractions();
      const res = await rescheduleGuestBooking({
        booking,
        phone,
        manageToken: token,
        newSlotFragment: timeSlot,
        target: targetContent,
        interactions: all,
        globalClosedDates: closed.closedDates,
      });
      setMessage(res.message);
      if (res.ok) {
        setRescheduleOpen(false);
        onUpdated();
        const refreshed = findGuestBooking(all, phone, token);
        setBooking(refreshed);
      }
    } finally {
      setBusy(false);
    }
  };

  const slotLabel = booking ? readCurrentSlotFragment(booking) : null;
  const contact = booking ? parseBookingDetails(booking.details) : null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[115] flex items-end justify-center bg-slate-900/50 sm:items-center"
        onClick={() => {
          reset();
          onClose();
        }}
      >
        <div
          className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-black text-slate-800">预约查询 / 改期 / 取消</h3>
          <p className="mt-1 text-xs text-slate-500">无需登录，凭预约手机号 + 凭证码办理（凭证在预约成功页）。</p>

          {!booking ? (
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-slate-600">
                预约手机号
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="11 位手机号"
                  inputMode="tel"
                />
              </label>
              <label className="block text-xs font-bold text-slate-600">
                凭证码
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-mono tracking-widest uppercase"
                  value={token}
                  onChange={(e) => setToken(e.target.value.toUpperCase())}
                  placeholder="8 位字母数字"
                />
              </label>
              <button
                type="button"
                onClick={handleLookup}
                className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white"
              >
                查询预约
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-slate-50 p-4 text-sm">
                <p className="font-bold text-slate-800">{booking.targetName}</p>
                <p className="mt-1 text-slate-600">登记：{contact?.contactName}</p>
                {slotLabel ? <p className="mt-1 text-slate-600">时段：{slotLabel}</p> : null}
                <p className="mt-2 text-xs font-bold text-emerald-700">
                  状态：{booking.status === 'confirmed' ? '已确认' : booking.status === 'pending' ? '待确认' : booking.status}
                </p>
              </div>
              {targetContent ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy || booking.type === 'doctor_booking'}
                    onClick={() => setRescheduleOpen(true)}
                    className="h-11 flex-1 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-bold text-emerald-800 disabled:opacity-40"
                  >
                    改期
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleCancel()}
                    className="h-11 flex-1 rounded-xl border border-red-200 bg-red-50 text-sm font-bold text-red-700"
                  >
                    取消预约
                  </button>
                </div>
              ) : null}
              {booking.type === 'doctor_booking' ? (
                <p className="text-[11px] text-slate-500">医生挂号改期：请登录后在「我的 → 申请记录」撤销后重约，或致电热线。</p>
              ) : null}
              <button
                type="button"
                className="text-xs text-slate-500 underline"
                onClick={() => setBooking(null)}
              >
                重新查询
              </button>
            </div>
          )}

          {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}

          <button
            type="button"
            className="mt-6 h-11 w-full rounded-xl bg-slate-100 text-sm font-bold text-slate-600"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            关闭
          </button>
        </div>
      </div>

      {rescheduleOpen && targetContent && booking?.type === 'service_booking' ? (
        <CheckupSlotPicker
          packageItem={targetContent}
          interactions={interactions}
          onSelectSlot={(ts) => void handleRescheduleSlot(ts)}
          onClose={() => setRescheduleOpen(false)}
        />
      ) : null}
    </ModalPortal>
  );
};
