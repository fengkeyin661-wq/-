/**
 * 高血压专项指标：Excel 列名固定映射 + AI 解析字段指南
 */
import type { HealthRecord, HypertensionScreeningRecord } from '../types';
import { formatCheckupId } from './checkupIdUtils';
import { parseMappingNumber } from './diabetesFieldMapping';

export const HYPERTENSION_AI_FIELD_GUIDE = `
【血压与血管】收缩压/舒张压/诊室血压(mmHg)、心率(bpm)、动态血压24h均值/日间/夜间血压、颈动脉彩超/内膜厚度IMT/斑块、心脏彩超/左心室肥厚/LVEF/射血分数、心电图/诊断提示、动态心电图/Holter
【靶器官】肌酐/尿素/肾功能、eGFR、尿微量白蛋白/肌酐比值/UACR、尿蛋白、眼底检查/眼底照相、颅脑CT/头颅CT、同型半胱氨酸/Hcy(μmol/L)
【代谢实验室】总胆固醇TC、甘油三酯TG、LDL-C、HDL-C、空腹血糖/FPG、糖化血红蛋白/HbA1c(%)、钾/钠/氯/钙/电解质、肾素/血管紧张素/醛固酮/RAAS
`.trim();

type ScreeningKey = keyof HypertensionScreeningRecord;

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

const parseBpPair = (
  raw: unknown
): { sbp?: number; dbp?: number } | undefined => {
  if (isEmptyCell(raw)) return undefined;
  const s = String(raw).trim();
  const m = s.match(/(\d{2,3})\s*[\/／]\s*(\d{2,3})/);
  if (m) {
    return { sbp: parseInt(m[1], 10), dbp: parseInt(m[2], 10) };
  }
  return undefined;
};

