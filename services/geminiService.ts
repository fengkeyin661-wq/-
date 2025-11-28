
import { HealthRecord, HealthAssessment, RiskLevel, ScheduledFollowUp, FollowUpRecord } from "../types";

// DeepSeek Config
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

const getApiKey = () => {
    // 使用 Vite 标准方式读取环境变量
    return import.meta.env.VITE_DEEPSEEK_API_KEY || '';
}

// Helper for DeepSeek API Call
const callDeepSeek = async (systemPrompt: string, userContent: string, jsonMode: boolean = true) => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key 未配置。请检查 Vercel 环境变量 VITE_DEEPSEEK_API_KEY。");

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat", // V3
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent }
                ],
                response_format: jsonMode ? { type: "json_object" } : undefined,
                temperature: 0.1
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API Error: ${response.status} - ${err}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // Cleaning markdown code blocks if present
        const cleanJson = content.replace(/```json\n?|```/g, '').trim();
        
        return jsonMode ? JSON.parse(cleanJson) : cleanJson;
    } catch (error) {
        console.error("DeepSeek Call Failed:", error);
        throw error;
    }
};

export const parseHealthDataFromText = async (rawText: string): Promise<HealthRecord> => {
  const systemPrompt = `
    你是一个医疗数据结构化专家。请从混合了【体检报告】和【59项健康问卷】的文本中提取数据。
    请忽略无关文本，尽可能提取有效信息。如果某项未提及，请留空或null。
    
    输出必须是严格的 JSON 格式，符合以下结构:
    {
      "profile": {
        "checkupId": "体检编号(Q2)", "name": "姓名(Q1)", "gender": "男/女(Q3)", "department": "部门(Q4)", "phone": "电话", "checkupDate": "YYYY-MM-DD", "dob": "出生日期", "age": 数字
      },
      "checkup": {
        "basics": { "height": 0, "weight": 0, "bmi": 0, "sbp": 0, "dbp": 0 },
        "labBasic": {
           "liver": { "ALT": "数值", "AST": "数值", "GGT": "数值", "TBIL": "数值", "DBIL": "数值", "IBIL": "数值", "TP": "数值", "ALB": "数值", "GLB": "数值" }, 
           "ck": "肌酸激酶数值",
           "lipids": { "tc": "总胆固醇", "tg": "甘油三酯", "ldl": "低密度", "hdl": "高密度" },
           "renal": { "urea": "尿素", "creatinine": "肌酐", "ua": "尿酸" },
           "bloodRoutine": "血常规摘要/异常",
           "glucose": { "fasting": "空腹血糖" },
           "urineRoutine": "尿常规摘要",
           "thyroidFunction": { "t3": "数值", "t4": "数值", "tsh": "数值" }
        },
        "imagingBasic": {
           "ecg": "心电图结论",
           "ultrasound": {
              "thyroid": "甲状腺超声结论",
              "abdomen": "肝胆胰脾肾输尿管膀胱超声结论",
              "breast": "乳腺超声结论",
              "uterusAdnexa": "子宫附件超声结论",
              "prostate": "前列腺超声结论"
           }
        },
        "optional": {
           "tct": "TCT结果", "hpv": "HPV结果",
           "tumorMarkers4": { "cea": "数值", "afp": "数值", "ca199": "数值", "cy211": "数值" },
           "tumorMarkers2": { "ca125": "数值", "ca153": "数值", "psa": "数值", "fpsa": "数值" },
           "afpCeaQuant": "AFP/CEA定量",
           "heartUltrasound": "心脏彩超结论",
           "rheumatoid": { "esr": "血沉", "rf": "类风湿因子", "aso": "抗O" },
           "homocysteine": "同型半胱氨酸结果",
           "immuneSet": "免疫全套结果",
           "tcd": "TCD颅内多普勒结论",
           "c13": "碳13结果",
           "mammography": "乳腺钼靶结论",
           "carotidUltrasound": "颈部血管彩超结论",
           "ct": "CT部位及结论",
           "boneDensity": "骨密度结果",
           "fundusPhoto": "眼底照相结果",
           "hba1c": "糖化血红蛋白",
           "gastrin": "胃功能三项(胃泌素17等)",
           "adiponectin": "脂联素",
           "vitD": "维生素D"
        },
        "abnormalities": [
           { "category": "分类", "item": "项目名", "result": "异常结果", "clinicalSig": "提示(偏高/偏低/结节)" }
        ]
      },
      "questionnaire": {
        "history": {
           "diseases": ["高血压(Q5)", "糖尿病" 等],
           "details": {
               "hypertensionYear": "Q6年份", "cadTypes": ["Q7类型"], "arrhythmiaType": "Q8类型", "strokeTypes": ["Q9类型"], "strokeYear": "Q10年份",
               "diabetesYear": "Q11年份", "tumorSite": "Q12部位", "tumorYear": "Q13年份", "otherHistory": "Q14其他"
           },
           "surgeries": "Q15手术外伤"
        },
        "medication": { "isRegular": "Q16(是/否)", "list": "Q17药名" },
        "diet": {
           "habits": ["Q18习惯"], "stapleType": "Q19类型", "coarseGrainFreq": "Q20频率",
           "dailyStaple": "Q21量", "dailyVeg": "Q22量", "dailyFruit": "Q23量", "dailyMeat": "Q24量", "meatTypes": ["Q25类型"], "dailyDairy": "Q26量", "dailyBeanNut": "Q27量"
        },
        "hydration": { "dailyAmount": "Q28量", "types": ["Q29类型"] },
        "exercise": { "frequency": "Q30频率", "types": ["Q31类型"], "otherType": "Q32", "duration": "Q33时长" },
        "sleep": { "hours": "Q34时长", "quality": "Q35质量", "nap": "Q36午休", "snore": "Q37打鼾", "monitorResult": "Q38结果" },
        "substances": {
           "smoking": { "status": "Q39状态", "quitYear": "Q40年份", "dailyAmount": "Q41量", "years": "Q42年限", "passive": ["Q43二手烟"] },
           "alcohol": { "status": "Q44状态", "types": ["Q45类型"], "freq": "Q46频率", "amount": "Q47量", "drunkHistory": "Q48醉酒", "quitIntent": "Q49戒酒" }
        },
        "mental": { "stressLevel": "Q50压力", "stressSource": ["Q51来源"], "otherSource": "Q52", "reliefMethod": ["Q53方式"], "otherRelief": "Q54" },
        "needs": { "concerns": ["Q55关注"], "otherConcern": "Q56", "followUpWillingness": "Q57意愿", "desiredSupport": ["Q58支持"], "otherSupport": "Q59" }
      }
    }
  `;

  return await callDeepSeek(systemPrompt, `请解析以下健康档案数据:\n${rawText}`);
}

