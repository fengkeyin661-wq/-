/** 糖尿病人群应检项目目录（可扩展） */

export type ScreeningItemSource = 'screening' | 'checkup' | 'questionnaire';

export interface ScreeningCatalogItem {
  id: string;
  label: string;
  referenceRange: string;
  clinicalMeaning: string;
  retestCycle: string;
  isCoreForDiabetes: boolean;
  priority: 'high' | 'medium' | 'low';
  /** 筛查记录字段路径 */
  screeningFields?: (keyof import('../types').DiabetesScreeningRecord)[];
  /** checkup 快照检测路径 */
  checkupPaths?: string[];
}

export const DIABETES_SCREENING_CATALOG: ScreeningCatalogItem[] = [
  {
    id: 'glucose_fasting',
    label: '空腹血糖',
    referenceRange: '3.9–6.1 mmol/L',
    clinicalMeaning: '反映基础血糖水平，是糖尿病诊断与监测的核心指标',
    retestCycle: '每3个月（已确诊）/ 每年（高危人群）',
    isCoreForDiabetes: true,
    priority: 'high',
    screeningFields: ['glucoseValue'],
    checkupPaths: ['checkup.labBasic.glucose.fasting'],
  },
  {
    id: 'glucose_postprandial',
    label: '餐后2小时血糖',
    referenceRange: '<7.8 mmol/L（正常）',
    clinicalMeaning: '反映餐后血糖负荷，有助于发现糖耐量异常',
    retestCycle: '每3–6个月',
    isCoreForDiabetes: true,
    priority: 'high',
    screeningFields: ['glucoseValue'],
    checkupPaths: [],
  },
  {
    id: 'hba1c',
    label: '糖化血红蛋白（HbA1c）',
    referenceRange: '<6.5%（一般控制目标）',
    clinicalMeaning: '反映近2–3个月平均血糖，是评估长期血糖控制的金标准',
    retestCycle: '每3个月',
    isCoreForDiabetes: true,
    priority: 'high',
    checkupPaths: ['checkup.optional.hba1c'],
  },
  {
    id: 'ecg',
    label: '心电图',
    referenceRange: '无显著异常',
    clinicalMeaning: '筛查心脏并发症及心律失常风险',
    retestCycle: '每年',
    isCoreForDiabetes: true,
    priority: 'medium',
    screeningFields: ['ecgResult', 'ecgAbnormal'],
    checkupPaths: ['checkup.imagingBasic.ecg'],
  },
  {
    id: 'arteriosclerosis',
    label: '动脉硬化检测（含ABI/PWV）',
    referenceRange: 'ABI 0.9–1.3；PWV 正常参考因设备而异',
    clinicalMeaning: '评估外周动脉及大血管硬化程度，预测心血管事件风险',
    retestCycle: '每年',
    isCoreForDiabetes: true,
    priority: 'high',
    screeningFields: ['abi', 'pwv', 'arteriosclerosisConclusion', 'rightArmSbp', 'rightArmDbp'],
    checkupPaths: ['checkup.optional.carotidUltrasound'],
  },
  {
    id: 'fundus',
    label: '眼底照相',
    referenceRange: '无糖尿病视网膜病变',
    clinicalMeaning: '筛查糖尿病视网膜病变，早期干预可防失明',
    retestCycle: '每年（无病变）/ 每3–6个月（有病变）',
    isCoreForDiabetes: true,
    priority: 'high',
    screeningFields: ['fundusResult', 'fundusGrade', 'referralNeeded'],
    checkupPaths: ['checkup.optional.fundusPhoto'],
  },
  {
    id: 'body_composition',
    label: '人体成分分析',
    referenceRange: '体脂率因性别年龄而异；内脏脂肪等级≤9为佳',
    clinicalMeaning: '评估体脂分布与肌肉量，指导体重与代谢管理',
    retestCycle: '每3–6个月',
    isCoreForDiabetes: true,
    priority: 'medium',
    screeningFields: ['bodyFatRate', 'visceralFatLevel', 'muscleMass', 'bmi', 'weight'],
    checkupPaths: ['checkup.basics.bmi', 'checkup.basics.weight'],
  },
  {
    id: 'lipids',
    label: '血脂四项',
    referenceRange: 'LDL-C <2.6 mmol/L（合并ASCVD <1.8）',
    clinicalMeaning: '评估动脉粥样硬化风险，糖尿病患者常合并血脂异常',
    retestCycle: '每年',
    isCoreForDiabetes: true,
    priority: 'high',
    checkupPaths: ['checkup.labBasic.lipids.tc', 'checkup.labBasic.lipids.ldl'],
  },
  {
    id: 'renal',
    label: '肾功能（肌酐/尿素/eGFR）',
    referenceRange: 'eGFR ≥60 mL/min/1.73m²',
    clinicalMeaning: '筛查糖尿病肾病，早期微量白蛋白尿期可逆转',
    retestCycle: '每年',
    isCoreForDiabetes: true,
    priority: 'high',
    checkupPaths: ['checkup.labBasic.renal.creatinine', 'checkup.labBasic.renal.urea'],
  },
  {
    id: 'urine_albumin',
    label: '尿微量白蛋白/尿蛋白',
    referenceRange: '尿蛋白阴性；UACR <30 mg/g',
    clinicalMeaning: '糖尿病肾病早期标志，需定期筛查',
    retestCycle: '每年',
    isCoreForDiabetes: true,
    priority: 'high',
    checkupPaths: ['checkup.labBasic.urineRoutine.protein'],
  },
  {
    id: 'carotid_us',
    label: '颈动脉彩超',
    referenceRange: '无显著斑块或狭窄',
    clinicalMeaning: '评估脑血管动脉粥样硬化风险',
    retestCycle: '每1–2年',
    isCoreForDiabetes: false,
    priority: 'medium',
    checkupPaths: ['checkup.optional.carotidUltrasound'],
  },
  {
    id: 'foot_exam',
    label: '糖尿病足筛查',
    referenceRange: '无溃疡、无显著感觉减退',
    clinicalMeaning: '预防糖尿病足溃疡与截肢',
    retestCycle: '每年（无病变）/ 每次就诊（有病变）',
    isCoreForDiabetes: true,
    priority: 'medium',
    checkupPaths: [],
  },
  {
    id: 'neuropathy',
    label: '糖尿病神经病变筛查',
    referenceRange: '10g尼龙丝试验阴性；震动觉正常',
    clinicalMeaning: '早期发现周围神经病变，预防足部并发症',
    retestCycle: '每年',
    isCoreForDiabetes: true,
    priority: 'medium',
    checkupPaths: [],
  },
];

/** 社区已开展的首期筛查项目 ID */
export const COMMUNITY_SCREENING_IDS = [
  'glucose_fasting',
  'glucose_postprandial',
  'ecg',
  'arteriosclerosis',
  'fundus',
  'body_composition',
];
