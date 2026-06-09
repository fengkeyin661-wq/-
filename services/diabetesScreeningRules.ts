/**
 * 社区糖尿病并发症初筛 — 评估规则（对齐实际 Excel 指标列）
 */
import type {
  DiabetesScreeningRecord,
  RetestAdviceItem,
} from '../types';

export type DomainStatus = 'normal' | 'borderline' | 'abnormal' | 'critical' | 'not_done';

export interface ScreeningDomainResult {
  domainId: string;
  label: string;
  status: DomainStatus;
  findings: string[];
  alerts: string[];
  retest: RetestAdviceItem[];
  score: number;
}

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

const hasText = (v: unknown): boolean =>
  v != null && String(v).trim().length > 0 && !/^(未查|无|正常|-+|—)$/i.test(String(v).trim());

const statusScore = (s: DomainStatus): number =>
  s === 'critical' ? 4 : s === 'abnormal' ? 3 : s === 'borderline' ? 2 : s === 'normal' ? 0 : -1;

const mergeStatus = (a: DomainStatus, b: DomainStatus): DomainStatus => {
  const order: DomainStatus[] = ['not_done', 'normal', 'borderline', 'abnormal', 'critical'];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
};

const getFasting = (s: DiabetesScreeningRecord | null): number | undefined =>
  num(s?.fastingGlucose) ??
  (s?.glucoseType === 'fasting' ? s?.glucoseValue : undefined) ??
  undefined;

const getPostprandial = (s: DiabetesScreeningRecord | null): number | undefined =>
  num(s?.postprandialRandomGlucose) ??
  (s?.glucoseType === 'postprandial' ? s?.glucoseValue : undefined) ??
  undefined;

/** 初筛五项完成度检测 */
export const INITIAL_SCREENING_CHECKS = [
  {
    id: 'glucose',
    label: '血糖（空腹/餐后随机）',
    isDone: (s: DiabetesScreeningRecord | null) =>
      getFasting(s) != null || getPostprandial(s) != null,
  },
  {
    id: 'ecg',
    label: '心电图',
    isDone: (s: DiabetesScreeningRecord | null) =>
      hasText(s?.ecgDiagnosisHint) ||
      hasText(s?.ecgResult) ||
      s?.ecgHeartRate != null,
  },
  {
    id: 'arteriosclerosis',
    label: '动脉硬化检测',
    isDone: (s: DiabetesScreeningRecord | null) =>
      s?.leftABI != null ||
      s?.rightABI != null ||
      s?.abi != null ||
      s?.leftBaPWV != null ||
      s?.rightBaPWV != null ||
      s?.cfPWV != null ||
      s?.pwv != null ||
      s?.rightArmSbp != null ||
      hasText(s?.arteriosclerosisRisk) ||
      hasText(s?.arteriosclerosisConclusion),
  },
  {
    id: 'fundus',
    label: '眼底照相',
    isDone: (s: DiabetesScreeningRecord | null) =>
      hasText(s?.rightEyeAssessment) ||
      hasText(s?.leftEyeAssessment) ||
      hasText(s?.fundusResult),
  },
  {
    id: 'body_composition',
    label: '人体成分分析',
    isDone: (s: DiabetesScreeningRecord | null) =>
      s?.bmi != null ||
      s?.bodyFatRate != null ||
      s?.inbodyScore != null ||
      s?.visceralFatArea != null ||
      s?.skeletalMuscleMass != null,
  },
] as const;