export const generateHealthAssessment = async (record: HealthRecord): Promise<HealthAssessment> => {
  const systemPrompt = `
    你是全科主任医师。基于详细的体检数据(Objective)和问卷数据(Subjective)生成风险评估。
    
    逻辑:
    1. 整合 [CheckupData] 中的 Lab/Imaging 异常项。
    2. 整合 [QuestionnaireData] 中的既往史和生活方式风险。
    3. 输出风险分级、综述、具体风险点列表、管理方案和随访计划。
    
    返回 JSON:
    {
       "riskLevel": "RED/YELLOW/GREEN",
       "summary": "综合综述",
       "risks": { "red": ["高危因素"], "yellow": ["中危因素"], "green": ["低危/关注"] },
       "managementPlan": {
          "dietary": ["饮食建议"], "exercise": ["运动建议"], "medication": ["用药调整建议"], "monitoring": ["监测指标建议"]
       },
       "structuredTasks": [
          { "id": "uuid", "category": "diet", "description": "具体可执行任务", "frequency": "每日/每周", "isKeyGoal": true }
       ],
       "followUpPlan": { "frequency": "随访频率建议", "nextCheckItems": ["下次复查项目"] }
    }
  `;

  return await callDeepSeek(systemPrompt, `数据:\n${JSON.stringify(record)}`);
};

export const generateFollowUpSchedule = (assessment: HealthAssessment): ScheduledFollowUp[] => {
    const today = new Date();
    const schedule: ScheduledFollowUp[] = [];
    let interval = assessment.riskLevel === RiskLevel.RED ? 1 : assessment.riskLevel === RiskLevel.YELLOW ? 3 : 6;

    for (let i = 1; i <= 2; i++) {
        const d = new Date(today);
        d.setMonth(today.getMonth() + (interval * i));
        schedule.push({
            id: `sch_${Date.now()}_${i}`,
            date: d.toISOString().split('T')[0],
            status: 'pending',
            riskLevelAtSchedule: assessment.riskLevel,
            focusItems: assessment.followUpPlan.nextCheckItems
        });
    }
    return schedule;
};

export const analyzeFollowUpRecord = async (
    formData: Partial<FollowUpRecord>, 
    assessment: HealthAssessment | null,
    latestRecord: FollowUpRecord | null
  ): Promise<{
      riskLevel: RiskLevel;
      riskJustification: string;
      majorIssues: string;
      nextCheckPlan: string;
      lifestyleGoals: string[];
  }> => {
      const systemPrompt = `
      你是一名健康管理专家。请根据患者的本次随访记录、基线评估和上次记录，分析其健康状况。
      请务必使用中文输出。
      
      重点关注:
      1. 核心指标(血压/血糖)是否达标。
      2. 医疗复查执行情况(medicalCompliance): 如果患者未执行建议的复查(