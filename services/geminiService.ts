
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
    请忽略无关文本，尽可能提取有效信息。如果某项未提及，请留空或null。
    
    输出必须是严格的 JSON 格式，符合以下结构:
    {
      "profile": {
        "checkupId": "体检编号(Q2)", "name": "姓名(Q1)", "gender": "男/女(Q3)", "department": "部门(Q4)", "phone": "电话", "checkupDate": "YYYY-MM-DD", "dob": "出生日期", "age": 数字
      },
      "checkup": {
        "basics": { "height": 0, "weight": 0, "bmi": 0, "sbp": 0, "dbp": 0 },
        "labBasic": {
           "liver": { "ALT": "数值", "AST": "数值", "GGT": "数值", "TBIL": "数值", "DBIL": "数值", "IBIL": "数值", "TP": "数值", "ALB": "数值", "GLB": "数值" }, 
           "ck": "肌酸激酶数值",
           "lipids": { "tc": "总胆固醇", "tg": "甘油三酯", "ldl": "低密度", "hdl": "高密度" },
           "renal": { "urea": "尿素", "creatinine": "肌酐", "ua": "尿酸" },
           "bloodRoutine": "血常规摘要/异常",
           "glucose": { "fasting": "空腹血糖" },
           "urineRoutine": "尿常规摘要",
           "thyroidFunction": { "t3": "数值", "t4": "数值", "tsh": "数值" }
        },
        "imagingBasic": {
           "ecg": "心电图结论",
           "ultrasound": {
              "thyroid": "甲状腺超声结论",
              "abdomen": "肝胆胰脾肾输尿管膀胱超声结论",
              "breast": "乳腺超声结论",
              "uterusAdnexa": "子宫附件超声结论",
              "prostate": "前列腺超声结论"
           }
        },
        "optional": {
           "tct": "TCT结果", "hpv": "HPV结果",
           "tumorMarkers4": { "cea": "数值", "afp": "数值", "ca199": "数值", "cy211": "数值" },
           "tumorMarkers2": { "ca125": "数值", "ca153": "数值", "psa": "数值", "fpsa": "数值" },
           "afpCeaQuant": "AFP/CEA定量",
           "heartUltrasound": "心脏彩超结论",
           "rheumatoid": { "esr": "血沉", "rf": "类风湿因子", "aso": "抗O" },
           "homocysteine": "同型半胱氨酸结果",
           "immuneSet": "免疫全套结果",
           "tcd": "TCD颅内多普勒结论",
           "c13": "碳13结果",
           "mammography": "乳腺钼靶结论",
           "carotidUltrasound": "颈部血管彩超结论",
           "ct": "CT部位及结论",
           "boneDensity": "骨密度结果",
           "fundusPhoto": "眼底照相结果",
           "hba1c": "糖化血红蛋白",
           "gastrin": "胃功能三项(胃泌素17等)",
           "adiponectin": "脂联素",
           "vitD": "维生素D"
        },
        "abnormalities": [
           { "category": "分类", "item": "项目名", "result": "异常结果", "clinicalSig": "提示(偏高/偏低/结节)" }
        ]
      },
      "questionnaire": {
        "history": {
           "diseases": ["Q5既往史: 高血压/冠心病/心律失常/脑卒中/糖尿病/高脂血症/高尿酸/脂肪肝/慢肺/甲状腺/肾病/胃病/骨质疏松/肿瘤"],
           "details": {
               "hypertensionYear": "Q6高血压年份", 
               "cadTypes": ["Q7冠心病类型: 心绞痛/心肌梗死/支架/搭桥"], 
               "arrhythmiaType": "Q8心律失常类型", 
               "strokeTypes": ["Q9脑卒中类型: 脑梗/脑出血"], 
               "strokeYear": "Q10年份",
               "diabetesYear": "Q11糖尿病年份", 
               "tumorSite": "Q12肿瘤部位", 
               "tumorYear": "Q13年份", 
               "otherHistory": "Q14其他病史"
           },
           "surgeries": "Q15手术及外伤史"
        },
        "medication": { "isRegular": "Q16(是/否)", "list": "Q17规律用药情况" },
        "diet": {
           "habits": ["Q18: 外卖/不规律/偏咸/偏油/偏甜"], 
           "stapleType": "Q19: 精米白面/粗粮杂豆", 
           "coarseGrainFreq": "Q20: 每天/每周3-5次/每周1-2次",
           "dailyStaple": "Q21: ≥500g/400g/300g/200g/100g", 
           "dailyVeg": "Q22: ≥300g/150-300g/<150g", 
           "dailyFruit": "Q23: ≥200g/100-200g/<100g", 
           "dailyMeat": "Q24: ≥200g/100-200g/<100g", 
           "meatTypes": ["Q25: 牛羊猪/鸡鸭鹅/鱼海鲜/鸡蛋"], 
           "dailyDairy": "Q26: 每天/每周3-5次/偶尔/几乎不", 
           "dailyBeanNut": "Q27: 经常/偶尔/几乎不"
        },
        "hydration": { 
            "dailyAmount": "Q28: 杯数或ml", 
            "types": ["Q29: 白开水/茶/咖啡/含糖饮料"] 
        },
        "exercise": { 
            "frequency": "Q30: 几乎不/每周1-2/3-5/5次以上", 
            "types": ["Q31: 散步/快走/跑步/游泳/球类/力量/太极瑜伽/其他"], 
            "otherType": "Q32", 
            "duration": "Q33: <30min/30-60min/>60min" 
        },
        "sleep": { 
            "hours": "Q34: 小时", 
            "quality": "Q35: 好/一般/差", 
            "nap": "Q36: 每天/偶尔/从不", 
            "snore": "Q37: 无/偶尔/经常/已做监测", 
            "monitorResult": "Q38" 
        },
        "substances": {
           "smoking": { 
               "status": "Q39: 从不/已戒/吸烟", 
               "quitYear": "Q40", 
               "dailyAmount": "Q41支", 
               "years": "Q42年", 
               "passive": ["Q43: 无/家/办/公共"] 
           },
           "alcohol": { 
               "status": "Q44: 从不/已戒/饮酒", 
               "types": ["Q45: 啤/红/白"], 
               "freq": "Q46次/周", 
               "amount": "Q47两/杯", 
               "drunkHistory": "Q48: 0/1-2/≥3次", 
               "quitIntent": "Q49: 无/想/已试" 
           }
        },
        "mental": { 
            "stressLevel": "Q50: 很小/一般/较大/很大", 
            "stressSource": ["Q51: 家庭/人际/教学/科研/职称/行政"], 
            "otherSource": "Q52", 
            "reliefMethod": ["Q53: 运动/娱乐/沟通"], 
            "otherRelief": "Q54" 
        },
        "needs": { 
            "concerns": ["Q55: 血压/血糖/血脂/颈腰/睡眠/胃肠/肿瘤/心理"], 
            "otherConcern": "Q56", 
            "followUpWillingness": "Q57: 是/否", 
            "desiredSupport": ["Q58: 饮食/运动/慢病/急救/心理/中医"], 
            "otherSupport": "Q59" 
        }
      }
    }
  `;

  return await callDeepSeek(systemPrompt, `请解析以下健康档案数据:\n${rawText}`);
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
    
    目标科室范围（包含但不限于）：
    - 消化内科 (针对幽门螺杆菌、胃功能异常、脂肪肝、胆囊结石等)
    - 心血管内科 (高血压、心律失常、冠心病)
    - 内分泌科 (糖尿病、甲状腺、肥胖、骨质疏松)
    - 呼吸内科 (肺结节、慢性支气管炎)
    - 骨科/康复科 (颈椎病、腰椎病、关节炎)
    - 眼科 (白内障、眼底病变、青光眼)
    - 口腔科 (牙周炎、缺齿)
    - 泌尿外科 (前列腺增生、肾结石)
    - 妇科 (子宫肌瘤、HPV/TCT)
    - 体重管理科 (超重/肥胖)
    
    输出格式为 JSON 数组:
    [
      {
        "departmentName": "科室名称",
        "patientCount": 数字(基于关联异常项的总人数估算),
        "riskLevel": "HIGH"(高需求)/"MEDIUM"/"LOW",
        "keyConditions": ["关联的主要异常项1", "异常项2"],
        "suggestedServices": ["建议开展业务1 (如: C13呼气试验)", "业务2 (如: 胃肠镜检查)"]
      }
    ]
    `;

    const userContent = `全院异常项统计汇总: ${JSON.stringify(aggregatedIssues)}`;

    const result = await callDeepSeek(systemPrompt, userContent, true);
    return result.departments || result; // Handle potential wrapper object if AI adds one
};
