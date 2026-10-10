import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CriticalTrackRecord } from '../types';
import type { HealthArchive } from '../services/dataService';
import { updateCriticalTrack } from '../services/dataService';
import {
  buildFollowUpWorklist,
  formatLocalYmd,
  getLatestFollowUp,
  isCriticalContactDeferred,
  isCriticalContactRetryDue,
  isCriticalFollowUpPending,
  listArchivedCriticalFollowUps,
  listCriticalContactRetryDue,
  matchesCriticalArchiveSearch,
  resolveCriticalTrackStatus,
  type FollowUpWorklistRow,
} from '../services/followUpLinkageService';
import {
  exportCriticalFollowUpArchives,
  exportFollowUpWorklistRows,
} from '../services/criticalFollowUpExport';
import { CriticalHandleModal } from './CriticalHandleModal';
import {
  isSmsConfigured,
  resolveArchivePhone,
  sendCriticalSms,
  type SmsSentRole,
} from '../services/smsService';

export type WorklistFilter = 'todo' | 'archived_critical';

interface Props {
  archives: HealthArchive[];
  currentPatientId?: string;
  onSelectPatient: (archive: HealthArchive, options?: { scrollToDetail?: boolean }) => void;
  onRefresh: () => void;
  criticalFocus?: { checkupId: string | null; openModal: boolean; token: number };
  userRole?: SmsSentRole;
}

