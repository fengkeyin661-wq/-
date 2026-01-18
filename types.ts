
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

// --- 1. 基础档案信息 ---
export interface HealthProfile {
  checkupId: string; 
  name: string;      
  dob?: string;      
  gender: string;    
  department: string; 
  phone?: string;    
  checkupDate?: string; 
  age?: number;      
}

// --- 2. 结构化体检数据 ---
export interface CheckupData {
  basics: {
    height?: number;
    weight?: number;
    bmi?: number;
    sbp?: number;
    dbp?: number;
    waist?: number;
  };
  labBasic: {
    liver?: { [key: string]: string };
    ck?: string;
    lipids?: { tc?: string; tg?: string; hdl?: string; ldl?: string; };
    renal?: { urea?: string; creatinine?: string; ua?: string; };
    bloodRoutine?: { wbc?: string; hgb?: string; plt?: string; summary?: string };
    glucose?: { fasting?: string; };
    urineRoutine?: { protein?: string; summary?: string };
    thyroidFunction?: { t3?: string; t4?: string; tsh?: string; };
  };
  imagingBasic: {
    ecg?: string;
    ultrasound: {
        thyroid?: string;
        abdomen?: string;
        breast?: string;
        uterusAdnexa?: string;
        prostate?: string;
    };
  };
  optional: { [key: string]: any };
  abnormalities: CheckupAbnormality[];
}

export interface CheckupAbnormality {
  category: string;
  item: string;
  result: string;
  clinicalSig: string;
}

// --- 3. 健康问卷数据 ---
export interface QuestionnaireData {
  history: {
    diseases: string[];
    details: { [key: string]: any };
    surgeries?: string;
  };
  femaleHealth: { [key: string]: any };
  familyHistory: { [key: string]: any };
  medication: {
    isRegular: string;
    list?: string;
    details: { [key: string]: boolean };
  };
  diet: { [key: string]: any };
  hydration: { [key: string]: any };
  exercise: { [key: string]: any };
  sleep: { [key: string]: any };
  respiratory: { [key: string]: any };
  substances: { [key: string]: any };
  mentalScales: { [key: string]: any };
  mental: { [key: string]: any };
  needs: { [key: string]: any };
  satisfaction?: { [key: string]: any };
}

// --- 4. 聚合数据对象 ---
export interface HealthRecord {
  profile: HealthProfile;
  checkup: CheckupData;
  questionnaire: QuestionnaireData;
  riskModelExtras?: { [key: string]: any }; 
}

// --- 5. 评估与干预方案 (重点升级) ---
export interface InterventionMilestone {
  id: string;
  title: string;
  target: string;
  timeframe: string; // e.g. "第1-4周"
  tasks: string[];
}

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
  // 结构化的干预路径
  interventionPath: {
    goal: string;
    milestones: InterventionMilestone[];
    duration: string;
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

// 随访记录
export interface FollowUpRecord {
  id: string;
  date: string;
  method: '电话' | '线下' | '微信';
  mainComplaint?: string;
  indicators: { [key: string]: any };
  organRisks: { [key: string]: string };
  medicalCompliance?: {
      item: string; 
      status: 'improved' | 'not_improved' | 'not_checked';
      result?: string; 
  }[];
  medication: { [key: string]: string };
  lifestyle: { [key: string]: any };
  taskCompliance?: {
      taskId: string;
      description: string;
      status: 'achieved' | 'partial' | 'failed';
      note?: string;
  }[];
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
    critical_level: string; 
    initial_notify_time: string; 
    initial_feedback: string; 
    secondary_due_date: string; 
    secondary_notify_time?: string; 
    secondary_feedback?: string; 
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

// --- 8. 风险画像与模型评估数据 ---
export interface RiskAnalysisData {
    portraits: SystemRiskPortrait[];
    models: PredictionModelResult[];
}

// [FIX] Added missing interfaces for application consistency
export interface ScheduledFollowUp {
  id: string;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  riskLevelAtSchedule: RiskLevel;
  focusItems: string[];
}

export interface SystemRiskPortrait {
  systemName: string;
  icon: string;
  status: 'Normal' | 'Medium' | 'High';
  keyFindings: string[];
  focusAreas: string[];
}

export interface PredictionModelResult {
  modelId: string;
  modelName: string;
  category: string;
  score: string;
  riskLevel: RiskLevel | 'UNKNOWN';
  riskLabel: string;
  description: string;
  missingParams?: { key: string; label: string }[];
  lastCalculated: string;
}

export interface DailyTask {
  id: string;
  title: string;
  type: 'measure' | 'exercise' | 'med' | 'diet';
  isCompleted: boolean;
  points: number;
}

export interface HealthEvent {
  id: string;
  title: string;
  type: 'lecture' | 'clinic' | 'skill';
  date: string;
  time: string;
  location: string;
  doctor?: string;
  capacity: number;
  registered: number;
  description: string;
  isRegistered: boolean;
}
