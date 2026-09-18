/**
 * 体检报告参考范围（专项筛查评估统一标准）
 */
import type { HealthRecord } from '../types';
import { getByPath, profileFmt } from './indicatorProfileValueUtils';
import { formatEgfrDisplayLine, isFemaleGender } from './egfrService';

export const parseLabNumber = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

export const EXAM_REFERENCE_TEXT = {
  bp: '收缩压<140 mmHg 且 舒张压<90 mmHg（≥140/90 为偏高）',
  tc: '2.26–5.6 mmol/L',
  tg: '0.33–2.3 mmol/L',
  hdl: '≥0.9 mmol/L',
  ldl: '1.4–4.11 mmol/L',
  bun: '1.7–8.3 mmol/L',
  creatinineFemale: '41–81 μmol/L',
  creatinineMale: '57–115 μmol/L',
  uaFemale: '142–340 μmol/L',
  uaMale: '202–416 μmol/L',
  homocysteine: '<15 μmol/L',
  tsh: '0.35–4.75 uIU/mL',
  ft3: '3.5–7 pmol/L',
  ft4: '10–22 pmol/L',
  altMale: '0–40 U/L',
  altFemale: '0–31 U/L',
  ast: '0–40 U/L',
  glucoseFasting: '3.9–6.1 mmol/L',
  hba1c: '<6.0%',
} as const;

type RangeResult = { abnormal: boolean; note?: string };

const inRange = (v: number, min?: number, max?: number): boolean => {
  if (min != null && v < min) return false;
  if (max != null && v > max) return false;
  return true;
};

export const evaluateExamLabItem = (
  itemId: string,
  raw: unknown,
  gender?: string
): RangeResult | undefined => {
  const v = parseLabNumber(raw);
  if (v == null) return undefined;
  const female = isFemaleGender(gender);

  switch (itemId) {
    case 'lipid_tc':
      return inRange(v, 2.26, 5.6)
        ? { abnormal: false }
        : { abnormal: true, note: v < 2.26 ? '低于参考范围' : '高于参考范围' };
    case 'lipid_tg':
      return inRange(v, 0.33, 2.3)
        ? { abnormal: false }
        : { abnormal: true, note: v < 0.33 ? '低于参考范围' : '高于参考范围' };
    case 'lipid_hdl':
      return v >= 0.9 ? { abnormal: false } : { abnormal: true, note: '低于参考范围' };
    case 'lipid_ldl':
      return inRange(v, 1.4, 4.11)
        ? { abnormal: false }
        : { abnormal: true, note: v < 1.4 ? '低于参考范围' : '高于参考范围' };
    case 'renal_bun':
      return inRange(v, 1.7, 8.3)
        ? { abnormal: false }
        : { abnormal: true, note: v < 1.7 ? '低于参考范围' : '高于参考范围' };
    case 'renal_creatinine': {
      const min = female ? 41 : 57;
      const max = female ? 81 : 115;
      return inRange(v, min, max)
        ? { abnormal: false }
        : { abnormal: true, note: v < min ? '低于参考范围' : '高于参考范围' };
    }
    case 'renal_ua': {
      const min = female ? 142 : 202;
      const max = female ? 340 : 416;
      return inRange(v, min, max)
        ? { abnormal: false }
        : { abnormal: true, note: v < min ? '低于参考范围' : '高于参考范围' };
    }
    case 'homocysteine':
      return v < 15 ? { abnormal: false } : { abnormal: true, note: '高于参考范围' };
    case 'thyroid_tsh':
      return inRange(v, 0.35, 4.75)
        ? { abnormal: false }
        : { abnormal: true, note: v < 0.35 ? '低于参考范围' : '高于参考范围' };
    case 'thyroid_ft3':
      return inRange(v, 3.5, 7)
        ? { abnormal: false }
        : { abnormal: true, note: v < 3.5 ? '低于参考范围' : '高于参考范围' };
    case 'thyroid_ft4':
      return inRange(v, 10, 22)
        ? { abnormal: false }
        : { abnormal: true, note: v < 10 ? '低于参考范围' : '高于参考范围' };
    case 'liver_alt': {
      const max = female ? 31 : 40;
      return v <= max ? { abnormal: false } : { abnormal: true, note: '高于参考范围' };
    }
    case 'liver_ast':
      return v <= 40 ? { abnormal: false } : { abnormal: true, note: '高于参考范围' };
    case 'glucose_fasting':
      return inRange(v, 3.9, 6.1)
        ? { abnormal: false }
        : { abnormal: true, note: v < 3.9 ? '低于参考范围' : '高于参考范围' };
    case 'hba1c':
      return v < 6.0 ? { abnormal: false } : { abnormal: true, note: '高于参考范围' };
    default:
      return undefined;
  }
};

