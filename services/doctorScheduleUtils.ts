import type { ContentItem } from './contentService';

/** 与预约侧 weekday 键一致：0=周日 … 6=周六 */
export const DAY_INDEX_TO_KEY: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export const DAY_MAP: Record<string, string> = {
  Mon: '周一',
  Tue: '周二',
  Wed: '周三',
  Thu: '周四',
  Fri: '周五',
  Sat: '周六',
  Sun: '周日',
};

export const SLOT_MAP: Record<string, string> = { AM: '上午', PM: '下午' };

export type DoctorMonthSlot = {
  dateKey: string;
  displayDate: string;
  dayKey: string;
  slotId: string;
};

function formatLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 医生详情中的「不出诊」日历日，格式 YYYY-MM-DD */
export function parseScheduleClosedDates(details?: { [key: string]: unknown }): Set<string> {
  const raw = details?.scheduleClosedDates;
  if (!Array.isArray(raw)) return new Set();
  const set = new Set<string>();
  for (const x of raw) {
    if (typeof x !== 'string') continue;
    const s = x.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) set.add(s);
  }
  return set;
}

/**
 * 从今天起若干天内，按周计划展开可预约时段；排除 scheduleClosedDates 中的日期。
 */
export function getNextMonthSlotsForDoctor(
  doctor: Pick<ContentItem, 'details'>,
  options?: { horizonDays?: number; from?: Date }
): DoctorMonthSlot[] {
  const weekly = (doctor.details?.weeklySchedule || {}) as Record<string, string[]>;
  const closed = parseScheduleClosedDates(doctor.details);
  const horizon = options?.horizonDays ?? 30;
  const today = options?.from ? new Date(options.from) : new Date();
  today.setHours(0, 0, 0, 0);

  const slots: DoctorMonthSlot[] = [];
  for (let i = 0; i < horizon; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateKey = formatLocalDateKey(d);
    if (closed.has(dateKey)) continue;

    const dayKey = DAY_INDEX_TO_KEY[d.getDay()];
    const daySlots: string[] = weekly[dayKey] || [];
    if (!daySlots.length) continue;

    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const displayDate = `${mm}-${dd} ${DAY_MAP[dayKey]}`;
    daySlots.forEach((slotId) => slots.push({ dateKey, displayDate, dayKey, slotId }));
  }
  return slots;
}
