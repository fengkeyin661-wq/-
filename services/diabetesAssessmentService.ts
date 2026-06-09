import {
  CheckupData,
  DiabetesAssessmentResult,
  DiabetesManagementData,
  DiabetesScreeningRecord,
  HealthAssessment,
  HealthRecord,
  QuestionnaireData,
  RiskLevel,
} from '../types';
import {
  DIABETES_SCREENING_CATALOG,
  COMMUNITY_SCREENING_IDS,
  ScreeningCatalogItem,
} from './diabetesScreeningCatalog';
import {
  getDietGuidance,
  getExerciseGuidance,
  getIndicatorEducation,
  GUIDELINE_NOTES,
  CORE_INDICATOR_EDUCATION_IDS,
} from './diabetesEducationContent';
import {
  evaluateAllScreeningDomains,
  computeOverallRiskFromDomains,
  INITIAL_SCREENING_CHECKS,
} from './diabetesScreeningRules';

const INITIAL_SCREENING_CLINICAL_MEANING: Record<string, string> = {
  glucose: '反映空腹及餐后糖代谢状态，是糖尿病诊断与监测的核心指标',
  ecg: '筛查心脏并发症及心律失常风险',
  arteriosclerosis: '评估外周动脉及大血管硬化程度，预测心血管事件风险',
  fundus: '筛查糖尿病视网膜病变，早期干预可防失明',
  body_composition: '评估体脂分布、内脏脂肪与骨骼肌，指导体重与代谢管理',
};

const getMissedItemClinicalMeaning = (itemId: string): string => {
  if (INITIAL_SCREENING_CLINICAL_MEANING[itemId]) return INITIAL_SCREENING_CLINICAL_MEANING[itemId];
  if (itemId === 'annual_checkup') {
    return '完善年度体检可补充 HbA1c、血脂、肾功能等数据，全面评估并发症风险';
  }
  return DIABETES_SCREENING_CATALOG.find((i) => i.id === itemId)?.clinicalMeaning ?? '';
};

export interface MergedDiabetesContext {
  dm: DiabetesManagementData;
  checkup: CheckupData;
  questionnaire: QuestionnaireData;
  latestScreening: DiabetesScreeningRecord | null;
  hasAnnualCheckup: boolean;
}

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
};

const hasText = (v: unknown): boolean =>
  v != null && String(v).trim().length > 0 && String(v).trim() !== '未查' && String(v).trim() !== '无';

const getByPath = (obj: unknown, path: string): unknown => {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
};

const getLatestScreening = (dm: DiabetesManagementData): DiabetesScreeningRecord | null => {
  const list = dm.screenings || [];
  if (!list.length) return null;
  return [...list].sort((a, b) =>
    (b.screeningDate || b.registrationDate || '').localeCompare(a.screeningDate || a.registrationDate || '')
  )[0];
};

const isExtendedItemPresent = (
  item: ScreeningCatalogItem,
  screening: DiabetesScreeningRecord | null,
  record: HealthRecord
): boolean => {
  if (COMMUNITY_SCREENING_IDS.includes(item.id as (typeof COMMUNITY_SCREENING_IDS)[number])) {
    const check = INITIAL_SCREENING_CHECKS.find((c) => {
      if (item.id.startsWith('glucose')) return c.id === 'glucose';
      if (item.id === 'arteriosclerosis') return c.id === 'arteriosclerosis';
      if (item.id === 'body_composition') return c.id === 'body_composition';
      return c.id === item.id;
    });
    if (check) return check.isDone(screening);
  }

  if (item.screeningFields?.length && screening) {
    const hasScreening = item.screeningFields.some((f) => {
      const v = screening[f];
      if (typeof v === 'number') return Number.isFinite(v);
      if (typeof v === 'boolean') return true;
      return hasText(v);
    });
    if (hasScreening) return true;
  }

  if (item.checkupPaths?.length) {
    return item.checkupPaths.some((p) => hasText(getByPath(record, p)));
  }

  return false;
};

