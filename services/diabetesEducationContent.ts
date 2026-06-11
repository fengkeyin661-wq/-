import type { IndicatorEdu, DietGuidance, ExerciseGuidance, GiFoodItem, GiEducationGuide } from '../types';
import { RiskLevel } from '../types';

export const INDICATOR_EDUCATION: Record<string, IndicatorEdu> = {
  glucose_fasting: {
    itemId: 'glucose_fasting',
    label: '空腹血糖',
    concept: '空腹8–10小时后测定的静脉血浆葡萄糖浓度',
    principle: '反映肝脏糖输出与基础胰岛素敏感性，受前一晚饮食与睡眠影响',
    referenceRange: '正常 3.9–6.1 mmol/L；糖尿病前期 6.1–6.9；≥7.0 需进一步诊断',
    clinicalMeaning: '升高提示胰岛素分泌不足或胰岛素抵抗，需结合餐后血糖与HbA1c综合判断',
    retestCycle: '高危人群每年1次；确诊后每3个月',
  },
  glucose_postprandial: {
    itemId: 'glucose_postprandial',
    label: '餐后2小时血糖',
    concept: '进食标准餐或75g葡萄糖后2小时测定的血糖',
    principle: '反映餐后胰岛素分泌与组织利用葡萄糖的能力',
    referenceRange: '正常 <7.8 mmol/L；糖尿病前期 7.8–11.0；≥11.1 符合糖尿病诊断标准之一',
    clinicalMeaning: '餐后高血糖与心血管并发症风险密切相关，控餐后血糖同样重要',
    retestCycle: '每3–6个月',
  },
  hba1c: {
    itemId: 'hba1c',
    label: '糖化血红蛋白（HbA1c）',
    concept: '血红蛋白与葡萄糖非酶促结合的产物，反映近2–3个月平均血糖',
    principle: '红细胞寿命约120天，HbA1c综合反映短期血糖波动',
    referenceRange: '正常 <6.0%；一般控制目标 <7.0%（个体化调整）',
    clinicalMeaning: '是评估长期血糖控制的金标准，与微血管并发症风险直接相关',
    retestCycle: '每3个月',
  },
  ecg: {
    itemId: 'ecg',
    label: '心电图',
    concept: '记录心脏电活动，无创筛查心律失常与心肌缺血',
    principle: '心肌缺血或梗死时可见ST-T改变、病理性Q波等',
    referenceRange: '窦性心律，无显著ST-T异常',
    clinicalMeaning: '糖尿病患者冠心病风险增高，心电图异常需进一步心脏评估',
    retestCycle: '每年',
  },
  arteriosclerosis: {
    itemId: 'arteriosclerosis',
    label: '动脉硬化检测（ABI/baPWV/cfPWV）',
    concept: 'ABI为踝臂血压指数；baPWV为臂踝脉搏波传导速度；cfPWV为颈股脉搏波传导速度',
    principle: 'ABI反映下肢动脉血供；PWV反映动脉壁弹性与硬化程度，值越高硬化越重',
    referenceRange: 'ABI 0.9–1.3；臂踝 PWV（baPWV）<1400 cm/s；颈股 PWV（cfPWV）<10 m/s',
    clinicalMeaning: 'ABI<0.9提示外周动脉疾病；baPWV/cfPWV升高提示大动脉硬化，糖尿病合并高血压者需重点关注',
    retestCycle: '每年',
  },
  fundus: {
    itemId: 'fundus',
    label: '眼底照相',
    concept: '通过眼底成像观察视网膜微血管病变',
    principle: '长期高血糖损伤视网膜毛细血管，出现微动脉瘤、渗出、出血等',
    referenceRange: '无糖尿病视网膜病变（DR 0级）',
    clinicalMeaning: 'DR是糖尿病特异性并发症，III级及以上需眼科专科治疗',
    retestCycle: '无病变每年1次；有病变每3–6个月',
  },
  body_composition: {
    itemId: 'body_composition',
    label: '人体成分分析（InBody）',
    concept: '通过生物电阻抗测定体脂率、骨骼肌质量、内脏脂肪面积、腰臀比等',
    principle: '区分脂肪、肌肉、水分分布，InBody评分综合反映体成分健康度',
    referenceRange:
      'BMI 18.5–24；男体脂率10–20%、女18–28%；内脏脂肪面积<100 cm²；骨骼肌质量与身体脂肪量正常范围见 InBody 报告（导入表四列上下限）；InBody 评分≥70 分；腰臀比男<0.9女<0.85',
    clinicalMeaning: '内脏脂肪面积增大与胰岛素抵抗、代谢综合征密切相关；肌少型肥胖需兼顾增肌减脂',
    retestCycle: '每3–6个月',
  },
  lipids: {
    itemId: 'lipids',
    label: '血脂四项',
    concept: '总胆固醇、甘油三酯、高密度脂蛋白、低密度脂蛋白',
    principle: 'LDL-C是动脉粥样硬化的主要致病脂蛋白',
    referenceRange: 'LDL-C <2.6 mmol/L（合并ASCVD <1.8）',
    clinicalMeaning: '糖尿病患者常合并血脂异常，需强化降脂治疗',
    retestCycle: '每年',
  },
  renal: {
    itemId: 'renal',
    label: '肾功能',
    concept: '血肌酐、尿素氮及估算肾小球滤过率（eGFR）',
    principle: '肾小球滤过功能下降时肌酐升高、eGFR降低',
    referenceRange: 'eGFR ≥60 mL/min/1.73m²',
    clinicalMeaning: '糖尿病肾病是主要微血管并发症，需早期筛查与干预',
    retestCycle: '每年',
  },
  urine_albumin: {
    itemId: 'urine_albumin',
    label: '尿微量白蛋白',
    concept: '尿液中微量白蛋白排泄量',
    principle: '肾小球滤过屏障损伤时白蛋白漏出增加',
    referenceRange: 'UACR <30 mg/g为正常；30–300为微量白蛋白尿',
    clinicalMeaning: '微量白蛋白尿是糖尿病肾病最早标志，此阶段可逆转',
    retestCycle: '每年',
  },
  c_peptide: {
    itemId: 'c_peptide',
    label: '胰岛素C肽',
    concept: '与胰岛素等摩尔分泌的内源性肽段，反映自身β细胞分泌功能',
    principle: 'C肽与胰岛素同步分泌、半衰期较长，测定结果基本不受外源性胰岛素注射干扰',
    referenceRange: '空腹C肽约0.8–4.0 ng/mL（因检测方法而异）；空腹<0.6 ng/mL提示分泌不足',
    clinicalMeaning: '用于鉴别1型与2型糖尿病、评估胰岛功能、指导是否需胰岛素或调整口服药方案',
    retestCycle: '初诊或方案调整时检测；病情稳定后可随年度复查',
  },
  ogtt: {
    itemId: 'ogtt',
    label: '口服葡萄糖耐量试验（OGTT）',
    concept: '口服75g无水葡萄糖后，按时间点测定血糖，评估机体处理葡萄糖的能力',
    principle: '观察糖负荷后血糖动态变化，可发现仅空腹或仅餐后异常时难以判定的糖代谢紊乱',
    referenceRange: '空腹<7.0 mmol/L；2小时<7.8 mmol/L为正常；7.8–11.0为糖耐量减低；≥11.1符合糖尿病诊断',
    clinicalMeaning: '确诊糖尿病及糖尿病前期的重要依据，适用于空腹血糖正常但疑有糖耐量异常者',
    retestCycle: '诊断不明确时完善；糖尿病前期建议每1–3年复查',
  },
  blood_pressure: {
    itemId: 'blood_pressure',
    label: '血压',
    concept: '收缩压与舒张压，反映循环系统负荷与血管状态',
    principle: '糖尿病常与高血压并存，二者协同增加心、脑、肾及眼底并发症风险',
    referenceRange: '一般人群<140/90 mmHg；糖尿病人群建议<130/80 mmHg（个体化）',
    clinicalMeaning: '血压控制是糖尿病综合管理的重要一环，与血糖、血脂同等重要',
    retestCycle: '家庭自测每周2–3次；门诊每3个月复查',
  },
  waist_bmi: {
    itemId: 'waist_bmi',
    label: '体重指数与腰围',
    concept: 'BMI=体重(kg)/身高(m)²；腰围反映腹部脂肪堆积',
    principle: '超重、肥胖及中心性肥胖与胰岛素抵抗、2型糖尿病发生密切相关',
    referenceRange: 'BMI 18.5–24 kg/m²；男腰围<90 cm、女<85 cm',
    clinicalMeaning: '体重管理是糖尿病预防和治疗的基石，减重5–10%可显著改善血糖',
    retestCycle: '每月监测体重；每3–6个月评估腰围与BMI',
  },
  foot_exam: {
    itemId: 'foot_exam',
    label: '糖尿病足筛查',
    concept: '检查足部皮肤、溃疡、畸形及血供、感觉功能',
    principle: '神经病变与血管病变导致足部损伤感知差、愈合慢，易进展为溃疡甚至截肢',
    referenceRange: '无溃疡、无显著畸形；足背动脉搏动可触及；10g尼龙丝试验阴性',
    clinicalMeaning: '早期发现高危足，可显著降低糖尿病足溃疡与截肢风险',
    retestCycle: '每年1次（无病变）；有病变者每次就诊评估',
  },
  neuropathy: {
    itemId: 'neuropathy',
    label: '糖尿病神经病变筛查',
    concept: '评估周围神经感觉与反射，常用10g尼龙丝、震动觉、针刺痛觉等',
    principle: '长期高血糖损伤周围神经，表现为感觉减退、疼痛或自主神经症状',
    referenceRange: '10g尼龙丝试验各点均感知；震动觉正常',
    clinicalMeaning: '周围神经病变是糖尿病足的重要危险因素，也是常见慢性并发症',
    retestCycle: '每年1次',
  },
  carotid_us: {
    itemId: 'carotid_us',
    label: '颈动脉彩超',
    concept: '超声观察颈动脉内膜厚度、斑块及狭窄程度',
    principle: '反映大动脉粥样硬化负荷，斑块不稳定可引发缺血性卒中',
    referenceRange: '内膜光滑，无显著斑块或狭窄（IMT通常<1.0 mm，因年龄调整）',
    clinicalMeaning: '糖尿病患者卒中风险增高，颈动脉斑块提示需强化心血管风险管理',
    retestCycle: '每1–2年（高危或已有斑块者缩短间隔）',
  },
};

