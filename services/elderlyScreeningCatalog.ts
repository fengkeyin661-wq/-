/** 老年专项评估 — CGA 八域 + 主流量表定义（筛查用途，题干为临床常用表述） */

export type ElderlyDomainId =
  | 'checkup'
  | 'function'
  | 'cognition'
  | 'emotion'
  | 'nutrition'
  | 'sensory'
  | 'oral'
  | 'sleep'
  | 'screening';

export interface ElderlyDomainDef {
  id: ElderlyDomainId;
  label: string;
  sortOrder: number;
  description: string;
}

export const ELDERLY_DOMAINS: ElderlyDomainDef[] = [
  { id: 'checkup', label: '客观指标', sortOrder: 1, description: '血压、BMI、血糖、血脂、肾功能等体检指标' },
  { id: 'function', label: '躯体与功能', sortOrder: 2, description: '日常生活能力、工具性活动、步速与跌倒风险' },
  { id: 'cognition', label: '认知功能', sortOrder: 3, description: '认知筛查（Mini-Cog）' },
  { id: 'emotion', label: '情绪心理', sortOrder: 4, description: '抑郁、焦虑与孤独感筛查' },
  { id: 'nutrition', label: '营养状态', sortOrder: 5, description: 'MNA-SF 营养筛查' },
  { id: 'sensory', label: '感官功能', sortOrder: 6, description: '视力、听力自评与 HHIE-S' },
  { id: 'oral', label: '口腔健康', sortOrder: 7, description: '咀嚼、牙列与进食影响' },
  { id: 'sleep', label: '睡眠', sortOrder: 8, description: 'ISI 失眠严重度' },
  { id: 'screening', label: '衰弱·骨骼·社会', sortOrder: 9, description: 'FRAIL、OSTA、社会网络 LSNS-6' },
];

export interface ScaleOption {
  value: number;
  label: string;
}

export interface ScaleItemDef {
  id: string;
  label: string;
  options: ScaleOption[];
}

export interface ScaleCutoff {
  level: string;
  label: string;
  min?: number;
  max?: number;
}

export type ElderlyScaleId =
  | 'barthel'
  | 'lawton'
  | 'morse'
  | 'miniCog'
  | 'gds15'
  | 'phq9'
  | 'gad7'
  | 'ucla3'
  | 'mnaSf'
  | 'hhieS'
  | 'gohai'
  | 'isi'
  | 'frail'
  | 'lsns6';

export interface ScaleDefinition {
  id: ElderlyScaleId;
  name: string;
  domain: ElderlyDomainId;
  itemCount: number;
  maxScore: number;
  items: ScaleItemDef[];
  cutoffs: ScaleCutoff[];
  clinicalMeaning: string;
  retestCycle: string;
  disclaimer: string;
}

const yesNo01: ScaleOption[] = [
  { value: 0, label: '否' },
  { value: 1, label: '是' },
];

const phqOptions: ScaleOption[] = [
  { value: 0, label: '完全不会' },
  { value: 1, label: '好几天' },
  { value: 2, label: '一半以上天数' },
  { value: 3, label: '几乎每天' },
];

const isiOptions: ScaleOption[] = [
  { value: 0, label: '无' },
  { value: 1, label: '轻度' },
  { value: 2, label: '中度' },
  { value: 3, label: '重度' },
  { value: 4, label: '极重度' },
];

const hhieOptions: ScaleOption[] = [
  { value: 0, label: '否' },
  { value: 2, label: '有时' },
  { value: 4, label: '是' },
];

const lsnsOptions: ScaleOption[] = [
  { value: 0, label: '0 人' },
  { value: 1, label: '1 人' },
  { value: 2, label: '2 人' },
  { value: 3, label: '3–4 人' },
  { value: 4, label: '5–8 人' },
  { value: 5, label: '≥9 人' },
  { value: 6, label: '≥9 人且可依靠' },
];

const barthelItem = (id: string, label: string, opts: ScaleOption[]): ScaleItemDef => ({ id, label, options: opts });

const barthelGraded = (levels: [number, string][]): ScaleOption[] =>
  levels.map(([value, label]) => ({ value, label }));

