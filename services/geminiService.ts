
import { GoogleGenAI } from "@google/genai";
import { 
    HealthRecord, 
    HealthAssessment, 
    ScheduledFollowUp, 
    FollowUpRecord, 
    RiskLevel, 
    DepartmentAnalytics
} from "../types";

// Helper to get fresh AI instance inside each call per instructions
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseHealthDataFromText = async (text: string): Promise<HealthRecord> => {
    const ai = getAI();
    const systemPrompt = `你是一个专业的医学数据提取助手。你的任务是从用户提供的非结构化体检报告文本中提取关键指标，并转换为结构化的 JSON 格式。`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `待解析文本:\n${text}`,
        config: { systemInstruction: systemPrompt, responseMimeType: "application/json" }
    });
    try { return JSON.parse(response.text || "{}"); } catch (e) { throw new Error("AI 数据提取失败"); }
};

export const generateHealthAssessment = async (data: HealthRecord): Promise<HealthAssessment> => {
    const ai = getAI();
    const systemPrompt = `你是一个资深的健康管理专家。请根据提供的个人健康档案生成专业的风险评估。判定等级 (RED/YELLOW/GREEN) 并标记危急值。`;
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `健康数据:\n${JSON.stringify(data)}`,
        config: { systemInstruction: systemPrompt, responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
};

export const generateFollowUpSchedule = (assessment: HealthAssessment): ScheduledFollowUp[] => {
    const risk = assessment.riskLevel;
    const focus = assessment.followUpPlan.nextCheckItems;
    const intervalMonths = risk === RiskLevel.RED ? 1 : risk === RiskLevel.YELLOW ? 3 : 6;
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + intervalMonths);
    return [{ id: Date.now().toString(), date: nextDate.toISOString().split('T')[0], status: 'pending', riskLevelAtSchedule: risk, focusItems: focus }];
};

export const analyzeFollowUpRecord = async (current: Omit<FollowUpRecord, 'id'>, baseline: HealthAssessment | null, latest: FollowUpRecord | null): Promise<FollowUpRecord['assessment']> => {
    const ai = getAI();
    const systemPrompt = `分析随访数据并给出结论。`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `数据: ${JSON.stringify({current, baseline, latest})}`,
        config: { systemInstruction: systemPrompt, responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
};

export const generateFollowUpSMS = async (patientName: string): Promise<{smsContent: string}> => {
    const ai = getAI();
    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: `为 ${patientName} 撰写随访提醒短信` });
    return { smsContent: response.text || "" };
};

export const generateHospitalBusinessAnalysis = async (topIssues: Record<string, number>): Promise<DepartmentAnalytics[]> => {
    const ai = getAI();
    const response = await ai.models.generateContent({ model: "gemini-3-pro-preview", contents: `分析异常项潜在业务: ${JSON.stringify(topIssues)}`, config: { responseMimeType: "application/json" } });
    return JSON.parse(response.text || "[]");
};

export const generateDietAssessment = async (message: string): Promise<{reply: string}> => {
    const ai = getAI();
    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: message });
    return { reply: response.text || "" };
};

export const generateExercisePlan = async (input: string): Promise<any> => {
    const ai = getAI();
    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: input, config: { responseMimeType: "application/json" } });
    return JSON.parse(response.text || '{"plan": []}');
};

export const generateDailyIntegratedPlan = async (profileStr: string, resources: string, tdee: number): Promise<any> => {
    const ai = getAI();
    const response = await ai.models.generateContent({ model: "gemini-3-pro-preview", contents: `画像:${profileStr}, 能量:${tdee}, 资源:${resources}`, config: { responseMimeType: "application/json" } });
    return JSON.parse(response.text || "{}");
};

export const calculateNutritionFromIngredients = async (items: any[]): Promise<any> => {
    const ai = getAI();
    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: JSON.stringify(items), config: { responseMimeType: "application/json" } });
    return { nutritionData: JSON.parse(response.text || "{}") };
};

export const generatePersonalizedHabits = async (ass: HealthAssessment, rec: HealthRecord): Promise<any> => {
    const ai = getAI();
    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: ass.summary, config: { responseMimeType: "application/json" } });
    return { habits: JSON.parse(response.text || '{"habits": []}').habits };
};
