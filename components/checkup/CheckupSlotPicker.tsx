import React from 'react';
import type { ContentItem, InteractionItem } from '../../services/contentService';
import {
  SLOT_MAP,
  getNextMonthSlotsForService,
  getServiceSlotQuota,
} from '../../services/doctorScheduleUtils';
import { HEALTH_MANAGEMENT_HOTLINE } from '../../services/userServiceCatalog';
import { ModalPortal } from '../user/ModalPortal';

interface Props {
  packageItem: ContentItem;
  interactions: InteractionItem[];
  onSelectSlot: (timeSlot: string) => void;
  onClose: () => void;
}

function getSlotUsage(
  packageId: string,
  slot: { displayDate: string; dayKey: string; slotId: string },
  interactions: InteractionItem[],
  details?: Record<string, unknown>,
) {
  const fragment = `${slot.displayDate}${SLOT_MAP[slot.slotId]}`;
  const count = interactions.filter(
    (i) =>
      i.type === 'service_booking' &&
      i.targetId === packageId &&
      i.status !== 'cancelled' &&
      i.details?.includes(fragment),
  ).length;
  const quota = getServiceSlotQuota(details, slot.dayKey, slot.slotId);
  return { count, quota, full: count >= quota };
}

export const CheckupSlotPicker: React.FC<Props> = ({
  packageItem,
  interactions,
  onSelectSlot,
  onClose,
}) => {
  const monthSlots = getNextMonthSlotsForService(packageItem);

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-slate-900/60 z-[100] flex items-end justify-center backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkup-slot-picker-title"
      >
        <div
          className="bg-white w-full max-w-md rounded-t-[2.5rem] p-6 animate-slideUp max-h-[80vh] flex flex-col relative"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
          <h3 id="checkup-slot-picker-title" className="text-xl font-black text-slate-800 text-center mb-1">
            选择体检时间
          </h3>
          <p className="text-xs text-slate-400 text-center mb-6">预约套餐：{packageItem.title}</p>
          <div className="flex-1 overflow-y-auto overscroll-contain space-y-3 pb-6 [-webkit-overflow-scrolling:touch]">
            {!monthSlots.length ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-3 opacity-20">📅</div>
                <p className="text-sm text-slate-500">
                  暂无可预约时段
                  <br />
                  请致电健康管理热线 {HEALTH_MANAGEMENT_HOTLINE}
                </p>
              </div>
            ) : (
              monthSlots.map((slot) => {
                const { count, quota, full } = getSlotUsage(
                  packageItem.id,
                  slot,
                  interactions,
                  packageItem.details,
                );
                return (
                  <button
                    key={`${slot.dateKey}-${slot.slotId}`}
                    type="button"
                    disabled={full}
                    onClick={() => onSelectSlot(`${slot.displayDate}${SLOT_MAP[slot.slotId]}`)}
                    className={`w-full border p-4 rounded-2xl flex items-center justify-between transition-all text-left ${
                      full
                        ? 'opacity-50 cursor-not-allowed border-slate-100 bg-slate-50 grayscale'
                        : 'border-slate-100 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200'
                    }`}
                  >
                    <span className="font-bold text-slate-700">
                      {slot.displayDate} · {SLOT_MAP[slot.slotId]}
                    </span>
                    <span className={`text-xs font-bold ${full ? 'text-red-500' : 'text-slate-400'}`}>
                      {full ? '约满' : `余 ${quota - count} 位`}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold text-sm"
          >
            取消
          </button>
        </div>
      </div>
    </ModalPortal>
  );
};
