
import { GoogleGenAI, Type } from "@google/genai";
import { HealthRecord, HealthAssessment, RiskLevel } from "../types";

// [FIX] Initializing ai inside each function call or using a pattern that ensures it's ready.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseHealthDataFromText = async (raw: string): Promise<HealthRecord> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `分析以下体检数据并转化为JSON。raw_text: ${raw}`,
        config: {
            responseMimeType: "application/json",
            systemInstruction: "你是一个专业的医疗数据结构化专家。请仔细提取受检者信息、各项体检指标、异常汇总。对于异常项，请评估其临床意义。"
        }
    });
    return JSON.parse(response.text || '{}') as HealthRecord;
};

export const generateHealthAssessment = async (rec: HealthRecord): Promise<HealthAssessment> => {
    const ai = getAI();
    const prompt = `
    作为资深健康管理师，请根据以下健康档案生成一份【检后管理与干预路径】报告。
    数据：${JSON.stringify(rec)}
    
    【核心要求】：
    1. 重点针对体检发现的问题（如高血压、高血脂、肺结节、肥胖等）制定【检后干预路径】。
    2. 将干预过程分为3个阶段性的里程碑。
    
    请严格返回 JSON 格式:
    {
      "riskLevel": "GREEN" | "YELLOW" | "RED",
      "summary": "综合评估摘要(150字以内)",
      "isCritical": boolean,
      "criticalWarning": "危急值说明",
      "risks": { "red": ["高危因素1"], "yellow": ["中危因素1"], "green": ["良好指标"] },
      "interventionPath": {
         "goal": "核心干预目标（如：3个月内减重5kg，血压稳定在130/80以下）",
         "duration": "计划总时长",
         "milestones": [
            { "id": "m1", "title": "阶段一标题", "target": "阶段目标", "timeframe": "第1-2周", "tasks": ["具体任务1", "具体任务2"] }
         ]
      },
      "managementPlan": {
         "dietary": ["饮食建议"], "exercise": ["运动建议"], "medication": ["用药建议"], "monitoring": ["监测建议"]
      },
      "followUpPlan": {
         "frequency": "建议随访频率", "nextCheckItems": ["复查项目"]
      }
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                systemInstruction: "你是一个专业的全科医生和健康管理专家，擅长制定体检后的干预方案。"
            }
        });
        return JSON.parse(response.text || '{}') as HealthAssessment;
    } catch (e) {
        console.error("Assessment Gen Failed", e);
        return {
            riskLevel: RiskLevel.GREEN,
            summary: "生成失败，请手动评估。",
            risks: { red: [], yellow: [], green: [] },
            interventionPath: { goal: "待定", duration: "3个月", milestones: [] },
            managementPlan: { dietary: [], exercise: [], medication: [], monitoring: [] },
            followUpPlan: { frequency: "待定", nextCheckItems: [] }
        };
    }
};

export const generateFollowUpSchedule = (ass: HealthAssessment) => {
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + (ass.riskLevel === 'RED' ? 1 : 3));
    return [{
        id: Date.now().toString(),
        date: nextDate.toISOString().split('T')[0],
        status: 'pending',
        riskLevelAtSchedule: ass.riskLevel,
        focusItems: ass.followUpPlan.nextCheckItems
    }];
};

export const generateHospitalBusinessAnalysis = async (issues: { [key: string]: number }) => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `根据异常数据分析医院科室业务潜力：${JSON.stringify(issues)}`,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '[]') as any[];
};

// [FIX] Implemented missing AI functions for user-facing features
export const generateDietAssessment = async (query: string): Promise<{ reply: string }> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `用户询问饮食建议：${query}`,
        config: {
            systemInstruction: "你是一个专业的社区营养师。请根据用户的问题提供简明扼要、具有亲和力的饮食建议。返回JSON格式: { \"reply\": \"你的回复内容\" }",
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || '{"reply": "抱歉，我现在无法回答。"}');
};

export const generateExercisePlan = async (input: string): Promise<{ plan: { day: string, content: string }[] }> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `用户需求与身体状况：${input}`,
        config: {
            systemInstruction: "你是一个专业的运动教练。请生成一份为期7天的差异化运动计划。返回JSON格式: { \"plan\": [{ \"day\": \"周一\", \"content\": \"建议动作与时长\" }] }",
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || '{"plan": []}');
};

export const generateDailyIntegratedPlan = async (profile: string, context: string, tdee: number): Promise<any> => {
    const ai = getAI();
    const prompt = `个人健康状况: ${profile}. 可用资源列表: ${context}. 目标热量: ${tdee} kcal. 请从资源库中选取合适的饮食和运动ID。`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            systemInstruction: "你是一个智能健康管家。请返回JSON包含: diet (一段总述文本), exercise (一段总述文本), tips (小贴士), recommendedMealIds (从资源库选取的ID数组, 3个), recommendedExerciseIds (选取的运动ID数组, 1个)。",
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || '{}');
};

export const calculateNutritionFromIngredients = async (items: { name: string, ingredients: string }[]): Promise<any> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `分析以下食谱及其配料的营养价值：${JSON.stringify(items)}`,
        config: {
            systemInstruction: "你是一个食品营养分析专家。请根据食材用量计算营养成分。返回JSON格式: { \"nutritionData\": { \"食谱名\": { \"cal\": 0, \"protein\": 0, \"fat\": 0, \"carbs\": 0, \"fiber\": 0, \"nutrition\": \"分析摘要\" } } }",
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || '{}');
};

export const generatePersonalizedHabits = async (ass: HealthAssessment, rec: HealthRecord): Promise<{ habits: any[] }> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `基于评估报告制定微习惯计划。报告：${JSON.stringify(ass)}`,
        config: {
            systemInstruction: "你是一个习惯养成专家。请针对用户的健康风险点（如需控糖、减重、护眼等）生成3个具体的微习惯打卡项。返回JSON: { \"habits\": [{ \"id\": \"habit_id\", \"title\": \"习惯标题\", \"icon\": \"Emoji\", \"color\": \"teal\", \"frequency\": \"daily\", \"streak\": 0, \"history\": [] }] }",
            responseMimeType: "application/json"
        }
    });
    return JSON.parse(response.text || '{"habits": []}');
};
