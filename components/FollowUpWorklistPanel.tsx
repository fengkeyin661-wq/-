import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { HealthArchive } from '../services/dataService';
import {
  buildFollowUpWorklist,
  getLatestFollowUp,
  isCriticalContactDeferred,
  isCriticalContactRetryDue,
  isCriticalFollowUpPending,
  listArchivedCriticalFollowUps,
  matchesCriticalArchiveSearch,
  resolveCriticalTrackStatus,
  type FollowUpWorklistRow,
} from '../services/followUpLinkageService';
import {
  exportCriticalFollowUpArchives,
  exportFollowUpWorklistRows,
} from '../services/criticalFollowUpExport';
import type { SmsSentRole } from '../services/smsService';

export type WorklistFilter = 'todo' | 'archived_critical';

interface Props {
  archives: HealthArchive[];
  currentPatientId?: string;
  onSelectPatient: (archive: HealthArchive, options?: { scrollToDetail?: boolean }) => void;
  onRefresh: () => void;
  onCollapse?: () => void;
  criticalFocus?: { checkupId: string | null; openModal: boolean; token: number };
  userRole?: SmsSentRole;
}

export const FollowUpWorklistPanel: React.FC<Props> = ({
  archives,
  currentPatientId,
  onSelectPatient,
  onRefresh,
  onCollapse,
  criticalFocus,
  userRole = 'admin',
}) => {
  const [filter, setFilter] = useState<WorklistFilter>('todo');
  const [searchQuery, setSearchQuery] = useState('');
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});

  const todoRows = useMemo(() => buildFollowUpWorklist(archives, { routineWithinDays: 7 }), [archives]);

  const archivedList = useMemo(() => listArchivedCriticalFollowUps(archives), [archives]);

  const displayTodoRows = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return todoRows;
    return todoRows.filter((row) => matchesCriticalArchiveSearch(row.archive, q));
  }, [todoRows, searchQuery]);

  const displayArchived = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return archivedList;
    return archivedList.filter((arch) => matchesCriticalArchiveSearch(arch, q));
  }, [archivedList, searchQuery]);

  useEffect(() => {
    if (!criticalFocus?.token) return;
    if (criticalFocus.checkupId) {
      setFilter('todo');
      setSearchQuery(criticalFocus.checkupId);
      const arch = archives.find((a) => a.checkup_id === criticalFocus.checkupId);
      if (arch && criticalFocus.openModal) {
        onSelectPatient(arch, { scrollToDetail: true });
      }
      requestAnimationFrame(() => {
        const el = rowRefs.current[criticalFocus.checkupId!];
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } else {
      setFilter('todo');
    }
  }, [criticalFocus?.token, criticalFocus?.checkupId, criticalFocus?.openModal, archives, onSelectPatient]);

  const categoryLabel = (row: FollowUpWorklistRow) => {
    if (row.critical && row.routine) return '危急+计划';
    if (row.critical) return '危急重点';
    return '计划随访';
  };

  const planCell = (row: FollowUpWorklistRow) => {
    const { archive, routine, critical } = row;
    if (routine) {
      const overdue = routine.daysLeft < 0;
      const today = routine.daysLeft === 0;
      const text = overdue
        ? `逾期 ${Math.abs(routine.daysLeft)} 天`
        : today
          ? '今日计划'
          : `${routine.daysLeft} 天后`;
      return (
        <>
          <div className="text-base font-mono font-bold text-slate-800">{routine.date}</div>
          <div className={`mt-0.5 text-sm ${overdue ? 'font-bold text-red-600' : 'text-slate-600'}`}>{text}</div>
        </>
      );
    }
    const track = archive.critical_track;
    const status = resolveCriticalTrackStatus(archive);
    if (critical?.contactRetryDue && (isCriticalContactRetryDue(archive) || isCriticalContactDeferred(archive))) {
      return (
        <>
          <div className="text-base font-mono font-bold text-amber-800">再联系 {critical.contactRetryDue}</div>
          <div className="text-sm text-amber-700 mt-0.5">
            {isCriticalContactRetryDue(archive) ? '今日起需再联系' : '延期中'}
          </div>
        </>
      );
    }
    if (status === 'pending_secondary' && track?.secondary_due_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(track.secondary_due_date);
      const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const countdown =
        diff < 0 ? `二次回访逾期 ${Math.abs(diff)} 天` : diff === 0 ? '今日二次回访' : `二次回访剩 ${diff} 天`;
      return (
        <>
          <div className="text-base font-mono font-bold text-slate-700">{track.secondary_due_date}</div>
          <div className={`text-sm mt-0.5 ${diff < 0 ? 'text-red-600 font-bold' : 'text-blue-600'}`}>{countdown}</div>
        </>
      );
    }
    return <span className="text-sm text-slate-500">初次通知后生成</span>;
  };

  const renderPriorityFocus = (row: FollowUpWorklistRow) => {
    const items = row.priorityFocusItems || row.routine?.priorityFocusItems || [];
    const risk = row.archive.assessment_data?.riskLevel;
    if (items.length) {
      return (
        <div>
          {risk === 'RED' || risk === 'YELLOW' ? (
            <span
              className={`inline-block mb-1 text-sm font-bold px-2 py-0.5 rounded ${
                risk === 'RED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
              }`}
            >
              {risk === 'RED' ? '高风险' : '中风险'}
            </span>
          ) : null}
          <ul className="space-y-1">
            {items.slice(0, 3).map((item, i) => (
              <li key={item} className="flex gap-2 text-sm leading-snug text-slate-700">
                <span className="font-black text-amber-700">{i + 1}.</span>
                <span className="line-clamp-2">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    if (row.critical?.item) {
      return <span className="text-sm font-bold text-red-700">{row.critical.item}</span>;
    }
    return <span className="text-slate-500 text-sm">待维护要点</span>;
  };

  const handleExport = () => {
    if (filter === 'archived_critical') {
      exportCriticalFollowUpArchives(displayArchived, 'archived');
    } else {
      exportFollowUpWorklistRows(displayTodoRows);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-800">待办队列</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">危急值与 7 日内计划随访。点选人员后在右侧录入。</p>
          </div>
          {onCollapse ? (
            <button
              type="button"
              onClick={onCollapse}
              className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-white"
            >
              收起队列
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setFilter('todo')}
              className={`rounded-md px-4 py-2 text-sm font-bold ${
                filter === 'todo' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              待办 ({todoRows.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('archived_critical')}
              className={`rounded-md px-4 py-2 text-sm font-bold ${
                filter === 'archived_critical' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              已归档 ({archivedList.length})
            </button>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
          >
            导出
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="relative min-w-[200px] flex-1">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索姓名、体检编号、危急关键字…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        {searchQuery.trim() ? (
          <button type="button" onClick={() => setSearchQuery('')} className="text-sm font-bold text-teal-700">
            清除
          </button>
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        {filter === 'todo' ? (
          displayTodoRows.length === 0 ? (
            <div className="py-16 text-center text-base text-slate-500">暂无待办随访任务</div>
          ) : (
            displayTodoRows.map((row) => {
              const { archive } = row;
              const isCriticalRow = Boolean(row.critical);
              const selected = archive.checkup_id === currentPatientId;
              return (
                <article
                  key={archive.checkup_id}
                  ref={(el) => {
                    rowRefs.current[archive.checkup_id] = el;
                  }}
                  className={`rounded-xl border p-4 ${
                    isCriticalRow ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white'
                  } ${selected ? 'ring-2 ring-teal-500' : ''}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">{archive.name}</h3>
                        <span
                          className={`rounded-md px-2 py-0.5 text-sm font-bold ${
                            row.critical
                              ? 'border border-red-200 bg-red-100 text-red-800'
                              : 'border border-blue-100 bg-blue-50 text-blue-700'
                          }`}
                        >
                          {categoryLabel(row)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {archive.checkup_id}
                        {archive.department ? ` · ${archive.department}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectPatient(archive, { scrollToDetail: true })}
                        className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-bold text-white hover:bg-teal-700"
                      >
                        {isCriticalFollowUpPending(archive) ? '开始随访（含危急值）' : '开始随访'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <div className="mb-1 text-sm font-bold text-slate-500">计划</div>
                      {planCell(row)}
                    </div>
                    <div>
                      <div className="mb-1 text-sm font-bold text-slate-500">优先核对</div>
                      {renderPriorityFocus(row)}
                    </div>
                  </div>
                  {row.critical ? (
                    <div className="mt-3 rounded-lg bg-white/80 p-3">
                      <div className="text-base font-bold text-red-700">{row.critical.item}</div>
                      {row.critical.level ? (
                        <div className="mt-1 text-sm font-bold text-orange-600">{row.critical.level}</div>
                      ) : null}
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">{row.critical.desc}</p>
                      <div className="mt-1 text-sm font-bold text-red-600">{row.critical.statusLabel}</div>
                    </div>
                  ) : null}
                  <p className="mt-3 text-sm text-slate-600">
                    最近随访 {getLatestFollowUp(archive.follow_ups)?.date || '无'}
                  </p>
                </article>
              );
            })
          )
        ) : displayArchived.length === 0 ? (
          <div className="py-16 text-center text-base text-slate-500">暂无已归档危急值记录</div>
        ) : (
          displayArchived.map((arch) => (
            <article key={arch.checkup_id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{arch.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{arch.checkup_id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectPatient(arch, { scrollToDetail: true })}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
                >
                  查看随访
                </button>
              </div>
              <p className="mt-3 text-base font-bold text-red-700">{arch.critical_track?.critical_item || '—'}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {arch.critical_track?.critical_desc || arch.assessment_data?.criticalWarning || '—'}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                归档更新 {new Date(arch.updated_at || arch.created_at).toLocaleDateString()}
              </p>
            </article>
          ))
        )}
      </div>

    </section>
  );
};