export const ELDERLY_SCALES: ScaleDefinition[] = [
  {
    id: 'barthel',
    name: 'Barthel 指数（ADL）',
    domain: 'function',
    itemCount: 10,
    maxScore: 100,
    clinicalMeaning: '评估基本日常生活自理能力，分数越低依赖程度越高',
    retestCycle: '每 3–6 个月或功能状态变化时',
    disclaimer: '筛查工具，不能替代临床功能评估',
    cutoffs: [
      { level: 'severe', label: '重度依赖（≤40）', max: 40 },
      { level: 'moderate', label: '中度依赖（41–60）', min: 41, max: 60 },
      { level: 'mild', label: '轻度依赖（61–99）', min: 61, max: 99 },
      { level: 'independent', label: '独立（100）', min: 100, max: 100 },
    ],
    items: [
      barthelItem('feeding', '进食', barthelGraded([[0, '完全依赖'], [5, '需部分帮助'], [10, '独立']])),
      barthelItem('bathing', '洗澡', barthelGraded([[0, '完全依赖'], [5, '独立']])),
      barthelItem('grooming', '修饰（洗脸、梳头、刷牙）', barthelGraded([[0, '完全依赖'], [5, '独立']])),
      barthelItem('dressing', '穿衣', barthelGraded([[0, '完全依赖'], [5, '需部分帮助'], [10, '独立']])),
      barthelItem('bowels', '大便控制', barthelGraded([[0, '失禁'], [5, '偶尔失禁'], [10, '能控制']])),
      barthelItem('bladder', '小便控制', barthelGraded([[0, '失禁'], [5, '偶尔失禁'], [10, '能控制']])),
      barthelItem('toilet', '如厕', barthelGraded([[0, '完全依赖'], [5, '需部分帮助'], [10, '独立']])),
      barthelItem('transfer', '床椅转移', barthelGraded([[0, '完全依赖'], [5, '需大量帮助'], [10, '需少量帮助'], [15, '独立']])),
      barthelItem('mobility', '平地行走', barthelGraded([[0, '不能'], [5, '轮椅独立'], [10, '需一人搀扶'], [15, '独立≥45m']])),
      barthelItem('stairs', '上下楼梯', barthelGraded([[0, '不能'], [5, '需帮助'], [10, '独立']])),
    ],
  },
  {
    id: 'lawton',
    name: 'Lawton IADL',
    domain: 'function',
    itemCount: 8,
    maxScore: 8,
    clinicalMeaning: '评估工具性日常生活能力，反映社区独立生活能力',
    retestCycle: '每 6 个月',
    disclaimer: '筛查工具，不能替代临床功能评估',
    cutoffs: [
      { level: 'impaired', label: '明显受损（≤5）', max: 5 },
      { level: 'partial', label: '部分受损（6–7）', min: 6, max: 7 },
      { level: 'independent', label: '基本独立（8）', min: 8, max: 8 },
    ],
    items: [
      { id: 'phone', label: '使用电话', options: yesNo01 },
      { id: 'shopping', label: '购物', options: yesNo01 },
      { id: 'food', label: '准备食物', options: yesNo01 },
      { id: 'housekeeping', label: '家务维持', options: yesNo01 },
      { id: 'laundry', label: '洗衣', options: yesNo01 },
      { id: 'transport', label: '交通方式使用', options: yesNo01 },
      { id: 'medication', label: '按时服药', options: yesNo01 },
      { id: 'finance', label: '管理财务', options: yesNo01 },
    ],
  },
  {
    id: 'morse',
    name: 'Morse 跌倒量表',
    domain: 'function',
    itemCount: 6,
    maxScore: 125,
    clinicalMeaning: '评估住院/社区老年人跌倒风险',
    retestCycle: '每 3 个月或跌倒事件后',
    disclaimer: '筛查工具，需结合环境评估',
    cutoffs: [
      { level: 'low', label: '低风险（0–24）', max: 24 },
      { level: 'medium', label: '中风险（25–50）', min: 25, max: 50 },
      { level: 'high', label: '高风险（≥51）', min: 51 },
    ],
    items: [
      { id: 'fallHistory', label: '近3个月有无跌倒史', options: [{ value: 0, label: '无' }, { value: 25, label: '有' }] },
      { id: 'secondaryDx', label: '是否有第二诊断（≥2种疾病）', options: [{ value: 0, label: '无' }, { value: 15, label: '有' }] },
      { id: 'ambulatoryAid', label: '行走辅助', options: [{ value: 0, label: '无/卧床/护士协助' }, { value: 15, label: '拐杖/手杖/助行器' }, { value: 30, label: '扶家具行走' }] },
      { id: 'ivTherapy', label: '静脉输液/肝素锁', options: [{ value: 0, label: '无' }, { value: 20, label: '有' }] },
      { id: 'gait', label: '步态', options: [{ value: 0, label: '正常/卧床/轮椅' }, { value: 10, label: '虚弱' }, { value: 20, label: '受损' }] },
      { id: 'mental', label: '认知状态', options: [{ value: 0, label: '了解自身能力' }, { value: 15, label: '高估/忘记限制' }] },
    ],
  },
  {
    id: 'miniCog',
    name: 'Mini-Cog',
    domain: 'cognition',
    itemCount: 2,
    maxScore: 5,
    clinicalMeaning: '快速认知筛查，≤2 分提示需进一步神经心理评估',
    retestCycle: '每 12 个月或认知主诉时',
    disclaimer: '筛查阳性需 MoCA/MMSE 等进一步评估',
    cutoffs: [
      { level: 'positive', label: '阳性（≤2）', max: 2 },
      { level: 'borderline', label: '边界（3）', min: 3, max: 3 },
      { level: 'negative', label: '阴性（4–5）', min: 4, max: 5 },
    ],
    items: [
      { id: 'recall', label: '3 词延迟回忆（正确词数）', options: [0, 1, 2, 3].map((v) => ({ value: v, label: `${v} 个词` })) },
      { id: 'clock', label: '画钟试验', options: [{ value: 0, label: '不能/错误' }, { value: 1, label: '部分正确' }, { value: 2, label: '完全正确' }] },
    ],
  },
  {
    id: 'gds15',
    name: 'GDS-15 老年抑郁量表',
    domain: 'emotion',
    itemCount: 15,
    maxScore: 15,
    clinicalMeaning: '老年抑郁筛查，≥5 提示可能抑郁，≥10 需进一步评估',
    retestCycle: '每 3–6 个月',
    disclaimer: '筛查工具，不能替代精神科诊断',
    cutoffs: [
      { level: 'normal', label: '正常（0–4）', max: 4 },
      { level: 'mild', label: '轻度（5–9）', min: 5, max: 9 },
      { level: 'moderate', label: '中度（10–14）', min: 10, max: 14 },
      { level: 'severe', label: '重度（15）', min: 15, max: 15 },
    ],
    items: [
      { id: 'g1', label: '对生活基本满意吗？', options: [{ value: 0, label: '是' }, { value: 1, label: '否' }] },
      { id: 'g2', label: '是否放弃许多活动和兴趣？', options: yesNo01 },
      { id: 'g3', label: '是否觉得生活空虚？', options: yesNo01 },
      { id: 'g4', label: '是否常感到无聊？', options: yesNo01 },
      { id: 'g5', label: '是否多数时间精神好？', options: [{ value: 0, label: '是' }, { value: 1, label: '否' }] },
      { id: 'g6', label: '是否担心有不好的事情发生？', options: yesNo01 },
      { id: 'g7', label: '是否多数时间感到快乐？', options: [{ value: 0, label: '是' }, { value: 1, label: '否' }] },
      { id: 'g8', label: '是否常感到无助？', options: yesNo01 },
      { id: 'g9', label: '是否宁愿待在家里而不外出？', options: yesNo01 },
      { id: 'g10', label: '是否觉得记忆力比多数人差？', options: yesNo01 },
      { id: 'g11', label: '是否觉得活着很精彩？', options: [{ value: 0, label: '是' }, { value: 1, label: '否' }] },
      { id: 'g12', label: '是否觉得现在毫无价值？', options: yesNo01 },
      { id: 'g13', label: '是否感到精力充足？', options: [{ value: 0, label: '是' }, { value: 1, label: '否' }] },
      { id: 'g14', label: '是否觉得现在处境毫无希望？', options: yesNo01 },
      { id: 'g15', label: '是否觉得多数人比您过得好？', options: yesNo01 },
    ],
  },
  {
    id: 'phq9',
    name: 'PHQ-9',
    domain: 'emotion',
    itemCount: 9,
    maxScore: 27,
    clinicalMeaning: '抑郁症状筛查，与主问卷共用计分规则',
    retestCycle: '每 3–6 个月',
    disclaimer: '筛查工具，≥15 需紧急关注自伤风险',
    cutoffs: [
      { level: 'minimal', label: '无/轻微（0–4）', max: 4 },
      { level: 'mild', label: '轻度（5–9）', min: 5, max: 9 },
      { level: 'moderate', label: '中度（10–14）', min: 10, max: 14 },
      { level: 'severe', label: '重度（≥15）', min: 15 },
    ],
    items: [
      { id: 'p1', label: '做事时提不起劲或没有乐趣', options: phqOptions },
      { id: 'p2', label: '感到心情低落、沮丧或绝望', options: phqOptions },
      { id: 'p3', label: '入睡困难、睡不安或睡得过多', options: phqOptions },
      { id: 'p4', label: '感到疲倦或没有活力', options: phqOptions },
      { id: 'p5', label: '食欲不振或吃太多', options: phqOptions },
      { id: 'p6', label: '觉得自己很糟或让家人失望', options: phqOptions },
      { id: 'p7', label: '注意力难以集中', options: phqOptions },
      { id: 'p8', label: '动作或说话变慢，或相反坐立不安', options: phqOptions },
      { id: 'p9', label: '有不如死掉或用某种方式伤害自己的念头', options: phqOptions },
    ],
  },
  {
    id: 'gad7',
    name: 'GAD-7',
    domain: 'emotion',
    itemCount: 7,
    maxScore: 21,
    clinicalMeaning: '广泛性焦虑筛查',
    retestCycle: '每 3–6 个月',
    disclaimer: '筛查工具，不能替代精神科诊断',
    cutoffs: [
      { level: 'minimal', label: '无/轻微（0–4）', max: 4 },
      { level: 'mild', label: '轻度（5–9）', min: 5, max: 9 },
      { level: 'moderate', label: '中度（10–14）', min: 10, max: 14 },
      { level: 'severe', label: '重度（≥15）', min: 15 },
    ],
    items: [
      { id: 'a1', label: '感觉紧张、焦虑或急切', options: phqOptions },
      { id: 'a2', label: '不能停止或控制担忧', options: phqOptions },
      { id: 'a3', label: '对各种各样的事情担忧过多', options: phqOptions },
      { id: 'a4', label: '很难放松下来', options: phqOptions },
      { id: 'a5', label: '由于不安而无法静坐', options: phqOptions },
      { id: 'a6', label: '变得容易烦恼或急躁', options: phqOptions },
      { id: 'a7', label: '感到似乎将有可怕的事情发生', options: phqOptions },
    ],
  },
  {
    id: 'ucla3',
    name: 'UCLA 孤独量表（3 项简版）',
    domain: 'emotion',
    itemCount: 3,
    maxScore: 9,
    clinicalMeaning: '评估孤独感与社会连接主观体验',
    retestCycle: '每 6 个月',
    disclaimer: '自评筛查',
    cutoffs: [
      { level: 'low', label: '低（3–5）', max: 5 },
      { level: 'moderate', label: '中等（6–7）', min: 6, max: 7 },
      { level: 'high', label: '高（8–9）', min: 8, max: 9 },
    ],
    items: [
      { id: 'u1', label: '您多久感到与周围人缺乏陪伴？', options: [1, 2, 3].map((v) => ({ value: v, label: ['很少', '有时', '经常'][v - 1] })) },
      { id: 'u2', label: '您多久感到被排除在外？', options: [1, 2, 3].map((v) => ({ value: v, label: ['很少', '有时', '经常'][v - 1] })) },
      { id: 'u3', label: '您多久感到与人疏远？', options: [1, 2, 3].map((v) => ({ value: v, label: ['很少', '有时', '经常'][v - 1] })) },
    ],
  },
  {
    id: 'mnaSf',
    name: 'MNA-SF 微型营养评估',
    domain: 'nutrition',
    itemCount: 6,
    maxScore: 14,
    clinicalMeaning: '老年营养风险筛查，≤11 需营养干预评估',
    retestCycle: '每 3–6 个月',
    disclaimer: '筛查工具，不能替代营养师评估',
    cutoffs: [
      { level: 'malnutrition', label: '营养不良（≤7）', max: 7 },
      { level: 'at_risk', label: '营养风险（8–11）', min: 8, max: 11 },
      { level: 'normal', label: '营养正常（12–14）', min: 12, max: 14 },
    ],
    items: [
      { id: 'm1', label: '近3个月食欲下降、消化问题、咀嚼或吞咽困难导致进食减少？', options: [{ value: 0, label: '严重食欲下降' }, { value: 1, label: '轻度下降' }, { value: 2, label: '无下降' }] },
      { id: 'm2', label: '近3个月体重下降情况', options: [{ value: 0, label: '下降>3kg' }, { value: 1, label: '不知道' }, { value: 2, label: '下降1–3kg' }, { value: 3, label: '无下降' }] },
      { id: 'm3', label: '活动能力', options: [{ value: 0, label: '卧床或轮椅' }, { value: 1, label: '能离床但不能外出' }, { value: 2, label: '能外出' }] },
      { id: 'm4', label: '近3个月是否遭受心理创伤或急性疾病？', options: [{ value: 0, label: '是' }, { value: 2, label: '否' }] },
      { id: 'm5', label: '精神心理问题', options: [{ value: 0, label: '严重痴呆或抑郁' }, { value: 1, label: '轻度痴呆' }, { value: 2, label: '无' }] },
      { id: 'm6', label: 'BMI 或小腿围（BMI<19 或 男小腿围<31/女<29 为 0 分）', options: [{ value: 0, label: '低于切点' }, { value: 1, label: '临界' }, { value: 2, label: '正常' }, { value: 3, label: 'BMI≥23' }] },
    ],
  },
  {
    id: 'hhieS',
    name: 'HHIE-S 听力障碍筛查',
    domain: 'sensory',
    itemCount: 10,
    maxScore: 40,
    clinicalMeaning: '评估听力损失对生活的心理社会影响',
    retestCycle: '每 12 个月',
    disclaimer: '筛查工具，需 audiometry 确认',
    cutoffs: [
      { level: 'none', label: '无显著影响（0–8）', max: 8 },
      { level: 'mild', label: '轻度（10–24）', min: 10, max: 24 },
      { level: 'significant', label: '显著（≥26）', min: 26 },
    ],
    items: Array.from({ length: 10 }, (_, i) => ({
      id: `h${i + 1}`,
      label: `听力问题是否导致：${['因听不清而沮丧', '因听不清而回避聚会', '因听不清而看电视/听广播困难', '因听不清而限制社交', '因听不清而感到尴尬', '因听不清而影响与亲友关系', '因听不清而需他人重复', '因听不清而影响个人事务', '因听不清而限制与邻居交往', '因听不清而影响与配偶/家人'][i]}？`,
      options: hhieOptions,
    })),
  },
  {
    id: 'gohai',
    name: '简化 GOHAI 口腔健康',
    domain: 'oral',
    itemCount: 5,
    maxScore: 15,
    clinicalMeaning: '评估口腔健康对进食与生活质量的影响',
    retestCycle: '每 12 个月',
    disclaimer: '筛查工具，需口腔专科检查',
    cutoffs: [
      { level: 'good', label: '良好（≥12）', min: 12 },
      { level: 'fair', label: '一般（8–11）', min: 8, max: 11 },
      { level: 'poor', label: '较差（≤7）', max: 7 },
    ],
    items: [
      { id: 'o1', label: '能否舒适地咀嚼硬质食物？', options: [{ value: 3, label: '能' }, { value: 2, label: '有时困难' }, { value: 1, label: '不能' }] },
      { id: 'o2', label: '是否因口腔问题限制食物种类？', options: [{ value: 3, label: '否' }, { value: 2, label: '有时' }, { value: 1, label: '是' }] },
      { id: 'o3', label: '是否因口腔问题感到进食不适或疼痛？', options: [{ value: 3, label: '否' }, { value: 2, label: '有时' }, { value: 1, label: '是' }] },
      { id: 'o4', label: '是否因牙齿/假牙问题影响美观或自信？', options: [{ value: 3, label: '否' }, { value: 2, label: '有时' }, { value: 1, label: '是' }] },
      { id: 'o5', label: '是否使用药物缓解口腔干燥或疼痛？', options: [{ value: 3, label: '否' }, { value: 2, label: '有时' }, { value: 1, label: '是' }] },
    ],
  },
  {
    id: 'isi',
    name: 'ISI 失眠严重指数量表',
    domain: 'sleep',
    itemCount: 7,
    maxScore: 28,
    clinicalMeaning: '评估失眠严重程度',
    retestCycle: '每 3–6 个月',
    disclaimer: '筛查工具，≥22 建议睡眠专科评估',
    cutoffs: [
      { level: 'none', label: '无临床失眠（0–7）', max: 7 },
      { level: 'mild', label: '轻度（8–14）', min: 8, max: 14 },
      { level: 'moderate', label: '中度（15–21）', min: 15, max: 21 },
      { level: 'severe', label: '重度（22–28）', min: 22, max: 28 },
    ],
    items: [
      { id: 'i1', label: '入睡困难', options: isiOptions },
      { id: 'i2', label: '维持睡眠困难', options: isiOptions },
      { id: 'i3', label: '过早醒来', options: isiOptions },
      { id: 'i4', label: '对当前睡眠模式满意度', options: isiOptions },
      { id: 'i5', label: '睡眠问题对日间功能影响', options: isiOptions },
      { id: 'i6', label: '他人注意到睡眠问题影响生活质量', options: isiOptions },
      { id: 'i7', label: '对睡眠问题的担忧/困扰', options: isiOptions },
    ],
  },
  {
    id: 'frail',
    name: 'FRAIL 量表',
    domain: 'screening',
    itemCount: 5,
    maxScore: 5,
    clinicalMeaning: '快速衰弱筛查：3–4 前期衰弱，5 衰弱',
    retestCycle: '每 6 个月',
    disclaimer: '筛查工具，需结合临床评估',
    cutoffs: [
      { level: 'robust', label: '健壮（0–2）', max: 2 },
      { level: 'prefrail', label: '前期衰弱（3–4）', min: 3, max: 4 },
      { level: 'frail', label: '衰弱（5）', min: 5, max: 5 },
    ],
    items: [
      { id: 'f1', label: 'Fatigue：过去4周多数日子感到疲劳', options: yesNo01 },
      { id: 'f2', label: 'Resistance：上10级台阶有困难', options: yesNo01 },
      { id: 'f3', label: 'Ambulation：步行约1个街区有困难', options: yesNo01 },
      { id: 'f4', label: 'Illness：医生告知有≥5种疾病', options: yesNo01 },
      { id: 'f5', label: 'Loss of weight：近1年体重下降>5%', options: yesNo01 },
    ],
  },
  {
    id: 'lsns6',
    name: 'LSNS-6 社会网络量表',
    domain: 'screening',
    itemCount: 6,
    maxScore: 30,
    clinicalMeaning: '评估社会支持网络，<12 提示社会隔离风险',
    retestCycle: '每 6–12 个月',
    disclaimer: '自评筛查',
    cutoffs: [
      { level: 'isolated', label: '社会隔离风险（<12）', max: 11 },
      { level: 'adequate', label: '网络尚可（≥12）', min: 12 },
    ],
    items: [
      { id: 'l1', label: '有多少亲属您能看到或听到？', options: lsnsOptions },
      { id: 'l2', label: '有多少亲属您可以倾诉？', options: lsnsOptions },
      { id: 'l3', label: '有多少亲属您可得到帮助？', options: lsnsOptions },
      { id: 'l4', label: '有多少朋友您能看到或听到？', options: lsnsOptions },
      { id: 'l5', label: '有多少朋友您可以倾诉？', options: lsnsOptions },
      { id: 'l6', label: '有多少朋友您可得到帮助？', options: lsnsOptions },
    ],
  },
];

export const getScaleById = (id: ElderlyScaleId): ScaleDefinition | undefined =>
  ELDERLY_SCALES.find((s) => s.id === id);

export const getScalesForDomain = (domain: ElderlyDomainId): ScaleDefinition[] =>
  ELDERLY_SCALES.filter((s) => s.domain === domain);

export const ELDERLY_ASSESSMENT_VERSION = '2' as const;

export const ELDERLY_CLINICAL_DISCLAIMER =
  '本模块量表均为健康管理筛查工具，不能替代临床诊断与专科评估。';
