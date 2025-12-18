
import { GoogleGenAI } from "@google/genai";
import { HealthRecord, HealthAssessment, RiskLevel, ScheduledFollowUp, FollowUpRecord, DepartmentAnalytics } from "../types";
import { HabitRecord } from "./dataService";

// Helper for Gemini API Calls - using process.env.API_KEY as per hard requirement
async function callGemini(systemPrompt: string, userContent: string, jsonMode: boolean = true): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userContent,
        config: {
            systemInstruction: systemPrompt,
            temperature: 0.1,
            responseMimeType: jsonMode ? "application/json" : undefined,
        },
    });

    return response.text || "";
}

// Safe Default Structure
const DEFAULT_HEALTH_RECORD: HealthRecord = {
    profile: { checkupId: '', name: '', gender: '', department: '', age: 0 },
    checkup: {
        basics: {},
        labBasic: { liver: {}, lipids: {}, renal: {}, bloodRoutine: {}, glucose: {}, urineRoutine: {}, thyroidFunction: {} },
        imagingBasic: { ultrasound: {} },
        optional: { tumorMarkers4: {}, tumorMarkers2: {}, rheumatoid: {} },
        abnormalities: []
    },
    questionnaire: {
        history: { diseases: [], details: {} },
        femaleHealth: {},
        familyHistory: {},
        medication: { isRegular: '否', details: {} },
        diet: { habits: [] },
        hydration: {},
        exercise: {},
        sleep: {},
        respiratory: {},
        substances: { smoking: {}, alcohol: {} },
        mentalScales: {},
        mental: {},
        needs: {},
        satisfaction: {}
    }
};

/**
 * Parses health data from raw text using Gemini AI
 */
export const parseHealthDataFromText = async (raw: string): Promise<HealthRecord> => {
    if (!raw || raw.trim().length === 0) {
        throw new Error("输入文本为空，无法解析");
    }

    const systemPrompt = `
    你是一个专业的医疗数据结构化专家。请分析用户提供的体检报告或健康问卷文本，提取关键信息并按照 JSON 格式返回。
    
    提取规则：
    1. 即使数据缺失，也请尽量返回结构体，数值型字段如果未找到请留空或为 null，字符串留空字符串。
    2. **异常项提取**：将所有异常发现提取到 checkup.abnormalities 数组中。
    3. **体检编号 (checkupId)**：提取6位纯数字编号。
    
    目标 JSON 结构：
    {
      "profile": { "checkupId": "string", "name": "string", "gender": "string", "age": number, "department": "string", "phone": "string", "checkupDate": "string" },
      "checkup": {
         "basics": { "height": number, "weight": number, "bmi": number, "sbp": number, "dbp": number, "waist": number },
         "labBasic": { 
            "glucose": { "fasting": "string" },
            "lipids": { "tc": "string", "tg": "string", "ldl": "string", "hdl": "string" },
            "liver": { "alt": "string", "ast": "string" },
            "renal": { "creatinine": "string", "ua": "string" }
         },
         "imagingBasic": { "ultrasound": { "thyroid": "string", "abdomen": "string" } },
         "abnormalities": [ { "item": "string", "result": "string", "clinicalSig": "string" } ]
      },
      "questionnaire": {
         "history": { "diseases": ["string"], "details": {} },
         "familyHistory": { "diabetes": boolean, "hypertension": boolean },
         "medication": { "isRegular": "string", "details": {} },
         "diet": { "habits": ["string"], "stapleType": "string" },
         "substances": { "smoking": { "status": "string", "dailyAmount": number } }
      }
    }
    `;

    try {
        const jsonText = await callGemini(systemPrompt, raw);
        if (!jsonText) throw new Error("AI response empty");
        
        const result = JSON.parse(jsonText);
        
        // Merge with Default to prevent undefined errors in UI
        const merged: HealthRecord = {
            ...DEFAULT_HEALTH_RECORD,
            ...result,
            profile: { ...DEFAULT_HEALTH_RECORD.profile, ...result?.profile },
            checkup: {
                ...DEFAULT_HEALTH_RECORD.checkup,
                ...result?.checkup,
                basics: { ...DEFAULT_HEALTH_RECORD.checkup.basics, ...result?.checkup?.basics },
                abnormalities: result?.checkup?.abnormalities || []
            }
        };

        // Automatic BMI Calculation
        const b = merged.checkup.basics;
        if (b.height && b.weight && b.height > 0 && b.weight > 0 && (!b.bmi || b.bmi === 0)) {
            const heightM = b.height / 100;
            b.bmi = parseFloat((b.weight / (heightM * heightM)).toFixed(1));
        }

        return merged;
    } catch (e: any) {
        console.error("AI Parse Failed", e);
        const errorRecord = JSON.parse(JSON.stringify(DEFAULT_HEALTH_RECORD));
        errorRecord.profile.name = `解析失败: ${e.message || '未知错误'}`;
        return errorRecord;
    }
};

