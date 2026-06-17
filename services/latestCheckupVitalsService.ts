/**
 * 血糖 / 血压 / 血脂：仅取自当前健康档案中的最近一次体检（checkup），
 * 严格按参考范围判定异常（不合并专项筛查、问卷史、riskModelExtras 等）。
 */
import type { HealthRecord } from '../types';

export const parseCheckupNumber = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

/** 最近一次体检日期（档案 profile.checkupDate） */
export const getLatestCheckupDate = (record: HealthRecord): string | undefined =>
  record.profile?.checkupDate?.trim() || undefined;

export interface LatestCheckupGlucose {
  fasting?: number;
  hba1c?: number;
  checkupDate?: string;
}

export interface LatestCheckupBloodPressure {
  sbp?: number;
  dbp?: number;
  checkupDate?: string;
}

export interface LatestCheckupLipids {
  tc?: number;
  tg?: number;
  ldl?: number;
  hdl?: number;
  checkupDate?: string;
}

/** 仅 checkup.labBasic / checkup.optional，不含 riskModelExtras 与专项筛查 */
export const getLatestCheckupGlucose = (record: HealthRecord): LatestCheckupGlucose => {
  const checkupDate = getLatestCheckupDate(record);
  return {
    checkupDate,
    fasting: parseCheckupNumber(record.checkup?.labBasic?.glucose?.fasting),
    hba1c:
      parseCheckupNumber(record.checkup?.labBasic?.hba1c) ??
      parseCheckupNumber(record.checkup?.optional?.hba1c),
  };
};

export const getLatestCheckupBloodPressure = (record: HealthRecord): LatestCheckupBloodPressure => {
  const checkupDate = getLatestCheckupDate(record);
  return {
    checkupDate,
    sbp: parseCheckupNumber(record.checkup?.basics?.sbp),
    dbp: parseCheckupNumber(record.checkup?.basics?.dbp),
  };
};

export const getLatestCheckupLipids = (record: HealthRecord): LatestCheckupLipids => {
  const checkupDate = getLatestCheckupDate(record);
  const lipids = record.checkup?.labBasic?.lipids;
  return {
    checkupDate,
    tc: parseCheckupNumber(lipids?.tc),
    tg: parseCheckupNumber(lipids?.tg),
    ldl: parseCheckupNumber(lipids?.ldl),
    hdl: parseCheckupNumber(lipids?.hdl),
  };
};

/** 参考范围（与专项指标档案 catalog 一致） */
export const GLUCOSE_REFERENCE = {
  fastingNormalMax: 6.0, // mmol/L，<6.1 为正常
  fastingPrediabetesMin: 6.1,
  fastingDiabetesMin: 7.0,
  hba1cNormalMax: 5.9, // %，<6.0
  hba1cPrediabetesMin: 6.0,
  hba1cDiabetesMin: 6.5,
} as const;

export const BP_REFERENCE = {
  /** 正常：<120 且 <80 */
  normalSbpMax: 120,
  normalDbpMax: 80,
  /** 正常高值 / 偏高：≥120 和/或 ≥80（参考 <120/<80） */
  elevatedSbpMin: 120,
  elevatedDbpMin: 80,
  stage1SbpMin: 140,
  stage1DbpMin: 90,
  stage2SbpMin: 160,
  stage2DbpMin: 100,
  crisisSbpMin: 180,
  crisisDbpMin: 110,
} as const;

export const LIPID_REFERENCE = {
  tcNormalMax: 5.2,
  tcHighMin: 6.2,
  ldlNormalMax: 3.4,
  ldlBorderMax: 4.1,
  ldlVeryHighMin: 4.9,
  tgNormalMax: 1.7,
  tgHighMin: 2.3,
  tgVeryHighMin: 5.6,
  hdlLowMale: 1.0,
  hdlLowFemale: 1.3,
} as const;

export type GlucoseSeverity = 'normal' | 'prediabetes' | 'diabetes';

