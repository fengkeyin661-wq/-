export type SurveyQuestion = {
  id: string;
  label: string;
  options?: string[];
  multi?: boolean;
  text?: boolean;
  number?: boolean;
  hint?: string;
  otherId?: string;
  moreId?: string;
};

export type SurveySection = {
  key: string;
  title: string;
  note?: string;
  questions: SurveyQuestion[];
};

export type DoorServiceItem = {
  id: string;
  label: string;
  freqOptions: string[];
  timeOptions: string[];
};

export const NEED_SURVEY_HASH = '#/need-survey';
export const NEED_SURVEY_VERSION = '2026-v1';
export const NEED_SURVEY_BATCH = '正式调查-2026';

export const SURVEY_REQUIRED_IDS = [
  'A1',
  'A2',
  'A4',
  'A5',
  'A7',
  'B1',
  'B5',
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'C7',
  'C8',
  'C9',
  'C10',
];

export const surveySections: SurveySection[] = [
  {
    key: 'A',
    title: '家庭与居住情况',
    questions: [
      { id: 'A1', label: '受访者年龄', options: ['＜50岁', '50—59岁', '60—69岁', '70—79岁', '80—89岁', '≥90岁'] },
      { id: 'A2', label: '与郑州大学关系', options: ['在职教职工', '离退休教职工', '配偶', '父母', '其他家属'] },
      { id: 'A3', label: '居住楼栋或片区', text: true, hint: '仅填写楼栋或片区，不记录详细门牌号' },
      { id: 'A4', label: '常住成员', options: ['独居', '夫妻二人', '与子女同住', '与父母同住', '多代同住', '其他'] },
      { id: 'A5', label: '家庭类型', options: ['非空巢', '空巢但子女在郑州', '空巢且子女在外地', '独居', '不确定'] },
      {
        id: 'A6',
        label: '居住条件（可多选）',
        multi: true,
        options: ['有电梯', '无电梯1—3层', '无电梯4层及以上', '室内存在明显台阶', '卫生间已适老化'],
      },
      { id: 'A7', label: '紧急联系人到达时间', options: ['≤15分钟', '16—30分钟', '31—60分钟', '＞60分钟', '无人可及时到达'] },
    ],
  },
  {
    key: 'B',
    title: '主要照护者和可用时间',
    questions: [
      {
        id: 'B1',
        label: '当前是否需要他人照护',
        options: ['不需要', '偶尔需要', '每天需要不足2小时', '每天需要2—4小时', '每天需要4小时以上', '全天照护'],
      },
      { id: 'B2', label: '主要照护者', options: ['配偶', '子女', '其他亲属', '保姆或护工', '社区服务人员', '暂无固定照护者'] },
      { id: 'B3', label: '照护者工作日可用时间', options: ['白天均可', '仅上午', '仅下午', '仅晚间', '不固定', '基本无时间'] },
      { id: 'B4', label: '照护者周末可用时间', options: ['全天', '半天', '零散时间', '基本无时间'] },
      { id: 'B5', label: '近3个月照护压力', options: ['无', '较轻', '一般', '较重', '非常重'] },
      { id: 'B6', label: '当前最难解决的照护问题', text: true },
    ],
  },
  {
    key: 'C',
    title: '健康与功能风险筛查',
    note: '由本人或熟悉情况的家属回答。选择有风险仅表示需要进一步评估，不等同于医疗诊断。',
    questions: [
      { id: 'C1', label: '是否被医生诊断患有高血压、糖尿病、冠心病、脑卒中、慢阻肺、肿瘤等慢性病', options: ['无', '1种', '2种', '≥3种', '不清楚'] },
      { id: 'C2', label: '洗澡、穿衣、如厕、床椅转移、进食、室内行走是否需要帮助', options: ['全部独立', '1—2项需帮助', '≥3项需帮助'] },
      { id: 'C3', label: '近6个月是否出现明显记忆下降、迷路、重复提问或影响生活的判断困难', options: ['无', '偶尔', '经常', '已确诊'] },
      { id: 'C4', label: '过去12个月是否跌倒', options: ['0次', '1次', '≥2次', '曾造成骨折或住院'] },
      { id: 'C5', label: '近3个月是否食欲明显下降或非主动体重下降', options: ['无', '有其一', '两项均有', '不清楚'] },
      { id: 'C6', label: '目前每天长期服用的药物种类', options: ['0—2种', '3—4种', '≥5种', '不清楚'] },
      { id: 'C7', label: '近1个月是否漏服、重复服药、不会使用器械或出现疑似药物不良反应', options: ['无', '偶尔', '经常', '不清楚'] },
      { id: 'C8', label: '近2周是否持续情绪低落、明显焦虑或睡眠问题影响白天生活', options: ['无', '偶尔', '经常', '不愿回答'] },
      { id: 'C9', label: '当前自评健康', options: ['很好', '较好', '一般', '较差', '很差'] },
      {
        id: 'C10',
        label: '是否有近期需要尽快处理的健康问题',
        text: true,
        hint: '没有请填“无”。如有胸痛、呼吸困难、意识改变或活动性出血，请立即拨打120。',
      },
    ],
  },
  {
    key: 'D',
    title: '过去12个月医疗、康复和陪诊',
    questions: [
      { id: 'D1', label: '普通门诊次数', options: ['0', '1—2', '3—5', '6次以上'] },
      { id: 'D2', label: '急诊次数', options: ['0', '1', '2', '3次以上'] },
      { id: 'D3', label: '住院次数', options: ['0', '1', '2', '3次以上'] },
      { id: 'D4', label: '康复治疗次数', options: ['0', '1—5', '6—12', '12次以上'] },
      { id: 'D5', label: '陪诊或代办次数', options: ['0', '1—2', '3—5', '6次以上'] },
      {
        id: 'D6',
        label: '最近一次就医最主要困难（可多选）',
        multi: true,
        options: ['挂号', '交通', '院内路线', '候诊', '取药检查', '无人陪同', '出院后无人衔接', '费用', '无困难'],
      },
      { id: 'D7', label: '出院后是否需要康复或护理', options: ['未住院', '不需要', '需要但已解决', '需要但未充分解决'] },
      { id: 'D8', label: '是否因行动不便或无人陪同而放弃就医', options: ['从未', '偶尔', '多次'] },
      {
        id: 'D9',
        label: '最希望中心帮助衔接的医院或科室',
        options: ['郑州大学医院', '郑大一附院', '郑大二附院', '其他'],
        otherId: 'D9_other',
      },
      { id: 'D10', label: '一次典型就医经历中最需要改善的环节', text: true },
    ],
  },
  {
    key: 'E',
    title: '教职工健康服务中心使用情况',
    questions: [
      { id: 'E1', label: '是否知道中心', options: ['不知道', '听说过但不了解', '了解但未使用', '使用过'] },
      {
        id: 'E2',
        label: '过去12个月使用科室或服务（可多选）',
        multi: true,
        options: ['未使用', '体检', '中医康复', '眼科干眼', '内科全科', '健康咨询', '其他'],
        otherId: 'E2_other',
      },
      { id: 'E3', label: '最近一次体验', options: ['很满意', '较满意', '一般', '较不满意', '很不满意', '未使用'] },
      {
        id: 'E4',
        label: '未使用或未复购原因（可多选）',
        multi: true,
        options: ['没有需要', '不知道项目', '时间不便', '价格不清', '项目不匹配', '对能力不了解', '更习惯去大医院', '其他'],
      },
      { id: 'E5', label: '最希望中心增加或改进的服务', text: true },
      { id: 'E6', label: '过去12个月使用中心的频次', options: ['0次', '1次', '2—3次', '4—6次', '7次以上'] },
      { id: 'E7', label: '向同事或家属推荐中心的意愿', options: ['非常愿意', '比较愿意', '一般', '不太愿意', '完全不愿意'] },
      { id: 'E8', label: '最方便到中心的时间', options: ['工作日上午', '工作日下午', '工作日晚间', '周末', '不固定'] },
      {
        id: 'E9',
        label: '最常用的信息渠道',
        options: ['工会通知', '微信群或公众号', '校医院', '同事介绍', '社区宣传', '其他'],
        otherId: 'E9_other',
      },
    ],
  },
  {
    key: 'F',
    title: '上门服务需求与频次',
    note: '请逐项判断未来12个月是否可能需要。医疗项目能否上门以及收费方式，以资质、评估、医嘱和批准标准为准。',
    questions: [
      { id: 'F11', label: '可接受预约提前量', options: ['当天', '提前1天', '提前2—3天', '提前1周'] },
      { id: 'F12', label: '可接受的到达时间浮动', options: ['±15分钟', '±30分钟', '±60分钟', '需严格准时'] },
      { id: 'F13', label: '是否接受首次上门前进行风险评估', options: ['接受', '视项目而定', '不接受', '不清楚'] },
    ],
  },
  {
    key: 'G',
    title: '价格敏感度与支付方式',
    note: '以下仅用于测算支付意愿，不代表中心最终收费。医疗收费须执行批准的医疗服务价格。',
    questions: [
      {
        id: 'G1',
        label: '30分钟上门健康评估或随访可接受自付价格',
        options: ['≤30元', '31—50元', '51—80元', '81—120元', '可更高'],
        moreId: 'G1_more',
      },
      {
        id: 'G2',
        label: '60分钟上门康复指导可接受自付价格',
        options: ['≤100元', '101—150元', '151—200元', '201—300元', '可更高'],
        moreId: 'G2_more',
      },
      {
        id: 'G3',
        label: '半日陪诊与就医协助可接受自付价格',
        options: ['≤150元', '151—250元', '251—350元', '351—500元', '可更高'],
        moreId: 'G3_more',
      },
      {
        id: 'G4',
        label: '单次助浴或移位照护可接受自付价格',
        options: ['≤120元', '121—180元', '181—260元', '261—350元', '可更高'],
        moreId: 'G4_more',
      },
      {
        id: 'G5',
        label: '月度健康管理服务包可接受自付价格',
        options: ['≤199元', '200—399元', '400—699元', '700—999元', '可更高'],
        moreId: 'G5_more',
      },
      { id: 'G6a', label: '低到让您担心服务质量的价格（元/月）', number: true },
      { id: 'G6b', label: '您认为比较划算的价格（元/月）', number: true },
      { id: 'G6c', label: '价格较高但仍可能购买的价格（元/月）', number: true },
      { id: 'G6d', label: '高到肯定不会购买的价格（元/月）', number: true },
      {
        id: 'G7',
        label: '优先支付方式（可多选）',
        multi: true,
        options: ['按次自付', '月度套餐', '年度会员', '单位福利补贴', '医保或长护险', '商业保险', '子女代付'],
      },
      { id: 'G8', label: '若学校或工会补贴部分费用，使用意愿', options: ['明显提高', '略有提高', '不受影响', '仍不会使用'] },
      { id: 'G9', label: '家庭中通常由谁决定购买服务', options: ['本人', '配偶', '子女', '共同决定', '其他照护者'] },
      { id: 'G10', label: '家庭中通常由谁支付', options: ['本人', '配偶', '子女', '共同承担', '单位或保险'] },
      { id: 'G11', label: '更容易接受的计费方式', options: ['项目一口价', '按服务时长', '基础费加项目费', '套餐内限次', '不清楚'] },
      {
        id: 'G12',
        label: '价格公示中最需要明确（可多选）',
        multi: true,
        options: ['服务内容', '人员资质', '服务时长', '耗材费用', '取消规则', '退款规则', '保险责任'],
      },
      { id: 'G13', label: '其他支付条件或建议', text: true },
    ],
  },
  {
    key: 'H',
    title: '服务方式信任与安全偏好',
    questions: [
      { id: 'H1', label: '首选服务入口', options: ['电话', '微信小程序或公众号', '中心现场', '家属代约', '楼栋联络员'] },
      {
        id: 'H2',
        label: '首次上门最看重（可多选）',
        multi: true,
        options: ['人员身份可核验', '医院或学校背书', '专业资质', '价格透明', '固定服务人员', '家属同步', '保险保障'],
      },
      { id: 'H3', label: '是否接受双人上门', options: ['接受', '高风险项目才需要', '不接受', '无所谓'] },
      { id: 'H4', label: '是否接受服务过程定位和电子记录', options: ['接受', '仅接受定位', '仅接受记录', '不接受'] },
      { id: 'H5', label: '是否允许向指定家属同步结果', options: ['允许全部', '仅异常情况', '逐次授权', '不允许'] },
      { id: 'H6', label: '对男性或女性服务人员的偏好', options: ['无偏好', '优先女性', '优先男性', '视服务项目而定'] },
      { id: 'H7', label: '对固定人员连续服务额外支付意愿', options: ['不愿额外支付', '可增加5%', '可增加10%', '可增加20%以上'] },
      { id: 'H8', label: '发生异常时的首选处置', options: ['先联系家属', '先联系中心医生', '直接拨打120', '由服务人员按预案判断'] },
      { id: 'H9', label: '对上门服务最担心的问题', text: true },
      { id: 'H10', label: '其他意见或建议', text: true },
    ],
  },
];

