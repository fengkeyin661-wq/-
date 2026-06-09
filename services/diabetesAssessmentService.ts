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
  ScreeningCatalogItem,
} from './diabetesScreeningCatalog';
import {
  getDietGuidance,
  getExerciseGuidance,
  getIndicatorEducation,
  GUIDELINE_NOTES,
} from './diabetesEducationContent';

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
    (b.screeningDate || '').localeCompare(a.screeningDate || '')
  )[0];
};

const isItemPresent = (
  item: ScreeningCatalogItem,
  screening: DiabetesScreeningRecord | null,
  record: HealthRecord
): boolean => {
  if (item.screeningFields?.length && screening) {
    const hasScreening = item.screeningFields.some((f) => {
      const v = screening[f];
      if (typeof v === 'number') return Number.isFinite(v);
      if (typeof v === 'boolean') return true;
      return hasText(v);
    });
    if (hasScreening) {
      if (item.id === 'glucose_fasting' && screening.glucoseType === 'postprandial') return false;
      if (item.id === 'glucose_postprandial' && screening.glucoseType === 'fasting') return false;
      if (item.id === 'glucose_fasting' || item.id === 'glucose_postprandial') return true;
      return true;
    }
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

  const fasting = num(screening?.glucoseType === 'fasting' ? screening?.glucoseValue : checkup.labBasic?.glucose?.fasting);
  const post = num(screening?.glucoseType === 'postprandial' ? screening?.glucoseValue : undefined);

  if ((fasting != null && fasting >= 7.0) || (post != null && post >= 11.1)) return 'diabetes';
  if ((fasting != null && fasting >= 6.1) || (post != null && post >= 7.8)) return 'prediabetes';
  if ((fasting != null && fasting >= 6.1) || (post != null && post >= 7.8)) return 'high_glucose';
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

const evaluateGlucose = (
  screening: DiabetesScreeningRecord | null,
  checkup: CheckupData
): { findings: string[]; alerts: string[]; retest: DiabetesAssessmentResult['retestAdvice'] } => {
  const findings: string[] = [];
  const alerts: string[] = [];
  const retest: DiabetesAssessmentResult['retestAdvice'] = [];

  const fasting =
    screening?.glucoseType === 'fasting'
      ? screening.glucoseValue
      : num(checkup.labBasic?.glucose?.fasting);
  const post =
    screening?.glucoseType === 'postprandial' ? screening.glucoseValue : undefined;

  if (fasting != null) {
    if (fasting >= 11.1) {
      findings.push(`空腹血糖 ${fasting} mmol/L，达糖尿病诊断标准`);
      alerts.push('血糖显著升高，建议尽快内分泌科就诊，完善口服葡萄糖耐量试验及HbA1c');
      retest.push({
        itemId: 'glucose_fasting',
        label: '空腹血糖',
        currentFinding: `${fasting} mmol/L`,
        advice: '建议内分泌科就诊，完善OGTT及HbA1c，评估是否启动药物治疗',
        urgency: 'urgent',
      });
    } else if (fasting >= 7.0) {
      findings.push(`空腹血糖 ${fasting} mmol/L，符合糖尿病范围`);
      retest.push({
        itemId: 'glucose_fasting',
        label: '空腹血糖',
        currentFinding: `${fasting} mmol/L`,
        advice: '建议完善HbA1c，3个月内复测空腹血糖',
        urgency: 'soon',
      });
    } else if (fasting >= 6.1) {
      findings.push(`空腹血糖 ${fasting} mmol/L，处于糖尿病前期范围`);
      retest.push({
        itemId: 'glucose_fasting',
        label: '空腹血糖',
        currentFinding: `${fasting} mmol/L`,
        advice: '建议生活方式干预，6个月内复测并完善HbA1c',
        urgency: 'routine',
      });
    }
  }

  if (post != null) {
    if (post >= 11.1) {
      findings.push(`餐后2小时血糖 ${post} mmol/L，达糖尿病诊断标准`);
      alerts.push('餐后血糖显著升高，建议内分泌科进一步评估');
      retest.push({
        itemId: 'glucose_postprandial',
        label: '餐后2小时血糖',
        currentFinding: `${post} mmol/L`,
        advice: '建议内分泌科就诊，完善HbA1c及空腹血糖',
        urgency: 'urgent',
      });
    } else if (post >= 7.8) {
      findings.push(`餐后2小时血糖 ${post} mmol/L，处于糖耐量异常范围`);
      retest.push({
        itemId: 'glucose_postprandial',
        label: '餐后2小时血糖',
        currentFinding: `${post} mmol/L`,
        advice: '建议3–6个月内复测，加强餐后血糖管理',
        urgency: 'soon',
      });
    }
  }

  return { findings, alerts, retest };
};

const evaluateFundus = (screening: DiabetesScreeningRecord | null, checkup: CheckupData) => {
  const findings: string[] = [];
  const alerts: string[] = [];
  const retest: DiabetesAssessmentResult['retestAdvice'] = [];

  const result = screening?.fundusResult || checkup.optional?.fundusPhoto;
  const grade = screening?.fundusGrade || '';
  const referral = screening?.referralNeeded;

  if (!hasText(result) && !grade) return { findings, alerts, retest };

  const gradeNum = parseInt(String(grade).replace(/\D/g, ''), 10);
  const text = `${result || ''} ${grade || ''}`;

  if (referral || gradeNum >= 3 || /III|Ⅲ|3级|增殖|重度|严重/.test(text)) {
    findings.push(`眼底检查异常：${text.trim() || result}`);
    alerts.push('眼底病变达III级及以上或需转诊，请2周内至眼科专科就诊');
    retest.push({
      itemId: 'fundus',
      label: '眼底照相',
      currentFinding: text.trim() || String(result),
      advice: '2周内眼科专科就诊，按医嘱每3–6个月复查眼底',
      urgency: 'urgent',
    });
  } else if (/II|Ⅱ|2级|轻度|中度|病变|渗出|微动脉瘤/.test(text)) {
    findings.push(`眼底检查提示病变：${text.trim() || result}`);
    retest.push({
      itemId: 'fundus',
      label: '眼底照相',
      currentFinding: text.trim() || String(result),
      advice: '建议眼科专科评估，每6–12个月复查',
      urgency: 'soon',
    });
  } else if (hasText(result)) {
    findings.push(`眼底检查结果：${result}`);
  }

  return { findings, alerts, retest };
};

const evaluateArteriosclerosis = (screening: DiabetesScreeningRecord | null) => {
  const findings: string[] = [];
  const alerts: string[] = [];
  const retest: DiabetesAssessmentResult['retestAdvice'] = [];

  const abi = screening?.abi;
  const pwv = screening?.pwv;
  const conclusion = screening?.arteriosclerosisConclusion || '';
  const sbp = screening?.rightArmSbp;
  const dbp = screening?.rightArmDbp;

  if (sbp != null && sbp >= 140) findings.push(`右臂收缩压 ${sbp} mmHg，偏高`);
  if (dbp != null && dbp >= 90) findings.push(`右臂舒张压 ${dbp} mmHg，偏高`);
  if (sbp != null && sbp >= 180) alerts.push('血压显著升高，请尽快就医评估');

  if (abi != null && abi < 0.9) {
    findings.push(`ABI ${abi}，提示外周动脉疾病可能`);
    alerts.push('ABI异常，建议血管外科或心内科进一步评估');
    retest.push({
      itemId: 'arteriosclerosis',
      label: '动脉硬化检测',
      currentFinding: `ABI ${abi}`,
      advice: '建议血管外科/心内科就诊，完善下肢动脉彩超',
      urgency: 'soon',
    });
  } else if (abi != null && abi > 1.3) {
    findings.push(`ABI ${abi}，可能存在血管钙化`);
    retest.push({
      itemId: 'arteriosclerosis',
      label: '动脉硬化检测',
      currentFinding: `ABI ${abi}`,
      advice: '建议血管专科进一步评估',
      urgency: 'routine',
    });
  }

  if (pwv != null && pwv >= 14) {
    findings.push(`PWV ${pwv} cm/s，动脉弹性减退`);
    retest.push({
      itemId: 'arteriosclerosis',
      label: '动脉硬化检测',
      currentFinding: `PWV ${pwv}`,
      advice: '建议心内科评估心血管风险，每年复查',
      urgency: 'routine',
    });
  }

  if (/重度|严重|显著|闭塞|狭窄/.test(conclusion)) {
    findings.push(`动脉硬化结论：${conclusion}`);
    alerts.push('动脉硬化显著异常，建议心内科或血管外科就诊');
  } else if (hasText(conclusion)) {
    findings.push(`动脉硬化结论：${conclusion}`);
  }

  return { findings, alerts, retest };
};

const evaluateEcg = (screening: DiabetesScreeningRecord | null, checkup: CheckupData) => {
  const findings: string[] = [];
  const alerts: string[] = [];
  const retest: DiabetesAssessmentResult['retestAdvice'] = [];

  const result = screening?.ecgResult || checkup.imagingBasic?.ecg;
  const abnormal = screening?.ecgAbnormal;

  if (!hasText(result) && abnormal == null) return { findings, alerts, retest };

  const text = String(result || '');
  if (
    abnormal ||
    /梗死|缺血|显著|明显|房颤|室速|ST抬高|ST压低|病理性Q|传导阻滞/.test(text)
  ) {
    findings.push(`心电图异常：${text || '异常'}`);
    alerts.push('心电图显著异常，建议心内科就诊，必要时完善动态心电图或心脏彩超');
    retest.push({
      itemId: 'ecg',
      label: '心电图',
      currentFinding: text || '异常',
      advice: '建议心内科就诊，完善动态心电图/心脏彩超',
      urgency: 'soon',
    });
  } else if (hasText(result)) {
    findings.push(`心电图：${result}`);
  }

  return { findings, alerts, retest };
};

const evaluateBodyComposition = (screening: DiabetesScreeningRecord | null, checkup: CheckupData) => {
  const findings: string[] = [];
  const retest: DiabetesAssessmentResult['retestAdvice'] = [];

  const bfr = screening?.bodyFatRate ?? num(checkup.basics?.bmi);
  const visceral = screening?.visceralFatLevel;
  const bmi = screening?.bmi ?? num(checkup.basics?.bmi);

  if (bfr != null && bfr > 28) findings.push(`体脂率 ${bfr}%，偏高`);
  if (visceral != null && visceral >= 10) findings.push(`内脏脂肪等级 ${visceral}，偏高`);
  if (bmi != null && bmi >= 28) findings.push(`BMI ${bmi}，肥胖`);
  else if (bmi != null && bmi >= 24) findings.push(`BMI ${bmi}，超重`);

  if ((bfr != null && bfr > 28) || (visceral != null && visceral >= 10) || (bmi != null && bmi >= 24)) {
    retest.push({
      itemId: 'body_composition',
      label: '人体成分分析',
      currentFinding: [
        bfr != null ? `体脂率${bfr}%` : '',
        visceral != null ? `内脏脂肪${visceral}` : '',
        bmi != null ? `BMI${bmi}` : '',
      ]
        .filter(Boolean)
        .join('，'),
      advice: '建议3个月后复测体成分，配合膳食运动干预',
      urgency: 'routine',
    });
  }

  return { findings, alerts: [] as string[], retest };
};

const buildMissedItems = (
  ctx: MergedDiabetesContext,
  record: HealthRecord
): DiabetesAssessmentResult['missedItems'] => {
  const { latestScreening } = ctx;
  const missed: DiabetesAssessmentResult['missedItems'] = [];

  for (const item of DIABETES_SCREENING_CATALOG) {
    if (isItemPresent(item, latestScreening, record)) continue;
    missed.push({
      itemId: item.id,
      label: item.label,
      priority: item.priority,
      reason: item.isCoreForDiabetes
        ? '糖尿病人群应定期检测的项目，当前档案中未见有效记录'
        : '建议完善相关检查以全面评估并发症风险',
      recommendedCycle: item.retestCycle,
    });
  }

  if (!ctx.hasAnnualCheckup) {
    missed.unshift({
      itemId: 'annual_checkup',
      label: '年度健康体检报告',
      priority: 'high',
      reason: '尚未关联年度体检档案，血脂、肾功能、HbA1c等数据可能不完整',
      recommendedCycle: '每年至少1次',
    });
  }

  return missed.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
};

export const evaluateDiabetesScreening = (
  record: HealthRecord
): DiabetesAssessmentResult => {
  const ctx = mergeScreeningWithCheckup(
    record.diabetesManagement,
    record.checkup,
    record.questionnaire
  );
  const { latestScreening } = ctx;

  const screeningFindings: string[] = [];
  const complicationAlerts: string[] = [];
  const retestAdvice: DiabetesAssessmentResult['retestAdvice'] = [];

  if (!latestScreening && !ctx.dm.screenings?.length) {
    screeningFindings.push('暂无社区并发症筛查记录，请先录入或导入筛查数据');
  } else {
    const parts = [
      evaluateGlucose(latestScreening, ctx.checkup),
      evaluateFundus(latestScreening, ctx.checkup),
      evaluateArteriosclerosis(latestScreening),
      evaluateEcg(latestScreening, ctx.checkup),
      evaluateBodyComposition(latestScreening, ctx.checkup),
    ];
    for (const p of parts) {
      screeningFindings.push(...p.findings);
      complicationAlerts.push(...p.alerts);
      retestAdvice.push(...p.retest);
    }
    if (!screeningFindings.length) {
      screeningFindings.push('本次筛查未见显著异常，请继续保持健康生活方式并定期复查');
    }
  }

  const missedItems = buildMissedItems(ctx, record);

  const testedIds = DIABETES_SCREENING_CATALOG.filter((item) =>
    isItemPresent(item, latestScreening, record)
  ).map((i) => i.id);
  const eduIds = [...new Set([...testedIds, ...missedItems.map((m) => m.itemId)])].filter(
    (id) => id !== 'annual_checkup'
  );

  let riskLevel = RiskLevel.GREEN;
  if (complicationAlerts.length > 0) riskLevel = RiskLevel.RED;
  else if (
    screeningFindings.some((f) => /糖尿病|显著|异常|偏高|肥胖|超重|病变/.test(f)) ||
    missedItems.filter((m) => m.priority === 'high').length >= 3
  ) {
    riskLevel = RiskLevel.YELLOW;
  }
  if (
    screeningFindings.some((f) => /达糖尿病诊断|显著升高|III|增殖/.test(f))
  ) {
    riskLevel = RiskLevel.RED;
  }

  const dietPlan = getDietGuidance();
  const exercisePlan = getExerciseGuidance(riskLevel);

  const cohortLabel =
    ctx.dm.cohortTag === 'diabetes'
      ? '糖尿病人群'
      : ctx.dm.cohortTag === 'prediabetes'
        ? '糖尿病前期人群'
        : '血糖偏高人群';

  return {
    riskLevel,
    summary: `${cohortLabel}社区并发症筛查首次评估：风险分级为${
      riskLevel === RiskLevel.RED ? '高风险' : riskLevel === RiskLevel.YELLOW ? '中风险' : '低风险'
    }。本次识别 ${screeningFindings.length} 项检查提示，${missedItems.length} 项待补检/完善。`,
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
  const exercise = [
    result.exercisePlan.summary,
    ...result.exercisePlan.precautions.slice(0, 2),
  ];
  const monitoring = [
    ...result.retestAdvice.slice(0, 3).map((r) => `【糖尿病专栏】${r.label}：${r.advice}`),
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

/** 判断档案是否属于糖尿病专栏目标人群 */
export const isDiabetesCohort = (record: HealthRecord): boolean => {
  const diseases = record.questionnaire?.history?.diseases || [];
  if (diseases.some((d) => /糖尿病|血糖/.test(d))) return true;

  const dm = record.diabetesManagement;
  if (dm?.screenings?.length) return true;
  if (dm?.cohortTag) return true;

  const fasting = num(record.checkup?.labBasic?.glucose?.fasting);
  if (fasting != null && fasting >= 6.1) return true;

  const latest = getLatestScreening(dm || { screenings: [] });
  if (latest?.glucoseValue != null) {
    if (latest.glucoseType === 'fasting' && latest.glucoseValue >= 6.1) return true;
    if (latest.glucoseType === 'postprandial' && latest.glucoseValue >= 7.8) return true;
  }

  return false;
};

export const createEmptyDiabetesManagement = (): DiabetesManagementData => ({
  screenings: [],
});

export const createScreeningId = (): string =>
  `ds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** 将筛查记录同步到 checkup 快照，便于与年度体检合并评估 */
export const applyScreeningToHealthRecord = (
  record: HealthRecord,
  dm: DiabetesManagementData
): HealthRecord => {
  const latest = getLatestScreening(dm);
  if (!latest) return { ...record, diabetesManagement: dm };

  let next = { ...record, diabetesManagement: dm };
  next.checkup = { ...next.checkup };

  if (latest.glucoseValue != null) {
    next.checkup.labBasic = { ...next.checkup.labBasic, glucose: { ...next.checkup.labBasic?.glucose } };
    if (latest.glucoseType === 'postprandial') {
      next.riskModelExtras = { ...next.riskModelExtras, postprandialGlucose: latest.glucoseValue };
    } else {
      next.checkup.labBasic.glucose = { fasting: String(latest.glucoseValue) };
    }
  }
  if (latest.rightArmSbp != null) next.checkup.basics = { ...next.checkup.basics, sbp: latest.rightArmSbp };
  if (latest.rightArmDbp != null) next.checkup.basics = { ...next.checkup.basics, dbp: latest.rightArmDbp };
  if (latest.bmi != null) next.checkup.basics = { ...next.checkup.basics, bmi: latest.bmi };
  if (latest.weight != null) next.checkup.basics = { ...next.checkup.basics, weight: latest.weight };
  if (latest.bodyFatRate != null) {
    next.riskModelExtras = { ...next.riskModelExtras, bodyFatRate: latest.bodyFatRate };
  }
  if (latest.ecgResult) {
    next.checkup.imagingBasic = { ...next.checkup.imagingBasic, ecg: latest.ecgResult };
  }
  if (latest.fundusResult) {
    next.checkup.optional = { ...next.checkup.optional, fundusPhoto: latest.fundusResult };
  }

  return next;
};
