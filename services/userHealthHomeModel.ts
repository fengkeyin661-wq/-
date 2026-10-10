import type { HealthAssessment, ScheduledFollowUp } from '../types';
import type { HealthArchive } from './dataService';
import {
  buildFollowUpContext,
  filterPriorityFocusItems,
  normalizeFocusItemKey,
} from './followUpLinkageService';
import {
  buildFollowUpGuidance,
  userSelfGuideForFocusItem,
  type FollowUpUserStep,
} from './followUpGuidance';

export type UserHomeActionKind =
  | 'metrics'
  | 'followup'
  | 'plan'
  | 'record'
  | 'message'
  | 'assistant'
  | 'tel';

export type UserHomeActionTier = 'urgent' | 'primary' | 'routine';

export interface UserHomeNextAction {
  id: string;
  title: string;
  description?: string;
  action: UserHomeActionKind;
  priority: number;
  tier: UserHomeActionTier;
}

export interface UserHomeFocusItem {
  text: string;
  severity: 'red' | 'yellow' | 'focus';
}

export interface UserHealthHomeModel {
  nextFollowUp: ScheduledFollowUp | null;
  hasOverdueFollowUp: boolean;
  followUpSourceLabel: string;
  /** 本期随访应核对的重点（与管家端随访上下文一致） */
  followUpFocusItems: string[];
  /** 本周配合步骤（与管家端指引一致） */
  followUpUserSteps: FollowUpUserStep[];
  followUpPrepSummary: string;
  focusHighlights: UserHomeFocusItem[];
  nextActions: UserHomeNextAction[];
  primaryActions: UserHomeNextAction[];
  routineActions: UserHomeNextAction[];
  hasAssessment: boolean;
}

