import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { HealthArchive } from '../services/dataService';
import { fetchBoardObservations } from '../services/observationService';
import { BOARD_METRIC_CODES } from '../services/campusHealthBoard';
import { proposeAnnualPlanSchedule } from '../services/geminiService';
import { formatYuan, listDepartments } from '../services/healthBudget';
import {
  applyScheduleHints,
  buildRuleAnnualPlan,
  personBudgetById,
  PLAN_HEADING_LABEL,
  riskLinesForPlan,
  scheduleInputFromPlan,
  type AnnualHealthPlan,
  type PlanHeading,
} from '../services/annualHealthPlan';
import type { HealthObservationRow } from '../services/observationService';

const HEADINGS: PlanHeading[] = ['checkup', 'monitor', 'education', 'depth'];

export const AnnualHealthPlanPanel: React.FC<{ archives: HealthArchive[] }> = ({ archives }) => {
  const departments = useMemo(() => listDepartments(archives), [archives]);
  const [department, setDepartment] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [observations, setObservations] = useState<HealthObservationRow[]>([]);
  const [loadingObs, setLoadingObs] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [plans, setPlans] = useState<AnnualHealthPlan[]>([]);
  const [openId, setOpenId] = useState('');
  const stopRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingObs(true);
    fetchBoardObservations(
      archives.map((archive) => archive.checkup_id),
      [...BOARD_METRIC_CODES]
    )
      .then((rows) => {
        if (!cancelled) setObservations(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingObs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [archives]);

  const visible = useMemo(() => {
    const text = keyword.trim();
    return archives.filter((archive) => {
      const dept = (archive.department || archive.health_record?.profile?.department || '').trim();
      if (department !== '全部' && dept !== department) return false;
      if (!text) return true;
      const name = archive.name || archive.health_record?.profile?.name || '';
      return name.includes(text) || archive.checkup_id.includes(text);
    });
  }, [archives, department, keyword]);

  const toggle = (checkupId: string) => {
    setSelected((current) =>
      current.includes(checkupId) ? current.filter((id) => id !== checkupId) : [...current, checkupId]
    );
  };

  const run = async () => {
    const chosen = archives.filter((archive) => selected.includes(archive.checkup_id));
    if (!chosen.length || running) return;
    stopRef.current = false;
    setRunning(true);
    setPlans([]);
    const budgets = personBudgetById(chosen, observations);
    const next: AnnualHealthPlan[] = [];
    for (let index = 0; index < chosen.length; index += 1) {
      if (stopRef.current) break;
      const archive = chosen[index];
      const name = archive.name || archive.health_record?.profile?.name || archive.checkup_id;
      setProgress(`正在制定 ${index + 1}/${chosen.length} ${name}`);
      const person = budgets.get(archive.checkup_id);
      if (!person) continue;
      const rulePlan = buildRuleAnnualPlan(person);
      const ai = await proposeAnnualPlanSchedule({
        name: person.name,
        department: person.department,
        riskLabel: person.riskLabel,
        risks: riskLinesForPlan(archive),
        items: scheduleInputFromPlan(rulePlan),
      });
      const plan = ai ? applyScheduleHints(rulePlan, ai.items, ai.summary) : rulePlan;
      next.push(plan);
      setPlans([...next]);
      setOpenId(plan.checkupId);
    }
    setProgress(stopRef.current ? '已停止。本次结果未写入档案。' : '试制定完成。本次结果未写入档案。');
    setRunning(false);
  };

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">年度健康规划</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            把随访铺成一年：健康体检、风险指标监测、专项健康教育和进一步评估。价格按目录一档限价，年度体检并入已有复查，不重复计次。先选定人员，再逐人试制定。结果只在本页显示，不写入档案。
          </p>
        </div>
        <div className="text-sm text-slate-500">{loadingObs ? '正在读取最近结果…' : progress}</div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          部门
          <select
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="全部">全部</option>
            {departments.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="姓名或体检编号"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          className="text-sm text-teal-700 hover:underline"
          onClick={() => setSelected(visible.map((archive) => archive.checkup_id))}
        >
          选中当前列表
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
          逐人试制定（{selected.length}）
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

      <div className="mt-3 max-h-52 overflow-auto rounded-xl border border-slate-100">
        {visible.map((archive) => {
          const name = archive.name || archive.health_record?.profile?.name || '未命名';
          const dept = archive.department || archive.health_record?.profile?.department || '未填部门';
          return (
            <label key={archive.checkup_id} className="flex items-center gap-3 border-b border-slate-50 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(archive.checkup_id)}
                onChange={() => toggle(archive.checkup_id)}
              />
              <span className="font-medium text-slate-800">{name}</span>
              <span className="text-slate-500">{dept}</span>
              <span className="text-slate-400">{archive.checkup_id}</span>
            </label>
          );
        })}
      </div>

      <div className="mt-5 space-y-3">
        {plans.map((plan) => (
          <article key={plan.checkupId} className="rounded-xl border border-slate-200">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              onClick={() => setOpenId(openId === plan.checkupId ? '' : plan.checkupId)}
            >
              <span>
                <span className="font-semibold text-slate-900">{plan.name}</span>
                <span className="ml-2 text-sm text-slate-500">
                  {plan.department} · {plan.riskLabel} · {plan.source === 'ai' ? '模型排期' : '规则排期'}
                </span>
              </span>
              <span className="font-semibold text-slate-900">{formatYuan(plan.total)} 元</span>
            </button>
            {openId === plan.checkupId ? (
              <div className="border-t px-4 py-3">
                <p className="text-sm leading-6 text-slate-700">{plan.summary}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  {HEADINGS.map((heading) => (
                    <span key={heading}>
                      {PLAN_HEADING_LABEL[heading]} {formatYuan(plan.byHeading[heading])} 元
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
                    {plan.slots.map((slot, index) => (
                      <tr key={`${slot.code}-${slot.month}-${index}`} className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-700">{slot.month} 月</td>
                        <td className="py-2 pr-3 text-slate-500">{PLAN_HEADING_LABEL[slot.heading]}</td>
                        <td className="py-2 pr-3 text-slate-800">{slot.name}</td>
                        <td className="py-2 pr-3 text-slate-500">{slot.note}</td>
                        <td className="py-2 text-slate-900">{formatYuan(slot.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
};
