const TOKEN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateManageToken(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)];
  }
  return out;
}

const MANAGE_META_RE = /【自助】凭证\s*([A-Z0-9]+)\s*单号\s*([^\s|]+)/;

export function parseManageMeta(details?: string): { manageToken: string; bookingId: string } | null {
  const raw = String(details || '');
  const m = raw.match(MANAGE_META_RE);
  if (!m) return null;
  return { manageToken: m[1], bookingId: m[2] };
}

export function appendManageMeta(details: string, manageToken: string, bookingId: string): string {
  const base = details.replace(/\s*\|\s*【自助】凭证[\s\S]*$/, '').trim();
  return `${base} | 【自助】凭证 ${manageToken} 单号 ${bookingId}`;
}

export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function guestBookingPhoneMatches(userId: string, phone: string): boolean {
  const digits = phoneDigits(phone);
  if (digits.length !== 11) return false;
  return userId === `guest_${digits}`;
}
