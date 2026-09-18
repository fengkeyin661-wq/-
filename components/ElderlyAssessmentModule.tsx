import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ElderlyAssessmentData, ElderlyAssessmentResult, ElderlyStandaloneParticipant, RiskLevel } from '../types';
import { HealthArchive } from '../services/dataService';
import { evaluateElderlyAssessment } from '../services/elderlyAssessmentService';
import {
  createEmptyElderlyAssessment,
  listPrefillHints,
  prefillElderlyFromArchive,
} from '../services/elderlyAssessmentPrefillService';
import {
  deleteElderlyStandaloneParticipant,
  fetchElderlyStandaloneParticipants,
  importElderlyStandaloneRows,
  saveElderlyStandaloneParticipant,
} from '../services/elderlyStandaloneService';
import { ELDERLY_DOMAINS, type ElderlyDomainId } from '../services/elderlyScreeningCatalog';
import { hydrateElderlyAggregates, computeOstaScore, interpretOsta } from '../services/elderlyScaleScoringService';
import { ElderlyScaleStepForm } from './elderly/ElderlyScaleStepForm';
import { ElderlyAssessmentReport } from './ElderlyAssessmentReport';
// @ts-ignore
import * as XLSX from 'xlsx';

interface Props {
  archives: HealthArchive[];
  currentArchive: HealthArchive | null;
  onSelectArchive: (archive: HealthArchive) => void;
  onSave: (data: ElderlyAssessmentData, result: ElderlyAssessmentResult) => Promise<void>;
  isSaving?: boolean;
}

const riskText = (risk?: RiskLevel) => {
  if (risk === RiskLevel.RED) return '高风险';
  if (risk === RiskLevel.YELLOW) return '中风险';
  return '低风险';
};

const DOMAIN_ORDER: ElderlyDomainId[] = ELDERLY_DOMAINS.sort((a, b) => a.sortOrder - b.sortOrder).map((d) => d.id);

