
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
        console.warn("Missing VITE_DEEPSEEK_API_KEY");
        throw new Error("Missing API Key");
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
                model: "deepseek-v4-pro",
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
       - **体检编号 (checkupId)**：请务必精确抓取**6位纯数字**的编号（如：801234）。报告中通常包含10位或更长的“登记流水号”、“条码号”或“样本号”，请**绝对不要**将其作为体检编号。只提取那个6位数的。
       - **问卷选项提取**：请根据文本内容提取对应选项。
       - **Q17 家族史提取**：请识别以下特定家族史，并映射到 familyHistory 字段：
         - "父亲 - 冠心病/心肌梗死" -> fatherCvdEarly (若提及)
         - "母亲 - 冠心病/心肌梗死" -> motherCvdEarly (若提及)
         - "父亲/母亲 - 脑卒中" -> stroke: true
         - "兄弟姐妹 - 糖尿病" 或 "父母 - 糖尿病" -> diabetes: true
         - "高血压" -> hypertension: true
         - "肺癌" -> lungCancer: true
         - "结直肠癌" -> colonCancer: true
       - **Q21 主食类型 (diet.stapleType)**：请精确匹配选项："以精米白面为主" 或 "常吃粗粮杂豆根块类（≥1次/周）"。
       - **Q23 蔬菜摄入 (diet.dailyVeg)**：请精确匹配选项："每天≥300克"、"每天约150－300克" 或 "摄入较少（＜150克）"。
       - **Q24 水果摄入 (diet.dailyFruit)**：请精确匹配选项："每天≥200克"、"每天约100－200克" 或 "摄入较少（＜100克）"。
       
       - **心理量表提取 (PHQ-9/GAD-7)**：请识别量表中的每一项选择。评分标准：完全不会=0, 好几天=1, 一半以上=2, 几乎每天=3。
         - **phq9Detail**: 长度为9的数字数组，对应PHQ-9第1-9题得分。
         - **gad7Detail**: 长度为7的数字数组，对应GAD-7第1-7题得分。
         - **phq9Score/gad7Score**: 计算总分。
         - **selfHarmIdea**: PHQ-9 第9题（自伤念头）的得分。
       - **吸烟数量**：若出现“不到半包”等描述，请映射为大致支数(半包=10, 一包=20等)填入 dailyAmount，同时保留原始描述在 status 或其他字段中。
       - **满意度调查**：提取问卷末尾关于前台、医护、采血、流程、环境的满意度评价（如：非常满意、满意、一般、不满意），以及意见建议。
    
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
         "history": { "diseases": ["string"], "details": { "hypertensionYear": "string", "diabetesYear": "string" } },
         "familyHistory": { "diabetes": boolean, "hypertension": boolean, "stroke": boolean, "lungCancer": boolean, "colonCancer": boolean, "fatherCvdEarly": boolean, "motherCvdEarly": boolean },
         "medication": { "isRegular": "string", "list": "string", "details": { "antihypertensive": boolean, "hypoglycemic": boolean, "lipidLowering": boolean } },
         "diet": { 
             "habits": ["string"], "stapleType": "string", "coarseGrainFreq": "string", 
             "dailyVeg": "string", "dailyFruit": "string", "dailyMeat": "string", 
             "dailyDairy": "string", "dailyBeanNut": "string" 
         },
         "hydration": { "dailyAmount": "string" },
         "exercise": { "frequency": "string", "types": ["string"], "duration": "string" },
         "sleep": { "hours": "string", "quality": "string", "snore": "string", "snoreMonitor": "string" },
         "respiratory": { "chronicCough": boolean, "shortBreath": boolean },
         "substances": { 
             "smoking": { "status": "string", "dailyAmount": number, "years": number, "packYears": number }, 
             "alcohol": { "status": "string", "freq": "string", "amount": "string" } 
         },
         "mental": { "stressLevel": "string" },
         "mentalScales": { 
             "phq9Score": number, "gad7Score": number, "selfHarmIdea": number,
             "phq9Detail": [number], "gad7Detail": [number]
         },
         "needs": { "desiredSupport": ["string"] },
         "satisfaction": {
             "reception": "string", "medicalStaff": "string", "bloodDraw": "string", 
             "process": "string", "environment": "string", "dissatisfactionDetail": "string", "suggestion": "string"
         }
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

        // --- 2. Enforce 6-digit Checkup ID Rule ---
        // If AI extracted a long ID (likely barcode/serial), try to find a 6-digit one in text
        if (merged.profile.checkupId && merged.profile.checkupId.length > 6) {
             // Try to find a 6-digit number in the first 800 chars of raw text
             const shortIdMatch = raw.slice(0, 800).match(/\b(\d{6})\b/);
             if (shortIdMatch) {
                 merged.profile.checkupId = shortIdMatch[1];
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

/** 将 AI 可能输出的 A1/A2、B1/B2 等统一为界面识别的 [A类] / [B类]，并校正 isCritical */
export const normalizeCriticalAssessment = (ass: HealthAssessment): HealthAssessment => {
    let w = (ass.criticalWarning || '').trim();
    if (!w) {
        return { ...ass, isCritical: !!ass.isCritical };
    }
    // 全角括号、数字统一
    w = w
        .replace(/【\s*A\s*[12１２]?\s*类\s*】/gi, '[A类]')
        .replace(/【\s*B\s*[12１２]?\s*类\s*】/gi, '[B类]')
        .replace(/\[[\s]*A\s*[12１２]?\s*类\s*\]/gi, '[A类]')
        .replace(/\[[\s]*B\s*[12１２]?\s*类\s*\]/gi, '[B类]');
    // 若正文仍含「A1类」等字样，再收一道（不破坏括号后的描述）
    w = w.replace(/\bA\s*[12]\s*类\b/gi, 'A类').replace(/\bB\s*[12]\s*类\b/gi, 'B类');
    const hasAbnormalTier = /\[A类\]|\[B类\]/.test(w);
    const isCritical = ass.isCritical === true || hasAbnormalTier;
    return { ...ass, criticalWarning: w, isCritical };
};

export const generateHealthAssessment = async (rec: HealthRecord): Promise<HealthAssessment> => {
    const prompt = `
    你是资深全科医生。请根据以下体检/健康档案数据，生成风险评估报告。
    数据：${JSON.stringify(rec)}

    【重要异常结果 / 危急值分层 — 仅两档，禁止再细分】
    本系统只使用 **A类** 与 **B类** 两档（不要输出 A1、A2、B1、B2 等子类；若你认为属于原 A1/A2 一律标为 A类，原 B1/B2 一律标为 B类）。

    - **A类（危急值）**：需尽快（通常当天）临床处置或紧急联系受检者，可能危及生命或重要器官功能。参考（结合年龄与临床背景综合判断，有则标 A类）：
      · 血压：收缩压 ≥180 和/或 舒张压 ≥120 mmHg（高血压危象倾向）
      · 空腹血糖 ≤3.0 或 ≥16.7 mmol/L；随机血糖明显极高伴症状风险
      · 血钾 ≥6.0 或 ≤2.8 mmol/L（若报告中有电解质）
      · 血钠 ≤120 或 ≥160 mmol/L（若有）
      · 心肌酶/肌钙蛋白明显升高提示急性心肌损伤（若有）
      · 血红蛋白 ≤60 g/L 或 ≥200 g/L（若有）；血小板 ≤20×10^9/L（若有）
      · 急性脑卒中征象、严重胸痛、意识障碍等文本描述（若有）
    - **B类（重要异常）**：不属即刻生命威胁，但需在数日～2 周内安排复查或专科随访。参考：
      · 血压持续 ≥160/100 但未达 A 类阈值
      · 空腹血糖 7.0～16.6 或 HbA1c 明显升高（若有）
      · 血脂多项明显升高、肝肾功能轻中度异常、尿蛋白阳性、肿瘤标志物明显升高等需复查确认者
      · 影像/心电图「建议进一步检查」类中度异常

    【输出规则】
    1) 若无 A/B 类重要异常：isCritical 为 false，criticalWarning 为空字符串 ""。
    2) 若有任一项 A 或 B 类：isCritical 为 true，criticalWarning **必须以** "[A类] " 或 "[B类] " 开头（英文方括号），后接 80 字内说明（指标名 + 数值 + 建议动作）。
    3) 若同时存在 A 与 B 类问题：以更高优先级 **A类** 作为前缀，正文中可简述 B 类异常。
    4) riskLevel 仍填 GREEN / YELLOW / RED（综合风险），可与 isCritical 独立。
    
    请严格返回 JSON 格式:
    {
      "riskLevel": "GREEN" | "YELLOW" | "RED",
      "summary": "综合评估摘要(150字以内)",
      "isCritical": boolean,
      "criticalWarning": "无异常时为空字符串；有则必须以 [A类] 或 [B类] 开头",
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
        const parsed = JSON.parse(jsonText || '{}') as HealthAssessment;
        return normalizeCriticalAssessment(parsed);
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

export const analyzeFollowUpRecord = async (form: any, ass: any, last: any) => {
    const fallback = {
        riskLevel: (last?.assessment?.riskLevel || ass?.riskLevel || RiskLevel.GREEN) as RiskLevel,
        riskJustification: '本次随访已记录。系统暂未完成自动分析，请医生结合临床情况复核。',
        doctorMessage: '请按执行单持续管理，若出现不适请及时复诊。',
        majorIssues: (last?.assessment?.majorIssues || ass?.summary || '').toString(),
        nextCheckPlan: (last?.assessment?.nextCheckPlan || ass?.followUpPlan?.nextCheckItems?.join('、') || '常规复查').toString(),
        lifestyleGoals: Array.isArray(last?.assessment?.lifestyleGoals)
            ? last.assessment.lifestyleGoals
            : [],
        analysisSource: 'fallback',
        analysisError: '',
    };

    const prompt = `
你是慢病管理随访助手。请根据随访记录，输出“下一阶段执行单”关键字段。

输入数据：
1) 本次随访表单：${JSON.stringify(form || {})}
2) 当前综合评估：${JSON.stringify(ass || {})}
3) 上一次随访：${JSON.stringify(last || {})}

