import type { HealthArchive } from './dataService';
import {
  buildFollowUpContext,
  resolvePriorityFocusForArchive,
} from './followUpLinkageService';
import { buildSupervisionBrief } from './followUpSupervisionService';

export interface FollowUpUserStep {
  id: string;
  title: string;
  detail: string;
  kind: 'prepare' | 'action' | 'contact' | 'metric';
}

export interface FollowUpGuidanceBundle {
  sourceLabel: string;
  priorityFocusItems: string[];
  userSteps: FollowUpUserStep[];
  userPrepSummary: string;
}

/** 用户端第一人称：针对单项重点，我该做什么 */
export const userSelfGuideForFocusItem = (item: string): string => {
  const t = item.toLowerCase();
  if (/血压|bp|收缩|舒张/.test(t)) {
    return '我这周在家多测几次血压，记下典型数值；如有头晕、头痛一并记下，测完可在首页更新。';
  }
  if (/血糖|glucose|hba1c|糖化/.test(t)) {
    return '我按计划测空腹或餐后血糖，并留意饮食、运动是否跟上方案。';
  }
  if (/血脂|胆固醇|ldl|hdl|tg|tc/.test(t)) {
    return '我按建议安排血脂复查，结果出来后保存好；日常饮食继续控油。';
  }
  if (/体重|bmi|肥胖|腰围/.test(t)) {
    return '我定期称体重（或量腰围），并坚持每周运动，小步调整即可。';
  }
  if (/药|服药|用药/.test(t)) {
    return '我按医嘱按时服药，不自行停药；如有不适或漏服，记下来方便说明。';
  }
  if (/复查|检查|超声|ct|化验/.test(t)) {
    return `关于「${item}」，我尽快预约或完成检查，并把结果收好。`;
  }
  return `「${item}」是我这期的重点，我按方案执行；有困难我会主动联系健康管理团队。`;
};

export const buildFollowUpGuidance = (archive: HealthArchive | null | undefined): FollowUpGuidanceBundle => {
  if (!archive) {
    return {
      sourceLabel: '',
      priorityFocusItems: [],
      userSteps: [],
      userPrepSummary: '',
    };
  }

  const ctx = buildFollowUpContext(archive);
  const brief = buildSupervisionBrief(archive);
  const priorityFocusItems = brief.riskFocusLines.length
    ? brief.riskFocusLines
    : resolvePriorityFocusForArchive(archive);
  const pending = ctx.pendingSchedule;
  const overdue = (archive.follow_up_schedule || []).some((s) => s.status === 'overdue');
  const pendingAbn = brief.abnormalityTracks.filter((a) => a.status === 'pending');

  const userSteps: FollowUpUserStep[] = [];
  let stepId = 0;
  const pushUser = (step: Omit<FollowUpUserStep, 'id'>) => {
    userSteps.push({ ...step, id: `us-${stepId++}` });
  };

  if (pendingAbn.length) {
    pushUser({
      kind: 'action',
      title: '我跟进体检异常项的复测或检查',
      detail: pendingAbn
        .slice(0, 3)
        .map((a) => a.item)
        .join('、'),
    });
  }

  if (priorityFocusItems.length) {
    pushUser({
      kind: 'action',
      title: '我留意这期的风险重点',
      detail: priorityFocusItems.slice(0, 3).join('、'),
    });
  } else if (pending?.date) {
    pushUser({
      kind: 'prepare',
      title: overdue ? '我的随访日期已过' : `在 ${pending.date} 前完成配合事项`,
      detail: '我对照健康管理方案自检，并准备好必要的化验单。',
    });
  }

  pushUser({
    kind: 'metric',
    title: '我把与风险相关的指标记到首页',
    detail: brief.metricSlots.map((s) => s.label).join('、') || '血压、体重等',
  });

  pushUser({
    kind: 'action',
    title: '我对照方案给自己打个分',
    detail: '饮食、运动等整体是否跟上，心里有个数，随访沟通会更高效。',
  });

  const userPrepSummary =
    priorityFocusItems.length > 0
      ? `我这期先把精力放在：${priorityFocusItems.slice(0, 3).join('、')}${priorityFocusItems.length > 3 ? ' 等' : ''}`
      : '我按执行单调整生活，并把最近指标更新到首页。';

  return {
    sourceLabel: ctx.sourceLabel,
    priorityFocusItems,
    userSteps: userSteps.slice(0, 4),
    userPrepSummary,
  };
};