const inferCohortTag = (
  questionnaire: QuestionnaireData,
  screening: DiabetesScreeningRecord | null,
  checkup: CheckupData
): DiabetesManagementData['cohortTag'] => {
  const diseases = questionnaire.history?.diseases || [];
  if (diseases.some((d) => d.includes('糖尿病') && !d.includes('前期'))) return 'diabetes';
  if (diseases.some((d) => d.includes('糖尿病前期') || d.includes('糖耐量'))) return 'prediabetes';

  const fasting =
    num(screening?.fastingGlucose) ??
    (screening?.glucoseType === 'fasting' ? screening?.glucoseValue : undefined) ??
    num(checkup.labBasic?.glucose?.fasting);
  const post =
    num(screening?.postprandialRandomGlucose) ??
    (screening?.glucoseType === 'postprandial' ? screening?.glucoseValue : undefined);

  if ((fasting != null && fasting >= 7.0) || (post != null && post >= 11.1)) return 'diabetes';
  if ((fasting != null && fasting >= 6.1) || (post != null && post >= 7.8)) return 'prediabetes';
  return 'high_glucose';
};

export const mergeScreeningWithCheckup = (
  dm: DiabetesManagementData | undefined,
  checkup: CheckupData,
  questionnaire: QuestionnaireData
): MergedDiabetesContext => {
  const base: DiabetesManagementData = dm || { screenings: [] };
  const latestScreening = getLatestScreening(base);

  const hasAnnualCheckup =
    hasText(checkup.labBasic?.glucose?.fasting) ||
    hasText(checkup.optional?.hba1c) ||
    hasText(checkup.labBasic?.lipids?.tc) ||
    hasText(checkup.labBasic?.renal?.creatinine) ||
    (checkup.abnormalities?.length ?? 0) > 0;

  return {
    dm: {
      ...base,
      cohortTag: base.cohortTag || inferCohortTag(questionnaire, latestScreening, checkup),
      annualCheckupLinked: base.annualCheckupLinked ?? hasAnnualCheckup,
    },
    checkup,
    questionnaire,
    latestScreening,
    hasAnnualCheckup,
  };
};

const buildMissedItems = (
  ctx: MergedDiabetesContext,
  record: HealthRecord
): DiabetesAssessmentResult['missedItems'] => {
  const { latestScreening } = ctx;
  const missed: DiabetesAssessmentResult['missedItems'] = [];

  for (const check of INITIAL_SCREENING_CHECKS) {
    if (!check.isDone(latestScreening)) {
      missed.push({
        itemId: check.id,
        label: check.label,
        priority: 'high',
        clinicalMeaning: getMissedItemClinicalMeaning(check.id),
        recommendedCycle: '建议补检',
      });
    }
  }

  const extendedItems = DIABETES_SCREENING_CATALOG.filter(
    (item) => !COMMUNITY_SCREENING_IDS.includes(item.id as (typeof COMMUNITY_SCREENING_IDS)[number])
  );

  for (const item of extendedItems) {
    if (isExtendedItemPresent(item, latestScreening, record)) continue;
    missed.push({
      itemId: item.id,
      label: item.label,
      priority: item.priority,
      clinicalMeaning: item.clinicalMeaning,
      recommendedCycle: item.retestCycle,
    });
  }

  if (!ctx.hasAnnualCheckup) {
    missed.unshift({
      itemId: 'annual_checkup',
      label: '年度健康体检报告',
      priority: 'high',
      clinicalMeaning: getMissedItemClinicalMeaning('annual_checkup'),
      recommendedCycle: '每年至少1次',
    });
  }

  return missed.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
};

