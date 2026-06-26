
// Enums
export enum RiskLevel {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED',
}

export enum Gender {
  MALE = '男',
  FEMALE = '女',
}

// --- 1. 基础档案信息 (Q1-Q4) ---
export interface HealthProfile {
  checkupId: string; // Q2 体检编号
  name: string;      // Q1 姓名 (包含出生日期)
  dob?: string;      // Q1 出生日期
  gender: string;    // Q3 性别
  department: string; // Q4 部门
  phone?: string;    // 联系电话
  checkupDate?: string; // 体检日期
  age?: number;      // 计算出的年龄
}

// --- 2. 结构化体检数据 (Objective Data) ---

/** 人体成分分析（InBody 等，对齐糖尿病专项筛查） */
export interface BodyCompositionData {
  bodyFatRate?: number;
  bodyFatMass?: number;
  leanBodyMass?: number;
  skeletalMuscleMass?: number;
  muscleMass?: number;
  visceralFatArea?: number;
  visceralFatLevel?: number;
  waistHipRatio?: number;
  inbodyScore?: number;
  obesityDegree?: number;
  bmr?: number;
  targetWeight?: number;
}

/** 动脉硬化检测（ABI/PWV，对齐糖尿病专项筛查） */
export interface ArteriosclerosisData {
  leftBaPWV?: number;
  rightBaPWV?: number;
  cfPWV?: number;
  leftABI?: number;
  rightABI?: number;
  abi?: number;
  pwv?: number;
  grade?: string;
  conclusion?: string;
  risk?: string;
  specialNote?: string;
}

export interface CheckupData {
  // 1. 基础项目
  basics: {
    height?: number;
    weight?: number;
    bmi?: number;
    sbp?: number;
    dbp?: number;
    waist?: number; // 腰围 (China-PAR需要)
  };

  /** 人体成分分析（InBody 等） */
  bodyComposition?: BodyCompositionData;

  // 2-8, 11. 实验室检查 (基础)
  labBasic: {
    liver?: { [key: string]: string }; // 2. 肝功能九项
    ck?: string; // 3. 肌酸激酶
    lipids?: { tc?: string; tg?: string; hdl?: string; ldl?: string; }; // 4. 血脂四项
    renal?: { urea?: string; creatinine?: string; ua?: string; }; // 5. 肾功能三项
    bloodRoutine?: {
      wbc?: string;
      rbc?: string;
      hgb?: string;
      plt?: string;
      neut?: string;
      summary?: string;
    }; // 6. 血常规
    glucose?: { fasting?: string; }; // 7. 血糖
    urineRoutine?: {
      protein?: string;
      glucose?: string;
      blood?: string;
      summary?: string;
    }; // 8. 尿常规 (蛋白定性用于KDIGO)
    thyroidFunction?: { t3?: string; t4?: string; tsh?: string; }; // 11. 甲功三项
    hba1c?: string; // 糖化血红蛋白
    homocysteine?: string; // 同型半胱氨酸
    /** 胰岛功能（体检报告扩展） */
    insulinFasting?: string;
    insulinPostprandial2h?: string;
    cPeptideFasting?: string;
    cPeptidePostprandial2h?: string;
    /** 尿微量白蛋白/肌酐比值 */
    uacr?: string;
  };

  // 9-10. 影像与功能 (基础)
  imagingBasic: {
    ecg?: string; // 9. 心电图
    // 10. 彩超
    ultrasound: {
        thyroid?: string; // 甲状腺
        abdomen?: string; // 肝胆胰脾肾输尿管膀胱
        breast?: string; // 乳腺 (女)
        uterusAdnexa?: string; // 子宫附件 (女)
        prostate?: string; // 前列腺 (男)
    };
  };

  // 1-20. 自选项目 (任选5项)
  optional: {
    tct?: string; // 1. 妇科液基
    hpv?: string; // 2. HPV
    tumorMarkers4?: { cea?: string; afp?: string; ca199?: string; cy211?: string; }; // 3. 肿瘤四项
    tumorMarkers2?: { ca125?: string; ca153?: string; psa?: string; fpsa?: string; }; // 4. 肿瘤二项
    afpCeaQuant?: string; // 5. AFP/CEA定量
    heartUltrasound?: string; // 6. 心脏彩超
    rheumatoid?: { esr?: string; rf?: string; aso?: string; }; // 7. 类风湿三项
    homocysteine?: string; // 8. 同型半胱氨酸
    immuneSet?: string; // 9. 免疫全套
    tcd?: string; // 10. 颅内多普勒
    c13?: string; // 11. 碳13
    mammography?: string; // 12. 乳腺钼靶
    carotidUltrasound?: string; // 13. 颈部血管彩超
    ct?: string; // 14. CT (部位+结论)
    boneDensity?: string; // 15. 骨密度
    fundusPhoto?: string; // 16. 眼底照相
    hba1c?: string; // 17. 糖化血红蛋白
    gastrin?: string; // 18. 胃功能
    adiponectin?: string; // 19. 脂联素
    vitD?: string; // 20. 25羟基维生素D
    /** 下肢血管彩超 */
    lowerLimbUltrasound?: string;
    /** 动脉硬化检测（ABI/PWV） */
    arteriosclerosis?: ArteriosclerosisData;
  };

