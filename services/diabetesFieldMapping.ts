/**
 * 糖尿病专项指标：Excel 列名固定映射 + AI 解析字段指南
 */
import type { DiabetesScreeningRecord, HealthRecord } from '../types';
import { formatCheckupId } from './checkupIdUtils';

export const DIABETES_AI_FIELD_GUIDE = `
【糖代谢】空腹血糖(mmol/L)、餐后2小时血糖(mmol/L)、餐后随机血糖(同餐后2h)、糖化血红蛋白/HbA1c(%)
【胰岛功能】胰岛素测定空腹(μIU/mL)、胰岛素测定餐后2h、C肽测定空腹(ng/mL)、C肽测定餐后2h、脂联素
【肾脏尿液】尿常规+镜检(小结/蛋白/糖/潜血)、尿微量白蛋白/肌酐比值/UACR(mg/g)、肌酐、尿素、尿酸
【血脂代谢】总胆固醇TC、甘油三酯TG、低密度脂蛋白LDL-C、高密度脂蛋白HDL-C、同型半胱氨酸/Hcy(μmol/L)
【大血管】颈动脉彩超/颈部血管彩超、下肢血管彩超/下肢动脉彩超、动脉硬化(ABI/baPWV/cfPWV/结论)
【微血管】眼底数码照相/右眼评估/左眼评估
【心脏】心电图/诊断提示/心率
【神经足部】神经传导速度/NCV、糖尿病神经病变筛查、糖尿病足筛查/10g尼龙丝
【人体成分】InBody：身高体重BMI体脂率内脏脂肪骨骼肌腰臀比评分等
`.trim();

type ScreeningKey = keyof DiabetesScreeningRecord;

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

export const parseMappingNumber = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).replace(/[^\d.\-+eE]/g, '');
  if (!s) return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
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

