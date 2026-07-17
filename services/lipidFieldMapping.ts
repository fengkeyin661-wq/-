/**
 * 血脂异常专项：Excel 列名固定映射 + AI 解析字段指南
 */
import type { HealthRecord, LipidScreeningRecord } from '../types';
import { formatCheckupId } from './checkupIdUtils';
import { parseMappingNumber } from './diabetesFieldMapping';

export const LIPID_AI_FIELD_GUIDE = `
【基础血脂】总胆固醇TC、甘油三酯TG、低密度脂蛋白LDL-C、高密度脂蛋白HDL-C、非HDL-C
【进阶脂代谢】载脂蛋白B ApoB、载脂蛋白A1 ApoA1、脂蛋白(a) Lp(a)、小而密LDL sdLDL
【心血管风险】超敏CRP hs-CRP、同型半胱氨酸Hcy、颈动脉彩超/IMT/斑块、心电图、ABI
【合并监测】空腹血糖、HbA1c、血压、ALT/AST、肌酐、UACR
【继发性排查】TSH、尿蛋白
`.trim();

type ScreeningKey = keyof LipidScreeningRecord;

interface ColumnRule {
  exact?: string[];
  patterns?: RegExp[];
  field: ScreeningKey;
  valueType: 'number' | 'string';
}

const normalizeHeader = (h: string): string =>
  String(h ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/[：:]/g, '');

const isEmptyCell = (v: unknown): boolean => {
  if (v == null) return true;
  const s = String(v).trim();
  return !s || /^(未查|无|正常|-+|—|\/|NA|N\/A)$/i.test(s);
};

const parseString = (v: unknown): string | undefined => {
  if (isEmptyCell(v)) return undefined;
  return String(v).trim();
};

const setIfAbsent = (
  obj: Record<string, unknown>,
  key: string,
  value: unknown,
  mode: 'fill_gaps' | 'overwrite'
): void => {
  if (value == null || value === '') return;
  if (mode === 'fill_gaps' && obj[key] != null && obj[key] !== '') return;
  obj[key] = value;
};

export const LIPID_EXCEL_COLUMN_RULES: ColumnRule[] = [
  { exact: ['登记日期', '筛查日期', '检查日期'], field: 'registrationDate', valueType: 'string' },
  { exact: ['体检次数'], field: 'checkupCount', valueType: 'number' },
  { exact: ['检查状态'], field: 'checkStatus', valueType: 'string' },
  { exact: ['身份证号', '身份证'], field: 'idCard', valueType: 'string' },
  { exact: ['联系电话', '电话', '手机号'], field: 'screeningPhone', valueType: 'string' },
  { patterns: [/^总胆固醇$/, /^TC$/i], field: 'tc', valueType: 'string' },
  { patterns: [/^甘油三酯$/, /^TG$/i], field: 'tg', valueType: 'string' },
  { patterns: [/^低密度脂蛋白$/, /^LDL-C?$/i], field: 'ldl', valueType: 'string' },
  { patterns: [/^高密度脂蛋白$/, /^HDL-C?$/i], field: 'hdl', valueType: 'string' },
  { patterns: [/^非HDL-C$/, /^非高密度脂蛋白$/], field: 'nonHdl', valueType: 'string' },
  { patterns: [/^载脂蛋白B$/, /^ApoB$/i], field: 'apoB', valueType: 'string' },
  { patterns: [/^载脂蛋白A1$/, /^ApoA1$/i], field: 'apoA1', valueType: 'string' },
  { patterns: [/^脂蛋白\(a\)$/, /^Lp\(a\)$/i], field: 'lpa', valueType: 'string' },
  { patterns: [/^超敏C反应蛋白$/, /^hs-?CRP$/i], field: 'hsCrp', valueType: 'string' },
  { patterns: [/^同型半胱氨酸$/, /^Hcy$/i], field: 'homocysteine', valueType: 'number' },
  { patterns: [/^颈动脉彩超$/, /^颈部血管彩超$/], field: 'carotidUltrasound', valueType: 'string' },
  { patterns: [/^内膜厚度$/, /^IMT$/i], field: 'carotidImt', valueType: 'string' },
  { patterns: [/^颈动脉斑块$/, /^斑块$/], field: 'carotidPlaque', valueType: 'string' },
  { patterns: [/^心电图$/, /^ECG$/i], field: 'ecgResult', valueType: 'string' },
  { patterns: [/^左踝臂指数$/, /^左ABI$/i], field: 'leftABI', valueType: 'number' },
  { patterns: [/^右踝臂指数$/, /^右ABI$/i], field: 'rightABI', valueType: 'number' },
  { patterns: [/^空腹血糖$/, /^FPG$/i], field: 'fastingGlucose', valueType: 'number' },
  { patterns: [/^糖化血红蛋白$/, /^HbA1c$/i], field: 'hba1c', valueType: 'string' },
  { patterns: [/^收缩压$/, /^SBP$/i], field: 'sbp', valueType: 'number' },
  { patterns: [/^舒张压$/, /^DBP$/i], field: 'dbp', valueType: 'number' },
  { patterns: [/^ALT$/i, /^丙氨酸氨基转移酶$/], field: 'alt', valueType: 'string' },
  { patterns: [/^AST$/i, /^天门冬氨酸氨基转移酶$/], field: 'ast', valueType: 'string' },
  { patterns: [/^肌酐$/, /^血肌酐$/], field: 'creatinine', valueType: 'string' },
  { patterns: [/^UACR$/i, /^尿微量白蛋白.?肌酐比(值)?$/], field: 'uacr', valueType: 'string' },
  { patterns: [/^TSH$/i, /^促甲状腺激素$/], field: 'tsh', valueType: 'string' },
  { patterns: [/^尿蛋白$/], field: 'urineProtein', valueType: 'string' },
];

