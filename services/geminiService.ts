
// ... (imports) ...
import { HealthRecord, HealthAssessment, RiskLevel, ScheduledFollowUp, FollowUpRecord, DepartmentAnalytics } from "../types";
import { HabitRecord } from "./dataService";

// ... (config and other existing functions) ...
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

const getEnvVar = (key: string): string => {
  try { if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key]; } catch (e) {}
  try { 
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env) return import.meta.env[key] || import.meta.env['VITE_DEEPSEEK_API_KEY'] || ''; 
  } catch (e) {}
  return '';
};

const getApiKey = () => getEnvVar('VITE_DEEPSEEK_API_KEY');

const callDeepSeek = async (systemPrompt: string, userContent: string, jsonMode: boolean = true) => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key Missing");

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
                response_format: jsonMode ? { type: "json_object" } : undefined,
                temperature: 0.1,
                stream: false
            })
        });
        if (!response.ok) throw new Error(`DeepSeek Error: ${response.status}`);
        const data = await response.json();
        const content = data.choices[0].message.content.replace(/```json\n?|```/g, '').trim();
        return jsonMode ? JSON.parse(content) : content;
    } catch (error) { throw error; }
};

// ... (keep other functions unchanged) ...
export const parseHealthDataFromText = async (raw: string) => { return {} as HealthRecord }; 
export const generateHealthAssessment = async (rec: HealthRecord) => { return {} as HealthAssessment };
export const generateFollowUpSchedule = (ass: HealthAssessment) => { return [] as ScheduledFollowUp[] };
export const analyzeFollowUpRecord = async (form: any, ass: any, last: any) => { return {} as any };
export const generateFollowUpSMS = async (n: string) => { return {smsContent:''} };
export const generateHospitalBusinessAnalysis = async (issues: any) => { return [] as DepartmentAnalytics[] };
export const generateAnnualReportSummary = async (b: any, c: any) => { return {summary:''} };
export const generateDietAssessment = async (i: string) => { return {reply:''} };
export const generateExercisePlan = async (i: string) => { return {plan:[]} };
export const calculateNutritionFromIngredients = async (r: any): Promise<{nutritionData: any}> => { return {nutritionData:{}} };
export const generatePersonalizedHabits = async (assessment: HealthAssessment, record: HealthRecord) => { return { habits: [] as HabitRecord[] } };

// [UPDATED] Generate Daily Plan based on Resource Library
export const generateDailyIntegratedPlan = async (userProfileStr: string, resourcesContext?: string): Promise<{
    diet: { breakfast: string, lunch: string, dinner: string },
    recommendedMealIds: string[],
    exercise: { morning: string, afternoon: string, evening: string },
    recommendedExerciseIds: string[],
    tips: string
}> => {
    const systemPrompt = `
    你是一名精准营养师。请根据用户的健康画像，从提供的【资源库】中挑选最合适的餐品和运动。
    
    任务：
    1. 分析用户健康状况（如高血压需低钠，糖尿病需低GI）。
    2. 从资源库JSON中选择：
       - 1个早餐 (meal)
       - 1个午餐 (meal)
       - 1个晚餐 (meal)
       - 1-2个运动项目 (exercise)
    3. 返回选中项目的 ID。
    
    输出格式 JSON:
    {
      "diet": { "breakfast": "餐品名", "lunch": "餐品名", "dinner": "餐品名" },
      "recommendedMealIds": ["id1", "id2", "id3"],
      "exercise": { "morning": "描述", "afternoon": "描述", "evening": "描述" },
      "recommendedExerciseIds": ["exId1", "exId2"],
      "tips": "针对性的一句话建议"
    }
    `;

    const userContent = `
    用户画像: ${userProfileStr}
    
    可用资源库 (JSON):
    ${resourcesContext || '[]'}
    `;

    try {
        return await callDeepSeek(systemPrompt, userContent, true);
    } catch (e) {
        console.error("Plan Gen Error", e);
        // Fallback with empty IDs
        return {
            diet: { breakfast: '燕麦牛奶', lunch: '清淡饮食', dinner: '蔬菜沙拉' },
            recommendedMealIds: [],
            exercise: { morning: '拉伸', afternoon: '步行', evening: '休息' },
            recommendedExerciseIds: [],
            tips: '生成服务繁忙，请参考通用建议。'
        };
    }
};
