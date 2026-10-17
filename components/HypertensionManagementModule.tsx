import React, { useEffect, useMemo, useRef, useState } from 'react';

import type {

  HypertensionAssessmentResult,

  HypertensionIndicatorProfile,

  HypertensionStandaloneParticipant,

} from '../types';

import type { HealthArchive } from '../services/dataService';

import { importHypertensionScreeningExcel } from '../services/hypertensionScreeningImportService';

import {

  fetchHypertensionStandaloneParticipants,

  reevaluateHypertensionStandalone,

  resolveHypertensionRecordForParticipant,

  deleteHypertensionStandaloneParticipant,

  deleteHypertensionStandaloneParticipants,

  batchReevaluateHypertensionStandaloneReports,

} from '../services/hypertensionStandaloneService';

import {

  buildHypertensionIndicatorProfile,

  getLatestHypertensionScreeningFromRecord,

} from '../services/hypertensionIndicatorProfileService';

import { HypertensionIndicatorProfilePanel } from './HypertensionIndicatorProfilePanel';

import { HypertensionAssessmentReport } from './HypertensionAssessmentReport';



interface Props {

  participants: HypertensionStandaloneParticipant[];

  currentParticipant: HypertensionStandaloneParticipant | null;

  onSelectParticipant: (p: HypertensionStandaloneParticipant | null) => void;

  onRefresh: () => void | Promise<void>;

  archives?: HealthArchive[];

}



