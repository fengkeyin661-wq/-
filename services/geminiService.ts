import { GoogleGenAI, Type } from "@google/genai";
import { HealthRecord, HealthAssessment, RiskLevel, ScheduledFollowUp, FollowUpRecord, DepartmentAnalytics } from "../types";
import { HabitRecord } from "./dataService";
import { ContentItem } from "./contentService";

// Helper to call Gemini
async function callGemini(systemInstruction: string, userMessage: any, jsonMode = true, model = 'gemini-3-pro-preview') {
    // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // If userMessage is history (array of objects), it's handled as is, otherwise as string
    const contents = Array.isArray(userMessage) ? userMessage : String(userMessage);

    const response = await ai.models.generateContent({
        model,
        contents,
        config: {
            systemInstruction,
            responseMimeType: jsonMode ? "application/json" : "text/plain"
        }
    });
    
    // Returns the extracted string output via .text property
    const text = response.text || (jsonMode ? '{}' : '');
    return jsonMode ? JSON.parse(text) : text;
}

// 1. 智能助手对话 (Gemini 版)
export const chatWithHealthAssistant = async (
    userMessage: string,
    history: {role: 'user' | 'assistant', content: string}[],
    context: {
        record: HealthRecord,
        followUps: FollowUpRecord[],
        availableResources: ContentItem[]
    }
) => {
    const { record, followUps, availableResources } = context;
    const resourceSnapshot = availableResources.map(r => ({
        id: r.id,
        type: r.type,
        title: r.title,
        tags: r.tags,
        desc: r.description
    })).slice(0, 30);

    // FIX: Removed reference to non-existent 'risk_level' property on HealthRecord
    const systemInstruction = `你是一个专业的医院健康管理助手“健康副驾驶”。
    用户概况：姓名 ${record.profile.name}，年龄 ${record.profile.age}，主要异常：${record.checkup.abnormalities.map(a => a.item).join(', ')}。
    
    任务：
    1. 根据用户健康状况提供专业建议。
    2. 从资源库推荐合适的医生(doctor)、健康餐(meal)或活动(event)。
    
    输出 JSON 格式：
    {
      "reply": "Markdown 格式的回复",
      "recommendedResourceIds": ["ID1", "ID2"]
    }
    
    资源库：${JSON.stringify(resourceSnapshot)}`;

    const geminiHistory = history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
    }));
    geminiHistory.push({ role: 'user', parts: [{ text: userMessage }] });

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: geminiHistory,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        reply: { type: Type.STRING, description: "Markdown 格式的回复" },
                        recommendedResourceIds: { 
                            type: Type.ARRAY, 
                            items: { type: Type.STRING },
                            description: "推荐资源ID列表"
                        }
                    },
                    required: ["reply", "recommendedResourceIds"]
                }
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        console.error("Gemini API Call Failed:", e);
        return {
            reply: "抱歉，由于网络波动，我暂时无法处理您的请求。请稍后再试或联系医生。",
            recommendedResourceIds: []
        };
    }
};

// 2. 体检报告智能解析 (Gemini 版)
export const parseHealthDataFromText = async (raw: string): Promise<HealthRecord> => {
    return await callGemini(
        "你是一个专业的病案解析专家。请将用户提供的零散体检数据或问卷信息提取为结构化的 HealthRecord JSON 对象。请严格遵守字段定义。",
        raw
    );
};

// 3. 生成健康评估报告 (Gemini 版)
export const generateHealthAssessment = async (rec: HealthRecord): Promise<HealthAssessment> => {
    return await callGemini(
        "根据用户的体检数据和问卷，生成一份专业的健康评估。必须识别危急值(Critical Values)并给出明确警告。输出符合 HealthAssessment 结构的 JSON。",
        JSON.stringify(rec)
    );
};

