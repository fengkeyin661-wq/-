
import { GoogleGenAI, Type } from "@google/genai";
import { HealthRecord, HealthAssessment, RiskLevel, ScheduledFollowUp, FollowUpRecord, DepartmentAnalytics } from "../types";
import { HabitRecord } from "./dataService";

// Initialization as per guidelines
// Fix: Use process.env.API_KEY directly as required by guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper for Gemini API Calls
async function callGemini(systemPrompt: string, userContent: string, jsonMode: boolean = true, schema?: any): Promise<string> {
    const config: any = {
        systemInstruction: systemPrompt,
    };
    
    if (jsonMode) {
        config.responseMimeType = "application/json";
        if (schema) config.responseSchema = schema;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: userContent,
            config: config,
        });

        // Fix: Use .text property as per guidelines
        return response.text || "";
    } catch (e: any) {
        console.error("Gemini Call Exception:", e);
        throw e;
    }
}

// Safe Default Structure
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
        needs: {},
        satisfaction: {}
    }
};

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
    4. **关键字段识别**：
       - **体检编号 (checkupId)**：请务必精确抓取**6位纯数字**的编号。
       - **问卷选项提取**：请根据文本内容提取对应选项。
    `;

    try {
        const jsonText = await callGemini(systemPrompt, raw);
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
                medication: { ...DEFAULT_HEALTH_RECORD.questionnaire.medication, ...result?.questionnaire?.medication },
                diet: { ...DEFAULT_HEALTH_RECORD.questionnaire.diet, ...result?.questionnaire?.diet },
                hydration: { ...DEFAULT_HEALTH_RECORD.questionnaire.hydration, ...result?.questionnaire?.hydration },
                exercise: { ...DEFAULT_HEALTH_RECORD.questionnaire.exercise, ...result?.questionnaire?.exercise },
                sleep: { ...DEFAULT_HEALTH_RECORD.questionnaire.sleep, ...result?.questionnaire?.sleep },
                respiratory: { ...DEFAULT_HEALTH_RECORD.questionnaire.respiratory, ...result?.questionnaire?.respiratory },
                mental: { ...DEFAULT_HEALTH_RECORD.questionnaire.mental, ...result?.questionnaire?.mental },
                mentalScales: { ...DEFAULT_HEALTH_RECORD.questionnaire.mentalScales, ...result?.questionnaire?.mentalScales },
                needs: { ...DEFAULT_HEALTH_RECORD.questionnaire.needs, ...result?.questionnaire?.needs },
                satisfaction: { ...DEFAULT_HEALTH_RECORD.questionnaire.satisfaction, ...result?.questionnaire?.satisfaction },
                substances: {
                    ...DEFAULT_HEALTH_RECORD.questionnaire.substances,
                    ...result?.questionnaire?.substances,
                    smoking: { ...DEFAULT_HEALTH_RECORD.questionnaire.substances.smoking, ...result?.questionnaire?.substances?.smoking },
                    alcohol: { ...DEFAULT_HEALTH_RECORD.questionnaire.substances.alcohol, ...result?.questionnaire?.substances?.alcohol }
                }
            }
        };
        
        // --- Automatic BMI Calculation ---
        const b = merged.checkup.basics;
        if (b.height && b.weight && b.height > 0 && b.weight > 0) {
            if (!b.bmi || b.bmi === 0) {
                const heightM = b.height / 100;
                const calculatedBMI = b.weight / (heightM * heightM);
                b.bmi = parseFloat(calculatedBMI.toFixed(1));
            }
        }

        return merged;
    } catch (e: any) {
        console.error("AI Parse Failed", e);
        const errorRecord = JSON.parse(JSON.stringify(DEFAULT_HEALTH_RECORD));
        errorRecord.profile.name = `解析失败: ${e.message || '未知错误'}`;
        return errorRecord;
    }
};

export const generateHealthAssessment = async (rec: HealthRecord): Promise<HealthAssessment> => {
    const prompt = `
    作为资深全科医生，请根据以下健康档案生成一份风险评估报告。
    数据：${JSON.stringify(rec)}
    `;

    try {
        const jsonText = await callGemini("你是一个辅助医生进行健康评估的AI。", prompt);
        return JSON.parse(jsonText || '{}') as HealthAssessment;
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

export const generateHospitalBusinessAnalysis = async (issues: { [key: string]: number }): Promise<DepartmentAnalytics[]> => {
    const prompt = `
    作为医院运营专家，请根据以下全院体检异常数据统计进行科室归类和业务规划。
    输入数据: ${JSON.stringify(issues)}
    `;

    try {
        const jsonText = await callGemini("你是医院管理顾问。", prompt);
        const result = JSON.parse(jsonText || '[]');
        return Array.isArray(result) ? result : [];
    } catch (e) {
        console.warn("Heatmap AI Gen Failed", e);
        return [];
    }
};

export const generateAnnualReportSummary = async (b: any, c: any) => { return {summary:''} };
export const generateDietAssessment = async (i: string) => { return {reply: 'Diet AI Placeholder'} };
export const generateExercisePlan = async (i: string) => { return {plan:[]} };

export const calculateNutritionFromIngredients = async (items: {name: string, ingredients: string}[]): Promise<{nutritionData: any}> => {
    const prompt = `
    Analyze nutrition for the following items. Return JSON with key as item name.
    Items: ${JSON.stringify(items)}
    `;
    try {
        const jsonText = await callGemini("你是营养师。", prompt);
        return { nutritionData: JSON.parse(jsonText || '{}') };
    } catch (e) {
        return { nutritionData: {} };
    }
};

export const generatePersonalizedHabits = async (assessment: HealthAssessment, record: HealthRecord): Promise<{ habits: HabitRecord[] }> => {
    const prompt = `
    Create 6 personalized habits based on health assessment.
    Risk: ${assessment.riskLevel}, Summary: ${assessment.summary}
    `;

    try {
        const jsonText = await callGemini("你是健康管理专家。", prompt);
        const result = JSON.parse(jsonText || '{}');
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

// Fix: Updated return type to include 'snack' to resolve type mismatch with DailyHealthPlan
export const generateDailyIntegratedPlan = async (userProfileStr: string, resourcesContext?: string, targetCalories?: number): Promise<{
    diet: { breakfast: string, lunch: string, dinner: string, snack: string },
    recommendedMealIds: string[],
    exercise: { morning: string, afternoon: string, evening: string },
    recommendedExerciseIds: string[],
    tips: string
}> => {
    const prompt = `
    Generate a daily plan (Target: ${targetCalories || 2000} kcal).
    User: ${userProfileStr}
    Resources: ${resourcesContext || '[]'}
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            diet: {
                type: Type.OBJECT,
                properties: {
                    breakfast: { type: Type.STRING },
                    lunch: { type: Type.STRING },
                    dinner: { type: Type.STRING },
                    snack: { type: Type.STRING },
                },
                required: ["breakfast", "lunch", "dinner", "snack"],
            },
            recommendedMealIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            },
            exercise: {
                type: Type.OBJECT,
                properties: {
                    morning: { type: Type.STRING },
                    afternoon: { type: Type.STRING },
                    evening: { type: Type.STRING },
                },
                required: ["morning", "afternoon", "evening"],
            },
            recommendedExerciseIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            },
            tips: { type: Type.STRING }
        },
        required: ["diet", "recommendedMealIds", "exercise", "recommendedExerciseIds", "tips"]
    };

    try {
        const jsonText = await callGemini("你是私人健康教练。", prompt, true, schema);
        return JSON.parse(jsonText || '{}');
    } catch (e) {
        return {
            diet: { breakfast: '燕麦牛奶', lunch: '清淡饮食', dinner: '蔬菜沙拉', snack: '坚果一小把' },
            recommendedMealIds: [],
            exercise: { morning: '拉伸', afternoon: '步行', evening: '休息' },
            recommendedExerciseIds: [],
            tips: '生成服务繁忙，请参考通用建议。'
        };
    }
};
