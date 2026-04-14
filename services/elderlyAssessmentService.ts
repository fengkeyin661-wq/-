import { ElderlyAssessmentData, HealthAssessment, RiskLevel } from '../types';

export interface ElderlyAssessmentResult {
  riskLevel: RiskLevel;
  summary: string;
  reasons: string[];
  personalizedPlan: {
    diet: string[];
    exercise: string[];
    sleep: string[];
    psychosocial: string[];
    followup: string[];
  };
}

const addUnique = (arr: string[], value: string) => {
  if (!arr.includes(value)) arr.push(value);
};

export const evaluateElderlyAssessment = (data: ElderlyAssessmentData): ElderlyAssessmentResult => {
  const redReasons: string[] = [];
  const yellowReasons: string[] = [];

  const { checkupMetrics, functionalStatus, emotion, nutrition, visionOrHearing, oralHealth, sleep, screenings } = data;

  // Red rules
  if ((nutrition.mnaScore ?? 99) <= 7) redReasons.push('营养状态提示重度风险（MNA<=7）');
  if ((functionalStatus.adlScore ?? 100) < 60) redReasons.push('日常生活能力明显受损（ADL<60）');
  if (functionalStatus.fallRisk === 'high' || (functionalStatus.recentFalls ?? 0) >= 2) redReasons.push('跌倒高风险');
  if ((emotion.depressionScore ?? 0) >= 15 || (emotion.anxietyScore ?? 0) >= 15) redReasons.push('情绪筛查重度风险');
  if (screenings.frailty === 'frail') redReasons.push('衰弱筛查阳性');
  if (screenings.cognitiveRisk === 'high') redReasons.push('认知高风险');

  // Yellow rules
  if ((nutrition.mnaScore ?? 99) > 7 && (nutrition.mnaScore ?? 99) <= 11) yellowReasons.push('营养状态需关注（MNA 8-11）');
  if ((functionalStatus.adlScore ?? 100) >= 60 && (functionalStatus.adlScore ?? 100) < 90) yellowReasons.push('日常生活能力轻中度受损（ADL 60-89）');
  if ((functionalStatus.iadlScore ?? 8) < 6) yellowReasons.push('工具性日常活动能力下降（IADL<6）');
  if (functionalStatus.fallRisk === 'medium' || (functionalStatus.recentFalls ?? 0) === 1) yellowReasons.push('存在跌倒风险');
  if ((emotion.depressionScore ?? 0) >= 10 || (emotion.anxietyScore ?? 0) >= 10 || emotion.loneliness === 'moderate' || emotion.loneliness === 'severe') yellowReasons.push('情绪状态需干预');
  if (visionOrHearing.visionImpairment === 'moderate' || visionOrHearing.visionImpairment === 'severe' || visionOrHearing.hearingImpairment === 'moderate' || visionOrHearing.hearingImpairment === 'severe') yellowReasons.push('感官功能下降');
  if (oralHealth.chewingDifficulty || (oralHealth.missingTeethCount ?? 0) >= 6 || oralHealth.oralPain) yellowReasons.push('口腔咀嚼/牙列问题影响健康');
  if (sleep.insomniaSeverity === 'moderate' || sleep.insomniaSeverity === 'severe' || (sleep.sleepHours ?? 7) < 6 || sleep.daytimeSleepiness) yellowReasons.push('睡眠问题需管理');
  if (screenings.cognitiveRisk === 'moderate' || screenings.frailty === 'pre' || screenings.osteoporosisRisk === 'high' || screenings.depressionScreenPositive) yellowReasons.push('专项筛查提示中度风险');
  if ((checkupMetrics.sbp ?? 120) >= 160 || (checkupMetrics.dbp ?? 80) >= 100 || (checkupMetrics.fastingGlucose ?? 5.0) >= 7.0 || (checkupMetrics.ldl ?? 2.6) >= 4.1) yellowReasons.push('体检指标异常');

  const riskLevel = redReasons.length > 0 ? RiskLevel.RED : yellowReasons.length >= 2 ? RiskLevel.YELLOW : RiskLevel.GREEN;
  const reasons = riskLevel === RiskLevel.RED ? redReasons : riskLevel === RiskLevel.YELLOW ? yellowReasons : ['当前未见显著老年专项高危信号'];

  const plan = {
    diet: [] as string[],
    exercise: [] as string[],
    sleep: [] as string[],
    psychosocial: [] as string[],
    followup: [] as string[],
  };

  if ((nutrition.mnaScore ?? 99) <= 11 || oralHealth.chewingDifficulty) {
    addUnique(plan.diet, '优先保证蛋白质和能量摄入，必要时营养科评估');
    addUnique(plan.diet, '每日分次进食，结合口腔状态调整食物性状');
  }
  if ((checkupMetrics.sbp ?? 120) >= 140 || (checkupMetrics.dbp ?? 80) >= 90) addUnique(plan.diet, '控制钠盐摄入，建议每日食盐不超过5g');
  if ((checkupMetrics.fastingGlucose ?? 5.0) >= 6.1) addUnique(plan.diet, '优化主食结构，减少精制碳水，增加膳食纤维');

  if (functionalStatus.fallRisk === 'high' || functionalStatus.fallRisk === 'medium' || screenings.frailty === 'pre' || screenings.frailty === 'frail') {
    addUnique(plan.exercise, '以防跌倒为核心，开展平衡与下肢肌力训练');
    addUnique(plan.exercise, '每周至少3次中低强度活动，循序渐进增加活动量');
  } else {
    addUnique(plan.exercise, '维持每周150分钟中等强度有氧活动，结合抗阻训练');
  }

  if (sleep.insomniaSeverity === 'moderate' || sleep.insomniaSeverity === 'severe' || (sleep.sleepHours ?? 7) < 6) {
    addUnique(plan.sleep, '建立固定作息与睡前减刺激策略，必要时睡眠门诊评估');
  } else {
    addUnique(plan.sleep, '保持规律作息，维持7小时左右夜间睡眠');
  }

  if ((emotion.depressionScore ?? 0) >= 10 || (emotion.anxietyScore ?? 0) >= 10 || emotion.loneliness === 'moderate' || emotion.loneliness === 'severe') {
    addUnique(plan.psychosocial, '建议心理评估与情绪干预，增加社会参与和家庭支持');
  } else {
    addUnique(plan.psychosocial, '鼓励持续社交互动与兴趣活动，维持良好心理状态');
  }

  if (riskLevel === RiskLevel.RED) {
    addUnique(plan.followup, '1个月内复评老年专项关键指标并落实多学科干预');
    addUnique(plan.followup, '必要时转诊老年医学/康复/精神心理专科');
  } else if (riskLevel === RiskLevel.YELLOW) {
    addUnique(plan.followup, '3个月内复评，重点追踪已命中风险项');
  } else {
    addUnique(plan.followup, '6个月常规复评，持续健康维护');
  }

  return {
    riskLevel,
    summary: `老年专项评估分级为${riskLevel === RiskLevel.RED ? '高风险' : riskLevel === RiskLevel.YELLOW ? '中风险' : '低风险'}，共识别${reasons.length}项关键信号。`,
    reasons,
    personalizedPlan: plan,
  };
};

export const mergeElderlyResultToAssessment = (
  base: HealthAssessment,
  result: ElderlyAssessmentResult
): HealthAssessment => {
  return {
    ...base,
    elderlyRiskLevel: result.riskLevel,
    elderlyRiskSummary: result.summary,
    elderlyRiskReasons: result.reasons,
    elderlyPersonalizedPlan: result.personalizedPlan,
  };
};