请严格返回 JSON（不要附加解释文本）：
{
  "riskLevel": "GREEN" | "YELLOW" | "RED",
  "riskJustification": "风险判定依据，80字内",
  "doctorMessage": "给患者的简短医嘱，80字内",
  "majorIssues": "本次主要问题，120字内",
  "nextCheckPlan": "下次复查项目与重点，120字内",
  "lifestyleGoals": ["可执行目标1", "可执行目标2", "可执行目标3"]
}

要求：
- 结合本次指标变化（血压、血糖、体重、血脂等）判断风险级别；
- 目标要具体可执行，避免空话；
- lifestyleGoals 最多 5 条；
- nextCheckPlan 必须是可落地的检查/随访要点。
`;

    try {
        const jsonText = await callDeepSeek("你是严谨的全科随访管理AI。", prompt);
        const parsed = JSON.parse(jsonText || '{}');
        const riskLevelRaw = String(parsed?.riskLevel || '').toUpperCase();
        const riskLevel: RiskLevel =
            riskLevelRaw === 'RED'
                ? RiskLevel.RED
                : riskLevelRaw === 'YELLOW'
                ? RiskLevel.YELLOW
                : RiskLevel.GREEN;
        const lifestyleGoals = Array.isArray(parsed?.lifestyleGoals)
            ? parsed.lifestyleGoals.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 5)
            : fallback.lifestyleGoals;

        return {
            riskLevel,
            riskJustification: String(parsed?.riskJustification || fallback.riskJustification),
            doctorMessage: String(parsed?.doctorMessage || fallback.doctorMessage),
            majorIssues: String(parsed?.majorIssues || fallback.majorIssues),
            nextCheckPlan: String(parsed?.nextCheckPlan || fallback.nextCheckPlan),
            lifestyleGoals,
            analysisSource: 'ai',
            analysisError: '',
        };
    } catch (e) {
        console.error('Follow-up analyze failed, fallback applied:', e);
        return {
            ...fallback,
            analysisError: e instanceof Error ? e.message : '未知错误',
        };
    }
};
export const generateFollowUpSMS = async (n: string) => {
    const prompt = `
