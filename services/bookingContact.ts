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

export function isCheckupBooking(item: { type?: string; details?: string }): boolean {
  if (item.type !== 'service_booking') return false;
  const d = String(item.details || '');
  return d.includes('体检套餐预约') || d.includes('体检预约');
}

export function parseBookingDetails(details?: string): {
  contactName: string;
  contactPhone: string;
  business: string;
} {
  const raw = String(details || '');
  const m = raw.match(/【登记】姓名：([^；;]+)[；;]\s*联系电话：([^|]+)\|\s*(.*)/);
  if (m) {
    return { contactName: m[1].trim(), contactPhone: m[2].trim(), business: (m[3] || '').trim() };
  }
  return { contactName: '', contactPhone: '', business: raw };
}

/** 已建档用户用体检档案号；访客用 guest_手机号 便于后台识别 */
export function resolveBookingUserId(archiveUserId: string | undefined, contactPhone: string): string {
  const id = archiveUserId?.trim();
  if (id) return id;
  const digits = contactPhone.replace(/\D/g, '');
  if (digits.length === 11) return `${BOOKING_GUEST_PREFIX}${digits}`;
  return `${BOOKING_GUEST_PREFIX}${Date.now()}`;
}