  // 异常项汇总 (AI 提取)
  abnormalities: CheckupAbnormality[];
}

export interface CheckupAbnormality {
  category: string;
  item: string;
  result: string;
  clinicalSig: string;
}

// --- 3. 健康问卷数据 (Subjective Data - Updated) ---
export interface QuestionnaireData {
  // Q5-Q15 既往史
  history: {
    diseases: string[]; // Q5 选中的疾病
    details: {
        hypertensionYear?: string; // Q6
        cadTypes?: string[]; // Q7
        arrhythmiaType?: string; // Q8
        strokeTypes?: string[]; // Q9
        strokeYear?: string; // Q10
        diabetesYear?: string; // Q11
        tumorSite?: string; // Q12
        tumorYear?: string; // Q13
        otherHistory?: string; // Q14
    };
    surgeries?: string; // Q15
  };
  
  // [NEW] 女性健康史 (Gail & ADA 模型必须)
  femaleHealth: {
      menarcheAge?: number; // 初潮年龄
      firstBirthAge?: string; // 首次活产年龄 (<20, 20-24, 25-29, >=30, 未生育)
      menopauseStatus?: string; // 未绝经/已绝经
      menopauseAge?: number; // 绝经年龄
      breastBiopsy?: boolean; // 乳腺活检史
      gdmHistory?: boolean; // 妊娠期糖尿病史
      pcosHistory?: boolean; // PCOS史
  };

  // [NEW] 家族史 (China-PAR, FRAX, 肿瘤模型必须)
  familyHistory: {
      fatherCvdEarly?: boolean; // 父亲早发CVD (<55)
      motherCvdEarly?: boolean; // 母亲早发CVD (<65)
      diabetes?: boolean; // 父母兄弟姐妹
      hypertension?: boolean; // 父母兄弟姐妹
      stroke?: boolean; // 父母
      parentHipFracture?: boolean; // 父母髋部骨折 (FRAX)
      lungCancer?: boolean; // 肺癌
      colonCancer?: boolean; // 结直肠癌
      breastCancer?: boolean; // 乳腺癌 (母亲/姐妹/女儿)
  };

  // Q16-Q17 用药 (Updated: 结构化细节)
  medication: {
    isRegular: string; // Q16 是/否
    list?: string; // Q17 文本描述
    // [NEW] 结构化药物分类
    details: {
        antihypertensive?: boolean; // 降压药
        hypoglycemic?: boolean; // 降糖药/胰岛素
        lipidLowering?: boolean; // 降脂药
        antiplatelet?: boolean; // 阿司匹林/抗凝
        steroids?: boolean; // 长期激素 (FRAX)
    };
  };

  // Q18-Q27 膳食
  diet: {
    habits: string[]; // Q18
    stapleType?: string; // Q19 (e.g. 精米白面, 粗粮)
    coarseGrainFreq?: string; // Q20
    dailyStaple?: string; // Q21
    dailyVeg?: string; // Q22 (e.g. 每天>=300克)
    dailyFruit?: string; // Q23 (e.g. 每天>=200克)
    dailyMeat?: string; // Q24
    meatTypes?: string[]; // Q25
    dailyDairy?: string; // Q26 (e.g. 每天摄入)
    dailyBeanNut?: string; // Q27
  };

  // Q28-Q29 饮水
  hydration: {
      dailyAmount?: string; // Q28
      types?: string[]; // Q29
  };

  // Q30-Q33 运动
  exercise: {
    frequency?: string; // Q30
    types?: string[]; // Q31
    otherType?: string; // Q32
    duration?: string; // Q33
  };

  // Q34-Q38 睡眠
  sleep: {
      hours?: string; // Q34
      quality?: string; // Q35
      nap?: string; // Q36
      snore?: string; // Q37
      snoreMonitor?: string; // Q38 (Updated: 是/否)
      monitorResult?: string; // Q38 Result
  };

  // [NEW] 呼吸系统症状 (COPD-SQ 模型)
  respiratory: {
      chronicCough?: boolean; // 经常咳嗽
      chronicPhlegm?: boolean; // 经常咳痰
      shortBreath?: boolean; // 活动后气短
  };

