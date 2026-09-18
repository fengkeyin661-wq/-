import React from 'react';
import type { HealthProfile, LipidAssessmentResult } from '../types';
import { RiskLevel } from '../types';
import { LIPID_REPORT_ENCOURAGEMENT } from '../services/lipidEducationContent';

interface Props {
  report: LipidAssessmentResult;
  patientName?: string;
  profile?: HealthProfile;
}

const riskBadge = (level: RiskLevel) => {
  if (level === RiskLevel.RED) return 'bg-red-100 text-red-800 border-red-200';
  if (level === RiskLevel.YELLOW) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
};

export const LipidAssessmentReport: React.FC<Props> = ({ report, patientName, profile }) => {
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
      items.length ? `<ul>${items.map((i) => `<li>${escape(i)}</li>`).join('')}</ul>` : '<p class="muted">暂无</p>';

    const pName = escape(profile?.name || patientName || '参与者');
    const missedHtml = report.missedItems.length
      ? `<table><thead><tr><th>项目</th><th>临床意义</th><th>建议周期</th></tr></thead><tbody>${report.missedItems
          .map(
            (m) =>
              `<tr><td>${escape(m.label)}</td><td>${escape(m.clinicalMeaning || '')}</td><td>${escape(m.recommendedCycle)}</td></tr>`
          )
          .join('')}</tbody></table>`
      : '<p class="muted">核心项目已基本完善。</p>';

    printWindow.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>血脂异常专项健康管理方案</title>
      <style>
        body{font-family:"Microsoft YaHei",sans-serif;padding:40px;font-size:14px;line-height:1.6;color:#333}
        .header{text-align:center;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:24px}
        .header h1{font-size:26px;margin:0}
        .meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin-top:12px;color:#555;font-size:13px}
        .section{margin-bottom:22px;page-break-inside:avoid}
        .section h3{font-size:16px;border-left:4px solid #d97706;padding-left:8px;margin-bottom:10px}
        .summary-box{padding:16px;background:#fffbeb;border-radius:8px;margin-bottom:20px;border:1px solid #fcd34d}
        .alert-box{background:#fef2f2;border:2px solid #ef4444;padding:12px;border-radius:8px;color:#b91c1c;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #ddd;padding:8px;font-size:13px}
        th{background:#f8fafc}
        .muted{color:#888}
        ul{padding-left:20px}
      </style></head><body>
      <div class="header">
        <p>社区血脂异常专项管理</p>
        <h1>血脂异常专项健康管理方案</h1>
        <div class="meta">
          <span>姓名：${pName}</span>
          <span>生成日期：${(report.generatedAt || '').slice(0, 10)}</span>
          <span>风险分级：${escape(report.riskLevel)}</span>
        </div>
      </div>
      <div class="summary-box"><p>${escape(report.summary)}</p></div>
      ${report.ascvdAlerts.length ? `<div class="alert-box"><h3>ASCVD 风险提示</h3>${listHtml(report.ascvdAlerts)}</div>` : ''}
      <div class="section"><h3>一、血脂评估</h3>${listHtml(report.lipidFindings)}</div>
      <div class="section"><h3>二、建议补检项目</h3>${missedHtml}</div>
      <div class="section"><h3>三、生活方式指导</h3>
        <p><strong>饮食</strong></p>${listHtml(g.dietTips)}
        <p><strong>运动</strong></p>${listHtml(g.exerciseTips)}
        <p><strong>监测</strong></p>${listHtml(g.monitoringTips)}
        <p><strong>用药</strong></p>${listHtml(g.medicationTips)}
      </div>
      <div class="section"><h3>四、指南说明</h3>${listHtml(report.guidelineNotes)}</div>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-800">血脂异常专项健康管理方案</h3>
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

      <section className="text-sm text-slate-700 bg-amber-50 rounded-lg p-4 border border-amber-100">
        <p className="font-bold text-amber-900 mb-2">{LIPID_REPORT_ENCOURAGEMENT.title}</p>
        {LIPID_REPORT_ENCOURAGEMENT.paragraphs.map((p, i) => (
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
        <h4 className="text-sm font-bold text-slate-800 mb-2">血脂评估</h4>
        <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
          {report.lipidFindings.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </section>

      {report.ascvdAlerts.length > 0 && (
        <section className="bg-red-50 border border-red-100 rounded-lg p-4">
          <h4 className="text-sm font-bold text-red-900 mb-2">ASCVD 风险提示</h4>
          <ul className="text-sm text-red-800 list-disc pl-5 space-y-1">
            {report.ascvdAlerts.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4 className="text-sm font-bold text-slate-800 mb-3">健康管理指导</h4>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          {[
            { title: '基本原则', items: g.principles },
            { title: '饮食建议', items: g.dietTips },
            { title: '运动建议', items: g.exerciseTips },
            { title: '监测与用药', items: [...g.monitoringTips.slice(0, 2), ...g.medicationTips.slice(0, 2)] },
          ].map((block) => (
            <div key={block.title} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <p className="font-bold text-slate-800 mb-2">{block.title}</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                {block.items.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
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