export const evaluateLatestCheckupGlucose = (
  g: LatestCheckupGlucose
): { abnormal: boolean; severity: GlucoseSeverity; reasons: string[] } => {
  const reasons: string[] = [];
  let severity: GlucoseSeverity = 'normal';

  const bump = (next: GlucoseSeverity, reason: string) => {
    reasons.push(reason);
    const rank: Record<GlucoseSeverity, number> = { normal: 0, prediabetes: 1, diabetes: 2 };
    if (rank[next] > rank[severity]) severity = next;
  };

  if (g.fasting != null) {
    if (g.fasting >= GLUCOSE_REFERENCE.fastingDiabetesMin) {
      bump('diabetes', `空腹血糖 ${g.fasting} mmol/L（参考 <6.1，≥7.0 为糖尿病切点）`);
    } else if (g.fasting >= GLUCOSE_REFERENCE.fastingPrediabetesMin) {
      bump('prediabetes', `空腹血糖 ${g.fasting} mmol/L（参考 <6.1 mmol/L）`);
    }
  }

  if (g.hba1c != null) {
    if (g.hba1c >= GLUCOSE_REFERENCE.hba1cDiabetesMin) {
      bump('diabetes', `HbA1c ${g.hba1c}%（参考 <6.0%，≥6.5% 为糖尿病切点）`);
    } else if (g.hba1c >= GLUCOSE_REFERENCE.hba1cPrediabetesMin) {
      bump('prediabetes', `HbA1c ${g.hba1c}%（参考 <6.0%）`);
    }
  }

  return { abnormal: severity !== 'normal', severity, reasons };
};

export type BloodPressureSeverity = 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis';

export const evaluateLatestCheckupBloodPressure = (
  bp: LatestCheckupBloodPressure
): { abnormal: boolean; severity: BloodPressureSeverity; reasons: string[] } => {
  const reasons: string[] = [];
  let severity: BloodPressureSeverity = 'normal';
  const { sbp, dbp } = bp;

  if (sbp == null && dbp == null) {
    return { abnormal: false, severity: 'normal', reasons: [] };
  }

  const bump = (next: BloodPressureSeverity, reason: string) => {
    reasons.push(reason);
    const rank: Record<BloodPressureSeverity, number> = {
      normal: 0,
      elevated: 1,
      stage1: 2,
      stage2: 3,
      crisis: 4,
    };
    if (rank[next] > rank[severity]) severity = next;
  };

  const r = BP_REFERENCE;
  if ((sbp != null && sbp >= r.crisisSbpMin) || (dbp != null && dbp >= r.crisisDbpMin)) {
    bump('crisis', `血压 ${sbp ?? '—'}/${dbp ?? '—'} mmHg（≥180/110 mmHg）`);
  } else if ((sbp != null && sbp >= r.stage2SbpMin) || (dbp != null && dbp >= r.stage2DbpMin)) {
    bump('stage2', `血压 ${sbp}/${dbp} mmHg（≥160/100 mmHg，参考 <140/90）`);
  } else if ((sbp != null && sbp >= r.stage1SbpMin) || (dbp != null && dbp >= r.stage1DbpMin)) {
    bump('stage1', `血压 ${sbp}/${dbp} mmHg（≥140/90 mmHg，参考 <140/90）`);
  } else if ((sbp != null && sbp >= r.elevatedSbpMin) || (dbp != null && dbp >= r.elevatedDbpMin)) {
    bump('elevated', `血压 ${sbp}/${dbp} mmHg（120–139/80–89 mmHg，参考 <120/80）`);
  }

  return { abnormal: severity !== 'normal', severity, reasons };
};

export type LipidSeverity =
  | 'normal'
  | 'borderline'
  | 'hypercholesterolemia'
  | 'hypertriglyceridemia'
  | 'mixed'
  | 'very_high_risk';

