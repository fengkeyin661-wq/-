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

// Survey Data Structure
export interface HealthSurveyData {
  // Basic Info
  name: string;
  checkupId: string;
  gender: string;
  age: number;
  department: string;
  
  // History
  medicalHistory: string[];
  abnormalities: string; // Specific exam findings (e.g., TI-RADS 3)
  medications: string;
  surgeries: string;
  
  // Lifestyle
  diet: string[];
  exerciseFrequency: string;
  smokingStatus: string;
  drinkingStatus: string;
  sleepHours: number;
  stressLevel: string;
  
  // Complaints
  mainConcerns: string[];
}

// AI Generated Assessment Structure
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
  followUpPlan: {
    frequency: string;
    nextCheckItems: string[];
  };
}

// Complex Follow Up Record based on the provided form
export interface FollowUpRecord {
  id: string;
  date: string;
  method: '电话' | '线下' | '微信';
  mainComplaint: string; // 本次主要健康诉求/不适

  // Core Indicators (Metabolic & CV)
  indicators: {
    sbp: number; // 收缩压
    dbp: number; // 舒张压
    heartRate: number; // 静息心率
    glucoseType: '空腹' | '餐后';
    glucose: number; // 血糖
    weight: number; // 体重
    waist?: number; // 腰围
    tc?: number; // 总胆固醇
    ldl?: number; // 低密度
    hdl?: number; // 高密度
    tg?: number; // 甘油三酯
    uricAcid?: number; // 尿酸
  };

  // Organ Structure & Tumor Risks (Imaging)
  organRisks: {
    carotidPlaque: string; // 颈动脉斑块 description
    carotidStatus: '稳定' | '新增' | '增大' | '无';
    thyroidNodule: string; // 甲状腺结节 description
    thyroidStatus: '稳定' | '新增' | '增大' | '无';
    lungNodule: string; // 肺结节 description
    lungStatus: '稳定' | '新增' | '增大' | '无';
    otherFindings: string;
    otherStatus: '稳定' | '新增' | '增大' | '无';
  };

  // Medication
  medication: {
    currentDrugs: string;
    compliance: '规律服药' | '偶尔漏服' | '经常漏服/停药';
    adverseReactions: string;
  };

  // Lifestyle Intervention Status
  lifestyle: {
    diet: '合理' | '不合理';
    dietNotes?: string;
    exercise: '规律' | '偶尔' | '无';
    smokingAmount: number; // 0 for quit/none
    drinkingAmount: number; // 0 for quit/none
    sleepHours: number;
    sleepQuality: '好' | '入睡难' | '易醒' | '呼噜';
    psychology: '平稳' | '焦虑' | '低落';
    stress: '低' | '中' | '高';
  };

  // Assessment & Plan
  assessment: {
    riskLevel: RiskLevel;
    riskJustification: string; // 判定依据
    majorIssues: string; // 本次主要问题
    referral: boolean; // 是否转诊
    referralDetail?: string;
    nextCheckPlan: string; // 复查计划
    lifestyleGoals: string[]; // 生活方式重点目标
  };
}

export interface UserProfile {
  id: string;
  survey: HealthSurveyData;
  assessment: HealthAssessment | null;
  followUps: FollowUpRecord[];
}