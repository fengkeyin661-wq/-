/**
 * 历年体检合并进当前档案：
 * 同项以较新检查结果覆盖；本次没查到的项目保留更早结果。
 * 较新结论已经写明（含正常）时，不再保留同项旧异常。
 */
import type { CheckupAbnormality, HealthRecord } from '../types';
import { compareExamDates, examDateToDay } from './examDateUtils';

const EMPTY_TEXT =
  /^(未查|未检|未做|未检查|未记录|无此项|暂无|不详|空|无记录|null|undefined|n\/a|na|—|－|-|\/|\.)$/i;

export const isMeaningfulExamValue = (value: unknown): boolean => {
  if (value == null) return false;
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string') {
    const text = value.trim();
    return text.length > 0 && !EMPTY_TEXT.test(text);
  }
  if (Array.isArray(value)) return value.length > 0;
  return false;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** 较新且有内容则覆盖；否则只补空项 */
const mergeValue = (base: unknown, incoming: unknown, incomingIsNewer: boolean): unknown => {
  if (isPlainObject(base) || isPlainObject(incoming)) {
    const left = isPlainObject(base) ? base : {};
    const right = isPlainObject(incoming) ? incoming : {};
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    const out: Record<string, unknown> = {};
    keys.forEach((key) => {
      out[key] = mergeValue(left[key], right[key], incomingIsNewer);
    });
    return out;
  }

  const incomingOk = isMeaningfulExamValue(incoming);
  const baseOk = isMeaningfulExamValue(base);
  if (incomingIsNewer) return incomingOk ? incoming : baseOk ? base : incoming;
  if (baseOk) return base;
  return incomingOk ? incoming : base;
};

const abnormalityBlob = (row: CheckupAbnormality): string =>
  [row.category, row.item, row.result, row.clinicalSig].filter(Boolean).join(' ');

const abnormalityKey = (row: CheckupAbnormality): string =>
  String(row.item || row.category || row.result || '')
    .replace(/\s/g, '')
    .toLowerCase();

type DomainRule = {
  id: string;
  pattern: RegExp;
  filled: (record: HealthRecord) => boolean;
};

const anyFilled = (...values: unknown[]): boolean => values.some((value) => isMeaningfulExamValue(value));