const matchRule = (normalizedHeader: string, rule: ColumnRule): boolean => {
  if (rule.exact?.some((e) => normalizeHeader(e) === normalizedHeader)) return true;
  if (rule.patterns?.some((p) => p.test(normalizedHeader))) return true;
  return false;
};

export interface LipidDirectExcelMappingResult {
  screening: Partial<LipidScreeningRecord>;
  checkupId?: string;
  name?: string;
  gender?: string;
  age?: number;
}

const PROFILE_HEADER_MAP: Record<string, keyof Pick<LipidDirectExcelMappingResult, 'checkupId' | 'name' | 'gender' | 'age'>> = {
  体检编号: 'checkupId',
  编号: 'checkupId',
  姓名: 'name',
  性别: 'gender',
  年龄: 'age',
};

export const applyLipidDirectExcelRowMapping = (
  headers: string[],
  row: unknown[],
  mode: 'fill_gaps' | 'overwrite' = 'fill_gaps'
): LipidDirectExcelMappingResult => {
  const screening: Partial<LipidScreeningRecord> = {};
  const rawColumns: Record<string, string | number> = {};
  const profile: LipidDirectExcelMappingResult = { screening };

  headers.forEach((header, i) => {
    const raw = row[i];
    if (isEmptyCell(raw)) return;
    const label = String(header ?? '').trim() || `列${i + 1}`;
    const norm = normalizeHeader(label);
    rawColumns[label] = typeof raw === 'number' ? raw : String(raw).trim();

    const profileKey = PROFILE_HEADER_MAP[norm] ?? PROFILE_HEADER_MAP[label];
    if (profileKey === 'checkupId') {
      const cid = formatCheckupId(String(raw)) || String(raw).trim();
      if (cid) profile.checkupId = cid;
      return;
    }
    if (profileKey === 'name') {
      profile.name = String(raw).trim();
      return;
    }
    if (profileKey === 'gender') {
      profile.gender = String(raw).trim();
      return;
    }
    if (profileKey === 'age') {
      const n = parseMappingNumber(raw);
      if (n != null) profile.age = Math.round(n);
      return;
    }

    for (const rule of LIPID_EXCEL_COLUMN_RULES) {
      if (!matchRule(norm, rule)) continue;
      const value = rule.valueType === 'number' ? parseMappingNumber(raw) : parseString(raw);
      setIfAbsent(screening as Record<string, unknown>, rule.field, value, mode);
      break;
    }
  });

  screening.rawColumns = rawColumns;
  return profile;
};

export const mergeLipidScreeningParseResults = (
  ai: Partial<LipidScreeningRecord>,
  direct: Partial<LipidScreeningRecord>
): Partial<LipidScreeningRecord> => {
  const merged: Partial<LipidScreeningRecord> = { ...direct, ...ai };
  for (const [k, v] of Object.entries(direct)) {
    if (v == null || v === '') continue;
    const key = k as keyof LipidScreeningRecord;
    if (merged[key] == null || merged[key] === '') {
      (merged as Record<string, unknown>)[key] = v;
    }
  }
  if (direct.rawColumns || ai.rawColumns) {
    merged.rawColumns = { ...direct.rawColumns, ...ai.rawColumns };
  }
  return merged;
};

export const normalizeLipidScreeningRecord = (s: Partial<LipidScreeningRecord>): Partial<LipidScreeningRecord> => {
  if (!s.screeningDate && s.registrationDate) s.screeningDate = s.registrationDate;
  if (!s.activityName) s.activityName = '社区血脂异常专项筛查';
  const hcy = parseMappingNumber(s.homocysteine);
  if (hcy != null) s.homocysteine = hcy;
  return s;
};

export const normalizeLipidHealthRecordFields = (record: HealthRecord): HealthRecord => {
  const extras = { ...(record.riskModelExtras || {}) };
  const lipids = record.checkup?.labBasic?.lipids || {};
  const mapStr = (src: unknown, key: string) => {
    const s = parseString(src);
    if (s && !extras[key]) extras[key] = s;
  };
  mapStr(lipids.tc, 'tc');
  mapStr(lipids.ldl, 'ldl');
  mapStr(extras.apoB, 'apoB');
  mapStr(extras.lpa, 'lpa');
  mapStr(extras.hsCrp, 'hsCrp');
  return { ...record, riskModelExtras: extras };
};