  // Q39-Q49 烟酒
  substances: {
    smoking: {
        status?: string; // Q39
        quitYear?: string; // Q40
        dailyAmount?: number; // Q41 (Updated to number for calculation)
        years?: number; // Q42 (Updated to number)
        passive?: string[]; // Q43
        packYears?: number; // [NEW] 自动计算: (daily/20)*years
    };
    alcohol: {
        status?: string; // Q44
        types?: string[]; // Q45
        freq?: string; // Q46
        amount?: string; // Q47
        drunkHistory?: string; // Q48
        quitIntent?: string; // Q49
    };
  };

  // [NEW] 心理量表 (PHQ-9 & GAD-7)
  mentalScales: {
      phq9Score?: number; // 0-27 Total
      gad7Score?: number; // 0-21 Total
      selfHarmIdea?: number; // PHQ-9 Q9 (0-3)
      phq9Detail?: number[]; // [NEW] Array of 9 scores (0-3)
      gad7Detail?: number[]; // [NEW] Array of 7 scores (0-3)
  };

  // Q50-Q54 心理压力 (Legacy text fields)
  mental: {
    stressLevel?: string; // Q50
    stressSource?: string[]; // Q51
    otherSource?: string; // Q52
    reliefMethod?: string[]; // Q53
    otherRelief?: string; // Q54
  };
  
  // Q55-Q59 需求
  needs: {
    concerns?: string[]; // Q55
    otherConcern?: string; // Q56
    followUpWillingness?: string; // Q57
    desiredSupport?: string[]; // Q58
    otherSupport?: string; // Q59
  };

  // [NEW] 满意度调查
  satisfaction?: {
      reception?: string; // 前台接待
      medicalStaff?: string; // 医护人员耐心
      bloodDraw?: string; // 采血技术
      process?: string; // 体检流程/排队
      environment?: string; // 环境/隐私
      dissatisfactionDetail?: string; // 具体不满
      suggestion?: string; // 建议
  };
}

// --- 老年专项评估数据 ---
export interface ElderlyAssessmentData {
  checkupMetrics: {
    sbp?: number;
    dbp?: number;
    bmi?: number;
    fastingGlucose?: number;
    ldl?: number;
    egfr?: number;
    hgb?: number;
  };
  functionalStatus: {
    adlScore?: number; // 0-100
    iadlScore?: number; // 0-8
    gaitSpeed?: number; // m/s
    fallRisk?: 'low' | 'medium' | 'high';
    recentFalls?: number; // last 12 months
  };
  emotion: {
    depressionScore?: number;
    anxietyScore?: number;
    loneliness?: 'none' | 'mild' | 'moderate' | 'severe';
  };
  nutrition: {
    mnaScore?: number; // 0-14
    appetiteLoss?: boolean;
    weightLoss3m?: boolean;
  };
  visionOrHearing: {
    visionImpairment?: 'none' | 'mild' | 'moderate' | 'severe';
    hearingImpairment?: 'none' | 'mild' | 'moderate' | 'severe';
  };
  oralHealth: {
    chewingDifficulty?: boolean;
    missingTeethCount?: number;
    oralPain?: boolean;
  };
  sleep: {
    sleepHours?: number;
    insomniaSeverity?: 'none' | 'mild' | 'moderate' | 'severe';
    daytimeSleepiness?: boolean;
  };
  screenings: {
    cognitiveRisk?: 'none' | 'mild' | 'moderate' | 'high';
    frailty?: 'none' | 'pre' | 'frail';
    osteoporosisRisk?: 'low' | 'medium' | 'high';
    depressionScreenPositive?: boolean;
  };
}