const withNote = (value: string, eval_?: RangeResult): string => {
  if (!eval_?.abnormal || !eval_.note) return value;
  return `${value}（${eval_.note}）`;
};

/** 单项化验值展示（含参考范围判定） */
export const formatExamLabValue = (
  itemId: string,
  raw: unknown,
  unit: string | undefined,
  gender?: string,
  age?: number
): string | undefined => {
  const v = parseLabNumber(raw);
  if (v == null) return profileFmt(raw, unit);

  const eval_ = evaluateExamLabItem(itemId, v, gender);
  const formatted = profileFmt(v, unit) ?? String(v);

  if (itemId === 'renal_creatinine') {
    const base = withNote(formatted, eval_);
    const egfr = formatEgfrDisplayLine(v, age, gender);
    return egfr ? `${base}；${egfr}` : base;
  }

  return withNote(formatted, eval_);
};

const ITEM_CHECKUP_PATH: Record<string, string[]> = {
  lipid_tc: ['checkup.labBasic.lipids.tc'],
  lipid_tg: ['checkup.labBasic.lipids.tg'],
  lipid_hdl: ['checkup.labBasic.lipids.hdl'],
  lipid_ldl: ['checkup.labBasic.lipids.ldl'],
  renal_bun: ['checkup.labBasic.renal.urea'],
  renal_creatinine: ['checkup.labBasic.renal.creatinine'],
  renal_ua: ['checkup.labBasic.renal.ua'],
  homocysteine: ['checkup.labBasic.homocysteine', 'checkup.optional.homocysteine'],
  thyroid_tsh: ['checkup.labBasic.thyroidFunction.tsh'],
  thyroid_ft3: ['checkup.labBasic.thyroidFunction.t3', 'riskModelExtras.ft3'],
  thyroid_ft4: ['checkup.labBasic.thyroidFunction.t4', 'riskModelExtras.ft4'],
  liver_alt: ['checkup.labBasic.liver.alt'],
  liver_ast: ['checkup.labBasic.liver.ast'],
  glucose_fasting: ['checkup.labBasic.glucose.fasting'],
  hba1c: ['checkup.labBasic.hba1c', 'checkup.optional.hba1c'],
};

const ITEM_UNIT: Record<string, string | undefined> = {
  lipid_tc: 'mmol/L',
  lipid_tg: 'mmol/L',
  lipid_hdl: 'mmol/L',
  lipid_ldl: 'mmol/L',
  renal_bun: 'mmol/L',
  renal_creatinine: 'μmol/L',
  renal_ua: 'μmol/L',
  homocysteine: 'μmol/L',
  thyroid_tsh: 'uIU/mL',
  thyroid_ft3: 'pmol/L',
  thyroid_ft4: 'pmol/L',
  liver_alt: 'U/L',
  liver_ast: 'U/L',
  glucose_fasting: 'mmol/L',
  hba1c: '%',
};

export const getExamLabProfileValue = (
  itemId: string,
  record: HealthRecord
): { value?: string; hasCheckup: boolean } => {
  const paths = ITEM_CHECKUP_PATH[itemId];
  if (!paths?.length) return { hasCheckup: false };

  for (const p of paths) {
    const raw = getByPath(record, p);
    if (raw == null || String(raw).trim() === '') continue;
    const value = formatExamLabValue(
      itemId,
      raw,
      ITEM_UNIT[itemId],
      record.profile?.gender,
      record.profile?.age
    );
    if (value) return { value, hasCheckup: true };
  }
  return { hasCheckup: false };
};

/** 专项筛查 catalog 中仅看最近一次体检的单项 ID */
export const CHECKUP_ONLY_EXAM_ITEM_IDS = new Set([
  'office_bp',
  'lipid_tc',
  'lipid_tg',
  'lipid_hdl',
  'lipid_ldl',
  'glucose_fasting',
  'hba1c',
  'renal_bun',
  'renal_creatinine',
  'renal_ua',
  'homocysteine',
  'liver_alt',
  'liver_ast',
  'thyroid_tsh',
  'thyroid_ft3',
  'thyroid_ft4',
]);

export const formatExamItemFromScreening = (
  itemId: string,
  screening: Record<string, unknown> | null | undefined,
  screeningFields: readonly string[] | undefined,
  record: HealthRecord
): { value?: string; hasScreening: boolean } => {
  if (!screening || !screeningFields?.length) return { hasScreening: false };
  for (const field of screeningFields) {
    const raw = screening[field];
    if (raw == null || String(raw).trim() === '') continue;
    const value = formatExamLabValue(
      itemId,
      raw,
      ITEM_UNIT[itemId],
      record.profile?.gender,
      record.profile?.age
    );
    if (value) return { value, hasScreening: true };
  }
  return { hasScreening: false };
};
