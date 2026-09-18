import {
  saveInteraction,
  type ContentItem,
} from '../../services/contentService';
import {
  buildBookingDetails,
  resolveBookingUserId,
} from '../../services/bookingContact';

export async function submitCheckupBooking(params: {
  packageItem: ContentItem;
  timeSlot: string;
  contactName: string;
  contactPhone: string;
}): Promise<void> {
  const { packageItem, timeSlot, contactName, contactPhone } = params;
  const detailsLine = `体检套餐预约：${timeSlot}，价格: ${packageItem.details?.price || '免费'}`;
  const uid = resolveBookingUserId(undefined, contactPhone);

  await saveInteraction({
    id: `service_booking_${Date.now()}`,
    type: 'service_booking',
    userId: uid,
    userName: contactName.trim(),
    targetId: packageItem.id,
    targetName: packageItem.title,
    status: 'pending',
    date: new Date().toISOString().split('T')[0],
    details: buildBookingDetails(contactName, contactPhone, detailsLine),
  });
}
