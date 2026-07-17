/** 预约/挂号登记：写入 interaction.details 供运营与医生端查看 */
export const BOOKING_GUEST_PREFIX = 'guest_';

export const isGuestBookingUserId = (userId: string): boolean =>
  userId.startsWith(BOOKING_GUEST_PREFIX);

export const validateChinaMobile = (raw: string): boolean => /^1\d{10}$/.test(raw.trim());

export function buildBookingDetails(
  contactName: string,
  contactPhone: string,
  businessDetails: string
): string {
  const name = contactName.trim();
  const phone = contactPhone.trim();
  return `【登记】姓名：${name}；联系电话：${phone} | ${businessDetails}`;
}

/** 已建档用户用体检档案号；访客用 guest_手机号 便于后台识别 */
export function resolveBookingUserId(archiveUserId: string | undefined, contactPhone: string): string {
  const id = archiveUserId?.trim();
  if (id) return id;
  const digits = contactPhone.replace(/\D/g, '');
  if (digits.length === 11) return `${BOOKING_GUEST_PREFIX}${digits}`;
  return `${BOOKING_GUEST_PREFIX}${Date.now()}`;
}
