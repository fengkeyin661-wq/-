
import { HealthRecord, HealthAssessment, RiskLevel, ScheduledFollowUp, FollowUpRecord, DepartmentAnalytics } from "../types";

// DeepSeek API Configuration
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

// Helper to safely access environment variables in different environments (Vite, Webpack, etc.)
const getEnvVar = (key: string): string => {
  // 1. Try process.env (Standard Node/Webpack)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {}

  // 2. Try Vite's import.meta.env with safe checks
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // Explicitly check known keys to support bundler string replacement (Vite)
      if (key === 'VITE_DEEPSEEK_API_KEY') {
          // @ts-ignore
          return import.meta.env.VITE_DEEPSEEK_API_KEY || '';
      }
      
      // Fallback for other keys
      // @ts-ignore
      return import.meta.env[key] || '';
    }
  } catch (e) {}

  return '';
};

const getApiKey = () => {
    return getEnvVar('VITE_DEEPSEEK_API_KEY');
}

// Data Sanitizers (Defensive Programming to prevent White Screen)
const sanitizeHealthRecord = (data: any): HealthRecord => {
    // Helper to ensure object exists
    const ensureObj = (obj: any) => obj || {};
    const ensureArr = (arr: any) => Array.isArray(arr) ? arr : [];

    // Construct with defaults deep merged to ensure no undefined nested objects
    return {
        profile: {
            checkupId: data?.profile?.checkupId || '',
            name: data?.profile?.name || '未命名',
            dob: data?.profile?.dob,
            gender: data?.profile?.gender || '男',
            department: data?.profile?.department || '',
            phone: data?.profile?.phone,
            checkupDate: data?.profile?.checkupDate,
            age: typeof data?.profile?.age === 'number' ? data.profile.age : 0
        },
        checkup: {
            basics: ensureObj(data?.checkup?.basics),
            labBasic: {
                liver: ensureObj(data?.checkup?.labBasic?.liver),
                lipids: ensureObj(data?.checkup?.labBasic?.lipids),
                renal: ensureObj(data?.checkup?.labBasic?.renal),
                bloodRoutine: ensureObj(data?.checkup?.labBasic?.bloodRoutine),
                glucose: ensureObj(data?.checkup?.labBasic?.glucose),
                urineRoutine: ensureObj(data?.checkup?.labBasic?.urineRoutine),
                thyroidFunction: ensureObj(data?.checkup?.labBasic?.thyroidFunction),
                ck: data?.checkup?.labBasic?.ck
            },
            imagingBasic: {
                ecg: data?.checkup?.imagingBasic?.ecg,
                ultrasound: ensureObj(data?.checkup?.imagingBasic?.ultrasound)
            },
            optional: ensureObj(data?.checkup?.optional),
            abnormalities: ensureArr(data?.checkup?.abnormalities)
        },
        questionnaire: {
            history: {
                diseases: ensureArr(data?.questionnaire?.history?.diseases),
                details: ensureObj(data?.questionnaire?.history?.details),
                surgeries: data?.questionnaire?.history?.surgeries
            },
            femaleHealth: ensureObj(data?.questionnaire?.femaleHealth),
            familyHistory: ensureObj(data?.questionnaire?.familyHistory),
            medication: {
                isRegular: data?.questionnaire?.medication?.isRegular || '否',
                list: data?.questionnaire?.medication?.list,
                details: ensureObj(data?.questionnaire?.medication?.details)
            },
            diet: {
                habits: ensureArr(data?.questionnaire?.diet?.habits),
                ...ensureObj(data?.questionnaire?.diet)
            },
            hydration: ensureObj(data?.questionnaire?.hydration),
            exercise: ensureObj(data?.questionnaire?.exercise),
            sleep: ensureObj(data?.questionnaire?.sleep),
            respiratory: ensureObj(data?.questionnaire?.respiratory),
            substances: {
                smoking: { passive: [], ...ensureObj(data?.questionnaire?.substances?.smoking) },
                alcohol: { types: [], ...ensureObj(data?.questionnaire?.substances?.alcohol) }
            },
            mentalScales: ensureObj(data?.questionnaire?.mentalScales),
            mental: {
                stressSource: ensureArr(data?.questionnaire?.mental?.stressSource),
                reliefMethod: ensureArr(data?.questionnaire?.mental?.reliefMethod),
                ...ensureObj(data?.questionnaire?.mental)
            },
            needs: {
                concerns: ensureArr(data?.questionnaire?.needs?.concerns),
                desiredSupport: ensureArr(data?.questionnaire?.needs?.desiredSupport),
                ...ensureObj(data?.questionnaire?.needs)
            }
        },
        riskModelExtras: ensureObj(data?.riskModelExtras)
    };
};

