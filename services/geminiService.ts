

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
                model: "deepseek-chat", // 使用 DeepSeek-V3
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent }
                ],
                // 启用 JSON 模式以保证输出格式稳定
                response_format: jsonMode ? { type: "json_object" } : undefined,
                temperature: 0.1, // 低温度以保证医学数据的严谨性
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
    1. **体检编号 (Checkup ID)**: 请务必提取 **6位有效数字** (例如 103146)。**严禁** 提取 10 位或更长的数字（那是流水号/条码号）。如果同时存在多个数字，请选择 6 位数的那个。
    2. **体检日期 (Checkup Date)**: 请提取具体的体检日期，格式为 YYYY-MM-DD。通常出现在报告头部。
    3. 请仔细识别教职工健康问卷中新增的“家族史”、“女性健康”、“呼吸道症状”、“心理量表”部分。
    4. 数值型字段(如年龄、支数、评分)请提取为 Number 类型，若未提及则为 null。
    5. Boolean 类型字段(如是否服用降压药)，"是"->true, "否"->false, 未提及->null。
    6. 既往病史请特别注意提取"类风湿性关节炎"，这对于骨折风险模型至关重要。
    7. 吸烟史中，如果能计算或提取到"包年数"(Pack-Years)，请务必填入。
    
    输出必须是严格的 JSON 格式，结构如下:
    {
      "profile": {
        "checkupId": "6位数字编号", 
        "name": "姓名", 
        "gender": "男/女", 
        "department": "部门", 
        "phone": "电话", 
        "checkupDate": "YYYY-MM-DD", 
        "dob": "出生日期", 
        "age": 数字
      },
      "checkup": {
        "basics": { "height": 0, "weight": 0, "bmi": 0, "sbp": 0, "dbp": 0, "waist": 0 },
        "labBasic": {
           "liver": { "ALT": "数值", "AST": "数值", "GGT": "数值", "TBIL": "数值", "DBIL": "数值", "IBIL": "数值", "TP": "数值", "ALB": "数值", "GLB": "数值" }, 
           "ck": "肌酸激酶", "lipids": { "tc": "总胆固醇", "tg": "甘油三酯", "ldl": "低密度", "hdl": "高密度" },
           "renal": { "urea": "尿素", "creatinine": "肌酐", "ua": "尿酸" },
           "bloodRoutine": { "wbc": "白细胞", "hgb": "血红蛋白", "plt": "血小板", "summary": "摘要" },
           "glucose": { "fasting": "空腹血糖" },
           "urineRoutine": { "protein": "尿蛋白(如+)", "summary": "摘要" },
           "thyroidFunction": { "t3": "数值", "t4": "数值", "tsh": "数值" }
        },
        "imagingBasic": {
           "ecg": "心电图结论",
           "ultrasound": { "thyroid": "", "abdomen": "", "breast": "", "uterusAdnexa": "", "prostate": "" }
        },
        "optional": {
           "tct": "", "hpv": "", "homocysteine": "", "immuneSet": "", "tcd": "", "c13": "", "mammography": "", "carotidUltrasound": "", "ct": "", "boneDensity": "", "fundusPhoto": "", "hba1c": "", "gastrin": "", "adiponectin": "", "vitD": "",
           "tumorMarkers4": { "cea": "", "afp": "", "ca199": "", "cy211": "" },
           "tumorMarkers2": { "ca125": "", "ca153": "", "psa": "", "fpsa": "" }
        },
        "abnormalities": [ { "category": "", "item": "", "result": "", "clinicalSig": "" } ]
      },
      "questionnaire": {
        "history": {
           "diseases": ["高血压", "冠心病", "脑卒中", "糖尿病", "慢阻肺", "肿瘤", "类风湿性关节炎" 等],
           "details": { "hypertensionYear": "年份", "cadTypes": [], "strokeYear": "年份", "diabetesYear": "年份", "otherHistory": "文本" },
           "surgeries": "文本"
        },
        "femaleHealth": {
           "menarcheAge": 数字, "firstBirthAge": "选填项文本(<20, 20-24等)", "menopauseStatus": "未绝经/已绝经", "menopauseAge": 数字,
           "breastBiopsy": boolean(有乳腺活检史?), "gdmHistory": boolean(妊娠期糖尿病?), "pcosHistory": boolean(多囊卵巢?)
        },
        "familyHistory": {
           "fatherCvdEarly": boolean(父亲冠心病<55?), "motherCvdEarly": boolean(母亲冠心病<65?), 
           "diabetes": boolean(直系亲属糖尿病?), "hypertension": boolean(直系亲属高血压?), "stroke": boolean(父母脑卒中?),
           "parentHipFracture": boolean(父母髋部骨折?), "lungCancer": boolean(直系亲属肺癌?), "colonCancer": boolean(直系亲属肠癌?), "breastCancer": boolean(母/女/姐妹乳腺癌?)
        },
        "medication": { 
           "isRegular": "是/否", "list": "文本",
           "details": { 
               "antihypertensive": boolean(正在服降压药?), "hypoglycemic": boolean(降糖药?), "lipidLowering": boolean(降脂药?), 
               "antiplatelet": boolean(阿司匹林/抗凝?), "steroids": boolean(长期激素?) 
           }
        },
        "respiratory": {
            "chronicCough": boolean(经常咳嗽?), "chronicPhlegm": boolean(经常咳痰?), "shortBreath": boolean(活动后气短?)
        },
        "mentalScales": {
            "phq9Score": 数字(根据PHQ-9矩阵题计算总分), 
            "gad7Score": 数字(根据GAD-7矩阵题计算总分), 
            "selfHarmIdea": 数字(0-3, 第9题得分)
        },
        "diet": { "habits": [], "dailyStaple": "", "dailyVeg": "", "dailyFruit": "", "dailyMeat": "", "dailyDairy": "", "dailyBeanNut": "" },
        "exercise": { "frequency": "", "duration": "" },
        "sleep": { "hours": "文本", "quality": "", "monitorResult": "" },
        "substances": {
           "smoking": { "status": "从不/已戒/吸烟", "dailyAmount": 数字(支), "years": 数字(年), "quitYear": "年份", "packYears": 数字(包年数) },
           "alcohol": { "status": "", "freq": "", "amount": "" }
        },
        "mental": { "stressLevel": "文本", "stressSource": [] },
        "needs": { "concerns": [], "followUpWillingness": "" }
      }
    }
  `;

  const parsedData = await callDeepSeek(systemPrompt, `请解析以下健康档案数据:\n${rawText}`);

  // [Auto-Fix Logic]: Calculate BMI if missing but height/weight present
  if (parsedData.checkup?.basics) {
      // Ensure numerical types
      const height = Number(parsedData.checkup.basics.height);
      const weight = Number(parsedData.checkup.basics.weight);
      let bmi = Number(parsedData.checkup.basics.bmi);

      // Fix missing BMI
      if ((!bmi || bmi === 0) && height > 0 && weight > 0) {
          // Height from cm -> m
          const h_m = height / 100;
          const calculatedBmi = weight / (h_m * h_m);
          bmi = parseFloat(calculatedBmi.toFixed(1));
          
          parsedData.checkup.basics.bmi = bmi;
          console.log(`[AI Fix] Automatically calculated missing BMI: ${bmi}`);
      }
      
      // Update normalized numbers back to object
      parsedData.checkup.basics.height = height || undefined;
      parsedData.checkup.basics.weight = weight || undefined;
  }

  return parsedData;
}

/**
 * 2. 风险评估: 生成管理方案
 */
export const generateHealthAssessment = async (record: HealthRecord): Promise<HealthAssessment> => {
  const systemPrompt = `
    你是全科主任医师。基于详细的体检数据(Objective)和问卷数据(Subjective)生成风险评估。
    
    【重要】请严格依据以下“重要异常结果分层管理标准”判断危急值（A类）和重大异常（B类）。
    如果符合以下任意条件，必须将 riskLevel 设为 RED，将 isCritical 设为 true，并在 criticalWarning 中注明具体类别（如“A类危急值”或“B类重大异常”）和原因。

    一、一般检查
    [A类] 血压：收缩压≥180mmHg 或 舒张压≥110mmHg。

    二、物理检查
    [A类] 
    1. 心率 ≥150次/min 或 ≤45次/min。
    2. 眼科：疑似青光眼发作、突发视力下降、疑似流行性出血性结膜炎。
    3. 妇科：急腹症（结合超声）。
    [B类]
    1. 触及高度可疑恶性包块（甲状腺、乳腺、腹部、直肠等）。
    2. 眼压>25mmHg，视乳头水肿。
    3. 阴道异常出血。

    三、实验室检查
    [A类]
    1. 血红蛋白(Hb) ≤60g/L。
    2. 血小板(PLT) ≤30×10^9/L 或 ≥1000×10^9/L。
    3. 白细胞(WBC) ≤1.0×10^9/L 或 中性粒绝对值 ≤0.5×10^9/L。
    4. 肝功：ALT/AST ≥15倍正常值，总胆红素 ≥5倍。
    5. 肾功：肌酐(Scr) ≥707μmol/L (首次)。
    6. 血糖：空腹 ≤2.8mmol/L 或 ≥16.7mmol/L；随机 ≥20.0mmol/L。
    7. 血钾 ≤2.5mmol/L 或 ≥6.5mmol/L。
    [B类]
    1. Hb ≤60g/L(历次) 或 ≥200g/L。
    2. PLT 30-50×10^9/L。
    3. WBC ≤2.0×10^9/L 或 ≥30.0×10^9/L；发现幼稚细胞。
    4. 尿蛋白3+且红细胞满视野；酮体≥2+(糖尿病)或≥3+(无糖尿病)。
    5. 肝功：ALT/AST ≥5-15倍，总胆红素 ≥3-5倍。
    6. 肾功：肌酐 ≥445μmol/L。
    7. TCT：HSIL、AS-H、癌、AGC、AIS。
    8. 肿瘤标志物：AFP>400；PSA>10且f/t<0.15；CA125>95(绝经后)；其他指标≥2倍参考值。

    四、辅助检查
    [A类]
    1. 心电图：急性心梗、心缺血、室扑室颤、室速(≥150)、多形性室速、R on T、三度房室阻滞、停搏>3s、提示严重高/低钾。
    2. X线/CT：气胸、大量胸水、脑出血>30ml、脑梗死大面积、主动脉夹层、动脉瘤、肠梗阻。
    3. 超声：脏器破裂、胆管炎、异位妊娠、囊肿扭转/破裂。
    [B类]
    1. 影像学提示：高度可疑恶性占位（肺、肝、胆、胰、脾、肾、纵隔、骨骼）。
    2. 囊肿巨大（肝>10cm，肾>5cm，胰>3cm）。

    返回 JSON:
    {
       "riskLevel": "RED/YELLOW/GREEN",
       "isCritical": true/false,
       "criticalWarning": "危急值详情(例如: '[A类] 收缩压185mmHg', '[B类] 肺部高度可疑恶性结节')，如无则null",
       "summary": "综合综述",
       "risks": { "red": ["高危因素"], "yellow": ["中危因素"], "green": ["低危/关注"] },
       "managementPlan": {
          "dietary": ["饮食建议"], "exercise": ["运动建议"], "medication": ["用药调整建议"], "monitoring": ["监测指标建议"]
       },
       "structuredTasks": [
          { "id": "uuid", "category": "diet", "description": "具体可执行任务", "frequency": "每日/每周", "isKeyGoal": true }
       ],
       "followUpPlan": { "frequency": "随访频率建议", "nextCheckItems": ["下次复查项目"] }
    }
  `;

  return await callDeepSeek(systemPrompt, `数据:\n${JSON.stringify(record)}`);
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
      
      输出 JSON:
      {
        "riskLevel": "RED" | "YELLOW" | "GREEN",
        "riskJustification": "临床风险判定理由(请使用专业医学术语，分析核心指标变化、达标情况及风险因素控制情况，供医生参考)",
        "doctorMessage": "医生寄语(请使用通俗易懂的语言，面向患者。综合评估结果，给出鼓励、警示或核心行动建议，语气亲切但专业)",
        "majorIssues": "主要问题(中文摘要)",
        "nextCheckPlan": "下次复查计划(中文)",
        "lifestyleGoals": ["生活方式目标(中文)"]
      }
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
    
    【关键要求】
    1. 请仔细分析输入数据中的具体异常项数量。
    2. 对于每个科室建议的每一项诊疗业务(suggestedServices)，你必须**估算**具体的潜在受众人数(count)。
       例如，如果“甲状腺结节”有100人，建议“甲状腺细针穿刺”时，可以估算潜在受众为20-30人（基于医学转化率）。
    3. 必须输出 JSON 格式。
    
    输出结构:
    [
      {
        "departmentName": "科室名称 (如心血管内科)",
        "patientCount": 120 (该科室相关异常的总人数),
        "riskLevel": "HIGH" | "MEDIUM" | "LOW" (需求紧迫度),
        "keyConditions": ["高血压", "冠心病"],
        "suggestedServices": [
           { "name": "动态血压监测", "count": 50, "description": "针对高血压人群..." },
           { "name": "冠脉CTA", "count": 10, "description": "针对胸痛/高危人群..." }
        ]
      }
    ]
    `;

    const userContent = JSON.stringify(aggregatedIssues);

    try {
        const result = await callDeepSeek(systemPrompt, userContent);
        if (Array.isArray(result)) {
             return result as DepartmentAnalytics[];
        }
        return [];
    } catch (e) {
        console.error("Business Analysis Error:", e);
        return [];
    }
};

/**
 * 7. 生成年度随访成效报告摘要
 */
export const generateAnnualReportSummary = async (
    baseline: FollowUpRecord,
    current: FollowUpRecord
): Promise<{ summary: string }> => {
    const systemPrompt = `
    你是一名健康管理专家。请对比患者的基线随访记录和当前随访记录，生成一份年度健康管理成效摘要。
    
    重点关注：
    1. 核心指标（血压、血糖、体重、血脂）的变化趋势。
    2. 风险等级的变化。
    3. 依从性（用药、生活方式）的改善情况。
    4. 给出肯定和鼓励，并指出下一年度的重点。
    
    输出 JSON: { "summary": "摘要内容，200字左右" }
    `;

    const userContent = `
    基线记录 (${baseline.date}):
    ${JSON.stringify(baseline)}
    
    当前记录 (${current.date}):
    ${JSON.stringify(current)}
    `;

    return await callDeepSeek(systemPrompt, userContent, true);
};