export const evaluateDiabetesScreening = (record: HealthRecord): DiabetesAssessmentResult => {
  const ctx = mergeScreeningWithCheckup(
    record.diabetesManagement,
    record.checkup,
    record.questionnaire
  );
  const { latestScreening } = ctx;
  const gender = record.profile?.gender;

  const initialScreeningCoverage = INITIAL_SCREENING_CHECKS.map((c) => ({
    itemId: c.id,
    label: c.label,
    done: c.isDone(latestScreening),
  }));

  const screeningFindings: string[] = [];
  const complicationAlerts: string[] = [];
  const retestAdvice: DiabetesAssessmentResult['retestAdvice'] = [];
  let screeningDomains: DiabetesAssessmentResult['screeningDomains'] = [];

  if (!latestScreening && !ctx.dm.screenings?.length) {
    screeningFindings.push('暂无社区并发症筛查记录，请先上传 Excel 汇总或手工录入');
  } else {
    const domains = evaluateAllScreeningDomains(latestScreening, gender);
    screeningDomains = domains.map((d) => ({
      domainId: d.domainId,
      label: d.label,
      status: d.status,
      findings: d.findings,
    }));

    for (const d of domains) {
      if (d.status === 'not_done') {
        screeningFindings.push(`【${d.label}】本次未检测`);
        continue;
      }
      for (const f of d.findings) {
        screeningFindings.push(`【${d.label}】${f}`);
      }
      complicationAlerts.push(...d.alerts);
      retestAdvice.push(...d.retest);
    }

    const doneDomains = domains.filter((d) => d.status !== 'not_done');
    if (doneDomains.length && doneDomains.every((d) => d.status === 'normal')) {
      screeningFindings.push('初筛已完成项目未见异常，请继续保持健康生活方式并定期复查');
    }
  }

  const missedItems = buildMissedItems(ctx, record);

  const testedIds = DIABETES_SCREENING_CATALOG.filter((item) =>
    isExtendedItemPresent(item, latestScreening, record)
  ).map((i) => i.id);
  const eduIds = [
    ...new Set([
      ...CORE_INDICATOR_EDUCATION_IDS,
      ...testedIds,
      ...missedItems.map((m) => m.itemId),
    ]),
  ].filter((id) => id !== 'annual_checkup');

  const domainRisk = computeOverallRiskFromDomains(
    evaluateAllScreeningDomains(latestScreening, gender)
  );
  let riskLevel =
    domainRisk.riskLevel === 'RED'
      ? RiskLevel.RED
      : domainRisk.riskLevel === 'YELLOW'
        ? RiskLevel.YELLOW
        : RiskLevel.GREEN;

  if (complicationAlerts.length > 0) riskLevel = RiskLevel.RED;
  if (missedItems.filter((m) => m.itemId === 'annual_checkup').length && riskLevel === RiskLevel.GREEN) {
    riskLevel = RiskLevel.YELLOW;
  }

  const dietPlan = getDietGuidance();
  const exercisePlan = getExerciseGuidance(riskLevel);

  const doneCount = initialScreeningCoverage.filter((c) => c.done).length;
  const cohortLabel =
    ctx.dm.cohortTag === 'diabetes'
      ? '糖尿病人群'
      : ctx.dm.cohortTag === 'prediabetes'
        ? '糖尿病前期人群'
        : '血糖偏高人群';

  const abnormalDomains =
    screeningDomains?.filter((d) => d.status === 'abnormal' || d.status === 'critical').length ?? 0;

  return {
    riskLevel,
    summary: `${cohortLabel}社区并发症初筛评估：初筛五项完成 ${doneCount}/5，${abnormalDomains} 项需关注，${missedItems.length} 项建议补检或完善。`,
    screeningDomains,
    initialScreeningCoverage,
    screeningFindings,
    missedItems,
    retestAdvice,
    indicatorEducation: getIndicatorEducation(eduIds),
    dietPlan,
    exercisePlan,
    complicationAlerts,
    guidelineNotes: GUIDELINE_NOTES,
    generatedAt: new Date().toISOString(),
    basedOnScreeningId: latestScreening?.id,
  };
};

export const mergeDiabetesResultToAssessment = (
  assessment: HealthAssessment,
  result: DiabetesAssessmentResult
): HealthAssessment => {
  const dietary = [
    ...result.dietPlan.principles.slice(0, 3),
    ...result.dietPlan.eatingTips.slice(0, 2),
  ];
  const exercise = [result.exercisePlan.summary, ...result.exercisePlan.precautions.slice(0, 2)];
  const monitoring = [
    ...result.retestAdvice.slice(0, 4).map((r) => `【糖尿病专栏】${r.label}：${r.advice}`),
    ...result.missedItems
      .filter((m) => m.priority === 'high')
      .slice(0, 3)
      .map((m) => `【补检】${m.label}（${m.recommendedCycle}）`),
  ];

  return {
    ...assessment,
    diabetesRiskLevel: result.riskLevel,
    diabetesReport: result,
    managementPlan: {
      ...assessment.managementPlan,
      dietary: [...new Set([...dietary, ...assessment.managementPlan.dietary])].slice(0, 12),
      exercise: [...new Set([...exercise, ...assessment.managementPlan.exercise])].slice(0, 10),
      monitoring: [...new Set([...monitoring, ...assessment.managementPlan.monitoring])].slice(0, 15),
    },
    followUpPlan: {
      frequency:
        result.riskLevel === RiskLevel.RED
          ? '1个月内专科随访'
          : result.riskLevel === RiskLevel.YELLOW
            ? '3个月内复查'
            : '6个月常规复查',
      nextCheckItems: [
        ...result.missedItems.filter((m) => m.priority === 'high').map((m) => m.label),
        ...result.retestAdvice.filter((r) => r.urgency !== 'routine').map((r) => r.label),
      ].slice(0, 8),
    },
  };
};

