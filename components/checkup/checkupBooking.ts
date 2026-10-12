import type { ContentItem, InteractionItem } from '../../services/contentService';
import { fetchCheckupGlobalClosedDates } from '../../services/checkupGlobalClosedDatesService';
import { submitTimedBooking, type TimedBookingSubmitResult } from '../../services/bookingSubmit';

export async function submitCheckupBooking(params: {
  packageItem: ContentItem;
  timeSlot: string;
  contactName: string;
  contactPhone: string;
  interactions: InteractionItem[];
  archiveUserId?: string;
}): Promise<TimedBookingSubmitResult> {
  const { packageItem, timeSlot, contactName, contactPhone, interactions, archiveUserId } = params;
  const detailsLine = `体检套餐预约：${timeSlot}，价格: ${packageItem.details?.price || '免费'}`;
  const closedCfg = await fetchCheckupGlobalClosedDates();

  return submitTimedBooking({
    interactionType: 'service_booking',
    target: packageItem,
    contactName,
    contactPhone,
    businessDetailsLine: detailsLine,
    archiveUserId,
    interactions,
    globalClosedDates: closedCfg.closedDates,
  });
}