/** 报告科普部分默认展示的核心指标（含指南建议年度筛查项） */
export const CORE_INDICATOR_EDUCATION_IDS = [
  'glucose_fasting',
  'glucose_postprandial',
  'hba1c',
  'ogtt',
  'c_peptide',
  'blood_pressure',
  'waist_bmi',
  'lipids',
  'renal',
  'urine_albumin',
  'ecg',
  'arteriosclerosis',
  'carotid_us',
  'fundus',
  'foot_exam',
  'neuropathy',
  'body_composition',
];

export const DIABETES_CLINIC_CONTACT = {
  workHours: '每周一至周五 上午8:30–12:00，下午14:30–18:00',
  phone: '0371-67739261',
  inviteText: '欢迎有血糖管理需求的职工联系咨询。',
};

/** 报告开篇鼓励语 */
export const REPORT_ENCOURAGEMENT = {
  title: '致参加筛查的朋友',
  greeting: '您好！',
  paragraphs: [
    '感谢您参加本次糖尿病并发症专项筛查。',
    '很多人觉得身体没有明显不舒服，就认为自己很健康。其实，高血糖、高血压、动脉硬化、眼底病变等问题，往往在早期没有明显症状，却可能在不知不觉中影响心脏、血管、眼睛、肾脏和神经功能。',
    '您愿意抽出时间参加筛查，主动了解自己的身体状况，这本身就是对自己和家人健康负责的重要一步。',
    '本次检查并不是为了给大家贴上“有病”或“没病”的标签，而是希望通过早发现、早评估、早干预，帮助大家及时发现潜在风险，把疾病消灭在萌芽阶段。',
    '如果报告中出现个别指标偏高或风险提示，也不必过于担心。大多数糖尿病及其并发症的发展都有一个较长过程。只要及时调整生活方式，坚持科学管理，许多风险是可以延缓、控制甚至改善的。',
    '尤其是糖尿病前期人群，以及刚刚出现血糖异常的人群，通过合理饮食、规律运动、控制体重和定期监测，很多人的血糖能够恢复到正常水平；即使已经确诊糖尿病，也完全可以通过规范治疗和健康管理，长期保持良好的生活质量。',
    '这份报告不仅记录了您的检查结果，更为您提供了后续健康管理建议、复查计划以及饮食运动指导，希望能够帮助您更加全面地了解自己的身体状况。',
    '健康不是一次检查的结果，而是日积月累的选择；健康管理也不是一个人的坚持，而是一段持续改善的过程。',
    '愿您从今天开始，多关注自己一点，多行动一点，让健康成为未来生活最坚实的保障。',
  ],
  signature: '郑州大学医院健康管理团队',
};