// --- 糖尿病管理专栏数据 ---
export interface DiabetesScreeningRecord {
  id?: string;
  screeningDate?: string;
  activityName?: string;
  source?: 'manual' | 'excel_import' | 'checkup_import';
  /** 登记/筛查日期（Excel 登记日期） */
  registrationDate?: string;
  checkupCount?: number;
  checkStatus?: string;
  idCard?: string;
  screeningPhone?: string;
  /** 血糖 */
  fastingGlucose?: number;
  postprandialRandomGlucose?: number;
  glucoseType?: 'fasting' | 'postprandial';
  glucoseValue?: number;
  glucoseUnit?: string;
  glucoseMetabolismRisk?: string;
  /** 心电图 */
  ecgHeartRate?: number;
  ecgPrInterval?: number;
  ecgQrsWidth?: number;
  ecgQtQtc?: string;
  ecgQrsAxis?: number;
  ecgRv5sv1?: string;
  ecgDiagnosisHint?: string;
  ecgResult?: string;
  ecgAbnormal?: boolean;
  /** 动脉硬化 */
  leftBaPWV?: number;
  rightBaPWV?: number;
  cfPWV?: number;
  leftABI?: number;
  rightABI?: number;
  leftArmSbp?: number;
  leftArmDbp?: number;
  leftArmPulse?: number;
  rightArmSbp?: number;
  rightArmDbp?: number;
  rightArmPulse?: number;
  leftAnkleSbp?: number;
  leftAnkleDbp?: number;
  rightAnkleSbp?: number;
  rightAnkleDbp?: number;
  abi?: number;
  pwv?: number;
  arteriosclerosisGrade?: string;
  arteriosclerosisConclusion?: string;
  arteriosclerosisRisk?: string;
  /** 动脉硬化设备/报告特别提示 */
  arteriosclerosisSpecialNote?: string;
  /** @deprecated 兼容旧导入，将按内容分流至眼底或动脉硬化 */
  specialNote?: string;
  /** 眼底 */
  rightEyeAssessment?: string;
  leftEyeAssessment?: string;
  fundusResult?: string;
  fundusGrade?: string;
  /** 眼底照相特别提示（如小瞳孔、白内障致图像模糊等） */
  fundusSpecialNote?: string;
  referralNeeded?: boolean;
  /** 人体成分（InBody 等） */
  height?: number;
  weight?: number;
  bmi?: number;
  bodyFatRate?: number;
  bodyFatMass?: number;
  leanBodyMass?: number;
  skeletalMuscleMass?: number;
  /** InBody 报告：下限（骨骼肌质量正常范围） */
  skeletalMuscleRefLow?: number;
  /** InBody 报告：上限（骨骼肌质量正常范围） */
  skeletalMuscleRefHigh?: number;
  /** InBody 报告：下限（身体脂肪量正常范围） */
  bodyFatMassRefLow?: number;
  /** InBody 报告：上限（身体脂肪量正常范围） */
  bodyFatMassRefHigh?: number;
  muscleMass?: number;
  visceralFatArea?: number;
  visceralFatLevel?: number;
  waistHipRatio?: number;
  inbodyScore?: number;
  obesityDegree?: number;
  bmr?: number;
  targetWeight?: number;
  /** 扩展检验指标（年度体检/汇总表导入） */
  hba1c?: number | string;
  insulinFasting?: number;
  insulinPostprandial2h?: number;
  cPeptideFasting?: number;
  cPeptidePostprandial2h?: number;
  adiponectin?: number | string;
  homocysteine?: number;
  uacr?: number | string;
  urineRoutineSummary?: string;
  urineProtein?: string;
  creatinine?: number | string;
  urea?: number | string;
  uricAcid?: number | string;
  tc?: number | string;
  tg?: number | string;
  ldl?: number | string;
  hdl?: number | string;
  carotidUltrasound?: string;
  lowerLimbVascularUltrasound?: string;
  ncvResult?: string;
  neuropathyScreening?: string;
  footExamResult?: string;
  importMeta?: { fileName?: string; rowIndex?: number };
  /** AI 解析保留的原始列 */
  rawColumns?: Record<string, string | number>;
}

export interface DiabetesManagementData {
  cohortTag?: 'prediabetes' | 'diabetes' | 'high_glucose';
  screenings: DiabetesScreeningRecord[];
  annualCheckupLinked?: boolean;
  notes?: string;
}

