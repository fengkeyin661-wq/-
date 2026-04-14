import React, { useEffect, useMemo, useState } from 'react';
import { ElderlyAssessmentData, RiskLevel } from '../types';
import { HealthArchive } from '../services/dataService';
import { ElderlyAssessmentResult, evaluateElderlyAssessment } from '../services/elderlyAssessmentService';

interface Props {
  archives: HealthArchive[];
  currentArchive: HealthArchive | null;
  onSelectArchive: (archive: HealthArchive) => void;
  onSave: (data: ElderlyAssessmentData, result: ElderlyAssessmentResult) => Promise<void>;
  isSaving?: boolean;
}

const defaultData: ElderlyAssessmentData = {
  checkupMetrics: {},
  functionalStatus: {},
  emotion: {},
  nutrition: {},
  visionOrHearing: {},
  oralHealth: {},
  sleep: {},
  screenings: {},
};

const riskText = (risk?: RiskLevel) => {
  if (risk === RiskLevel.RED) return '高风险';
  if (risk === RiskLevel.YELLOW) return '中风险';
  return '低风险';
};

export const ElderlyAssessmentModule: React.FC<Props> = ({
  archives,
  currentArchive,
  onSelectArchive,
  onSave,
  isSaving = false,
}) => {
  const [formData, setFormData] = useState<ElderlyAssessmentData>(defaultData);
  const [result, setResult] = useState<ElderlyAssessmentResult | null>(null);

  useEffect(() => {
    if (!currentArchive) return;
    setFormData(currentArchive.health_record.elderlyAssessment || defaultData);
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
  }, [currentArchive?.checkup_id]);

  const sortedArchives = useMemo(
    () => [...archives].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')),
    [archives]
  );

  const patch = <T extends keyof ElderlyAssessmentData>(
    section: T,
    key: keyof ElderlyAssessmentData[T],
    value: any
  ) => {
    setFormData(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  };

  const handleEvaluate = () => {
    const next = evaluateElderlyAssessment(formData);
    setResult(next);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4">老年专项评估对象</h3>
        <select
          value={currentArchive?.checkup_id || ''}
          onChange={(e) => {
            const next = archives.find(a => a.checkup_id === e.target.value);
            if (next) onSelectArchive(next);
          }}
          className="w-full md:w-[420px] border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
        >
          <option value="" disabled>请选择档案</option>
          {sortedArchives.map(a => (
            <option key={a.id} value={a.checkup_id}>
              {a.name} | {a.checkup_id} | {a.department}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
        <h3 className="text-lg font-bold text-slate-800">专项数据录入</h3>

        <div className="grid md:grid-cols-3 gap-4">
          <NumberField label="收缩压 (mmHg)" value={formData.checkupMetrics.sbp} onChange={(v) => patch('checkupMetrics', 'sbp', v)} />
          <NumberField label="舒张压 (mmHg)" value={formData.checkupMetrics.dbp} onChange={(v) => patch('checkupMetrics', 'dbp', v)} />
          <NumberField label="BMI" value={formData.checkupMetrics.bmi} onChange={(v) => patch('checkupMetrics', 'bmi', v)} />
          <NumberField label="空腹血糖 (mmol/L)" value={formData.checkupMetrics.fastingGlucose} onChange={(v) => patch('checkupMetrics', 'fastingGlucose', v)} />
          <NumberField label="LDL (mmol/L)" value={formData.checkupMetrics.ldl} onChange={(v) => patch('checkupMetrics', 'ldl', v)} />
          <NumberField label="eGFR" value={formData.checkupMetrics.egfr} onChange={(v) => patch('checkupMetrics', 'egfr', v)} />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <NumberField label="ADL (0-100)" value={formData.functionalStatus.adlScore} onChange={(v) => patch('functionalStatus', 'adlScore', v)} />
          <NumberField label="IADL (0-8)" value={formData.functionalStatus.iadlScore} onChange={(v) => patch('functionalStatus', 'iadlScore', v)} />
          <SelectField
            label="跌倒风险"
            value={formData.functionalStatus.fallRisk}
            options={['low', 'medium', 'high']}
            onChange={(v) => patch('functionalStatus', 'fallRisk', v)}
          />
          <NumberField label="近12月跌倒次数" value={formData.functionalStatus.recentFalls} onChange={(v) => patch('functionalStatus', 'recentFalls', v)} />
          <NumberField label="抑郁评分" value={formData.emotion.depressionScore} onChange={(v) => patch('emotion', 'depressionScore', v)} />
          <NumberField label="焦虑评分" value={formData.emotion.anxietyScore} onChange={(v) => patch('emotion', 'anxietyScore', v)} />
          <NumberField label="MNA评分 (0-14)" value={formData.nutrition.mnaScore} onChange={(v) => patch('nutrition', 'mnaScore', v)} />
          <SelectField
            label="失眠程度"
            value={formData.sleep.insomniaSeverity}
            options={['none', 'mild', 'moderate', 'severe']}
            onChange={(v) => patch('sleep', 'insomniaSeverity', v)}
          />
          <SelectField
            label="衰弱筛查"
            value={formData.screenings.frailty}
            options={['none', 'pre', 'frail']}
            onChange={(v) => patch('screenings', 'frailty', v)}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleEvaluate}
          disabled={!currentArchive}
          className="bg-teal-600 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50"
        >
          生成分级与方案
        </button>
        <button
          onClick={() => result && onSave(formData, result)}
          disabled={!currentArchive || !result || isSaving}
          className="bg-slate-800 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50"
        >
          {isSaving ? '保存中...' : '保存到档案'}
        </button>
      </div>

      {result && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">评估结果</h3>
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
          <PlanBlock title="饮食建议" items={result.personalizedPlan.diet} />
          <PlanBlock title="运动建议" items={result.personalizedPlan.exercise} />
          <PlanBlock title="睡眠建议" items={result.personalizedPlan.sleep} />
          <PlanBlock title="心理社会支持" items={result.personalizedPlan.psychosocial} />
          <PlanBlock title="随访安排" items={result.personalizedPlan.followup} />
        </div>
      )}
    </div>
  );
};

const NumberField: React.FC<{ label: string; value?: number; onChange: (value?: number) => void }> = ({ label, value, onChange }) => (
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

const SelectField: React.FC<{ label: string; value?: string; options: string[]; onChange: (value?: string) => void }> = ({ label, value, options, onChange }) => (
  <label className="text-sm text-slate-700">
    <div className="mb-1">{label}</div>
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
    >
      <option value="">未填写</option>
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </label>
);

const PlanBlock: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <div>
    <h4 className="text-sm font-bold text-slate-800 mb-1">{title}</h4>
    <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
      {items.map((item, idx) => <li key={idx}>{item}</li>)}
    </ul>
  </div>
);
