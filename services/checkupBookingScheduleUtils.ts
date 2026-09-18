/** 从预约详情中解析到检时段与日期 */
export function parseCheckupAppointmentFromDetails(details?: string): {
  slotLabel: string;
  priceHint: string;
} {
  const raw = String(details || '');
  const m = raw.match(/体检套餐预约：([^|]+)/);
  if (!m) return { slotLabel: '', priceHint: '' };
  const segment = m[1].trim();
  const priceMatch = segment.match(/，价格:\s*(.+)$/);
  const slotLabel = priceMatch ? segment.replace(/，价格:.+$/, '').trim() : segment;
  return { slotLabel, priceHint: priceMatch?.[1]?.trim() || '' };
}

/** 将「03-20 周一上午」类展示文案解析为 YYYY-MM-DD（默认当前年，跨年自动 +1 年） */
export function resolveCheckupSlotDateKey(
  slotLabel: string,
  refDate = new Date(),
): string | null {
  const m = slotLabel.match(/(\d{2})-(\d{2})/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (!month || !day) return null;

  let year = refDate.getFullYear();
  let candidate = new Date(year, month - 1, day);
  candidate.setHours(12, 0, 0, 0);

  const ref = new Date(refDate);
  ref.setHours(12, 0, 0, 0);
  const diffDays = (candidate.getTime() - ref.getTime()) / (86400000);
  if (diffDays < -60) {
    year += 1;
    candidate = new Date(year, month - 1, day);
  }

  const y = candidate.getFullYear();
  const mm = String(candidate.getMonth() + 1).padStart(2, '0');
  const dd = String(candidate.getDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

export const formatLocalYmd = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatFriendlyDate = (dateKey: string): string => {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d);
  const week = ['日', '一', '二', '三', '四', '五', '六'][dt.getDay()];
  const today = formatLocalYmd();
  const tomorrow = formatLocalYmd(new Date(Date.now() + 86400000));
  if (dateKey === today) return '今天';
  if (dateKey === tomorrow) return '明天';
  return `${m}月${d}日 周${week}`;
};