export const evaluateGlucoseDomain = (
  screening: DiabetesScreeningRecord | null,
  gender?: string
): ScreeningDomainResult => {
  const result: ScreeningDomainResult = {
    domainId: 'glucose',
    label: '血糖',
    status: 'not_done',
    findings: [],
    alerts: [],
    retest: [],
    score: 0,
  };

  const fasting = getFasting(screening);
  const post = getPostprandial(screening);
  if (fasting == null && post == null) return result;

  let status: DomainStatus = 'normal';

  if (fasting != null) {
    if (fasting < 3.9) {
      status = mergeStatus(status, 'critical');
      result.findings.push(`空腹血糖 ${fasting} mmol/L，偏低（低血糖风险）`);
      result.alerts.push('血糖偏低，若伴心慌出汗等不适请及时就医');
      result.retest.push({
        itemId: 'glucose_fasting',
        label: '空腹血糖',
        currentFinding: `${fasting} mmol/L`,
        advice: '排查低血糖原因，调整饮食/用药，必要时内分泌科就诊',
        urgency: 'urgent',
      });
    } else if (fasting >= 11.1) {
      status = 'critical';
      result.findings.push(`空腹血糖 ${fasting} mmol/L，升高`);
      result.alerts.push('空腹血糖升高，建议内分泌科就诊');
      result.retest.push({
        itemId: 'glucose_fasting',
        label: '空腹血糖',
        currentFinding: `${fasting} mmol/L`,
        advice: '完善 HbA1c、口服葡萄糖耐量试验，评估治疗方案',
        urgency: 'urgent',
      });
    } else if (fasting >= 7.0) {
      status = mergeStatus(status, 'abnormal');
      result.findings.push(`空腹血糖 ${fasting} mmol/L，达糖尿病诊断标准`);
      result.retest.push({
        itemId: 'glucose_fasting',
        label: '空腹血糖',
        currentFinding: `${fasting} mmol/L`,
        advice: '3个月内复测并完善 HbA1c',
        urgency: 'soon',
      });
    } else if (fasting >= 6.1) {
      status = mergeStatus(status, 'borderline');
      result.findings.push(`空腹血糖 ${fasting} mmol/L，糖尿病前期范围`);
      result.retest.push({
        itemId: 'glucose_fasting',
        label: '空腹血糖',
        currentFinding: `${fasting} mmol/L`,
        advice: '6个月内复测，强化生活方式干预',
        urgency: 'routine',
      });
    } else {
      result.findings.push(`空腹血糖 ${fasting} mmol/L，在正常范围`);
    }
  } else {
    result.findings.push('本次未测空腹血糖，建议补测以完整评估糖代谢状态');
    result.retest.push({
      itemId: 'glucose_fasting',
      label: '空腹血糖',
      currentFinding: '未检测',
      advice: '初筛应完善空腹血糖检测',
      urgency: 'soon',
    });
  }

  if (post != null) {
    if (post >= 11.1) {
      status = mergeStatus(status, 'critical');
      result.findings.push(`餐后随机血糖 ${post} mmol/L，升高`);
      result.alerts.push('餐后血糖升高，建议内分泌科进一步评估');
      result.retest.push({
        itemId: 'glucose_postprandial',
        label: '餐后随机血糖',
        currentFinding: `${post} mmol/L`,
        advice: '完善空腹血糖与 HbA1c，评估糖代谢状态',
        urgency: 'urgent',
      });
    } else if (post >= 7.8) {
      status = mergeStatus(status, 'abnormal');
      result.findings.push(`餐后随机血糖 ${post} mmol/L，糖耐量异常`);
      result.retest.push({
        itemId: 'glucose_postprandial',
        label: '餐后随机血糖',
        currentFinding: `${post} mmol/L`,
        advice: '3–6个月复测，关注餐后血糖管理',
        urgency: 'soon',
      });
    } else {
      result.findings.push(`餐后随机血糖 ${post} mmol/L，在正常范围`);
    }
  } else if (fasting != null) {
    result.findings.push('本次未测餐后随机血糖，建议补测');
    result.retest.push({
      itemId: 'glucose_postprandial',
      label: '餐后随机血糖',
      currentFinding: '未检测',
      advice: '初筛建议同时了解餐后血糖水平',
      urgency: 'routine',
    });
  }

  if (hasText(screening?.glucoseMetabolismRisk)) {
    const risk = String(screening!.glucoseMetabolismRisk);
    result.findings.push(`设备糖代谢风险评估：${risk}`);
    if (/高|中|异常|危险|升高/.test(risk) && status === 'normal') status = 'borderline';
    if (/高|严重|很高/.test(risk)) status = mergeStatus(status, 'abnormal');
  }

  result.status = status;
  result.score = statusScore(status);
  return result;
};

