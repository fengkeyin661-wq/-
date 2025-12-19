
import { GoogleGenAI, Type } from "@google/genai";
import { HealthRecord, HealthAssessment, RiskLevel, ScheduledFollowUp, FollowUpRecord } from "../types";
import { ContentItem } from "./contentService";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- [AI 健康管家：深度咨询与资源匹配接口] ---
export const getButlerChatResponse = async (
    userMessage: string,
    history: {role: 'user'|'ai', content: string}[],
    record: HealthRecord,
    followUps: FollowUpRecord[],
    resources: ContentItem[]
): Promise<{ reply: string, recommendedItemIds?: string[], focusMetric?: string }> => {
    
    // 构建上下文：包含体检异常、最近随访、可用资源
    const abnormalities = record.checkup.abnormalities || [];
    const latestFollowUp = followUps.length > 0 ? followUps[followUps.length - 1] : null;
    
    const systemInstruction = `
    你是一名来自“郑州大学医院健康管理中心”的资深AI健康管家。你的任务是基于受检者的档案提供深度干预建议。

    【受检者核心档案】
    - 姓名：${record.profile.name}
    - 异常指标：${abnormalities.map(a => `${a.item}(${a.result})`).join('; ')}
    - 最近随访记录：${latestFollowUp ? `日期:${latestFollowUp.date}, 主诉:${latestFollowUp.mainComplaint}, 结论:${latestFollowUp.assessment.majorIssues}` : '暂无随访'}

    【中心资源库】
    你可以从以下现有服务中挑选最匹配的推荐给用户（必须返回对应的ID）：
    ${resources.map(r => `[类型:${r.type}] ID:${r.id}, 名称:${r.title}, 标签:${r.tags.join(',')}`).join('\n')}

    【回复准则】
    1. 语气：像私人医生一样温和、专业。称呼对方为“老师”。
    2. 深度咨询：如果用户问“怎么办”，必须结合体检异常。比如：有高尿酸，必须提醒避开海鲜酒精，并推荐中心的相关科普或医生。
    3. 混合交互：你的回复应引导用户查看你推荐的卡片。
    4. 禁忌：严禁给出具体的药物剂量处方，应引导预约中心医生。

    【输出格式】必须严格返回 JSON：
    {
       "reply": "Markdown格式的文字回复",
       "recommendedItemIds": ["匹配的资源ID1", "ID2"],
       "focusMetric": "当前讨论的核心指标名称"
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
                { role: 'user', parts: [{ text: `上下文：\n${history.map(h => `${h.role}:${h.content}`).join('\n')}\n\n当前提问：${userMessage}` }] }
            ],
            config: {
                systemInstruction,
                responseMimeType: "application/json",
            }
        });

        const resText = response.text || '{}';
        return JSON.parse(resText);
    } catch (e) {
        console.error("Gemini Butler Error:", e);
        return { reply: "管家正在整理您的健康档案，请稍后再试。", recommendedItemIds: [] };
    }
};

// 保持其他原有接口逻辑...
export const parseHealthDataFromText = async (raw: string): Promise<HealthRecord> => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: raw,
        config: {
            systemInstruction: "你是一个专业的医疗数据解析专家，请将文本解析为JSON结构...",
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || '{}');
};

export const generateHealthAssessment = async (rec: HealthRecord): Promise<HealthAssessment> => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: JSON.stringify(rec),
        config: {
            systemInstruction: "作为资深全科医生，生成健康评估报告JSON...",
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || '{}');
};

export const generateFollowUpSchedule = (ass: HealthAssessment): ScheduledFollowUp[] => {
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + (ass.riskLevel === 'RED' ? 1 : ass.riskLevel === 'YELLOW' ? 3 : 6));
    return [{ id: Date.now().toString(), date: nextDate.toISOString().split('T')[0], status: 'pending', riskLevelAtSchedule: ass.riskLevel, focusItems: ass.followUpPlan.nextCheckItems }];
};

// --- Implementation of missing functions and placeholders ---

// Fix for: components/user/UserDiet.tsx on line 3
export const generateDietAssessment = async (msg: string): Promise<{ reply: string }> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: msg,
            config: {
                systemInstruction: "你是一个专业的营养师，请根据用户的饮食情况提供专业的建议。语气要亲切专业。",
            }
        });
        return { reply: response.text || "抱歉，我暂时无法分析您的饮食。" };
    } catch (e) {
        console.error("Gemini Diet Error:", e);
        return { reply: "饮食分析服务暂时不可用。" };
    }
};

// Fix for: components/user/UserExercise.tsx on line 2
export const generateExercisePlan = async (input: string): Promise<{ plan: { day: string, content: string }[] }> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: input,
            config: {
                systemInstruction: "你是一个专业的健身教练。请根据用户提供的身体状况和目标设计一周计划。返回 JSON 数组，包含 day 和 content 字段。",
                responseMimeType: "application/json"
            }
        });
        return { plan: JSON.parse(response.text || "[]") };
    } catch (e) {
        console.error("Gemini Exercise Error:", e);
        return { plan: [] };
    }
};

// Implementation for FollowUpDashboard functionality
export const analyzeFollowUpRecord = async (form: any, ass: any, last: any): Promise<any> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `当前表单: ${JSON.stringify(form)}\n上期评估: ${JSON.stringify(ass)}\n上期随访: ${JSON.stringify(last)}`,
            config: {
                systemInstruction: "你是一名资深的随访管理医生。请根据体检指标和既往记录，生成随访评估 JSON：{ riskLevel, riskJustification, doctorMessage, majorIssues, nextCheckPlan, lifestyleGoals: [] }",
                responseMimeType: "application/json"
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        console.error("Gemini FollowUp Analysis Error:", e);
        return { riskLevel: 'GREEN', riskJustification: '分析异常', doctorMessage: '请继续保持健康生活习惯。', majorIssues: '无', nextCheckPlan: '按原计划复查', lifestyleGoals: [] };
    }
};

// Implementation for SMS generation
export const generateFollowUpSMS = async (name: string): Promise<{smsContent: string}> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `姓名: ${name}`,
            config: {
                systemInstruction: "你是一个医院助理。请为郑州大学医院健康管理中心生成一条温馨的随访提醒短信，针对没接电话或需要延期的受检者。",
            }
        });
        return { smsContent: response.text || "" };
    } catch (e) {
        console.error("Gemini SMS Error:", e);
        return { smsContent: "郑州大学医院健康管理中心提醒您：您的随访计划已更新，请关注通知。" };
    }
};

// Implementation for hospital analytics
export const generateHospitalBusinessAnalysis = async (issues: any): Promise<any[]> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `异常分布数据: ${JSON.stringify(issues)}`,
            config: {
                systemInstruction: "作为医院运营专家，根据体检问题分布分析科室业务潜力。返回 JSON 数组，包含 departmentName, patientCount, riskLevel (HIGH/MEDIUM/LOW), suggestedServices: [{name, description}], keyConditions: []",
                responseMimeType: "application/json"
            }
        });
        return JSON.parse(response.text || '[]');
    } catch (e) {
        console.error("Gemini Analytics Error:", e);
        return [];
    }
};

// Implementation for nutrition calculation
export const calculateNutritionFromIngredients = async (items: any[]): Promise<any> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: JSON.stringify(items),
            config: {
                systemInstruction: "你是一个专业的营养师。请根据提供的食材和重量，计算总热量及宏量营养素。返回 JSON { nutritionData: { [recipeName]: { cal, nutrition, protein, fat, carbs, fiber } } }",
                responseMimeType: "application/json"
            }
        });
        return JSON.parse(response.text || '{ "nutritionData": {} }');
    } catch (e) {
        console.error("Gemini Nutrition Error:", e);
        return { nutritionData: {} };
    }
};

// Implementation for habit generation
export const generatePersonalizedHabits = async (ass: any, rec: any): Promise<{ habits: any[] }> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `评估: ${JSON.stringify(ass)}\n档案: ${JSON.stringify(rec)}`,
            config: {
                systemInstruction: "你是一个健康教练。请根据用户的风险评估和档案生成 3-6 个个性化习惯任务。返回 JSON { habits: [{ id, title, icon, color, frequency, history: [], streak: 0 }] }",
                responseMimeType: "application/json"
            }
        });
        const result = JSON.parse(response.text || '{ "habits": [] }');
        return { habits: result.habits || [] };
    } catch (e) {
        console.error("Gemini Habits Error:", e);
        return { habits: [] };
    }
};

// Implementation for daily integrated plan
export const generateDailyIntegratedPlan = async (u: string, r: string, t: number): Promise<any> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `档案: ${u}\n资源: ${r}\n热量目标: ${t}`,
            config: {
                systemInstruction: "你是一个高级健康管家。请根据用户档案和资源库设计今日餐饮运动方案。返回 JSON：{ diet: { breakfast, lunch, dinner }, exercise: { morning, afternoon, evening }, tips, recommendedMealIds: [], recommendedExerciseIds: [] }",
                responseMimeType: "application/json"
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        console.error("Gemini Integrated Plan Error:", e);
        return {};
    }
};
