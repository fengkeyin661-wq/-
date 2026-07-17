import React from 'react';
import type { ElderlyAssessmentData, ElderlyAssessmentResult, HealthProfile } from '../types';
import { RiskLevel } from '../types';
import {
  ELDERLY_DOMAIN_GUIDANCE,
  ELDERLY_REPORT_DISCLAIMER,
  ELDERLY_REPORT_ENCOURAGEMENT,
} from '../services/elderlyEducationContent';

interface Props {
  result: ElderlyAssessmentResult;
  data: ElderlyAssessmentData;
  patientName?: string;
  profile?: HealthProfile;
}

const riskBadge = (level: RiskLevel) => {
  if (level === RiskLevel.RED) return 'bg-red-100 text-red-800 border-red-200';
  if (level === RiskLevel.YELLOW) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
};

export const ElderlyAssessmentReport: React.FC<Props> = ({ result, data, patientName, profile }) => {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'height=900,width=800');
    if (!printWindow) {
      alert('浏览器拦截了弹窗，请允许本站弹出窗口以便打印。');
      return;
    }
    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const listHtml = (items: string[]) =>
      items.length ? `<ul>${items.map((i) => `<li>${escape(i)}</li>`).join('')}</ul>` : '<p class="muted">暂无</p>';

    const scalesHtml = (result.scaleSummaries || []).length
      ? `<table><thead><tr><th>量表</th><th>得分</th><th>解释</th></tr></thead><tbody>${(result.scaleSummaries || [])
          .map((s) => `<tr><td>${escape(s.name)}</td><td>${s.total}</td><td>${escape(s.label)}</td></tr>`)
          .join('')}</tbody></table>`
      : '<p class="muted">尚未完成量表计分</p>';

    const domainHtml = (result.domainFindings || []).length
      ? (result.domainFindings || [])
          .map(
            (d) =>
              `<div class="section"><h3>${escape(d.label)}</h3>${listHtml(d.findings)}<p class="muted">${escape(ELDERLY_DOMAIN_GUIDANCE[d.domain] || '')}</p></div>`,
          )
          .join('')
      : '';

    printWindow.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>老年专项评估报告</title>
      <style>
        body{font-family:"Microsoft YaHei",sans-serif;padding:40px;font-size:14px;line-height:1.6;color:#333}
        .header{text-align:center;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:24px}
        .header h1{font-size:24px;margin:0}
        .meta{color:#555;font-size:13px;margin-top:8px}
        .risk{display:inline-block;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:bold;border:1px solid #ccc}
        .section{margin-bottom:20px;page-break-inside:avoid}
        .section h3{font-size:16px;border-left:4px solid #0d9488;padding-left:8px}
        .muted{color:#666;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}
        th{background:#f8fafc}
        .disclaimer{background:#fffbeb;border:1px solid #fde68a;padding:12px;border-radius:8px;font-size:12px;margin-top:20px}
      </style></head><body>
      <div class="header">
        <h1>老年专项评估报告（CGA）</h1>
        <div class="meta">
          姓名：${escape(profile?.name || patientName || '—')} ·
          性别：${escape(profile?.gender || '—')} ·
          年龄：${profile?.age ? `${profile.age}岁` : '—'} ·
          评估日期：${escape(data.meta?.assessedAt?.slice(0, 10) || new Date().toLocaleDateString())}
        </div>
        <div class="risk">${escape(result.summary)}</div>
      </div>
      <div class="section"><h3>综合风险信号</h3>${listHtml(result.reasons)}</div>
      <div class="section"><h3>量表得分汇总</h3>${scalesHtml}</div>
      ${domainHtml}
      <div class="section"><h3>饮食建议</h3>${listHtml(result.personalizedPlan.diet)}</div>
      <div class="section"><h3>运动建议</h3>${listHtml(result.personalizedPlan.exercise)}</div>
      <div class="section"><h3>睡眠建议</h3>${listHtml(result.personalizedPlan.sleep)}</div>
      <div class="section"><h3>心理社会支持</h3>${listHtml(result.personalizedPlan.psychosocial)}</div>
      <div class="section"><h3>随访安排</h3>${listHtml(result.personalizedPlan.followup)}</div>
      <div class="section"><h3>${escape(ELDERLY_REPORT_ENCOURAGEMENT.title)}</h3>
        ${ELDERLY_REPORT_ENCOURAGEMENT.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('')}
      </div>
      <div class="disclaimer">${escape(ELDERLY_REPORT_DISCLAIMER)}</div>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">老年专项评估报告（CGA）</h3>
          <p className="text-sm text-slate-500 mt-1">
            {profile?.name || patientName || '—'} · {profile?.gender || ''} {profile?.age ? `${profile.age}岁` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${riskBadge(result.riskLevel)}`}>
            {result.riskLevel === RiskLevel.RED ? '高风险' : result.riskLevel === RiskLevel.YELLOW ? '中风险' : '低风险'}
          </span>
          <button type="button" onClick={handlePrint} className="px-4 py-1.5 rounded-lg text-sm font-bold bg-slate-800 text-white">
            打印报告
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-4 border border-slate-100">{result.summary}</p>

      {(result.scaleSummaries || []).length > 0 && (
        <div>
          <h4 className="font-bold text-slate-800 mb-2">量表得分</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2 text-left">量表</th>
                  <th className="p-2 text-left">得分</th>
                  <th className="p-2 text-left">解释</th>
                </tr>
              </thead>
              <tbody>
                {(result.scaleSummaries || []).map((s) => (
                  <tr key={s.scaleId} className="border-t border-slate-100">
                    <td className="p-2">{s.name}</td>
                    <td className="p-2 font-bold">{s.total}</td>
                    <td className="p-2 text-slate-600">{s.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(result.domainFindings || []).map((d) => (
        <div key={d.domain}>
          <h4 className="font-bold text-slate-800">{d.label}</h4>
          <ul className="list-disc pl-5 text-sm text-slate-700 mt-1 space-y-1">
            {d.findings.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
          <p className="text-xs text-slate-500 mt-1">{ELDERLY_DOMAIN_GUIDANCE[d.domain]}</p>
        </div>
      ))}

      <div className="grid md:grid-cols-2 gap-4">
        <PlanBlock title="饮食" items={result.personalizedPlan.diet} />
        <PlanBlock title="运动" items={result.personalizedPlan.exercise} />
        <PlanBlock title="睡眠" items={result.personalizedPlan.sleep} />
        <PlanBlock title="心理社会" items={result.personalizedPlan.psychosocial} />
      </div>
      <PlanBlock title="随访安排" items={result.personalizedPlan.followup} />

      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3">{ELDERLY_REPORT_DISCLAIMER}</p>
    </div>
  );
};

const PlanBlock: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <div className="rounded-lg border border-slate-100 p-3 bg-slate-50/50">
    <h4 className="text-sm font-bold text-slate-800 mb-1">{title}</h4>
    <ul className="list-disc pl-4 text-sm text-slate-700 space-y-0.5">
      {items.map((item, idx) => <li key={idx}>{item}</li>)}
    </ul>
  </div>
);
