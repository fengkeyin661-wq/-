/**
 * 体检预约站「到检信息 + 体检须知」全局配置。
 * 存为固定 ID 的 app_content 记录，前后台共用；无记录时回退默认文案。
 */
import type { ContentItem } from './contentService';
import { fetchContent, readLocalContent, saveContent } from './contentService';
import {
  CHECKUP_ADDRESS_INFO,
  CHECKUP_CONTACT_FOOTER,
  CHECKUP_CONTACT_PHONES,
  CHECKUP_NOTICE_ITEMS,
  CHECKUP_NOTICE_TITLE,
  CHECKUP_POST_SERVICE_ITEMS,
  CHECKUP_POST_SERVICE_TITLE,
  CHECKUP_TIME_INFO,
  CHECKUP_TIME_LINES,
  CHECKUP_TRANSPORT_INFO,
} from '../components/checkup/checkupNoticeContent';

export const CHECKUP_PORTAL_GUIDE_ID = 'checkup_portal_guide';

export interface CheckupPostServiceItem {
  title: string;
  content: string;
}

export interface CheckupPortalGuide {
  /** 首页到检时间分行 */
  timeLines: string[];
  /** 须知弹窗中的时间整段文案 */
  timeInfoContent: string;
  addressTitle: string;
  addressContent: string;
  phones: string[];
  transportTitle: string;
  transportItems: string[];
  noticeTitle: string;
  noticeItems: string[];
  contactFooter: string;
  postServiceTitle: string;
  postServiceItems: CheckupPostServiceItem[];
}

export const DEFAULT_CHECKUP_PORTAL_GUIDE: CheckupPortalGuide = {
  timeLines: [...CHECKUP_TIME_LINES],
  timeInfoContent: CHECKUP_TIME_INFO.content,
  addressTitle: CHECKUP_ADDRESS_INFO.title,
  addressContent: CHECKUP_ADDRESS_INFO.content,
  phones: [...CHECKUP_CONTACT_PHONES],
  transportTitle: CHECKUP_TRANSPORT_INFO.title,
  transportItems: [...CHECKUP_TRANSPORT_INFO.items],
  noticeTitle: CHECKUP_NOTICE_TITLE,
  noticeItems: [...CHECKUP_NOTICE_ITEMS],
  contactFooter: CHECKUP_CONTACT_FOOTER,
  postServiceTitle: CHECKUP_POST_SERVICE_TITLE,
  postServiceItems: CHECKUP_POST_SERVICE_ITEMS.map((x) => ({ ...x })),
};

export const isCheckupPortalGuideItem = (item: ContentItem | null | undefined): boolean =>
  !!item &&
  (item.id === CHECKUP_PORTAL_GUIDE_ID || item.details?.portalKind === 'checkup_guide');

const normalizeLines = (v: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(v)) return [...fallback];
  const lines = v.map((x) => String(x ?? '').trim()).filter(Boolean);
  return lines.length ? lines : [...fallback];
};

const normalizePhones = (v: unknown, fallback: string[]): string[] => {
  const lines = normalizeLines(v, fallback);
  return lines.map((p) => p.replace(/\s+/g, '')).filter(Boolean);
};

const normalizePostItems = (v: unknown, fallback: CheckupPostServiceItem[]): CheckupPostServiceItem[] => {
  if (!Array.isArray(v) || v.length === 0) return fallback.map((x) => ({ ...x }));
  return v
    .map((row) => ({
      title: String((row as CheckupPostServiceItem)?.title || '').trim(),
      content: String((row as CheckupPostServiceItem)?.content || '').trim(),
    }))
    .filter((row) => row.title || row.content);
};

export const parseCheckupPortalGuide = (item?: ContentItem | null): CheckupPortalGuide => {
  const d = item?.details || {};
  return {
    timeLines: normalizeLines(d.timeLines, DEFAULT_CHECKUP_PORTAL_GUIDE.timeLines),
    timeInfoContent:
      String(d.timeInfoContent || '').trim() || DEFAULT_CHECKUP_PORTAL_GUIDE.timeInfoContent,
    addressTitle: String(d.addressTitle || '').trim() || DEFAULT_CHECKUP_PORTAL_GUIDE.addressTitle,
    addressContent:
      String(d.addressContent || '').trim() || DEFAULT_CHECKUP_PORTAL_GUIDE.addressContent,
    phones: normalizePhones(d.phones, DEFAULT_CHECKUP_PORTAL_GUIDE.phones),
    transportTitle:
      String(d.transportTitle || '').trim() || DEFAULT_CHECKUP_PORTAL_GUIDE.transportTitle,
    transportItems: normalizeLines(d.transportItems, DEFAULT_CHECKUP_PORTAL_GUIDE.transportItems),
    noticeTitle: String(d.noticeTitle || '').trim() || DEFAULT_CHECKUP_PORTAL_GUIDE.noticeTitle,
    noticeItems: normalizeLines(d.noticeItems, DEFAULT_CHECKUP_PORTAL_GUIDE.noticeItems),
    contactFooter:
      String(d.contactFooter || '').trim() || DEFAULT_CHECKUP_PORTAL_GUIDE.contactFooter,
    postServiceTitle:
      String(d.postServiceTitle || '').trim() || DEFAULT_CHECKUP_PORTAL_GUIDE.postServiceTitle,
    postServiceItems: normalizePostItems(
      d.postServiceItems,
      DEFAULT_CHECKUP_PORTAL_GUIDE.postServiceItems,
    ),
  };
};

export const buildCheckupPortalGuideItem = (guide: CheckupPortalGuide): ContentItem => ({
  id: CHECKUP_PORTAL_GUIDE_ID,
  type: 'checkup_package',
  title: '体检预约站·到检信息与须知',
  description: '全局配置，不在套餐列表中展示',
  tags: ['portal_guide'],
  status: 'active',
  image: '📋',
  updatedAt: new Date().toISOString(),
  details: {
    portalKind: 'checkup_guide',
    sortOrder: -1,
    timeLines: guide.timeLines,
    timeInfoContent: guide.timeInfoContent,
    addressTitle: guide.addressTitle,
    addressContent: guide.addressContent,
    phones: guide.phones,
    transportTitle: guide.transportTitle,
    transportItems: guide.transportItems,
    noticeTitle: guide.noticeTitle,
    noticeItems: guide.noticeItems,
    contactFooter: guide.contactFooter,
    postServiceTitle: guide.postServiceTitle,
    postServiceItems: guide.postServiceItems,
  },
});

export const loadCheckupPortalGuideLocal = (): CheckupPortalGuide => {
  const local = readLocalContent('checkup_package').find(isCheckupPortalGuideItem);
  return parseCheckupPortalGuide(local);
};

export const fetchCheckupPortalGuide = async (): Promise<CheckupPortalGuide> => {
  try {
    const list = await fetchContent('checkup_package');
    const found = list.find(isCheckupPortalGuideItem);
    if (found) return parseCheckupPortalGuide(found);
  } catch {
    /* fall through */
  }
  return loadCheckupPortalGuideLocal();
};

export const saveCheckupPortalGuide = async (
  guide: CheckupPortalGuide,
): Promise<{ success: boolean; mode: 'cloud' | 'local'; error?: string }> =>
  saveContent(buildCheckupPortalGuideItem(guide));

/** 套餐列表排除门户配置记录 */
export const excludeCheckupPortalGuide = <T extends ContentItem>(items: T[]): T[] =>
  items.filter((i) => !isCheckupPortalGuideItem(i));