/**
 * Generates a comprehensive health assessment using Gemini
 */
export const generateHealthAssessment = async (rec: HealthRecord): Promise<HealthAssessment> => {
    const prompt = `
    作为资深全科医生，请根据以下健康档案生成一份风险评估报告。
    数据：${JSON.stringify(rec)}
    
    请严格返回 JSON 格式:
    {
      "riskLevel": "GREEN" | "YELLOW" | "RED",
      "summary": "综合评估摘要(150字以内)",
      "isCritical": boolean,
      "criticalWarning": "如有危急值请说明，否则为空",
      "risks": { "red": ["高危因素1"], "yellow": ["中危因素1"], "green": ["良好指标"] },
      "managementPlan": {
         "dietary": ["饮食建议1"],
         "exercise": ["运动建议"],
         "medication": ["用药建议"],
         "monitoring": ["监测建议"]
      },
      "followUpPlan": {
         "frequency": "建议随访频率",
         "nextCheckItems": ["复查项目1"]
      }
    }
    `;

    try {
        const jsonText = await callGemini("你是一个辅助医生进行健康评估的AI。", prompt);
        return JSON.parse(jsonText || '{}') as HealthAssessment;
    } catch (e) {
        console.error("Assessment Gen Failed", e);
        return {
            riskLevel: RiskLevel.GREEN,
            summary: "自动评估生成失败，请人工审核。",
            risks: { red: [], yellow: [], green: [] },
            managementPlan: { dietary: [], exercise: [], medication: [], monitoring: [] },
            followUpPlan: { frequency: "待定", nextCheckItems: [] }
        };
    }
};

/**
 * Generates initial follow-up schedule based on assessment
 */
export const generateFollowUpSchedule = (ass: HealthAssessment): ScheduledFollowUp[] => {
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + (ass.riskLevel === 'RED' ? 1 : ass.riskLevel === 'YELLOW' ? 3 : 6));
    
    return [{
        id: Date.now().toString(),
        date: nextDate.toISOString().split('T')[0],
        status: 'pending',
        riskLevelAtSchedule: ass.riskLevel,
        focusItems: ass.followUpPlan.nextCheckItems
    }];
};

/**
 * Analyzes a follow-up record to update risk status
 */
export const analyzeFollowUpRecord = async (form: any, ass: any, last: any): Promise<any> => {
    const prompt = `
    分析随访记录。
    本次记录: ${JSON.stringify(form)}
    历史状态: ${JSON.stringify(ass)}
    上次随访: ${JSON.stringify(last)}
    
    请严格返回 JSON 格式:
    {
      "riskLevel": "GREEN" | "YELLOW" | "RED",
      "riskJustification": "判定理由",
      "majorIssues": "主要发现",
      "nextCheckPlan": "下一步计划",
      "lifestyleGoals": ["目标1"]
    }
    `;
    try {
        const jsonText = await callGemini("你是一个随访分析AI助手。", prompt);
        return JSON.parse(jsonText || '{}');
    } catch (e) {
        return {};
    }
};

export const generateFollowUpSMS = async (name: string) => { 
    return { smsContent: `温馨提示：${name}老师，您的健康随访已完成，请登录查看最新评估。` };
};

/**
 * AI-driven Hospital Business Heatmap Analysis
 */
