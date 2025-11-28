
import { HealthSurveyData, HealthAssessment, FollowUpRecord, RiskLevel, ScheduledFollowUp, HealthPlanTask } from "../types";

// 使用 DeepSeek API (国内直连)
// 优先从 window.process.env 读取 (index.html 配置)，其次尝试 process.env (本地开发)
const getApiKey = () => {
  // @ts-ignore
  if (typeof window !== 'undefined' && window.process && window.process.env && window.process.env.DEEPSEEK_API_KEY) {
    // @ts-ignore
    return window.process.env.DEEPSEEK_API_KEY;
  }
  return process.env.DEEPSEEK_API_KEY;
};

const API_KEY = getApiKey();
const API_URL = "https://api.deepseek.com/chat/completions";

/**
 * 通用 DeepSeek API 调用函数
 * 强制使用 json_object 模式以保证输出结构化数据
 */
async function callDeepSeek<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  const currentKey = getApiKey();
  
  if (!currentKey) {
    console.error("DEEPSEEK_API_KEY 未配置");
    throw new Error("系统未配置 DeepSeek API Key。请在 index.html 文件中配置您的 Key，或联系管理员。");
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat", // 使用 DeepSeek V3
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }, // 强制 JSON 输出
        temperature: 0.1, // 低温度以保证格式稳定
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API 请求失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("DeepSeek 未返回有效内容");
    }

    // 清理可能存在的 Markdown 代码块标记
    const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(cleanContent) as T;

  } catch (error) {
    console.error("AI 服务调用失败:", error);
    throw error;
  }
}

// 备用：非强制 JSON 模式
async function safeGenerateJSON<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    try {
        return await callDeepSeek<T>(systemPrompt, userPrompt);
    } catch (e) {
        console.warn("标准 JSON 模式失败，尝试宽松模式...");
        throw e;
    }
}

// --- 业务功能实现 ---

export const parseHealthDataFromText = async (rawText: string): Promise<HealthSurveyData> => {
  const systemPrompt = `
    你是一个专业的医疗数据助手。
    请从用户提供的非结构化文本（包括复杂的医院体检报告、OCR识别文本、病史问卷）中提取关键信息，并严格按照下方的 JSON 格式输出。
    
    【特别注意】
    1. 报告中可能包含大量无关格式字符，请智能过滤。
    2. 重点提取“检查综述”、“医生建议”以及各项检查中标记为“↑”(偏高)、“↓”(偏低)、“阳性”或“异常”的项目。
    3. 将所有具体的异常发现（如 "CA-199 46.00", "甲状腺囊性结节"）提取到 'checkupAbnormalities' 数组中。

    必须输出的 JSON 结构:
    {
      "name": "姓名",
      "checkupId": "体检编号",
      "gender": "性别 (男/女)",
      "age": 数字,
      "department": "部门",
      "medicalHistory": ["既往病史1", "既往病史2"],
      "abnormalities": "体检异常发现的总体文本摘要 (一段话概括)",
      "checkupAbnormalities": [
         {
           "item": "异常项目名称 (如: CA-199)",
           "result": "具体数值或描述 (如: 46.00 U/mL 偏高)",
           "suggestion": "对应的医生建议 (如: 建议肿瘤内科进一步检查)"
         }
      ],
      "medications": "当前用药情况",
      "surgeries": "手术史",
      "diet": ["饮食习惯标签"],
      "exerciseFrequency": "运动频率描述",
      "smokingStatus": "吸烟状态",
      "drinkingStatus": "饮酒状态",
      "sleepHours": 数字,
      "stressLevel": "压力程度",
      "mainConcerns": ["主要健康诉求"]
    }
  `;

  return safeGenerateJSON<HealthSurveyData>(systemPrompt, `请解析以下原始体检文本:\n${rawText}`);
}

