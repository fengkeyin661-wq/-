import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LipidAssessmentResult, LipidIndicatorProfile, LipidStandaloneParticipant } from '../types';
import type { HealthArchive } from '../services/dataService';
import { importLipidScreeningExcel } from '../services/lipidScreeningImportService';
import {
  reevaluateLipidStandalone,
  resolveLipidRecordForParticipant,
  deleteLipidStandaloneParticipant,
  deleteLipidStandaloneParticipants,
  batchReevaluateLipidStandaloneReports,
} from '../services/lipidStandaloneService';
import {
  buildLipidIndicatorProfile,
  getLatestLipidScreeningFromRecord,
} from '../services/lipidIndicatorProfileService';
import { LipidIndicatorProfilePanel } from './LipidIndicatorProfilePanel';
import { LipidAssessmentReport } from './LipidAssessmentReport';

interface Props {
  participants: LipidStandaloneParticipant[];
  currentParticipant: LipidStandaloneParticipant | null;
  onSelectParticipant: (p: LipidStandaloneParticipant | null) => void;
  onRefresh: () => void | Promise<void>;
  archives?: HealthArchive[];
}

export const LipidManagementModule: React.FC<Props> = ({
  participants,
  currentParticipant,
  onSelectParticipant,
  onRefresh,
  archives = [],
}) => {
  const [result, setResult] = useState<LipidAssessmentResult | null>(null);
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

  const indicatorProfile: LipidIndicatorProfile | null = useMemo(() => {
    if (!currentParticipant) return null;
    const record = resolveLipidRecordForParticipant(currentParticipant, linkedArchive);
    const latest = getLatestLipidScreeningFromRecord(record);
    return buildLipidIndicatorProfile(record, latest, {
      linkedArchiveCheckupId: linkedArchive?.checkup_id || currentParticipant.linkedArchiveCheckupId,
      archiveCheckupDate: linkedArchive?.health_record?.profile?.checkupDate,
    });
  }, [currentParticipant, linkedArchive]);

  useEffect(() => {
    if (!currentParticipant) {
      setResult(null);
      return;
    }
    setResult(currentParticipant.lipidReport || null);
    if (!currentParticipant.lipidReport) {
      void reevaluateLipidStandalone(currentParticipant, linkedArchive).then((r) => {
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
          (p.phone || '').includes(term)
      );
    }
    return list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [participants, searchTerm]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  const handleReevaluate = async () => {
    if (!currentParticipant) return;
    if (!window.confirm('重新生成将覆盖当前健康管理方案，是否继续？')) return;
    setReevaluating(true);
    try {
      const report = await reevaluateLipidStandalone(currentParticipant, linkedArchive);
      setResult(report);
      await onRefresh();
    } finally {
      setReevaluating(false);
    }
  };

  const handleImport = async (file: File) => {
    setIsImporting(true);
    setImportLogs([]);
    try {
      const res = await importLipidScreeningExcel(file, {
        onProgress: (line) => setImportLogs((prev) => [...prev, line]),
      });
      setImportLogs((prev) => [...prev, res.message || '完成']);
      if (res.success) await onRefresh();
      else if (res.imported === 0) alert(res.message || '导入失败');
    } finally {
      setIsImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-2">血脂异常专项管理</h3>
        <p className="text-sm text-slate-500 mb-4">
          参照专项筛查模式：上传 Excel 或从健康档案点击「血脂异常」标签纳入。依据《中国血脂管理指南》生成分项指标档案与健康管理方案。
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="搜索姓名、体检编号…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[200px]"
          />
          <select
            value={currentParticipant?.id || ''}
            onChange={(e) => onSelectParticipant(participants.find((x) => x.id === e.target.value) || null)}
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
        <p className="text-xs text-amber-700 mt-3">已入库 {participants.length} 人</p>

        {filtered.length > 0 && (
          <div className="mt-4 max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">姓名</th>
                  <th className="text-left px-3 py-2">体检编号</th>
                  <th className="text-right px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-slate-600">{p.checkupId || '—'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button type="button" className="text-amber-700 text-xs font-medium mr-3" onClick={() => onSelectParticipant(p)}>
                        查看
                      </button>
                      <button
                        type="button"
                        className="text-red-600 text-xs"
                        disabled={deletingId === p.id}
                        onClick={async () => {
                          if (!window.confirm(`确定删除「${p.name}」的血脂专项档案？`)) return;
                          setDeletingId(p.id);
                          try {
                            await deleteLipidStandaloneParticipant(p.id);
                            if (currentParticipant?.id === p.id) onSelectParticipant(null);
                            await onRefresh();
                          } finally {
                            setDeletingId(null);
                          }
                        }}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-2">上传筛查汇总 Excel</h3>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isImporting}
          className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
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
          <div className="mt-3 max-h-40 overflow-y-auto bg-slate-50 rounded-lg p-3 text-xs font-mono space-y-0.5">
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
          </div>
          {indicatorProfile && (
            <LipidIndicatorProfilePanel profile={indicatorProfile} patientName={currentParticipant.name} />
          )}
          <button
            type="button"
            onClick={handleReevaluate}
            disabled={reevaluating}
            className="bg-amber-600 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50"
          >
            {reevaluating ? '生成中…' : '重新生成健康管理方案'}
          </button>
          {result && (
            <LipidAssessmentReport
              report={result}
              patientName={currentParticipant.name}
              profile={{
                checkupId: currentParticipant.checkupId || '',
                name: currentParticipant.name,
                gender: currentParticipant.gender || '',
                age: currentParticipant.age,
                department: '血脂异常专项管理',
                phone: currentParticipant.phone,
              }}
            />
          )}
        </>
      )}
    </div>
  );
};
