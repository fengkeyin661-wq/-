/**
 * 随访电话沟通话术模板（健康管理师/随访人员参考）
 */

export type FollowUpTalkScenario = 'routine' | 'critical_initial' | 'critical_secondary';

export interface FollowUpTalkSection {
  id: string;
  title: string;
  tips: string[];
}

export interface FollowUpTalkScript {
  scenario: FollowUpTalkScenario;
  label: string;
  sections: FollowUpTalkSection[];
}

const OPENING: FollowUpTalkSection = {
  id: 'opening',
  title: '开场与身份确认',
  tips: [
    '您好，我是郑州大学医院健康管理中心的健康管理师××，请问是××先生/女士吗？',
    '今天给您来电，是关于近期体检/健康管理的随访沟通，大概需要 5–10 分钟，您现在方便接听吗？',
    '不便时请预约回电时间，并记录在随访备注中。',
  ],
};

const RAPPORT: FollowUpTalkSection = {
  id: 'rapport',
  title: '建立信任',
  tips: [
    '先简要说明随访目的：了解近期身体情况，协助落实健康管理建议，不是推销。',
    '语气平和、语速适中；对方焦虑时先安抚，再进入具体问题。',
    '避免指责式提问（如「您怎么又不测血糖」），改为「最近测血糖方便吗？有没有遇到困难？」',
  ],
};

const CHECK_COMPLIANCE: FollowUpTalkSection = {
  id: 'compliance',
  title: '核对执行情况',
  tips: [
    '对照「本期核对清单」逐项询问：复查是否已完成、用药是否规律、生活方式调整落实情况。',
    '对上期未达标任务：先肯定已做到的部分，再一起找原因和可行改法。',
    '询问近期有无不适、住院、新增药物或过敏情况。',
  ],
};

const INDICATORS: FollowUpTalkSection = {
  id: 'indicators',
  title: '指标与结果沟通',
  tips: [
    '用通俗语言解释关键指标含义，避免堆砌医学术语。',
    '有改善时及时肯定；变差时聚焦「下一步可做的事」，避免引起恐慌。',
    '需要就医时明确告知：建议尽快到××科室就诊，并说明大致时限。',
  ],
};

const CLOSING: FollowUpTalkSection = {
  id: 'closing',
  title: '收尾与约定',
  tips: [
    '小结本次沟通的 1–3 个行动点，确认对方听清并认可。',
    '告知下次随访/复查时间，必要时发送短信提醒。',
    '留下咨询电话，欢迎随时联系；感谢配合并礼貌结束通话。',
  ],
};

const CRITICAL_INITIAL: FollowUpTalkSection = {
  id: 'critical_notify',
  title: '危急值初次通知要点',
  tips: [
    '开门见山、态度沉稳：体检发现××指标异常，属于需要尽快关注的情况。',
    '说明已报告的异常项目及建议处理方向（复查/急诊/专科），不夸大也不淡化。',
    '确认对方是否已听清，是否方便尽快就医；记录反馈与下一步计划。',
    '提醒携带身份证与体检报告；如症状加重（胸痛、气促、意识改变等）请立即急诊。',
  ],
};

const CRITICAL_SECONDARY: FollowUpTalkSection = {
  id: 'critical_follow',
  title: '危急值二次回访要点',
  tips: [
    '询问是否已按建议就诊/复查，结果如何，目前有无不适。',
    '若未就医：了解障碍（时间、费用、认知），协助预约或再次强调风险。',
    '若已就医：记录诊断与医嘱，衔接日常随访与健康管理方案。',
    '确认是否需要转入常规随访或继续跟踪。',
  ],
};

export const resolveFollowUpTalkScenario = (sourceLabel?: string | null): FollowUpTalkScenario => {
  const label = sourceLabel || '';
  if (label.includes('危急值') && (label.includes('初次') || label.includes('通知'))) {
    return 'critical_initial';
  }
  if (label.includes('危急值') || label.includes('二次')) {
    return 'critical_secondary';
  }
  return 'routine';
};

export const getFollowUpTalkScript = (scenario: FollowUpTalkScenario): FollowUpTalkScript => {
  if (scenario === 'critical_initial') {
    return {
      scenario,
      label: '危急值初次通知',
      sections: [OPENING, CRITICAL_INITIAL, RAPPORT, CLOSING],
    };
  }
  if (scenario === 'critical_secondary') {
    return {
      scenario,
      label: '危急值二次回访',
      sections: [OPENING, CRITICAL_SECONDARY, CHECK_COMPLIANCE, CLOSING],
    };
  }
  return {
    scenario: 'routine',
    label: '常规随访',
    sections: [OPENING, RAPPORT, CHECK_COMPLIANCE, INDICATORS, CLOSING],
  };
};