/** 专项筛查独立参与者（无需预先建立 health_archives） */
export interface DiabetesStandaloneParticipant {
  id: string;
  /** 去重键：体检编号 / 身份证 / 电话等 */
  participantKey: string;
  checkupId?: string;
  name: string;
  gender?: string;
  age?: number;
  phone?: string;
  idCard?: string;
  checkupCount?: number;
  checkStatus?: string;
  activityName?: string;
  diabetesManagement: DiabetesManagementData;
  diabetesReport?: DiabetesAssessmentResult;
  /** 若后续完成正式建档，可记录关联的 health_archives.checkup_id */
  linkedArchiveCheckupId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MissedScreeningItem {
  itemId: string;
  label: string;
  priority: 'high' | 'medium' | 'low';
  clinicalMeaning: string;
  recommendedCycle: string;
}

export interface RetestAdviceItem {
  itemId: string;
  label: string;
  currentFinding: string;
  advice: string;
  urgency: 'routine' | 'soon' | 'urgent';
}

export type DiabetesIndicatorCategoryId =
  | 'glucose_metabolism'
  | 'insulin_function'
  | 'renal_urine'
  | 'lipid_homocysteine'
  | 'macrovascular'
  | 'microvascular'
  | 'cardiac'
  | 'neuropathy_foot'
  | 'body_composition';

export interface IndicatorEdu {
  itemId: string;
  label: string;
  concept: string;
  principle: string;
  referenceRange: string;
  clinicalMeaning: string;
  retestCycle: string;
}

/** 糖尿病分项指标档案 — 单条指标 */
export interface DiabetesIndicatorProfileItem {
  itemId: string;
  label: string;
  categoryId: DiabetesIndicatorCategoryId;
  categoryLabel: string;
  status: 'present' | 'missing';
  value?: string;
  unit?: string;
  referenceRange: string;
  clinicalMeaning: string;
  retestCycle: string;
  priority: 'high' | 'medium' | 'low';
  /** 数据来源：专项筛查 / 年度体检 / 两者 */
  dataSource?: 'screening' | 'checkup' | 'both';
  observedDate?: string;
  retestReminder?: string;
}

/** 糖尿病分项指标档案 — 分类汇总 */
export interface DiabetesIndicatorCategoryGroup {
  categoryId: DiabetesIndicatorCategoryId;
  label: string;
  items: DiabetesIndicatorProfileItem[];
  presentCount: number;
  missingCount: number;
}

/** 糖尿病分项指标档案 */
export interface DiabetesIndicatorProfile {
  categories: DiabetesIndicatorCategoryGroup[];
  totalItems: number;
  presentCount: number;
  missingCount: number;
  missingHighPriority: DiabetesIndicatorProfileItem[];
  linkedArchiveCheckupId?: string | null;
  archiveCheckupDate?: string;
  generatedAt: string;
}

export interface GiFoodItem {
  name: string;
  gi: 'low' | 'medium' | 'high';
  /** 参考 GI 值（葡萄糖=100） */
  giValue: number;
  note: string;
}

export interface GiEducationGuide {
  intro: string;
  standardNote: string;
  tiers: { level: 'low' | 'medium' | 'high'; label: string; range: string; description: string }[];
  disclaimer: string;
}

export interface DietGuidance {
  principles: string[];
  giEducation: GiEducationGuide;
  giFoods: GiFoodItem[];
  cookingTips: string[];
  eatingTips: string[];
}

export interface ExerciseGuidance {
  summary: string;
  weeklyPlan: { day: string; activity: string; duration: string; intensity: string }[];
  precautions: string[];
}

export interface ScreeningFindingSection {
  domainId: string;
  itemLabel: string;
  status: 'not_done' | 'done';
  paragraphs: string[];
}

export interface ScreeningFindingRow {
  domainLabel: string;
  itemLabel: string;
  result: string;
  referenceRange: string;
}

export interface ScreeningDomainSummary {
  domainId: string;
  label: string;
  status: 'normal' | 'borderline' | 'abnormal' | 'critical' | 'not_done';
  findings: string[];
}

export interface DiabetesAssessmentResult {
  riskLevel: RiskLevel;
  summary: string;
  /** 初筛五项分域评估 */
  screeningDomains?: ScreeningDomainSummary[];
  /** 初筛五项完成度 */
  initialScreeningCoverage?: { itemId: string; label: string; done: boolean }[];
  /** 本次检查风险提示（分项文本） */
  screeningFindingSections?: ScreeningFindingSection[];
  /** @deprecated 兼容旧报告 */
  screeningFindingRows?: ScreeningFindingRow[];
  /** @deprecated 兼容旧报告 */
  screeningFindings: string[];
  missedItems: MissedScreeningItem[];
  retestAdvice: RetestAdviceItem[];
  indicatorEducation: IndicatorEdu[];
  dietPlan: DietGuidance;
  exercisePlan: ExerciseGuidance;
  complicationAlerts: string[];
  guidelineNotes: string[];
  generatedAt: string;
  basedOnScreeningId?: string;
}

// --- 高血压专项筛查 ---

export type HypertensionIndicatorCategoryId =
  | 'bp_vascular'
  | 'target_organ'
  | 'metabolic_labs';

export interface HypertensionScreeningRecord {
  id?: string;
  screeningDate?: string;
  activityName?: string;
  source?: 'manual' | 'excel_import' | 'checkup_import' | 'archive_auto';
  registrationDate?: string;
  checkupCount?: number;
  checkStatus?: string;
  idCard?: string;
  screeningPhone?: string;
  /** 诊室血压 */
  sbp?: number;
  dbp?: number;
  heartRate?: number;
  /** 动态血压 */
  abpmSummary?: string;
  abpmDaySbp?: number;
  abpmDayDbp?: number;
  abpmNightSbp?: number;
  abpmNightDbp?: number;
  /** 颈动脉 */
  carotidUltrasound?: string;
  carotidImt?: number | string;
  carotidPlaque?: string;
  /** 心脏彩超 */
  echoResult?: string;
  lvh?: string;
  ejectionFraction?: number | string;
  /** 心电图 / 动态心电 */
  ecgResult?: string;
  holterResult?: string;
  /** 靶器官 */
  creatinine?: number | string;
  urea?: number | string;
  uacr?: number | string;
  urineProtein?: string;
  fundusResult?: string;
  brainCtResult?: string;
  homocysteine?: number;
  uricAcid?: number | string;
  alt?: number | string;
  ast?: number | string;
  tsh?: number | string;
  ft3?: number | string;
  ft4?: number | string;
  /** 代谢 */
  tc?: number | string;
  tg?: number | string;
  ldl?: number | string;
  hdl?: number | string;
  fastingGlucose?: number;
  hba1c?: number | string;
  potassium?: number | string;
  sodium?: number | string;
  chloride?: number | string;
  calcium?: number | string;
  /** 继发性高血压排查 */
  renin?: number | string;
  angiotensin?: number | string;
  aldosterone?: number | string;
  importMeta?: { fileName?: string; rowIndex?: number };
  rawColumns?: Record<string, string | number>;
}

export interface HypertensionManagementData {
  cohortTag?: 'elevated' | 'stage1' | 'stage2' | 'crisis';
  screenings: HypertensionScreeningRecord[];
  annualCheckupLinked?: boolean;
  notes?: string;
}

export interface HypertensionStandaloneParticipant {
  id: string;
  participantKey: string;
  checkupId?: string;
  name: string;
  gender?: string;
  age?: number;
  phone?: string;
  idCard?: string;
  checkupCount?: number;
  checkStatus?: string;
  activityName?: string;
  hypertensionManagement: HypertensionManagementData;
  hypertensionReport?: HypertensionAssessmentResult;
  linkedArchiveCheckupId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HypertensionIndicatorProfileItem {
  itemId: string;
  label: string;
  categoryId: HypertensionIndicatorCategoryId;
  categoryLabel: string;
  status: 'present' | 'missing';
  value?: string;
  unit?: string;
  referenceRange: string;
  clinicalMeaning: string;
  retestCycle: string;
  priority: 'high' | 'medium' | 'low';
  dataSource?: 'screening' | 'checkup' | 'both';
  observedDate?: string;
  retestReminder?: string;
}

export interface HypertensionIndicatorCategoryGroup {
  categoryId: HypertensionIndicatorCategoryId;
  label: string;
  items: HypertensionIndicatorProfileItem[];
  presentCount: number;
  missingCount: number;
}

export interface HypertensionIndicatorProfile {
  categories: HypertensionIndicatorCategoryGroup[];
  totalItems: number;
  presentCount: number;
  missingCount: number;
  missingHighPriority: HypertensionIndicatorProfileItem[];
  linkedArchiveCheckupId?: string | null;
  archiveCheckupDate?: string;
  generatedAt: string;
}

export interface HypertensionLifestyleGuidance {
  principles: string[];
  dietTips: string[];
  exerciseTips: string[];
  monitoringTips: string[];
  medicationTips: string[];
}

export interface HypertensionAssessmentResult {
  riskLevel: RiskLevel;
  summary: string;
  bpFindings: string[];
  screeningFindings: string[];
  missedItems: MissedScreeningItem[];
  retestAdvice: RetestAdviceItem[];
  lifestyleGuidance: HypertensionLifestyleGuidance;
  targetOrganAlerts: string[];
  guidelineNotes: string[];
  generatedAt: string;
  basedOnScreeningId?: string;
  indicatorProfile?: HypertensionIndicatorProfile;
}

// --- 血脂异常专项管理 ---

export type LipidIndicatorCategoryId =
  | 'basic_lipids'
  | 'advanced_lipids'
  | 'cardiovascular_risk'
  | 'metabolic_monitoring'
  | 'secondary_screening';

export interface LipidScreeningRecord {
  id?: string;
  screeningDate?: string;
  activityName?: string;
  source?: 'manual' | 'excel_import' | 'checkup_import' | 'archive_auto';
  registrationDate?: string;
  checkupCount?: number;
  checkStatus?: string;
  idCard?: string;
  screeningPhone?: string;
  /** 基础血脂 */
  tc?: number | string;
  tg?: number | string;
  ldl?: number | string;
  hdl?: number | string;
  nonHdl?: number | string;
  /** 进阶脂代谢 */
  apoB?: number | string;
  apoA1?: number | string;
  lpa?: number | string;
  sdLdl?: number | string;
  /** 心血管风险 */
  hsCrp?: number | string;
  homocysteine?: number;
  carotidUltrasound?: string;
  carotidImt?: number | string;
  carotidPlaque?: string;
  ecgResult?: string;
  abiSummary?: string;
  leftABI?: number;
  rightABI?: number;
  /** 合并症与监测 */
  fastingGlucose?: number;
  hba1c?: number | string;
  sbp?: number;
  dbp?: number;
  alt?: number | string;
  ast?: number | string;
  creatinine?: number | string;
  urea?: number | string;
  uacr?: number | string;
  uricAcid?: number | string;
  /** 继发性排查 */
  tsh?: number | string;
  ft3?: number | string;
  ft4?: number | string;
  urineProtein?: string;
  onLipidLowering?: boolean;
  importMeta?: { fileName?: string; rowIndex?: number };
  rawColumns?: Record<string, string | number>;
}

export interface LipidManagementData {
  cohortTag?: 'borderline' | 'hypercholesterolemia' | 'hypertriglyceridemia' | 'mixed' | 'very_high_risk';
  screenings: LipidScreeningRecord[];
  annualCheckupLinked?: boolean;
  notes?: string;
}

export interface LipidStandaloneParticipant {
  id: string;
  participantKey: string;
  checkupId?: string;
  name: string;
  gender?: string;
  age?: number;
  phone?: string;
  idCard?: string;
  checkupCount?: number;
  checkStatus?: string;
  activityName?: string;
  lipidManagement: LipidManagementData;
  lipidReport?: LipidAssessmentResult;
  linkedArchiveCheckupId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LipidIndicatorProfileItem {
  itemId: string;
  label: string;
  categoryId: LipidIndicatorCategoryId;
  categoryLabel: string;
  status: 'present' | 'missing';
  value?: string;
  unit?: string;
  referenceRange: string;
  clinicalMeaning: string;
  retestCycle: string;
  priority: 'high' | 'medium' | 'low';
  dataSource?: 'screening' | 'checkup' | 'both';
  observedDate?: string;
  retestReminder?: string;
}

export interface LipidIndicatorCategoryGroup {
  categoryId: LipidIndicatorCategoryId;
  label: string;
  items: LipidIndicatorProfileItem[];
  presentCount: number;
  missingCount: number;
}

export interface LipidIndicatorProfile {
  categories: LipidIndicatorCategoryGroup[];
  totalItems: number;
  presentCount: number;
  missingCount: number;
  missingHighPriority: LipidIndicatorProfileItem[];
  linkedArchiveCheckupId?: string | null;
  archiveCheckupDate?: string;
  generatedAt: string;
}

export interface LipidLifestyleGuidance {
  principles: string[];
  dietTips: string[];
  exerciseTips: string[];
  monitoringTips: string[];
  medicationTips: string[];
}

export interface LipidAssessmentResult {
  riskLevel: RiskLevel;
  summary: string;
  lipidFindings: string[];
  screeningFindings: string[];
  ascvdAlerts: string[];
  missedItems: MissedScreeningItem[];
  retestAdvice: RetestAdviceItem[];
  lifestyleGuidance: LipidLifestyleGuidance;
  guidelineNotes: string[];
  generatedAt: string;
  basedOnScreeningId?: string;
  indicatorProfile?: LipidIndicatorProfile;
}

// --- 4. 聚合数据对象 ---
export interface HealthRecord {
  profile: HealthProfile;
  checkup: CheckupData;
  questionnaire: QuestionnaireData;
  elderlyAssessment?: ElderlyAssessmentData;
  diabetesManagement?: DiabetesManagementData;
  hypertensionManagement?: HypertensionManagementData;
  lipidManagement?: LipidManagementData;
  // 用于存储模型计算时的补充变量 (如父母髋骨骨折史等不在常规问卷中的)
  riskModelExtras?: { [key: string]: any }; 
}

// --- 5. 评估与计划 ---
export interface HealthPlanTask {
  id: string;
  category: 'diet' | 'exercise' | 'medication' | 'monitoring' | 'other';
  description: string;
  targetValue?: string;
  frequency: string;
  isKeyGoal: boolean;
}

export interface HealthAssessment {
  riskLevel: RiskLevel;
  summary: string;
  isCritical?: boolean; 
  criticalWarning?: string; 
  risks: {
    red: string[]; 
    yellow: string[];
    green: string[];
  };
  managementPlan: {
    dietary: string[];
    exercise: string[];
    medication: string[];
    monitoring: string[];
  };
  structuredTasks?: HealthPlanTask[];
  followUpPlan: {
    frequency: string;
    nextCheckItems: string[];
  };
  elderlyRiskLevel?: RiskLevel;
  elderlyRiskSummary?: string;
  elderlyRiskReasons?: string[];
  elderlyPersonalizedPlan?: {
    diet: string[];
    exercise: string[];
    sleep: string[];
    psychosocial: string[];
    followup: string[];
  };
  diabetesRiskLevel?: RiskLevel;
  diabetesReport?: DiabetesAssessmentResult;
  hypertensionRiskLevel?: RiskLevel;
  hypertensionReport?: HypertensionAssessmentResult;
  lipidRiskLevel?: RiskLevel;
  lipidReport?: LipidAssessmentResult;
}

// Timeline item
export interface ScheduledFollowUp {
  id: string;
  date: string;
  status: 'completed' | 'pending' | 'overdue';
  riskLevelAtSchedule: RiskLevel;
  focusItems: string[];
}

// Follow Up Record
export interface FollowUpRecord {
  id: string;
  date: string;
  method: '电话' | '线下' | '微信';
  mainComplaint?: string;
  
