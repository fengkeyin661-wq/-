import type {
  HealthRecord,
  HypertensionIndicatorCategoryGroup,
  HypertensionIndicatorProfile,
  HypertensionIndicatorProfileItem,
  HypertensionScreeningRecord,
} from '../types';
import {
  HYPERTENSION_INDICATOR_CATEGORIES,
  HYPERTENSION_SCREENING_CATALOG,
  HypertensionCatalogItem,
} from './hypertensionScreeningCatalog';
import { CHECKUP_ONLY_VITAL_ITEM_IDS, getCheckupVitalProfileValue } from './latestCheckupVitalsService';
import {
  firstCheckupPathValue,
  formatRenalCheckup,
  mergeProfileValues,
} from './indicatorProfileValueUtils';

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

const getByPath = (obj: unknown, path: string): unknown =>
  path.split('.').reduce((acc: unknown, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);

const catLabel = (id: HypertensionCatalogItem['category']) =>
  HYPERTENSION_INDICATOR_CATEGORIES.find((c) => c.id === id)?.label ?? id;

const screeningVal = (item: HypertensionCatalogItem, s: HypertensionScreeningRecord | null) => {
  if (!s) return { hasScreening: false as const };
  const parts: string[] = [];
  let ok = false;

  if (item.id === 'office_bp' && (s.sbp != null || s.dbp != null)) {
    ok = true;
    parts.push(`${s.sbp ?? '—'}/${s.dbp ?? '—'} mmHg`);
  }
  if (item.id === 'lipids') {
    const p = [s.tc && `TC ${s.tc}`, s.tg && `TG ${s.tg}`, s.ldl && `LDL ${s.ldl}`, s.hdl && `HDL ${s.hdl}`].filter(Boolean);
    if (p.length) {
      ok = true;
      parts.push(p.join('；'));
    }
  }
  if (item.id === 'renal') {
    const p = [s.creatinine && `肌酐 ${s.creatinine}`, s.urea && `尿素 ${s.urea}`].filter(Boolean);
    if (p.length) {
      ok = true;
      parts.push(p.join('；'));
    }
  }
  if (item.id === 'glucose_hba1c') {
    const p = [s.fastingGlucose != null && `空腹 ${fmt(s.fastingGlucose, 'mmol/L')}`, s.hba1c != null && `HbA1c ${s.hba1c}%`].filter(Boolean);
    if (p.length) {
      ok = true;
      parts.push(p.join('；'));
    }
  }
  if (item.id === 'electrolytes') {
    const p = [s.potassium && `K ${s.potassium}`, s.sodium && `Na ${s.sodium}`, s.chloride && `Cl ${s.chloride}`, s.calcium && `Ca ${s.calcium}`].filter(Boolean);
    if (p.length) {
      ok = true;
      parts.push(p.join('；'));
    }
  }
  if (item.id === 'raas') {
    const p = [s.renin && `肾素 ${s.renin}`, s.angiotensin && `血管紧张素 ${s.angiotensin}`, s.aldosterone && `醛固酮 ${s.aldosterone}`].filter(Boolean);
    if (p.length) {
      ok = true;
      parts.push(p.join('；'));
    }
  }

  if (!ok && item.screeningFields?.length) {
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

const checkupVal = (item: HypertensionCatalogItem, record: HealthRecord) => {
  if (CHECKUP_ONLY_VITAL_ITEM_IDS.has(item.id)) {
    return getCheckupVitalProfileValue(item.id, record);
  }
  if (item.id === 'renal') return formatRenalCheckup(record);
  if (item.id === 'homocysteine') {
    return firstCheckupPathValue(record, item.checkupPaths ?? [], item.unit);
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
  item: HypertensionCatalogItem,
  record: HealthRecord,
  screening: HypertensionScreeningRecord | null,
  observedDate?: string
): HypertensionIndicatorProfileItem => {
  const skipScreening = CHECKUP_ONLY_VITAL_ITEM_IDS.has(item.id);
  const fromS = skipScreening ? { hasScreening: false as const } : screeningVal(item, screening);
  const fromC = checkupVal(item, record);
  const present = fromS.hasScreening || fromC.hasCheckup;
  let dataSource: HypertensionIndicatorProfileItem['dataSource'];
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

export interface BuildHypertensionProfileOptions {
  linkedArchiveCheckupId?: string | null;
  archiveCheckupDate?: string;
}

export const buildHypertensionIndicatorProfile = (
  record: HealthRecord,
  screening: HypertensionScreeningRecord | null,
  options?: BuildHypertensionProfileOptions
): HypertensionIndicatorProfile => {
  const observedDate =
    screening?.screeningDate || screening?.registrationDate || record.profile?.checkupDate || options?.archiveCheckupDate;

  const items = HYPERTENSION_SCREENING_CATALOG.map((item) =>
    buildItem(item, record, screening, observedDate)
  );

  const categories: HypertensionIndicatorCategoryGroup[] = HYPERTENSION_INDICATOR_CATEGORIES.map((cat) => {
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

export const getLatestHypertensionScreeningFromRecord = (
  record: HealthRecord
): HypertensionScreeningRecord | null => {
  const list = record.hypertensionManagement?.screenings || [];
  if (!list.length) return null;
  return [...list].sort((a, b) =>
    (b.screeningDate || b.registrationDate || '').localeCompare(a.screeningDate || a.registrationDate || '')
  )[0];
};
