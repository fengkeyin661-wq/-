
import { GoogleGenAI, Type } from "@google/genai";
import { 
    HealthRecord, 
    HealthAssessment, 
    ScheduledFollowUp, 
    FollowUpRecord, 
    RiskLevel, 
    DepartmentAnalytics,
    QuestionnaireData
} from "../types";
import { HabitRecord } from "./dataService";

// Helper for initializing GoogleGenAI
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// AI 助手解析健康数据
export const parseHealthDataFromText = async (text: string): Promise<HealthRecord> => {
    const ai = getAI();
    const systemPrompt = `你是一个专业的医学数据提取助手。你的任务是从用户提供的非结构化体检报告或问卷文本中提取关键指标，并转换为结构化的 JSON 格式。`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `待解析文本:\n${text}`,
        config: { systemInstruction: systemPrompt, responseMimeType: "application/json" }
    });
    try { return JSON.parse(response.text || "{}"); } catch (e) { throw new Error("AI 数据提取失败"); }
};

// AI 生成健康评估
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

// AI 健康管家交互接口
export const chatWithHealthButler = async (
    userMessage: string, 
    userProfile: string, 
    availableResources: string,
    chatHistory: {role: 'user'|'model', text: string}[]
): Promise<{ text: string, recommendations: string[] }> => {
    const ai = getAI();
    const systemPrompt = `你是一个专业的“AI健康管家”，服务于郑州大学医院健康管理中心。
    你的任务是根据咨询结合用户的【健康档案】提供极速、专业的医学建议，并从【中心资源库】中匹配最适合的服务。

    【上下文信息】
    1. 用户档案摘要: ${userProfile}
    2. 中心可用资源清单: ${availableResources}

    【回复规则】
    - (语气): 亲切、严谨、高效。
    - (关联性): 如果用户提到的问题与其档案中的异常（如高尿酸）相关，请主动提醒。
    - (推荐): 从清单中选择 1-3 个最匹配的 ID (医生/商品/课程)，放入 recommendations 数组。

    必须返回 JSON:
    {
      "text": "你的专业建议文本",
      "recommendations": ["id1", "id2"] 
    }`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
                ...chatHistory.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
                { role: "user", parts: [{ text: userMessage }] }
            ],
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json"
            }
        });

        return JSON.parse(response.text || '{"text": "抱歉，由于网络波动，请稍后再试。", "recommendations": []}');
    } catch (e) {
        return { text: "服务繁忙，请稍后再试。", recommendations: [] };
    }
};

// 其他原有函数保持不变
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

export const generateHospitalBusinessAnalysis = async (topIssues: Record<string, number>): Promise<any> => {
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
