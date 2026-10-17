/**
 * 估算肾小球滤过率（eGFR）— CKD-EPI 2021（无种族校正项，仅血肌酐）
 * 参考：Inker LA et al. NEJM 2021;385:1757-1769
 * 中国体检报告血肌酐单位通常为 μmol/L
 */

export const EGFR_NORMAL_MIN = 60;

export interface EgfrResult {
  egfr: number;
  stage: 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5';
  stageLabel: string;
  normal: boolean;
  creatinineUmolL: number;
  age: number;
  isFemale: boolean;
}

export const parseCreatinine = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
};

/** 自动识别 μmol/L（常见 40–150）与 mg/dL（常见 0.5–2.0） */
export const creatinineToMgDl = (raw: number): number => {
  if (raw < 20) return raw;
  return raw / 88.4;
};

export const isFemaleGender = (gender?: string): boolean => /女/.test(gender || '');

export const egfrStage = (egfr: number): EgfrResult['stage'] => {
  if (egfr >= 90) return 'G1';
  if (egfr >= 60) return 'G2';
  if (egfr >= 45) return 'G3a';
  if (egfr >= 30) return 'G3b';
  if (egfr >= 15) return 'G4';
  return 'G5';
};

const STAGE_LABELS: Record<EgfrResult['stage'], string> = {
  G1: '正常或偏高（≥90）',
  G2: '轻度下降（60–89）',
  G3a: '轻中度下降（45–59）',
  G3b: '中重度下降（30–44）',
  G4: '重度下降（15–29）',
  G5: '肾衰竭（<15）',
};

/** CKD-EPI 2021 creatinine-only */
export const calculateEgfr = (
  creatinineRaw: unknown,
  age?: number,
  gender?: string
): EgfrResult | undefined => {
  const raw = parseCreatinine(creatinineRaw);
  if (raw == null) return undefined;

  const ageYears = typeof age === 'number' && Number.isFinite(age) ? Math.round(age) : undefined;
  if (ageYears == null || ageYears < 18 || ageYears > 120) return undefined;

  const female = isFemaleGender(gender);
  const scrMgDl = creatinineToMgDl(raw);
  const kappa = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  const sexCoef = female ? 1.012 : 1;

  const ratio = scrMgDl / kappa;
  const minPart = Math.min(ratio, 1);
  const maxPart = Math.max(ratio, 1);

  const egfr =
    142 *
    Math.pow(minPart, alpha) *
    Math.pow(maxPart, -1.2) *
    Math.pow(0.9938, ageYears) *
    sexCoef;

  const rounded = Math.round(egfr);
  if (!Number.isFinite(rounded) || rounded <= 0) return undefined;

  const stage = egfrStage(rounded);
  return {
    egfr: rounded,
    stage,
    stageLabel: STAGE_LABELS[stage],
    normal: rounded >= EGFR_NORMAL_MIN,
    creatinineUmolL: raw < 20 ? raw * 88.4 : raw,
    age: ageYears,
    isFemale: female,
  };
};

/** 分项指标档案展示行 */
export const formatEgfrDisplayLine = (
  creatinineRaw: unknown,
  age?: number,
  gender?: string
): string | undefined => {
  const result = calculateEgfr(creatinineRaw, age, gender);
  if (!result) return undefined;

  const status = result.normal ? '正常' : '偏低';
  const ref = result.normal ? '参考 ≥60' : '参考 ≥60，当前未达标';
  return `eGFR ${result.egfr} mL/min/1.73m²（${status}，${ref}；${result.stageLabel}）`;
};