export const generateHospitalBusinessAnalysis = async (issues: { [key: string]: number }): Promise<DepartmentAnalytics[]> => {
    const prompt = `
    作为医院运营专家，请根据异常数据进行科室归类。
    数据: ${JSON.stringify(issues)}
    
    请严格返回 JSON 数组:
    [
      {
        "departmentName": "科室名称",
        "patientCount": number,
        "riskLevel": "HIGH" | "MEDIUM" | "LOW", 
        "keyConditions": ["异常1"], 
        "suggestedServices": [ { "name": "项目", "count": number, "description": "简述" } ]
      }
    ]
    `;

    try {
        const jsonText = await callGemini("你是医院运营顾问。", prompt);
        const result = JSON.parse(jsonText || '[]');
        return Array.isArray(result) ? result : [];
    } catch (e) {
        console.warn("Heatmap AI failed", e);
        return [];
    }
};

export const generateAnnualReportSummary = async (basics: any, checkup: any) => { 
    return { summary: '年度健康摘要生成中...' };
};

export const generateDietAssessment = async (input: string) => { 
    const res = await callGemini("你是营养师。", `分析此饮食输入: ${input}`, false);
    return { reply: res };
};

export const generateExercisePlan = async (input: string) => { 
    const res = await callGemini("你是运动教练。", `根据需求生成运动计划: ${input}\n返回JSON格式: { "plan": [{ "day": "天数", "content": "内容" }] }`);
    return JSON.parse(res || '{ "plan": [] }');
};

/**
 * Calculates nutrition facts from ingredients using Gemini
 */
export const calculateNutritionFromIngredients = async (items: {name: string, ingredients: string}[]): Promise<{nutritionData: any}> => {
    const prompt = `
    分析以下食谱的营养成分。
    Items: ${JSON.stringify(items)}
    
    返回 JSON (Key 为菜名):
    {
       "菜名": { "cal": number, "protein": number, "fat": number, "carbs": number, "fiber": number, "nutrition": "简述" }
    }
    `;
    try {
        const jsonText = await callGemini("你是专业的营养分析专家。", prompt);
        return { nutritionData: JSON.parse(jsonText || '{}') };
    } catch (e) {
        return { nutritionData: {} };
    }
};

/**
 * Generates personalized daily habits based on risk assessment
 */
export const generatePersonalizedHabits = async (assessment: HealthAssessment, record: HealthRecord): Promise<{ habits: HabitRecord[] }> => {
    const prompt = `
    根据评估结果创建6个健康习惯。
    风险: ${assessment.riskLevel}, 摘要: ${assessment.summary}
    返回 JSON: { "habits": [ { "id": "h1", "title": "...", "icon": "emoji", "frequency": "daily", "color": "orange" } ] }
    `;

    try {
        const jsonText = await callGemini("你是健康习惯规划师。", prompt);
        const result = JSON.parse(jsonText || '{}');
        const habits = (result.habits || []).map((h: any) => ({
            ...h,
            history: [],
            streak: 0
        }));
        return { habits };
    } catch (e) {
        return { habits: [] };
    }
};

/**
 * Generates an integrated daily diet and exercise plan
 */
export const generateDailyIntegratedPlan = async (userProfileStr: string, resourcesContext?: string, targetCalories?: number): Promise<any> => {
    const prompt = `
    生成每日健康方案 (目标: ${targetCalories || 2000} kcal)。
    用户背景: ${userProfileStr}
    可选资源: ${resourcesContext || '[]'}
    
    返回 JSON:
    {
      "diet": { "breakfast": "建议", "lunch": "建议", "dinner": "建议" },
      "recommendedMealIds": ["id1"],
      "exercise": { "morning": "建议", "afternoon": "建议", "evening": "建议" },
      "recommendedExerciseIds": ["id1"],
      "tips": "贴士"
    }
    `;

    try {
        const jsonText = await callGemini("你是全能健康教练。", prompt);
        return JSON.parse(jsonText || '{}');
    } catch (e) {
        return {
            diet: { breakfast: '清淡早餐', lunch: '均衡午餐', dinner: '轻食晚餐' },
            recommendedMealIds: [],
            exercise: { morning: '晨间拉伸', afternoon: '适度走动', evening: '静心冥想' },
            recommendedExerciseIds: [],
            tips: '保持规律生活。'
        };
    }
};
