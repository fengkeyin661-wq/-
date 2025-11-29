
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
export interface CheckupData {
  // 1. 基础项目
  basics: {
    height?: number;
    weight?: number;
    bmi?: number;
    sbp?: number;
    dbp?: number;
  };

  // 2-8, 11. 实验室检查 (基础)
  labBasic: {
    liver?: { [key: string]: string }; // 2. 肝功能九项
    ck?: string; // 3. 肌酸激酶
    lipids?: { tc?: string; tg?: string; hdl?: string; ldl?: string; }; // 4. 血脂四项
    renal?: { urea?: string; creatinine?: string; ua?: string; }; // 5. 肾功能三项
    bloodRoutine?: string; // 6. 血常规 (摘要或异常)
    glucose?: { fasting?: string; }; // 7. 血糖
    urineRoutine?: string; // 8. 尿常规 (摘要)
    thyroidFunction?: { t3?: string; t4?: string; tsh?: string; }; // 11. 甲功三项
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

// --- 3. 健康问卷数据 (Subjective Data - 59 Questions) ---
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

  // Q16-Q17 用药
  medication: {
    isRegular: string; // Q16 是/否
    list?: string; // Q17
  };

  // Q18-Q27 膳食
  diet: {
    habits: string[]; // Q18
    stapleType?: string; // Q19
    coarseGrainFreq?: string; // Q20
    dailyStaple?: string; // Q21
    dailyVeg?: string; // Q22
    dailyFruit?: string; // Q23
    dailyMeat?: string; // Q24
    meatTypes?: string[]; // Q25
    dailyDairy?: string; // Q26
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
      monitorResult?: string; // Q38
  };

  // Q39-Q49 烟酒
  substances: {
    smoking: {
        status?: string; // Q39
        quitYear?: string; // Q40
        dailyAmount?: string; // Q41
        years?: string; // Q42
        passive?: string[]; // Q43
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

  // Q50-Q54 心理压力
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
}

// --- 4. 聚合数据对象 ---
export interface HealthRecord {
  profile: HealthProfile;
  checkup: CheckupData;
  questionnaire: QuestionnaireData;
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
  };
  
  organRisks: {
      carotidPlaque: string; carotidStatus: string;
      thyroidNodule: string; thyroidStatus: string;
      lungNodule: string; lungStatus: string;
      otherFindings: string; otherStatus: string;
  };

  // 新增: 医学复查执行核对
  medicalCompliance?: {
      item: string; // e.g. "复查甲状腺彩超"
      status: 'checked_normal' | 'checked_abnormal' | 'not_checked';
      result?: string; // e.g. "结节增大1mm"
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

  assessment: {
    riskLevel: RiskLevel;
    riskJustification: string; // 临床风险理由 (医用)
    doctorMessage?: string;   // 医生寄语 (患用) - 新增
    majorIssues: string;
    referral: boolean;
    nextCheckPlan: string;
    lifestyleGoals: string[];
  };
}
