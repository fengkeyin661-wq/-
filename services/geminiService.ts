
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

// ... (keep parseHealthDataFromText, generateHealthAssessment, generateFollowUpSchedule, analyzeFollowUpRecord, generateFollowUpSMS, generateHospitalBusinessAnalysis, generateAnnualReportSummary, generateDietAssessment, generateExercisePlan, calculateNutritionFromIngredients) ...
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

// [RESTORED] Generate Personalized Habits
export const generatePersonalizedHabits = async (assessment: HealthAssessment, record: HealthRecord): Promise<{ habits: HabitRecord[] }> => {
    const systemPrompt = `
    你是一名健康管理专家。请根据用户的健康评估结果和生活方式数据，为其设计 6 个个性化的每日/每周打卡习惯。
    
    设计原则：
    1. **针对性强**：如果用户有高血压，应包含“晨起测血压”或“低盐饮食”；如果有糖尿病，应包含“监测空腹血糖”或“不喝含糖饮料”；如果吸烟，包含“今日未吸烟”。
    2. **可执行性**：习惯必须是简单、明确、可量化的行动。
    3. **多样性**：涵盖饮食、运动、监测、生活作息等方面。
    
    请生成 JSON 格式，包含 6 个习惯对象。
    
    输出结构 HabitRecord:
    {
      "id": "h1"..."h6",
      "title": "简短标题(5字内)",
      "icon": "Emoji图标",
      "frequency": "daily" 或 "weekly",
      "targetDay": 如果是weekly，指定周几(0-6, 0是周日), daily则不填或null,
      "color": 颜色代码，仅限从以下选择: "orange", "green", "blue", "rose", "red", "pink", "purple"
    }
    
    JSON输出示例:
    {
      "habits": [
        { "id": "h1", "title": "吃早餐", "icon": "🍳", "frequency": "daily", "color": "orange" },
        ...
      ]
    }
    `;

    const userProfileSummary = `
    风险等级: ${assessment.riskLevel}
    主要健康问题: ${assessment.summary}
    高危因素: ${assessment.risks.red.join(', ')}
    中危因素: ${assessment.risks.yellow.join(', ')}
    既往病史: ${record.questionnaire.history.diseases.join(', ')}
    吸烟状况: ${record.questionnaire.substances.smoking.status}
    运动频率: ${record.questionnaire.exercise.frequency}
    `;

    try {
        const result = await callDeepSeek(systemPrompt, userProfileSummary, true);
        // Add required fields for local state that AI doesn't generate
        const habits = result.habits.map((h: any) => ({
            ...h,
            history: [],
            streak: 0
        }));
        return { habits };
    } catch (e) {
        console.error("Habit Gen Error", e);
        // Fallback
        return {
            habits: [
                { id: 'h1', title: '吃早餐', icon: '🍳', frequency: 'daily', history: [], streak: 0, color: 'orange' },
                { id: 'h2', title: '蔬菜300g+', icon: '🥦', frequency: 'daily', history: [], streak: 0, color: 'green' },
                { id: 'h3', title: '多喝水', icon: '💧', frequency: 'daily', history: [], streak: 0, color: 'blue' },
                { id: 'h4', title: '早睡早起', icon: '🌙', frequency: 'daily', history: [], streak: 0, color: 'purple' },
                { id: 'h5', title: '适量运动', icon: '🏃', frequency: 'daily', history: [], streak: 0, color: 'red' },
                { id: 'h6', title: '心情愉快', icon: '😄', frequency: 'daily', history: [], streak: 0, color: 'pink' },
            ]
        };
    }
};

// [UPDATED] Generate Daily Plan based on Resource Library with Strict Calculation
export const generateDailyIntegratedPlan = async (userProfileStr: string, resourcesContext?: string, targetCalories?: number): Promise<{
    diet: { breakfast: string, lunch: string, dinner: string },
    recommendedMealIds: string[],
    exercise: { morning: string, afternoon: string, evening: string },
    recommendedExerciseIds: string[],
    tips: string
}> => {
    const systemPrompt = `
    你是一名精准营养师。请从提供的【资源库】中挑选最合适的餐品和运动，生成一份符合用户热量目标的方案。
    
    【核心计算规则 - 必须严格遵守】
    1. 目标推荐摄入量 (Target Intake) = ${targetCalories || 2000} kcal
    2. **热量平衡公式**: (三餐摄入总热量 - 运动消耗热量) ≈ 目标推荐摄入量
       - 允许误差范围: ±150 kcal
    3. **三餐热量分配**:
       - 早餐: 约占摄入总量的 30%
       - 午餐: 约占摄入总量的 40%
       - 晚餐: 约占摄入总量的 30%
    
    【选择步骤】
    1. 先选择 1-2 项运动，估算总消耗热量 (Burned)。
    2. 计算所需摄入总热量 (Total Intake) = 目标推荐摄入量 + Burned。
    3. 按照 30%(早) / 40%(午) / 30%(晚) 的比例，从资源库中寻找热量最接近的餐品。
    
    【输出要求】
    - 请返回选中项目的 ID (recommendedMealIds, recommendedExerciseIds)。
    - diet 对象中请包含选定餐品的名称。
    
    输出格式 JSON:
    {
      "diet": { "breakfast": "餐品名", "lunch": "餐品名", "dinner": "餐品名" },
      "recommendedMealIds": ["早餐ID", "午餐ID", "晚餐ID"],
      "exercise": { "morning": "描述", "afternoon": "描述", "evening": "描述" },
      "recommendedExerciseIds": ["运动ID1", "运动ID2"],
      "tips": "简述热量安排: 摄入约xx - 运动约xx ≈ 目标"
    }
    `;

    const userContent = `
    用户画像: ${userProfileStr}
    
    可用资源库 (JSON, 包含热量 'cal' 字段):
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
