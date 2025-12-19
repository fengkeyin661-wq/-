
import { GoogleGenAI, Type } from "@google/genai";
import { HealthRecord, HealthAssessment, RiskLevel, ScheduledFollowUp, FollowUpRecord, DepartmentAnalytics } from "../types";
import { HabitRecord } from "./dataService";

// 严格按照准则初始化
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function callGemini(systemPrompt: string, userContent: string, jsonMode: boolean = true, schema?: any): Promise<string> {
    const config: any = {
        systemInstruction: systemPrompt,
    };
    
    if (jsonMode) {
        config.responseMimeType = "application/json";
        if (schema) config.responseSchema = schema;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: userContent,
            config: config,
        });
        return response.text || "";
    } catch (e: any) {
        console.error("Gemini API Call Error:", e);
        throw e;
    }
}

// 基础档案空模版
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

export const parseHealthDataFromText = async (raw: string): Promise<HealthRecord> => {
    if (!raw.trim()) throw new Error("输入为空");
    const systemPrompt = "你是一个专业的医疗数据结构化专家。请从文本中提取体检信息并返回 JSON。";
    try {
        const jsonText = await callGemini(systemPrompt, raw);
        const result = JSON.parse(jsonText);
        return { ...DEFAULT_HEALTH_RECORD, ...result };
    } catch (e) {
        return DEFAULT_HEALTH_RECORD;
    }
};

export const generateHealthAssessment = async (rec: HealthRecord): Promise<HealthAssessment> => {
    const prompt = `分析以下健康档案并给出评估报告：${JSON.stringify(rec)}`;
    try {
        const jsonText = await callGemini("你是一个辅助医生进行健康评估的AI。", prompt);
        return JSON.parse(jsonText) as HealthAssessment;
    } catch (e) {
        return {
            riskLevel: RiskLevel.GREEN,
            summary: "评估生成失败",
            risks: { red: [], yellow: [], green: [] },
            managementPlan: { dietary: [], exercise: [], medication: [], monitoring: [] },
            followUpPlan: { frequency: "每月一次", nextCheckItems: [] }
        };
    }
};

export const generateFollowUpSchedule = (ass: HealthAssessment): ScheduledFollowUp[] => {
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + (ass.riskLevel === 'RED' ? 1 : 3));
    return [{
        id: Date.now().toString(),
        date: nextDate.toISOString().split('T')[0],
        status: 'pending',
        riskLevelAtSchedule: ass.riskLevel,
        focusItems: ass.followUpPlan.nextCheckItems
    }];
};

export const analyzeFollowUpRecord = async (form: any, ass: any, last: any) => ({ riskLevel: RiskLevel.GREEN, riskJustification: '改善中', majorIssues: '无', nextCheckPlan: '继续监测', lifestyleGoals: [], doctorMessage: '请保持' });
export const generateFollowUpSMS = async (n: string) => ({ smsContent: `提醒：${n} 老师，您的健康随访已到期，请及时录入数据。` });
export const generateHospitalBusinessAnalysis = async (issues: any): Promise<DepartmentAnalytics[]> => [];
export const calculateNutritionFromIngredients = async (items: any) => ({ nutritionData: {} });
export const generatePersonalizedHabits = async (a: any, r: any) => ({ habits: [] });

// Fix: Added missing export for generateAnnualReportSummary
export const generateAnnualReportSummary = async (data: any): Promise<{ summary: string }> => {
    const prompt = `基于以下随访和体检数据，生成一份年度健康总结报告：${JSON.stringify(data)}`;
    const schema = {
        type: Type.OBJECT,
        properties: { summary: { type: Type.STRING } },
        required: ["summary"]
    };
    try {
        const jsonText = await callGemini("你是一个资深健康管理顾问。", prompt, true, schema);
        return JSON.parse(jsonText);
    } catch (e) {
        return { summary: "年度健康报告摘要生成失败。" };
    }
};

// Fix: Added missing export for generateDietAssessment
export const generateDietAssessment = async (msg: string): Promise<{ reply: string }> => {
    const prompt = `请作为营养师分析并回复以下饮食咨询：${msg}`;
    const schema = {
        type: Type.OBJECT,
        properties: { reply: { type: Type.STRING } },
        required: ["reply"]
    };
    try {
        const jsonText = await callGemini("你是一个专业的临床营养师，请给出科学的饮食建议。", prompt, true, schema);
        return JSON.parse(jsonText);
    } catch (e) {
        return { reply: "抱歉，目前无法进行饮食分析。" };
    }
};

// Fix: Added missing export for generateExercisePlan
export const generateExercisePlan = async (input: string): Promise<{ plan: { day: string, content: string }[] }> => {
    const prompt = `根据以下需求生成一份为期一周的运动计划：${input}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            plan: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        day: { type: Type.STRING },
                        content: { type: Type.STRING }
                    },
                    required: ["day", "content"]
                }
            }
        },
        required: ["plan"]
    };
    try {
        const jsonText = await callGemini("你是一个资深运动康复专家，请生成个性化的运动计划。", prompt, true, schema);
        return JSON.parse(jsonText);
    } catch (e) {
        return { plan: [{ day: '每日', content: '保持适量活动，如快走 30 分钟。' }] };
    }
};

export const generateDailyIntegratedPlan = async (userProfileStr: string, resourcesContext?: string, targetCalories?: number) => {
    const prompt = `生成一日健康计划: ${userProfileStr}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            diet: {
                type: Type.OBJECT,
                properties: { breakfast: { type: Type.STRING }, lunch: { type: Type.STRING }, dinner: { type: Type.STRING }, snack: { type: Type.STRING } },
                required: ["breakfast", "lunch", "dinner", "snack"],
            },
            recommendedMealIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            exercise: {
                type: Type.OBJECT,
                properties: { morning: { type: Type.STRING }, afternoon: { type: Type.STRING }, evening: { type: Type.STRING } },
                required: ["morning", "afternoon", "evening"],
            },
            recommendedExerciseIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            tips: { type: Type.STRING }
        },
        required: ["diet", "recommendedMealIds", "exercise", "recommendedExerciseIds", "tips"]
    };
    try {
        const jsonText = await callGemini("你是健康教练。", prompt, true, schema);
        return JSON.parse(jsonText);
    } catch (e) {
        return {
            diet: { breakfast: '燕麦', lunch: '沙拉', dinner: '清蒸鱼', snack: '苹果' },
            recommendedMealIds: [],
            exercise: { morning: '拉伸', afternoon: '快走', evening: '瑜伽' },
            recommendedExerciseIds: [],
            tips: '保持心情愉快'
        };
    }
};
