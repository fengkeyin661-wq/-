import React, { useMemo, useState } from 'react';
import type { ContentItem, InteractionItem } from '../../services/contentService';
import { parseBookingDetails, validateChinaMobile } from '../../services/bookingContact';
import {
  cancelGuestBooking,
  findBookingsByPhone,
  loadAllInteractions,
  readCurrentSlotFragment,
  rescheduleGuestBooking,
} from '../../services/bookingGuestManage';
import { fetchCheckupGlobalClosedDates } from '../../services/checkupGlobalClosedDatesService';
import { ModalPortal } from '../user/ModalPortal';
import { CheckupSlotPicker } from './CheckupSlotPicker';
import { CheckupBookingSuccessModal } from './CheckupBookingSuccessModal';

type Props = {
  open: boolean;
  bookableCatalog: ContentItem[];
  interactions: InteractionItem[];
  onClose: () => void;
  onUpdated: () => void;
};

const statusLabel = (s: InteractionItem['status']) => {
  if (s === 'confirmed') return '已确认';
  if (s === 'pending') return '待确认';
  return s;
};

export const CheckupBookingManageModal: React.FC<Props> = ({
  open,
  bookableCatalog,
  interactions,
  onClose,
  onUpdated,
}) => {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<InteractionItem[]>([]);
  const [booking, setBooking] = useState<InteractionItem | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [successPopup, setSuccessPopup] = useState<{
    action: 'cancel' | 'reschedule';
    packageTitle: string;
    timeSlot?: string;
  } | null>(null);

  const targetContent = useMemo(
    () => (booking ? bookableCatalog.find((p) => p.id === booking.targetId) : undefined),
    [booking, bookableCatalog],
  );

  if (!open) return null;

  const reset = () => {
    setPhone('');
    setMessage('');
    setResults([]);
    setBooking(null);
    setRescheduleOpen(false);
    setSuccessPopup(null);
  };

  const handleLookup = async () => {
    setMessage('');
    setBooking(null);
    if (!validateChinaMobile(phone)) {
      setResults([]);
      setMessage('请输入正确的 11 位预约手机号。');
      return;
    }
    const all = await loadAllInteractions();
    const found = findBookingsByPhone(all, phone);
    setResults(found);
    if (found.length === 0) {
      setMessage('未找到该手机号的有效预约，请核对号码或确认预约未被取消。');
    } else if (found.length === 1) {
      setBooking(found[0]);
    }
  };

  const handleCancel = async () => {
    if (!booking || busy) return;
    if (!confirm('确定取消这条预约吗？')) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await cancelGuestBooking(booking, phone);
      if (res.ok) {
        setSuccessPopup({
          action: 'cancel',
          packageTitle: booking.targetName,
          timeSlot: readCurrentSlotFragment(booking) || undefined,
        });
        setMessage('');
        onUpdated();
        setBooking(null);
        const all = await loadAllInteractions();
        setResults(findBookingsByPhone(all, phone));
      } else {
        setMessage(res.message);
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
        newSlotFragment: timeSlot,
        target: targetContent,
        interactions: all,
        globalClosedDates: closed.closedDates,
      });
      if (res.ok) {
        setRescheduleOpen(false);
        setSuccessPopup({
          action: 'reschedule',
          packageTitle: booking.targetName,
          timeSlot,
        });
        setMessage('');
        onUpdated();
        const refreshed = await loadAllInteractions();
        const next = findBookingsByPhone(refreshed, phone);
        setResults(next);
        const updated = next.find((b) => b.id === booking.id);
        setBooking(updated ?? null);
      } else {
        setMessage(res.message);
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
          <p className="mt-1 text-xs text-slate-500">无需登录，输入预约时填写的手机号即可查询并办理。</p>

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
            <button
              type="button"
              onClick={() => void handleLookup()}
              className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white"
            >
              查询预约
            </button>
          </div>

          {results.length > 1 && !booking ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold text-slate-500">共 {results.length} 条预约，请选择要操作的记录：</p>
              {results.map((item) => {
                const parsed = parseBookingDetails(item.details);
                const slot = readCurrentSlotFragment(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBooking(item)}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50 p-3 text-left hover:border-emerald-200 hover:bg-emerald-50/50"
                  >
                    <p className="font-bold text-slate-800">{item.targetName}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{slot || parsed.business || item.date}</p>
                    <p className="mt-1 text-[10px] font-bold text-emerald-700">{statusLabel(item.status)}</p>
                  </button>
                );
              })}
            </div>
          ) : null}

          {booking ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-slate-50 p-4 text-sm">
                <p className="font-bold text-slate-800">{booking.targetName}</p>
                <p className="mt-1 text-slate-600">登记：{contact?.contactName}</p>
                {slotLabel ? <p className="mt-1 text-slate-600">时段：{slotLabel}</p> : null}
                <p className="mt-2 text-xs font-bold text-emerald-700">状态：{statusLabel(booking.status)}</p>
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
              ) : (
                <p className="text-xs text-slate-500">未加载到预约项目信息，取消仍可办理；改期请刷新后重试或致电热线。</p>
              )}
              {!targetContent ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleCancel()}
                  className="h-11 w-full rounded-xl border border-red-200 bg-red-50 text-sm font-bold text-red-700"
                >
                  取消预约
                </button>
              ) : null}
              {booking.type === 'doctor_booking' ? (
                <p className="text-[11px] text-slate-500">医生挂号改期：请登录后在「我的 → 申请记录」撤销后重约，或致电热线。</p>
              ) : null}
              {results.length > 1 ? (
                <button
                  type="button"
                  className="text-xs text-slate-500 underline"
                  onClick={() => setBooking(null)}
                >
                  返回列表
                </button>
              ) : null}
            </div>
          ) : null}

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
          stackAboveDialogs
          onSelectSlot={(ts) => void handleRescheduleSlot(ts)}
          onClose={() => setRescheduleOpen(false)}
        />
      ) : null}

      <CheckupBookingSuccessModal
        open={!!successPopup}
        action={successPopup?.action}
        packageTitle={successPopup?.packageTitle}
        timeSlot={successPopup?.timeSlot}
        stackAboveManage
        onClose={() => setSuccessPopup(null)}
      />
    </ModalPortal>
  );
};