export const evaluateLatestCheckupLipids = (
  lipids: LatestCheckupLipids,
  gender?: string
): { abnormal: boolean; severity: LipidSeverity; reasons: string[] } => {
  const reasons: string[] = [];
  let severity: LipidSeverity = 'normal';
  const { tc, tg, ldl, hdl } = lipids;
  const r = LIPID_REFERENCE;
  const hdlLow = /女/.test(gender || '') ? r.hdlLowFemale : r.hdlLowMale;

  const bump = (next: LipidSeverity, reason: string) => {
    reasons.push(reason);
    const rank: Record<LipidSeverity, number> = {
      normal: 0,
      borderline: 1,
      hypercholesterolemia: 2,
      hypertriglyceridemia: 2,
      mixed: 3,
      very_high_risk: 4,
    };
    if (rank[next] > rank[severity]) severity = next;
  };

  const hasAny = tc != null || tg != null || ldl != null || hdl != null;
  if (!hasAny) return { abnormal: false, severity: 'normal', reasons: [] };

  const highChol = (ldl != null && ldl >= r.ldlBorderMax) || (tc != null && tc >= r.tcHighMin);
  const highTg = tg != null && tg >= r.tgHighMin;
  const veryHigh = (ldl != null && ldl >= r.ldlVeryHighMin) || (tg != null && tg >= r.tgVeryHighMin);
  const borderChol =
    (ldl != null && ldl >= r.ldlNormalMax && ldl < r.ldlBorderMax) ||
    (tc != null && tc >= r.tcNormalMax && tc < r.tcHighMin);
  const borderTg = tg != null && tg >= r.tgNormalMax && tg < r.tgHighMin;

  if (veryHigh) {
    bump('very_high_risk', `LDL-C≥${r.ldlVeryHighMin} 或 TG≥${r.tgVeryHighMin} mmol/L（参考 LDL<3.4，TG<1.7）`);
  }
  if (highChol && highTg) {
    bump('mixed', `混合型血脂异常（参考 TC<5.2，LDL-C<3.4，TG<1.7 mmol/L）`);
  } else if (highChol) {
    bump(
      'hypercholesterolemia',
      `胆固醇升高（参考 TC<${r.tcNormalMax}，LDL-C<${r.ldlNormalMax} mmol/L）`
    );
  } else if (highTg) {
    bump('hypertriglyceridemia', `甘油三酯升高（参考 TG<${r.tgNormalMax} mmol/L）`);
  }

  if (borderChol || borderTg) {
    bump('borderline', `血脂边缘升高（参考 TC<${r.tcNormalMax}，LDL-C<${r.ldlNormalMax}，TG<${r.tgNormalMax} mmol/L）`);
  }

  if (hdl != null && hdl < hdlLow) {
    bump('borderline', `HDL-C ${hdl} mmol/L（参考 男≥${r.hdlLowMale}，女≥${r.hdlLowFemale}）`);
  }

  return { abnormal: severity !== 'normal', severity, reasons };
};

const BP_PROFILE_NOTES: Record<BloodPressureSeverity, string | undefined> = {
  normal: undefined,
  elevated: '正常高值，参考 <120/80 mmHg',
  stage1: '1级高血压，参考 <140/90 mmHg',
  stage2: '2级高血压，参考 <140/90 mmHg',
  crisis: '高血压危象，参考 <180/110 mmHg',
};

const GLUCOSE_PROFILE_NOTES: Record<GlucoseSeverity, string | undefined> = {
  normal: undefined,
  prediabetes: '空腹/HbA1c 达糖尿病前期切点',
  diabetes: '空腹/HbA1c 达糖尿病切点',
};

const LIPID_PROFILE_NOTES: Record<LipidSeverity, string | undefined> = {
  normal: undefined,
  borderline: '血脂边缘升高',
  hypercholesterolemia: '胆固醇升高',
  hypertriglyceridemia: '甘油三酯升高',
  mixed: '混合型血脂异常',
  very_high_risk: '极高危血脂异常',
};