/** WS/T 652-2019 食物 GI 分级 */
export const classifyGi = (giValue: number): GiFoodItem['gi'] =>
  giValue <= 55 ? 'low' : giValue <= 70 ? 'medium' : 'high';

export const formatGiLevel = (gi: GiFoodItem['gi']) =>
  gi === 'low' ? '低GI' : gi === 'medium' ? '中GI' : '高GI';

export const GI_EDUCATION: GiEducationGuide = {
  intro:
    'GI（血糖生成指数，Glycemic Index）表示进食含 50 g 可利用碳水化合物的食物后，2 小时内血糖应答相对于葡萄糖（GI=100）的升高幅度，反映食物引起血糖升高的相对能力。',
  standardNote:
    '分级依据国家卫生健康委 WS/T 652-2019《食物血糖生成指数测定方法》及中国营养学会团体标准 T/CNSS 012-2019《预包装食品血糖生成指数标示规范》等文件：',
  tiers: [
    {
      level: 'low',
      label: '低GI食物',
      range: 'GI ≤ 55',
      description: '消化吸收较慢，葡萄糖释放平缓，血糖波动较小，更利于血糖管理',
    },
    {
      level: 'medium',
      label: '中GI食物',
      range: '55 < GI ≤ 70',
      description: '血糖上升速度中等，需注意食用份量，并与蔬菜、优质蛋白搭配',
    },
    {
      level: 'high',
      label: '高GI食物',
      range: 'GI > 70',
      description: '消化吸收较快、血糖上升较快，建议减少精制主食或调整烹调与搭配方式',
    },
  ],
  disclaimer:
    '下表 GI 值为我国常见食物测定或《中国食物成分表》等权威资料参考值；同一食物因品种、加工与烹调方式不同会有差异，供日常选食参考。',
};