export const DIABETES_EXCEL_COLUMN_RULES: ColumnRule[] = [
  { exact: ['登记日期', '筛查日期', '检查日期'], field: 'registrationDate', valueType: 'string' },
  { exact: ['体检次数'], field: 'checkupCount', valueType: 'number' },
  { exact: ['检查状态'], field: 'checkStatus', valueType: 'string' },
  { exact: ['身份证号', '身份证'], field: 'idCard', valueType: 'string' },
  { exact: ['联系电话', '电话', '手机号'], field: 'screeningPhone', valueType: 'string' },
  { exact: ['空腹血糖', 'FPG'], field: 'fastingGlucose', valueType: 'number' },
  {
    patterns: [/^餐后2?小时血糖$/, /^餐后2h血糖$/, /^餐后二小时血糖$/, /^2hPG$/, /^餐后血糖$/, /^餐后随机血糖$/],
    field: 'postprandialRandomGlucose',
    valueType: 'number',
  },
  { patterns: [/^糖化血红蛋白$/, /^HbA1c$/i], field: 'hba1c', valueType: 'number' },
  { patterns: [/^糖代谢风险$/], field: 'glucoseMetabolismRisk', valueType: 'string' },
  { patterns: [/^胰岛素.*空腹$/, /^空腹胰岛素$/, /^FINS$/i], field: 'insulinFasting', valueType: 'number' },
  { patterns: [/^胰岛素.*餐后2?h$/, /^餐后2?小时胰岛素$/], field: 'insulinPostprandial2h', valueType: 'number' },
  { patterns: [/^C肽.*空腹$/, /^空腹C肽$/, /^C-P.*空腹$/i], field: 'cPeptideFasting', valueType: 'number' },
  { patterns: [/^C肽.*餐后2?h$/, /^餐后2?小时C肽$/], field: 'cPeptidePostprandial2h', valueType: 'number' },
  { patterns: [/^脂联素$/], field: 'adiponectin', valueType: 'string' },
  { patterns: [/^尿常规(\+镜检)?$/, /^尿液常规$/], field: 'urineRoutineSummary', valueType: 'string' },
  { patterns: [/^尿蛋白$/], field: 'urineProtein', valueType: 'string' },
  {
    patterns: [/^尿微量白蛋白.?肌酐比(值)?$/, /^UACR$/i, /^尿白蛋白\/肌酐$/],
    field: 'uacr',
    valueType: 'string',
  },
  { patterns: [/^肌酐$/, /^血肌酐$/], field: 'creatinine', valueType: 'string' },
  { patterns: [/^尿素(氮)?$/, /^BUN$/i], field: 'urea', valueType: 'string' },
  { patterns: [/^尿酸$/, /^UA$/i], field: 'uricAcid', valueType: 'string' },
  { patterns: [/^总胆固醇$/, /^TC$/i], field: 'tc', valueType: 'string' },
  { patterns: [/^甘油三酯$/, /^TG$/i], field: 'tg', valueType: 'string' },
  { patterns: [/^低密度脂蛋白$/, /^LDL-C?$/i], field: 'ldl', valueType: 'string' },
  { patterns: [/^高密度脂蛋白$/, /^HDL-C?$/i], field: 'hdl', valueType: 'string' },
  { patterns: [/^同型半胱氨酸$/, /^Hcy$/i], field: 'homocysteine', valueType: 'number' },
  { patterns: [/^颈动脉彩超$/, /^颈部血管彩超$/], field: 'carotidUltrasound', valueType: 'string' },
  { patterns: [/^下肢(血管|动脉)彩超$/], field: 'lowerLimbVascularUltrasound', valueType: 'string' },
  { patterns: [/^神经传导速度$/, /^NCV$/i], field: 'ncvResult', valueType: 'string' },
  { patterns: [/^糖尿病神经病变筛查$/, /^神经病变筛查$/], field: 'neuropathyScreening', valueType: 'string' },
  { patterns: [/^糖尿病足筛查$/, /^10g尼龙丝$/], field: 'footExamResult', valueType: 'string' },
  { patterns: [/^心率(\(bpm\))?$/i], field: 'ecgHeartRate', valueType: 'number' },
  { patterns: [/^PR间期(\(ms\))?$/i], field: 'ecgPrInterval', valueType: 'number' },
  { patterns: [/^QRS宽度$/, /^QRS时限$/], field: 'ecgQrsWidth', valueType: 'number' },
  { patterns: [/^QT.?QTc$/, /^QT\/QTc$/i], field: 'ecgQtQtc', valueType: 'string' },
  { patterns: [/^QRS电轴$/], field: 'ecgQrsAxis', valueType: 'number' },
  { patterns: [/^RV5\/SV1$/, /^RV5\+SV1$/], field: 'ecgRv5sv1', valueType: 'string' },
  { patterns: [/^诊断提示$/, /^心电图诊断$/, /^心电图结论$/], field: 'ecgDiagnosisHint', valueType: 'string' },
  { patterns: [/^左臂踝脉搏波传导速度$/, /^左baPWV$/i], field: 'leftBaPWV', valueType: 'number' },
  { patterns: [/^右臂踝脉搏波传导速度$/, /^右baPWV$/i], field: 'rightBaPWV', valueType: 'number' },
  { patterns: [/^颈股脉搏波传导速度$/, /^cfPWV$/i], field: 'cfPWV', valueType: 'number' },
  { patterns: [/^左踝臂指数$/, /^左ABI$/i], field: 'leftABI', valueType: 'number' },
  { patterns: [/^右踝臂指数$/, /^右ABI$/i], field: 'rightABI', valueType: 'number' },
  { patterns: [/^动脉硬化风险$/], field: 'arteriosclerosisRisk', valueType: 'string' },
  { patterns: [/^动脉硬化结论$/], field: 'arteriosclerosisConclusion', valueType: 'string' },
  { patterns: [/^右眼评估$/, /^右眼$/], field: 'rightEyeAssessment', valueType: 'string' },
  { patterns: [/^左眼评估$/, /^左眼$/], field: 'leftEyeAssessment', valueType: 'string' },
  { patterns: [/^眼底结果$/, /^眼底照相$/], field: 'fundusResult', valueType: 'string' },
  { patterns: [/^身高(\(cm\))?$/i], field: 'height', valueType: 'number' },
  { patterns: [/^体重(\(kg\))?$/i], field: 'weight', valueType: 'number' },
  { patterns: [/^BMI$/i, /^体重指数$/], field: 'bmi', valueType: 'number' },
  { patterns: [/^体脂率$/], field: 'bodyFatRate', valueType: 'number' },
  { patterns: [/^内脏脂肪面积$/], field: 'visceralFatArea', valueType: 'number' },
  { patterns: [/^骨骼肌质量$/], field: 'skeletalMuscleMass', valueType: 'number' },
  { patterns: [/^腰臀比$/], field: 'waistHipRatio', valueType: 'number' },
  { patterns: [/^InBody评分$/, /^InBody分数$/], field: 'inbodyScore', valueType: 'number' },
  { exact: ['下限（骨骼肌质量正常范围）'], field: 'skeletalMuscleRefLow', valueType: 'number' },
  { exact: ['上限（骨骼肌质量正常范围）'], field: 'skeletalMuscleRefHigh', valueType: 'number' },
  { exact: ['下限（身体脂肪量正常范围）'], field: 'bodyFatMassRefLow', valueType: 'number' },
  { exact: ['上限（身体脂肪量正常范围）'], field: 'bodyFatMassRefHigh', valueType: 'number' },
];

const matchRule = (normalizedHeader: string, rule: ColumnRule): boolean => {
  if (rule.exact?.some((e) => normalizeHeader(e) === normalizedHeader)) return true;
  if (rule.patterns?.some((p) => p.test(normalizedHeader))) return true;
  return false;
};

export interface DirectExcelMappingResult {
  screening: Partial<DiabetesScreeningRecord>;
  checkupId?: string;
  name?: string;
  gender?: string;
  age?: number;
}

