import React from 'react';
import type { HealthProfile, HypertensionAssessmentResult } from '../types';
import { RiskLevel } from '../types';
import { HYPERTENSION_REPORT_ENCOURAGEMENT } from '../services/hypertensionEducationContent';

interface Props {
  report: HypertensionAssessmentResult;
  patientName?: string;
  profile?: HealthProfile;
}

const riskBadge = (level: RiskLevel) => {
  if (level === RiskLevel.RED) return 'bg-red-100 text-red-800 border-red-200';
  if (level === RiskLevel.YELLOW) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
};

export const HypertensionAssessmentReport: React.FC<Props> = ({ report, patientName, profile }) => {
  const g = report.lifestyleGuidance;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-800">高血压专项健康管理方案</h3>
        <p className="text-sm text-slate-500 mt-1">
          {patientName || profile?.name || '参与者'} · 生成于 {(report.generatedAt || '').slice(0, 10)}
        </p>
        <span className={`inline-block mt-2 text-xs font-bold px-2 py-1 rounded border ${riskBadge(report.riskLevel)}`}>
          风险分级：{report.riskLevel}
        </span>
      </div>

      <section className="text-sm text-slate-700 bg-indigo-50 rounded-lg p-4 border border-indigo-100">
        <p className="font-bold text-indigo-900 mb-2">{HYPERTENSION_REPORT_ENCOURAGEMENT.title}</p>
        {HYPERTENSION_REPORT_ENCOURAGEMENT.paragraphs.map((p, i) => (
          <p key={i} className="mb-2 last:mb-0">
            {p}
          </p>
        ))}
      </section>

      <section>
        <h4 className="text-sm font-bold text-slate-800 mb-2">评估摘要</h4>
        <p className="text-sm text-slate-700">{report.summary}</p>
      </section>

      <section>
        <h4 className="text-sm font-bold text-slate-800 mb-2">血压评估</h4>
        <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
          {report.bpFindings.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </section>

      {report.targetOrganAlerts.length > 0 && (
        <section className="bg-red-50 border border-red-100 rounded-lg p-4">
          <h4 className="text-sm font-bold text-red-900 mb-2">靶器官风险提示</h4>
          <ul className="text-sm text-red-800 list-disc pl-5 space-y-1">
            {report.targetOrganAlerts.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4 className="text-sm font-bold text-slate-800 mb-2">建议补检项目</h4>
        {report.missedItems.length ? (
          <ul className="text-sm text-slate-700 space-y-2">
            {report.missedItems.slice(0, 10).map((m) => (
              <li key={m.itemId}>
                <span className="font-medium">{m.label}</span>
                <span className="text-slate-500"> — {m.recommendedCycle}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">核心项目已基本完善，请按计划定期复查。</p>
        )}
      </section>

      <section>
        <h4 className="text-sm font-bold text-slate-800 mb-3">健康管理指导</h4>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="font-bold text-slate-800 mb-2">基本原则</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              {g.principles.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="font-bold text-slate-800 mb-2">饮食建议</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              {g.dietTips.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="font-bold text-slate-800 mb-2">运动建议</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              {g.exerciseTips.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="font-bold text-slate-800 mb-2">监测与用药</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              {[...g.monitoringTips.slice(0, 2), ...g.medicationTips.slice(0, 2)].map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="text-xs text-slate-500 border-t border-slate-100 pt-4">
        {report.guidelineNotes.map((n, i) => (
          <p key={i}>{n}</p>
        ))}
      </section>
    </div>
  );
};