export const doorServices: DoorServiceItem[] = [
  { id: 'F1', label: '健康评估与慢病随访', freqOptions: ['单次', '每月', '每季度'], timeOptions: ['上午', '下午', '晚间', '周末'] },
  { id: 'F2', label: '用药核对与健康指导', freqOptions: ['单次', '每月', '按需'], timeOptions: ['上午', '下午', '晚间', '周末'] },
  { id: 'F3', label: '康复评估与训练指导', freqOptions: ['每周', '每月', '按疗程'], timeOptions: ['上午', '下午', '晚间', '周末'] },
  { id: 'F4', label: '采血等居家医疗护理', freqOptions: ['单次', '每月', '按医嘱'], timeOptions: ['上午', '下午', '周末'] },
  { id: 'F5', label: '陪诊与就医协助', freqOptions: ['单次', '每月', '按需'], timeOptions: ['工作日', '周末'] },
  { id: 'F6', label: '助浴、移位等生活照护', freqOptions: ['每周', '每月', '按需'], timeOptions: ['上午', '下午', '周末'] },
  { id: 'F7', label: '认知照护与家属培训', freqOptions: ['每周', '每月', '按课程'], timeOptions: ['上午', '下午', '晚间', '周末'] },
  { id: 'F8', label: '家庭适老化与跌倒预防', freqOptions: ['单次评估', '复查'], timeOptions: ['上午', '下午', '周末'] },
  { id: 'F9', label: '营养评估与膳食指导', freqOptions: ['单次', '每月', '每季度'], timeOptions: ['上午', '下午', '晚间', '周末'] },
  { id: 'F10', label: '照护者喘息与支持', freqOptions: ['每周', '每月', '按需'], timeOptions: ['白天', '晚间', '周末'] },
];

