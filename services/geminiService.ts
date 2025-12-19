
import { HealthRecord, HealthAssessment, ScheduledFollowUp, FollowUpRecord, DepartmentAnalytics } from "../types";
import { HabitRecord } from "./dataService";
import { ContentItem } from "./contentService";

/**
 * DeepSeek API 核心调用函数
 * 逻辑：通过 Vite 代理访问 /api/deepseek，使用 OpenAI 兼容格式
 */
const DEEPSEEK_ENDPOINT = '/api/deepseek/chat/completions';
// 优先从环境变量获取 Key
const API_KEY = process.env.API_KEY || ''; 

async function requestAI(messages: any[], jsonMode = true) {
    try {
        const response = await fetch(DEEPSEEK_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: messages,
                // DeepSeek 支持 json_object 模式
                response_format: jsonMode ? { type: "json_object" } : { type: "text" },
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'AI 接口请求失败');
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        return jsonMode ? JSON.parse(content) : content;
    } catch (error) {
        console.error("AI Service Error:", error);
        throw error;
    }
}

// 1. 健康副驾驶对话
export const chatWithHealthAssistant = async (
    userMessage: string,
    history: {role: 'user' | 'assistant', content: string}[],
    context: {
        record: HealthRecord,
        followUps: FollowUpRecord[],
        availableResources: ContentItem[]
    }
) => {
    const { record, availableResources } = context;
    const resources = availableResources.map(r => ({ id: r.id, title: r.title, type: r.type, tags: r.tags })).slice(0, 20);

    const systemPrompt = `你是一个专业的医院健康管理助手。
    用户信息：姓名 ${record.profile.name}，主要异常：${record.checkup.abnormalities.map(a => a.item).join(', ')}。
    任务：回答健康咨询并从以下资源库推荐 1-3 个资源：${JSON.stringify(resources)}。
    必须返回 JSON 格式：{"reply": "Markdown内容", "recommendedResourceIds": ["ID"]}`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userMessage }
    ];

    try {
        return await requestAI(messages);
    } catch (e) {
        return { reply: "系统繁忙，请稍后再咨询医生。", recommendedResourceIds: [] };
    }
};

// 2. 解析体检报告文本
export const parseHealthDataFromText = async (raw: string): Promise<HealthRecord> => {
    const messages = [
        { role: "system", content: "你是一个医学数据解析专家。请将零散的体检文本提取为符合 HealthRecord 结构的 JSON。注意提取姓名、年龄、性别及各项检查数值和结论。" },
        { role: "user", content: raw }
    ];
    return await requestAI(messages);
};

// 3. 生成深度健康评估
export const generateHealthAssessment = async (rec: HealthRecord): Promise<HealthAssessment> => {
    const messages = [
        { role: "system", content: "根据体检档案生成评估，必须包含风险等级(RED/YELLOW/GREEN)、综合综述、饮食/运动建议。若有危急值需特别标记并给出 criticalWarning。返回 HealthAssessment JSON。" },
        { role: "user", content: JSON.stringify(rec) }
    ];
    return await requestAI(messages);
};

// 4. 自动生成随访计划
export const generateFollowUpSchedule = (ass: HealthAssessment): ScheduledFollowUp[] => {
    const interval = ass.riskLevel === 'RED' ? 1 : ass.riskLevel === 'YELLOW' ? 3 : 6;
    const date = new Date();
    date.setMonth(date.getMonth() + interval);
    return [{
        id: Date.now().toString(),
        date: date.toISOString().split('T')[0],
        status: 'pending',
        riskLevelAtSchedule: ass.riskLevel as any,
        focusItems: ass.followUpPlan.nextCheckItems
    }];
};

// 5. 随访结果自动分析
export const analyzeFollowUpRecord = async (form: any, ass: any, last: any) => {
    const messages = [
        { role: "system", content: "对比本次随访与历史数据，评估健康改善趋势。返回 JSON。" },
        { role: "user", content: JSON.stringify({ current: form, baseline: ass, last }) }
    ];
    return await requestAI(messages);
};

// 6. 生成随访短信
export const generateFollowUpSMS = async (name: string) => {
    const messages = [{ role: "user", content: `为患者 ${name} 写一条体贴的随访提醒。返回JSON: {"smsContent": "..."}` }];
    return await requestAI(messages);
};

// 7. 全院业务热力图分析
export const generateHospitalBusinessAnalysis = async (issues: { [key: string]: number }): Promise<DepartmentAnalytics[]> => {
    const messages = [
        { role: "system", content: "分析医院各科室的业务增长点。返回 DepartmentAnalytics[] 结构的 JSON。" },
        { role: "user", content: JSON.stringify(issues) }
    ];
    return await requestAI(messages);
};

// 8. 营养计算
export const calculateNutritionFromIngredients = async (items: {name: string, ingredients: string}[]): Promise<{nutritionData: any}> => {
    const messages = [
        { role: "system", content: "计算食材的营养成分（热量、蛋白质、脂肪、碳水）。返回 JSON。" },
        { role: "user", content: JSON.stringify(items) }
    ];
    return await requestAI(messages);
};

// 9. 生成个性化习惯
export const generatePersonalizedHabits = async (assessment: HealthAssessment, record: HealthRecord): Promise<{ habits: HabitRecord[] }> => {
    const messages = [
        { role: "system", content: "制定 3-5 个具体的每日健康习惯。返回 JSON。" },
        { role: "user", content: JSON.stringify({ assessment, record }) }
    ];
    return await requestAI(messages);
};

// 10. 每日健康方案定制
export const generateDailyIntegratedPlan = async (userProfileStr: string, resourcesContext?: string, targetCalories?: number): Promise<any> => {
    const messages = [
        { role: "system", content: `作为健康教练，定制一天方案。目标热量: ${targetCalories}。返回 JSON。` },
        { role: "user", content: `信息: ${userProfileStr} \n资源: ${resourcesContext}` }
    ];
    return await requestAI(messages);
};

// 11. 简易饮食/运动评估
export const generateDietAssessment = async (i: string) => {
    return await requestAI([{ role: "user", content: `评估此饮食：${i}。返回JSON: {"reply": "..."}` }]);
};

export const generateExercisePlan = async (i: string) => {
    return await requestAI([{ role: "user", content: `制定7天计划：${i}。返回JSON: {"plan": [...]}` }]);
};
