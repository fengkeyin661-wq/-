import React, { useEffect, useMemo, useState } from 'react';
import type { HealthAssessment, HealthRecord } from '../../types';
import type { HealthArchive } from '../../services/dataService';
import {
  buildUserHealthHomeModel,
  type UserHomeActionKind,
  type UserHomeNextAction,
} from '../../services/userHealthHomeModel';
import {
  HEALTH_MANAGEMENT_HOTLINE,
  HEALTH_MANAGEMENT_HOTLINE_TEL,
} from '../../services/userServiceCatalog';
import { fetchLatestAssessmentRun } from '../../services/assessmentPipelineService';
import { UserRiskHeroBanner } from './UserRiskHeroBanner';
import { VirtualHealthAssistant } from './VirtualHealthAssistant';
import { HealthTrendCharts } from '../HealthTrendCharts';
import { HighGlucoseTag } from '../HighGlucoseTag';
import { HighBloodPressureTag } from '../HighBloodPressureTag';
import { HighLipidTag } from '../HighLipidTag';
import { UserMetricEntryModal } from './UserMetricEntryModal';
import type { UserMetricKey } from '../../services/observationMapper';

export type UserProfileSubView = 'menu' | 'record' | 'followup' | 'plan';

interface Props {
  archive: HealthArchive | null;
  record?: HealthRecord;
  assessment?: HealthAssessment;
  userName?: string;
  onRefresh?: () => void;
  onUpdateRecord?: (payload: {
    metric: UserMetricKey;
    values: Record<string, number | string>;
    measuredAt: string;
  }) => Promise<void>;
  onNavigateTab: (tab: string) => void;
  onOpenProfileSubView: (sub: UserProfileSubView) => void;
  onOpenLogin?: () => void;
}

