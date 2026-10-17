import {
  ElderlyAssessmentData,
  ElderlyAssessmentResult,
  HealthAssessment,
  RiskLevel,
} from '../types';
import { ELDERLY_DOMAINS } from './elderlyScreeningCatalog';
import { hydrateElderlyAggregates } from './elderlyScaleScoringService';
import { ELDERLY_SCALES } from './elderlyScreeningCatalog';

export type { ElderlyAssessmentResult };

const addUnique = (arr: string[], value: string) => {
  if (!arr.includes(value)) arr.push(value);
};

export const evaluateElderlyAssessment = (raw: ElderlyAssessmentData): ElderlyAssessmentResult => {
  const data = hydrateElderlyAggregates(raw);
  const redReasons: string[] = [];
  const yellowReasons: string[] = [];

  const { checkupMetrics, functionalStatus, emotion, nutrition, visionOrHearing, oralHealth, sleep, screenings } = data;
  const scores = data.scaleScores || {};

  const gds = scores.gds15?.total;
  const phq = scores.phq9?.total ?? emotion.depressionScore;
  const gad = scores.gad7?.total ?? emotion.anxietyScore;
  const mna = scores.mnaSf?.total ?? nutrition.mnaScore;
  const barthel = scores.barthel?.total ?? functionalStatus.adlScore;
  const morse = scores.morse?.total;
  const isi = scores.isi?.total;
  const miniCog = scores.miniCog?.total;
  const frailCount = scores.frail?.total;
  const hhie = scores.hhieS?.total;
  const lsns = scores.lsns6?.total;
  const osta = scores.osta?.total;

  // RED rules
  if ((mna ?? 99) <= 7) redReasons.push('营养状态提示重度风险（MNA-SF≤7）');
  if ((barthel ?? 100) <= 40) redReasons.push('日常生活能力明显受损（Barthel≤40）');
  if (morse !== undefined && morse >= 51) redReasons.push('Morse 跌倒量表高风险（≥51）');
  if (functionalStatus.fallRisk === 'high' || (functionalStatus.recentFalls ?? 0) >= 2) {
    redReasons.push('跌倒高风险或近12月多次跌倒');
  }
  if ((gds !== undefined && gds >= 10) || (phq ?? 0) >= 15 || (gad ?? 0) >= 15) {
    redReasons.push('情绪筛查重度风险（GDS≥10 或 PHQ/GAD≥15）');
  }
  if (frailCount !== undefined && frailCount >= 5) redReasons.push('FRAIL 衰弱筛查阳性');
  if (screenings.frailty === 'frail') redReasons.push('衰弱状态：衰弱');
  if (miniCog !== undefined && miniCog <= 2) redReasons.push('Mini-Cog 认知筛查阳性（≤2）');
  if (screenings.cognitiveRisk === 'high') redReasons.push('认知高风险');
  if (isi !== undefined && isi >= 22) redReasons.push('ISI 重度失眠（≥22）');

  // YELLOW rules
  if ((mna ?? 99) > 7 && (mna ?? 99) <= 11) yellowReasons.push('营养状态需关注（MNA-SF 8–11）');
  if ((barthel ?? 100) >= 41 && (barthel ?? 100) <= 60) yellowReasons.push('日常生活能力轻中度受损（Barthel 41–60）');
  if ((functionalStatus.iadlScore ?? 8) <= 5) yellowReasons.push('工具性日常活动能力下降（IADL≤5）');
  if (morse !== undefined && morse >= 25 && morse <= 50) yellowReasons.push('Morse 跌倒中风险（25–50）');
  if (functionalStatus.fallRisk === 'medium' || (functionalStatus.recentFalls ?? 0) === 1) {
    yellowReasons.push('存在跌倒风险');
  }
  if ((functionalStatus.gaitSpeed ?? 1) < 0.8) yellowReasons.push('4米步速<0.8 m/s，衰弱/跌倒相关风险');
  if ((gds !== undefined && gds >= 5 && gds <= 9) || (phq ?? 0) >= 10 || (gad ?? 0) >= 10) {
    yellowReasons.push('情绪状态需干预');
  }
  if (emotion.loneliness === 'moderate' || emotion.loneliness === 'severe') yellowReasons.push('孤独感中等及以上');
  if (visionOrHearing.visionImpairment === 'moderate' || visionOrHearing.visionImpairment === 'severe') {
    yellowReasons.push('视力明显下降');
  }
  if (visionOrHearing.hearingImpairment === 'moderate' || visionOrHearing.hearingImpairment === 'severe' || (hhie !== undefined && hhie >= 10)) {
    yellowReasons.push('听力/沟通障碍风险');
  }
  if (oralHealth.chewingDifficulty || (oralHealth.missingTeethCount ?? 0) >= 6 || oralHealth.oralPain) {
    yellowReasons.push('口腔咀嚼/牙列问题影响健康');
  }
  if (sleep.insomniaSeverity === 'moderate' || sleep.insomniaSeverity === 'severe' || (sleep.sleepHours ?? 7) < 6 || sleep.daytimeSleepiness) {
    yellowReasons.push('睡眠问题需管理');
  }
  if (screenings.cognitiveRisk === 'moderate' || (frailCount !== undefined && frailCount >= 3 && frailCount <= 4) || screenings.frailty === 'pre') {
    yellowReasons.push('衰弱或认知中度风险');
  }
  if (screenings.osteoporosisRisk === 'high' || (osta !== undefined && osta <= -4)) yellowReasons.push('骨质疏松高风险');
  if (screenings.depressionScreenPositive) yellowReasons.push('抑郁筛查阳性');
  if (lsns !== undefined && lsns < 12) yellowReasons.push('社会网络不足（LSNS-6<12）');
  if ((checkupMetrics.sbp ?? 120) >= 160 || (checkupMetrics.dbp ?? 80) >= 100 || (checkupMetrics.fastingGlucose ?? 5.0) >= 7.0 || (checkupMetrics.ldl ?? 2.6) >= 4.1) {
    yellowReasons.push('体检指标异常');
  }

  const riskLevel = redReasons.length > 0 ? RiskLevel.RED : yellowReasons.length >= 2 ? RiskLevel.YELLOW : RiskLevel.GREEN;
  const reasons = riskLevel === RiskLevel.RED ? redReasons : riskLevel === RiskLevel.YELLOW ? yellowReasons : ['当前未见显著老年专项高危信号'];

  const plan = {
    diet: [] as string[],
    exercise: [] as string[],
    sleep: [] as string[],
    psychosocial: [] as string[],
    followup: [] as string[],
  };

  if ((mna ?? 99) <= 11 || oralHealth.chewingDifficulty) {
    addUnique(plan.diet, '优先保证蛋白质和能量摄入，必要时营养科评估');
    addUnique(plan.diet, '每日分次进食，结合口腔状态调整食物性状');
  }
  if ((checkupMetrics.sbp ?? 120) >= 140 || (checkupMetrics.dbp ?? 80) >= 90) addUnique(plan.diet, '控制钠盐摄入，建议每日食盐不超过5g');
  if ((checkupMetrics.fastingGlucose ?? 5.0) >= 6.1) addUnique(plan.diet, '优化主食结构，减少精制碳水，增加膳食纤维');

  if (functionalStatus.fallRisk === 'high' || functionalStatus.fallRisk === 'medium' || screenings.frailty === 'pre' || screenings.frailty === 'frail' || (functionalStatus.gaitSpeed ?? 1) < 0.8) {
    addUnique(plan.exercise, '以防跌倒为核心，开展平衡与下肢肌力训练');
    addUnique(plan.exercise, '每周至少3次中低强度活动，循序渐进增加活动量');
  } else {
    addUnique(plan.exercise, '维持每周150分钟中等强度有氧活动，结合抗阻训练');
  }

  if (sleep.insomniaSeverity === 'moderate' || sleep.insomniaSeverity === 'severe' || (sleep.sleepHours ?? 7) < 6 || (isi !== undefined && isi >= 8)) {
    addUnique(plan.sleep, '建立固定作息与睡前减刺激策略，必要时睡眠门诊评估');
  } else {
    addUnique(plan.sleep, '保持规律作息，维持7小时左右夜间睡眠');
  }

  if ((phq ?? 0) >= 10 || (gad ?? 0) >= 10 || (gds !== undefined && gds >= 5) || emotion.loneliness === 'moderate' || emotion.loneliness === 'severe' || (lsns !== undefined && lsns < 12)) {
    addUnique(plan.psychosocial, '建议心理评估与情绪干预，增加社会参与和家庭支持');
  } else {
    addUnique(plan.psychosocial, '鼓励持续社交互动与兴趣活动，维持良好心理状态');
  }

  if (screenings.cognitiveRisk === 'moderate' || screenings.cognitiveRisk === 'high' || (miniCog !== undefined && miniCog <= 3)) {
    addUnique(plan.followup, '建议神经心理评估与可逆因素排查');
  }
  if (screenings.osteoporosisRisk === 'high' || (osta !== undefined && osta <= -4)) {
    addUnique(plan.followup, '建议骨密度（DXA）检测与抗骨质疏松评估');
  }

  if (riskLevel === RiskLevel.RED) {
    addUnique(plan.followup, '1个月内复评老年专项关键指标并落实多学科干预');
    addUnique(plan.followup, '必要时转诊老年医学/康复/精神心理专科');
  } else if (riskLevel === RiskLevel.YELLOW) {
    addUnique(plan.followup, '3个月内复评，重点追踪已命中风险项');
  } else {
    addUnique(plan.followup, '6个月常规复评，持续健康维护');
  }

  const scaleSummaries: NonNullable<ElderlyAssessmentResult['scaleSummaries']> = ELDERLY_SCALES.map((def) => {
    const entry = scores[def.id];
    if (!entry) return null;
    return { scaleId: def.id, name: def.name, total: entry.total, label: entry.label };
  }).filter(Boolean) as NonNullable<ElderlyAssessmentResult['scaleSummaries']>;

  if (scores.osta) {
    scaleSummaries.push({
      scaleId: 'osta',
      name: 'OSTA 指数',
      total: scores.osta.total,
      label: scores.osta.label,
    });
  }

  const domainFindings = ELDERLY_DOMAINS.map((domain) => {
    const domainScales = scaleSummaries?.filter((s) =>
      ELDERLY_SCALES.find((d) => d.id === s.scaleId)?.domain === domain.id,
    );
    const findings: string[] = [];
    if (domain.id === 'checkup') {
      if (checkupMetrics.sbp) findings.push(`收缩压 ${checkupMetrics.sbp} mmHg`);
      if (checkupMetrics.bmi) findings.push(`BMI ${checkupMetrics.bmi}`);
      if (checkupMetrics.fastingGlucose) findings.push(`空腹血糖 ${checkupMetrics.fastingGlucose} mmol/L`);
    }
    domainScales?.forEach((s) => findings.push(`${s.name}：${s.total} 分（${s.label}）`));
    if (domain.id === 'function' && functionalStatus.gaitSpeed !== undefined) {
      findings.push(`4米步速 ${functionalStatus.gaitSpeed} m/s`);
    }
    if (domain.id === 'screening' && scores.osta) {
      findings.push(`OSTA：${scores.osta.total}（${scores.osta.label}）`);
    }
    return { domain: domain.id, label: domain.label, findings };
  }).filter((d) => d.findings.length > 0);

  return {
    riskLevel,
    summary: `老年专项评估（CGA）分级为${riskLevel === RiskLevel.RED ? '高风险' : riskLevel === RiskLevel.YELLOW ? '中风险' : '低风险'}，共识别${reasons.length}项关键信号。`,
    reasons,
    domainFindings,
    scaleSummaries,
    personalizedPlan: plan,
  };
};

export const mergeElderlyResultToAssessment = (
  base: HealthAssessment,
  result: ElderlyAssessmentResult,
): HealthAssessment => ({
  ...base,
  elderlyRiskLevel: result.riskLevel,
  elderlyRiskSummary: result.summary,
  elderlyRiskReasons: result.reasons,
  elderlyPersonalizedPlan: result.personalizedPlan,
});
