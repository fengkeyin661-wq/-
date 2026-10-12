import type { ContentItem, InteractionItem } from './contentService';
import { saveInteraction } from './contentService';
import {
  buildBookingDetails,
  parseBookingDetails,
  resolveBookingUserId,
  validateChinaMobile,
} from './bookingContact';
import {
  SLOT_MAP,
  getNextMonthSlotsForDoctor,
  getNextMonthSlotsForService,
  getServiceSlotQuota,
} from './doctorScheduleUtils';

const SLOT_LINE_RE =
  /(?:预约挂号|服务预约|体检套餐预约)[：:]\s*([^，,]+)/;

export function extractSlotFragmentFromBusinessLine(businessDetails: string): string | null {
  const m = businessDetails.match(SLOT_LINE_RE);
  return m ? m[1].trim() : null;
}

export function countSlotBookings(params: {
  interactions: InteractionItem[];
  targetId: string;
  bookingType: 'doctor_booking' | 'service_booking';
  slotFragment: string;
  excludeId?: string;
}): number {
  const { interactions, targetId, bookingType, slotFragment, excludeId } = params;
  return interactions.filter(
    (i) =>
      i.id !== excludeId &&
      i.type === bookingType &&
      i.targetId === targetId &&
      i.status !== 'cancelled' &&
      i.details?.includes(slotFragment),
  ).length;
}

function resolveSlotQuota(
  target: ContentItem,
  bookingType: 'doctor_booking' | 'service_booking',
  slotFragment: string,
  globalClosedDates?: string[],
): { quota: number; dateKey: string } | null {
  const slots =
    bookingType === 'doctor_booking'
      ? getNextMonthSlotsForDoctor(target)
      : getNextMonthSlotsForService(target, { globalClosedDates });
  for (const slot of slots) {
    const frag = `${slot.displayDate}${SLOT_MAP[slot.slotId]}`;
    if (frag === slotFragment) {
      const quota =
        bookingType === 'doctor_booking'
          ? (target.details?.slotQuotas as Record<string, Record<string, number>> | undefined)?.[slot.dayKey]?.[
              slot.slotId
            ] ?? 10
          : getServiceSlotQuota(target.details, slot.dayKey, slot.slotId);
      return { quota, dateKey: slot.dateKey };
    }
  }
  return null;
}

export type TimedBookingSubmitResult = {
  id: string;
  status: 'confirmed' | 'pending';
  userMessage: string;
};

export async function submitTimedBooking(params: {
  interactionType: 'doctor_booking' | 'service_booking';
  target: ContentItem;
  contactName: string;
  contactPhone: string;
  businessDetailsLine: string;
  archiveUserId?: string;
  interactions: InteractionItem[];
  globalClosedDates?: string[];
}): Promise<TimedBookingSubmitResult> {
  const {
    interactionType,
    target,
    contactName,
    contactPhone,
    businessDetailsLine,
    archiveUserId,
    interactions,
    globalClosedDates,
  } = params;

  const name = contactName.trim();
  const phone = contactPhone.trim();
  if (!name) {
    throw new Error('请填写姓名');
  }
  if (!validateChinaMobile(phone)) {
    throw new Error('请填写正确的手机号');
  }

  const slotFragment = extractSlotFragmentFromBusinessLine(businessDetailsLine);
  const id = `${interactionType}_${Date.now()}`;
  let status: 'confirmed' | 'pending' = 'pending';
  let userMessage =
    '申请已提交，请保持手机畅通，工作人员可能致电确认。';

  if (slotFragment) {
    const meta = resolveSlotQuota(target, interactionType, slotFragment, globalClosedDates);
    if (meta) {
      const count = countSlotBookings({
        interactions,
        targetId: target.id,
        bookingType: interactionType,
        slotFragment,
      });
      if (count < meta.quota) {
        status = 'confirmed';
        userMessage = '预约成功！请按时到场。如需改期或取消，在体检预约页输入预约手机号即可办理。';
      } else {
        userMessage = '该时段名额已满，您的申请已进入候补队列，工作人员将尽快联系您。';
      }
    }
  }

  const uid = resolveBookingUserId(archiveUserId, phone);
  const details = buildBookingDetails(name, phone, businessDetailsLine);

  await saveInteraction({
    id,
    type: interactionType,
    userId: uid,
    userName: name,
    targetId: target.id,
    targetName: target.title,
    status,
    date: new Date().toISOString().split('T')[0],
    details,
  });

  return { id, status, userMessage };
}

export function formatTimedBookingUserAlert(result: TimedBookingSubmitResult): string {
  return result.userMessage;
}

export function replaceBusinessTimeSlot(
  details: string,
  bookingType: 'doctor_booking' | 'service_booking',
  newSlotFragment: string,
): string {
  const parsed = parseBookingDetails(details);
  const prefix =
    bookingType === 'doctor_booking'
      ? '预约挂号'
      : parsed.business.includes('体检')
        ? '体检套餐预约'
        : '服务预约';
  const rest = parsed.business.replace(
    SLOT_LINE_RE,
    `${prefix}：${newSlotFragment}`,
  );
  if (rest === parsed.business && parsed.business) {
    return `${prefix}：${newSlotFragment}，${parsed.business}`;
  }
  return rest;
}
