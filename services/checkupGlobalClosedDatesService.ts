/**
 * 体检套餐全局例外关闭日期。
 * 存为固定 ID 的 app_content 记录；号源生成时与各套餐自身关闭日合并。
 */
import type { ContentItem } from './contentService';
import { fetchContent, readLocalContent, saveContent } from './contentService';
import { mergeClosedDateKeys } from './doctorScheduleUtils';
import { isCheckupPortalGuideItem } from './checkupPortalContentService';

export const CHECKUP_GLOBAL_CLOSED_DATES_ID = 'checkup_global_closed_dates';

export interface CheckupGlobalClosedDatesConfig {
  /** YYYY-MM-DD，全天不可约 */
  closedDates: string[];
}

export const DEFAULT_CHECKUP_GLOBAL_CLOSED_DATES: CheckupGlobalClosedDatesConfig = {
  closedDates: [],
};

export const isCheckupGlobalClosedDatesItem = (
  item: ContentItem | null | undefined,
): boolean =>
  !!item &&
  (item.id === CHECKUP_GLOBAL_CLOSED_DATES_ID ||
    item.details?.portalKind === 'checkup_global_closed_dates');

const normalizeClosedDates = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  const set = new Set<string>();
  for (const x of v) {
    const s = String(x ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) set.add(s);
  }
  return [...set].sort();
};

export const parseCheckupGlobalClosedDates = (
  item?: ContentItem | null,
): CheckupGlobalClosedDatesConfig => ({
  closedDates: normalizeClosedDates(item?.details?.globalClosedDates),
});

export const buildCheckupGlobalClosedDatesItem = (
  config: CheckupGlobalClosedDatesConfig,
): ContentItem => ({
  id: CHECKUP_GLOBAL_CLOSED_DATES_ID,
  type: 'checkup_package',
  title: '体检套餐·全局例外关闭日',
  description: '全局配置，不在套餐列表中展示',
  tags: ['portal_config'],
  status: 'active',
  image: '🚫',
  updatedAt: new Date().toISOString(),
  details: {
    portalKind: 'checkup_global_closed_dates',
    sortOrder: -2,
    globalClosedDates: [...config.closedDates].sort(),
  },
});

export const loadCheckupGlobalClosedDatesLocal = (): CheckupGlobalClosedDatesConfig => {
  const local = readLocalContent('checkup_package').find(isCheckupGlobalClosedDatesItem);
  return parseCheckupGlobalClosedDates(local);
};

export const fetchCheckupGlobalClosedDates = async (): Promise<CheckupGlobalClosedDatesConfig> => {
  try {
    const list = await fetchContent('checkup_package');
    const found = list.find(isCheckupGlobalClosedDatesItem);
    if (found) return parseCheckupGlobalClosedDates(found);
  } catch {
    /* fall through */
  }
  return loadCheckupGlobalClosedDatesLocal();
};

export const saveCheckupGlobalClosedDates = async (
  config: CheckupGlobalClosedDatesConfig,
): Promise<{ success: boolean; mode: 'cloud' | 'local'; error?: string }> =>
  saveContent(buildCheckupGlobalClosedDatesItem(config));

/** 套餐列表排除门户配置与全局关闭日记录 */
export const excludeCheckupConfigRecords = <T extends ContentItem>(items: T[]): T[] =>
  items.filter((i) => !isCheckupPortalGuideItem(i) && !isCheckupGlobalClosedDatesItem(i));

/** 将全局关闭日同步写入全部上架体检套餐（merge | replace 套餐级关闭日） */
export const syncGlobalClosedDatesToAllPackages = async (
  config: CheckupGlobalClosedDatesConfig,
  mode: 'merge' | 'replace',
): Promise<{ updated: number }> => {
  const list = await fetchContent('checkup_package');
  const packages = excludeCheckupConfigRecords(list).filter((i) => i.type === 'checkup_package');
  if (!packages.length) return { updated: 0 };

  await Promise.all(
    packages.map((item) => {
      const nextDates =
        mode === 'replace'
          ? [...config.closedDates].sort()
          : mergeClosedDateKeys(item.details?.serviceClosedDates, config.closedDates);
      return saveContent({
        ...item,
        details: {
          ...item.details,
          serviceClosedDates: nextDates,
        },
        updatedAt: new Date().toISOString(),
      });
    }),
  );
  return { updated: packages.length };
};
