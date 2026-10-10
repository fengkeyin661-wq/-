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

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'height=900,width=800');
    if (!printWindow) {
      alert('浏览器拦截了弹窗，请允许本站弹出窗口以便打印。');
      return;
    }

    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const listHtml = (items: string[]) =>
      items.length
        ? `<ul>${items.map((i) => `<li>${escape(i)}</li>`).join('')}</ul>`
        : '<p class="muted">暂无</p>';

    const pName = escape(profile?.name || patientName || '参与者');
    const pGender = profile?.gender ? escape(profile.gender) : '';
    const pAge = profile?.age ? `${profile.age}岁` : '';
    const pDept = profile?.department ? escape(profile.department) : '';

    const encouragementHtml = `
      <div class="encourage-box">
        <p class="encourage-title">${escape(HYPERTENSION_REPORT_ENCOURAGEMENT.title)}</p>
        ${HYPERTENSION_REPORT_ENCOURAGEMENT.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('')}
      </div>`;

    const targetOrganHtml = report.targetOrganAlerts.length
      ? `<div class="alert-box"><h3>靶器官风险提示</h3><ul>${report.targetOrganAlerts
          .map((a) => `<li>${escape(a)}</li>`)
          .join('')}</ul></div>`
      : '';

    const missedHtml = report.missedItems.length
      ? `<table><thead><tr><th>项目</th><th>临床意义</th><th>建议周期</th></tr></thead><tbody>${report.missedItems
          .map(
            (m) =>
              `<tr><td>${escape(m.label)}</td><td>${escape(m.clinicalMeaning || '')}</td><td>${escape(m.recommendedCycle)}</td></tr>`
          )
          .join('')}</tbody></table>`
      : '<p class="muted">核心项目已基本完善，请按计划定期复查。</p>';

    const retestHtml = report.retestAdvice.length
      ? `<table><thead><tr><th>项目</th><th>当前发现</th><th>建议</th></tr></thead><tbody>${report.retestAdvice
          .map(
            (r) =>
              `<tr><td>${escape(r.label)}</td><td>${escape(r.currentFinding || '')}</td><td>${escape(r.advice)}</td></tr>`
          )
          .join('')}</tbody></table>`
      : '<p class="muted">暂无复检建议</p>';

    printWindow.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>高血压专项健康管理方案</title>
      <style>
        body{font-family:"Microsoft YaHei",sans-serif;padding:40px;font-size:14px;line-height:1.6;color:#333}
        .header{text-align:center;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:24px}
        .header h1{font-size:26px;margin:0}
        .header p{margin:4px 0 0;color:#555;font-size:13px}
        .meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin-top:12px;color:#555;font-size:13px}
        .risk{display:inline-block;margin-top:10px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:bold;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3}
        .summary-box{padding:16px;background:#f8fafc;border-radius:8px;margin-bottom:20px;border:1px solid #e2e8f0}
        .section{margin-bottom:22px;page-break-inside:avoid}
        .section h3{font-size:16px;border-left:4px solid #4f46e5;padding-left:8px;margin-bottom:10px}
        .encourage-box{margin-bottom:20px;padding:16px 18px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;color:#334155}
        .encourage-title{font-weight:bold;font-size:15px;color:#312e81;margin:0 0 10px}
        .encourage-box p{margin:0 0 8px;text-indent:2em}
        .alert-box{background:#fef2f2;border:2px solid #ef4444;padding:12px 16px;border-radius:8px;color:#b91c1c;margin-bottom:20px}
        .alert-box h3{margin:0 0 8px;font-size:15px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .card{padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px}
        .card p{font-weight:bold;margin:0 0 8px;color:#1e293b}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}
        th{background:#f8fafc}
        .muted{color:#888}
        ul{padding-left:20px;margin:0}
        .notes{font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:8px}
        @media print{body{padding:20px}.grid{grid-template-columns:1fr 1fr}}
      </style></head><body>
      <div class="header">
        <p>社区高血压专项筛查</p>
        <h1>高血压专项健康管理方案</h1>
        <div class="meta">
          <span>姓名：${pName} ${pGender} ${pAge}</span>
          <span>${pDept ? `单位：${pDept}` : ''}</span>
          <span>生成日期：${(report.generatedAt || '').slice(0, 10)}</span>
        </div>
        <span class="risk">风险分级：${escape(report.riskLevel)}</span>
      </div>
      ${encouragementHtml}
      <div class="summary-box"><p>${escape(report.summary)}</p></div>
      <div class="section"><h3>一、血压评估</h3>${listHtml(report.bpFindings)}</div>
      ${targetOrganHtml}
      <div class="section"><h3>二、筛查发现</h3>${listHtml(report.screeningFindings)}</div>
      <div class="section"><h3>三、建议补检项目</h3>${missedHtml}</div>
      <div class="section"><h3>四、复检建议</h3>${retestHtml}</div>
      <div class="section"><h3>五、健康管理指导</h3>
        <div class="grid">
          <div class="card"><p>基本原则</p>${listHtml(g.principles)}</div>
          <div class="card"><p>饮食建议</p>${listHtml(g.dietTips)}</div>
          <div class="card"><p>运动建议</p>${listHtml(g.exerciseTips)}</div>
          <div class="card"><p>血压监测</p>${listHtml(g.monitoringTips)}</div>
          <div class="card"><p>用药提示</p>${listHtml(g.medicationTips)}</div>
        </div>
      </div>
      <div class="section notes"><h3>六、指南与说明</h3>${listHtml(report.guidelineNotes)}</div>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-800">高血压专项健康管理方案</h3>
          <p className="text-sm text-slate-500 mt-1">
            {patientName || profile?.name || '参与者'} · 生成于 {(report.generatedAt || '').slice(0, 10)}
          </p>
          <span className={`inline-block mt-2 text-xs font-bold px-2 py-1 rounded border ${riskBadge(report.riskLevel)}`}>
            风险分级：{report.riskLevel}
          </span>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="bg-slate-800 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-700 shrink-0"
        >
          🖨️ 打印方案
        </button>
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