const COMMON_GI_FOOD_DATA: Omit<GiFoodItem, 'gi'>[] = [
  { name: '燕麦片', giValue: 55, note: '整粒/钢切燕麦优于速溶；适合早餐主食' },
  { name: '荞麦面', giValue: 54, note: '富含膳食纤维，可替代部分精制面条' },
  { name: '玉米（煮）', giValue: 55, note: '整粒玉米优于玉米糊；每次约半根至一根' },
  { name: '红薯（蒸）', giValue: 54, note: '蒸食优于烤食，每次约 100–150 g，替代部分主食' },
  { name: '绿豆', giValue: 38, note: '绿豆汤少加糖，可与主食搭配' },
  { name: '豆腐', giValue: 15, note: '优质植物蛋白，日常可常选用' },
  { name: '牛奶', giValue: 27, note: '选低糖或原味，每日约 300 ml' },
  { name: '苹果', giValue: 36, note: '带皮食用，每天约 200 g' },
  { name: '香蕉', giValue: 52, note: '成熟度越高 GI 略升，注意控量' },
  { name: '糙米饭', giValue: 68, note: '优于白米饭，需充分咀嚼，可与豆类同煮' },
  { name: '小米粥', giValue: 69, note: '不宜煮得过烂，可与鸡蛋、蔬菜搭配' },
  { name: '土豆（煮）', giValue: 66, note: '作蔬菜而非主食，避免泥状、油炸加工' },
  { name: '南瓜（蒸）', giValue: 65, note: '老南瓜升糖相对更快，均需控制份量，不宜大量替代主食' },
  { name: '白米饭', giValue: 83, note: '可与杂粮同煮，先吃菜和蛋白再吃主食' },
  { name: '白馒头', giValue: 88, note: '精制主食，建议减量，搭配蔬菜先吃' },
  { name: '小麦面条', giValue: 81, note: '少喝汤、多加蔬菜，控制面条份量' },
  { name: '肉包/馒头类', giValue: 80, note: '面皮升糖较快，注意控制个数与搭配' },
  { name: '油条', giValue: 95, note: '高油高糖，不宜经常食用' },
  { name: '西瓜', giValue: 72, note: '单次少量，两餐之间适量' },
];

