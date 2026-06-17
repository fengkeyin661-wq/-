/** 糖尿病人群应检项目目录（可扩展） */

import type { DiabetesIndicatorCategoryId } from '../types';

export type ScreeningItemSource = 'screening' | 'checkup' | 'questionnaire';

export type { DiabetesIndicatorCategoryId };

export interface DiabetesIndicatorCategoryDef {
  id: DiabetesIndicatorCategoryId;
  label: string;
  sortOrder: number;
}

export const DIABETES_INDICATOR_CATEGORIES: DiabetesIndicatorCategoryDef[] = [
  { id: 'glucose_metabolism', label: '糖代谢监测', sortOrder: 1 },
  { id: 'insulin_function', label: '胰岛功能', sortOrder: 2 },
  { id: 'renal_urine', label: '肾脏与尿液', sortOrder: 3 },
  { id: 'lipid_homocysteine', label: '血脂与同型半胱氨酸', sortOrder: 4 },
  { id: 'macrovascular', label: '大血管评估', sortOrder: 5 },
  { id: 'microvascular', label: '微血管（眼底）', sortOrder: 6 },
  { id: 'cardiac', label: '心脏评估', sortOrder: 7 },
  { id: 'neuropathy_foot', label: '神经与足部', sortOrder: 8 },
  { id: 'body_composition', label: '人体成分', sortOrder: 9 },
];

export interface ScreeningCatalogItem {
  id: string;
  label: string;
  category: DiabetesIndicatorCategoryId;
  referenceRange: string;
  clinicalMeaning: string;
  retestCycle: string;
  isCoreForDiabetes: boolean;
  priority: 'high' | 'medium' | 'low';
  unit?: string;
  /** 筛查记录字段路径 */
  screeningFields?: (keyof import('../types').DiabetesScreeningRecord)[];
  /** 健康档案 checkup / riskModelExtras 等路径（相对 HealthRecord 根） */
  checkupPaths?: string[];
}