const PROFILE_HEADER_MAP: Record<string, keyof Pick<DirectExcelMappingResult, 'checkupId' | 'name' | 'gender' | 'age'>> = {
  体检编号: 'checkupId',
  编号: 'checkupId',
  姓名: 'name',
  性别: 'gender',
  年龄: 'age',
};

export const applyDirectExcelRowMapping = (
  headers: string[],
  row: unknown[],
  mode: 'fill_gaps' | 'overwrite' = 'fill_gaps'
): DirectExcelMappingResult => {
  const screening: Partial<DiabetesScreeningRecord> = {};
  const rawColumns: Record<string, string | number> = {};
  const profile: DirectExcelMappingResult = { screening };

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

    for (const rule of DIABETES_EXCEL_COLUMN_RULES) {
      if (!matchRule(norm, rule)) continue;
      const value = rule.valueType === 'number' ? parseMappingNumber(raw) : parseString(raw);
      setIfAbsent(screening as Record<string, unknown>, rule.field, value, mode);
      break;
    }
  });

  screening.rawColumns = rawColumns;
  return profile;
};

export const mergeScreeningParseResults = (
  ai: Partial<DiabetesScreeningRecord>,
  direct: Partial<DiabetesScreeningRecord>
): Partial<DiabetesScreeningRecord> => {
  const merged: Partial<DiabetesScreeningRecord> = { ...direct, ...ai };
  for (const [k, v] of Object.entries(direct)) {
    if (v == null || v === '') continue;
    const key = k as keyof DiabetesScreeningRecord;
    if (merged[key] == null || merged[key] === '') {
      (merged as Record<string, unknown>)[key] = v;
    }
  }
  if (direct.rawColumns || ai.rawColumns) {
    merged.rawColumns = { ...direct.rawColumns, ...ai.rawColumns };
  }
  return merged;
};

export const normalizeDiabetesScreeningRecord = (
  s: Partial<DiabetesScreeningRecord>
): Partial<DiabetesScreeningRecord> => {
  if (s.fastingGlucose != null && s.glucoseValue == null) {
    s.glucoseType = 'fasting';
    s.glucoseValue = s.fastingGlucose;
  }
  if (s.postprandialRandomGlucose != null && s.glucoseType !== 'fasting') {
    s.glucoseType = 'postprandial';
    s.glucoseValue = s.postprandialRandomGlucose;
  }
  if (s.rightABI != null && s.abi == null) s.abi = s.rightABI;
  if (s.leftABI != null && s.abi == null) s.abi = s.leftABI;
  if (s.rightBaPWV != null && s.pwv == null) s.pwv = s.rightBaPWV;
  if (s.ecgDiagnosisHint && !s.ecgResult) s.ecgResult = s.ecgDiagnosisHint;
  if (s.rightEyeAssessment || s.leftEyeAssessment) {
    s.fundusResult = [s.rightEyeAssessment, s.leftEyeAssessment, s.fundusResult]
      .filter(Boolean)
      .join('；');
  }
  if (!s.screeningDate && s.registrationDate) s.screeningDate = s.registrationDate;
  if (!s.activityName) s.activityName = '社区糖尿病并发症筛查';

  const hba1cNum = parseMappingNumber(s.hba1c);
  if (hba1cNum != null) s.hba1c = hba1cNum;

  return s;
};

export const normalizeDiabetesHealthRecordFields = (record: HealthRecord): HealthRecord => {
  const extras = { ...(record.riskModelExtras || {}) };
  const lab = record.checkup?.labBasic || {};
  const opt = record.checkup?.optional || {};
  const labExt = lab as Record<string, unknown>;

  if (parseMappingNumber(extras.postprandialGlucose) == null) {
    const fromLab = parseMappingNumber(labExt.postprandialGlucose);
    if (fromLab != null) extras.postprandialGlucose = fromLab;
  }

  const mapNum = (src: unknown, key: string) => {
    const n = parseMappingNumber(src);
    if (n != null && extras[key] == null) extras[key] = n;
  };
  const mapStr = (src: unknown, key: string) => {
    const s = parseString(src);
    if (s && !extras[key]) extras[key] = s;
  };

  mapNum(labExt.insulinFasting, 'insulinFasting');
  mapNum(labExt.insulinPostprandial2h, 'insulinPostprandial2h');
  mapNum(labExt.cPeptideFasting, 'cPeptideFasting');
  mapNum(labExt.cPeptidePostprandial2h, 'cPeptidePostprandial2h');
  mapNum(lab.homocysteine ?? opt.homocysteine, 'homocysteine');
  mapStr(opt.adiponectin, 'adiponectin');
  mapStr(labExt.uacr, 'uacr');
  mapStr(opt.lowerLimbUltrasound, 'lowerLimbVascularUltrasound');
  mapStr(extras.ncv ?? extras.nerveConductionVelocity, 'ncv');

  return { ...record, riskModelExtras: extras };
};
