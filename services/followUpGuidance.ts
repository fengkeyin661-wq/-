import type { HealthArchive } from './dataService';
import {
  buildFollowUpContext,
  filterPriorityFocusItems,
  resolvePriorityFocusForArchive,
} from './followUpLinkageService';

export interface FollowUpStaffCue {
  focusItem: string;
  askScript: string;
  recordHint: string;
}

export interface FollowUpUserStep {
  id: string;
  title: string;
  detail: string;
  kind: 'prepare' | 'action' | 'contact' | 'metric';
}

export interface FollowUpGuidanceBundle {
  sourceLabel: string;
  priorityFocusItems: string[];
  staffCues: FollowUpStaffCue[];
  userSteps: FollowUpUserStep[];
  staffOpeningHint: string;
  userPrepSummary: string;
}

const cueForFocusItem = (item: string): Omit<FollowUpStaffCue, 'focusItem'> => {
  const t = item.toLowerCase();
  if (/血压|bp|收缩|舒张/.test(t)) {
    return {
      askScript: '最近 7 天在家测过血压吗？请说大致数值（如 135/85），有无头晕、头痛？',
      recordHint: '记录测量频次、典型数值、症状；未测则约定本周测 3 天并回传。',
    };
  }
  if (/血糖|glucose|hba1c|糖化/.test(t)) {
    return {
      askScript: '空腹血糖最近测过吗？数值多少？饮食、运动有没有按方案调整？',
      recordHint: '记录空腹/餐后血糖、用药与饮食执行情况。',
    };
  }
  if (/血脂|胆固醇|ldl|hdl|tg|tc/.test(t)) {
    return {
      askScript: '上次建议的复查血脂做了吗？结果是否已出？目前饮食控油情况如何？',
      recordHint: '记录是否复查、结果摘要；未查则明确预约时间与注意事项。',
    };
  }
  if (/体重|bmi|肥胖|腰围/.test(t)) {
    return {
      askScript: '最近体重有变化吗？一周运动几次、每次大约多久？',
      recordHint: '记录当前体重/腰围、运动频次；未达标则共拟 1 条可执行小目标。',
    };
  }
  if (/药|服药|用药/.test(t)) {
    return {
      askScript: '处方药是否按时服用？有无漏服、自行停药或不良反应？',
      recordHint: '记录药名、依从性、不良反应；必要时建议门诊复诊调药。',
    };
  }
  if (/复查|检查|超声|ct|化验/.test(t)) {
    return {
      askScript: `关于「${item}」，是否已预约或完成？结果如何？`,
      recordHint: '记录完成日期、结果要点；未完成则协助预约并写入下次随访。',
    };
  }
  return {
    askScript: `想跟您核对「${item}」：最近执行情况怎么样？有没有困难需要我们协助？`,
    recordHint: '记录患者反馈、障碍与 agreed 的下一步（1 条即可）。',
  };
};

export const buildFollowUpGuidance = (archive: HealthArchive | null | undefined): FollowUpGuidanceBundle => {
  if (!archive) {
    return {
      sourceLabel: '',
      priorityFocusItems: [],
      staffCues: [],
      userSteps: [],
      staffOpeningHint: '',
      userPrepSummary: '',
    };
  }

  const ctx = buildFollowUpContext(archive);
  const priorityFocusItems = resolvePriorityFocusForArchive(archive);
  const pending = ctx.pendingSchedule;
  const overdue = (archive.follow_up_schedule || []).some((s) => s.status === 'overdue');

  const staffCues: FollowUpStaffCue[] = priorityFocusItems.map((focusItem) => ({
    focusItem,
    ...cueForFocusItem(focusItem),
  }));

  for (const task of ctx.failedTasks.slice(0, 2)) {
    const label = `补做：${task.description}`;
    if (staffCues.some((c) => c.focusItem.includes(task.description))) continue;
    staffCues.push({
      focusItem: label,
      askScript: `上次约定的「${task.description}」还没完全做到，最近有尝试吗？卡在哪一步？`,
      recordHint: '记录原因与本次承诺；录入时标记任务达标情况。',
    });
  }

  const userSteps: FollowUpUserStep[] = [];
  let stepId = 0;
  const pushUser = (step: Omit<FollowUpUserStep, 'id'>) => {
    userSteps.push({ ...step, id: `us-${stepId++}` });
  };

  if (pending?.date) {
    pushUser({
      kind: 'prepare',
      title: overdue ? '随访已逾期，请尽快联系管家' : `请在 ${pending.date} 前完成本期配合事项`,
      detail: ctx.sourceLabel ? `随访类型：${ctx.sourceLabel}` : '按下方清单逐项准备，随访电话会更高效。',
    });
  }

  for (const item of priorityFocusItems.slice(0, 4)) {
    const cue = cueForFocusItem(item);
    pushUser({
      kind: 'action',
      title: item,
      detail: `请提前想好：${cue.askScript.replace(/？.*$/, '的情况')}（可在首页更新相关指标）`,
    });
  }

  if (ctx.failedTasks.length) {
    pushUser({
      kind: 'action',
      title: '优先落实上期未达标项',
      detail: ctx.failedTasks
        .slice(0, 2)
        .map((t) => t.description)
        .join('；'),
    });
  }

  const nextPlan =
    filterPriorityFocusItems(
      ctx.priorRecord?.assessment?.adjustedFocusItems ||
        (ctx.priorRecord?.assessment?.nextCheckPlan
          ? [ctx.priorRecord.assessment.nextCheckPlan]
          : [])
    )[0] || archive.assessment_data?.followUpPlan?.nextCheckItems?.[0];

  if (userSteps.length < 4 && nextPlan) {
    pushUser({
      kind: 'prepare',
      title: '复查/化验准备',
      detail: String(nextPlan).slice(0, 120),
    });
  }

  pushUser({
    kind: 'metric',
    title: '在首页「更新数据」记录近期指标',
    detail: '血压、血糖、体重等测完后录入，便于管家对比趋势。',
  });

  pushUser({
    kind: 'contact',
    title: '有疑问随时联系健康管理服务电话',
    detail: '随访前准备好体检报告、化验单与正在服用的药物清单。',
  });

  const name = archive.name || archive.health_record?.profile?.name || '老师';
  const staffOpeningHint = `您好，我是健康管理师，关于${name}老师${pending?.date ? ` ${pending.date} ` : ''}的${ctx.sourceLabel || '健康管理随访'}，想逐项核对 ${priorityFocusItems.length || '本期'} 个重点，大约 5–10 分钟，您现在方便吗？`;

  const userPrepSummary =
    priorityFocusItems.length > 0
      ? `本期请您重点配合：${priorityFocusItems.slice(0, 3).join('、')}${priorityFocusItems.length > 3 ? ' 等' : ''}`
      : '请按执行单完成生活方式调整，并在首页更新近期指标。';

  return {
    sourceLabel: ctx.sourceLabel,
    priorityFocusItems,
    staffCues,
    userSteps: userSteps.slice(0, 6),
    staffOpeningHint,
    userPrepSummary,
  };
};
