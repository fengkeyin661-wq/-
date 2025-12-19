
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

// [FIX] Improved data extraction with systemInstruction
export const parseHealthDataFromText = async (text: string): Promise<HealthRecord> => {
    const ai = getAI();
    const systemPrompt = `你是一个专业的医学数据提取助手。你的任务是从用户提供的非结构化体检报告或问卷文本中提取关键指标，并转换为结构化的 JSON 格式。
    如果姓名无法识别，请在姓名中包含“解析失败”。`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `待解析文本:\n${text}`,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json"
        }
    });

    try {
        return JSON.parse(response.text || "{}");
    } catch (e) {
        console.error("Parse Error:", e);
        throw new Error("AI 数据提取失败，请检查输入格式。");
    }
};

// [FIX] Improved assessment generation with systemInstruction
export const generateHealthAssessment = async (data: HealthRecord): Promise<HealthAssessment> => {
    const ai = getAI();
    const systemPrompt = `你是一个资深的健康管理专家。请根据提供的个人健康档案（包含体检数据和问卷调查），生成一份专业的健康风险评估报告。
    要求：
    1. 判定整体风险等级 (RED/YELLOW/GREEN)。
    2. 如果发现危急值（如血压>=180/110, 血糖>=16.7等），必须标记 isCritical 为 true。
    3. 提供饮食、运动、医疗、监测四个维度的管理方案。`;

    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `健康数据:\n${JSON.stringify(data)}`,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json"
        }
    });

    return JSON.parse(response.text || "{}");
};

// [FIX] Added missing exported member 'generateFollowUpSchedule'
export const generateFollowUpSchedule = (assessment: HealthAssessment): ScheduledFollowUp[] => {
    const risk = assessment.riskLevel;
    const focus = assessment.followUpPlan.nextCheckItems;
    const intervalMonths = risk === RiskLevel.RED ? 1 : risk === RiskLevel.YELLOW ? 3 : 6;
    
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + intervalMonths);

    return [{
        id: Date.now().toString(),
        date: nextDate.toISOString().split('T')[0],
        status: 'pending',
        riskLevelAtSchedule: risk,
        focusItems: focus
    }];
};

// [FIX] Corrected return type from HealthAssessment['assessment'] to FollowUpRecord['assessment']
export const analyzeFollowUpRecord = async (
    current: Omit<FollowUpRecord, 'id'>, 
    baseline: HealthAssessment | null,
    latest: FollowUpRecord | null
): Promise<FollowUpRecord['assessment']> => {
    const ai = getAI();
    const systemPrompt = `你是一个专业的随访数据分析专家。请根据基线评估、上次随访记录和本次随访数据，给出本次随访的评估结论。
    返回 JSON 包含 riskLevel, riskJustification, majorIssues, referral (boolean), nextCheckPlan, lifestyleGoals (array), doctorMessage。`;
    const prompt = `基线评估: ${JSON.stringify(baseline)}。上次随访: ${JSON.stringify(latest)}。本次数据: ${JSON.stringify(current)}。`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { 
            systemInstruction: systemPrompt,
            responseMimeType: "application/json" 
        }
    });

    return JSON.parse(response.text || "{}");
};

// [FIX] Added missing exported member 'generateFollowUpSMS'
export const generateFollowUpSMS = async (patientName: string): Promise<{smsContent: string}> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `请为患者 ${patientName} 撰写一条亲切的随访提醒短信，告知其近期有复查计划，并询问其身体近况。`,
    });
    return { smsContent: response.text || "" };
};

// [FIX] Added missing exported member 'generateAnnualReportSummary'
export const generateAnnualReportSummary = async (records: FollowUpRecord[]): Promise<string> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `根据以下全年的随访记录，生成一份年度健康总结摘要：\n${JSON.stringify(records)}`,
    });
    return response.text || "";
};

// [FIX] Added missing exported member 'generateHospitalBusinessAnalysis'
export const generateHospitalBusinessAnalysis = async (topIssues: Record<string, number>): Promise<DepartmentAnalytics[]> => {
    const ai = getAI();
    const prompt = `基于以下医院检出的前80位健康异常统计，分析各科室的潜在业务需求：\n${JSON.stringify(topIssues)}`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text || "[]");
};

// [FIX] Added missing exported member 'generateDietAssessment'
export const generateDietAssessment = async (message: string): Promise<{reply: string}> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: message,
    });
    return { reply: response.text || "" };
};

// [FIX] Added missing exported member 'generateExercisePlan'
export const generateExercisePlan = async (input: string): Promise<{plan: {day: string, content: string}[]}> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `根据用户需求生成一周运动计划：${input}`,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{"plan": []}');
};

// [FIX] Added missing exported member 'generateDailyIntegratedPlan'
export const generateDailyIntegratedPlan = async (profileStr: string, resources: string, tdee: number): Promise<any> => {
    const ai = getAI();
    const prompt = `用户画像: ${profileStr}\n目标能量: ${tdee}kcal\n可用资源: ${resources}\n请从资源库中选择合适的餐品和运动，生成今日方案。`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text || "{}");
};

// [FIX] Added missing exported member 'calculateNutritionFromIngredients'
export const calculateNutritionFromIngredients = async (items: {name: string, ingredients: string}[]): Promise<any> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `计算以下食谱的营养成分：${JSON.stringify(items)}`,
        config: { responseMimeType: "application/json" }
    });
    return { nutritionData: JSON.parse(response.text || "{}") };
};

// [FIX] Added missing exported member 'generatePersonalizedHabits'
export const generatePersonalizedHabits = async (ass: HealthAssessment, rec: HealthRecord): Promise<{habits: HabitRecord[]}> => {
    const ai = getAI();
    const prompt = `根据风险评估：${ass.summary}，为该用户推荐3-6个每日健康打卡习惯。`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    return { habits: JSON.parse(response.text || '{"habits": []}').habits };
};

// AI 健康管家聊天接口
export const chatWithHealthButler = async (
    userMessage: string, 
    userProfile: string, 
    availableResources: string,
    chatHistory: {role: 'user'|'model', text: string}[]
): Promise<{ text: string, recommendations: string[] }> => {
    const systemPrompt = `你是一个专业的“私人医生助手”，服务于郑州大学医院健康管理中心。
    你的任务是根据用户的咨询，结合其【个人健康档案】提供医学建议，并从【中心资源库】中匹配最适合的服务。
    
    【上下文信息】
    1. 用户档案摘要: ${userProfile}
    2. 中心可用资源清单: ${availableResources}`;

    try {
        const ai = getAI();
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

        return JSON.parse(response.text || '{"text": "抱歉，我暂时无法处理您的请求。", "recommendations": []}');
    } catch (e) {
        console.error("Butler AI Error:", e);
        return { text: "由于网络连接问题，我无法连接到医学知识库。请稍后再试。", recommendations: [] };
    }
};