export const evaluateEcgDomain = (screening: DiabetesScreeningRecord | null): ScreeningDomainResult => {
  const result: ScreeningDomainResult = {
    domainId: 'ecg',
    label: '心电图',
    status: 'not_done',
    findings: [],
    alerts: [],
    retest: [],
    score: 0,
  };

  const hint = screening?.ecgDiagnosisHint || screening?.ecgResult || '';
  const hasMetrics =
    screening?.ecgHeartRate != null ||
    screening?.ecgPrInterval != null ||
    screening?.ecgQrsWidth != null;

  if (!hasText(hint) && !hasMetrics) return result;

  let status: DomainStatus = 'normal';
  const metrics: string[] = [];
  if (screening?.ecgHeartRate != null) metrics.push(`心率 ${screening.ecgHeartRate} bpm`);
  if (screening?.ecgPrInterval != null) metrics.push(`PR ${screening.ecgPrInterval} ms`);
  if (screening?.ecgQrsWidth != null) metrics.push(`QRS ${screening.ecgQrsWidth} ms`);
  if (screening?.ecgQtQtc) metrics.push(`QT/QTc ${screening.ecgQtQtc}`);
  if (screening?.ecgQrsAxis != null) metrics.push(`电轴 ${screening.ecgQrsAxis}°`);
  if (screening?.ecgRv5sv1) metrics.push(`RV5/SV1 ${screening.ecgRv5sv1} mV`);
  if (metrics.length) result.findings.push(`心电图参数：${metrics.join('；')}`);

  const hr = screening?.ecgHeartRate;
  if (hr != null) {
    if (hr < 50) {
      status = mergeStatus(status, 'borderline');
      result.findings.push(`心率偏慢（${hr} bpm），需结合症状评估`);
    } else if (hr > 100) {
      status = mergeStatus(status, 'borderline');
      result.findings.push(`心率偏快（${hr} bpm）`);
    }
  }

  const text = String(hint);
  if (
    screening?.ecgAbnormal ||
    /心肌梗死|急性冠脉|显著ST|ST抬高|ST压低|室速|室颤|高度房室阻滞|完全性.*阻滞|室性心动过速|心房颤动|心房纤颤|AF|缺血性|病理性Q|急性心肌/.test(
      text
    )
  ) {
    status = 'critical';
    result.findings.push(`心电图诊断提示：${text || '异常'}`);
    result.alerts.push('心电图提示异常，建议心内科就诊');
    result.retest.push({
      itemId: 'ecg',
      label: '心电图',
      currentFinding: text || '异常',
      advice: '心内科就诊，完善心肌酶、动态心电图或心脏彩超',
      urgency: 'urgent',
    });
  } else if (
    /缺血|T波|ST段|房早|室早|束支阻滞|左室高电压|肥大|传导阻滞|心律不齐|早搏/.test(text) &&
    !/未见异常|正常心电图|窦性心律正常/.test(text)
  ) {
    status = mergeStatus(status, 'abnormal');
    result.findings.push(`心电图异常：${text}`);
    result.retest.push({
      itemId: 'ecg',
      label: '心电图',
      currentFinding: text,
      advice: '心内科评估，必要时动态心电图或心脏彩超',
      urgency: 'soon',
    });
  } else if (hasText(text)) {
    result.findings.push(`心电图：${text}`);
  } else if (hasMetrics) {
    result.findings.push('心电图参数已记录，未见明确异常诊断描述');
  }

  result.status = status;
  result.score = statusScore(status);
  return result;
};

