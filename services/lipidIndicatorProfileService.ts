import type {
  HealthRecord,
  LipidIndicatorCategoryGroup,
  LipidIndicatorProfile,
  LipidIndicatorProfileItem,
  LipidScreeningRecord,
} from '../types';
import { formatExamItemFromScreening } from './examReportReferenceService';
import { getByPath, mergeProfileValues } from './indicatorProfileValueUtils';
import { LIPID_INDICATOR_CATEGORIES, LIPID_SCREENING_CATALOG, LipidCatalogItem } from './lipidScreeningCatalog';
import { CHECKUP_ONLY_VITAL_ITEM_IDS, getCheckupVitalProfileValue } from './latestCheckupVitalsService';

const EMPTY = new Set(['', '未查', '无', '—', '-']);

const hasText = (v: unknown) => {
  if (v == null) return false;
  const s = String(v).trim();
  return s.length > 0 && !EMPTY.has(s);
};

const fmt = (v: unknown, unit?: string): string | undefined => {
  if (v == null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const t = Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
    return unit ? `${t} ${unit}` : t;
  }
  const s = String(v).trim();
  return s && !EMPTY.has(s) ? s : undefined;
};

const catLabel = (id: LipidCatalogItem['category']) =>
  LIPID_INDICATOR_CATEGORIES.find((c) => c.id === id)?.label ?? id;

const screeningVal = (
  item: LipidCatalogItem,
  s: LipidScreeningRecord | null,
  record: HealthRecord
) => {
  if (!s) return { hasScreening: false as const };

  if (item.id === 'carotid_us') {
    const p = [
      s.carotidUltrasound,
      s.carotidImt && `IMT ${s.carotidImt}`,
      s.carotidPlaque && `斑块 ${s.carotidPlaque}`,
    ].filter(Boolean);
    if (p.length) return { value: p.join('；'), hasScreening: true as const };
  }
  if (item.id === 'abi') {
    const p = [
      s.abiSummary,
      s.leftABI != null && `左ABI ${s.leftABI}`,
      s.rightABI != null && `右ABI ${s.rightABI}`,
    ].filter(Boolean);
    if (p.length) return { value: p.join('；'), hasScreening: true as const };
  }

  if (item.screeningFields?.length === 1) {
    return formatExamItemFromScreening(
      item.id,
      s as Record<string, unknown>,
      item.screeningFields,
      record
    );
  }

  const parts: string[] = [];
  let ok = false;
  if (item.screeningFields?.length) {
    for (const f of item.screeningFields) {
      const v = s[f];
      if (typeof v === 'number' && Number.isFinite(v)) {
        ok = true;
        parts.push(fmt(v, item.unit) ?? String(v));
      } else if (hasText(v)) {
        ok = true;
        parts.push(String(v).trim());
      }
    }
  }
  return { value: parts.length ? parts.join('；') : undefined, hasScreening: ok };
};

const checkupVal = (item: LipidCatalogItem, record: HealthRecord) => {
  if (CHECKUP_ONLY_VITAL_ITEM_IDS.has(item.id)) {
    return getCheckupVitalProfileValue(item.id, record);
  }
  if (!item.checkupPaths?.length) return { hasCheckup: false as const };
  const values: string[] = [];
  for (const p of item.checkupPaths) {
    const f = fmt(getByPath(record, p), item.unit);
    if (f) values.push(f);
  }
  const unique = [...new Set(values)];
  return unique.length ? { value: unique.join('；'), hasCheckup: true as const } : { hasCheckup: false as const };
};

const buildItem = (
  item: LipidCatalogItem,
  record: HealthRecord,
  screening: LipidScreeningRecord | null,
  observedDate?: string
): LipidIndicatorProfileItem => {
  const skipScreening = CHECKUP_ONLY_VITAL_ITEM_IDS.has(item.id);
  const fromS = skipScreening ? { hasScreening: false as const } : screeningVal(item, screening, record);
  const fromC = checkupVal(item, record);
  const present = fromS.hasScreening || fromC.hasCheckup;
  let dataSource: LipidIndicatorProfileItem['dataSource'];
  if (skipScreening && fromC.hasCheckup) dataSource = 'checkup';
  else if (fromC.hasCheckup) dataSource = 'checkup';
  else if (fromS.hasScreening) dataSource = 'screening';

  const value = mergeProfileValues(fromS, fromC, skipScreening);
  const checkupDate = record.profile?.checkupDate?.trim() || observedDate;
  const itemObservedDate = skipScreening && fromC.hasCheckup ? checkupDate : observedDate;

  return {
    itemId: item.id,
    label: item.label,
    categoryId: item.category,
    categoryLabel: catLabel(item.category),
    status: present ? 'present' : 'missing',
    value,
    unit: item.unit,
    referenceRange: item.referenceRange,
    clinicalMeaning: item.clinicalMeaning,
    retestCycle: item.retestCycle,
    priority: item.priority,
    dataSource,
    observedDate: present ? itemObservedDate : undefined,
    retestReminder: present ? undefined : `建议补测：${item.label}（${item.retestCycle}）`,
  };
};

export interface BuildLipidProfileOptions {
  linkedArchiveCheckupId?: string | null;
  archiveCheckupDate?: string;
}

export const buildLipidIndicatorProfile = (
  record: HealthRecord,
  screening: LipidScreeningRecord | null,
  options?: BuildLipidProfileOptions
): LipidIndicatorProfile => {
  const observedDate =
    screening?.screeningDate || screening?.registrationDate || record.profile?.checkupDate || options?.archiveCheckupDate;

  const items = LIPID_SCREENING_CATALOG.map((item) => buildItem(item, record, screening, observedDate));

  const categories: LipidIndicatorCategoryGroup[] = LIPID_INDICATOR_CATEGORIES.map((cat) => {
    const catItems = items.filter((i) => i.categoryId === cat.id);
    const presentCount = catItems.filter((i) => i.status === 'present').length;
    return {
      categoryId: cat.id,
      label: cat.label,
      items: catItems,
      presentCount,
      missingCount: catItems.length - presentCount,
    };
  });

  const presentCount = items.filter((i) => i.status === 'present').length;

  return {
    categories,
    totalItems: items.length,
    presentCount,
    missingCount: items.length - presentCount,
    missingHighPriority: items.filter((i) => i.status === 'missing' && i.priority === 'high'),
    linkedArchiveCheckupId: options?.linkedArchiveCheckupId,
    archiveCheckupDate: options?.archiveCheckupDate || record.profile?.checkupDate,
    generatedAt: new Date().toISOString(),
  };
};

export const getLatestLipidScreeningFromRecord = (record: HealthRecord): LipidScreeningRecord | null => {
  const list = record.lipidManagement?.screenings || [];
  if (!list.length) return null;
  return [...list].sort((a, b) =>
    (b.screeningDate || b.registrationDate || '').localeCompare(a.screeningDate || a.registrationDate || '')
  )[0];
};
