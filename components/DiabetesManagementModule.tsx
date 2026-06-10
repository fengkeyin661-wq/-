import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DiabetesManagementData,
  DiabetesScreeningRecord,
  DiabetesAssessmentResult,
  DiabetesStandaloneParticipant,
} from '../types';
import {
  createEmptyDiabetesManagement,
  createScreeningId,
} from '../services/diabetesAssessmentService';
import { importDiabetesScreeningExcel } from '../services/diabetesScreeningImportService';
import {
  reevaluateStandalone,
  saveStandaloneParticipant,
  deleteStandaloneParticipant,
  deleteStandaloneParticipants,
  updateStandaloneProfile,
  type StandaloneProfileInput,
} from '../services/diabetesStandaloneService';
import { DiabetesAssessmentReport } from './DiabetesAssessmentReport';
import { DiabetesReportEditor } from './DiabetesReportEditor';

interface Props {
  participants: DiabetesStandaloneParticipant[];
  currentParticipant: DiabetesStandaloneParticipant | null;
  onSelectParticipant: (p: DiabetesStandaloneParticipant | null) => void;
  onRefresh: () => void | Promise<void>;
  isSaving?: boolean;
}

const emptyScreening = (): DiabetesScreeningRecord => ({
  id: createScreeningId(),
  screeningDate: new Date().toISOString().slice(0, 10),
  activityName: '社区糖尿病并发症筛查',
  source: 'manual',
  glucoseUnit: 'mmol/L',
});

const profileFromParticipant = (p: DiabetesStandaloneParticipant): StandaloneProfileInput => ({
  name: p.name || '',
  checkupId: p.checkupId || '',
  gender: p.gender || '',
  age: p.age,
  phone: p.phone || '',
  idCard: p.idCard || '',
  checkupCount: p.checkupCount,
  checkStatus: p.checkStatus || '',
});