export const HYPERTENSION_EXCEL_COLUMN_RULES: ColumnRule[] = [
  { exact: ['登记日期', '筛查日期', '检查日期'], field: 'registrationDate', valueType: 'string' },
  { exact: ['体检次数'], field: 'checkupCount', valueType: 'number' },
  { exact: ['检查状态'], field: 'checkStatus', valueType: 'string' },
  { exact: ['身份证号', '身份证'], field: 'idCard', valueType: 'string' },
  { exact: ['联系电话', '电话', '手机号'], field: 'screeningPhone', valueType: 'string' },
  { patterns: [/^收缩压$/, /^SBP$/i, /^高压$/], field: 'sbp', valueType: 'number' },
  { patterns: [/^舒张压$/, /^DBP$/i, /^低压$/], field: 'dbp', valueType: 'number' },
  {
    patterns: [/^血压$/, /^诊室血压$/, /^血压\(mmHg\)$/i],
    field: 'sbp',
    valueType: 'number',
  },
  { patterns: [/^心率(\(bpm\))?$/i, /^脉率$/], field: 'heartRate', valueType: 'number' },
  {
    patterns: [/^24h.*血压$/, /^动态血压$/, /^ABPM$/i, /^动态血压监测$/],
    field: 'abpmSummary',
    valueType: 'string',
  },
  { patterns: [/^日间.*收缩压$/, /^白天.*收缩压$/], field: 'abpmDaySbp', valueType: 'number' },
  { patterns: [/^日间.*舒张压$/, /^白天.*舒张压$/], field: 'abpmDayDbp', valueType: 'number' },
  { patterns: [/^夜间.*收缩压$/], field: 'abpmNightSbp', valueType: 'number' },
  { patterns: [/^夜间.*舒张压$/], field: 'abpmNightDbp', valueType: 'number' },
  { patterns: [/^颈动脉彩超$/, /^颈部血管彩超$/], field: 'carotidUltrasound', valueType: 'string' },
  { patterns: [/^内膜厚度$/, /^IMT$/i, /^颈动脉内膜厚度$/], field: 'carotidImt', valueType: 'string' },
  { patterns: [/^颈动脉斑块$/, /^斑块$/], field: 'carotidPlaque', valueType: 'string' },
  { patterns: [/^心脏彩超$/, /^超声心动图$/], field: 'echoResult', valueType: 'string' },
  { patterns: [/^左心室肥厚$/, /^LVH$/i], field: 'lvh', valueType: 'string' },
  { patterns: [/^射血分数$/, /^EF$/i, /^LVEF$/i], field: 'ejectionFraction', valueType: 'string' },
  { patterns: [/^心电图$/, /^ECG$/i], field: 'ecgResult', valueType: 'string' },
  { patterns: [/^心电图诊断$/, /^心电图结论$/, /^诊断提示$/], field: 'ecgResult', valueType: 'string' },
  { patterns: [/^动态心电图$/, /^Holter$/i], field: 'holterResult', valueType: 'string' },
  { patterns: [/^肌酐$/, /^血肌酐$/], field: 'creatinine', valueType: 'string' },
  { patterns: [/^尿素(氮)?$/, /^BUN$/i], field: 'urea', valueType: 'string' },
  {
    patterns: [/^尿微量白蛋白.?肌酐比(值)?$/, /^UACR$/i, /^尿白蛋白\/肌酐$/],
    field: 'uacr',
    valueType: 'string',
  },
  { patterns: [/^尿蛋白$/], field: 'urineProtein', valueType: 'string' },
  { patterns: [/^眼底检查$/, /^眼底照相$/, /^眼底结果$/], field: 'fundusResult', valueType: 'string' },
  { patterns: [/^颅脑CT$/, /^头颅CT$/, /^脑CT$/], field: 'brainCtResult', valueType: 'string' },
  { patterns: [/^同型半胱氨酸$/, /^Hcy$/i], field: 'homocysteine', valueType: 'number' },
  { patterns: [/^总胆固醇$/, /^TC$/i], field: 'tc', valueType: 'string' },
  { patterns: [/^甘油三酯$/, /^TG$/i], field: 'tg', valueType: 'string' },
  { patterns: [/^低密度脂蛋白$/, /^LDL-C?$/i], field: 'ldl', valueType: 'string' },
  { patterns: [/^高密度脂蛋白$/, /^HDL-C?$/i], field: 'hdl', valueType: 'string' },
  { patterns: [/^空腹血糖$/, /^FPG$/i], field: 'fastingGlucose', valueType: 'number' },
  { patterns: [/^糖化血红蛋白$/, /^HbA1c$/i], field: 'hba1c', valueType: 'string' },
  { patterns: [/^钾$/, /^K\+$/], field: 'potassium', valueType: 'string' },
  { patterns: [/^钠$/, /^Na\+$/], field: 'sodium', valueType: 'string' },
  { patterns: [/^氯$/, /^Cl\-?$/], field: 'chloride', valueType: 'string' },
  { patterns: [/^钙$/, /^Ca$/i], field: 'calcium', valueType: 'string' },
  { patterns: [/^肾素$/], field: 'renin', valueType: 'string' },
  { patterns: [/^血管紧张素$/, /^Ang\s?II$/i], field: 'angiotensin', valueType: 'string' },
  { patterns: [/^醛固酮$/], field: 'aldosterone', valueType: 'string' },
];

const matchRule = (normalizedHeader: string, rule: ColumnRule): boolean => {
  if (rule.exact?.some((e) => normalizeHeader(e) === normalizedHeader)) return true;
  if (rule.patterns?.some((p) => p.test(normalizedHeader))) return true;
  return false;
};

export interface HypertensionDirectExcelMappingResult {
  screening: Partial<HypertensionScreeningRecord>;
  checkupId?: string;
  name?: string;
  gender?: string;
  age?: number;
}

const PROFILE_HEADER_MAP: Record<
  string,
  keyof Pick<HypertensionDirectExcelMappingResult, 'checkupId' | 'name' | 'gender' | 'age'>
> = {
  体检编号: 'checkupId',
  编号: 'checkupId',
  姓名: 'name',
  性别: 'gender',
  年龄: 'age',
};

