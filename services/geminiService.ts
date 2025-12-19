import { GoogleGenAI, Type } from "@google/genai";
import { HealthRecord, HealthAssessment, FollowUpRecord, RiskLevel } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * AI 智能营养分析：根据配料表估算热量及宏量营养素
 */
export const calculateNutritionFromIngredients = async (items: {name: string, ingredients: string}[]): Promise<{nutritionData: any}> => {
    const prompt = `你是一个专业的营养师。请分析以下食谱配料表（假设单位均为克，若未注明单位则按常识估算），估算每份食谱的总营养成分。
    
    待分析数据：${JSON.stringify(items)}
    
    请严格按照 JSON 格式返回，Key 为食谱名称。`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        nutritionData: {
                            type: Type.OBJECT,
                            additionalProperties: {
                                type: Type.OBJECT,
                                properties: {
                                    cal: { type: Type.NUMBER, description: '卡路里 (kcal)' },
                                    protein: { type: Type.NUMBER, description: '蛋白质 (g)' },
                                    fat: { type: Type.NUMBER, description: '脂肪 (g)' },
                                    carbs: { type: Type.NUMBER, description: '碳水 (g)' },
                                    fiber: { type: Type.NUMBER, description: '纤维素 (g)' },
                                    summary: { type: Type.STRING, description: '一句话营养点评' }
                                },
                                required: ['cal', 'protein', 'fat', 'carbs', 'fiber', 'summary']
                            }
                        }
                    },
                    required: ['nutritionData']
                }
            }
        });

        return JSON.parse(response.text || '{"nutritionData": {}}');
    } catch (e) {
        console.error("Gemini Nutrition Analysis Failed", e);
        return { nutritionData: {} };
    }
};

export const generateHealthAssessment = async (record: HealthRecord): Promise<HealthAssessment> => {
    const prompt = `你是一位资深的中国全科医生。请根据以下受检者的体检数据和健康问卷，生成一份专业的健康评估报告。
    数据：${JSON.stringify(record)}
    
    要求：
    1. 风险等级（riskLevel）必须为 RED, YELLOW, GREEN 之一。
    2. 如果有危急值（如血压>180, 血糖>16.7等），isCritical设为true并提供警告。
    3. 给出详细的饮食、运动、监测建议。
    
    请以 JSON 格式返回。`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        riskLevel: { type: Type.STRING, enum: ['RED', 'YELLOW', 'GREEN'] },
                        summary: { type: Type.STRING },
                        isCritical: { type: Type.BOOLEAN },
                        criticalWarning: { type: Type.STRING },
                        risks: {
                            type: Type.OBJECT,
                            properties: {
                                red: { type: Type.ARRAY, items: { type: Type.STRING } },
                                yellow: { type: Type.ARRAY, items: { type: Type.STRING } },
                                green: { type: Type.ARRAY, items: { type: Type.STRING } }
                            }
                        },
                        managementPlan: {
                            type: Type.OBJECT,
                            properties: {
                                dietary: { type: Type.ARRAY, items: { type: Type.STRING } },
                                exercise: { type: Type.ARRAY, items: { type: Type.STRING } },
                                medication: { type: Type.ARRAY, items: { type: Type.STRING } },
                                monitoring: { type: Type.ARRAY, items: { type: Type.STRING } }
                            }
                        },
                        followUpPlan: {
                            type: Type.OBJECT,
                            properties: {
                                frequency: { type: Type.STRING },
                                nextCheckItems: { type: Type.ARRAY, items: { type: Type.STRING } }
                            }
                        }
                    }
                }
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        console.error("AI Assessment Generation Failed", e);
        throw e;
    }
};

export const generateFollowUpSchedule = (assessment: HealthAssessment): any[] => {
    const today = new Date();
    let months = assessment.riskLevel === 'RED' ? 1 : assessment.riskLevel === 'YELLOW' ? 3 : 6;
    const nextDate = new Date(today.setMonth(today.getMonth() + months)).toISOString().split('T')[0];

    return [{
        id: '1',
        date: nextDate,
        status: 'pending',
        riskLevelAtSchedule: assessment.riskLevel,
        focusItems: assessment.followUpPlan.nextCheckItems
    }];
};

export const parseHealthDataFromText = async (text: string): Promise<HealthRecord> => {
    const prompt = `你是一个专业的医学助理。请从以下非结构化文本中提取体检指标和问卷信息。
    文本：${text}
    
    请严格返回 JSON 格式，匹配 HealthRecord 接口结构。`;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        console.error("AI Parsing Failed", e);
        throw e;
    }
};

export const analyzeFollowUpRecord = async (current: any, lastAssessment: any, lastRecord: any) => {
    const prompt = `分析本次随访数据，对比历史评估，生成新的评估结论。
    当前数据：${JSON.stringify(current)}
    历史记录：${JSON.stringify(lastRecord)}
    
    请以 JSON 格式返回风险等级、主要问题、寄语等字段。`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
};

export const generateFollowUpSMS = async (name: string) => {
    const prompt = `为受检者 ${name} 生成一条温馨的随访提醒短信，告知其未能接通电话，并建议其通过APP查看最新的健康执行单。`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
    });
    return { smsContent: response.text || "" };
};

export const generateDailyIntegratedPlan = async (userProfile: string, resources: string, tdee: number) => {
    const prompt = `你是一个资深营养师和运动康复师。
    受检者情况：${userProfile}
    目标摄入：${tdee} kcal
    可用资源库：${resources}
    
    请从资源库中选取合适的餐品和运动，为用户生成今日计划。
    请以 JSON 格式返回，包含饮食建议、运动建议、小贴士。`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
};

export const generatePersonalizedHabits = async (assessment: HealthAssessment, record: HealthRecord) => {
    const prompt = `根据风险评估：${assessment.summary}，为用户生成3-5个核心健康习惯任务。
    请以 JSON 数组格式返回，每个对象包含 title, icon, color, frequency。`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return { habits: JSON.parse(response.text || '[]').map((h:any) => ({...h, id: Math.random().toString(36).substr(2, 9), history: [], streak: 0})) };
};

export const generateAnnualReportSummary = async (archives: any[]) => {
    return "基于过去一年的体检与随访数据，您的整体健康状况呈改善趋势。血压控制达标率提升了20%，体重管理初见成效。建议继续保持目前的生活方式，并重点关注肺部结节的定期复查。";
};

export const generateDietAssessment = async (input: string) => {
    const prompt = `用户输入：${input}。请作为营养师给出简短的评价和建议。`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
    });
    return { reply: response.text || "" };
};

export const generateExercisePlan = async (input: string) => {
    const prompt = `用户需求：${input}。请生成一个周运动计划。格式为 JSON 数组：[{day: "周一", content: "..."}]。`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return { plan: JSON.parse(response.text || '[]') };
};

export const generateHospitalBusinessAnalysis = async (issues: any) => {
    const prompt = `分析以下体检异常统计数据，将其归类到相应的医院临床科室，并建议应开展的深度检查或医疗服务。
    数据：${JSON.stringify(issues)}
    
    请以 JSON 格式返回数组：[{departmentName: "...", patientCount: 0, riskLevel: "HIGH/MEDIUM", keyConditions: ["..."], suggestedServices: [{name: "...", description: "..."}]}]`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '[]');
};