export const evaluateArteriosclerosisDomain = (
  screening: DiabetesScreeningRecord | null
): ScreeningDomainResult => {
  const result: ScreeningDomainResult = {
    domainId: 'arteriosclerosis',
    label: '动脉硬化检测',
    status: 'not_done',
    findings: [],
    alerts: [],
    retest: [],
    score: 0,
  };

  const leftABI = num(screening?.leftABI);
  const rightABI = num(screening?.rightABI ?? screening?.abi);
  const leftPWV = num(screening?.leftBaPWV);
  const rightPWV = num(screening?.rightBaPWV ?? screening?.pwv);
  const cfPWV = num(screening?.cfPWV);

  const hasData =
    leftABI != null ||
    rightABI != null ||
    leftPWV != null ||
    rightPWV != null ||
    cfPWV != null ||
    hasText(screening?.arteriosclerosisRisk) ||
    hasText(screening?.arteriosclerosisConclusion);

  if (!hasData) return result;

  let status: DomainStatus = 'normal';

  const evalABI = (abi: number, side: string) => {
    if (abi < 0.9) {
      status = mergeStatus(status, 'abnormal');
      result.findings.push(`${side}踝臂指数 ABI ${abi}，提示外周动脉病变可能`);
      result.alerts.push(`${side}ABI偏低，建议血管专科进一步评估`);
      result.retest.push({
        itemId: 'arteriosclerosis',
        label: '踝臂指数（ABI）',
        currentFinding: `${side} ${abi}`,
        advice: '血管外科/心内科就诊，完善下肢动脉彩超',
        urgency: 'soon',
      });
    } else if (abi < 1.0) {
      status = mergeStatus(status, 'borderline');
      result.findings.push(`${side}ABI ${abi}，临界偏低`);
    } else if (abi > 1.4) {
      status = mergeStatus(status, 'borderline');
      result.findings.push(`${side}ABI ${abi}，可能存在血管钙化`);
    } else {
      result.findings.push(`${side}ABI ${abi}，在正常范围`);
    }
  };

  if (leftABI != null) evalABI(leftABI, '左');
  if (rightABI != null) evalABI(rightABI, '右');
  if (leftABI != null && rightABI != null && Math.abs(leftABI - rightABI) >= 0.15) {
    status = mergeStatus(status, 'borderline');
    result.findings.push(`左右 ABI 不对称（差值 ${Math.abs(leftABI - rightABI).toFixed(2)}），建议血管评估`);
  }

  const evalBaPWV = (pwv: number, side: string) => {
    if (pwv >= 1800) {
      status = mergeStatus(status, 'abnormal');
      result.findings.push(`${side}臂踝 PWV ${pwv} cm/s，未在正常范围，动脉硬化程度偏高`);
      result.retest.push({
        itemId: 'arteriosclerosis',
        label: '臂踝脉搏波传导速度',
        currentFinding: `${side} ${pwv} cm/s`,
        advice: '心内科评估心血管风险，控制血压血脂血糖',
        urgency: 'soon',
      });
    } else if (pwv >= 1400) {
      status = mergeStatus(status, 'borderline');
      result.findings.push(`${side}臂踝 PWV ${pwv} cm/s，未在正常范围，弹性减退`);
    } else {
      result.findings.push(`${side}臂踝 PWV ${pwv} cm/s，在正常范围`);
    }
  };

  if (leftPWV != null) evalBaPWV(leftPWV, '左');
  if (rightPWV != null) evalBaPWV(rightPWV, '右');

  if (cfPWV != null) {
    if (cfPWV >= 12) {
      status = mergeStatus(status, 'abnormal');
      result.findings.push(`颈股 PWV ${cfPWV} m/s，未在正常范围，大动脉硬化`);
    } else if (cfPWV >= 10) {
      status = mergeStatus(status, 'borderline');
      result.findings.push(`颈股 PWV ${cfPWV} m/s，未在正常范围，动脉弹性减退`);
    } else {
      result.findings.push(`颈股 PWV ${cfPWV} m/s，在正常范围`);
    }
  }

  if (hasText(screening?.arteriosclerosisRisk)) {
    const risk = String(screening!.arteriosclerosisRisk);
    result.findings.push(`动脉硬化风险评估：${risk}`);
    if (/高|严重|很高/.test(risk)) status = mergeStatus(status, 'abnormal');
    else if (/中/.test(risk) && status === 'normal') status = 'borderline';
  }

  if (hasText(screening?.arteriosclerosisConclusion)) {
    const c = String(screening!.arteriosclerosisConclusion);
    if (/重度|严重|闭塞|狭窄|硬化明显/.test(c)) {
      status = mergeStatus(status, 'abnormal');
      result.findings.push(`动脉硬化结论：${c}`);
    } else {
      result.findings.push(`动脉硬化结论：${c}`);
    }
  }

  if (hasText(screening?.specialNote)) {
    result.findings.push(`特别提示：${screening!.specialNote}`);
    if (/紧急|立即|转诊|严重/.test(String(screening!.specialNote))) {
      status = mergeStatus(status, 'critical');
      result.alerts.push(`动脉硬化检测特别提示：${screening!.specialNote}`);
    }
  }

  result.status = status;
  result.score = statusScore(status);
  return result;
};

