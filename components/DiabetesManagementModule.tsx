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
} from '../services/diabetesStandaloneService';
import { DiabetesAssessmentReport } from './DiabetesAssessmentReport';

interface Props {
  participants: DiabetesStandaloneParticipant[];
  currentParticipant: DiabetesStandaloneParticipant | null;
  onSelectParticipant: (p: DiabetesStandaloneParticipant) => void;
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
    setResult(currentParticipant.diabetesReport || null);
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
    setDmData(draft.diabetesManagement);
    const report = await reevaluateStandalone(draft);
    setResult(report);
    await onRefresh();
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
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 grid sm:grid-cols-4 gap-3 text-sm text-slate-600">
            <div>姓名：{currentParticipant.name}</div>
            <div>体检编号：{currentParticipant.checkupId || '—'}</div>
            <div>性别/年龄：{currentParticipant.gender || '—'} / {currentParticipant.age ?? '—'}</div>
            <div>联系电话：{currentParticipant.phone || '—'}</div>
            <div className="sm:col-span-4 text-xs text-amber-700">
              专项筛查模式：未关联年度健康体检档案。评估报告中的「年度体检/HbA1c/血脂」等补检建议属正常提示。
            </div>
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

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleEvaluate}
              disabled={isSaving || localSaving}
              className="bg-teal-600 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50"
            >
              重新生成评估报告
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!result || isSaving || localSaving}
              className="bg-slate-800 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50"
            >
              {localSaving ? '保存中...' : '保存专项评估'}
            </button>
          </div>

          {result && (
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