export const COMMON_GI_FOODS: GiFoodItem[] = COMMON_GI_FOOD_DATA.map((f) => ({
  ...f,
  gi: classifyGi(f.giValue),
})).sort((a, b) => {
  const order = { low: 0, medium: 1, high: 2 };
  return order[a.gi] - order[b.gi] || a.giValue - b.giValue;
});

export const COOKING_TIPS = [
  '烹调方式优先：蒸、煮、炖、凉拌，减少油炸、煎炒',
  '控制勾芡与酱料，烩菜少放淀粉勾芡',
  '植物油每日25–30g，避免反复煎炸',
  '主食粗细搭配，杂粮占1/3以上',
  '先吃蔬菜再吃主食，延缓血糖上升',
  '细嚼慢咽，每餐进食时间不少于20分钟',
  '少食多餐，避免暴饮暴食',
  '限制含糖饮料，白开水或淡茶为佳',
];

export const EATING_TIPS = [
  '固定三餐时间，避免跳过早餐',
  '每餐保证蔬菜占餐盘1/2',
  '每餐搭配优质蛋白（鱼、禽、豆、蛋）',
  '外出就餐时少点糖醋、红烧类高糖菜肴',
  '加餐选择坚果（每日约10g）、酸奶（无糖）或低GI水果',
  '睡前2小时避免大量进食',
  '记录饮食日记，便于发现升糖食物',
];

export const GUIDELINE_NOTES = [
  '《中国2型糖尿病防治指南（2024版）》：确诊后应每年至少进行1次全面并发症筛查',
  '血糖控制目标个体化：一般HbA1c<7.0%，老年或合并症多者可适当放宽至<8.0%',
  '生活方式干预是糖尿病管理的基础：合理膳食、规律运动、戒烟限酒、心理平衡',
  '每年筛查：血压、眼底、尿白蛋白/肾功能、血脂、足部、心电图',
  '血压控制目标<130/80 mmHg（无禁忌时），合并肾病者需个体化',
  'LDL-C控制目标：无ASCVD <2.6 mmol/L，有ASCVD <1.8 mmol/L',
  '规律监测血糖：口服药治疗者每月至少4次；胰岛素治疗者每日监测',
  '出现视力骤降、足部破溃、胸闷胸痛等症状请及时就医',
];

/** 报告第六节：糖尿病常见并发症症状科普（非针对单项检查结果） */
export const COMPLICATION_CARE_GUIDE = [
  '糖尿病常见并发症在早期常无明显不适，了解以下常见信号有助于及早发现、及时就医：',
  '眼部：视物模糊、黑影飘动、视野变窄或阅读困难，可能提示视网膜病变。',
  '肾脏：尿中泡沫增多、下肢或眼睑浮肿，可能提示肾功能受损。',
  '足部：足趾麻木、针刺感、行走疼痛或伤口久不愈合，可能提示神经或血管病变。',
  '心脏与血管：活动后胸闷、胸痛、气促，或头晕头痛加重，需警惕心脑血管风险。',
  '神经：对称性手足麻木、烧灼感或感觉减退，可能为周围神经病变表现。',
  '如出现上述情况，或本次筛查提示需关注，请及时到内科或内分泌科就诊，按医嘱进一步检查或转诊专科。',
];

