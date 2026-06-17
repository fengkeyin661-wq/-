import type {
  DiabetesIndicatorCategoryGroup,
  DiabetesIndicatorProfile,
  DiabetesIndicatorProfileItem,
  DiabetesScreeningRecord,
  HealthRecord,
} from '../types';
import {
  DIABETES_INDICATOR_CATEGORIES,
  DIABETES_SCREENING_CATALOG,
  ScreeningCatalogItem,
} from './diabetesScreeningCatalog';
import { CHECKUP_ONLY_VITAL_ITEM_IDS, getCheckupVitalProfileValue } from './latestCheckupVitalsService';
import { firstCheckupPathValue, mergeProfileValues } from './indicatorProfileValueUtils';

const EMPTY_MARKERS = new Set(['', '未查', '无', '—', '-', 'N/A', 'n/a']);

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
};

const hasText = (v: unknown): boolean => {
  if (v == null) return false;
  const s = String(v).trim();
  return s.length > 0 && !EMPTY_MARKERS.has(s);
};

const getByPath = (obj: unknown, path: string): unknown =>
  path.split('.').reduce((acc: unknown, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);

const formatValue = (v: unknown, unit?: string): string | undefined => {
  if (v == null) return undefined;
  if (typeof v === 'boolean') return v ? '异常' : '未见异常';
  if (typeof v === 'number' && Number.isFinite(v)) {
    const text = Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
    return unit ? `${text} ${unit}` : text;
  }
  const s = String(v).trim();
  if (!s || EMPTY_MARKERS.has(s)) return undefined;
  return s;
};

const categoryLabelOf = (categoryId: ScreeningCatalogItem['category']): string =>
  DIABETES_INDICATOR_CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;

const screeningValueForItem = (
  item: ScreeningCatalogItem,
  screening: DiabetesScreeningRecord | null
): { value?: string; hasScreening: boolean } => {
  if (!screening || !item.screeningFields?.length) return { hasScreening: false };

  const parts: string[] = [];
  let hasScreening = false;

  if (item.id === 'glucose_fasting') {
    const fasting =
      num(screening.fastingGlucose) ??
      (screening.glucoseType === 'fasting' ? num(screening.glucoseValue) : undefined);
    if (fasting != null) {
      hasScreening = true;
      parts.push(`空腹 ${formatValue(fasting, item.unit)}`);
    }
  }

  if (item.id === 'glucose_postprandial') {
    const post =
      num(screening.postprandialRandomGlucose) ??
      (screening.glucoseType === 'postprandial' ? num(screening.glucoseValue) : undefined);
    if (post != null) {
      hasScreening = true;
      parts.push(`餐后2h ${formatValue(post, item.unit)}`);
    }
  }

  if (item.id === 'arteriosclerosis') {
    const abi = screening.abi ?? screening.rightABI ?? screening.leftABI;
    const pwv = screening.pwv ?? screening.rightBaPWV ?? screening.leftBaPWV ?? screening.cfPWV;
    if (abi != null) {
      hasScreening = true;
      parts.push(`ABI ${formatValue(abi)}`);
    }
    if (pwv != null) {
      hasScreening = true;
      parts.push(`PWV ${formatValue(pwv, 'cm/s')}`);
    }
    if (hasText(screening.arteriosclerosisConclusion)) {
      hasScreening = true;
      parts.push(String(screening.arteriosclerosisConclusion).trim());
    }
  }

  if (item.id === 'fundus') {
    const eyes = [screening.rightEyeAssessment, screening.leftEyeAssessment, screening.fundusResult]
      .filter((v) => hasText(v))
      .map((v) => String(v).trim());
    if (eyes.length) {
      hasScreening = true;
      parts.push(eyes.join('；'));
    }
  }

  if (item.id === 'ecg') {
    const ecg = screening.ecgDiagnosisHint || screening.ecgResult;
    if (hasText(ecg)) {
      hasScreening = true;
      parts.push(String(ecg).trim());
    } else if (screening.ecgHeartRate != null) {
      hasScreening = true;
      parts.push(`心率 ${screening.ecgHeartRate} 次/分`);
    }
  }

  if (item.id === 'body_composition') {
    const bcParts: string[] = [];
    if (screening.bmi != null) bcParts.push(`BMI ${formatValue(screening.bmi)}`);
    if (screening.bodyFatRate != null) bcParts.push(`体脂率 ${formatValue(screening.bodyFatRate, '%')}`);
    if (screening.visceralFatArea != null) bcParts.push(`内脏脂肪 ${formatValue(screening.visceralFatArea, 'cm²')}`);
    if (screening.inbodyScore != null) bcParts.push(`InBody ${formatValue(screening.inbodyScore, '分')}`);
    if (bcParts.length) {
      hasScreening = true;
      parts.push(bcParts.join('；'));
    }
  }

  if (item.id === 'renal') {
    const renalParts = [
      screening.creatinine ? `肌酐 ${screening.creatinine}` : '',
      screening.urea ? `尿素 ${screening.urea}` : '',
      screening.uricAcid ? `尿酸 ${screening.uricAcid}` : '',
    ].filter(Boolean);
    if (renalParts.length) {
      hasScreening = true;
      parts.push(renalParts.join('；'));
    }
  }

  if (item.id === 'lipids') {
    const lipidParts = [
      screening.tc ? `TC ${screening.tc}` : '',
      screening.tg ? `TG ${screening.tg}` : '',
      screening.ldl ? `LDL ${screening.ldl}` : '',
      screening.hdl ? `HDL ${screening.hdl}` : '',
    ].filter(Boolean);
    if (lipidParts.length) {
      hasScreening = true;
      parts.push(lipidParts.join('；'));
    }
  }

  if (item.id === 'urine_routine') {
    if (hasText(screening.urineRoutineSummary)) {
      hasScreening = true;
      parts.push(String(screening.urineRoutineSummary).trim());
    } else if (hasText(screening.urineProtein)) {
      hasScreening = true;
      parts.push(`蛋白 ${screening.urineProtein}`);
    }
  }

  if (item.id === 'hba1c' && screening.hba1c != null) {
    hasScreening = true;
    parts.push(formatValue(screening.hba1c, item.unit) ?? String(screening.hba1c));
  }

  if (!hasScreening && item.screeningFields?.length) {
    for (const field of item.screeningFields) {
      const v = screening[field];
      if (typeof v === 'number' && Number.isFinite(v)) {
        hasScreening = true;
        parts.push(formatValue(v, item.unit) ?? String(v));
      } else if (typeof v === 'boolean') {
        hasScreening = true;
        parts.push(v ? '异常' : '未见异常');
      } else if (hasText(v)) {
        hasScreening = true;
        parts.push(String(v).trim());
      }
    }
  }

  return { value: parts.length ? parts.join('；') : undefined, hasScreening };
};

const checkupValueForItem = (item: ScreeningCatalogItem, record: HealthRecord): { value?: string; hasCheckup: boolean } => {
  if (CHECKUP_ONLY_VITAL_ITEM_IDS.has(item.id)) {
    return getCheckupVitalProfileValue(item.id, record);
  }
  if (!item.checkupPaths?.length) return { hasCheckup: false };

  if (item.id === 'renal') {
    const renal = record.checkup?.labBasic?.renal;
    const parts = [
      renal?.creatinine ? `肌酐 ${renal.creatinine}` : '',
      renal?.urea ? `尿素 ${renal.urea}` : '',
      renal?.ua ? `尿酸 ${renal.ua}` : '',
    ].filter(Boolean);
    if (parts.length) return { value: parts.join('；'), hasCheckup: true };
    return { hasCheckup: false };
  }

  if (item.id === 'lipids') {
    const lipids = record.checkup?.labBasic?.lipids;
    const parts = [
      lipids?.tc ? `TC ${lipids.tc}` : '',
      lipids?.tg ? `TG ${lipids.tg}` : '',
      lipids?.ldl ? `LDL ${lipids.ldl}` : '',
      lipids?.hdl ? `HDL ${lipids.hdl}` : '',
    ].filter(Boolean);
    if (parts.length) return { value: parts.join('；'), hasCheckup: true };
    return { hasCheckup: false };
  }

  if (item.id === 'urine_routine') {
    const urine = record.checkup?.labBasic?.urineRoutine;
    if (hasText(urine?.summary)) return { value: String(urine!.summary).trim(), hasCheckup: true };
    const parts = [
      urine?.protein ? `蛋白 ${urine.protein}` : '',
      urine?.glucose ? `糖 ${urine.glucose}` : '',
      urine?.blood ? `潜血 ${urine.blood}` : '',
    ].filter(Boolean);
    if (parts.length) return { value: parts.join('；'), hasCheckup: true };
    return { hasCheckup: false };
  }

  if (item.id === 'homocysteine' && item.checkupPaths?.length) {
    return firstCheckupPathValue(record, item.checkupPaths, item.unit);
  }

  const lab = record.checkup?.labBasic || {};
  const labExt = lab as Record<string, unknown>;
  const values: string[] = [];
  for (const path of item.checkupPaths) {
    const raw = getByPath(record, path);
    const formatted = formatValue(raw, item.unit);
    if (formatted) values.push(formatted);
  }
  // labBasic 扩展字段（胰岛素/C肽/UACR）
  if (item.id.startsWith('insulin_') || item.id.startsWith('c_peptide_')) {
    const key = item.id === 'insulin_fasting' ? 'insulinFasting'
      : item.id === 'insulin_postprandial' ? 'insulinPostprandial2h'
      : item.id === 'c_peptide_fasting' ? 'cPeptideFasting'
      : 'cPeptidePostprandial2h';
    const formatted = formatValue(labExt[key], item.unit);
    if (formatted) values.push(formatted);
  }
  if (item.id === 'urine_albumin') {
    const formatted = formatValue(labExt.uacr, item.unit);
    if (formatted) values.push(formatted);
  }

  const unique = [...new Set(values)];
  return unique.length
    ? { value: unique.join('；'), hasCheckup: true }
    : { hasCheckup: false };
};

const buildProfileItem = (
  item: ScreeningCatalogItem,
  record: HealthRecord,
  screening: DiabetesScreeningRecord | null,
  observedDate?: string
): DiabetesIndicatorProfileItem => {
  const skipScreening = CHECKUP_ONLY_VITAL_ITEM_IDS.has(item.id);
  const fromScreening = skipScreening
    ? { hasScreening: false as const }
    : screeningValueForItem(item, screening);
  const fromCheckup = checkupValueForItem(item, record);

  const present = fromScreening.hasScreening || fromCheckup.hasCheckup;
  let dataSource: DiabetesIndicatorProfileItem['dataSource'];
  if (skipScreening && fromCheckup.hasCheckup) dataSource = 'checkup';
  else if (fromCheckup.hasCheckup) dataSource = 'checkup';
  else if (fromScreening.hasScreening) dataSource = 'screening';

  const value = mergeProfileValues(fromScreening, fromCheckup, skipScreening);

  const checkupDate = record.profile?.checkupDate?.trim() || observedDate;
  const itemObservedDate = skipScreening && fromCheckup.hasCheckup ? checkupDate : observedDate;

  const retestReminder = present
    ? undefined
    : `建议补测：${item.label}（${item.retestCycle}）— ${item.clinicalMeaning}`;

  return {
    itemId: item.id,
    label: item.label,
    categoryId: item.category,
    categoryLabel: categoryLabelOf(item.category),
    status: present ? 'present' : 'missing',
    value,
    unit: item.unit,
    referenceRange: item.referenceRange,
    clinicalMeaning: item.clinicalMeaning,
    retestCycle: item.retestCycle,
    priority: item.priority,
    dataSource,
    observedDate: present ? itemObservedDate : undefined,
    retestReminder,
  };
};

export interface BuildIndicatorProfileOptions {
  linkedArchiveCheckupId?: string | null;
  archiveCheckupDate?: string;
}

/** 从健康档案 + 专项筛查记录构建归类分项指标档案 */
export const buildDiabetesIndicatorProfile = (
  record: HealthRecord,
  screening: DiabetesScreeningRecord | null,
  options?: BuildIndicatorProfileOptions
): DiabetesIndicatorProfile => {
  const observedDate =
    screening?.screeningDate ||
    screening?.registrationDate ||
    record.profile?.checkupDate ||
    options?.archiveCheckupDate;

  const items = DIABETES_SCREENING_CATALOG.map((item) =>
    buildProfileItem(item, record, screening, observedDate)
  );

  const categories: DiabetesIndicatorCategoryGroup[] = DIABETES_INDICATOR_CATEGORIES.map((cat) => {
    const catItems = items.filter((i) => i.categoryId === cat.id);
    const presentCount = catItems.filter((i) => i.status === 'present').length;
    return {
      categoryId: cat.id,
      label: cat.label,
      items: catItems,
      presentCount,
      missingCount: catItems.length - presentCount,
    };
  }).filter((c) => c.items.length > 0);

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

export const getLatestScreeningFromRecord = (record: HealthRecord): DiabetesScreeningRecord | null => {
  const list = record.diabetesManagement?.screenings || [];
  if (!list.length) return null;
  return [...list].sort((a, b) =>
    (b.screeningDate || b.registrationDate || '').localeCompare(a.screeningDate || a.registrationDate || '')
  )[0];
};