你是健康管理中心护士助手。请为“${n || '受检者'}”生成一条随访短信。

要求：
- 语气专业、温和；
- 包含复查提醒与一句生活方式建议；
- 80字以内；
- 仅返回 JSON：
{"smsContent":"..."}
`;
    try {
        const jsonText = await callDeepSeek("你是医疗随访沟通助手。", prompt);
        const parsed = JSON.parse(jsonText || '{}');
        const smsContent = String(parsed?.smsContent || '').trim();
        if (smsContent) return { smsContent };
    } catch (e) {
        console.error('generateFollowUpSMS failed:', e);
    }
    return { smsContent: `【健康管理中心】${n || '您'}您好，请按计划复查并坚持清淡饮食、规律运动。如有不适请及时就医。` };
};

// --- ROBUST LOCAL FALLBACK FOR HEATMAP (Comprehensive 10+ Departments) ---
const localHeatmapAnalysis = (issues: { [key: string]: number }): DepartmentAnalytics[] => {
    console.log("Starting Local Heatmap Analysis (Comprehensive Mode)...");
    
    // Define Categories - Ensuring ALL core and specialized departments are represented
    const depts: Record<string, { count: number, conditions: Set<string>, services: any[] }> = {
        // --- 1. Foundation Departments (核心基础) ---
        '心血管内科': { count: 0, conditions: new Set(), services: [{name:'动态血压监测', count:0, description:'监测血压波动'}, {name:'冠脉CTA', count:0, description:'排查冠心病'}] },
        '内分泌科': { count: 0, conditions: new Set(), services: [{name:'甲状腺功能全套', count:0, description:'排查甲亢/甲减'}, {name:'糖尿病慢病管理', count:0, description:'血糖控制方案'}] },
        '消化内科': { count: 0, conditions: new Set(), services: [{name:'C13呼气试验', count:0, description:'幽门螺杆菌检测'}, {name:'无痛胃肠镜', count:0, description:'胃肠肿瘤筛查'}] },
        '呼吸内科': { count: 0, conditions: new Set(), services: [{name:'肺功能检查', count:0, description:'慢阻肺筛查'}, {name:'低剂量螺旋CT', count:0, description:'肺结节随访'}] },
        '泌尿外科': { count: 0, conditions: new Set(), services: [{name:'泌尿系彩超', count:0, description:'结石/前列腺筛查'}, {name:'PSA筛查', count:0, description:'前列腺癌筛查'}] },
        '妇科': { count: 0, conditions: new Set(), services: [{name:'HPV+TCT筛查', count:0, description:'宫颈癌筛查'}, {name:'盆底肌修复', count:0, description:'产后康复'}] },
        
        // --- 2. Specialized Departments (特色专科) ---
        '中医科': { count: 0, conditions: new Set(), services: [{name:'中医体质辨识', count:0, description:'未病先防'}, {name:'三伏贴/三九贴', count:0, description:'冬病夏治'}] },
        '康复理疗科': { count: 0, conditions: new Set(), services: [{name:'颈肩腰腿痛理疗', count:0, description:'缓解疼痛'}, {name:'骨科术后康复', count:0, description:'功能恢复'}] },
        '体重管理科': { count: 0, conditions: new Set(), services: [{name:'医学减重门诊', count:0, description:'科学减脂'}, {name:'人体成分分析', count:0, description:'体脂监测'}] },
        '骨科': { count: 0, conditions: new Set(), services: [{name:'骨密度测定', count:0, description:'骨质疏松筛查'}, {name:'关节镜检查', count:0, description:'关节损伤'}] },
        '神经内科': { count: 0, conditions: new Set(), services: [{name:'经颅多普勒(TCD)', count:0, description:'脑血管评估'}, {name:'睡眠监测', count:0, description:'失眠诊疗'}] },
    };

    // Keyword Mapping (Extensive)
    const keywords: Record<string, string> = {
        // Cardio
        '血压': '心血管内科', '心脏': '心血管内科', '心律': '心血管内科', '房颤': '心血管内科', '动脉': '心血管内科', '斑块': '心血管内科', '早搏': '心血管内科', 'ST段': '心血管内科', '胸闷': '心血管内科',
        // Endo
        '血糖': '内分泌科', '糖尿病': '内分泌科', '尿酸': '内分泌科', '痛风': '内分泌科', '血脂': '内分泌科', '胆固醇': '内分泌科', '甘油三酯': '内分泌科', '甲状腺': '内分泌科', '甲功': '内分泌科',
        // Gastro
        '胃': '消化内科', '肠': '消化内科', '幽门': '消化内科', '肝': '消化内科', '转氨酶': '消化内科', '脂肪肝': '消化内科', '胆囊': '消化内科', '息肉': '消化内科', '腹胀': '消化内科',
        // Resp
        '肺': '呼吸内科', '结节': '呼吸内科', '咳嗽': '呼吸内科', '慢阻肺': '呼吸内科', '气短': '呼吸内科', '磨玻璃': '呼吸内科',
        // Urology
        '前列腺': '泌尿外科', '肾结石': '泌尿外科', '尿路': '泌尿外科', 'PSA': '泌尿外科', '结石': '泌尿外科', '尿频': '泌尿外科', '输尿管': '泌尿外科', '隐血': '泌尿外科',
        // Gyn
        '乳腺': '妇科', '宫颈': '妇科', '子宫': '妇科', '附件': '妇科', '经期': '妇科', '白带': '妇科', '卵巢': '妇科',
        // TCM
        '气虚': '中医科', '湿热': '中医科', '亚健康': '中医科', '调理': '中医科', '舌苔': '中医科', '脉象': '中医科', '畏寒': '中医科', '乏力': '中医科',
        // Rehab
        '颈椎': '康复理疗科', '腰椎': '康复理疗科', '疼痛': '康复理疗科', '麻木': '康复理疗科', '肩周': '康复理疗科', '理疗': '康复理疗科',
        // Weight
        '肥胖': '体重管理科', '超重': '体重管理科', 'BMI': '体重管理科', '代谢': '体重管理科', '体重': '体重管理科',
        // Ortho
        '骨折': '骨科', '关节': '骨科', '骨质疏松': '骨科', '骨量': '骨科', '半月板': '骨科', '膝': '骨科',
        // Neuro
        '头晕': '神经内科', '头痛': '神经内科', '失眠': '神经内科', '脑': '神经内科', '记忆力': '神经内科', '睡眠': '神经内科'
    };

    // Classify
    Object.entries(issues).forEach(([issue, count]) => {
        let matched = false;
        // Check keywords
        for (const key in keywords) {
            if (issue.includes(key)) {
                const deptName = keywords[key];
                
                // Special Rule: Thyroid nodule -> Endo (mostly)
                if (issue.includes('甲状腺') && deptName === '内分泌科') {
                     // Keep as Endo
                }
                
                if (depts[deptName]) {
                    depts[deptName].count += count;
                    depts[deptName].conditions.add(issue);
                    matched = true;
                    break;
                }
            }
        }
    });

    // Format Output
    return Object.entries(depts)
        .filter(([_, data]) => data.count > 0)
        .map(([name, data]) => ({
            departmentName: name,
            patientCount: data.count,
            riskLevel: data.count > 5 ? 'HIGH' : data.count > 2 ? 'MEDIUM' : 'LOW',
            keyConditions: Array.from(data.conditions).slice(0, 5),
            suggestedServices: data.services.map(s => ({ ...s, count: Math.ceil(data.count * 0.8) }))
        }));
};

// [UPDATED] Hospital Heatmap Analysis (Hybrid: AI + Local Fallback)
export const generateHospitalBusinessAnalysis = async (issues: { [key: string]: number }): Promise<DepartmentAnalytics[]> => {
    // 1. Try AI Analysis with Explicit Instruction for ALL Departments
    const prompt = `
    作为医院运营专家，请根据以下全院体检异常数据统计(异常项: 人次)，进行全面、精准的科室归类和业务规划。
    
    输入数据: ${JSON.stringify(issues)}
    
    【核心任务】
    1. **全面归类**：请务必将异常项分配到以下**所有相关的临床科室**，不要遗漏：
       - 基础科室：心血管内科、内分泌科、消化内科、呼吸内科、泌尿外科
       - 特色科室：妇科、中医科、康复理疗科、体重管理科、骨科、神经内科
    
    2. **规则建议**：
       - 血压/心脏问题 -> 心血管内科
       - 血糖/血脂/痛风/甲状腺 -> 内分泌科
       - 胃/肠/肝胆/幽门 -> 消化内科
       - 前列腺/结石 -> 泌尿外科
       - 颈肩腰腿痛 -> 康复理疗科
       - 肥胖/超重 -> 体重管理科
       - 头晕/失眠 -> 神经内科
    
    3. **数据估算**：估算每个科室的潜在患者人次 (patientCount)。
    4. **业务建议**：针对每个科室，推荐2个具体的特色诊疗项目(suggestedServices)。
    
    请严格返回 JSON 数组，格式如下:
    [
      {
        "departmentName": "科室名称",
        "patientCount": 0,
        "riskLevel": "HIGH" | "MEDIUM" | "LOW", 
        "keyConditions": ["关联异常1", "关联异常2"], 
        "suggestedServices": [
           { "name": "项目名称", "count": 0, "description": "简述" }
        ]
      }
    ]
    `;

    try {
        if (!API_KEY) throw new Error("No API Key"); // Force fallback if no key
        const jsonText = await callDeepSeek("你是医院管理顾问，擅长数据挖掘与全科业务规划。", prompt);
        const result = JSON.parse(jsonText || '[]');
        if (Array.isArray(result) && result.length > 0) {
            return result;
        }
        throw new Error("AI returned empty result");
    } catch (e) {
        console.warn("Heatmap AI Gen Failed, switching to Comprehensive Local Rule Engine...", e);
        // 2. Comprehensive Local Rule-Based Fallback
        const localResult = localHeatmapAnalysis(issues);
        return localResult; // Should return valid data if issues exist
    }
};

export const generateAnnualReportSummary = async (b: any, c: any) => {
    const prompt = `
请根据以下年度对比数据生成一段简要总结，突出“改善点、待改进点、下一步建议”。

基线数据：${JSON.stringify(b || {})}
本次数据：${JSON.stringify(c || {})}

输出要求：
- 120字以内；
- 语气客观、可执行；
- 仅返回 JSON：
{"summary":"..."}
`;
    try {
        const jsonText = await callDeepSeek("你是全科健康管理医生。", prompt);
        const parsed = JSON.parse(jsonText || '{}');
        const summary = String(parsed?.summary || '').trim();
        if (summary) return { summary };
    } catch (e) {
        console.error('generateAnnualReportSummary failed:', e);
    }
    return { summary: '年度评估已完成：部分指标较前改善，仍需持续监测血压/血糖/血脂并按计划复查。' };
};
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