  indicators: {
    sbp: number;
    dbp: number;
    heartRate?: number;
    glucose: number;
    glucoseType?: string; 
    weight: number;
    tc?: number; 
    tg?: number; 
    ldl?: number; 
    hdl?: number; 
  };
  
  organRisks: {
      carotidPlaque: string; carotidStatus: string;
      thyroidNodule: string; thyroidStatus: string;
      lungNodule: string; lungStatus: string;
      otherFindings: string; otherStatus: string;
  };

  medicalCompliance?: {
      item: string; 
      // Update: Changed to improve/not_improved logic
      status: 'improved' | 'not_improved' | 'not_checked';
      result?: string; 
  }[];

  medication: {
    currentDrugs: string;
    compliance: string;
    adverseReactions: string;
  };

  lifestyle: {
      diet: string;
      exercise: string;
      smokingAmount: number;
      drinkingAmount: number;
      sleepHours: number;
      sleepQuality: string;
      psychology: string;
      stress: string;
  };
  
  taskCompliance?: {
      taskId: string;
      description: string;
      status: 'achieved' | 'partial' | 'failed';
      note?: string;
  }[];
  
  otherInfo?: string; 

  assessment: {
    riskLevel: RiskLevel;
    riskJustification: string;
    majorIssues: string;
    referral: boolean;
    nextCheckPlan: string;
    lifestyleGoals: string[];
    doctorMessage?: string; 
  };
}

// --- 6. 危急值管理记录 ---
export interface CriticalTrackRecord {
    id: string;
    status: 'pending_initial' | 'pending_secondary' | 'archived'; 
    critical_item: string; 
    critical_desc: string; 
    critical_level: string; // A类/B类 or A类,B类
    initial_notify_time: string; 
    initial_feedback: string; 
    /** 初次通知记录人姓名 */
    initial_recorder_name?: string;
    /** 初次通知记录人角色 */
    initial_recorder_role?: 'admin' | 'health_manager' | 'doctor';
    secondary_due_date: string; 
    secondary_notify_time?: string;
    secondary_feedback?: string;
    /** 二次回访记录人姓名 */
    secondary_recorder_name?: string;
    /** 二次回访记录人角色 */
    secondary_recorder_role?: 'admin' | 'health_manager' | 'doctor';
}

// --- 7. 医疗业务热力图数据 ---
export interface DepartmentAnalytics {
    departmentName: string; 
    patientCount: number;   
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW'; 
    suggestedServices: {
        name: string;
        count: number;
        description: string;
    }[]; 
    keyConditions: string[]; 
}

// --- 8. 风险画像与模型评估数据 (NEW) ---
export interface SystemRiskPortrait {
    systemName: string; // e.g., "心脑血管系统"
    icon: string;
    status: 'High' | 'Medium' | 'Low' | 'Normal'; // 综合状态
    keyFindings: string[]; // 主要发现
    focusAreas: string[]; // 核心关注点
}

export interface PredictionModelResult {
    modelId: string;
    modelName: string; // e.g., "China-PAR"
    category: string; // e.g., "心脑血管"
    score?: string | number; // 评分结果
    riskLabel: '高风险' | '中风险' | '低风险' | '一般' | '未知' | '需关注' | '良好'; 
    riskLevel: RiskLevel | 'UNKNOWN';
    description: string; // 结果解读
    missingParams: { key: string; label: string }[]; // 缺失的输入变量
    lastCalculated: string;
}

export interface RiskAnalysisData {
    portraits: SystemRiskPortrait[];
    models: PredictionModelResult[];
}

// --- 9. User Portal Types (New for v1.0 User App) ---
export interface HealthEvent {
    id: string;
    title: string;
    type: 'lecture' | 'clinic' | 'skill'; // 讲座 | 义诊 | 技能课
    date: string;
    time: string;
    location: string;
    doctor?: string;
    description: string;
    capacity: number;
    registered: number;
    isRegistered?: boolean;
}

export interface DailyTask {
    id: string;
    title: string;
    type: 'exercise' | 'diet' | 'med' | 'measure';
    isCompleted: boolean;
    points: number;
}

export interface HealthArticle {
    id: string;
    title: string;
    category: string;
    readTime: string; // e.g., "3 min"
    imageUrl: string;
    tags: string[];
}