const domainRules = (record: HealthRecord): DomainRule[] => {
  const lab = record.checkup?.labBasic;
  const img = record.checkup?.imagingBasic;
  const us = img?.ultrasound;
  const opt = record.checkup?.optional;
  const basics = record.checkup?.basics;
  return [
    { id: 'ecg', pattern: /心电|早搏|窦性|房颤|房扑|传导阻滞|st段|st-t/i, filled: () => isMeaningfulExamValue(img?.ecg) },
    { id: 'thyroid-us', pattern: /甲状腺(?!功能)|ti-rads|tirads|c-tirads/i, filled: () => isMeaningfulExamValue(us?.thyroid) },
    { id: 'breast-us', pattern: /乳腺|bi-rads|birads/i, filled: () => isMeaningfulExamValue(us?.breast) },
    { id: 'uterus', pattern: /子宫|附件|卵巢/, filled: () => isMeaningfulExamValue(us?.uterusAdnexa) },
    { id: 'prostate', pattern: /前列腺/, filled: () => isMeaningfulExamValue(us?.prostate) },
    {
      id: 'abdomen-us',
      pattern: /腹部|肝胆|胆囊|胆石|胰|脾|脂肪肝|肝囊肿|肾结石|肾积水|输尿管|膀胱/,
      filled: () => isMeaningfulExamValue(us?.abdomen),
    },
    { id: 'carotid', pattern: /颈动脉|颈部血管/, filled: () => isMeaningfulExamValue(opt?.carotidUltrasound) },
    { id: 'echo', pattern: /心脏彩超|心超|左室/, filled: () => isMeaningfulExamValue(opt?.heartUltrasound) },
    { id: 'ct', pattern: /\bct\b|断层|低剂量/, filled: () => isMeaningfulExamValue(opt?.ct) },
    { id: 'bone', pattern: /骨密度/, filled: () => isMeaningfulExamValue(opt?.boneDensity) },
    { id: 'fundus', pattern: /眼底/, filled: () => isMeaningfulExamValue(opt?.fundusPhoto) },
    { id: 'tct', pattern: /tct|液基|宫颈/, filled: () => isMeaningfulExamValue(opt?.tct) },
    { id: 'hpv', pattern: /hpv/i, filled: () => isMeaningfulExamValue(opt?.hpv) },
    { id: 'mammography', pattern: /钼靶/, filled: () => isMeaningfulExamValue(opt?.mammography) },
    { id: 'tcd', pattern: /经颅|tcd/i, filled: () => isMeaningfulExamValue(opt?.tcd) },
    { id: 'c13', pattern: /碳13|幽门/, filled: () => isMeaningfulExamValue(opt?.c13) },
    { id: 'bp', pattern: /血压|收缩压|舒张压/, filled: () => anyFilled(basics?.sbp, basics?.dbp) },
    { id: 'glucose', pattern: /空腹血糖|血糖|葡萄糖/, filled: () => isMeaningfulExamValue(lab?.glucose?.fasting) },
    { id: 'hba1c', pattern: /糖化/, filled: () => anyFilled(lab?.hba1c, opt?.hba1c) },
    {
      id: 'lipid-panel',
      pattern: /血脂/,
      filled: () => anyFilled(lab?.lipids?.tc, lab?.lipids?.tg, lab?.lipids?.ldl, lab?.lipids?.hdl),
    },
    { id: 'tc', pattern: /总胆固醇|(?<!低密度)(?<!高密度)胆固醇/, filled: () => isMeaningfulExamValue(lab?.lipids?.tc) },
    { id: 'tg', pattern: /甘油三酯/, filled: () => isMeaningfulExamValue(lab?.lipids?.tg) },
    { id: 'ldl', pattern: /低密度/, filled: () => isMeaningfulExamValue(lab?.lipids?.ldl) },
    { id: 'hdl', pattern: /高密度/, filled: () => isMeaningfulExamValue(lab?.lipids?.hdl) },
    { id: 'hcy', pattern: /同型半胱氨酸|hcy/i, filled: () => anyFilled(lab?.homocysteine, opt?.homocysteine) },
    { id: 'ua', pattern: /尿酸/, filled: () => isMeaningfulExamValue(lab?.renal?.ua) },
    { id: 'creatinine', pattern: /肌酐/, filled: () => isMeaningfulExamValue(lab?.renal?.creatinine) },
    { id: 'urea', pattern: /尿素/, filled: () => isMeaningfulExamValue(lab?.renal?.urea) },
    { id: 'liver', pattern: /转氨酶|肝功能|alt|ast|ggt/i, filled: () => anyFilled(lab?.liver?.alt, lab?.liver?.ast, lab?.liver?.ggt) },
    { id: 'hgb', pattern: /血红蛋白/, filled: () => isMeaningfulExamValue(lab?.bloodRoutine?.hgb) },
    { id: 'plt', pattern: /血小板/, filled: () => isMeaningfulExamValue(lab?.bloodRoutine?.plt) },
    { id: 'wbc', pattern: /白细胞/, filled: () => isMeaningfulExamValue(lab?.bloodRoutine?.wbc) },
  ];
};

const domainsOf = (record: HealthRecord, row: CheckupAbnormality): string[] => {
  const blob = abnormalityBlob(row);
  return domainRules(record).filter((rule) => rule.pattern.test(blob)).map((rule) => rule.id);
};

const coveredByFilledField = (record: HealthRecord, row: CheckupAbnormality): boolean => {
  const blob = abnormalityBlob(row);
  return domainRules(record).some((rule) => rule.pattern.test(blob) && rule.filled(record));
};