export const evaluateBloodPressureDomain = (
  screening: DiabetesScreeningRecord | null
): ScreeningDomainResult => {
  const result: ScreeningDomainResult = {
    domainId: 'blood_pressure',
    label: '血压',
    status: 'not_done',
    findings: [],
    alerts: [],
    retest: [],
    score: 0,
  };

  const rSbp = num(screening?.rightArmSbp);
  const rDbp = num(screening?.rightArmDbp);
  const lSbp = num(screening?.leftArmSbp);
  const lDbp = num(screening?.leftArmDbp);

  const hasRight = rSbp != null && rDbp != null;
  const hasLeft = lSbp != null && lDbp != null;
  if (!hasRight && !hasLeft) return result;

  let status: DomainStatus = 'normal';
  const measureParts: string[] = [];

  const assessArm = (sbp: number, dbp: number, side: string): DomainStatus => {
    measureParts.push(`${side}上肢 ${sbp}/${dbp} mmHg`);
    if (sbp >= 180 || dbp >= 110) return 'critical';
    if (sbp >= 140 || dbp >= 90) return 'abnormal';
    if (sbp >= 130 || dbp >= 80) return 'borderline';
    return 'normal';
  };

  if (hasRight) status = mergeStatus(status, assessArm(rSbp!, rDbp!, '右'));
  if (hasLeft) status = mergeStatus(status, assessArm(lSbp!, lDbp!, '左'));

  let interpretation = '均在正常范围';
  if (status === 'critical') {
    interpretation = '测量值明显升高，建议就医评估';
    result.alerts.push('血压偏高，建议就医评估');
    result.retest.push({
      itemId: 'blood_pressure',
      label: '血压',
      currentFinding: measureParts.join('；'),
      advice: '家庭血压监测，心内科评估降压方案',
      urgency: 'soon',
    });
  } else if (status === 'abnormal') {
    interpretation = '偏高，糖尿病人群建议控制在 <130/80 mmHg';
    result.retest.push({
      itemId: 'blood_pressure',
      label: '血压',
      currentFinding: measureParts.join('；'),
      advice: '家庭血压监测，心内科评估降压方案',
      urgency: 'soon',
    });
  } else if (status === 'borderline') {
    interpretation = '未达糖尿病人群理想血压目标（<130/80 mmHg）';
  }

  result.findings.push(
    `${measureParts.join('；')}。${interpretation}（正常参考范围：<130/80 mmHg，糖尿病人群）`
  );

  result.status = status;
  result.score = statusScore(status);
  return result;
};

