/** 体检报告分项化验指标（高血压/糖尿病/血脂专项 catalog 共用） */
import { EXAM_REFERENCE_TEXT } from './examReportReferenceService';

export const EXAM_LIPID_ITEMS = [
  {
    id: 'lipid_tc',
    label: '总胆固醇(CHOL)',
    referenceRange: EXAM_REFERENCE_TEXT.tc,
    unit: 'mmol/L',
    screeningFields: ['tc'] as const,
    checkupPaths: ['checkup.labBasic.lipids.tc'],
  },
  {
    id: 'lipid_tg',
    label: '甘油三酯(TG)',
    referenceRange: EXAM_REFERENCE_TEXT.tg,
    unit: 'mmol/L',
    screeningFields: ['tg'] as const,
    checkupPaths: ['checkup.labBasic.lipids.tg'],
  },
  {
    id: 'lipid_hdl',
    label: '高密度脂蛋白(HDL)',
    referenceRange: EXAM_REFERENCE_TEXT.hdl,
    unit: 'mmol/L',
    screeningFields: ['hdl'] as const,
    checkupPaths: ['checkup.labBasic.lipids.hdl'],
  },
  {
    id: 'lipid_ldl',
    label: '低密度脂蛋白(LDL)',
    referenceRange: EXAM_REFERENCE_TEXT.ldl,
    unit: 'mmol/L',
    screeningFields: ['ldl'] as const,
    checkupPaths: ['checkup.labBasic.lipids.ldl'],
  },
] as const;

export const EXAM_RENAL_ITEMS = [
  {
    id: 'renal_bun',
    label: '尿素氮(BUN)',
    referenceRange: EXAM_REFERENCE_TEXT.bun,
    unit: 'mmol/L',
    screeningFields: ['urea'] as const,
    checkupPaths: ['checkup.labBasic.renal.urea'],
  },
  {
    id: 'renal_creatinine',
    label: '肌酐(CREA)',
    referenceRange: `女 ${EXAM_REFERENCE_TEXT.creatinineFemale}；男 ${EXAM_REFERENCE_TEXT.creatinineMale}`,
    unit: 'μmol/L',
    screeningFields: ['creatinine'] as const,
    checkupPaths: ['checkup.labBasic.renal.creatinine'],
  },
  {
    id: 'renal_ua',
    label: '尿酸(UA)',
    referenceRange: `女 ${EXAM_REFERENCE_TEXT.uaFemale}；男 ${EXAM_REFERENCE_TEXT.uaMale}`,
    unit: 'μmol/L',
    screeningFields: ['uricAcid'] as const,
    checkupPaths: ['checkup.labBasic.renal.ua'],
  },
] as const;

export const EXAM_LIVER_ITEMS = [
  {
    id: 'liver_alt',
    label: '谷丙转氨酶(ALT)',
    referenceRange: `男 ${EXAM_REFERENCE_TEXT.altMale}；女 ${EXAM_REFERENCE_TEXT.altFemale}`,
    unit: 'U/L',
    screeningFields: ['alt'] as const,
    checkupPaths: ['checkup.labBasic.liver.alt'],
  },
  {
    id: 'liver_ast',
    label: '谷草转氨酶(AST)',
    referenceRange: EXAM_REFERENCE_TEXT.ast,
    unit: 'U/L',
    screeningFields: ['ast'] as const,
    checkupPaths: ['checkup.labBasic.liver.ast'],
  },
] as const;

export const EXAM_THYROID_ITEMS = [
  {
    id: 'thyroid_tsh',
    label: '促甲状腺素(TSH)',
    referenceRange: EXAM_REFERENCE_TEXT.tsh,
    unit: 'uIU/mL',
    screeningFields: ['tsh'] as const,
    checkupPaths: ['checkup.labBasic.thyroidFunction.tsh'],
  },
  {
    id: 'thyroid_ft3',
    label: '游离三碘甲状腺原氨酸(FT3)',
    referenceRange: EXAM_REFERENCE_TEXT.ft3,
    unit: 'pmol/L',
    screeningFields: ['ft3'] as const,
    checkupPaths: ['checkup.labBasic.thyroidFunction.t3', 'riskModelExtras.ft3'],
  },
  {
    id: 'thyroid_ft4',
    label: '游离四碘甲状腺原氨酸(FT4)',
    referenceRange: EXAM_REFERENCE_TEXT.ft4,
    unit: 'pmol/L',
    screeningFields: ['ft4'] as const,
    checkupPaths: ['checkup.labBasic.thyroidFunction.t4', 'riskModelExtras.ft4'],
  },
] as const;

export const EXAM_GLUCOSE_ITEMS = [
  {
    id: 'glucose_fasting',
    label: '空腹血糖',
    referenceRange: EXAM_REFERENCE_TEXT.glucoseFasting,
    unit: 'mmol/L',
    screeningFields: ['fastingGlucose', 'glucoseValue'] as const,
    checkupPaths: ['checkup.labBasic.glucose.fasting'],
  },
  {
    id: 'hba1c',
    label: '糖化血红蛋白(HbA1c)',
    referenceRange: EXAM_REFERENCE_TEXT.hba1c,
    unit: '%',
    screeningFields: ['hba1c'] as const,
    checkupPaths: ['checkup.labBasic.hba1c', 'checkup.optional.hba1c'],
  },
] as const;

export const EXAM_OFFICE_BP = {
  id: 'office_bp',
  label: '血压',
  referenceRange: EXAM_REFERENCE_TEXT.bp,
  unit: 'mmHg',
  screeningFields: ['sbp', 'dbp'] as const,
  checkupPaths: ['checkup.basics.sbp', 'checkup.basics.dbp'],
} as const;

export const EXAM_HOMOCYSTEINE = {
  id: 'homocysteine',
  label: '同型半胱氨酸',
  referenceRange: EXAM_REFERENCE_TEXT.homocysteine,
  unit: 'μmol/L',
  screeningFields: ['homocysteine'] as const,
  checkupPaths: ['checkup.labBasic.homocysteine', 'checkup.optional.homocysteine'],
} as const;