const dedupeActionsByTitle = (actions: UserHomeNextAction[]): UserHomeNextAction[] => {
  const seen = new Set<string>();
  const out: UserHomeNextAction[] = [];
  for (const a of actions) {
    const key = normalizeFocusItemKey(a.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
};

export const pickNextFollowUp = (schedule: ScheduledFollowUp[] | undefined): ScheduledFollowUp | null => {
  const list = (schedule || []).filter((x) => x.status === 'pending' || x.status === 'overdue');
  if (!list.length) return null;
  return [...list].sort((a, b) => a.date.localeCompare(b.date))[0];
};

export const buildUserHealthHomeModel = (archive: HealthArchive | null | undefined): UserHealthHomeModel => {
  const assessment: HealthAssessment | undefined = archive?.assessment_data;
  const hasAssessment = Boolean(assessment?.riskLevel);
  const nextFollowUp = pickNextFollowUp(archive?.follow_up_schedule);
  const hasOverdueFollowUp = (archive?.follow_up_schedule || []).some((x) => x.status === 'overdue');

  const focusHighlights: UserHomeFocusItem[] = [];
  if (assessment?.risks?.red?.length) {
    for (const text of assessment.risks.red.slice(0, 5)) {
      focusHighlights.push({ text, severity: 'red' });
    }
  }
  if (assessment?.risks?.yellow?.length) {
    for (const text of assessment.risks.yellow.slice(0, 3)) {
      focusHighlights.push({ text, severity: 'yellow' });
    }
  }
  const followCtx = archive ? buildFollowUpContext(archive) : null;
  const followUpSourceLabel = followCtx?.sourceLabel || '';
  const followUpFocusItems = filterPriorityFocusItems(followCtx?.focusItems || []).slice(0, 5);
  const guidance = archive ? buildFollowUpGuidance(archive) : null;
  const followUpUserSteps = (guidance?.userSteps || []).slice(0, 5);
  const followUpPrepSummary = guidance?.userPrepSummary || '';

  const nextActions: UserHomeNextAction[] = [];
  let actionIdx = 0;
  const pushAction = (
    item: Omit<UserHomeNextAction, 'id' | 'priority'>,
    priority: number
  ) => {
    nextActions.push({
      ...item,
      id: `action-${actionIdx++}`,
      priority,
    });
  };

  if (!hasAssessment) {
    pushAction(
      {
        title: '联系健康管家完善档案',
        description: '完成体检建档与评估后，首页将展示个性化健康指引。',
        action: 'tel',
        tier: 'urgent',
      },
      0
    );
    nextActions.sort((a, b) => a.priority - b.priority);
    return {
      nextFollowUp,
      hasOverdueFollowUp,
      followUpSourceLabel,
      followUpFocusItems,
      followUpUserSteps,
      followUpPrepSummary,
      focusHighlights,
      nextActions,
      primaryActions: nextActions,
      routineActions: [],
      hasAssessment,
    };
  }

  const isHighRisk = assessment?.riskLevel === 'RED' || assessment?.isCritical;
  const criticalTrack = followCtx?.criticalTrack;

  if (criticalTrack && criticalTrack.status !== 'archived') {
    pushAction(
      {
        title: `危急值跟进：${criticalTrack.critical_item || '重点指标'}`,
        description: criticalTrack.critical_desc?.slice(0, 60) || '这项指标需要我尽快按方案跟进',
        action: 'followup',
        tier: 'urgent',
      },
      0
    );
  }

  if (hasOverdueFollowUp && nextFollowUp) {
    pushAction(
      {
        title: '我的随访日期已过',
        description: `原计划 ${nextFollowUp.date}，我先完成下面几项再联系健康管理团队`,
        action: 'followup',
        tier: 'urgent',
      },
      5
    );
  }

  for (const task of followCtx?.failedTasks || []) {
    pushAction(
      {
        title: `我这周补做：${task.description}`,
        description: '上次没完全做到，我从这项开始',
        action: 'plan',
        tier: 'primary',
      },
      12
    );
  }

  for (const item of followUpFocusItems.slice(0, 4)) {
    pushAction(
      {
        title: item,
        description: userSelfGuideForFocusItem(item),
        action: 'followup',
        tier: 'primary',
      },
      15
    );
  }

  const focusKeys = new Set(followUpFocusItems.map(normalizeFocusItemKey));
  const keyTasks = (assessment?.structuredTasks || []).filter((t) => t.isKeyGoal).slice(0, 3);
  for (const task of keyTasks) {
    const key = normalizeFocusItemKey(task.description);
    if (focusKeys.has(key)) continue;
    pushAction(
      {
        title: task.description,
        description: task.frequency ? `关键目标 · ${task.frequency}` : '评估关键目标',
        action: 'plan',
        tier: 'primary',
      },
      22
    );
  }

  if (nextFollowUp && !hasOverdueFollowUp && followUpFocusItems.length === 0) {
    pushAction(
      {
        title: '查看我的下阶段执行单',
        description: `我的随访安排在 ${nextFollowUp.date}`,
        action: 'followup',
        tier: 'primary',
      },
      25
    );
  }

  const monitoring = assessment?.managementPlan?.monitoring || [];
  const monitoringLimit = isHighRisk ? 1 : 0;
  for (const line of monitoring.slice(0, monitoringLimit)) {
    if (focusKeys.has(normalizeFocusItemKey(line))) continue;
    pushAction(
      {
        title: line,
        description: '持续监测',
        action: 'metrics',
        tier: 'routine',
      },
      40
    );
  }

  const followups = [...(archive?.follow_ups || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const latestGoals = followups[0]?.assessment?.lifestyleGoals || [];
  if (nextActions.filter((a) => a.tier !== 'routine').length < 4) {
    for (const goal of latestGoals.slice(0, 1)) {
      pushAction(
        {
          title: goal,
          description: '生活方式目标',
          action: 'plan',
          tier: 'routine',
        },
        45
      );
    }
  }

  const tips = archive?.custom_daily_plan?.tips?.trim();
  if (tips && nextActions.length < 5) {
    pushAction(
      {
        title: '今日健康提示',
        description: tips.length > 60 ? `${tips.slice(0, 60)}…` : tips,
        action: 'plan',
        tier: 'routine',
      },
      50
    );
  }

  const nextCheck = assessment?.followUpPlan?.nextCheckItems || [];
  if (nextCheck.length && !nextFollowUp && followUpFocusItems.length === 0) {
    pushAction(
      {
        title: '按计划完成复查',
        description: nextCheck.slice(0, 2).join('、'),
        action: 'record',
        tier: 'primary',
      },
      28
    );
  }

  const sorted = dedupeActionsByTitle(nextActions).sort((a, b) => a.priority - b.priority);
  const primaryActions = sorted.filter((a) => a.tier === 'urgent' || a.tier === 'primary').slice(0, 4);
  const routineActions = sorted.filter((a) => a.tier === 'routine').slice(0, 3);

  return {
    nextFollowUp,
    hasOverdueFollowUp,
    followUpSourceLabel,
    followUpFocusItems,
    followUpUserSteps,
    followUpPrepSummary,
    focusHighlights,
    nextActions: sorted,
    primaryActions,
    routineActions,
    hasAssessment,
  };
};