export const isDiabetesCohort = (record: HealthRecord): boolean => {
  const diseases = record.questionnaire?.history?.diseases || [];
  if (diseases.some((d) => /糖尿病|血糖/.test(d))) return true;

  const dm = record.diabetesManagement;
  if (dm?.screenings?.length) return true;
  if (dm?.cohortTag) return true;

  const fasting = num(record.checkup?.labBasic?.glucose?.fasting);
  if (fasting != null && fasting >= 6.1) return true;

  const latest = getLatestScreening(dm || { screenings: [] });
  const f =
    num(latest?.fastingGlucose) ??
    (latest?.glucoseType === 'fasting' ? latest?.glucoseValue : undefined);
  const p =
    num(latest?.postprandialRandomGlucose) ??
    (latest?.glucoseType === 'postprandial' ? latest?.glucoseValue : undefined);
  if (f != null && f >= 6.1) return true;
  if (p != null && p >= 7.8) return true;

  return false;
};

export const createEmptyDiabetesManagement = (): DiabetesManagementData => ({
  screenings: [],
});

export const createScreeningId = (): string =>
  `ds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const applyScreeningToHealthRecord = (
  record: HealthRecord,
  dm: DiabetesManagementData
): HealthRecord => {
  const latest = getLatestScreening(dm);
  if (!latest) return { ...record, diabetesManagement: dm };

  let next = { ...record, diabetesManagement: dm };
  next.checkup = { ...next.checkup };

  const fasting =
    num(latest.fastingGlucose) ??
    (latest.glucoseType === 'fasting' ? latest.glucoseValue : undefined);
  const post =
    num(latest.postprandialRandomGlucose) ??
    (latest.glucoseType === 'postprandial' ? latest.glucoseValue : undefined);

  if (fasting != null) {
    next.checkup.labBasic = { ...next.checkup.labBasic, glucose: { fasting: String(fasting) } };
  }
  if (post != null) {
    next.riskModelExtras = { ...next.riskModelExtras, postprandialGlucose: post };
  }

  const sbp = latest.rightArmSbp ?? latest.leftArmSbp;
  const dbp = latest.rightArmDbp ?? latest.leftArmDbp;
  if (sbp != null) next.checkup.basics = { ...next.checkup.basics, sbp };
  if (dbp != null) next.checkup.basics = { ...next.checkup.basics, dbp };
  if (latest.bmi != null) next.checkup.basics = { ...next.checkup.basics, bmi: latest.bmi };
  if (latest.weight != null) next.checkup.basics = { ...next.checkup.basics, weight: latest.weight };
  if (latest.height != null) next.riskModelExtras = { ...next.riskModelExtras, height: latest.height };
  if (latest.bodyFatRate != null) {
    next.riskModelExtras = { ...next.riskModelExtras, bodyFatRate: latest.bodyFatRate };
  }

  const ecgText = latest.ecgDiagnosisHint || latest.ecgResult;
  if (ecgText) {
    next.checkup.imagingBasic = { ...next.checkup.imagingBasic, ecg: ecgText };
  }

  const fundus = [latest.rightEyeAssessment, latest.leftEyeAssessment, latest.fundusResult]
    .filter(Boolean)
    .join('；');
  if (fundus) {
    next.checkup.optional = { ...next.checkup.optional, fundusPhoto: fundus };
  }

  return next;
};