const mergeAbnormalities = (
  base: HealthRecord,
  incoming: HealthRecord,
  incomingIsNewer: boolean
): CheckupAbnormality[] => {
  const baseRows = base.checkup?.abnormalities || [];
  const incomingRows = incoming.checkup?.abnormalities || [];
  const incomingDomains = new Set(incomingRows.flatMap((row) => domainsOf(incoming, row)));

  if (incomingIsNewer) {
    const kept = baseRows.filter((row) => {
      const key = abnormalityKey(row);
      if (key && incomingRows.some((item) => abnormalityKey(item) === key)) return false;
      const domains = domainsOf(incoming, row);
      if (domains.some((id) => incomingDomains.has(id))) return false;
      if (coveredByFilledField(incoming, row)) return false;
      return true;
    });
    return [...kept, ...incomingRows];
  }

  const baseDomains = new Set(baseRows.flatMap((row) => domainsOf(base, row)));
  const extras = incomingRows.filter((row) => {
    const key = abnormalityKey(row);
    if (key && baseRows.some((item) => abnormalityKey(item) === key)) return false;
    if (domainsOf(base, row).some((id) => baseDomains.has(id))) return false;
    if (coveredByFilledField(base, row)) return false;
    return true;
  });
  return [...baseRows, ...extras];
};

const questionnaireIsPlaceholder = (questionnaire?: HealthRecord['questionnaire']): boolean => {
  if (!questionnaire) return true;
  const diseases = questionnaire.history?.diseases || [];
  const smoking = questionnaire.substances?.smoking?.status || '';
  const medication = questionnaire.medication?.list || '';
  return diseases.length === 0 && !medication && (smoking === '' || smoking === '未记录');
};

const examKey = (exam: NonNullable<HealthRecord['xlmsExams']>[number]) =>
  `${exam.examDate}|${exam.tjcs ?? ''}`;

const mergeExams = (
  base?: HealthRecord['xlmsExams'],
  patch?: HealthRecord['xlmsExams']
): HealthRecord['xlmsExams'] => {
  if (!patch?.length) return base;
  const merged = new Map<string, NonNullable<HealthRecord['xlmsExams']>[number]>();
  for (const exam of base || []) merged.set(examKey(exam), exam);
  for (const exam of patch) merged.set(examKey(exam), exam);
  return [...merged.values()].sort((a, b) => a.examDate.localeCompare(b.examDate));
};

const pickText = (base: unknown, incoming: unknown, incomingIsNewer: boolean): string => {
  const chosen = mergeValue(base, incoming, incomingIsNewer);
  return chosen == null ? '' : String(chosen);
};

export const mergeHealthRecordByExamDate = (
  base: HealthRecord,
  incoming: HealthRecord,
  incomingExamDate: string
): HealthRecord => {
  const incomingIsNewer = compareExamDates(incomingExamDate, base.profile?.checkupDate) >= 0;
  const latestDay = incomingIsNewer
    ? examDateToDay(incomingExamDate) || examDateToDay(base.profile?.checkupDate)
    : examDateToDay(base.profile?.checkupDate) || examDateToDay(incomingExamDate);

  const checkup = mergeValue(base.checkup, incoming.checkup, incomingIsNewer) as HealthRecord['checkup'];
  checkup.abnormalities = mergeAbnormalities(base, incoming, incomingIsNewer);

  const questionnaire = incomingIsNewer
    ? questionnaireIsPlaceholder(incoming.questionnaire) && base.questionnaire
      ? base.questionnaire
      : incoming.questionnaire || base.questionnaire
    : questionnaireIsPlaceholder(base.questionnaire) && incoming.questionnaire
      ? incoming.questionnaire
      : base.questionnaire;

  const ageSource = incomingIsNewer ? incoming.profile?.age : base.profile?.age;
  const ageFallback = incomingIsNewer ? base.profile?.age : incoming.profile?.age;

  return {
    ...base,
    profile: {
      ...base.profile,
      checkupId: base.profile?.checkupId || incoming.profile?.checkupId || '',
      checkupDate: latestDay,
      name: pickText(base.profile?.name, incoming.profile?.name, incomingIsNewer),
      gender: pickText(base.profile?.gender, incoming.profile?.gender, incomingIsNewer),
      department: pickText(base.profile?.department, incoming.profile?.department, incomingIsNewer),
      phone: pickText(base.profile?.phone, incoming.profile?.phone, incomingIsNewer),
      age: isMeaningfulExamValue(ageSource) ? Number(ageSource) : Number(ageFallback || 0),
    },
    checkup,
    riskModelExtras: mergeValue(
      base.riskModelExtras || {},
      incoming.riskModelExtras || {},
      incomingIsNewer
    ) as HealthRecord['riskModelExtras'],
    questionnaire,
    xlmsExams: mergeExams(base.xlmsExams, incoming.xlmsExams),
  };
};