export const FollowUpWorklistPanel: React.FC<Props> = ({
  archives,
  currentPatientId,
  onSelectPatient,
  onRefresh,
  criticalFocus,
  userRole = 'admin',
}) => {
  const [filter, setFilter] = useState<WorklistFilter>('todo');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalArchive, setModalArchive] = useState<HealthArchive | null>(null);
  const [showContactRetryRemind, setShowContactRetryRemind] = useState(false);
  const contactRetryRemindKeyRef = useRef('');
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const contactRetryDueList = useMemo(() => listCriticalContactRetryDue(archives), [archives]);

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
    if (contactRetryDueList.length === 0) {
      setShowContactRetryRemind(false);
      return;
    }
    const key = `${formatLocalYmd()}:${contactRetryDueList.map((a) => a.checkup_id).sort().join(',')}`;
    contactRetryRemindKeyRef.current = key;
    if (sessionStorage.getItem('crit_contact_retry_popup') === key) return;
    setShowContactRetryRemind(true);
  }, [contactRetryDueList]);

  useEffect(() => {
    if (!criticalFocus?.token) return;
    if (criticalFocus.checkupId) {
      setFilter('todo');
      setSearchQuery(criticalFocus.checkupId);
      const arch = archives.find((a) => a.checkup_id === criticalFocus.checkupId);
      if (arch && criticalFocus.openModal) {
        setModalArchive(arch);
      }
      requestAnimationFrame(() => {
        const el = rowRefs.current[criticalFocus.checkupId!];
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } else {
      setFilter('todo');
    }
  }, [criticalFocus?.token, criticalFocus?.checkupId, criticalFocus?.openModal, archives]);

  const dismissContactRetryRemind = () => {
    if (contactRetryRemindKeyRef.current) {
      sessionStorage.setItem('crit_contact_retry_popup', contactRetryRemindKeyRef.current);
    }
    setShowContactRetryRemind(false);
  };

  const handleCriticalSave = async (
    record: CriticalTrackRecord,
    options?: { sendSms?: boolean; delayContactWeek?: boolean; convertToFollowUp?: boolean },
  ) => {
    if (!modalArchive) return;
    let recordToSave = { ...record };

    if (options?.delayContactWeek) {
      await updateCriticalTrack(modalArchive.checkup_id, recordToSave);
      alert(`已登记电话联系不上，延期至 ${record.contact_retry_due} 再提醒`);
      setModalArchive(null);
      onRefresh();
      return;
    }

    if (options?.sendSms) {
      const phone = resolveArchivePhone(modalArchive);
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        alert('该职工未登记有效手机号，无法发送短信');
        return;
      }
      if (!isSmsConfigured()) {
        alert('短信服务未配置：请部署 send-sms Edge Function 并设置 VITE_SMS_INVOKE_SECRET');
        return;
      }
      const summary = modalArchive.assessment_data?.criticalWarning || record.critical_desc;
      const smsRes = await sendCriticalSms({
        checkupId: modalArchive.checkup_id,
        phone,
        name: modalArchive.name,
        summary,
        sentRole: userRole,
      });
      if (!smsRes.success || smsRes.failCount > 0) {
        alert(`短信发送失败：${smsRes.results[0]?.error || smsRes.message}`);
        return;
      }
      const now = new Date().toLocaleString();
      recordToSave =
        record.status === 'pending_secondary' || record.status === 'archived'
          ? { ...recordToSave, secondary_notify_time: now }
          : { ...recordToSave, initial_notify_time: now };
    }

    await updateCriticalTrack(modalArchive.checkup_id, recordToSave);
    setModalArchive(null);
    onRefresh();
    if (options?.convertToFollowUp) {
      onSelectPatient(modalArchive, { scrollToDetail: true });
    }
  };

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
          <div className="text-sm font-mono font-bold text-slate-700">{routine.date}</div>
          <div className={`text-[10px] mt-0.5 ${overdue ? 'text-red-600 font-bold' : 'text-slate-500'}`}>{text}</div>
        </>
      );
    }
    const track = archive.critical_track;
    const status = resolveCriticalTrackStatus(archive);
    if (critical?.contactRetryDue && (isCriticalContactRetryDue(archive) || isCriticalContactDeferred(archive))) {
      return (
        <>
          <div className="text-sm font-mono font-bold text-amber-800">再联系 {critical.contactRetryDue}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">
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
          <div className="text-sm font-mono font-bold text-slate-700">{track.secondary_due_date}</div>
          <div className={`text-[10px] mt-0.5 ${diff < 0 ? 'text-red-600 font-bold' : 'text-blue-600'}`}>{countdown}</div>
        </>
      );
    }
    return <span className="text-xs text-slate-400">初次通知后生成</span>;
  };

  const renderPriorityFocus = (row: FollowUpWorklistRow) => {
    const items = row.priorityFocusItems || row.routine?.priorityFocusItems || [];
    const risk = row.archive.assessment_data?.riskLevel;
    if (items.length) {
      return (
        <div>
          {risk === 'RED' || risk === 'YELLOW' ? (
            <span
              className={`inline-block mb-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                risk === 'RED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
              }`}
            >
              {risk === 'RED' ? '高风险' : '中风险'}
            </span>
          ) : null}
          <ul className="space-y-0.5">
            {items.slice(0, 3).map((item, i) => (
              <li key={item} className="flex gap-1.5 text-xs text-slate-700">
                <span className="font-black text-amber-700">{i + 1}.</span>
                <span className="line-clamp-2">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    if (row.critical?.item) {
      return <span className="text-xs font-bold text-red-700">{row.critical.item}</span>;
    }
    return <span className="text-slate-400 text-xs">待维护要点</span>;
  };

  const handleExport = () => {
    if (filter === 'archived_critical') {
      exportCriticalFollowUpArchives(displayArchived, 'archived');
    } else {
      exportFollowUpWorklistRows(displayTodoRows);
    }
  };

  return (
    <section className="mb-8 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden animate-fadeIn">
      <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-800">随访工作台 · 待办队列</h2>
          <p className="text-xs text-slate-500 mt-0.5">危急值与 7 日内计划随访合并排序；选人后进入下方工作区录入</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-white rounded-lg p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => setFilter('todo')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold ${
                filter === 'todo' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              待办 ({todoRows.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('archived_critical')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold ${
                filter === 'archived_critical' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              已归档危急值 ({archivedList.length})
            </button>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700"
          >
            导出
          </button>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索姓名、体检编号、危急关键字…"
            className="w-full pl-3 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none"
          />
        </div>
        {searchQuery.trim() ? (
          <button type="button" onClick={() => setSearchQuery('')} className="text-xs font-bold text-teal-600">
            清除
          </button>
        ) : null}
      </div>

      <div className="overflow-auto max-h-[min(420px,50vh)]">
        {filter === 'todo' ? (
          displayTodoRows.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">暂无待办随访任务</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600 font-black sticky top-0 z-10 text-xs uppercase">
                <tr>
                  <th className="p-3">受检人员</th>
                  <th className="p-3">随访类别</th>
                  <th className="p-3 min-w-[140px]">危急值</th>
                  <th className="p-3">计划与倒计时</th>
                  <th className="p-3 min-w-[160px]">本期优先核对</th>
                  <th className="p-3">最近随访</th>
                  <th className="p-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayTodoRows.map((row) => {
                  const { archive } = row;
                  const isCriticalRow = Boolean(row.critical);
                  const selected = archive.checkup_id === currentPatientId;
                  return (
                    <tr
                      key={archive.checkup_id}
                      ref={(el) => {
                        rowRefs.current[archive.checkup_id] = el;
                      }}
                      className={`transition-colors ${
                        isCriticalRow ? 'bg-red-50/40 border-l-4 border-l-red-500' : 'border-l-4 border-l-transparent'
                      } ${selected ? 'ring-2 ring-inset ring-teal-400 bg-teal-50/30' : 'hover:bg-slate-50'}`}
                    >
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{archive.name}</div>
                        <div className="text-[11px] text-slate-500">{archive.checkup_id}</div>
                        <div className="text-[11px] text-slate-400">{archive.department}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                            row.critical
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-100'
                          }`}
                        >
                          {categoryLabel(row)}
                        </span>
                      </td>
                      <td className="p-3">
                        {row.critical ? (
                          <div className="space-y-1">
                            <div className="font-bold text-red-700 text-xs">{row.critical.item}</div>
                            {row.critical.level ? (
                              <div className="text-[10px] text-orange-600 font-bold">{row.critical.level}</div>
                            ) : null}
                            <div className="text-[10px] text-slate-600 line-clamp-2" title={row.critical.desc}>
                              {row.critical.desc}
                            </div>
                            <div className="text-[10px] font-bold text-red-600">{row.critical.statusLabel}</div>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="p-3">{planCell(row)}</td>
                      <td className="p-3 max-w-[200px]">
                        {renderPriorityFocus(row)}
                      </td>
                      <td className="p-3 text-xs text-slate-500">
                        {getLatestFollowUp(archive.follow_ups)?.date || '无'}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1 items-center">
                          {isCriticalFollowUpPending(archive) ? (
                            <button
                              type="button"
                              onClick={() => setModalArchive(archive)}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-red-600 text-white hover:bg-red-700"
                            >
                              危急处置
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => onSelectPatient(archive, { scrollToDetail: true })}
                            className="px-2 py-1 rounded text-[10px] font-bold bg-teal-600 text-white hover:bg-teal-700"
                          >
                            开始随访
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : displayArchived.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">暂无已归档危急值记录</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 font-black sticky top-0 z-10 text-xs uppercase">
              <tr>
                <th className="p-3">受检人员</th>
                <th className="p-3">危急项目</th>
                <th className="p-3">描述</th>
                <th className="p-3">归档更新</th>
                <th className="p-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayArchived.map((arch) => (
                <tr key={arch.checkup_id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-bold text-slate-800">{arch.name}</div>
                    <div className="text-[11px] text-slate-500">{arch.checkup_id}</div>
                  </td>
                  <td className="p-3 text-red-700 font-bold text-xs">
                    {arch.critical_track?.critical_item || '—'}
                  </td>
                  <td className="p-3 text-xs text-slate-600 line-clamp-2">
                    {arch.critical_track?.critical_desc || arch.assessment_data?.criticalWarning || '—'}
                  </td>
                  <td className="p-3 text-xs text-slate-500">
                    {new Date(arch.updated_at || arch.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => onSelectPatient(arch, { scrollToDetail: true })}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      查看随访
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalArchive ? (
        <CriticalHandleModal
          archive={modalArchive}
          onClose={() => setModalArchive(null)}
          onSave={handleCriticalSave}
          onConvertToFollowUp={() => onSelectPatient(modalArchive, { scrollToDetail: true })}
        />
      ) : null}

      {showContactRetryRemind && contactRetryDueList.length > 0 ? (
        <div className="fixed inset-0 bg-slate-900/60 z-[80] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 border-t-8 border-amber-500">
            <h3 className="text-xl font-bold text-amber-800 mb-1">危急值再联系提醒</h3>
            <p className="text-sm text-slate-600 mb-4">
              以下 {contactRetryDueList.length} 人此前因电话联系不上已延期一周，今日起需再次联系。
            </p>
            <ul className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg mb-5">
              {contactRetryDueList.map((arch) => (
                <li key={arch.checkup_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800">{arch.name}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {arch.checkup_id} · {arch.critical_track?.critical_item || '危急值'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      dismissContactRetryRemind();
                      setFilter('todo');
                      setModalArchive(arch);
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white hover:bg-amber-700"
                  >
                    立即处理
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={dismissContactRetryRemind}
                className="px-5 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                稍后处理
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
