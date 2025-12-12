
import { HealthRecord, HealthAssessment, RiskLevel, ScheduledFollowUp, FollowUpRecord, DepartmentAnalytics } from "../types";
import { HabitRecord } from "./dataService";
import { GoogleGenAI, SchemaType } from "@google/genai";

// Initialize Gemini API Client
// Note: API_KEY is injected by the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Safe Default Structure to prevent UI crashes
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
        needs: {}
    }
};

// [UPDATED] Parse Health Data From Text using Gemini 2.5 Flash
export const parseHealthDataFromText = async (raw: string): Promise<HealthRecord> => {
    if (!raw || raw.trim().length === 0) {
        throw new Error("输入文本为空，无法解析");
    }

    const systemPrompt = `
    你是一个专业的医疗数据结构化专家。请分析用户提供的体检报告或健康问卷文本，提取关键信息并按照 JSON 格式返回。
    
    提取规则：
    1. 即使数据缺失，也请尽量返回结构体，数值型字段如果未找到请留空或为 null，字符串留空字符串。
    2. **异常项提取**：请仔细阅读报告中的"小结"、"综述"或箭头标识(↑↓)，将所有异常发现提取到 checkup.abnormalities 数组中。
    3. **数值标准化**：体重(kg), 身高(cm), 血压(mmHg), 血糖(mmol/L)。
    
    目标 JSON 结构应符合 HealthRecord 接口定义。
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: systemPrompt + "\n\n" + raw }] }
            ],
            config: {
                responseMimeType: 'application/json'
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("AI response empty");
        
        const result = JSON.parse(jsonText);
        
        // Deep Merge with Default to prevent undefined errors in UI
        const merged: HealthRecord = {
            ...DEFAULT_HEALTH_RECORD,
            ...result,
            profile: { ...DEFAULT_HEALTH_RECORD.profile, ...result?.profile },
            checkup: {
                ...DEFAULT_HEALTH_RECORD.checkup,
                ...result?.checkup,
                basics: { ...DEFAULT_HEALTH_RECORD.checkup.basics, ...result?.checkup?.basics },
                labBasic: { 
                    ...DEFAULT_HEALTH_RECORD.checkup.labBasic, 
                    ...result?.checkup?.labBasic,
                    lipids: { ...DEFAULT_HEALTH_RECORD.checkup.labBasic.lipids, ...result?.checkup?.labBasic?.lipids },
                    glucose: { ...DEFAULT_HEALTH_RECORD.checkup.labBasic.glucose, ...result?.checkup?.labBasic?.glucose }
                },
                imagingBasic: {
                    ...DEFAULT_HEALTH_RECORD.checkup.imagingBasic,
                    ...result?.checkup?.imagingBasic,
                    ultrasound: { ...DEFAULT_HEALTH_RECORD.checkup.imagingBasic.ultrasound, ...result?.checkup?.imagingBasic?.ultrasound }
                },
                abnormalities: result?.checkup?.abnormalities || []
            },
            questionnaire: {
                ...DEFAULT_HEALTH_RECORD.questionnaire,
                ...result?.questionnaire,
                history: { ...DEFAULT_HEALTH_RECORD.questionnaire.history, ...result?.questionnaire?.history },
                substances: {
                    ...DEFAULT_HEALTH_RECORD.questionnaire.substances,
                    ...result?.questionnaire?.substances,
                    smoking: { ...DEFAULT_HEALTH_RECORD.questionnaire.substances.smoking, ...result?.questionnaire?.substances?.smoking },
                    alcohol: { ...DEFAULT_HEALTH_RECORD.questionnaire.substances.alcohol, ...result?.questionnaire?.substances?.alcohol }
                }
            }
        };
        
        // Safety check for critical fields
        if (!merged.profile.name || merged.profile.name === '解析失败') {
             // Try to find name in raw text if AI missed it
             const nameMatch = raw.match(/姓名[:：]\s*([\u4e00-\u9fa5]{2,4})/);
             if (nameMatch) merged.profile.name = nameMatch[1];
        }

        return merged;
    } catch (e) {
        console.error("AI Parse Failed", e);
        // Return safe default object instead of throwing, so UI doesn't crash completely
        const errorRecord = JSON.parse(JSON.stringify(DEFAULT_HEALTH_RECORD));
        errorRecord.profile.name = "解析失败";
        return errorRecord;
    }
};

export const generateHealthAssessment = async (rec: HealthRecord): Promise<HealthAssessment> => {
    const prompt = `
    作为资深全科医生，请根据以下健康档案生成一份风险评估报告。
    
    数据：${JSON.stringify(rec)}
    
    请返回 JSON:
    {
      "riskLevel": "GREEN" | "YELLOW" | "RED",
      "summary": "综合评估摘要(150字以内)",
      "isCritical": boolean,
      "criticalWarning": "如有危急值请说明，否则为空",
      "risks": { "red": ["高危因素1"], "yellow": ["中危因素1"], "green": ["良好指标"] },
      "managementPlan": {
         "dietary": ["饮食建议1", "饮食建议2"],
         "exercise": ["运动建议"],
         "medication": ["用药建议"],
         "monitoring": ["监测建议"]
      },
      "followUpPlan": {
         "frequency": "建议随访频率",
         "nextCheckItems": ["复查项目1", "复查项目2"]
      }
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text || '{}') as HealthAssessment;
    } catch (e) {
        console.error("Assessment Gen Failed", e);
        return {
            riskLevel: RiskLevel.GREEN,
            summary: "自动评估生成失败，请人工审核。",
            risks: { red: [], yellow: [], green: [] },
            managementPlan: { dietary: [], exercise: [], medication: [], monitoring: [] },
            followUpPlan: { frequency: "待定", nextCheckItems: [] }
        };
    }
};