export const DIABETES_SCREENING_CATALOG: ScreeningCatalogItem[] = [
  {
    id: 'glucose_fasting',
    label: '空腹血糖',
    category: 'glucose_metabolism',
    referenceRange: '3.9–6.1 mmol/L',
    clinicalMeaning: '反映基础血糖水平，是糖尿病诊断与监测的核心指标',
    retestCycle: '每3个月（已确诊）/ 每年（高危人群）',
    isCoreForDiabetes: true,
    priority: 'high',
    unit: 'mmol/L',
    screeningFields: ['fastingGlucose', 'glucoseValue'],
    checkupPaths: ['checkup.labBasic.glucose.fasting'],
  },
  {
    id: 'glucose_postprandial',
    label: '餐后2小时血糖',
    category: 'glucose_metabolism',
    referenceRange: '<7.8 mmol/L（正常）',
    clinicalMeaning: '反映餐后血糖负荷，有助于发现糖耐量异常',
    retestCycle: '每3–6个月',
    isCoreForDiabetes: true,
    priority: 'high',
    unit: 'mmol/L',
    screeningFields: ['postprandialRandomGlucose', 'glucoseValue'],
    checkupPaths: ['riskModelExtras.postprandialGlucose'],
  },
  {
    id: 'hba1c',
    label: '糖化血红蛋白（HbA1c）',
    category: 'glucose_metabolism',
    referenceRange: '<7.0%（个体化控制目标）',
    clinicalMeaning: '反映近2–3个月平均血糖，是评估长期血糖控制的金标准',
    retestCycle: '每3个月',
    isCoreForDiabetes: true,
    priority: 'high',
    unit: '%',
    screeningFields: ['hba1c'],
    checkupPaths: ['checkup.labBasic.hba1c', 'checkup.optional.hba1c'],
  },
  {
    id: 'insulin_fasting',
    label: '胰岛素测定（空腹）',
    category: 'insulin_function',
    referenceRange: '2.6–24.9 μIU/mL（因方法而异）',
    clinicalMeaning: '评估空腹胰岛素分泌水平，辅助判断胰岛素抵抗',
    retestCycle: '初诊或方案调整时；稳定后随年度复查',
    isCoreForDiabetes: false,
    priority: 'medium',
    unit: 'μIU/mL',
    screeningFields: ['insulinFasting'],
    checkupPaths: ['riskModelExtras.insulinFasting', 'checkup.labBasic.insulinFasting'],
  },
  {
    id: 'insulin_postprandial',
    label: '胰岛素测定（餐后2h）',
    category: 'insulin_function',
    referenceRange: '因实验室方法而异',
    clinicalMeaning: '反映餐后胰岛素分泌与代偿能力',
    retestCycle: '初诊或方案调整时',
    isCoreForDiabetes: false,
    priority: 'medium',
    screeningFields: ['insulinPostprandial2h'],
    checkupPaths: ['riskModelExtras.insulinPostprandial2h', 'checkup.labBasic.insulinPostprandial2h'],
  },
  {
    id: 'c_peptide_fasting',
    label: 'C肽测定（空腹）',
    category: 'insulin_function',
    referenceRange: '0.8–4.0 ng/mL（因方法而异）',
    clinicalMeaning: '反映内源性β细胞分泌功能，不受外源性胰岛素干扰',
    retestCycle: '初诊或方案调整时；稳定后随年度复查',
    isCoreForDiabetes: false,
    priority: 'medium',
    unit: 'ng/mL',
    screeningFields: ['cPeptideFasting'],
    checkupPaths: ['riskModelExtras.cPeptideFasting', 'checkup.labBasic.cPeptideFasting'],
  },
  {
    id: 'c_peptide_postprandial',
    label: 'C肽测定（餐后2h）',
    category: 'insulin_function',
    referenceRange: '因实验室方法而异',
    clinicalMeaning: '评估餐后β细胞分泌储备',
    retestCycle: '初诊或方案调整时',
    isCoreForDiabetes: false,
    priority: 'medium',
    screeningFields: ['cPeptidePostprandial2h'],
    checkupPaths: ['riskModelExtras.cPeptidePostprandial2h', 'checkup.labBasic.cPeptidePostprandial2h'],
  },
  {
    id: 'adiponectin',
    label: '脂联素测定',
    category: 'insulin_function',
    referenceRange: '因性别与方法而异',
    clinicalMeaning: '与胰岛素敏感性相关，低水平提示代谢风险',
    retestCycle: '科研或专科评估时；常规管理非必检',
    isCoreForDiabetes: false,
    priority: 'low',
    screeningFields: ['adiponectin'],
    checkupPaths: ['checkup.optional.adiponectin', 'riskModelExtras.adiponectin'],
  },
  {
    id: 'urine_routine',
    label: '尿常规+镜检',
    category: 'renal_urine',
    referenceRange: '蛋白、葡萄糖、潜血阴性',
    clinicalMeaning: '筛查泌尿系感染、蛋白尿、糖尿等异常',
    retestCycle: '每年',
    isCoreForDiabetes: true,
    priority: 'high',
    screeningFields: ['urineRoutineSummary', 'urineProtein'],
    checkupPaths: [
      'checkup.labBasic.urineRoutine.summary',
      'checkup.labBasic.urineRoutine.protein',
      'checkup.labBasic.urineRoutine.glucose',
      'checkup.labBasic.urineRoutine.blood',
    ],
  },
  {
    id: 'urine_albumin',
    label: '尿微量白蛋白/肌酐比值（UACR）',
    category: 'renal_urine',
    referenceRange: 'UACR <30 mg/g',
    clinicalMeaning: '糖尿病肾病早期标志，需定期筛查',
    retestCycle: '每年',
    isCoreForDiabetes: true,
    priority: 'high',
    unit: 'mg/g',
    screeningFields: ['uacr', 'urineProtein'],
    checkupPaths: [
      'riskModelExtras.uacr',
      'riskModelExtras.urineMicroalbuminCreatinine',
      'checkup.labBasic.urineRoutine.protein',
    ],
  },
  {
    id: 'renal',
    label: '肾功能3项',
    category: 'renal_urine',
    referenceRange: 'eGFR ≥60 mL/min/1.73m²',
    clinicalMeaning: '筛查糖尿病肾病及肾功能减退',
    retestCycle: '每年',
    isCoreForDiabetes: true,
    priority: 'high',
    screeningFields: ['creatinine', 'urea', 'uricAcid'],
    checkupPaths: [
      'checkup.labBasic.renal.creatinine',
      'checkup.labBasic.renal.urea',
      'checkup.labBasic.renal.ua',
    ],
  },
  {
    id: 'lipids',
    label: '血脂四项',
    category: 'lipid_homocysteine',
    referenceRange: 'LDL-C <2.6 mmol/L（合并ASCVD <1.8）',
    clinicalMeaning: '评估动脉粥样硬化风险，糖尿病患者常合并血脂异常',
    retestCycle: '每年',
    isCoreForDiabetes: true,
    priority: 'high',
    screeningFields: ['tc', 'tg', 'ldl', 'hdl'],
    checkupPaths: [
      'checkup.labBasic.lipids.tc',
      'checkup.labBasic.lipids.tg',
      'checkup.labBasic.lipids.ldl',
      'checkup.labBasic.lipids.hdl',
    ],
  },
  {
    id: 'homocysteine',
    label: '同型半胱氨酸',
    category: 'lipid_homocysteine',
    referenceRange: '5–15 μmol/L（因实验室而异）',
    clinicalMeaning: '升高与心血管及代谢风险相关',
    retestCycle: '每年（高危人群）',
    isCoreForDiabetes: false,
    priority: 'medium',
    unit: 'μmol/L',
    screeningFields: ['homocysteine'],
    checkupPaths: ['checkup.labBasic.homocysteine', 'checkup.optional.homocysteine'],
  },
  {
    id: 'carotid_us',
    label: '颈动脉彩超',
    category: 'macrovascular',
    referenceRange: '无显著斑块或狭窄',
    clinicalMeaning: '评估脑血管动脉粥样硬化风险',
    retestCycle: '每1–2年',
    isCoreForDiabetes: false,
    priority: 'medium',
    screeningFields: ['carotidUltrasound'],
    checkupPaths: ['checkup.optional.carotidUltrasound'],
  },
  {
    id: 'lower_limb_us',
    label: '下肢血管彩超',
    category: 'macrovascular',
    referenceRange: '动脉血流通畅，无显著狭窄',
    clinicalMeaning: '筛查下肢动脉病变，预防糖尿病足与缺血',
    retestCycle: '有症状或高危时；一般每年评估',
    isCoreForDiabetes: false,
    priority: 'medium',
    screeningFields: ['lowerLimbVascularUltrasound'],
    checkupPaths: ['riskModelExtras.lowerLimbVascularUltrasound', 'checkup.optional.lowerLimbUltrasound'],
  },
  {
    id: 'arteriosclerosis',
    label: '动脉硬化检测（ABI/baPWV/cfPWV）',
    category: 'macrovascular',
    referenceRange: 'ABI 0.9–1.3；baPWV<1400 cm/s；cfPWV<10 m/s（参考）',
    clinicalMeaning: '评估外周动脉及大血管硬化程度，预测心血管事件风险',
    retestCycle: '每年',
    isCoreForDiabetes: true,
    priority: 'high',
    screeningFields: [
      'leftABI', 'rightABI', 'abi', 'leftBaPWV', 'rightBaPWV', 'pwv', 'cfPWV',
      'arteriosclerosisRisk', 'arteriosclerosisConclusion', 'rightArmSbp', 'rightArmDbp',
    ],
    checkupPaths: [
      'checkup.optional.arteriosclerosis.abi',
      'checkup.optional.arteriosclerosis.pwv',
      'checkup.optional.arteriosclerosis.conclusion',
    ],
  },
  {
    id: 'fundus',
    label: '眼底数码照相',
    category: 'microvascular',
    referenceRange: '无糖尿病视网膜病变',
    clinicalMeaning: '筛查糖尿病视网膜病变，早期干预可防失明',
    retestCycle: '每年（无病变）/ 每3–6个月（有病变）',
    isCoreForDiabetes: true,
    priority: 'high',
    screeningFields: ['rightEyeAssessment', 'leftEyeAssessment', 'fundusResult', 'fundusGrade', 'referralNeeded'],
    checkupPaths: ['checkup.optional.fundusPhoto'],
  },
  {
    id: 'ecg',
    label: '心电图',
    category: 'cardiac',
    referenceRange: '窦性心律，无显著ST-T异常',
    clinicalMeaning: '筛查心脏并发症及心律失常风险',
    retestCycle: '每年',
    isCoreForDiabetes: true,
    priority: 'medium',
    screeningFields: ['ecgDiagnosisHint', 'ecgResult', 'ecgHeartRate', 'ecgAbnormal'],
    checkupPaths: ['checkup.imagingBasic.ecg'],
  },
  {
    id: 'ncv',
    label: '神经传导速度',
    category: 'neuropathy_foot',
    referenceRange: '各神经传导速度在正常范围',
    clinicalMeaning: '客观评估周围神经传导功能，发现亚临床神经病变',
    retestCycle: '有症状或高危时；确诊神经病变后定期复查',
    isCoreForDiabetes: false,
    priority: 'medium',
    screeningFields: ['ncvResult'],
    checkupPaths: ['riskModelExtras.ncv', 'riskModelExtras.nerveConductionVelocity'],
  },
  {
    id: 'neuropathy',
    label: '糖尿病神经病变筛查',
    category: 'neuropathy_foot',
    referenceRange: '10g尼龙丝试验阴性；震动觉正常',
    clinicalMeaning: '早期发现周围神经病变，预防足部并发症',
    retestCycle: '每年',
    isCoreForDiabetes: true,
    priority: 'medium',
    screeningFields: ['neuropathyScreening'],
    checkupPaths: ['riskModelExtras.neuropathyScreening'],
  },
  {
    id: 'foot_exam',
    label: '糖尿病足筛查',
    category: 'neuropathy_foot',
    referenceRange: '无溃疡、无显著感觉减退',
    clinicalMeaning: '预防糖尿病足溃疡与截肢',
    retestCycle: '每年（无病变）/ 每次就诊（有病变）',
    isCoreForDiabetes: true,
    priority: 'medium',
    screeningFields: ['footExamResult'],
    checkupPaths: ['riskModelExtras.footExam'],
  },
  {
    id: 'body_composition',
    label: '人体成分分析（InBody）',
    category: 'body_composition',
    referenceRange: 'BMI 18.5–24；内脏脂肪面积<100 cm²；体脂率因性别而异',
    clinicalMeaning: '评估体脂分布、内脏脂肪与骨骼肌，指导体重与代谢管理',
    retestCycle: '每3–6个月',
    isCoreForDiabetes: true,
    priority: 'medium',
    screeningFields: [
      'bmi', 'bodyFatRate', 'visceralFatArea', 'skeletalMuscleMass', 'inbodyScore',
      'waistHipRatio', 'weight', 'height',
    ],
    checkupPaths: [
      'checkup.basics.bmi',
      'checkup.bodyComposition.inbodyScore',
      'checkup.bodyComposition.visceralFatArea',
      'checkup.bodyComposition.bodyFatRate',
    ],
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

export const getCatalogItemById = (id: string): ScreeningCatalogItem | undefined =>
  DIABETES_SCREENING_CATALOG.find((i) => i.id === id);

export const getCatalogItemsByCategory = (categoryId: DiabetesIndicatorCategoryId): ScreeningCatalogItem[] =>
  DIABETES_SCREENING_CATALOG.filter((i) => i.category === categoryId);
