
import { HealthRecord, HealthAssessment, RiskLevel, ScheduledFollowUp, FollowUpRecord, DepartmentAnalytics } from "../types";
import { HabitRecord } from "./dataService";
import { GoogleGenAI, Type } from "@google/genai";
import { ContentItem } from "./contentService";

// Fix: Strictly follow initialization guidelines for @google/genai, using process.env.API_KEY exclusively.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const chatWithHealthAssistant = async (
    userMessage: string,
    history: {role: 'user' | 'model', parts: {text: string}[]}[],
    context: {
        record: HealthRecord,
        followUps: FollowUpRecord[],
        availableResources: ContentItem[]
    }
) => {
    const { record, followUps, availableResources } = context;
    
    // 简化资源库供 AI 参考，避免 token 溢出
    const resourceSnapshot = availableResources.map(r => ({
        id: r.id,
        type: r.type,
        title: r.title,
        tags: r.tags,
        desc: r.description
    })).slice(0, 40);

    const systemInstruction = `
    你是一个专业的医院健康管理助手。你的名字叫“健康副驾驶”。
    
    【你的职责】
    1. 根据用户的健康档案和随访记录，回答用户的健康咨询。
    2. 从提供的资源库（availableResources）中，寻找最适合用户的医生、活动、健康餐或药品，并进行推荐。
    3. 如果用户没有提问，你应该根据其健康状况主动给出管理建议。
    
    【用户概况】
    姓名：${record.profile.name}，性别：${record.profile.gender}，年龄：${record.profile.age}岁。
    主要异常：${record.checkup.abnormalities.map(a => a.item).join(', ')}。
    最新风险等级：${record.profile.gender}。
    最近随访记录：${followUps.length > 0 ? followUps[followUps.length-1].assessment.majorIssues : '暂无'}。

    【输出格式要求】
    你的回答必须是 JSON 格式，包含以下字段：
    - reply: (string) 你对用户的自然语言回复，支持 Markdown 格式。
    - recommendedResourceIds: (string[]) 从 resourceSnapshot 中筛选出的推荐资源 ID 数组，如果没有则为空数组。最多推荐3个。
    
    保持亲切、专业、客观。不要推荐资源库之外的特定非处方药或治疗方案。
    `;

    try {
        // Fix: Use config.systemInstruction and responseSchema for better compliance and reliability.
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
                ...history,
                { role: 'user', parts: [{ text: userMessage }] }
            ],
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        reply: {
                            type: Type.STRING,
                            description: 'Professional healthcare assistant reply in Markdown.',
                        },
                        recommendedResourceIds: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: 'Up to 3 IDs of recommended resources from the snapshot.',
                        },
                    },
                    required: ["reply", "recommendedResourceIds"],
                },
                temperature: 0.7,
            }
        });

        // Fix: Extract text from response using the .text property as per standard @google/genai usage.
        const text = response.text || '{}';
        return JSON.parse(text);
    } catch (e) {
        console.error("AI Assistant Error:", e);
        return {
            reply: "抱歉，我现在处理信息遇到了一点困难。您可以先查看您的随访执行单或直接咨询签约医生。",
            recommendedResourceIds: []
        };
    }
};

// Fix: Existing stubs maintained for module structure.
export const parseHealthDataFromText = async (raw: string): Promise<HealthRecord> => {
    return {} as any; 
};

export const generateHealthAssessment = async (rec: HealthRecord): Promise<HealthAssessment> => { return {} as any; };
export const generateFollowUpSchedule = (ass: HealthAssessment): ScheduledFollowUp[] => { return [] as any; };
export const analyzeFollowUpRecord = async (form: any, ass: any, last: any) => { return {} as any };
export const generateFollowUpSMS = async (n: string) => { return {smsContent:''} };
export const generateHospitalBusinessAnalysis = async (issues: { [key: string]: number }): Promise<DepartmentAnalytics[]> => { return [] as any; };
export const calculateNutritionFromIngredients = async (items: {name: string, ingredients: string}[]): Promise<{nutritionData: any}> => { return {nutritionData:{}}; };
export const generatePersonalizedHabits = async (assessment: HealthAssessment, record: HealthRecord): Promise<{ habits: HabitRecord[] }> => { return {habits:[]}; };
export const generateDailyIntegratedPlan = async (userProfileStr: string, resourcesContext?: string, targetCalories?: number): Promise<any> => { return {}; };
export const generateDietAssessment = async (i: string) => { return {reply: ''} };
export const generateExercisePlan = async (i: string) => { return {plan:[]} };