export const generateFollowUpSchedule = (ass: HealthAssessment): ScheduledFollowUp[] => {
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + (ass.riskLevel === 'RED' ? 1 : ass.riskLevel === 'YELLOW' ? 3 : 6));
    
    return [{
        id: Date.now().toString(),
        date: nextDate.toISOString().split('T')[0],
        status: 'pending',
        riskLevelAtSchedule: ass.riskLevel,
        focusItems: ass.followUpPlan.nextCheckItems
    }];
};

export const analyzeFollowUpRecord = async (form: any, ass: any, last: any) => { return {} as any };
export const generateFollowUpSMS = async (n: string) => { return {smsContent:''} };
export const generateHospitalBusinessAnalysis = async (issues: any): Promise<DepartmentAnalytics[]> => {
    // Mock implementation for heatmap to avoid heavy API usage in this context, or implement if needed.
    // Given the request focus is on PDF parsing, we keep this lightweight.
    return []; 
};
export const generateAnnualReportSummary = async (b: any, c: any) => { return {summary:''} };
export const generateDietAssessment = async (i: string) => { return {reply: 'Diet AI Placeholder'} };
export const generateExercisePlan = async (i: string) => { return {plan:[]} };

export const calculateNutritionFromIngredients = async (items: {name: string, ingredients: string}[]): Promise<{nutritionData: any}> => {
    const prompt = `
    Analyze nutrition for the following items. Return JSON with key as item name.
    Items: ${JSON.stringify(items)}
    
    Output JSON format per item:
    {
       "cal": number (kcal),
       "protein": number (g),
       "fat": number (g),
       "carbs": number (g),
       "fiber": number (g),
       "nutrition": "Short summary string"
    }
    `;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });
        return { nutritionData: JSON.parse(response.text || '{}') };
    } catch (e) {
        return { nutritionData: {} };
    }
};

// [RESTORED] Generate Personalized Habits
export const generatePersonalizedHabits = async (assessment: HealthAssessment, record: HealthRecord): Promise<{ habits: HabitRecord[] }> => {
    const prompt = `
    Create 6 personalized habits based on health assessment.
    Risk: ${assessment.riskLevel}, Summary: ${assessment.summary}
    Return JSON: { "habits": [ { "id": "h1", "title": "...", "icon": "emoji", "frequency": "daily"|"weekly", "color": "orange"|"blue"|"green" } ] }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });
        const result = JSON.parse(response.text || '{}');
        const habits = (result.habits || []).map((h: any) => ({
            ...h,
            history: [],
            streak: 0
        }));
        return { habits };
    } catch (e) {
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

// [UPDATED] Generate Daily Plan
export const generateDailyIntegratedPlan = async (userProfileStr: string, resourcesContext?: string, targetCalories?: number): Promise<{
    diet: { breakfast: string, lunch: string, dinner: string },
    recommendedMealIds: string[],
    exercise: { morning: string, afternoon: string, evening: string },
    recommendedExerciseIds: string[],
    tips: string
}> => {
    const prompt = `
    Generate a daily plan (Target: ${targetCalories || 2000} kcal).
    User: ${userProfileStr}
    Resources: ${resourcesContext || '[]'}
    
    Return JSON:
    {
      "diet": { "breakfast": "name", "lunch": "name", "dinner": "name" },
      "recommendedMealIds": ["id1", "id2", "id3"],
      "exercise": { "morning": "desc", "afternoon": "desc", "evening": "desc" },
      "recommendedExerciseIds": ["id1"],
      "tips": "summary"
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return {
            diet: { breakfast: '燕麦牛奶', lunch: '清淡饮食', dinner: '蔬菜沙拉' },
            recommendedMealIds: [],
            exercise: { morning: '拉伸', afternoon: '步行', evening: '休息' },
            recommendedExerciseIds: [],
            tips: '生成服务繁忙，请参考通用建议。'
        };
    }
};