export const HypertensionManagementModule: React.FC<Props> = ({

  participants,

  currentParticipant,

  onSelectParticipant,

  onRefresh,

  archives = [],

}) => {

  const [result, setResult] = useState<HypertensionAssessmentResult | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  const [reevaluating, setReevaluating] = useState(false);

  const [importLogs, setImportLogs] = useState<string[]>([]);

  const [isImporting, setIsImporting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [batchDeleting, setBatchDeleting] = useState(false);

  const [batchUpdating, setBatchUpdating] = useState(false);

  const [batchUpdateLogs, setBatchUpdateLogs] = useState<string[]>([]);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);



  const linkedArchive = useMemo(() => {

    if (!currentParticipant) return null;

    const cid = currentParticipant.linkedArchiveCheckupId || currentParticipant.checkupId;

    if (!cid) return null;

    return archives.find((a) => a.checkup_id === cid) || null;

  }, [currentParticipant, archives]);



  const indicatorProfile: HypertensionIndicatorProfile | null = useMemo(() => {

    if (!currentParticipant) return null;

    const record = resolveHypertensionRecordForParticipant(currentParticipant, linkedArchive);

    const latest = getLatestHypertensionScreeningFromRecord(record);

    return buildHypertensionIndicatorProfile(record, latest, {

      linkedArchiveCheckupId: linkedArchive?.checkup_id || currentParticipant.linkedArchiveCheckupId,

      archiveCheckupDate: linkedArchive?.health_record?.profile?.checkupDate,

    });

  }, [currentParticipant, linkedArchive]);



  useEffect(() => {

    if (!currentParticipant) {

      setResult(null);

      return;

    }

    setResult(currentParticipant.hypertensionReport || null);

    if (!currentParticipant.hypertensionReport) {

      void reevaluateHypertensionStandalone(currentParticipant, linkedArchive).then((r) => {

        setResult(r);

        void onRefresh();

      });

    }

  }, [currentParticipant?.id, linkedArchive?.checkup_id]);



  const filtered = useMemo(() => {

    const term = searchTerm.trim().toLowerCase();

    let list = [...participants];

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

    filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));



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

        filtered.forEach((p) => next.delete(p.id));

        return next;

      });

      return;

    }

    setSelectedIds((prev) => {

      const next = new Set(prev);

      filtered.forEach((p) => next.add(p.id));

      return next;

    });

  };



  const handleReevaluate = async () => {

    if (!currentParticipant) return;

    if (!window.confirm('重新生成将覆盖当前健康管理方案，是否继续？')) return;

    setReevaluating(true);

    try {

      const report = await reevaluateHypertensionStandalone(currentParticipant, linkedArchive);

      setResult(report);

      await onRefresh();

    } finally {

      setReevaluating(false);

    }

  };



  const handleDelete = async (p: HypertensionStandaloneParticipant) => {

    if (!window.confirm(`确定删除「${p.name}」的高血压专项档案？`)) return;

    setDeletingId(p.id);

    try {

      const res = await deleteHypertensionStandaloneParticipant(p.id);

      if (!res.success) {

        alert(res.message || '删除失败');

        return;

      }

      if (currentParticipant?.id === p.id) onSelectParticipant(null);

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



  const handleBatchUpdateReports = async () => {

    const ids = selectedIds.size > 0 ? [...selectedIds] : participants.map((p) => p.id);

    if (!ids.length) {

      alert('暂无专项筛查档案');

      return;

    }

    const scope = selectedIds.size > 0 ? `所选 ${ids.length} 人` : `全部 ${ids.length} 人`;

    if (!window.confirm(`确定批量更新 ${scope} 的健康管理方案？手工修改的内容将被覆盖。`)) {

      return;

    }

    setBatchUpdating(true);

    setBatchUpdateLogs([]);

    try {

      const res = await batchReevaluateHypertensionStandaloneReports({

        ids,

        onProgress: (line) => setBatchUpdateLogs((prev) => [...prev, line]),

      });

      await onRefresh();

      alert(`批量更新完成：成功 ${res.updated} 人，失败 ${res.failed} 人`);

    } finally {

      setBatchUpdating(false);

    }

  };



  const handleBatchDelete = async () => {

    const ids = [...selectedIds];

    if (!ids.length) return;

    const picked = filtered.filter((p) => selectedIds.has(p.id));

    const preview = picked

      .slice(0, 5)

      .map((p) => p.name || p.checkupId || '未命名')

      .join('、');

    const previewSuffix = ids.length > 5 ? ` 等 ${ids.length} 人` : '';

    if (

      !window.confirm(

        `确定批量删除 ${ids.length} 份高血压专项档案？\n\n${preview}${previewSuffix}\n\n此操作不可恢复。`

      )

    ) {

      return;

    }

    setBatchDeleting(true);

    try {

      const res = await deleteHypertensionStandaloneParticipants(ids);

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



  const handleImport = async (file: File) => {

    setIsImporting(true);

    setImportLogs([]);

    try {

      const res = await importHypertensionScreeningExcel(file, {

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

        <h3 className="text-lg font-bold text-slate-800 mb-2">高血压专项筛查</h3>

        <p className="text-sm text-slate-500 mb-4">

          独立于健康档案的专项评估模块。参与者<strong>无需预先建档</strong>，上传筛查 Excel 后 AI 逐行解析并生成健康管理指导方案；建档时血压偏高人群也会自动纳入。

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

              const p = participants.find((x) => x.id === e.target.value);

              onSelectParticipant(p || null);

            }}

            className="flex-1 min-w-[260px] border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"

          >

            <option value="" disabled>

              请选择参与者（{filtered.length} 人）

            </option>

            {filtered.map((p) => (

              <option key={p.id} value={p.id}>

                {p.name} | {p.checkupId || p.phone || p.participantKey.slice(0, 12)}

              </option>

            ))}

          </select>

        </div>

        <p className="text-xs text-indigo-700 mt-3">

          已入库 {participants.length} 人 · 本模块 Excel 导入不写入 health_archives，正式建档后可自动关联

        </p>



        {filtered.length > 0 && (

          <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">

            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">

              <span className="text-xs text-slate-600">

                已选 {selectedIds.size} / {filtered.length} 人

              </span>

              <div className="flex flex-wrap gap-3">

                <button

                  type="button"

                  onClick={handleBatchUpdateReports}

                  disabled={participants.length === 0 || batchUpdating || batchDeleting || isImporting}

                  className="text-indigo-700 hover:text-indigo-900 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"

                >

                  {batchUpdating ? '批量更新中…' : '批量更新已生成方案'}

                </button>

                <button

                  type="button"

                  onClick={handleBatchDelete}

                  disabled={selectedIds.size === 0 || batchDeleting || batchUpdating || isImporting}

                  className="text-red-600 hover:text-red-800 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"

                >

                  {batchDeleting ? '批量删除中…' : '批量删除专项档案'}

                </button>

              </div>

            </div>

            <div className="max-h-56 overflow-y-auto">

              <table className="w-full text-sm">

                <thead className="bg-slate-50 sticky top-0">

                  <tr>

                    <th className="px-2 py-2 w-8">

                      <input

                        type="checkbox"

                        checked={allFilteredSelected}

                        onChange={toggleSelectAllFiltered}

                        disabled={batchDeleting || batchUpdating || isImporting}

                        aria-label="全选"

                        className="rounded border-slate-300"

                      />

                    </th>

                    <th className="text-left px-3 py-2">姓名</th>

                    <th className="text-left px-3 py-2">体检编号</th>

                    <th className="text-left px-3 py-2 hidden sm:table-cell">电话</th>

                    <th className="text-right px-3 py-2">操作</th>

                  </tr>

                </thead>

                <tbody>

                  {filtered.map((p) => {

                    const selected = currentParticipant?.id === p.id;

                    return (

                      <tr

                        key={p.id}

                        className={`border-t border-slate-100 hover:bg-slate-50 ${selected ? 'bg-indigo-50/50' : ''}`}

                      >

                        <td className="px-2 py-2">

                          <input

                            type="checkbox"

                            checked={selectedIds.has(p.id)}

                            onChange={() => toggleSelectOne(p.id)}

                            disabled={batchDeleting || batchUpdating || isImporting}

                            aria-label={`选择 ${p.name || '未命名'}`}

                            className="rounded border-slate-300"

                          />

                        </td>

                        <td className="px-3 py-2 font-medium text-slate-800">{p.name || '未命名'}</td>

                        <td className="px-3 py-2 text-slate-600">{p.checkupId || '—'}</td>

                        <td className="px-3 py-2 text-slate-600 hidden sm:table-cell">{p.phone || '—'}</td>

                        <td className="px-3 py-2 text-right whitespace-nowrap">

                          <button

                            type="button"

                            className="text-indigo-700 text-xs font-medium mr-3"

                            onClick={() => onSelectParticipant(p)}

                          >

                            {selected ? '已选' : '查看'}

                          </button>

                          <button

                            type="button"

                            className="text-red-600 text-xs disabled:opacity-50"

                            onClick={() => handleDelete(p)}

                            disabled={deletingId === p.id || batchDeleting || isImporting}

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



        {batchUpdateLogs.length > 0 && (

          <div className="mt-3 max-h-32 overflow-y-auto bg-slate-50 rounded-lg p-3 text-xs text-slate-600 font-mono space-y-0.5">

            {batchUpdateLogs.map((l, i) => (

              <div key={i}>{l}</div>

            ))}

          </div>

        )}

      </div>



      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">

        <h3 className="text-lg font-bold text-slate-800 mb-2">上传筛查汇总 Excel</h3>

        <p className="text-sm text-slate-500 mb-3">

          直接上传高血压专项筛查汇总表。识别体检编号、身份证或联系电话即可入库，支持固定列名映射与 AI 智能补全。

        </p>

        <button

          type="button"

          onClick={() => fileRef.current?.click()}

          disabled={isImporting}

          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"

        >

          {isImporting ? 'AI 解析生成中…' : '上传 Excel 汇总表'}

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

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm text-slate-600">

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">

              <div>姓名：{currentParticipant.name}</div>

              <div>体检编号：{currentParticipant.checkupId || '—'}</div>

              <div>性别：{currentParticipant.gender || '—'}</div>

              <div>年龄：{currentParticipant.age ?? '—'}</div>

            </div>

            <p className="text-xs text-indigo-700 mt-3">

              {linkedArchive

                ? `已关联健康档案 ${linkedArchive.checkup_id}，指标自动同步年度体检数据。`

                : '未关联年度档案；请确保体检编号与正式建档一致。'}

            </p>

          </div>



          {indicatorProfile && (

            <HypertensionIndicatorProfilePanel

              profile={indicatorProfile}

              patientName={currentParticipant.name}

            />

          )}



          <div className="flex gap-3">

            <button

              type="button"

              onClick={handleReevaluate}

              disabled={reevaluating}

              className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50"

            >

              {reevaluating ? '生成中…' : '重新生成健康管理方案'}

            </button>

          </div>



          {result && (

            <HypertensionAssessmentReport

              report={result}

              patientName={currentParticipant.name}

              profile={{

                checkupId: currentParticipant.checkupId || '',

                name: currentParticipant.name,

                gender: currentParticipant.gender || '',

                age: currentParticipant.age,

                department: '高血压专项筛查',

                phone: currentParticipant.phone,

              }}

            />

          )}

        </>

      )}



      {!currentParticipant && participants.length > 0 && (

        <p className="text-sm text-slate-500 text-center py-8">请从上方选择参与者</p>

      )}

      {participants.length === 0 && (

        <p className="text-sm text-slate-500 text-center py-8">

          暂无专项档案。可上传 Excel 汇总表导入，或血压偏高职工在正式建档保存后自动纳入。

        </p>

      )}

    </div>

  );

};



export const refreshHypertensionParticipants = fetchHypertensionStandaloneParticipants;