export const evaluateFundusDomain = (screening: DiabetesScreeningRecord | null): ScreeningDomainResult => {
  const result: ScreeningDomainResult = {
    domainId: 'fundus',
    label: '眼底照相',
    status: 'not_done',
    findings: [],
    alerts: [],
    retest: [],
    score: 0,
  };

  const right = screening?.rightEyeAssessment || '';
  const left = screening?.leftEyeAssessment || '';
  const legacy = screening?.fundusResult || '';
  if (!hasText(right) && !hasText(left) && !hasText(legacy)) return result;

  let status: DomainStatus = 'normal';

  const evalEye = (text: string, side: string) => {
    const gradeNum = parseInt(String(text).replace(/\D/g, ''), 10);
    const combined = text + (screening?.fundusGrade || '');

    if (
      screening?.referralNeeded ||
      gradeNum >= 3 ||
      /III|Ⅲ|3级|4级|5级|增殖|PDR|重度|严重|需转诊|建议眼科/.test(combined)
    ) {
      status = mergeStatus(status, 'critical');
      result.findings.push(`${side}眼：${text}（需眼科专科评估）`);
      result.alerts.push(`${side}眼眼底病变需关注，建议2周内眼科就诊`);
      result.retest.push({
        itemId: 'fundus',
        label: '眼底照相',
        currentFinding: `${side}眼 ${text}`,
        advice: '2周内眼科专科就诊，按医嘱每3–6个月复查',
        urgency: 'urgent',
      });
    } else if (/II|Ⅱ|2级|中度|微动脉瘤|渗出|出血|病变|NPDR/.test(combined)) {
      status = mergeStatus(status, 'abnormal');
      result.findings.push(`${side}眼：${text}（糖尿病视网膜病变可能）`);
      result.retest.push({
        itemId: 'fundus',
        label: '眼底照相',
        currentFinding: `${side}眼 ${text}`,
        advice: '眼科专科评估，6–12个月复查',
        urgency: 'soon',
      });
    } else if (/I级|Ⅰ|1级|轻度|可疑/.test(combined)) {
      status = mergeStatus(status, 'borderline');
      result.findings.push(`${side}眼：${text}`);
    } else if (/未见|无异常|正常|未发现/.test(text)) {
      result.findings.push(`${side}眼：未见糖尿病视网膜病变`);
    } else if (hasText(text)) {
      result.findings.push(`${side}眼：${text}`);
    }
  };

  if (hasText(right)) evalEye(String(right), '右');
  if (hasText(left)) evalEye(String(left), '左');
  if (!hasText(right) && !hasText(left) && hasText(legacy)) evalEye(String(legacy), '双眼');

  if (hasText(right) && hasText(left) && /异常|病变/.test(right) !== /异常|病变/.test(left)) {
    result.findings.push('双眼评估结果不对称，建议眼科进一步检查');
  }

  result.status = status;
  result.score = statusScore(status);
  return result;
};

