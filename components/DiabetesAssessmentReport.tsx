import React from 'react';
import type { DiabetesAssessmentResult, HealthProfile } from '../types';
import { RiskLevel } from '../types';

interface Props {
  report: DiabetesAssessmentResult;
  patientName?: string;
  profile?: HealthProfile;
}

const riskLabel = (level: RiskLevel) =>
  level === RiskLevel.RED ? '高风险' : level === RiskLevel.YELLOW ? '中风险' : '低风险';

const urgencyLabel = (u: string) =>
  u === 'urgent' ? '紧急' : u === 'soon' ? '尽快' : '常规';

export const DiabetesAssessmentReport: React.FC<Props> = ({ report, patientName, profile }) => {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'height=900,width=800');
    if (!printWindow) {
      alert('浏览器拦截了弹窗，请允许本站弹出窗口以便打印。');
      return;
    }

    const pName = profile?.name || patientName || '未命名';
    const pGender = profile?.gender || '';
    const pAge = profile?.age ? `${profile.age}岁` : '';
    const pDept = profile?.department || '';
    const riskBg =
      report.riskLevel === RiskLevel.RED
        ? '#fee2e2'
        : report.riskLevel === RiskLevel.YELLOW
          ? '#fef9c3'
          : '#dcfce7';
    const riskText =
      report.riskLevel === RiskLevel.RED
        ? '#991b1b'
        : report.riskLevel === RiskLevel.YELLOW
          ? '#854d0e'
          : '#166534';

    const listHtml = (items: string[]) =>
      items.length
        ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
        : '<p class="muted">暂无</p>';

    const alertsHtml = report.complicationAlerts.length
      ? `<div class="alert-box">${report.complicationAlerts.map((a) => `<p>⚠️ ${a}</p>`).join('')}</div>`
      : '';

    const missedHtml = report.missedItems.length
      ? `<table><thead><tr><th>项目</th><th>优先级</th><th>说明</th><th>建议周期</th></tr></thead><tbody>${report.missedItems
          .map(
            (m) =>
              `<tr><td>${m.label}</td><td>${m.priority === 'high' ? '高' : m.priority === 'medium' ? '中' : '低'}</td><td>${m.reason}</td><td>${m.recommendedCycle}</td></tr>`
          )
          .join('')}</tbody></table>`
      : '<p class="muted">暂无漏检项目</p>';

    const retestHtml = report.retestAdvice.length
      ? `<table><thead><tr><th>项目</th><th>当前发现</th><th>建议</th><th>紧迫性</th></tr></thead><tbody>${report.retestAdvice
          .map(
            (r) =>
              `<tr><td>${r.label}</td><td>${r.currentFinding}</td><td>${r.advice}</td><td>${urgencyLabel(r.urgency)}</td></tr>`
          )
          .join('')}</tbody></table>`
      : '<p class="muted">暂无复检建议</p>';

    const eduHtml = report.indicatorEducation.length
      ? report.indicatorEducation
          .map(
            (e) =>
              `<div class="edu-item"><h4>${e.label}</h4><p><strong>概念：</strong>${e.concept}</p><p><strong>原理：</strong>${e.principle}</p><p><strong>参考范围：</strong>${e.referenceRange}</p><p><strong>临床意义：</strong>${e.clinicalMeaning}</p><p><strong>检测周期：</strong>${e.retestCycle}</p></div>`
          )
          .join('')
      : '<p class="muted">暂无</p>';

    const giHtml = report.dietPlan.henangiFoods
      .map(
        (f) =>
          `<tr><td>${f.name}</td><td>${f.gi === 'low' ? '低GI' : f.gi === 'medium' ? '中GI' : '高GI'}</td><td>${f.note}</td></tr>`
      )
      .join('');

    const exerciseHtml = report.exercisePlan.weeklyPlan
      .map((d) => `<tr><td>${d.day}</td><td>${d.activity}</td><td>${d.duration}</td><td>${d.intensity}</td></tr>`)
      .join('');

    printWindow.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>糖尿病健康风险评估报告</title>
      <style>
        body{font-family:"Microsoft YaHei",sans-serif;padding:40px;font-size:14px;line-height:1.6;color:#333}
        .header{text-align:center;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:24px}
        .header h1{font-size:26px;margin:0}
        .meta{display:flex;justify-content:space-between;margin-top:12px;color:#555}
        .risk-banner{padding:16px;border-radius:8px;text-align:center;margin-bottom:24px;border:1px solid currentColor}
        .section{margin-bottom:24px}
        .section h3{font-size:16px;border-left:4px solid #0d9488;padding-left:8px;margin-bottom:10px}
        .alert-box{background:#fef2f2;border:2px solid #ef4444;padding:12px;border-radius:8px;color:#b91c1c}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}
        th{background:#f8fafc}
        .edu-item{margin-bottom:12px;padding:10px;background:#f8fafc;border-radius:6px}
        .muted{color:#888}
        ul{padding-left:20px}
      </style></head><body>
      <div class="header">
        <p>社区糖尿病并发症筛查</p>
        <h1>糖尿病健康风险评估报告</h1>
        <div class="meta"><span>姓名：${pName} ${pGender} ${pAge}</span><span>部门：${pDept}</span><span>生成日期：${report.generatedAt.slice(0, 10)}</span></div>
      </div>
      <div class="risk-banner" style="background:${riskBg};color:${riskText}">
        <strong style="font-size:22px">${riskLabel(report.riskLevel)}</strong>
        <p>${report.summary}</p>
      </div>
      ${alertsHtml}
      <div class="section"><h3>一、本次检查风险提示</h3>${listHtml(report.screeningFindings)}</div>
      <div class="section"><h3>二、漏检项目补检建议</h3>${missedHtml}</div>
      <div class="section"><h3>三、已检项目复检与进一步检查建议</h3>${retestHtml}</div>
      <div class="section"><h3>四、糖尿病常见检测指标科普</h3>${eduHtml}</div>
      <div class="section"><h3>五、膳食指导</h3>
        <p><strong>原则：</strong></p>${listHtml(report.dietPlan.principles)}
        <p><strong>河南地区常见食物升糖指数（GI）：</strong></p>
        <table><thead><tr><th>食物</th><th>GI分类</th><th>说明</th></tr></thead><tbody>${giHtml}</tbody></table>
        <p><strong>烹调方法：</strong></p>${listHtml(report.dietPlan.cookingTips)}
        <p><strong>进食技巧：</strong></p>${listHtml(report.dietPlan.eatingTips)}
      </div>
      <div class="section"><h3>六、运动指导</h3>
        <p>${report.exercisePlan.summary}</p>
        <table><thead><tr><th>星期</th><th>活动</th><th>时长</th><th>强度</th></tr></thead><tbody>${exerciseHtml}</tbody></table>
        <p><strong>注意事项：</strong></p>${listHtml(report.exercisePlan.precautions)}
      </div>
      <div class="section"><h3>七、严重并发症就医提醒</h3>
        ${report.complicationAlerts.length ? listHtml(report.complicationAlerts) : '<p class="muted">本次未见需紧急就医的严重并发症信号，请继续保持定期筛查。</p>'}
      </div>
      <div class="section"><h3>八、指南与系统建议</h3>${listHtml(report.guidelineNotes)}</div>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">糖尿病首次评估报告</h3>
        <div className="flex gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              report.riskLevel === RiskLevel.RED
                ? 'bg-red-100 text-red-700'
                : report.riskLevel === RiskLevel.YELLOW
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-green-100 text-green-700'
            }`}
          >
            {riskLabel(report.riskLevel)}
          </span>
          <button
            onClick={handlePrint}
            className="bg-slate-800 text-white px-4 py-1.5 rounded-lg text-sm font-bold"
          >
            打印报告
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-600">{report.summary}</p>

      {report.initialScreeningCoverage && report.initialScreeningCoverage.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {report.initialScreeningCoverage.map((c) => (
            <span
              key={c.itemId}
              className={`text-xs px-2 py-1 rounded-full ${
                c.done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {c.done ? '✓' : '○'} {c.label}
            </span>
          ))}
        </div>
      )}

      {report.screeningDomains && report.screeningDomains.length > 0 && (
        <div className="space-y-3">
          {report.screeningDomains.map((d) => (
            <div
              key={d.domainId}
              className={`rounded-lg p-3 text-sm border ${
                d.status === 'critical'
                  ? 'bg-red-50 border-red-200'
                  : d.status === 'abnormal'
                    ? 'bg-orange-50 border-orange-200'
                    : d.status === 'borderline'
                      ? 'bg-yellow-50 border-yellow-200'
                      : d.status === 'not_done'
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-green-50 border-green-200'
              }`}
            >
              <p className="font-bold text-slate-800 mb-1">
                {d.label}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {d.status === 'critical'
                    ? '严重异常'
                    : d.status === 'abnormal'
                      ? '异常'
                      : d.status === 'borderline'
                        ? '临界'
                        : d.status === 'not_done'
                          ? '未检测'
                          : '未见明显异常'}
                </span>
              </p>
              {d.findings.length > 0 ? (
                <ul className="list-disc pl-4 text-slate-700 space-y-0.5">
                  {d.findings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">无数据</p>
              )}
            </div>
          ))}
        </div>
      )}

      {report.complicationAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm space-y-1">
          {report.complicationAlerts.map((a, i) => (
            <p key={i}>⚠️ {a}</p>
          ))}
        </div>
      )}

      <Section title="一、本次检查风险提示" items={report.screeningFindings} />
      <Section title="二、漏检项目补检建议">
        {report.missedItems.length ? (
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
            {report.missedItems.map((m, i) => (
              <li key={i}>
                <strong>{m.label}</strong>（{m.priority === 'high' ? '高' : m.priority === 'medium' ? '中' : '低'}优先级）— {m.reason}，建议周期：{m.recommendedCycle}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">暂无漏检项目</p>
        )}
      </Section>
      <Section title="三、复检与进一步检查建议">
        {report.retestAdvice.length ? (
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
            {report.retestAdvice.map((r, i) => (
              <li key={i}>
                <strong>{r.label}</strong>：{r.currentFinding} → {r.advice}（{urgencyLabel(r.urgency)}）
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">暂无</p>
        )}
      </Section>
      <Section title="四、指标科普" collapsed>
        <div className="space-y-3">
          {report.indicatorEducation.map((e, i) => (
            <div key={i} className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">
              <p className="font-bold">{e.label}</p>
              <p>参考范围：{e.referenceRange}；周期：{e.retestCycle}</p>
              <p className="text-slate-600">{e.clinicalMeaning}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="五、膳食指导（河南地区）">
        <p className="text-sm text-slate-600 mb-2">{report.dietPlan.principles.join('；')}</p>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          {report.dietPlan.henangiFoods.slice(0, 6).map((f, i) => (
            <div key={i} className="bg-slate-50 rounded px-2 py-1">
              {f.name} — {f.gi === 'low' ? '低GI' : f.gi === 'medium' ? '中GI' : '高GI'}
            </div>
          ))}
        </div>
      </Section>
      <Section title="六、运动指导">
        <p className="text-sm text-slate-600">{report.exercisePlan.summary}</p>
      </Section>
      <Section title="七、严重并发症提醒" items={report.complicationAlerts.length ? report.complicationAlerts : ['本次未见需紧急就医信号']} />
      <Section title="八、指南建议" items={report.guidelineNotes.slice(0, 4)} />
    </div>
  );
};

const Section: React.FC<{
  title: string;
  items?: string[];
  collapsed?: boolean;
  children?: React.ReactNode;
}> = ({ title, items, children }) => (
  <div>
    <h4 className="text-sm font-bold text-slate-800 mb-1 border-l-4 border-teal-500 pl-2">{title}</h4>
    {items ? (
      <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    ) : (
      children
    )}
  </div>
);
