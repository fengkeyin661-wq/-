import type { ContentItem, InteractionItem } from './contentService';
import {
  fetchInteractions,
  readLocalInteractions,
  updateInteractionRecord,
} from './contentService';
import { parseBookingDetails } from './bookingContact';
import {
  guestBookingPhoneMatches,
  parseManageMeta,
  phoneDigits,
} from './bookingManageToken';
import {
  countSlotBookings,
  extractSlotFragmentFromBusinessLine,
  replaceBusinessTimeSlot,
} from './bookingSubmit';
import {
  SLOT_MAP,
  getNextMonthSlotsForDoctor,
  getNextMonthSlotsForService,
  getServiceSlotQuota,
} from './doctorScheduleUtils';

export async function loadAllInteractions(): Promise<InteractionItem[]> {
  try {
    return await fetchInteractions();
  } catch {
    return readLocalInteractions();
  }
}

export function findGuestBooking(
  interactions: InteractionItem[],
  phone: string,
  manageToken: string,
): InteractionItem | null {
  const token = manageToken.trim().toUpperCase();
  if (!token || phoneDigits(phone).length !== 11) return null;
  return (
    interactions.find((i) => {
      if (i.status === 'cancelled' || i.status === 'completed') return false;
      if (i.type !== 'doctor_booking' && i.type !== 'service_booking') return false;
      if (!guestBookingPhoneMatches(i.userId, phone)) return false;
      const meta = parseManageMeta(i.details);
      return meta?.manageToken === token;
    }) ?? null
  );
}

export async function cancelGuestBooking(
  booking: InteractionItem,
  phone: string,
  manageToken: string,
): Promise<{ ok: boolean; message: string }> {
  const found = findGuestBooking([booking], phone, manageToken);
  if (!found) return { ok: false, message: '未找到预约，请核对手机号与凭证码。' };
  await updateInteractionRecord(booking.id, { status: 'cancelled' });
  return { ok: true, message: '预约已取消。' };
}

export async function rescheduleGuestBooking(params: {
  booking: InteractionItem;
  phone: string;
  manageToken: string;
  newSlotFragment: string;
  target: ContentItem;
  interactions: InteractionItem[];
  globalClosedDates?: string[];
}): Promise<{ ok: boolean; message: string }> {
  const { booking, phone, manageToken, newSlotFragment, target, interactions, globalClosedDates } =
    params;
  const found = findGuestBooking([booking], phone, manageToken);
  if (!found) return { ok: false, message: '未找到预约，请核对手机号与凭证码。' };
  if (found.type !== 'doctor_booking' && found.type !== 'service_booking') {
    return { ok: false, message: '该预约类型不支持自助改期。' };
  }

  const bookingType = found.type;
  const slots =
    bookingType === 'doctor_booking'
      ? getNextMonthSlotsForDoctor(target)
      : getNextMonthSlotsForService(target, { globalClosedDates });
  const slot = slots.find((s) => `${s.displayDate}${SLOT_MAP[s.slotId]}` === newSlotFragment);
  if (!slot) return { ok: false, message: '所选时段无效，请重新选择。' };

  const quota =
    bookingType === 'doctor_booking'
      ? (target.details?.slotQuotas as Record<string, Record<string, number>> | undefined)?.[slot.dayKey]?.[
          slot.slotId
        ] ?? 10
      : getServiceSlotQuota(target.details, slot.dayKey, slot.slotId);

  const count = countSlotBookings({
    interactions,
    targetId: target.id,
    bookingType,
    slotFragment: newSlotFragment,
    excludeId: booking.id,
  });
  if (count >= quota) {
    return { ok: false, message: '该时段已满，请选择其他时段。' };
  }

  const details = replaceBusinessTimeSlot(String(found.details || ''), bookingType, newSlotFragment);
  await updateInteractionRecord(booking.id, {
    details,
    status: 'confirmed',
  });
  return { ok: true, message: '改期成功，新时段已确认。' };
}

export function readCurrentSlotFragment(booking: InteractionItem): string | null {
  const parsed = parseBookingDetails(booking.details);
  return extractSlotFragmentFromBusinessLine(parsed.business);
}
