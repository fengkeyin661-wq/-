import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DiabetesManagementData,
  DiabetesScreeningRecord,
  DiabetesAssessmentResult,
} from '../types';
import { HealthArchive } from '../services/dataService';
import {
  createEmptyDiabetesManagement,
  createScreeningId,
  evaluateDiabetesScreening,
  isDiabetesCohort,
} from '../services/diabetesAssessmentService';
import { importDiabetesScreeningExcel } from '../services/diabetesScreeningImportService';
import { DiabetesAssessmentReport } from './DiabetesAssessmentReport';

interface Props {
  archives: HealthArchive[];
  currentArchive: HealthArchive | null;
  onSelectArchive: (archive: HealthArchive) => void;
  onSave: (
    dm: DiabetesManagementData,
    screening: DiabetesScreeningRecord,
    result: DiabetesAssessmentResult
  ) => Promise<void>;
  onImportComplete?: () => void | Promise<void>;
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
  archives,
  currentArchive,
  onSelectArchive,
  onSave,
  onImportComplete,
  isSaving = false,
}) => {
  const [dmData, setDmData] = useState<DiabetesManagementData>(createEmptyDiabetesManagement());
  const [screening, setScreening] = useState<DiabetesScreeningRecord>(emptyScreening());
  const [result, setResult] = useState<DiabetesAssessmentResult | null>(null);
  const [cohortFilter, setCohortFilter] = useState<'all' | 'cohort'>('cohort');
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentArchive) return;
    const dm = currentArchive.health_record.diabetesManagement || createEmptyDiabetesManagement();
    setDmData(dm);
    const latest = [...(dm.screenings || [])].sort((a, b) =>
      (b.screeningDate || '').localeCompare(a.screeningDate || '')
    )[0];
    setScreening(latest || emptyScreening());
    setResult(currentArchive.assessment_data.diabetesReport || null);
  }, [currentArchive?.checkup_id]);

  const filteredArchives = useMemo(() => {
    let list = [...archives];
    if (cohortFilter === 'cohort') {
      list = list.filter((a) => isDiabetesCohort(a.health_record));
    }
    return list.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  }, [archives, cohortFilter]);

  const checkup = currentArchive?.health_record.checkup;

  const patchScreening = <K extends keyof DiabetesScreeningRecord>(key: K, value: DiabetesScreeningRecord[K]) => {
    setScreening((prev) => ({ ...prev, [key]: value }));
  };

  const handleEvaluate = () => {
    if (!currentArchive) return;
    const mergedDm: DiabetesManagementData = {
      ...dmData,
      screenings: appendOrUpdateScreening(dmData.screenings || [], screening),
    };
    const record = {
      ...currentArchive.health_record,
      diabetesManagement: mergedDm,
    };
    const next = evaluateDiabetesScreening(record);
    setResult(next);
    setDmData(mergedDm);
  };

  const handleSave = async () => {
    if (!result) return;
    const mergedDm: DiabetesManagementData = {
      ...dmData,
      screenings: appendOrUpdateScreening(dmData.screenings || [], screening),
    };
    await onSave(mergedDm, screening, result);
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
        await onImportComplete?.();
      } else {
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
        <h3 className="text-lg font-bold text-slate-800 mb-4">糖尿病管理专栏</h3>
        <p className="text-sm text-slate-500 mb-4">
          针对血糖偏高及糖尿病人群，录入或导入社区并发症筛查数据，关联健康体检档案，生成首次评估报告与健康管理方案。
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={cohortFilter}
            onChange={(e) => setCohortFilter(e.target.value as 'all' | 'cohort')}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="cohort">仅显示专栏目标人群</option>
            <option value="all">显示全部档案</option>
          </select>
          <select
            value={currentArchive?.checkup_id || ''}
            onChange={(e) => {
              const next = archives.find((a) => a.checkup_id === e.target.value);
              if (next) onSelectArchive(next);
            }}
            className="flex-1 min-w-[240px] border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
          >
            <option value="" disabled>
              请选择档案
            </option>
            {filteredArchives.map((a) => (
              <option key={a.id} value={a.checkup_id}>
                {a.name} | {a.checkup_id} | {a.department}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-2">上传筛查汇总 Excel</h3>
        <p className="text-sm text-slate-500 mb-3">
          直接上传已整理的 Excel 汇总表（列名可自定义）。系统将 AI 逐行读取筛查数据，自动匹配体检编号、写入档案并生成首次评估报告。
        </p>
        <div className="flex flex-wrap gap-3">
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
        </div>
        {importLogs.length > 0 && (
          <div className="mt-3 max-h-32 overflow-y-auto bg-slate-50 rounded-lg p-3 text-xs text-slate-600 font-mono space-y-0.5">
            {importLogs.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
      </div>

      {currentArchive && (
        <>
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-2">关联年度体检摘要（只读）</h3>
            <div className="grid sm:grid-cols-3 gap-3 text-sm text-slate-600">
              <div>空腹血糖：{checkup?.labBasic?.glucose?.fasting || '—'}</div>
              <div>HbA1c：{checkup?.optional?.hba1c || '—'}</div>
              <div>血脂 TC/LDL：{checkup?.labBasic?.lipids?.tc || '—'} / {checkup?.labBasic?.lipids?.ldl || '—'}</div>
              <div>肌酐：{checkup?.labBasic?.renal?.creatinine || '—'}</div>
              <div>尿蛋白：{checkup?.labBasic?.urineRoutine?.protein || '—'}</div>
              <div>心电图：{checkup?.imagingBasic?.ecg || '—'}</div>
            </div>
            {!checkup?.labBasic?.glucose?.fasting && !checkup?.optional?.hba1c && (
              <p className="text-xs text-amber-700 mt-2">尚未关联年度体检报告，评估时将提示补检相关项目。</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800">并发症筛查数据录入</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <TextField label="筛查日期" value={screening.screeningDate} onChange={(v) => patchScreening('screeningDate', v)} />
              <TextField label="活动名称" value={screening.activityName} onChange={(v) => patchScreening('activityName', v)} />
              <SelectField
                label="血糖类型"
                value={screening.glucoseType}
                options={[
                  { value: 'fasting', label: '空腹' },
                  { value: 'postprandial', label: '餐后' },
                ]}
                onChange={(v) => patchScreening('glucoseType', v as DiabetesScreeningRecord['glucoseType'])}
              />
              <NumberField label="血糖 (mmol/L)" value={screening.glucoseValue} onChange={(v) => patchScreening('glucoseValue', v)} />
              <NumberField label="右臂收缩压" value={screening.rightArmSbp} onChange={(v) => patchScreening('rightArmSbp', v)} />
              <NumberField label="右臂舒张压" value={screening.rightArmDbp} onChange={(v) => patchScreening('rightArmDbp', v)} />
              <NumberField label="ABI" value={screening.abi} onChange={(v) => patchScreening('abi', v)} />
              <NumberField label="PWV" value={screening.pwv} onChange={(v) => patchScreening('pwv', v)} />
              <TextField label="动脉硬化结论" value={screening.arteriosclerosisConclusion} onChange={(v) => patchScreening('arteriosclerosisConclusion', v)} />
              <TextField label="心电图结论" value={screening.ecgResult} onChange={(v) => patchScreening('ecgResult', v)} />
              <TextField label="眼底结论" value={screening.fundusResult} onChange={(v) => patchScreening('fundusResult', v)} />
              <TextField label="眼底分级" value={screening.fundusGrade} onChange={(v) => patchScreening('fundusGrade', v)} />
              <NumberField label="体脂率 (%)" value={screening.bodyFatRate} onChange={(v) => patchScreening('bodyFatRate', v)} />
              <NumberField label="内脏脂肪等级" value={screening.visceralFatLevel} onChange={(v) => patchScreening('visceralFatLevel', v)} />
              <NumberField label="肌肉量 (kg)" value={screening.muscleMass} onChange={(v) => patchScreening('muscleMass', v)} />
              <NumberField label="BMI" value={screening.bmi} onChange={(v) => patchScreening('bmi', v)} />
            </div>
          </div>

          {(dmData.screenings?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-2">历次筛查记录（{dmData.screenings.length} 次）</h3>
              <ul className="text-sm text-slate-600 space-y-1">
                {[...dmData.screenings]
                  .sort((a, b) => (b.screeningDate || '').localeCompare(a.screeningDate || ''))
                  .map((s, i) => (
                    <li key={s.id || i}>
                      {s.screeningDate} — {s.activityName}
                      {s.glucoseValue != null ? ` | 血糖 ${s.glucoseValue}` : ''}
                      <button
                        className="ml-2 text-teal-600 text-xs"
                        onClick={() => setScreening(s)}
                      >
                        载入编辑
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleEvaluate}
              disabled={!currentArchive}
              className="bg-teal-600 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50"
            >
              生成首次评估报告
            </button>
            <button
              onClick={handleSave}
              disabled={!currentArchive || !result || isSaving}
              className="bg-slate-800 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50"
            >
              {isSaving ? '保存中...' : '保存到档案'}
            </button>
          </div>

          {result && (
            <DiabetesAssessmentReport
              report={result}
              patientName={currentArchive.name}
              profile={currentArchive.health_record.profile}
            />
          )}
        </>
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

const NumberField: React.FC<{
  label: string;
  value?: number;
  onChange: (v?: number) => void;
}> = ({ label, value, onChange }) => (
  <label className="text-sm text-slate-700">
    <div className="mb-1">{label}</div>
    <input
      type="number"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      className="w-full border border-slate-300 rounded-lg px-3 py-2"
    />
  </label>
);

const TextField: React.FC<{
  label: string;
  value?: string;
  onChange: (v?: string) => void;
}> = ({ label, value, onChange }) => (
  <label className="text-sm text-slate-700">
    <div className="mb-1">{label}</div>
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="w-full border border-slate-300 rounded-lg px-3 py-2"
    />
  </label>
);

const SelectField: React.FC<{
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (v?: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label className="text-sm text-slate-700">
    <div className="mb-1">{label}</div>
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
    >
      <option value="">未选择</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);
