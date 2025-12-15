
import { HealthRecord, HealthAssessment, RiskLevel, ScheduledFollowUp, FollowUpRecord, DepartmentAnalytics } from "../types";
import { HabitRecord } from "./dataService";

// Helper to safely access environment variables
const getEnvVar = (key: string): string => {
  let val = '';
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta && import.meta.env) {
      // @ts-ignore
      val = import.meta.env[key];
    }
  } catch (e) {}

  if (val) return val;

  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process && process.env) {
      // @ts-ignore
      val = process.env[key];
    }
  } catch (e) {}

  return val || '';
};

// Determine environment
const isDev = (() => {
    try {
        // @ts-ignore
        return !!import.meta.env.DEV;
    } catch {
        return false;
    }
})();

// DeepSeek API Configuration
const API_KEY = getEnvVar('VITE_DEEPSEEK_API_KEY');

// PROXY STRATEGY:
const PROXY_URL = "/api/deepseek/chat/completions";
const DIRECT_URL = "https://api.deepseek.com/chat/completions";

const API_URL = isDev ? PROXY_URL : DIRECT_URL;

// Helper for DeepSeek API Calls
async function callDeepSeek(systemPrompt: string, userContent: string, jsonMode: boolean = true): Promise<string> {
    if (!API_KEY) {
        console.error("Missing VITE_DEEPSEEK_API_KEY");
        throw new Error("未配置 DeepSeek API Key，请检查环境变量");
    }

    const makeRequest = async (url: string) => {
        console.log(`[AI] Calling DeepSeek via ${url}...`);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent }
                ],
                temperature: 0.1,
                stream: false
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Request to ${url} failed: ${response.status} - ${errText.slice(0, 100)}`);
        }
        return response.json();
    };

    try {
        let data;
        try {
            data = await makeRequest(API_URL);
        } catch (initialError: any) {
            console.warn(`Initial AI request failed via ${API_URL}, retrying direct...`, initialError);
            if (API_URL !== DIRECT_URL) {
                 data = await makeRequest(DIRECT_URL);
            } else {
                throw initialError;
            }
        }

        let content = data.choices[0]?.message?.content || "";
        content = content.replace(/```json\n?|\n?```/g, "").trim();
        return content;

    } catch (e: any) {
        console.error("DeepSeek Call Exception:", e);
        if (e.message.includes('Failed to fetch') || e.message.includes('Network request failed')) {
            throw new Error("网络请求失败 (CORS blocked)。请确保正在运行 'npm run dev' 且 vite.config.ts 代理配置正确。");
        }
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
        needs: {}
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
    
    目标 JSON 结构应严格符合以下定义，不要包含任何注释：
    {
      "profile": { "checkupId": "string", "name": "string", "gender": "string", "age": number, "department": "string", "phone": "string", "checkupDate": "string" },
      "checkup": {
         "basics": { "height": number, "weight": number, "bmi": number, "sbp": number, "dbp": number, "waist": number },
         "labBasic": { 
            "glucose": { "fasting": "string" },
            "lipids": { "tc": "string", "tg": "string", "ldl": "string", "hdl": "string" },
            "liver": { "alt": "string", "ast": "string", "ggt": "string" },
            "renal": { "creatinine": "string", "ua": "string" },
            "tumorMarkers": { "cea": "string", "afp": "string" } 
         },
         "imagingBasic": { "ultrasound": { "thyroid": "string", "abdomen": "string", "breast": "string" } },
         "abnormalities": [ { "item": "string", "result": "string", "clinicalSig": "string" } ]
      },
      "questionnaire": {
         "history": { "diseases": ["string"] },
         "familyHistory": { "diabetes": boolean, "hypertension": boolean, "stroke": boolean, "cancer": boolean },
         "substances": { "smoking": { "status": "string" }, "alcohol": { "status": "string" } }
      }
    }
    `;

    try {
        const jsonText = await callDeepSeek(systemPrompt, raw);
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
        
        // --- 1. Automatic BMI Calculation ---
        const b = merged.checkup.basics;
        if (b.height && b.weight && b.height > 0 && b.weight > 0) {
            if (!b.bmi || b.bmi === 0) {
                const heightM = b.height / 100;
                const calculatedBMI = b.weight / (heightM * heightM);
                b.bmi = parseFloat(calculatedBMI.toFixed(1));
            }
        }

        if (!merged.profile.name || merged.profile.name === '解析失败') {
             const nameMatch = raw.match(/姓名[:：]\s*([\u4e00-\u9fa5]{2,4})/);
             if (nameMatch) merged.profile.name = nameMatch[1];
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
    
    请严格返回 JSON 格式:
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
        const jsonText = await callDeepSeek("你是一个辅助医生进行健康评估的AI。", prompt);
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

// [UPDATED] Hospital Heatmap Analysis (Intelligent Categorization)
export const generateHospitalBusinessAnalysis = async (issues: { [key: string]: number }): Promise<DepartmentAnalytics[]> => {
    const prompt = `
    作为医院运营专家，请根据以下全院体检异常数据统计(异常项: 人次)，进行智能科室归类和业务分析。
    
    输入数据(可能包含不规范描述): ${JSON.stringify(issues)}
    
    任务：
    1. 将这些异常项归类到对应的临床科室（如内分泌科、心血管内科、消化内科、外科、眼科等）。
    2. 估算每个科室的潜在患者人次（简单相加归属于该科室的异常项计数，去重估算）。
    3. 根据病种严重程度判断需求紧迫度(riskLevel)。
    
    请严格返回 JSON 数组，格式如下:
    [
      {
        "departmentName": "科室名称",
        "patientCount": 0, // 估算人次
        "riskLevel": "HIGH" | "MEDIUM" | "LOW", 
        "keyConditions": ["关联的异常1", "关联的异常2"], // 列出输入数据中归属于此科室的前3-5个高频异常项
        "suggestedServices": [
           { "name": "建议开展的项目名称", "count": 0, "description": "项目简述及推荐理由" }
        ]
      }
    ]
    `;

    try {
        const jsonText = await callDeepSeek("你是医院管理顾问，擅长数据清洗与业务规划。", prompt);
        return JSON.parse(jsonText || '[]');
    } catch (e) {
        console.error("Heatmap AI Gen Failed", e);
        // Robust Fallback
        return Object.keys(issues).length > 0 ? [
            {
                departmentName: "数据分析异常(Fallback)",
                patientCount: 0,
                riskLevel: "LOW",
                keyConditions: Object.keys(issues).slice(0, 5),
                suggestedServices: [{ name: "请检查网络或Key", count: 0, description: "AI服务暂时不可用" }]
            }
        ] : [];
    }
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
        const jsonText = await callDeepSeek("你是营养师。", prompt);
        return { nutritionData: JSON.parse(jsonText || '{}') };
    } catch (e) {
        return { nutritionData: {} };
    }
};

export const generatePersonalizedHabits = async (assessment: HealthAssessment, record: HealthRecord): Promise<{ habits: HabitRecord[] }> => {
    const prompt = `
    Create 6 personalized habits based on health assessment.
    Risk: ${assessment.riskLevel}, Summary: ${assessment.summary}
    Return JSON: { "habits": [ { "id": "h1", "title": "...", "icon": "emoji", "frequency": "daily"|"weekly", "color": "orange"|"blue"|"green" } ] }
    `;

    try {
        const jsonText = await callDeepSeek("你是健康管理专家。", prompt);
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
        const jsonText = await callDeepSeek("你是私人健康教练。", prompt);
        return JSON.parse(jsonText || '{}');
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
