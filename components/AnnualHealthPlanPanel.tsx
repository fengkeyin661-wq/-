import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { HealthArchive } from '../services/dataService';
import { fetchBoardObservations, type HealthObservationRow } from '../services/observationService';
import { BOARD_METRIC_CODES } from '../services/campusHealthBoard';
import { proposeAnnualPlanSchedule } from '../services/geminiService';
import { formatYuan, listDepartments } from '../services/healthBudget';
import {
  applyScheduleHints,
  buildDisplayedPlans,
  buildRuleAnnualPlan,
  personBudgetById,
  PLAN_HEADING_LABEL,
  riskLinesForPlan,
  saveAnnualPlan,
  scheduleInputFromPlan,
  summarizeAnnualPlans,
  type AnnualHealthPlan,
  type PlanHeading,
} from '../services/annualHealthPlan';

const HEADINGS: PlanHeading[] = ['checkup', 'monitor', 'education', 'depth'];

interface AnnualHealthPlanPanelProps {
  archives: HealthArchive[];
  onRefresh?: () => void;
  onSelectPatient: (archive: HealthArchive) => void;
}

export const AnnualHealthPlanPanel: React.FC<AnnualHealthPlanPanelProps> = ({
  archives,
  onRefresh,
  onSelectPatient,
}) => {
  const departments = useMemo(() => listDepartments(archives), [archives]);
  const [department, setDepartment] = useState('全校');
  const [observations, setObservations] = useState<HealthObservationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [openPlan, setOpenPlan] = useState<AnnualHealthPlan | null>(null);
  const stopRef = useRef(false);

  const filtered = useMemo(() => {
    if (department === '全校') return archives;
    return archives.filter((archive) => {
      const name = (archive.department || archive.health_record?.profile?.department || '').trim();
      return name === department;
    });
  }, [archives, department]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBoardObservations(
      archives.map((archive) => archive.checkup_id),
      [...BOARD_METRIC_CODES]
    )
      .then((rows) => {
        if (!cancelled) setObservations(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [archives]);

  const plans = useMemo(
    () => buildDisplayedPlans(filtered, observations),
    [filtered, observations, revision]
  );
  const summary = useMemo(() => summarizeAnnualPlans(plans), [plans]);

  const toggle = (checkupId: string) => {
    setSelected((current) =>
      current.includes(checkupId) ? current.filter((id) => id !== checkupId) : [...current, checkupId]
    );
  };

  const run = async () => {
    const chosen = filtered.filter((archive) => selected.includes(archive.checkup_id));
    if (!chosen.length || running) return;
    stopRef.current = false;
    setRunning(true);
    const budgets = personBudgetById(chosen, observations);
    for (let index = 0; index < chosen.length; index += 1) {
      if (stopRef.current) break;
      const archive = chosen[index];
      const person = budgets.get(archive.checkup_id);
      if (!person) continue;
      setProgress(`正在制定 ${index + 1}/${chosen.length} ${person.name}`);
      const rulePlan = buildRuleAnnualPlan(person);
      const ai = await proposeAnnualPlanSchedule({
        name: person.name,
        department: person.department,
        riskLabel: person.riskLabel,
        risks: riskLinesForPlan(archive),
        items: scheduleInputFromPlan(rulePlan),
      });
      const plan = ai ? applyScheduleHints(rulePlan, ai.items, ai.summary) : rulePlan;
      if (plan.source === 'ai') saveAnnualPlan(plan);
      setRevision((value) => value + 1);
    }
    setProgress(stopRef.current ? '已停止' : '批量制定完成');
    setRunning(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">年度健康规划</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            每人先按体检、监测、健教和进一步评估排好一年，汇总后就是全人群预算。勾选人员后批量制定，模型只调整月份和说明。未制定的仍按规则计入汇总，并标为待制定。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">
            部门
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="全校">全校</option>
              {departments.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              刷新档案
            </button>
          ) : null}
        </div>
      </div>

      {loading ? <div className="text-sm text-slate-500">正在按每人结果汇总…</div> : null}
      {progress ? <div className="text-sm text-slate-500">{progress}</div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <SummaryCard label="在册" value={String(summary.headcount)} />
        <SummaryCard label="已制定" value={String(summary.drafted)} />
        <SummaryCard label="待制定" value={String(summary.pending)} />
        <SummaryCard label="年度总预算" value={`${formatYuan(summary.total)} 元`} />
        <SummaryCard label="人均预算" value={`${formatYuan(summary.average)} 元`} />
        {HEADINGS.map((heading) => (
          <SummaryCard
            key={heading}
            label={PLAN_HEADING_LABEL[heading]}
            value={`${formatYuan(summary.byHeading[heading])} 元`}
          />
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold text-slate-800">人员规划</h3>
          <button
            type="button"
            className="text-sm text-teal-700 hover:underline"
            onClick={() => setSelected(plans.map((plan) => plan.checkupId))}
          >
            全选
          </button>
          <button type="button" className="text-sm text-slate-500 hover:underline" onClick={() => setSelected([])}>
            清空
          </button>
          <button
            type="button"
            disabled={running || !selected.length}
            onClick={run}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            批量制定（{selected.length}）
          </button>
          {running ? (
            <button
              type="button"
              onClick={() => {
                stopRef.current = true;
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              停止
            </button>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-3 font-medium" />
                <th className="py-2 pr-3 font-medium">姓名</th>
                <th className="py-2 pr-3 font-medium">部门</th>
                <th className="py-2 pr-3 font-medium">风险</th>
                <th className="py-2 pr-3 font-medium">状态</th>
                <th className="py-2 pr-3 font-medium">年度预算</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.checkupId} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(plan.checkupId)}
                      onChange={() => toggle(plan.checkupId)}
                    />
                  </td>
                  <td className="py-2 pr-3 text-slate-900">{plan.name}</td>
                  <td className="py-2 pr-3 text-slate-600">{plan.department}</td>
                  <td className="py-2 pr-3 text-slate-600">{plan.riskLabel}</td>
                  <td className="py-2 pr-3">
                    {plan.source === 'ai' ? (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-800">已制定</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">待制定</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-slate-900">{formatYuan(plan.total)} 元</td>
                  <td className="py-2 text-right">
                    <button type="button" className="text-teal-700 hover:underline" onClick={() => setOpenPlan(plan)}>
                      查看计划
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {openPlan ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex max-h-[80vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {openPlan.name} · {formatYuan(openPlan.total)} 元
                </h3>
                <p className="text-xs text-slate-500">
                  {openPlan.department} · {openPlan.riskLabel} · {openPlan.source === 'ai' ? '已制定' : '待制定'}
                </p>
              </div>
              <button type="button" onClick={() => setOpenPlan(null)} className="text-sm text-slate-500 hover:text-slate-800">
                关闭
              </button>
            </div>
            <div className="overflow-auto px-5 py-3">
              <p className="text-sm leading-6 text-slate-700">{openPlan.summary}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                {HEADINGS.map((heading) => (
                  <span key={heading}>
                    {PLAN_HEADING_LABEL[heading]} {formatYuan(openPlan.byHeading[heading])} 元
                  </span>
                ))}
              </div>
              <table className="mt-3 min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-3 font-medium">月份</th>
                    <th className="py-2 pr-3 font-medium">安排</th>
                    <th className="py-2 pr-3 font-medium">项目</th>
                    <th className="py-2 pr-3 font-medium">说明</th>
                    <th className="py-2 font-medium">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {openPlan.slots.map((slot, index) => (
                    <tr key={`${slot.code}-${slot.month}-${index}`} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{slot.month} 月</td>
                      <td className="py-2 pr-3 text-slate-500">{PLAN_HEADING_LABEL[slot.heading]}</td>
                      <td className="py-2 pr-3 text-slate-800">{slot.name}</td>
                      <td className="py-2 pr-3 text-slate-500">{slot.note}</td>
                      <td className="py-2">{formatYuan(slot.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="py-4 text-right">
                <button
                  type="button"
                  className="text-sm text-teal-700 hover:underline"
                  onClick={() => {
                    const archive = openPlan.archive;
                    setOpenPlan(null);
                    onSelectPatient(archive);
                  }}
                >
                  进入评估
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <div className="text-xs font-medium text-slate-500">{label}</div>
    <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
  </div>
);
