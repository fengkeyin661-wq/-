import type { HealthAssessment, ScheduledFollowUp } from '../types';
import type { HealthArchive } from './dataService';

export type UserHomeActionKind =
  | 'metrics'
  | 'followup'
  | 'plan'
  | 'record'
  | 'message'
  | 'assistant'
  | 'tel';

export interface UserHomeNextAction {
  id: string;
  title: string;
  description?: string;
  action: UserHomeActionKind;
  priority: number;
}

export interface UserHomeFocusItem {
  text: string;
  severity: 'red' | 'yellow' | 'focus';
}

export interface UserHealthHomeModel {
  nextFollowUp: ScheduledFollowUp | null;
  hasOverdueFollowUp: boolean;
  focusHighlights: UserHomeFocusItem[];
  nextActions: UserHomeNextAction[];
  hasAssessment: boolean;
}

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
  const nextActions: UserHomeNextAction[] = [];
  let actionIdx = 0;
  const pushAction = (item: Omit<UserHomeNextAction, 'id' | 'priority'>, priority: number) => {
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
      },
      0
    );
    nextActions.sort((a, b) => a.priority - b.priority);
    return { nextFollowUp, hasOverdueFollowUp, focusHighlights, nextActions, hasAssessment };
  }

  if (hasOverdueFollowUp && nextFollowUp) {
    pushAction(
      {
        title: '尽快完成随访核对',
        description: `原定随访日期 ${nextFollowUp.date}，请主动联系健康管家。`,
        action: 'followup',
      },
      0
    );
  } else if (nextFollowUp) {
    pushAction(
      {
        title: '查看下阶段健康管理执行单',
        description: `下次随访：${nextFollowUp.date}`,
        action: 'followup',
      },
      10
    );
  }

  const keyTasks = (assessment?.structuredTasks || []).filter((t) => t.isKeyGoal).slice(0, 3);
  for (const task of keyTasks) {
    pushAction(
      {
        title: task.description,
        description: task.frequency ? `频率：${task.frequency}` : undefined,
        action: 'plan',
      },
      20
    );
  }

  const monitoring = assessment?.managementPlan?.monitoring || [];
  for (const line of monitoring.slice(0, 2)) {
    pushAction(
      {
        title: line,
        description: '请按方案持续监测',
        action: 'metrics',
      },
      30
    );
  }

  const followups = [...(archive?.follow_ups || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const latestGoals = followups[0]?.assessment?.lifestyleGoals || [];
  for (const goal of latestGoals.slice(0, 2)) {
    pushAction(
      {
        title: goal,
        description: '生活方式干预目标',
        action: 'plan',
      },
      35
    );
  }

  const tips = archive?.custom_daily_plan?.tips?.trim();
  if (tips) {
    pushAction(
      {
        title: '今日健康提示',
        description: tips.length > 80 ? `${tips.slice(0, 80)}…` : tips,
        action: 'plan',
      },
      40
    );
  }

  const nextCheck = assessment?.followUpPlan?.nextCheckItems || [];
  if (nextCheck.length && !nextFollowUp) {
    pushAction(
      {
        title: '按计划完成复查项目',
        description: nextCheck.slice(0, 3).join('、'),
        action: 'record',
      },
      50
    );
  }

  pushAction(
    {
      title: '查看完整健康档案与方案',
      description: assessment?.summary?.slice(0, 60) || '体检指标与专属管理方案',
      action: 'record',
    },
    90
  );

  nextActions.sort((a, b) => a.priority - b.priority);
  return { nextFollowUp, hasOverdueFollowUp, focusHighlights, nextActions, hasAssessment };
};