export const ElderlyAssessmentModule: React.FC<Props> = ({
  archives,
  currentArchive,
  onSelectArchive,
  onSave,
  isSaving = false,
}) => {
  const [formData, setFormData] = useState<ElderlyAssessmentData>(createEmptyElderlyAssessment());
  const [result, setResult] = useState<ElderlyAssessmentResult | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [mode, setMode] = useState<'archive' | 'standalone'>('archive');
  const [standaloneList, setStandaloneList] = useState<ElderlyStandaloneParticipant[]>([]);
  const [currentStandalone, setCurrentStandalone] = useState<ElderlyStandaloneParticipant | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const loadStandalone = async () => {
    const list = await fetchElderlyStandaloneParticipants();
    setStandaloneList(list);
  };

  useEffect(() => {
    if (mode === 'standalone') void loadStandalone();
  }, [mode]);

  useEffect(() => {
    if (mode === 'standalone') {
      if (!currentStandalone) return;
      setFormData(currentStandalone.payload);
      setResult(currentStandalone.payload.assessmentResult || null);
      setActiveStep(0);
      return;
    }
    if (!currentArchive) return;
    const prefilled = prefillElderlyFromArchive(currentArchive, currentArchive.health_record.elderlyAssessment);
    setFormData(prefilled);
    setActiveStep(0);
    if (currentArchive.assessment_data.elderlyRiskLevel && currentArchive.assessment_data.elderlyPersonalizedPlan) {
      setResult({
        riskLevel: currentArchive.assessment_data.elderlyRiskLevel,
        summary: currentArchive.assessment_data.elderlyRiskSummary || '',
        reasons: currentArchive.assessment_data.elderlyRiskReasons || [],
        personalizedPlan: currentArchive.assessment_data.elderlyPersonalizedPlan,
      });
    } else {
      setResult(null);
    }
  }, [currentArchive?.checkup_id, currentStandalone?.id, mode]);

  const handleStandaloneSave = async () => {
    if (!currentStandalone || !result) return;
    const hydrated = hydrateElderlyAggregates(formData);
    const participant: ElderlyStandaloneParticipant = {
      ...currentStandalone,
      payload: { ...hydrated, assessmentResult: result },
      updatedAt: new Date().toISOString(),
    };
    await saveElderlyStandaloneParticipant(participant);
    await loadStandalone();
    setCurrentStandalone(participant);
    alert('独立筛查记录已保存');
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as Record<string, string>[];
      const mapped = rows.map((r) => ({
        name: r['姓名'] || r['name'],
        checkupId: r['体检编号'] || r['checkupId'],
        phone: r['手机号'] || r['phone'],
      }));
      const { imported, errors } = await importElderlyStandaloneRows(mapped);
      await loadStandalone();
      alert(`导入完成：${imported} 条${errors.length ? `，${errors.length} 条失败` : ''}`);
    } catch (err: unknown) {
      alert(`导入失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
    e.target.value = '';
  };

  const sortedArchives = useMemo(
    () => [...archives].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')),
    [archives],
  );

  const prefillHints = useMemo(() => listPrefillHints(currentArchive), [currentArchive]);
  const currentDomain = DOMAIN_ORDER[activeStep];
  const domainMeta = ELDERLY_DOMAINS.find((d) => d.id === currentDomain)!;

  const patchSection = <K extends keyof ElderlyAssessmentData>(
    section: K,
    patch: Partial<ElderlyAssessmentData[K]>,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...(prev[section] as object), ...patch },
    }));
  };

  const setScaleResponses = (next: NonNullable<ElderlyAssessmentData['scaleResponses']>) => {
    setFormData((prev) => ({ ...prev, scaleResponses: next }));
  };

  const handleEvaluate = () => {
    const hydrated = hydrateElderlyAggregates({
      ...formData,
      meta: {
        ...formData.meta,
        assessedAt: new Date().toISOString(),
        completedDomains: DOMAIN_ORDER,
      },
    });
    setFormData(hydrated);
    const next = evaluateElderlyAssessment(hydrated);
    setResult(next);
    setShowReport(true);
  };

  const handleApplyPrefill = () => {
    if (!currentArchive) return;
    setFormData(prefillElderlyFromArchive(currentArchive, formData));
  };

  const ostaPreview = useMemo(() => {
    const score = computeOstaScore({
      age: formData.ostaInput?.age ?? currentArchive?.age ?? currentArchive?.health_record.profile?.age,
      weightKg: formData.ostaInput?.weightKg ?? currentArchive?.health_record.checkup?.basics?.weight,
      gender: formData.ostaInput?.gender ?? currentArchive?.gender ?? currentArchive?.health_record.profile?.gender,
    });
    return score !== undefined ? interpretOsta(score) : null;
  }, [formData.ostaInput, currentArchive]);

  const renderDomainFields = () => {
    switch (currentDomain) {
      case 'checkup':
        return (
          <div className="grid md:grid-cols-3 gap-4">
            <NumberField label="收缩压 (mmHg)" value={formData.checkupMetrics.sbp} onChange={(v) => patchSection('checkupMetrics', { sbp: v })} />
            <NumberField label="舒张压 (mmHg)" value={formData.checkupMetrics.dbp} onChange={(v) => patchSection('checkupMetrics', { dbp: v })} />
            <NumberField label="BMI" value={formData.checkupMetrics.bmi} onChange={(v) => patchSection('checkupMetrics', { bmi: v })} />
            <NumberField label="空腹血糖 (mmol/L)" value={formData.checkupMetrics.fastingGlucose} onChange={(v) => patchSection('checkupMetrics', { fastingGlucose: v })} />
            <NumberField label="LDL (mmol/L)" value={formData.checkupMetrics.ldl} onChange={(v) => patchSection('checkupMetrics', { ldl: v })} />
            <NumberField label="eGFR" value={formData.checkupMetrics.egfr} onChange={(v) => patchSection('checkupMetrics', { egfr: v })} />
            <NumberField label="血红蛋白 (g/L)" value={formData.checkupMetrics.hgb} onChange={(v) => patchSection('checkupMetrics', { hgb: v })} />
          </div>
        );
      case 'function':
        return (
          <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <NumberField label="4米步速 (m/s)" value={formData.functionalStatus.gaitSpeed} onChange={(v) => patchSection('functionalStatus', { gaitSpeed: v })} hint="<0.8 提示风险" />
              <NumberField label="近12月跌倒次数" value={formData.functionalStatus.recentFalls} onChange={(v) => patchSection('functionalStatus', { recentFalls: v })} />
            </div>
            <ElderlyScaleStepForm
              domain="function"
              responses={formData.scaleResponses || {}}
              onChange={setScaleResponses}
            />
          </div>
        );
      case 'sensory':
        return (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <SelectField
                label="视力自评"
                value={formData.visionOrHearing.visionImpairment}
                options={[
                  { v: 'none', l: '无影响' },
                  { v: 'mild', l: '轻度' },
                  { v: 'moderate', l: '中度' },
                  { v: 'severe', l: '重度' },
                ]}
                onChange={(v) => patchSection('visionOrHearing', { visionImpairment: v as any })}
              />
            </div>
            <ElderlyScaleStepForm domain="sensory" responses={formData.scaleResponses || {}} onChange={setScaleResponses} />
          </div>
        );
      case 'oral':
        return (
          <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <NumberField label="缺牙数" value={formData.oralHealth.missingTeethCount} onChange={(v) => patchSection('oralHealth', { missingTeethCount: v })} />
            </div>
            <ElderlyScaleStepForm domain="oral" responses={formData.scaleResponses || {}} onChange={setScaleResponses} />
          </div>
        );
      case 'sleep':
        return (
          <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <NumberField label="平均睡眠时长 (小时)" value={formData.sleep.sleepHours} onChange={(v) => patchSection('sleep', { sleepHours: v })} />
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!formData.sleep.daytimeSleepiness}
                  onChange={(e) => patchSection('sleep', { daytimeSleepiness: e.target.checked })}
                />
                日间嗜睡
              </label>
            </div>
            <ElderlyScaleStepForm domain="sleep" responses={formData.scaleResponses || {}} onChange={setScaleResponses} />
          </div>
        );
      case 'screening':
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 grid md:grid-cols-3 gap-4">
              <NumberField
                label="OSTA 年龄"
                value={formData.ostaInput?.age ?? currentArchive?.age}
                onChange={(v) => patchSection('ostaInput', { ...formData.ostaInput, age: v })}
              />
              <NumberField
                label="OSTA 体重 (kg)"
                value={formData.ostaInput?.weightKg ?? currentArchive?.health_record.checkup?.basics?.weight}
                onChange={(v) => patchSection('ostaInput', { ...formData.ostaInput, weightKg: v })}
              />
              <div className="text-sm">
                <div className="text-slate-600 mb-1">OSTA 预览</div>
                <div className="font-bold text-indigo-800">
                  {ostaPreview ? `${ostaPreview.total} · ${ostaPreview.label}` : '请填写年龄与体重'}
                </div>
              </div>
            </div>
            <ElderlyScaleStepForm domain="screening" responses={formData.scaleResponses || {}} onChange={setScaleResponses} />
          </div>
        );
      default:
        return (
          <ElderlyScaleStepForm
            domain={currentDomain}
            responses={formData.scaleResponses || {}}
            onChange={setScaleResponses}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode('archive')}
            className={`px-4 py-2 rounded-lg text-sm font-bold ${mode === 'archive' ? 'bg-teal-600 text-white' : 'border border-slate-200'}`}
          >
            档案评估
          </button>
          <button
            type="button"
            onClick={() => setMode('standalone')}
            className={`px-4 py-2 rounded-lg text-sm font-bold ${mode === 'standalone' ? 'bg-teal-600 text-white' : 'border border-slate-200'}`}
          >
            独立筛查
          </button>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-4">老年专项评估（CGA）</h3>
        {mode === 'archive' ? (
        <select
          value={currentArchive?.checkup_id || ''}
          onChange={(e) => {
            const next = archives.find((a) => a.checkup_id === e.target.value);
            if (next) onSelectArchive(next);
          }}
          className="w-full md:w-[420px] border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
        >
          <option value="" disabled>请选择档案</option>
          {sortedArchives.map((a) => (
            <option key={a.id} value={a.checkup_id}>
              {a.name} | {a.checkup_id} | {a.department}
            </option>
          ))}
        </select>
        ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select
              value={currentStandalone?.id || ''}
              onChange={(e) => {
                const p = standaloneList.find((x) => x.id === e.target.value) || null;
                setCurrentStandalone(p);
              }}
              className="flex-1 min-w-[240px] border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
            >
              <option value="">选择独立筛查对象</option>
              {standaloneList.map((p) => (
                <option key={p.id} value={p.id}>{p.name || '未命名'} | {p.checkupId || p.participantKey}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={async () => {
                const p: ElderlyStandaloneParticipant = {
                  id: `elderly_${Date.now()}`,
                  participantKey: `enm_新建_${Date.now()}`,
                  name: '新建筛查对象',
                  payload: createEmptyElderlyAssessment(),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                await saveElderlyStandaloneParticipant(p);
                await loadStandalone();
                setCurrentStandalone(p);
              }}
              className="px-3 py-2 rounded-lg text-sm font-bold bg-slate-800 text-white"
            >
              + 新建
            </button>
            <button type="button" onClick={() => importRef.current?.click()} className="px-3 py-2 rounded-lg text-sm font-bold border border-slate-200">
              Excel 导入
            </button>
            <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
            {currentStandalone && (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('确定删除该独立筛查记录？')) return;
                  await deleteElderlyStandaloneParticipant(currentStandalone.id);
                  setCurrentStandalone(null);
                  await loadStandalone();
                }}
                className="px-3 py-2 rounded-lg text-sm font-bold text-red-600 border border-red-200"
              >
                删除
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">Excel 模板列：姓名、体检编号、手机号</p>
        </div>
        )}
      </div>

      {mode === 'archive' && prefillHints.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h4 className="text-sm font-bold text-blue-900">已从档案/体检预填</h4>
            <button type="button" onClick={handleApplyPrefill} className="text-xs font-bold text-blue-700 hover:underline">
              重新同步预填
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {prefillHints.map((h) => (
              <span key={h.field} className="text-xs bg-white border border-blue-100 rounded-full px-2 py-1 text-blue-800">
                {h.label}: {h.value}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap gap-1 border-b border-slate-100 p-2 bg-slate-50">
          {DOMAIN_ORDER.map((id, idx) => {
            const meta = ELDERLY_DOMAINS.find((d) => d.id === id)!;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveStep(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeStep === idx ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {idx + 1}. {meta.label}
              </button>
            );
          })}
        </div>

        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{domainMeta.label}</h3>
            <p className="text-sm text-slate-500">{domainMeta.description}</p>
          </div>
          {renderDomainFields()}
          <div className="flex justify-between pt-2">
            <button
              type="button"
              disabled={activeStep === 0}
              onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
              className="px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 disabled:opacity-40"
            >
              上一步
            </button>
            <button
              type="button"
              disabled={activeStep >= DOMAIN_ORDER.length - 1}
              onClick={() => setActiveStep((s) => Math.min(DOMAIN_ORDER.length - 1, s + 1))}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-slate-800 text-white disabled:opacity-40"
            >
              下一步
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleEvaluate}
          disabled={mode === 'archive' ? !currentArchive : !currentStandalone}
          className="bg-teal-600 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50"
        >
          生成 CGA 分级与方案
        </button>
        <button
          onClick={() => {
            if (!result) return;
            const hydrated = hydrateElderlyAggregates(formData);
            if (mode === 'standalone') void handleStandaloneSave();
            else if (currentArchive) void onSave(hydrated, result);
          }}
          disabled={(mode === 'archive' ? !currentArchive : !currentStandalone) || !result || isSaving}
          className="bg-slate-800 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50"
        >
          {isSaving ? '保存中...' : mode === 'standalone' ? '保存独立记录' : '保存到档案'}
        </button>
        {result && (
          <button
            type="button"
            onClick={() => setShowReport((v) => !v)}
            className="px-5 py-2 rounded-lg font-bold border border-slate-200 text-slate-700"
          >
            {showReport ? '隐藏报告' : '查看/打印报告'}
          </button>
        )}
      </div>

      {result && !showReport && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">评估结果摘要</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              result.riskLevel === RiskLevel.RED ? 'bg-red-100 text-red-700' :
              result.riskLevel === RiskLevel.YELLOW ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {riskText(result.riskLevel)}
            </span>
          </div>
          <p className="text-sm text-slate-600">{result.summary}</p>
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
            {result.reasons.map((item, idx) => <li key={idx}>{item}</li>)}
          </ul>
        </div>
      )}

      {result && showReport && (mode === 'archive' ? currentArchive : currentStandalone) && (
        <ElderlyAssessmentReport
          result={result}
          data={hydrateElderlyAggregates(formData)}
          patientName={mode === 'archive' ? currentArchive?.name : currentStandalone?.name}
          profile={mode === 'archive' ? currentArchive?.health_record.profile : currentStandalone?.payload.profile as any}
        />
      )}
    </div>
  );
};

const NumberField: React.FC<{ label: string; value?: number; onChange: (value?: number) => void; hint?: string }> = ({
  label, value, onChange, hint,
}) => (
  <label className="text-sm text-slate-700 block">
    <div className="mb-1">{label}{hint && <span className="text-xs text-slate-400 ml-1">({hint})</span>}</div>
    <input
      type="number"
      step="any"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      className="w-full border border-slate-300 rounded-lg px-3 py-2"
    />
  </label>
);

const SelectField: React.FC<{
  label: string;
  value?: string;
  options: { v: string; l: string }[];
  onChange: (value?: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label className="text-sm text-slate-700 block">
    <div className="mb-1">{label}</div>
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
    >
      <option value="">未填写</option>
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  </label>
);