export const applyHypertensionDirectExcelRowMapping = (
  headers: string[],
  row: unknown[],
  mode: 'fill_gaps' | 'overwrite' = 'fill_gaps'
): HypertensionDirectExcelMappingResult => {
  const screening: Partial<HypertensionScreeningRecord> = {};
  const rawColumns: Record<string, string | number> = {};
  const profile: HypertensionDirectExcelMappingResult = { screening };

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

    const bp = parseBpPair(raw);
    if (bp && (/血压/.test(label) || norm === '血压')) {
      setIfAbsent(screening as Record<string, unknown>, 'sbp', bp.sbp, mode);
      setIfAbsent(screening as Record<string, unknown>, 'dbp', bp.dbp, mode);
      return;
    }

    for (const rule of HYPERTENSION_EXCEL_COLUMN_RULES) {
      if (!matchRule(norm, rule)) continue;
      const value = rule.valueType === 'number' ? parseMappingNumber(raw) : parseString(raw);
      setIfAbsent(screening as Record<string, unknown>, rule.field, value, mode);
      break;
    }
  });

  screening.rawColumns = rawColumns;
  return profile;
};

export const mergeHypertensionScreeningParseResults = (
  ai: Partial<HypertensionScreeningRecord>,
  direct: Partial<HypertensionScreeningRecord>
): Partial<HypertensionScreeningRecord> => {
  const merged: Partial<HypertensionScreeningRecord> = { ...direct, ...ai };
  for (const [k, v] of Object.entries(direct)) {
    if (v == null || v === '') continue;
    const key = k as keyof HypertensionScreeningRecord;
    if (merged[key] == null || merged[key] === '') {
      (merged as Record<string, unknown>)[key] = v;
    }
  }
  if (direct.rawColumns || ai.rawColumns) {
    merged.rawColumns = { ...direct.rawColumns, ...ai.rawColumns };
  }
  return merged;
};

export const normalizeHypertensionScreeningRecord = (
  s: Partial<HypertensionScreeningRecord>
): Partial<HypertensionScreeningRecord> => {
  if (!s.screeningDate && s.registrationDate) s.screeningDate = s.registrationDate;
  if (!s.activityName) s.activityName = '社区高血压专项筛查';

  const hba1cNum = parseMappingNumber(s.hba1c);
  if (hba1cNum != null) s.hba1c = hba1cNum;

  const hcyNum = parseMappingNumber(s.homocysteine);
  if (hcyNum != null) s.homocysteine = hcyNum;

  return s;
};

export const normalizeHypertensionHealthRecordFields = (record: HealthRecord): HealthRecord => {
  const extras = { ...(record.riskModelExtras || {}) };
  const lab = record.checkup?.labBasic || {};
  const opt = record.checkup?.optional || {};
  const basics = record.checkup?.basics || {};
  const labExt = lab as Record<string, unknown>;

  const mapNum = (src: unknown, key: string) => {
    const n = parseMappingNumber(src);
    if (n != null && extras[key] == null) extras[key] = n;
  };
  const mapStr = (src: unknown, key: string) => {
    const s = parseString(src);
    if (s && !extras[key]) extras[key] = s;
  };

  mapNum(basics.sbp, 'officeSbp');
  mapNum(basics.dbp, 'officeDbp');
  mapStr(opt.carotidUltrasound, 'carotidUltrasound');
  mapStr(opt.heartUltrasound, 'echoResult');
  mapStr(opt.fundusPhoto, 'fundusResult');
  mapStr(opt.ct, 'brainCtResult');
  mapStr(record.checkup?.imagingBasic?.ecg, 'ecgResult');
  mapNum(lab.homocysteine ?? opt.homocysteine, 'homocysteine');
  mapStr(labExt.uacr, 'uacr');
  mapStr(extras.abpmSummary, 'abpmSummary');
  mapStr(extras.holterResult, 'holterResult');
  mapStr(extras.renin, 'renin');
  mapStr(extras.angiotensin, 'angiotensin');
  mapStr(extras.aldosterone, 'aldosterone');
  mapNum(extras.potassium ?? labExt.potassium, 'potassium');
  mapNum(extras.sodium ?? labExt.sodium, 'sodium');
  mapNum(extras.chloride ?? labExt.chloride, 'chloride');
  mapNum(extras.calcium ?? labExt.calcium, 'calcium');

  return { ...record, riskModelExtras: extras };
};