export const DiabetesManagementModule: React.FC<Props> = ({
  participants,
  currentParticipant,
  onSelectParticipant,
  onRefresh,
  isSaving = false,
}) => {
  const [dmData, setDmData] = useState<DiabetesManagementData>(createEmptyDiabetesManagement());
  const [screening, setScreening] = useState<DiabetesScreeningRecord>(emptyScreening());
  const [result, setResult] = useState<DiabetesAssessmentResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [localSaving, setLocalSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileForm, setProfileForm] = useState<StandaloneProfileInput>({ name: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [reportEditing, setReportEditing] = useState(false);
  const [reportSaving, setReportSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentParticipant) {
      setDmData(createEmptyDiabetesManagement());
      setScreening(emptyScreening());
      setResult(null);
      return;
    }
    const dm = currentParticipant.diabetesManagement || createEmptyDiabetesManagement();
    setDmData(dm);
    const latest = [...(dm.screenings || [])].sort((a, b) =>
      (b.screeningDate || '').localeCompare(a.screeningDate || '')
    )[0];
    setScreening(latest || emptyScreening());
    const cachedReport = currentParticipant.diabetesReport || null;
    setResult(cachedReport);

    if (!cachedReport && (dm.screenings?.length ?? 0) > 0) {
      void reevaluateStandalone(currentParticipant).then((report) => {
        setResult(report);
        void onRefresh();
      });
    }
    setProfileForm(profileFromParticipant(currentParticipant));
    setProfileEditing(false);
    setReportEditing(false);
  }, [currentParticipant?.id]);

  const filteredParticipants = useMemo(() => {
    let list = [...participants];
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.checkupId || '').includes(term) ||
          (p.phone || '').includes(term) ||
          (p.idCard || '').includes(term)
      );
    }
    return list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [participants, searchTerm]);

  const allFilteredSelected =
    filteredParticipants.length > 0 &&
    filteredParticipants.every((p) => selectedIds.has(p.id));

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredParticipants.forEach((p) => next.delete(p.id));
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredParticipants.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const buildParticipantDraft = (): DiabetesStandaloneParticipant | null => {
    if (!currentParticipant) return null;
    const mergedDm: DiabetesManagementData = {
      ...dmData,
      screenings: appendOrUpdateScreening(dmData.screenings || [], screening),
      annualCheckupLinked: false,
    };
    return {
      ...currentParticipant,
      diabetesManagement: mergedDm,
      updatedAt: new Date().toISOString(),
    };
  };

  const handleEvaluate = async () => {
    const draft = buildParticipantDraft();
    if (!draft) return;
    if (!window.confirm('重新生成将覆盖当前报告内容（含手工修改），是否继续？')) {
      return;
    }
    setReportEditing(false);
    setDmData(draft.diabetesManagement);
    const report = await reevaluateStandalone(draft);
    setResult(report);
    await onRefresh();
  };

  const handleSaveReportEdit = async (updated: DiabetesAssessmentResult) => {
    if (!currentParticipant) return;
    setReportSaving(true);
    try {
      const draft = buildParticipantDraft();
      if (!draft) return;
      await saveStandaloneParticipant({ ...draft, diabetesReport: updated });
      setResult(updated);
      setReportEditing(false);
      await onRefresh();
      alert('报告修改已保存');
    } finally {
      setReportSaving(false);
    }
  };

  const handleSave = async () => {
    const draft = buildParticipantDraft();
    if (!draft || !result) return;
    setLocalSaving(true);
    try {
      await saveStandaloneParticipant({ ...draft, diabetesReport: result });
      await onRefresh();
      alert('专项评估已保存');
    } finally {
      setLocalSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!currentParticipant) return;
    setProfileSaving(true);
    try {
      const res = await updateStandaloneProfile(currentParticipant.id, {
        ...profileForm,
        name: profileForm.name.trim(),
      });
      if (!res.success || !res.participant) {
        alert(res.message || '保存失败');
        return;
      }
      onSelectParticipant(res.participant);
      setResult(res.participant.diabetesReport || null);
      setProfileForm(profileFromParticipant(res.participant));
      setProfileEditing(false);
      await onRefresh();
      alert('基本信息已更新，评估报告已按新信息重新生成');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleBatchDelete = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;

    const picked = filteredParticipants.filter((p) => selectedIds.has(p.id));
    const preview = picked
      .slice(0, 5)
      .map((p) => p.name || p.checkupId || '未命名')
      .join('、');
    const previewSuffix = ids.length > 5 ? ` 等 ${ids.length} 人` : '';

    if (
      !window.confirm(
        `确定批量删除 ${ids.length} 份专项筛查评估报告？\n\n${preview}${previewSuffix}\n\n将清除筛查记录与评估报告，此操作不可恢复。`
      )
    ) {
      return;
    }

    setBatchDeleting(true);
    try {
      const res = await deleteStandaloneParticipants(ids);
      if (!res.success) {
        alert(res.message || '批量删除失败');
        return;
      }
      if (currentParticipant && selectedIds.has(currentParticipant.id)) {
        onSelectParticipant(null);
      }
      setSelectedIds(new Set());
      await onRefresh();
    } finally {
      setBatchDeleting(false);
    }
  };

  const handleDeleteParticipant = async (p: DiabetesStandaloneParticipant) => {
    const label = p.name || p.checkupId || '该参与者';
    if (
      !window.confirm(
        `确定删除「${label}」的专项筛查档案？\n\n将清除其筛查记录与评估报告，此操作不可恢复。`
      )
    ) {
      return;
    }
    setDeletingId(p.id);
    try {
      const res = await deleteStandaloneParticipant(p.id);
      if (!res.success) {
        alert(res.message || '删除失败');
        return;
      }
      if (currentParticipant?.id === p.id) {
        onSelectParticipant(null);
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
      await onRefresh();
    } finally {
      setDeletingId(null);
    }
  };

  const handleImport = async (file: File) => {
    setIsImporting(true);
    setImportLogs([]);
    try {
      const res = await importDiabetesScreeningExcel(file, {
        onProgress: (line) => setImportLogs((prev) => [...prev, line]),
      });
      setImportLogs((prev) => [...prev, res.message || '完成']);
      if (res.success) {
        await onRefresh();
      } else if (res.imported === 0) {
        alert(res.message || '导入失败');
      }
    } finally {
      setIsImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-2">糖尿病专项筛查评估</h3>
        <p className="text-sm text-slate-500 mb-4">
          独立于健康档案的专项评估模块。参与者<strong>无需预先建档</strong>，上传筛查 Excel 后 AI 逐行解析并生成分域评估报告；数据保存在专项筛查库中。
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="搜索姓名、体检编号、电话…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[200px]"
          />
          <select
            value={currentParticipant?.id || ''}
            onChange={(e) => {
              const next = participants.find((p) => p.id === e.target.value);
              if (next) onSelectParticipant(next);
            }}
            className="flex-1 min-w-[260px] border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
          >
            <option value="" disabled>
              请选择筛查参与者（{filteredParticipants.length} 人）
            </option>
            {filteredParticipants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} | {p.checkupId || p.phone || p.participantKey.slice(0, 12)}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-teal-700 mt-3">
          已入库 {participants.length} 人 · 本模块不写入 health_archives，后续正式建档时可另行关联
        </p>

        {filteredParticipants.length > 0 && (
          <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
              <span className="text-xs text-slate-600">
                已选 {selectedIds.size} / {filteredParticipants.length} 人
              </span>
              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={selectedIds.size === 0 || batchDeleting || isImporting}
                className="text-red-600 hover:text-red-800 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {batchDeleting ? '批量删除中…' : '批量删除评估报告'}
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 w-10">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        disabled={batchDeleting || isImporting}
                        aria-label="全选当前列表"
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="text-left px-3 py-2 font-medium">姓名</th>
                    <th className="text-left px-3 py-2 font-medium">体检编号</th>
                    <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">电话</th>
                    <th className="text-left px-3 py-2 font-medium hidden md:table-cell">更新时间</th>
                    <th className="text-right px-3 py-2 font-medium w-28">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((p) => {
                    const selected = currentParticipant?.id === p.id;
                    return (
                      <tr
                        key={p.id}
                        className={`border-t border-slate-100 ${selected ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(p.id)}
                            onChange={() => toggleSelectOne(p.id)}
                            disabled={batchDeleting || isImporting}
                            aria-label={`选择 ${p.name || '未命名'}`}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">{p.name || '未命名'}</td>
                        <td className="px-3 py-2 text-slate-600">{p.checkupId || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 hidden sm:table-cell">{p.phone || '—'}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs hidden md:table-cell">
                          {(p.updatedAt || p.createdAt || '').slice(0, 10) || '—'}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onSelectParticipant(p)}
                            className="text-teal-700 hover:text-teal-900 text-xs font-medium mr-3"
                          >
                            {selected ? '已选' : '查看'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteParticipant(p)}
                            disabled={deletingId === p.id || batchDeleting || isImporting}
                            className="text-red-600 hover:text-red-800 text-xs font-medium disabled:opacity-50"
                          >
                            {deletingId === p.id ? '删除中…' : '删除'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-2">上传筛查汇总 Excel</h3>
        <p className="text-sm text-slate-500 mb-3">
          直接上传并发症初筛汇总表。识别体检编号、身份证或联系电话即可入库，无需系统中已有健康档案。
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={isImporting}
          className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
        >
          {isImporting ? 'AI 解析生成中...' : '上传 Excel 汇总表'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
          }}
        />
        {importLogs.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto bg-slate-50 rounded-lg p-3 text-xs text-slate-600 font-mono space-y-0.5">
            {importLogs.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
      </div>

      {currentParticipant && (
        <>
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-bold text-slate-800">个人基本信息</h3>
              {!profileEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    setProfileForm(profileFromParticipant(currentParticipant));
                    setProfileEditing(true);
                  }}
                  className="text-teal-700 hover:text-teal-900 text-sm font-medium"
                >
                  修改基本信息
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileForm(profileFromParticipant(currentParticipant));
                      setProfileEditing(false);
                    }}
                    disabled={profileSaving}
                    className="text-slate-600 hover:text-slate-800 text-sm disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={profileSaving || !profileForm.name.trim()}
                    className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50"
                  >
                    {profileSaving ? '保存中…' : '保存基本信息'}
                  </button>
                </div>
              )}
            </div>

            {!profileEditing ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-slate-600">
                <div>姓名：{currentParticipant.name}</div>
                <div>体检编号：{currentParticipant.checkupId || '—'}</div>
                <div>性别：{currentParticipant.gender || '—'}</div>
                <div>年龄：{currentParticipant.age ?? '—'}</div>
                <div>联系电话：{currentParticipant.phone || '—'}</div>
                <div>身份证号：{currentParticipant.idCard || '—'}</div>
                <div>体检次数：{currentParticipant.checkupCount ?? '—'}</div>
                <div>检查状态：{currentParticipant.checkStatus || '—'}</div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <label className="text-sm">
                  <span className="block text-slate-600 mb-1">姓名 *</span>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-slate-600 mb-1">体检编号</span>
                  <input
                    type="text"
                    value={profileForm.checkupId || ''}
                    onChange={(e) => setProfileForm((f) => ({ ...f, checkupId: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="6 位数字"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-slate-600 mb-1">性别</span>
                  <select
                    value={profileForm.gender || ''}
                    onChange={(e) => setProfileForm((f) => ({ ...f, gender: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">未填写</option>
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block text-slate-600 mb-1">年龄</span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={profileForm.age ?? ''}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        age: e.target.value === '' ? undefined : Number(e.target.value),
                      }))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-slate-600 mb-1">联系电话</span>
                  <input
                    type="tel"
                    value={profileForm.phone || ''}
                    onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm sm:col-span-2 lg:col-span-1">
                  <span className="block text-slate-600 mb-1">身份证号</span>
                  <input
                    type="text"
                    value={profileForm.idCard || ''}
                    onChange={(e) => setProfileForm((f) => ({ ...f, idCard: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-slate-600 mb-1">体检次数</span>
                  <input
                    type="number"
                    min={0}
                    value={profileForm.checkupCount ?? ''}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        checkupCount: e.target.value === '' ? undefined : Number(e.target.value),
                      }))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-slate-600 mb-1">检查状态</span>
                  <input
                    type="text"
                    value={profileForm.checkStatus || ''}
                    onChange={(e) => setProfileForm((f) => ({ ...f, checkStatus: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
              </div>
            )}

            <p className="text-xs text-amber-700 mt-4">
              专项筛查模式：未关联年度健康体检档案。修改性别等信息后将自动重新生成评估报告。体检编号/身份证/电话变更后请勿与已有档案重复。
            </p>
          </div>

          {(dmData.screenings?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-2">
                筛查记录（{dmData.screenings.length} 次）
              </h3>
              <ul className="text-sm text-slate-600 space-y-1">
                {[...dmData.screenings]
                  .sort((a, b) => (b.screeningDate || '').localeCompare(a.screeningDate || ''))
                  .map((s, i) => (
                    <li key={s.id || i}>
                      {s.screeningDate} — {s.activityName}
                      {s.fastingGlucose != null ? ` | 空腹 ${s.fastingGlucose}` : ''}
                      {s.postprandialRandomGlucose != null
                        ? ` | 餐后 ${s.postprandialRandomGlucose}`
                        : ''}
                      <button
                        type="button"
                        className="ml-2 text-teal-600 text-xs"
                        onClick={() => setScreening(s)}
                      >
                        查看
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleEvaluate}
              disabled={isSaving || localSaving || reportSaving}
              className="bg-teal-600 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50"
            >
              重新生成评估报告
            </button>
            {result && !reportEditing && (
              <button
                type="button"
                onClick={() => setReportEditing(true)}
                disabled={isSaving || localSaving || reportSaving}
                className="border border-teal-600 text-teal-700 px-5 py-2 rounded-lg font-bold disabled:opacity-50"
              >
                修改报告
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!result || isSaving || localSaving || reportEditing || reportSaving}
              className="bg-slate-800 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50"
            >
              {localSaving ? '保存中...' : '保存专项评估'}
            </button>
          </div>

          {result && reportEditing && (
            <DiabetesReportEditor
              report={result}
              saving={reportSaving}
              onCancel={() => setReportEditing(false)}
              onSave={handleSaveReportEdit}
            />
          )}

          {result && !reportEditing && (
            <DiabetesAssessmentReport
              report={result}
              patientName={currentParticipant.name}
              profile={{
                checkupId: currentParticipant.checkupId || '',
                name: currentParticipant.name,
                gender: currentParticipant.gender || '',
                age: currentParticipant.age,
                department: '糖尿病专项筛查',
                phone: currentParticipant.phone,
              }}
            />
          )}
        </>
      )}

      {!currentParticipant && participants.length > 0 && (
        <p className="text-sm text-slate-500 text-center py-8">请从上方下拉列表选择参与者查看评估报告</p>
      )}

      {participants.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-8">暂无专项筛查数据，请上传 Excel 汇总表开始导入</p>
      )}
    </div>
  );
};

const appendOrUpdateScreening = (
  list: DiabetesScreeningRecord[],
  incoming: DiabetesScreeningRecord
): DiabetesScreeningRecord[] => {
  const id = incoming.id || createScreeningId();
  const item = { ...incoming, id };
  const idx = list.findIndex(
    (s) => s.id === id || (s.screeningDate === item.screeningDate && s.activityName === item.activityName)
  );
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...list[idx], ...item };
    return next;
  }
  return [...list, item];
};
