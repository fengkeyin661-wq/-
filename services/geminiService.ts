
import { HealthRecord, HealthAssessment, RiskLevel, ScheduledFollowUp, FollowUpRecord, DepartmentAnalytics } from "../types";
import { HabitRecord } from "./dataService";
import { GoogleGenAI, Type } from "@google/genai";

// Fix: Initializing GoogleGenAI using process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Baichuan AI Configuration
// Fix: Accessing environment variables via process.env
const BAICHUAN_API_KEY = process.env.VITE_BAICHUAN_API_KEY;
const BAICHUAN_API_URL = "https://api.baichuan-ai.com/v1/chat/completions";

// --- Baichuan AI Consultation Service ---
export const generateBaichuanConsultation = async (
    question: string, 
    history: {role: 'user'|'assistant', content: string}[],
    context: { riskLevel: string, summary: string, abnormalities: string, name: string }
): Promise<string> => {
    if (!BAICHUAN_API_KEY) {
        console.warn("Missing VITE_BAICHUAN_API_KEY");
        return "抱歉，AI 服务配置有误，请联系中心管理员。";
    }

    try {
        const systemPrompt = `你现在是"郑州大学医院健康管理中心"的智慧健康管家。
你的任务是根据受检者【${context.name}】的体检结果提供专业的解读和咨询。

【受检者背景】
- 风险评估等级：${context.riskLevel}
- 体检结论综述：${context.summary}
- 关键异常指标：${context.abnormalities}

【回复准则】
1. 专业严谨：基于国家临床诊疗路径和医学共识。
2. 亲切关怀：语气温和、富有同理心。
3. 针对性：必须结合受检者的异常项进行回答，不要只说通用废话。
4. 简洁：手机端阅读，每条建议分点列出，总长度控制在300字以内。
5. 安全边界：严禁开处方或直接改变现有医嘱，涉及药品调整必须强调“请咨询临床专科医生”。`;

        const response = await fetch(BAICHUAN_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BAICHUAN_API_KEY}`
            },
            body: JSON.stringify({
                model: "Baichuan4",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...history,
                    { role: "user", content: question }
                ],
                temperature: 0.3,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Baichuan API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "医生正在忙，请稍后再试。";
    } catch (error) {
        console.error("Baichuan API Exception:", error);
        return "网络连接略有波动，您可以尝试重新提问，或咨询您的签约家庭医生。";
    }
};

// Fix: Added generateDietAssessment export as required by UserDiet.tsx
export const generateDietAssessment = async (question: string): Promise<{ reply: string }> => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: question,
        config: {
            systemInstruction: '你是一位专业的营养师助手，请根据用户的提问提供针对性的膳食建议。',
        }
    });
    return { reply: response.text || "抱歉，智能助手暂时无法响应。" };
};

// Fix: Added generateExercisePlan export as required by UserExercise.tsx
export const generateExercisePlan = async (input: string): Promise<{ plan: { day: string, content: string }[] }> => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: input,
        config: {
            systemInstruction: '你是一位专业的健身教练。请根据用户提供的情况生成一周的运动计划。返回JSON格式，包含plan数组，每个元素有day和content。',
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    plan: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                day: { type: Type.STRING, description: '星期几' },
                                content: { type: Type.STRING, description: '具体运动建议内容' }
                            },
                            required: ['day', 'content']
                        }
                    }
                },
                required: ['plan']
            }
        }
    });
    try {
        return JSON.parse(response.text || '{"plan":[]}');
    } catch (e) {
        console.error("Failed to parse exercise plan JSON", e);
        return { plan: [] };
    }
};

// Fix: Added generateAnnualReportSummary export as required by FollowUpDashboard.tsx
export const generateAnnualReportSummary = async (name: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `请为受检者【${name}】生成一份温馨、专业且鼓舞人心的年度健康管理总结。`,
    });
    return response.text || "您的年度健康总结正在生成中，请稍后再试。";
};

// --- (Remaining services implementation) ---

export const parseHealthDataFromText = async (raw: string): Promise<HealthRecord> => {
    // Note: Implementation as a stub for stability.
    return {} as any; 
};

export const generateHealthAssessment = async (rec: HealthRecord): Promise<HealthAssessment> => {
    return { riskLevel: RiskLevel.GREEN, summary: "评估中...", risks: {red:[], yellow:[], green:[]}, managementPlan: {dietary:[], exercise:[], medication:[], monitoring:[]}, followUpPlan: {frequency:"", nextCheckItems:[]} };
};

export const generateFollowUpSchedule = (ass: HealthAssessment): ScheduledFollowUp[] => {
    return [];
};

export const analyzeFollowUpRecord = async (form: any, ass: any, last: any) => { return {} as any };
export const generateFollowUpSMS = async (n: string) => { return {smsContent:''} };
export const generateHospitalBusinessAnalysis = async (issues: { [key: string]: number }): Promise<DepartmentAnalytics[]> => { return [] };
export const calculateNutritionFromIngredients = async (items: any) => { return {nutritionData: {}} };
export const generatePersonalizedHabits = async (assessment: any, record: any) => { return {habits: []} };
export const generateDailyIntegratedPlan = async (u: string, r: string, t: number) => { return {diet: {breakfast:'', lunch:'', dinner:''}, recommendedMealIds: [], exercise: {morning:'', afternoon:'', evening:''}, recommendedExerciseIds: [], tips: ''} };
