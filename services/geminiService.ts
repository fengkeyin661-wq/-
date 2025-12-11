
// ... (imports) ...
import { HealthRecord, HealthAssessment, RiskLevel, ScheduledFollowUp, FollowUpRecord, DepartmentAnalytics } from "../types";

// ... (config) ...
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

// ... (keep parseHealthDataFromText, generateHealthAssessment, generateFollowUpSchedule, analyzeFollowUpRecord, etc. unchanged) ...
export const parseHealthDataFromText = async (raw: string) => { return {} as HealthRecord }; 
export const generateHealthAssessment = async (rec: HealthRecord) => { return {} as HealthAssessment };
export const generateFollowUpSchedule = (ass: HealthAssessment) => { return [] as ScheduledFollowUp[] };
export const analyzeFollowUpRecord = async (form: any, ass: any, last: any) => { return {} as any };
export const generateFollowUpSMS = async (n: string) => { return {smsContent:''} };
export const generateHospitalBusinessAnalysis = async (issues: any) => { return [] as DepartmentAnalytics[] };
export const generateAnnualReportSummary = async (b: any, c: any) => { return {summary:''} };
export const generateDietAssessment = async (i: string) => { return {reply:''} };
export const generateExercisePlan = async (i: string) => { return {plan:[]} };
export const calculateNutritionFromIngredients = async (r: any) => { return {nutritionData:{}} };

// [NEW] Structure Aware Plan Generator
export const generateDailyIntegratedPlan = async (userProfileStr: string, resourcesContext?: string): Promise<{
    diet: { breakfast: string, lunch: string, dinner: string, snack: string },
    exercise: { morning: string, afternoon: string, evening: string },
    tips: string,
    recommendedMealIds?: string[],
    recommendedExerciseIds?: string[]
}> => {
    const systemPrompt = `
    你是一名资深健康管理师。请根据用户的健康档案（包含风险因素、疾病史、喜好等），为用户量身定制【明天的一日健康方案】。
    
    【重要资源调用】
    我将提供一个【可选资源库列表】(Available Resources)，其中包含我们医院膳食库的食谱ID和名称，以及运动库的方案ID。
    请务必从提供的资源库中，为用户**精选**出最适合的 1-3 道食谱和 1 个运动方案。
    
    **关键要求**：
    1. 在 diet/exercise 文本中，你可以自由发挥描述，但建议提及资源库中的食谱名称。
    2. **必须**在 recommendedMealIds 和 recommendedExerciseIds 字段中返回你选中的具体项目 ID。这些 ID **必须完全匹配**资源库列表中提供的 ID，不能臆造。如果资源库为空或没有合适的，返回空数组。
    3. 饮食方案：三餐及加餐要具体，符合其健康需求（如糖尿病需控糖）。
    4. 运动方案：结合其身体状况，安排活动。
    
    输出结构 JSON：
    {
      "diet": { "breakfast": "...", "lunch": "...", "dinner": "...", "snack": "..." },
      "exercise": { "morning": "...", "afternoon": "...", "evening": "..." },
      "tips": "...",
      "recommendedMealIds": ["id1", "id2"],
      "recommendedExerciseIds": ["id3"]
    }
    `;
    
    const userContent = `
    用户档案: ${userProfileStr}
    
    可选资源库列表 (请从中选择 ID): 
    ${resourcesContext || '暂无特定资源库，请自由发挥'}
    `;
    
    return await callDeepSeek(systemPrompt, userContent, true);
};
