
import { GoogleGenAI, Type } from "@google/genai";
import { HealthRecord, HealthAssessment, ScheduledFollowUp, FollowUpRecord, RiskLevel } from "../types";
import { ContentItem } from "./contentService";

// Initialize Gemini AI with API key from environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * AI 健康管家：深度咨询与智能匹配接口
 * 整合体检、随访、资源库，实现“诊后闭环”
 */
export const getButlerChatResponse = async (
    userMessage: string,
    history: {role: 'user'|'ai', content: string}[],
    record: HealthRecord,
    followUps: FollowUpRecord[],
    resources: ContentItem[]
): Promise<{ reply: string, recommendedItemIds?: string[], focusMetric?: string }> => {
    
    const abnormalities = record.checkup.abnormalities || [];
    const latestFollowUp = followUps.length > 0 ? followUps[followUps.length - 1] : null;
    
    const systemInstruction = `
    你是一名来自“郑州大学医院健康管理中心”的资深AI健康管家。你的职责是基于受检者的电子健康档案（EHR）提供深度的健康咨询、指标解释及服务推荐。

    【受检者核心档案】
    - 姓名：${record.profile.name}
    - 异常指标：${abnormalities.map(a => `${a.item}(结果:${a.result})`).join('; ')}
    - 最近随访记录：${latestFollowUp ? `日期:${latestFollowUp.date}, 结论:${latestFollowUp.assessment.majorIssues}` : '暂无随访历史'}

    【中心服务资源库】
    当用户询问如何管理异常或寻求帮助时，请务必从以下资源库中选择最匹配的 ID：
    ${resources.map(r => `[${r.type}] ID:${r.id}, 标题:${r.title}`).join('\n')}

    【回复指南】
    1. 语气：温和、专业、有温度，称呼用户为“老师”。
    2. 策略：针对体检异常项，解释其危害并给出生活方式建议。
    3. 闭环：引导用户通过卡片预约中心的医生、购买对应药品、参加相关活动或查看饮食方案。
    4. 禁止：严禁开具具体的处方药物剂量，涉及用药建议引导用户咨询中心医师。

    【输出要求】必须返回严格的 JSON 格式：
    {
       "reply": "Markdown格式的文本回复",
       "recommendedItemIds": ["匹配的资源ID1", "匹配的资源ID2"],
       "focusMetric": "当前重点讨论的指标名称"
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
                { role: 'user', parts: [{ text: `对话历史：\n${history.map(h => `${h.role}:${h.content}`).join('\n')}\n\n当前提问：${userMessage}` }] }
            ],
            config: {
                systemInstruction,
                responseMimeType: "application/json",
            }
        });

        const resText = response.text || '{}';
        return JSON.parse(resText);
    } catch (e) {
        console.error("Gemini AI Butler Error:", e);
        return { 
            reply: "管家刚才在整理您的档案，稍微走神了。请问您想了解关于体检报告中哪方面的建议？", 
            recommendedItemIds: [] 
        };
    }
};

/**
 * 从原始文本解析健康档案数据
 */
export const parseHealthDataFromText = async (raw: string): Promise<HealthRecord> => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: raw,
        config: {
            systemInstruction: "你是一个专业的医疗数据解析专家，请将文本解析为符合系统定义的 HealthRecord JSON 结构。包含个人信息、体征、实验数据及异常项总结。",
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || '{}');
};

/**
 * 生成完整的健康风险评估报告
 */
export const generateHealthAssessment = async (rec: HealthRecord): Promise<HealthAssessment> => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: JSON.stringify(rec),
        config: {
            systemInstruction: "作为资深全科医生，根据档案生成健康评估报告JSON。必须包含风险等级(RED/YELLOW/GREEN)和详细的管理方案。",
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || '{}');
};

/**
 * 生成后续随访计划
 */
export const generateFollowUpSchedule = (ass: HealthAssessment): ScheduledFollowUp[] => {
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + (ass.riskLevel === 'RED' ? 1 : 3));
    return [{ id: Date.now().toString(), date: nextDate.toISOString().split('T')[0], status: 'pending', riskLevelAtSchedule: ass.riskLevel, focusItems: ass.followUpPlan.nextCheckItems }];
};

/**
 * [FIX] 分析随访记录并生成动态建议。修复 FollowUpDashboard 的 TS2339 错误。
 */
export const analyzeFollowUpRecord = async (
    formData: any, 
    assessment: HealthAssessment | null, 
    latestRecord: FollowUpRecord | null
): Promise<{
    riskLevel: RiskLevel,
    riskJustification: string,
    doctorMessage: string,
    majorIssues: string,
    nextCheckPlan: string,
    lifestyleGoals: string[]
}> => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
            { 
                role: 'user', 
                parts: [{ 
                    text: `本次随访录入: ${JSON.stringify(formData)}\n上次评估基线: ${JSON.stringify(assessment)}\n历史最后记录: ${JSON.stringify(latestRecord)}` 
                }] 
            }
        ],
        config: {
            systemInstruction: "你是一个随访干预专家。请对比本次随访指标与历史数据，判定风险等级是否需要调整，并给出主要问题总结和下一步复查计划。必须返回 JSON 格式。",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    riskLevel: { type: Type.STRING, description: "Must be one of: RED, YELLOW, GREEN" },
                    riskJustification: { type: Type.STRING },
                    doctorMessage: { type: Type.STRING },
                    majorIssues: { type: Type.STRING },
                    nextCheckPlan: { type: Type.STRING },
                    lifestyleGoals: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["riskLevel", "riskJustification", "doctorMessage", "majorIssues", "nextCheckPlan", "lifestyleGoals"]
            }
        }
    });
    return JSON.parse(response.text || '{}');
};

/**
 * [FIX] 生成每日综合管理方案。修复 UserDietMotion 的 TS2339 错误。
 */
export const generateDailyIntegratedPlan = async (
    profileStr: string, 
    context: string, 
    targetTdee: number
): Promise<{
    diet: { breakfast: string, lunch: string, dinner: string, snack: string },
    exercise: { morning: string, afternoon: string, evening: string },
    tips: string,
    recommendedMealIds: string[],
    recommendedExerciseIds: string[]
}> => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
            { 
                role: 'user', 
                parts: [{ 
                    text: `受检者概况: ${profileStr}\n目标能量: ${targetTdee} kcal\n可用资源库: ${context}` 
                }] 
            }
        ],
        config: {
            systemInstruction: "你是一个智慧健康管理专家。请根据受检者风险和热量目标，从资源库中匹配 ID 并生成今日饮食与运动方案。必须返回 JSON 格式。",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    diet: {
                        type: Type.OBJECT,
                        properties: {
                            breakfast: { type: Type.STRING },
                            lunch: { type: Type.STRING },
                            dinner: { type: Type.STRING },
                            snack: { type: Type.STRING }
                        },
                        required: ["breakfast", "lunch", "dinner", "snack"]
                    },
                    exercise: {
                        type: Type.OBJECT,
                        properties: {
                            morning: { type: Type.STRING },
                            afternoon: { type: Type.STRING },
                            evening: { type: Type.STRING }
                        },
                        required: ["morning", "afternoon", "evening"]
                    },
                    tips: { type: Type.STRING },
                    recommendedMealIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    recommendedExerciseIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["diet", "exercise", "tips", "recommendedMealIds", "recommendedExerciseIds"]
            }
        }
    });
    return JSON.parse(response.text || '{}');
};

/**
 * 膳食营养评估咨询
 */
export const generateDietAssessment = async (msg: string) => { 
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: msg,
        config: { systemInstruction: "你是一个专业的营养师，请为受检者提供膳食建议。" }
    });
    return { reply: response.text || "管家正在学习该食物的营养知识..." };
};

/**
 * 生成运动计划
 */
export const generateExercisePlan = async (input: string) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: input,
        config: {
            systemInstruction: "生成一份针对受检者身体状况的周运动计划 JSON。",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    plan: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                day: { type: Type.STRING },
                                content: { type: Type.STRING }
                            },
                            required: ["day", "content"]
                        }
                    }
                },
                required: ["plan"]
            }
        }
    });
    return JSON.parse(response.text || '{ "plan": [] }');
};

/**
 * 生成随访短信内容
 */
export const generateFollowUpSMS = async (name: string) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `受检者: ${name}`,
        config: { systemInstruction: "撰写一条专业且贴心的随访提醒短信。" }
    });
    return { smsContent: response.text || "" };
};

/**
 * 医院业务潜力分析
 */
export const generateHospitalBusinessAnalysis = async (issueSummary: any) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: JSON.stringify(issueSummary),
        config: {
            systemInstruction: "作为医院经营专家，根据汇总的健康异常项分析潜在的医疗服务需求。返回 DepartmentAnalytics 数组 JSON。",
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || "[]");
};

/**
 * 计算配料营养成分
 */
export const calculateNutritionFromIngredients = async (ingredients: any) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: JSON.stringify(ingredients),
        config: {
            systemInstruction: "精准计算食材列表的卡路里和微量元素。返回 nutritionData JSON，key 为食物名称。",
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || '{ "nutritionData": {} }');
};

/**
 * 生成个性化生活打卡习惯
 */
export const generatePersonalizedHabits = async (a: HealthAssessment, r: HealthRecord) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `评估: ${JSON.stringify(a)}\n档案: ${JSON.stringify(r)}`,
        config: {
            systemInstruction: "基于评估结果生成个性化的打卡习惯建议列表。返回 HabitRecord 数组 JSON。",
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || '{ "habits": [] }');
};