export const evaluateBodyCompositionDomain = (
  screening: DiabetesScreeningRecord | null,
  gender?: string
): ScreeningDomainResult => {
  const result: ScreeningDomainResult = {
    domainId: 'body_composition',
    label: '人体成分分析',
    status: 'not_done',
    findings: [],
    alerts: [],
    retest: [],
    score: 0,
  };

  const bmi = num(screening?.bmi);
  const bfr = num(screening?.bodyFatRate);
  const vfa = num(screening?.visceralFatArea);
  const smm = num(screening?.skeletalMuscleMass);
  const whr = num(screening?.waistHipRatio);
  const inbody = num(screening?.inbodyScore);
  const weight = num(screening?.weight);
  const height = num(screening?.height);

  if (bmi == null && bfr == null && vfa == null && smm == null && inbody == null) return result;

  let status: DomainStatus = 'normal';
  const isMale = gender === '男' || gender === 'MALE';

  if (height != null && weight != null) {
    result.findings.push(`身高 ${height} cm，体重 ${weight} kg`);
  }

  if (bmi != null) {
    if (bmi >= 28) {
      status = mergeStatus(status, 'abnormal');
      result.findings.push(`BMI ${bmi} kg/m²，肥胖`);
    } else if (bmi >= 24) {
      status = mergeStatus(status, 'borderline');
      result.findings.push(`BMI ${bmi} kg/m²，超重`);
    } else if (bmi < 18.5) {
      status = mergeStatus(status, 'borderline');
      result.findings.push(`BMI ${bmi} kg/m²，偏瘦`);
    } else {
      result.findings.push(`BMI ${bmi} kg/m²，正常范围`);
    }
  }

  if (bfr != null) {
    const high = isMale ? 25 : 30;
    const veryHigh = isMale ? 30 : 35;
    if (bfr >= veryHigh) {
      status = mergeStatus(status, 'abnormal');
      result.findings.push(`体脂率 ${bfr}%，偏高`);
    } else if (bfr >= high) {
      status = mergeStatus(status, 'borderline');
      result.findings.push(`体脂率 ${bfr}%，偏高`);
    } else {
      result.findings.push(`体脂率 ${bfr}%`);
    }
  }

  if (vfa != null) {
    if (vfa >= 100) {
      status = mergeStatus(status, 'abnormal');
      result.findings.push(`内脏脂肪面积 ${vfa} cm²，偏高（代谢风险增加）`);
      result.retest.push({
        itemId: 'body_composition',
        label: '内脏脂肪',
        currentFinding: `${vfa} cm²`,
        advice: '3个月复测，强化减重与有氧运动',
        urgency: 'routine',
      });
    } else {
      result.findings.push(`内脏脂肪面积 ${vfa} cm²，在正常范围`);
    }
  }

  if (smm != null) {
    result.findings.push(`骨骼肌质量 ${smm} kg`);
    if (bmi != null && bmi >= 24 && smm < (isMale ? 28 : 20)) {
      status = mergeStatus(status, 'borderline');
      result.findings.push('骨骼肌质量相对偏低，存在肌少症风险');
    }
  }

  if (whr != null) {
    const whrHigh = isMale ? 0.9 : 0.85;
    if (whr >= whrHigh) {
      status = mergeStatus(status, 'borderline');
      result.findings.push(`腰臀比 ${whr}，腹型肥胖倾向`);
    }
  }

  if (inbody != null) {
    if (inbody < 70) {
      status = mergeStatus(status, 'borderline');
      result.findings.push(`InBody 评分 ${inbody}，体成分综合评分偏低`);
    } else {
      result.findings.push(`InBody 评分 ${inbody}`);
    }
  }

  if (status !== 'normal' && status !== 'not_done') {
    result.retest.push({
      itemId: 'body_composition',
      label: '人体成分分析',
      currentFinding: result.findings.join('；').slice(0, 80),
      advice: '3–6个月复测体成分，配合膳食运动干预',
      urgency: 'routine',
    });
  }

  result.status = status;
  result.score = statusScore(status);
  return result;
};

export const evaluateAllScreeningDomains = (
  screening: DiabetesScreeningRecord | null,
  gender?: string
): ScreeningDomainResult[] => [
  evaluateGlucoseDomain(screening, gender),
  evaluateEcgDomain(screening),
  evaluateArteriosclerosisDomain(screening),
  evaluateBloodPressureDomain(screening),
  evaluateFundusDomain(screening),
  evaluateBodyCompositionDomain(screening, gender),
];

export const computeOverallRiskFromDomains = (
  domains: ScreeningDomainResult[]
): { riskLevel: 'GREEN' | 'YELLOW' | 'RED'; maxScore: number } => {
  const done = domains.filter((d) => d.status !== 'not_done');
  if (!done.length) return { riskLevel: 'GREEN', maxScore: 0 };

  const maxScore = Math.max(...done.map((d) => d.score));
  const criticalCount = done.filter((d) => d.status === 'critical').length;
  const abnormalCount = done.filter((d) => d.status === 'abnormal').length;
  const borderlineCount = done.filter((d) => d.status === 'borderline').length;

  if (criticalCount > 0 || maxScore >= 4) return { riskLevel: 'RED', maxScore };
  if (abnormalCount >= 2 || maxScore >= 3) return { riskLevel: 'RED', maxScore };
  if (abnormalCount >= 1 || borderlineCount >= 2 || maxScore >= 2) return { riskLevel: 'YELLOW', maxScore };
  return { riskLevel: 'GREEN', maxScore };
};
