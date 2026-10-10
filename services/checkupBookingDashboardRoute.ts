/** 体检预约手机看板 — 独立 hash 子链接，便于收藏到手机桌面 */
export const CHECKUP_BOOKING_DASHBOARD_HASH = '#/checkup-bookings';

export const isCheckupBookingDashboardHash = (
  hash = typeof window !== 'undefined' ? window.location.hash : '',
): boolean => {
  const h = hash.trim().toLowerCase();
  return h === '#/checkup-bookings' || h.startsWith('#/checkup-bookings?');
};

export const openCheckupBookingDashboard = (): void => {
  window.location.hash = '/checkup-bookings';
};

export const getCheckupBookingDashboardUrl = (): string => {
  if (typeof window === 'undefined') return CHECKUP_BOOKING_DASHBOARD_HASH;
  return `${window.location.origin}${window.location.pathname}${CHECKUP_BOOKING_DASHBOARD_HASH}`;
};

/** 可访问手机看板的后台角色 */
export const CHECKUP_BOOKING_DASHBOARD_ROLES = [
  'resource_admin',
  'admin',
  'health_manager',
  'home',
] as const;

export type CheckupBookingDashboardRole = (typeof CHECKUP_BOOKING_DASHBOARD_ROLES)[number];

export const canAccessCheckupBookingDashboard = (
  role: string | null | undefined,
): role is CheckupBookingDashboardRole =>
  !!role && (CHECKUP_BOOKING_DASHBOARD_ROLES as readonly string[]).includes(role);
