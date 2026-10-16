import React, { useEffect, useMemo, useState } from 'react';
import type { HealthArchive } from '../services/dataService';
import type { HealthObservationRow } from '../services/observationService';
import { fetchBoardObservations } from '../services/observationService';
import {
  BOARD_METRIC_CODES,
  BUDGET_CATEGORY_LABEL,
  buildHealthBudget,
  formatYuan,
  listDepartments,
  type BudgetCategory,
  type HealthBudgetModel,
  type PersonBudget,
} from '../services/healthBudget';

interface HealthBudgetPanelProps {
  archives: HealthArchive[];
  onRefresh?: () => void;
  onSelectPatient: (archive: HealthArchive) => void;
}

const CATEGORIES: BudgetCategory[] = ['recheck', 'further', 'followup', 'education'];

export const HealthBudgetPanel: React.FC<HealthBudgetPanelProps> = ({ archives, onRefresh, onSelectPatient }) => {
  const departments = useMemo(() => listDepartments(archives), [archives]);
  const [department, setDepartment] = useState('全校');
  const [observations, setObservations] = useState<HealthObservationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PersonBudget | null>(null);

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

  const budget: HealthBudgetModel = useMemo(
    () => buildHealthBudget(filtered, observations),
    [filtered, observations]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">健康预算</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            按已建档人员当前结果和常规频次估算一年需求，价格用河南省服务目录一档最高限额。这是预算，不是医嘱，也不是结算价。
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

      {loading ? <div className="text-sm text-slate-500">正在按最近结果估算…</div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="在册" value={String(budget.headcount)} />
        <SummaryCard label="年度总预算" value={`${formatYuan(budget.total)} 元`} />
        <SummaryCard label="人均预算" value={`${formatYuan(budget.average)} 元`} />
        {CATEGORIES.map((category) => (
          <SummaryCard
            key={category}
            label={BUDGET_CATEGORY_LABEL[category]}
            value={`${formatYuan(budget.byCategory[category])} 元`}
          />
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800">服务项目汇总</h3>
        <p className="mt-1 text-xs text-slate-500">健康教育按每班 30 人折算开班次数，费用仍按人次计算。</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-3 font-medium">类别</th>
                <th className="py-2 pr-3 font-medium">编码</th>
                <th className="py-2 pr-3 font-medium">项目</th>
                <th className="py-2 pr-3 font-medium">单价</th>
                <th className="py-2 pr-3 font-medium">总次数</th>
                <th className="py-2 pr-3 font-medium">开班</th>
                <th className="py-2 font-medium">金额</th>
              </tr>
            </thead>
            <tbody>
              {budget.services.map((service) => (
                <tr key={service.code} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-500">{BUDGET_CATEGORY_LABEL[service.category]}</td>
                  <td className="py-2 pr-3 text-slate-500">{service.code}</td>
                  <td className="py-2 pr-3 text-slate-800">
                    {service.name}
                    <span className="ml-1 text-xs text-slate-400">/ {service.unit}</span>
                  </td>
                  <td className="py-2 pr-3 text-slate-700">{formatYuan(service.price)}</td>
                  <td className="py-2 pr-3 text-slate-700">{service.times}</td>
                  <td className="py-2 pr-3 text-slate-700">{service.classCount ?? '—'}</td>
                  <td className="py-2 text-slate-900">{formatYuan(service.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800">人员预算</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-3 font-medium">姓名</th>
                <th className="py-2 pr-3 font-medium">部门</th>
                <th className="py-2 pr-3 font-medium">风险</th>
                <th className="py-2 pr-3 font-medium">年度预算</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {budget.people.map((person) => (
                <tr key={person.checkupId} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-900">{person.name}</td>
                  <td className="py-2 pr-3 text-slate-600">{person.department}</td>
                  <td className="py-2 pr-3 text-slate-600">{person.riskLabel}</td>
                  <td className="py-2 pr-3 text-slate-900">{formatYuan(person.total)} 元</td>
                  <td className="py-2 text-right">
                    <button type="button" className="text-teal-700 hover:underline" onClick={() => setSelected(person)}>
                      查看项目
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {selected.name} · {formatYuan(selected.total)} 元
                </h3>
                <p className="text-xs text-slate-500">
                  {selected.department} · {selected.riskLabel}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-sm text-slate-500 hover:text-slate-800">
                关闭
              </button>
            </div>
            <div className="overflow-auto px-5 py-2">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-3 font-medium">项目</th>
                    <th className="py-2 pr-3 font-medium">依据</th>
                    <th className="py-2 pr-3 font-medium">次数</th>
                    <th className="py-2 font-medium">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.lines.map((line) => (
                    <tr key={line.code} className="border-b border-slate-100">
                      <td className="py-2 pr-3 text-slate-800">{line.name}</td>
                      <td className="py-2 pr-3 text-slate-500">{line.reason}</td>
                      <td className="py-2 pr-3 text-slate-700">
                        {line.times} {line.unit}
                      </td>
                      <td className="py-2 text-slate-900">{formatYuan(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="py-4 text-right">
                <button
                  type="button"
                  className="text-sm text-teal-700 hover:underline"
                  onClick={() => {
                    const archive = selected.archive;
                    setSelected(null);
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