export const UserHealthHome: React.FC<Props> = ({
  archive,
  record,
  assessment,
  userName = '访客',
  onRefresh,
  onUpdateRecord,
  onNavigateTab,
  onOpenProfileSubView,
  onOpenLogin,
}) => {
  const [view, setView] = useState<'dashboard' | 'assistant'>('dashboard');
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [metricModalOpen, setMetricModalOpen] = useState(false);
  const [recomputeHint, setRecomputeHint] = useState<string | null>(null);

  const checkupId = archive?.checkup_id;
  const model = useMemo(() => buildUserHealthHomeModel(archive), [archive]);

  useEffect(() => {
    if (!checkupId) {
      setRecomputeHint(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const run = await fetchLatestAssessmentRun(checkupId);
      if (cancelled || !run) return;
      if (run.status === 'running' || run.status === 'pending') {
        setRecomputeHint('健康评估更新中，请稍候刷新…');
      } else if (run.status === 'failed') {
        setRecomputeHint('最近一次自动评估失败，请联系健康管家');
      } else {
        setRecomputeHint(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkupId, archive?.updated_at, archive?.draft_data?.generatedAt]);

  const handleAction = (action: UserHomeActionKind) => {
    switch (action) {
      case 'metrics':
        setMetricModalOpen(true);
        break;
      case 'followup':
        onOpenProfileSubView('followup');
        onNavigateTab('profile');
        break;
      case 'plan':
        onOpenProfileSubView('plan');
        onNavigateTab('profile');
        break;
      case 'record':
        onOpenProfileSubView('record');
        onNavigateTab('profile');
        break;
      case 'message':
        onNavigateTab('message');
        break;
      case 'assistant':
        setView('assistant');
        break;
      case 'tel':
        window.location.href = HEALTH_MANAGEMENT_HOTLINE_TEL;
        break;
      default:
        break;
    }
  };

  if (!archive || !record) {
    return (
      <div className="min-h-full animate-fadeIn bg-slate-50 p-6 pb-32">
        <h1 className="text-2xl font-black text-slate-800">健康首页</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          登录并绑定体检档案后，将优先展示风险评估、需关注重点与下一步健康计划。
        </p>
        <button
          type="button"
          onClick={() => (onOpenLogin ? onOpenLogin() : onNavigateTab('profile'))}
          className="mt-6 w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white shadow-md hover:bg-teal-700"
        >
          前往登录 / 绑定档案
        </button>
        <a
          href={HEALTH_MANAGEMENT_HOTLINE_TEL}
          className="mt-4 block rounded-xl border border-teal-200 bg-teal-50 py-3 text-center text-sm font-bold text-teal-800"
        >
          健康管理服务 {HEALTH_MANAGEMENT_HOTLINE}
        </a>
      </div>
    );
  }

  if (view === 'assistant') {
    return (
      <div className="min-h-full animate-fadeIn bg-slate-50 pb-32">
        <div className="sticky top-0 z-20 border-b border-slate-100 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setView('dashboard')}
            className="flex items-center gap-1 text-sm font-bold text-slate-600 hover:text-teal-600"
          >
            <span>←</span> 返回首页
          </button>
        </div>
        <div className="border-b border-slate-100 bg-white px-6 py-4">
          <h1 className="text-xl font-black text-slate-800">智能问答助手</h1>
          <p className="mt-1 text-xs text-slate-500">结合档案解读体检与健康问题，不能替代线下就诊</p>
        </div>
        <VirtualHealthAssistant userName={userName} fullPage record={record} assessment={assessment} />
      </div>
    );
  }

  const c = record.checkup;
  const hba1c = c.labBasic?.hba1c ?? c.optional?.hba1c;
  const abi =
    c.optional?.arteriosclerosis?.abi ??
    c.optional?.arteriosclerosis?.rightABI ??
    c.optional?.arteriosclerosis?.leftABI;
  const bodyFatRate = c.bodyComposition?.bodyFatRate ?? record.riskModelExtras?.bodyFatRate;

  return (
    <div className="min-h-full animate-fadeIn bg-slate-50 pb-32">
      {(assessment?.isCritical || assessment?.criticalWarning) && (
        <div className="border-b border-red-300 bg-red-600 px-4 py-3 text-white">
          <p className="text-sm font-bold">⚠️ {assessment.criticalWarning || '存在危急或重大异常，请尽快联系健康管家或就医'}</p>
          <a href={HEALTH_MANAGEMENT_HOTLINE_TEL} className="mt-2 inline-block text-xs font-bold underline">
            立即拨打 {HEALTH_MANAGEMENT_HOTLINE}
          </a>
        </div>
      )}

      <div className="space-y-4 p-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">你好，{record.profile.name}</h1>
          <p className="text-xs text-slate-500">以下为您当前最需要关注的健康信息</p>
        </div>

        <UserRiskHeroBanner assessment={assessment} />

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">核心指标</h2>
            {onUpdateRecord ? (
              <button
                type="button"
                onClick={() => setMetricModalOpen(true)}
                className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700"
              >
                更新数据
              </button>
            ) : null}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <HighGlucoseTag record={record} />
            <HighBloodPressureTag record={record} />
            <HighLipidTag record={record} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'BMI', value: c.basics.bmi || '-' },
              { label: '血压', value: `${c.basics.sbp || '-'}/${c.basics.dbp || '-'}` },
              { label: '血糖', value: c.labBasic.glucose?.fasting || '-' },
              { label: 'HbA1c', value: hba1c || '-' },
              { label: 'ABI', value: abi || '-' },
              { label: '体脂率', value: bodyFatRate ? `${bodyFatRate}%` : '-' },
            ].map((m) => (
              <div key={m.label} className="rounded-lg bg-slate-50 p-3">
                <div className="mb-1 text-xs text-slate-400">{m.label}</div>
                <div className="text-lg font-black text-slate-700">{m.value}</div>
              </div>
            ))}
          </div>
          {recomputeHint ? <p className="mt-2 text-xs text-blue-600">{recomputeHint}</p> : null}
          {archive.draft_data ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              有新的 AI 健康建议待医生审核发布
            </div>
          ) : null}
        </div>

        {model.focusHighlights.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-bold text-slate-800">需关注重点</h2>
            <ul className="space-y-2">
              {model.focusHighlights.map((item, i) => (
                <li
                  key={`${item.severity}-${i}`}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    item.severity === 'red'
                      ? 'border border-red-100 bg-red-50 text-red-800'
                      : item.severity === 'yellow'
                        ? 'border border-yellow-100 bg-yellow-50 text-yellow-900'
                        : 'border border-blue-100 bg-blue-50 text-blue-900'
                  }`}
                >
                  {item.severity === 'red' ? '● 高危：' : item.severity === 'yellow' ? '● 中危：' : '● 随访重点：'}
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-bold text-slate-800">下一步健康计划</h2>
          {model.nextFollowUp ? (
            <div
              className={`mb-4 rounded-xl border p-3 ${
                model.hasOverdueFollowUp ? 'border-red-200 bg-red-50' : 'border-blue-100 bg-blue-50'
              }`}
            >
              <div className="text-xs font-bold text-slate-500">下次随访</div>
              <div className="text-lg font-black text-slate-800">{model.nextFollowUp.date}</div>
              {model.nextFollowUp.status === 'overdue' ? (
                <span className="text-xs font-bold text-red-600">已逾期，请尽快联系管家</span>
              ) : null}
              {model.nextFollowUp.focusItems?.length ? (
                <p className="mt-1 text-xs text-slate-600">{model.nextFollowUp.focusItems.join('、')}</p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2">
            {model.nextActions.slice(0, 6).map((action) => (
              <NextActionRow key={action.id} action={action} onPress={() => handleAction(action.action)} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setTrendsOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left font-bold text-slate-800"
          >
            关键指标趋势
            <span className="text-slate-400">{trendsOpen ? '收起' : '展开'}</span>
          </button>
          {trendsOpen && checkupId ? (
            <div className="border-t border-slate-100 p-3">
              <HealthTrendCharts checkupId={checkupId} variant="dashboard" />
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: '智能问答', icon: '🤖', onClick: () => setView('assistant') },
            { label: '消息', icon: '💬', onClick: () => onNavigateTab('message') },
            { label: '医生', icon: '🩺', onClick: () => onNavigateTab('doctor') },
            { label: '服务', icon: '🏥', onClick: () => onNavigateTab('community') },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm active:scale-[0.98]"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-sm font-bold text-slate-700">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {onUpdateRecord ? (
        <UserMetricEntryModal
          open={metricModalOpen}
          onClose={() => setMetricModalOpen(false)}
          record={record}
          checkupId={checkupId!}
          onSave={async (payload) => {
            await onUpdateRecord(payload);
            setMetricModalOpen(false);
            onRefresh?.();
          }}
        />
      ) : null}
    </div>
  );
};

const NextActionRow: React.FC<{ action: UserHomeNextAction; onPress: () => void }> = ({ action, onPress }) => (
  <button
    type="button"
    onClick={onPress}
    className="flex w-full items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left transition-colors hover:bg-teal-50/80 active:scale-[0.99]"
  >
    <span className="mt-0.5 text-teal-600">›</span>
    <div className="min-w-0 flex-1">
      <div className="text-sm font-bold text-slate-800">{action.title}</div>
      {action.description ? <div className="mt-0.5 text-xs text-slate-500">{action.description}</div> : null}
    </div>
  </button>
);
