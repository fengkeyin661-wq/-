import { HealthSurveyData, HealthAssessment, FollowUpRecord } from "../types";

// 使用 DeepSeek API (国内直连)
const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = "https://api.deepseek.com/chat/completions";

/**
 * 通用 DeepSeek API 调用函数
 * 强制使用 json_object 模式以保证输出结构化数据
 */
async function callDeepSeek<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  if (!API_KEY) {
    console.error("DEEPSEEK_API_KEY 未配置");
    // 为了防止页面崩溃，如果没有 Key，抛出更友好的错误
    throw new Error("系统未配置 DeepSeek API Key，请联系管理员。");
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
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

    // 清理可能存在的 Markdown 代码块标记（虽然 json_object 模式通常不带，但为了保险）
    const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(cleanContent) as T;

  } catch (error) {
    console.error("AI 服务调用失败:", error);
    throw error;
  }
}

// --- 业务功能实现 ---

export const parseHealthDataFromText = async (rawText: string): Promise<HealthSurveyData> => {
  const systemPrompt = `
    你是一个专业的医疗数据助手。
    请从用户提供的非结构化文本（包括病史、问卷、体检摘要）中提取关键信息，并严格按照下方的 JSON 格式输出。
    
    必须输出的 JSON 结构:
    {
      "name": "姓名",
      "checkupId": "体检编号",
      "gender": "性别 (男/女)",
      "age": 数字,
      "department": "部门",
      "medicalHistory": ["既往病史1", "既往病史2"],
      "abnormalities": "体检异常发现的详细摘要 (如 TI-RADS 分级、结节大小等)",
      "medications": "当前用药情况",
      "surgeries": "手术史",
      "diet": ["饮食习惯标签，如偏咸、偏油"],
      "exerciseFrequency": "运动频率描述",
      "smokingStatus": "吸烟状态",
      "drinkingStatus": "饮酒状态",
      "sleepHours": 数字 (睡眠时长),
      "stressLevel": "压力程度",
      "mainConcerns": ["主要健康诉求"]
    }
  `;

  return callDeepSeek<HealthSurveyData>(systemPrompt, `请解析以下原始文本:\n${rawText}`);
}

export const generateHealthAssessment = async (surveyData: HealthSurveyData): Promise<HealthAssessment> => {
  const systemPrompt = `
    你是中国高校职工健康管理中心的全科主任医师。
    请根据患者的健康档案数据，生成一份专业的健康风险评估报告。

    【评估标准】
    1. 红灯 (高危): 心脑血管事件风险、器官功能衰竭风险、恶性肿瘤风险。
    2. 黄灯 (中危): 代谢综合征（肥胖、血脂、脂肪肝）、骨质疏松风险。
    3. 绿灯 (低危): 各项指标基本正常。

    【输出要求】
    请直接返回 JSON 数据，不要包含任何 Markdown 格式。
    
    必须输出的 JSON 结构:
    {
       "riskLevel": "GREEN" | "YELLOW" | "RED",
       "summary": "简明扼要的医生综述 (约100字)",
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
       "followUpPlan": {
          "frequency": "建议随访频率 (如：每3个月)",
          "nextCheckItems": ["下次随访重点检查项目"]
       }
    }
  `;

  return callDeepSeek<HealthAssessment>(systemPrompt, `患者数据:\n${JSON.stringify(surveyData)}`);
};

export const analyzeFollowUpRecord = async (record: Partial<FollowUpRecord>, previousAssessment: HealthAssessment | null): Promise<any> => {
  const systemPrompt = `
    你是一位负责随访的健康管理医生。请对患者的最新随访记录进行个性化分析。
    
    【核心任务】
    对比本次数据与之前的健康计划，评估干预效果，并制定下一步计划。
    切勿使用通用模板，必须针对具体数据（如血压数值变化、结节大小变化）进行点评。

    【输出要求】
    请直接返回 JSON 数据。
    
    必须输出的 JSON 结构:
    {
      "riskLevel": "GREEN" | "YELLOW" | "RED",
      "riskJustification": "详细的医生评语 (叙述性文字)。请包含：1.检查结果解读(与上次对比) 2.诊断与治疗反馈 3.生活方式执行情况点评。",
      "majorIssues": "本次发现的主要问题 (简短概括)",
      "nextCheckPlan": "下一步具体的复查或诊疗计划",
      "lifestyleGoals": ["1-2个新的阶段性生活方式目标"],
      "alertFlag": boolean (是否需要立即就医)
    }
  `;

  const userPrompt = `
    【历史评估与计划】: 
    ${JSON.stringify(previousAssessment || {})}
    
    【本次随访记录】: 
    ${JSON.stringify(record)}
  `;

  return callDeepSeek<any>(systemPrompt, userPrompt);
}