export const formatLatestCheckupLipidsSummary = (lipids: LatestCheckupLipids): string | undefined => {
  const parts = [
    lipids.tc != null && `TC ${lipids.tc}`,
    lipids.tg != null && `TG ${lipids.tg}`,
    lipids.ldl != null && `LDL ${lipids.ldl}`,
    lipids.hdl != null && `HDL ${lipids.hdl}`,
  ].filter(Boolean);
  return parts.length ? `${parts.join(' / ')} mmol/L` : undefined;
};

/** 专项指标档案中「仅看最近一次体检」的项目 ID */
export const CHECKUP_ONLY_VITAL_ITEM_IDS = new Set([
  'office_bp',
  'lipids',
  'lipids_panel',
  'glucose_fasting',
  'glucose_hba1c',
  'glucose_metabolism',
]);

export const formatLatestCheckupGlucoseSummary = (g: LatestCheckupGlucose): string | undefined => {
  const parts: string[] = [];
  if (g.fasting != null) parts.push(`空腹 ${g.fasting} mmol/L`);
  if (g.hba1c != null) parts.push(`HbA1c ${g.hba1c}%`);
  return parts.length ? parts.join('；') : undefined;
};

export const formatLatestCheckupBpSummary = (bp: LatestCheckupBloodPressure): string | undefined => {
  if (bp.sbp == null && bp.dbp == null) return undefined;
  return `${bp.sbp ?? '—'}/${bp.dbp ?? '—'} mmHg`;
};

/** 分项指标档案：仅最近一次体检 + 参考范围判定说明 */
export const getCheckupVitalProfileValue = (
  itemId: string,
  record: HealthRecord
): { value?: string; hasCheckup: boolean } => {
  if (itemId === 'office_bp') {
    const bp = getLatestCheckupBloodPressure(record);
    const value = formatLatestCheckupBpSummary(bp);
    if (!value) return { hasCheckup: false };
    const eval_ = evaluateLatestCheckupBloodPressure(bp);
    const note = BP_PROFILE_NOTES[eval_.severity];
    const suffix = eval_.abnormal && note ? `（${note}）` : '';
    return { value: value + suffix, hasCheckup: true };
  }
  if (itemId === 'lipids' || itemId === 'lipids_panel') {
    const lipids = getLatestCheckupLipids(record);
    const value = formatLatestCheckupLipidsSummary(lipids);
    if (!value) return { hasCheckup: false };
    const eval_ = evaluateLatestCheckupLipids(lipids, record.profile?.gender);
    const note = LIPID_PROFILE_NOTES[eval_.severity];
    const suffix = eval_.abnormal && note ? `（${note}）` : '';
    return { value: value + suffix, hasCheckup: true };
  }
  if (itemId === 'glucose_fasting') {
    const g = getLatestCheckupGlucose(record);
    if (g.fasting == null) return { hasCheckup: false };
    const eval_ = evaluateLatestCheckupGlucose(g);
    const note = GLUCOSE_PROFILE_NOTES[eval_.severity];
    const suffix = eval_.abnormal && note ? `（${note}）` : '';
    return { value: `空腹 ${g.fasting} mmol/L${suffix}`, hasCheckup: true };
  }
  if (itemId === 'glucose_hba1c') {
    const g = getLatestCheckupGlucose(record);
    if (g.hba1c == null) return { hasCheckup: false };
    const eval_ = evaluateLatestCheckupGlucose(g);
    const note = GLUCOSE_PROFILE_NOTES[eval_.severity];
    const suffix = eval_.abnormal && note ? `（${note}）` : '';
    return { value: `HbA1c ${g.hba1c}%${suffix}`, hasCheckup: true };
  }
  if (itemId === 'glucose_metabolism') {
    const g = getLatestCheckupGlucose(record);
    const value = formatLatestCheckupGlucoseSummary(g);
    if (!value) return { hasCheckup: false };
    const eval_ = evaluateLatestCheckupGlucose(g);
    const note = GLUCOSE_PROFILE_NOTES[eval_.severity];
    const suffix = eval_.abnormal && note ? `（${note}）` : '';
    return { value: value + suffix, hasCheckup: true };
  }
  return { hasCheckup: false };
};