export const NEED_OPTIONS = ['不需要', '可能', '明确需要'] as const;

export type SurveyAnswers = Record<string, unknown>;

export type NeedSurveyRiskLevel = '普通健康管理' | '重点关注' | '专业照护' | '需尽快评估';

export function computeNeedSurveyRisk(a: SurveyAnswers): NeedSurveyRiskLevel {
  const c10 = String(a.C10 || '').trim();
  if (c10 && c10 !== '无') return '需尽快评估';
  let s = 0;
  if (['2种', '≥3种'].includes(String(a.C1 || ''))) s += 1;
  if (a.C2 === '1—2项需帮助') s += 2;
  if (a.C2 === '≥3项需帮助') s += 4;
  if (['经常', '已确诊'].includes(String(a.C3 || ''))) s += 3;
  if (a.C4 === '≥2次') s += 2;
  if (a.C4 === '曾造成骨折或住院') s += 3;
  if (['有其一', '两项均有'].includes(String(a.C5 || ''))) s += 1;
  if (a.C6 === '≥5种' || a.C7 === '经常') s += 1;
  if (['较重', '非常重'].includes(String(a.B5 || ''))) s += 2;
  if (s >= 6) return '专业照护';
  if (s >= 3) return '重点关注';
  return '普通健康管理';
}

export function doorServicePriorities(a: SurveyAnswers): string[] {
  return doorServices.filter((s) => a[`${s.id}_need`] === '明确需要').map((s) => s.label);
}

export function isNeedSurveyHash(hash = typeof window !== 'undefined' ? window.location.hash : ''): boolean {
  return hash === NEED_SURVEY_HASH || hash.startsWith('#/need-survey');
}

export function getNeedSurveyShareUrl(): string {
  if (typeof window === 'undefined') return NEED_SURVEY_HASH;
  return `${window.location.origin}${window.location.pathname}${NEED_SURVEY_HASH}`;
}

export function openNeedSurvey(): void {
  if (typeof window === 'undefined') return;
  window.location.hash = '/need-survey';
}

export function closeNeedSurvey(): void {
  if (typeof window === 'undefined') return;
  if (!isNeedSurveyHash()) return;
  const next = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', next);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function isAnswerFilled(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function missingRequiredIds(a: SurveyAnswers, ids: string[]): string[] {
  return ids.filter((id) => !isAnswerFilled(a[id]));
}