export const getDietGuidance = (): DietGuidance => ({
  principles: [
    '总能量摄入与体重目标匹配，超重/肥胖者适度减少总热量',
    '碳水化合物占总能量45–60%，优先低GI食物',
    '增加膳食纤维摄入，每日25–30g',
    '限制饱和脂肪，增加不饱和脂肪（橄榄油、坚果、鱼）',
    '钠盐每日不超过5g',
  ],
  giEducation: GI_EDUCATION,
  giFoods: COMMON_GI_FOODS,
  cookingTips: COOKING_TIPS,
  eatingTips: EATING_TIPS,
});

export const getExerciseGuidance = (riskLevel: RiskLevel): ExerciseGuidance => {
  const isHighRisk = riskLevel === RiskLevel.RED;
  const isMediumRisk = riskLevel === RiskLevel.YELLOW;

  const weeklyPlan = isHighRisk
    ? [
        { day: '周一', activity: '散步（平地）', duration: '20分钟', intensity: '低' },
        { day: '周二', activity: '休息/拉伸', duration: '10分钟', intensity: '低' },
        { day: '周三', activity: '散步或八段锦', duration: '20分钟', intensity: '低' },
        { day: '周四', activity: '休息', duration: '-', intensity: '-' },
        { day: '周五', activity: '散步', duration: '20分钟', intensity: '低' },
        { day: '周六', activity: '太极拳/舒缓操', duration: '25分钟', intensity: '低' },
        { day: '周日', activity: '休息', duration: '-', intensity: '-' },
      ]
    : isMediumRisk
      ? [
          { day: '周一', activity: '快走', duration: '30分钟', intensity: '中' },
          { day: '周二', activity: '弹力带抗阻训练', duration: '20分钟', intensity: '中' },
          { day: '周三', activity: '快走或骑车', duration: '30分钟', intensity: '中' },
          { day: '周四', activity: '拉伸与平衡训练', duration: '15分钟', intensity: '低' },
          { day: '周五', activity: '快走', duration: '30分钟', intensity: '中' },
          { day: '周六', activity: '游泳/骑车（选一）', duration: '40分钟', intensity: '中' },
          { day: '周日', activity: '散步放松', duration: '20分钟', intensity: '低' },
        ]
      : [
          { day: '周一', activity: '快走/慢跑', duration: '40分钟', intensity: '中' },
          { day: '周二', activity: '哑铃/自重抗阻', duration: '30分钟', intensity: '中' },
          { day: '周三', activity: '骑车或游泳', duration: '40分钟', intensity: '中' },
          { day: '周四', activity: '抗阻训练', duration: '30分钟', intensity: '中' },
          { day: '周五', activity: '快走', duration: '40分钟', intensity: '中' },
          { day: '周六', activity: '有氧运动（任选）', duration: '50分钟', intensity: '中' },
          { day: '周日', activity: '拉伸与放松', duration: '20分钟', intensity: '低' },
        ];

  return {
    summary: isHighRisk
      ? '建议在医生指导下从低强度运动开始，每周累计约90分钟'
      : isMediumRisk
        ? '建议每周至少150分钟中等强度有氧运动，配合2次抗阻训练'
        : '建议每周至少150分钟中等强度有氧运动，配合2–3次抗阻训练，维持代谢健康',
    weeklyPlan,
    precautions: [
      '运动前监测血糖，<5.6 mmol/L时适量加餐，>16.7 mmol/L暂缓运动',
      '避免空腹剧烈运动，防止低血糖',
      '穿合适鞋袜，运动后检查足部',
      '出现胸痛、气短、头晕时应停止运动并及时就医',
      '高血压未控制者避免憋气用力动作',
    ],
  };
};

export const getIndicatorEducation = (itemIds: string[]): IndicatorEdu[] => {
  const order = new Map(CORE_INDICATOR_EDUCATION_IDS.map((id, index) => [id, index]));
  const uniqueIds = [...new Set(itemIds)];
  uniqueIds.sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
  return uniqueIds
    .map((id) => INDICATOR_EDUCATION[id])
    .filter((e): e is IndicatorEdu => !!e);
};
