import type { ContentItem, InteractionItem } from './contentService';
import {
  fetchInteractions,
  readLocalInteractions,
  updateInteractionRecord,
} from './contentService';
import { parseBookingDetails } from './bookingContact';
import { guestBookingPhoneMatches, phoneDigits } from './bookingManageToken';
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

export function bookingMatchesPhone(booking: InteractionItem, phone: string): boolean {
  const digits = phoneDigits(phone);
  if (digits.length !== 11) return false;
  if (guestBookingPhoneMatches(booking.userId, phone)) return true;
  const parsed = parseBookingDetails(booking.details);
  return phoneDigits(parsed.contactPhone) === digits;
}

const ACTIVE_BOOKING_TYPES = new Set<InteractionItem['type']>(['doctor_booking', 'service_booking']);

/** 按预约手机号查询未取消/未完成的预约（可有多条） */
export function findBookingsByPhone(
  interactions: InteractionItem[],
  phone: string,
): InteractionItem[] {
  if (phoneDigits(phone).length !== 11) return [];
  return interactions
    .filter((i) => {
      if (i.status === 'cancelled' || i.status === 'completed') return false;
      if (!ACTIVE_BOOKING_TYPES.has(i.type)) return false;
      return bookingMatchesPhone(i, phone);
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export async function cancelGuestBooking(
  booking: InteractionItem,
  phone: string,
): Promise<{ ok: boolean; message: string }> {
  if (!bookingMatchesPhone(booking, phone)) {
    return { ok: false, message: '未找到预约，请核对预约手机号。' };
  }
  await updateInteractionRecord(booking.id, { status: 'cancelled' });
  return { ok: true, message: '预约已取消。' };
}

export async function rescheduleGuestBooking(params: {
  booking: InteractionItem;
  phone: string;
  newSlotFragment: string;
  target: ContentItem;
  interactions: InteractionItem[];
  globalClosedDates?: string[];
}): Promise<{ ok: boolean; message: string }> {
  const { booking, phone, newSlotFragment, target, interactions, globalClosedDates } = params;
  if (!bookingMatchesPhone(booking, phone)) {
    return { ok: false, message: '未找到预约，请核对预约手机号。' };
  }
  if (booking.type !== 'doctor_booking' && booking.type !== 'service_booking') {
    return { ok: false, message: '该预约类型不支持自助改期。' };
  }

  const bookingType = booking.type;
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

  const details = replaceBusinessTimeSlot(String(booking.details || ''), bookingType, newSlotFragment);
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