export const generateHealthAssessment = async (surveyData: HealthSurveyData): Promise<HealthAssessment> => {
  const systemPrompt = `
    你是中国高校职工健康管理中心的全科主任医师。
    请根据患者的健康档案数据（特别是 checkupAbnormalities 中的具体异常指标），生成一份专业的健康风险评估报告。

    【评估标准】
    1. 红灯 (高危): 肿瘤标志物升高(如CA-199)、心脑血管高危(斑块+高血压)、重要器官功能异常。
    2. 黄灯 (中危): 代谢异常(血脂/血糖)、结节(甲状腺/肺)、骨量减少。
    3. 绿灯 (低危): 仅有轻微生活方式问题。

    【输出要求】
    请直接返回 JSON 数据。
    
    必须输出的 JSON 结构:
    {
       "riskLevel": "GREEN" | "YELLOW" | "RED",
       "summary": "简明扼要的医生综述 (约150字)，请具体提及异常指标及其意义",
       "risks": {
          "red": ["高危风险因素列表"],
          "yellow": ["中危风险因素列表"],
          "green": ["良性或正常指标列表"]
       },
       "managementPlan": {
          "dietary": ["具体的饮食建议列表"],
          "exercise": ["具体的运动处方"],
          "medication": ["用药调整或依从性建议"],
          "monitoring": ["需要自我监测的指标"]
       },
       "structuredTasks": [
          {
             "id": "gen_1",
             "category": "diet" | "exercise" | "medication" | "monitoring",
             "description": "具体的执行动作 (如: 每天快走30分钟)",
             "targetValue": "目标值 (可选, 如 <130/80)",
             "frequency": "频率 (如: 每天)",
             "isKeyGoal": boolean (是否为重点)
          }
       ],
       "followUpPlan": {
          "frequency": "建议随访频率 (如：每3个月)",
          "nextCheckItems": ["下次随访重点检查项目"]
       }
    }
  `;

  return safeGenerateJSON<HealthAssessment>(systemPrompt, `患者数据:\n${JSON.stringify(surveyData)}`);
};

export const generateFollowUpSchedule = (assessment: HealthAssessment): ScheduledFollowUp[] => {
    const today = new Date();
    const schedule: ScheduledFollowUp[] = [];
    
    let intervalMonths = 3; // Default Yellow
    if (assessment.riskLevel === RiskLevel.RED) intervalMonths = 1;
    if (assessment.riskLevel === RiskLevel.GREEN) intervalMonths = 6;

    // Generate next 2 scheduled visits
    for (let i = 1; i <= 2; i++) {
        const visitDate = new Date(today);
        visitDate.setMonth(today.getMonth() + (intervalMonths * i));
        
        schedule.push({
            id: `sched_${Date.now()}_${i}`,
            date: visitDate.toISOString().split('T')[0],
            status: 'pending',
            riskLevelAtSchedule: assessment.riskLevel,
            focusItems: assessment.followUpPlan.nextCheckItems
        });
    }
    return schedule;
};

export const analyzeFollowUpRecord = async (record: Partial<FollowUpRecord>, previousAssessment: HealthAssessment | null, previousRecord: FollowUpRecord | null): Promise<any> => {
  const systemPrompt = `
    你是一位负责随访的健康管理医生。请对患者的最新随访记录进行个性化分析。
    
    【核心任务】
    对比本次数据与之前的健康计划/上次记录，评估干预效果。
    必须明确指出指标是“改善”、“持平”还是“恶化”。

    【输出要求】
    返回 JSON 数据:
    {
      "riskLevel": "GREEN" | "YELLOW" | "RED",
      "riskJustification": "详细的医生评语。请包含：1. 核心指标变化(如血压从140降至130) 2. 方案执行度点评 3. 下阶段重点调整。",
      "majorIssues": "本次发现的主要问题",
      "nextCheckPlan": "下一步具体的复查或诊疗计划",
      "lifestyleGoals": ["1-2个新的阶段性生活方式目标"],
      "improvementStatus": "改善" | "无变化" | "恶化",
      "alertFlag": boolean (是否需要立即就医)
    }
  `;

  const userPrompt = `
    【历史评估目标】: ${JSON.stringify(previousAssessment?.managementPlan || {})}
    【上次记录指标】: ${JSON.stringify(previousRecord?.indicators || '无')}
    【本次随访记录】: ${JSON.stringify(record)}
  `;

  return safeGenerateJSON<any>(systemPrompt, userPrompt);
}