// 4. 生成随访计划
export const generateFollowUpSchedule = (ass: HealthAssessment): ScheduledFollowUp[] => {
    const today = new Date();
    const risk = ass.riskLevel;
    const interval = risk === 'RED' ? 1 : risk === 'YELLOW' ? 3 : 6;
    
    const nextDate = new Date();
    nextDate.setMonth(today.getMonth() + interval);
    
    return [{
        id: Date.now().toString(),
        date: nextDate.toISOString().split('T')[0],
        status: 'pending',
        riskLevelAtSchedule: risk as any,
        focusItems: ass.followUpPlan.nextCheckItems
    }];
};

// 5. 随访记录分析 (Gemini 版)
export const analyzeFollowUpRecord = async (form: any, ass: any, last: any) => {
    return await callGemini(
        "你是一个随访医生助手。请对比本次随访指标与上次的差异，评估干预效果，并给出下阶段调整方案。输出 JSON。",
        JSON.stringify({ current: form, assessment: ass, lastRecord: last })
    );
};

// 6. 生成随访提醒短信 (Gemini 版)
export const generateFollowUpSMS = async (name: string) => {
    return await callGemini(
        "你是一个亲切的健康管理助手。",
        `请为患者 ${name} 撰写一条亲切的随访提醒短信。由于对方未接电话，建议其关注公众号查看健康执行单并保持健康生活。输出JSON：{"smsContent": "..."}`,
        true,
        'gemini-3-flash-preview'
    );
};

// 7. 全院医疗业务挖掘热力图分析 (Gemini 版)
export const generateHospitalBusinessAnalysis = async (issues: { [key: string]: number }): Promise<DepartmentAnalytics[]> => {
    return await callGemini(
        "你是一个医院运营分析师。根据给定的群体健康异常统计，分析医院各科室的潜在业务增长点，并推荐具体服务项目。输出符合 DepartmentAnalytics[] 结构的 JSON。",
        JSON.stringify(issues)
    );
};

// 8. 智能营养分析 (Gemini 版)
export const calculateNutritionFromIngredients = async (items: {name: string, ingredients: string}[]): Promise<{nutritionData: any}> => {
    return await callGemini(
        "你是一个专业的营养师。根据提供的菜名和配料，计算其热量、蛋白质、脂肪、碳水和膳食纤维。输出 JSON 结构。",
        JSON.stringify(items),
        true,
        'gemini-3-flash-preview'
    );
};

// 9. 生成个性化生活习惯 (Gemini 版)
export const generatePersonalizedHabits = async (assessment: HealthAssessment, record: HealthRecord): Promise<{ habits: HabitRecord[] }> => {
    return await callGemini(
        "根据用户的健康风险，制定 3-5 个具体的、可量化的每日健康习惯（如：晨起空腹血糖监测、每日快走30分钟）。输出 JSON。",
        JSON.stringify({ assessment, record })
    );
};

// 10. 每日综合方案生成 (Gemini 版)
export const generateDailyIntegratedPlan = async (userProfileStr: string, resourcesContext?: string, targetCalories?: number): Promise<any> => {
    return await callGemini(
        `你是一个全能健康教练。根据用户的健康状况和目标热量 (${targetCalories}kcal)，从提供的资源库中匹配最合适的食谱和运动，生成一天的执行计划。输出 JSON。`,
        `用户信息：${userProfileStr}\n资源：${resourcesContext}`
    );
};

// 11. 饮食/运动评估简答 (Gemini 版)
export const generateDietAssessment = async (input: string) => {
    return await callGemini(
        "你是一个专业的营养师。",
        `作为营养师，请简要评估并建议：${input}。输出JSON：{"reply": "..."}`,
        true,
        'gemini-3-flash-preview'
    );
};

export const generateExercisePlan = async (input: string) => {
    return await callGemini(
        "你是一个运动康复专家。",
        `作为运动康复专家，请为用户制定 7 天运动计划：${input}。输出JSON：{"plan": [{"day": "周一", "content": "..."}]}`,
        true
    );
};