import React, { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HealthArchive } from '../services/dataService';
import {
  BOARD_METRIC_CODES,
  buildCampusHealthBoard,
  listDepartments,
  pct,
  type BoardPerson,
  type CampusBoardModel,
  type RateCard,
} from '../services/campusHealthBoard';
import { fetchBoardObservations, type HealthObservationRow } from '../services/observationService';

interface CampusHealthBoardProps {
  archives: HealthArchive[];
  onRefresh?: () => void;
  onSelectPatient: (archive: HealthArchive) => void;
}

const LINE_COLORS = ['#0f766e', '#b45309', '#be123c', '#1d4ed8', '#7c3aed', '#15803d', '#c2410c'];

const StatButton: React.FC<{
  label: string;
  value: string;
  hint?: string;
  onClick: () => void;
}> = ({ label, value, hint, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-teal-400 hover:shadow"
  >
    <div className="text-xs font-medium text-slate-500">{label}</div>
    <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
  </button>
);

export const CampusHealthBoard: React.FC<CampusHealthBoardProps> = ({ archives, onRefresh, onSelectPatient }) => {
  const departments = useMemo(() => listDepartments(archives), [archives]);
  const [department, setDepartment] = useState('全校');
  const [observations, setObservations] = useState<HealthObservationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [listTitle, setListTitle] = useState('');
  const [listPeople, setListPeople] = useState<BoardPerson[] | null>(null);

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

  const board: CampusBoardModel = useMemo(
    () => buildCampusHealthBoard(filtered, observations),
    [filtered, observations]
  );

  const openList = (title: string, people: BoardPerson[]) => {
    setListTitle(title);
    setListPeople(people);
  };

  const share = (count: number, total: number) => (total > 0 ? `${pct(count / total)}` : '—');

  const chartRows = useMemo(() => {
    const years = [...new Set(board.numericTrends.flatMap((series) => series.points.map((point) => point.year)))].sort();
    return years.map((year) => {
      const row: Record<string, string | number | null> = { year };
      board.numericTrends.forEach((series) => {
        const point = series.points.find((item) => item.year === year);
        row[series.id] = point && point.denominator > 0 ? Math.round(point.rate * 1000) / 10 : null;
      });
      return row;
    });
  }, [board.numericTrends]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">健康总屏</h2>
          <p className="mt-1 text-sm text-slate-500">
            按有结果的人数计算检出率，每人只计一次。数字可打开名单。
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

      {loading ? <div className="text-sm text-slate-500">正在汇总历年观测…</div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatButton label="在册" value={String(board.enrolled.length)} onClick={() => openList('在册人员', board.enrolled)} />
        <StatButton
          label="已有综合评估"
          value={String(board.assessed.length)}
          hint={`占在册 ${share(board.assessed.length, board.enrolled.length)}`}
          onClick={() => openList('已有综合评估', board.assessed)}
        />
        <StatButton
          label="高风险"
          value={share(board.high.length, board.assessed.length)}
          hint={`${board.high.length} 人`}
          onClick={() => openList('高风险', board.high)}
        />
        <StatButton
          label="中风险"
          value={share(board.mid.length, board.assessed.length)}
          hint={`${board.mid.length} 人`}
          onClick={() => openList('中风险', board.mid)}
        />
        <StatButton
          label="低风险"
          value={share(board.low.length, board.assessed.length)}
          hint={`${board.low.length} 人`}
          onClick={() => openList('低风险', board.low)}
        />
        <StatButton
          label="危急值未归档"
          value={String(board.critical.length)}
          onClick={() => openList('危急值未归档', board.critical)}
        />
        <StatButton
          label="随访待办"
          value={String(board.followUp.length)}
          onClick={() => openList('随访待办', board.followUp)}
        />
      </div>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-slate-800">常见病与阳性结果</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {board.cards.map((card) => (
            <RateCardView key={card.id} card={card} onOpen={() => openList(card.title, card.people)} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800">历年检出率</h3>
        <p className="mt-1 text-xs text-slate-500">纵轴为百分比。某年没有该项结果的人不进入当年分母。</p>
        <div className="mt-3 h-80">
          {chartRows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis unit="%" tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip formatter={(value) => (value == null ? '—' : `${value}%`)} />
                <Legend />
                {board.numericTrends.map((series, index) => (
                  <Line
                    key={series.id}
                    type="linear"
                    dataKey={series.id}
                    name={series.label}
                    stroke={LINE_COLORS[index % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">还没有可按年汇总的数值结果</div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800">文字阳性历年</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">项目</th>
                <th className="py-2 pr-4 font-medium">口径</th>
                <th className="py-2 font-medium">分年检出率</th>
              </tr>
            </thead>
            <tbody>
              {board.textTrends.map((series) => (
                <tr key={series.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-800">{series.label}</td>
                  <td className="py-2 pr-4 text-slate-500">{series.note || '按体检年份文字'}</td>
                  <td className="py-2 text-slate-700">
                    {series.points.length
                      ? series.points
                          .map((point) => `${point.year} ${pct(point.rate)}（${point.count}/${point.denominator}）`)
                          .join('；')
                      : '暂无'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4">
        <h3 className="text-lg font-semibold text-slate-800">管理要点与资源方向</h3>
        <ol className="mt-3 space-y-3">
          {board.priorities.length ? (
            board.priorities.map((item, index) => (
              <li key={item.title} className="rounded-xl bg-white px-4 py-3 shadow-sm">
                <div className="text-sm font-semibold text-teal-800">
                  {index + 1}. {item.title}
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-700">{item.detail}</p>
              </li>
            ))
          ) : (
            <li className="text-sm text-slate-500">当前筛选范围内还没有足够结果生成管理要点。</li>
          )}
        </ol>
      </section>

      {listPeople ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{listTitle}</h3>
                <p className="text-xs text-slate-500">{listPeople.length} 人</p>
              </div>
              <button type="button" onClick={() => setListPeople(null)} className="text-sm text-slate-500 hover:text-slate-800">
                关闭
              </button>
            </div>
            <div className="overflow-auto px-5 py-2">
              {listPeople.length ? (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2 font-medium">姓名</th>
                      <th className="py-2 font-medium">部门</th>
                      <th className="py-2 font-medium">风险</th>
                      <th className="py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {listPeople.map((person) => (
                      <tr key={person.checkupId} className="border-b border-slate-100">
                        <td className="py-2 text-slate-900">{person.name}</td>
                        <td className="py-2 text-slate-600">{person.department}</td>
                        <td className="py-2 text-slate-600">{person.riskLabel}</td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            className="text-teal-700 hover:underline"
                            onClick={() => {
                              setListPeople(null);
                              onSelectPatient(person.archive);
                            }}
                          >
                            进入评估
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-8 text-center text-sm text-slate-400">没有命中人员</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const RateCardView: React.FC<{ card: RateCard; onOpen: () => void }> = ({ card, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-teal-400"
  >
    <div className="text-sm font-medium text-slate-500">{card.title}</div>
    <div className="mt-2 flex items-baseline gap-3">
      <span className="text-3xl font-semibold text-slate-900">{card.count}</span>
      <span className="text-lg text-teal-700">{pct(card.rate)}</span>
    </div>
    <div className="mt-2 text-xs leading-5 text-slate-500">
      分母 {card.denominator} 人。{card.note}
    </div>
  </button>
);