const sanitizeAssessment = (data: any): HealthAssessment => {
    const ensureArr = (arr: any) => Array.isArray(arr) ? arr : [];
    // const ensureObj = (obj: any) => obj || {};

    return {
        riskLevel: data?.riskLevel || RiskLevel.GREEN,
        summary: data?.summary || '暂无评估总结',
        isCritical: !!data?.isCritical,
        criticalWarning: data?.criticalWarning,
        risks: {
            red: ensureArr(data?.risks?.red),
            yellow: ensureArr(data?.risks?.yellow),
            green: ensureArr(data?.risks?.green)
        },
        managementPlan: {
            dietary: ensureArr(data?.managementPlan?.dietary),
            exercise: ensureArr(data?.managementPlan?.exercise),
            medication: ensureArr(data?.managementPlan?.medication),
            monitoring: ensureArr(data?.managementPlan?.monitoring)
        },
        structuredTasks: ensureArr(data?.structuredTasks),
        followUpPlan: {
            frequency: data?.followUpPlan?.frequency || '定期',
            nextCheckItems: ensureArr(data?.followUpPlan?.nextCheckItems)
        }
    };
};

// 通用 DeepSeek 调用函数
const callDeepSeek = async (systemPrompt: string, userContent: string, jsonMode: boolean = true) => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key 未配置。请检查 Vercel 环境变量 VITE_DEEPSEEK_API_KEY。");

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat", 
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent }
                ],
                // 启用 JSON 模式以保证输出格式稳定
                response_format: jsonMode ? { type: "json_object" } : undefined,
                temperature: 0.1, 
                stream: false
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`DeepSeek API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // 清洗 Markdown 代码块标记 (```json ... ```)
        const cleanJson = content.replace(/```json\n?|```/g, '').trim();
        
        return jsonMode ? JSON.parse(cleanJson) : cleanJson;
    } catch (error) {
        console.error("DeepSeek Call Failed:", error);
        throw error; // 向上传递错误以便 UI 提示
    }
};

/**
 * 1. 智能解析: 从文本中提取结构化健康档案
 */
export const parseHealthDataFromText = async (rawText: string): Promise<HealthRecord> => {
  const systemPrompt = `
    你是一个医疗数据结构化专家。请从混合了【体检报告】和【59项教职工健康问卷】的文本中提取数据。
    
    【重要解析规则】
    1. 请仔细识别教职工健康问卷中新增的“家族史”、“女性健康”、“呼吸道症状”、“心理量表”部分。
    2. 数值型字段(如年龄、支数、评分)请提取为 Number 类型，若未提及则为 null。
    3. Boolean 类型字段(如是否服用降压药)，"是"->true, "否"->false, 未提及->null。
    4. 既往病史请特别注意提取"类风湿性关节炎"，这对于骨折风险模型至关重要。
    5. 吸烟史中，如果能计算或提取到"包年数"(Pack-Years)，请务必填入。
    
    输出必须是严格的 JSON 格式。
  `;

  const rawData = await callDeepSeek(systemPrompt, `请解析以下健康档案数据:\n${rawText}`);
  return sanitizeHealthRecord(rawData);
}

/**
 * 2. 风险评估: 生成管理方案
 */
export const generateHealthAssessment = async (record: HealthRecord): Promise<HealthAssessment> => {
  const systemPrompt = `
    你是全科主任医师。基于详细的体检数据(Objective)和问卷数据(Subjective)生成风险评估。
    当前时间: ${new Date().toISOString()} (请根据最新时间评估)

    【重要】请严格依据以下“重要异常结果分层管理标准”判断危急值（A类）和重大异常（B类）。
    如果符合以下任意条件，必须将 riskLevel 设为 RED，将 isCritical 设为 true，并在 criticalWarning 中注明具体类别（如“A类危急值”或“B类重大异常”）和原因。
    ... (参考之前 Prompt 规则) ...
    返回 JSON: { riskLevel, isCritical, criticalWarning, summary, risks, managementPlan, structuredTasks, followUpPlan }
  `;

  const rawData = await callDeepSeek(systemPrompt, `数据:\n${JSON.stringify(record)}`);
  return sanitizeAssessment(rawData);
};

/**
 * 3. 随访日程生成 (本地逻辑，无需 AI)
 */
export const generateFollowUpSchedule = (assessment: HealthAssessment): ScheduledFollowUp[] => {
    const today = new Date();
    const schedule: ScheduledFollowUp[] = [];
    
    // 如果是危急值，随访频率极高 (3天后)
    let interval = assessment.isCritical ? 0.1 : (assessment.riskLevel === RiskLevel.RED ? 1 : assessment.riskLevel === RiskLevel.YELLOW ? 3 : 6);

    for (let i = 1; i <= 2; i++) {
        const d = new Date(today);
        // interval 0.1 means ~3 days
        if (interval < 1) {
            d.setDate(today.getDate() + 3 * i);
        } else {
            d.setMonth(today.getMonth() + (interval * i));
        }
        
        schedule.push({
            id: `sch_${Date.now()}_${i}`,
            date: d.toISOString().split('T')[0],
            status: 'pending',
            riskLevelAtSchedule: assessment.riskLevel,
            focusItems: assessment.isCritical ? ['🚨 复查危急指标', ...assessment.followUpPlan.nextCheckItems] : assessment.followUpPlan.nextCheckItems
        });
    }
    return schedule;
};

/**
 * 4. 随访记录分析 (中文)
 */
export const analyzeFollowUpRecord = async (
    formData: Partial<FollowUpRecord>, 
    assessment: HealthAssessment | null,
    latestRecord: FollowUpRecord | null
  ): Promise<{
      riskLevel: RiskLevel;
      riskJustification: string;
      majorIssues: string;
      nextCheckPlan: string;
      lifestyleGoals: string[];
      doctorMessage: string;
  }> => {
      const systemPrompt = `
      你是一名健康管理专家。请根据患者的本次随访记录、基线评估和上次记录，分析其健康状况。
      请务必使用中文输出。
      
      重点关注:
      1. 核心指标(血压/血糖)是否达标。
      2. 医疗复查执行情况(medicalCompliance): 如果患者未执行建议的复查(not_checked)或结果异常(checked_abnormal)，请在风险理由和主要问题中重点警告。
      
      输出 JSON: { riskLevel, riskJustification, doctorMessage, majorIssues, nextCheckPlan, lifestyleGoals }
      `;
      
      const userContent = `
      本次随访录入: ${JSON.stringify(formData)}
      基线评估: ${JSON.stringify(assessment)}
      上次记录: ${JSON.stringify(latestRecord)}
      `;
      
      return await callDeepSeek(systemPrompt, userContent);
  };

/**
 * 5. 生成随访提醒短信
 */
export const generateFollowUpSMS = async (
    patientName: string,
    doctorName: string = "邱医生",
    hospitalName: string = "郑州大学医院"
): Promise<{ smsContent: string }> => {
    const systemPrompt = `
    你是一名医院健康管理中心的助手。请生成一条发给患者的提醒短信。
    场景：患者已到随访时间，但无法通过电话联系上，或者需要延期随访。
    要求：
    1. 语气专业、亲切、负责任。
    2. 提醒患者健康随访的重要性。
    3. 告知由于暂时未联系上，系统已自动将随访延期1个月，并请患者看到短信后方便时回电。
    4. 包含医院名称和医生姓名。
    5. 字数控制在100字以内。
    
    输出 JSON: { "smsContent": "短信内容" }
    `;

    const userContent = `患者姓名: ${patientName}, 医生: ${doctorName}, 医院: ${hospitalName}`;
    
    return await callDeepSeek(systemPrompt, userContent, true);
};

/**
 * 6. 生成全院医疗服务热力图分析
 */
export const generateHospitalBusinessAnalysis = async (
    aggregatedIssues: { [key: string]: number }
): Promise<DepartmentAnalytics[]> => {
    const systemPrompt = `
    你是一名医院运营管理专家。我将提供全院体检人员的异常检出项统计汇总（Issue: Count）。
    请分析这些数据，将其映射到医院的具体临床科室，并为每个科室建议“待开展的诊疗业务”（Specific Medical Services），以帮助医院提高临床业务转化率。
    ...
    输出格式为 JSON 数组: [{ departmentName, patientCount, riskLevel, keyConditions, suggestedServices }]
    `;

    const userContent = `全院异常项统计汇总: ${JSON.stringify(aggregatedIssues)}`;

    const result = await callDeepSeek(systemPrompt, userContent, true);
    return result.departments || result; 
};

/**
 * 7. 生成年度随访总结报告
 */
export const generateAnnualReportSummary = async (
    baseline: FollowUpRecord,
    current: FollowUpRecord
): Promise<{ summary: string }> => {
    const systemPrompt = `
    你是一名资深健康管理医生。请对比患者一年前的基线数据（Baseline）和当前的最新随访数据（Current），生成一份简短的年度健康改善评估总结。
    ...
    输出 JSON: { "summary": "你的总结内容..." }
    `;

    const userContent = `
    基线数据 (${baseline.date}):
    - 风险等级: ${baseline.assessment.riskLevel}
    - 血压: ${baseline.indicators.sbp}/${baseline.indicators.dbp}
    - 血糖: ${baseline.indicators.glucose}
    - 体重: ${baseline.indicators.weight}
    
    当前数据 (${current.date}):
    - 风险等级: ${current.assessment.riskLevel}
    - 血压: ${current.indicators.sbp}/${current.indicators.dbp}
    - 血糖: ${current.indicators.glucose}
    - 体重: ${current.indicators.weight}
    `;

    return await callDeepSeek(systemPrompt, userContent, true);
};
