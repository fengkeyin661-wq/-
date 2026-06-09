import React from 'react';
import type { DiabetesAssessmentResult, HealthProfile, IndicatorEdu, ScreeningFindingRow, DietGuidance, GiFoodItem, GiEducationGuide } from '../types';
import { DIABETES_CLINIC_CONTACT, GI_EDUCATION, formatGiLevel, REPORT_ENCOURAGEMENT } from '../services/diabetesEducationContent';

interface Props {
  report: DiabetesAssessmentResult;
  patientName?: string;
  profile?: HealthProfile;
}

const getGiEducation = (plan: DietGuidance): GiEducationGuide => plan.giEducation ?? GI_EDUCATION;

const getGiFoods = (plan: DietGuidance): GiFoodItem[] => {
  if (plan.giFoods?.length) return plan.giFoods;
  const legacy = (plan as { henangiFoods?: { name: string; gi: GiFoodItem['gi']; note: string }[] }).henangiFoods;
  return (
    legacy?.map((f) => ({
      ...f,
      giValue: f.gi === 'low' ? 50 : f.gi === 'medium' ? 63 : 83,
    })) ?? []
  );
};

const GiEducationBlock: React.FC<{ guide: GiEducationGuide }> = ({ guide }) => (
  <div className="text-sm text-slate-700 space-y-2 mb-3 bg-slate-50 rounded-lg p-3 border border-slate-100">
    <p>{guide.intro}</p>
    <p>{guide.standardNote}</p>
    <ul className="list-disc pl-5 space-y-1">
      {guide.tiers.map((t) => (
        <li key={t.level}>
          <strong>{t.label}</strong>（{t.range}）：{t.description}
        </li>
      ))}
    </ul>
    <p className="text-slate-500 text-xs">{guide.disclaimer}</p>
  </div>
);

const giEducationHtml = (guide: GiEducationGuide) =>
  `<p>${guide.intro}</p><p>${guide.standardNote}</p><ul>${guide.tiers
    .map((t) => `<li><strong>${t.label}</strong>（${t.range}）：${t.description}</li>`)
    .join('')}</ul><p class="muted">${guide.disclaimer}</p>`;

const GiFoodTable: React.FC<{ foods: GiFoodItem[] }> = ({ foods }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm border border-slate-200">
      <thead>
        <tr className="bg-slate-50 text-slate-700">
          <th className="border border-slate-200 px-3 py-2 text-left font-bold">食物</th>
          <th className="border border-slate-200 px-3 py-2 text-left font-bold">GI值（参考）</th>
          <th className="border border-slate-200 px-3 py-2 text-left font-bold">GI分类</th>
          <th className="border border-slate-200 px-3 py-2 text-left font-bold">选食建议</th>
        </tr>
      </thead>
      <tbody>
        {foods.map((f) => (
          <tr key={f.name} className="text-slate-700">
            <td className="border border-slate-200 px-3 py-2 font-medium whitespace-nowrap">{f.name}</td>
            <td className="border border-slate-200 px-3 py-2 whitespace-nowrap">{f.giValue}</td>
            <td className="border border-slate-200 px-3 py-2 whitespace-nowrap">{formatGiLevel(f.gi)}</td>
            <td className="border border-slate-200 px-3 py-2">{f.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const giFoodTableHtml = (foods: GiFoodItem[]) => {
  const rows = foods
    .map(
      (f) =>
        `<tr><td>${f.name}</td><td>${f.giValue}</td><td>${formatGiLevel(f.gi)}</td><td>${f.note}</td></tr>`
    )
    .join('');
  return `<table><thead><tr><th>食物</th><th>GI值（参考）</th><th>GI分类</th><th>选食建议</th></tr></thead><tbody>${rows}</tbody></table>`;
};

const getScreeningFindingRows = (report: DiabetesAssessmentResult): ScreeningFindingRow[] => {
  if (report.screeningFindingRows?.length) return report.screeningFindingRows;
  return report.screeningFindings
    .filter((f) => !f.startsWith('初筛已完成') && !f.startsWith('暂无社区'))
    .map((f) => {
      const m = f.match(/^【([^】]+)】(.+)$/);
      return {
        domainLabel: m?.[1] ?? '—',
        itemLabel: '—',
        result: m?.[2] ?? f,
        referenceRange: '—',
      };
    });
};

const screeningSummaryNote = (report: DiabetesAssessmentResult) =>
  report.screeningFindings.find(
    (f) => f.startsWith('初筛已完成') || f.startsWith('暂无社区')
  );

const ScreeningFindingTable: React.FC<{ rows: ScreeningFindingRow[] }> = ({ rows }) => {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">暂无</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-slate-200">
        <thead>
          <tr className="bg-slate-50 text-slate-700">
            <th className="border border-slate-200 px-3 py-2 text-left font-bold">检查项目</th>
            <th className="border border-slate-200 px-3 py-2 text-left font-bold">检测指标</th>
            <th className="border border-slate-200 px-3 py-2 text-left font-bold">本次结果</th>
            <th className="border border-slate-200 px-3 py-2 text-left font-bold">正常参考范围</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="text-slate-700">
              <td className="border border-slate-200 px-3 py-2 font-medium whitespace-nowrap">{r.domainLabel}</td>
              <td className="border border-slate-200 px-3 py-2 whitespace-nowrap">{r.itemLabel}</td>
              <td className="border border-slate-200 px-3 py-2">{r.result}</td>
              <td className="border border-slate-200 px-3 py-2">{r.referenceRange}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const screeningFindingTableHtml = (rows: ScreeningFindingRow[]) => {
  if (!rows.length) return '<p class="muted">暂无</p>';
  const body = rows
    .map(
      (r) =>
        `<tr><td>${r.domainLabel}</td><td>${r.itemLabel}</td><td>${r.result}</td><td>${r.referenceRange}</td></tr>`
    )
    .join('');
  return `<table><thead><tr><th>检查项目</th><th>检测指标</th><th>本次结果</th><th>正常参考范围</th></tr></thead><tbody>${body}</tbody></table>`;
};

const IndicatorEducationTable: React.FC<{ items: IndicatorEdu[] }> = ({ items }) => {
  if (!items.length) {
    return <p className="text-sm text-slate-500">暂无</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-slate-200">
        <thead>
          <tr className="bg-slate-50 text-slate-700">
            <th className="border border-slate-200 px-3 py-2 text-left font-bold">检测指标</th>
            <th className="border border-slate-200 px-3 py-2 text-left font-bold">参考范围</th>
            <th className="border border-slate-200 px-3 py-2 text-left font-bold">临床意义</th>
            <th className="border border-slate-200 px-3 py-2 text-left font-bold">建议检测周期</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.itemId} className="text-slate-700">
              <td className="border border-slate-200 px-3 py-2 font-medium whitespace-nowrap">{e.label}</td>
              <td className="border border-slate-200 px-3 py-2">{e.referenceRange}</td>
              <td className="border border-slate-200 px-3 py-2">{e.clinicalMeaning}</td>
              <td className="border border-slate-200 px-3 py-2 whitespace-nowrap">{e.retestCycle}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const contactSectionHtml = () =>
  `<div class="contact-box">
    <p><strong>健康咨询</strong></p>
    <p>工作时间：${DIABETES_CLINIC_CONTACT.workHours}</p>
    <p>联系电话：${DIABETES_CLINIC_CONTACT.phone}</p>
    <p>${DIABETES_CLINIC_CONTACT.inviteText}</p>
  </div>`;

const encouragementHtml = () =>
  `<div class="encourage-box">
    <p><strong>${REPORT_ENCOURAGEMENT.title}</strong></p>
    ${REPORT_ENCOURAGEMENT.paragraphs.map((p) => `<p>${p}</p>`).join('')}
  </div>`;

const EncouragementBlock: React.FC = () => (
  <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50 p-4 text-sm text-slate-700 space-y-2">
    <p className="font-bold text-teal-900">{REPORT_ENCOURAGEMENT.title}</p>
    {REPORT_ENCOURAGEMENT.paragraphs.map((p, i) => (
      <p key={i} className="leading-relaxed">
        {p}
      </p>
    ))}
  </div>
);

const ContactSection: React.FC = () => (
  <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-slate-700 space-y-1">
    <p className="font-bold text-slate-800">健康咨询</p>
    <p>工作时间：{DIABETES_CLINIC_CONTACT.workHours}</p>
    <p>联系电话：{DIABETES_CLINIC_CONTACT.phone}</p>
    <p>{DIABETES_CLINIC_CONTACT.inviteText}</p>
  </div>
);

const indicatorEducationTableHtml = (items: IndicatorEdu[]) => {
  if (!items.length) return '<p class="muted">暂无</p>';
  const rows = items
    .map(
      (e) =>
        `<tr><td>${e.label}</td><td>${e.referenceRange}</td><td>${e.clinicalMeaning}</td><td>${e.retestCycle}</td></tr>`
    )
    .join('');
  return `<table><thead><tr><th>检测指标</th><th>参考范围</th><th>临床意义</th><th>建议检测周期</th></tr></thead><tbody>${rows}</tbody></table>`;
};

export const DiabetesAssessmentReport: React.FC<Props> = ({ report, patientName, profile }) => {
  const screeningRows = getScreeningFindingRows(report);
  const screeningNote = screeningSummaryNote(report);
  const giEducation = getGiEducation(report.dietPlan);
  const giFoods = getGiFoods(report.dietPlan);

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

    const listHtml = (items: string[]) =>
      items.length
        ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
        : '<p class="muted">暂无</p>';

    const alertsHtml = report.complicationAlerts.length
      ? `<div class="alert-box">${report.complicationAlerts.map((a) => `<p>⚠️ ${a}</p>`).join('')}</div>`
      : '';

    const missedHtml = report.missedItems.length
      ? `<table><thead><tr><th>项目</th><th>临床意义</th><th>建议周期</th></tr></thead><tbody>${report.missedItems
          .map((m) => `<tr><td>${m.label}</td><td>${m.clinicalMeaning}</td><td>${m.recommendedCycle}</td></tr>`)
          .join('')}</tbody></table>`
      : '<p class="muted">暂无项目补检建议</p>';

    const retestHtml = report.retestAdvice.length
      ? `<table><thead><tr><th>项目</th><th>当前发现</th><th>建议</th></tr></thead><tbody>${report.retestAdvice
          .map((r) => `<tr><td>${r.label}</td><td>${r.currentFinding}</td><td>${r.advice}</td></tr>`)
          .join('')}</tbody></table>`
      : '<p class="muted">暂无复检建议</p>';

    const giHtml = giFoodTableHtml(giFoods);

    const exerciseHtml = report.exercisePlan.weeklyPlan
      .map((d) => `<tr><td>${d.day}</td><td>${d.activity}</td><td>${d.duration}</td><td>${d.intensity}</td></tr>`)
      .join('');

    printWindow.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>糖尿病专项筛查评估报告</title>
      <style>
        body{font-family:"Microsoft YaHei",sans-serif;padding:40px;font-size:14px;line-height:1.6;color:#333}
        .header{text-align:center;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:24px}
        .header h1{font-size:26px;margin:0}
        .meta{display:flex;justify-content:space-between;margin-top:12px;color:#555}
        .summary-box{padding:16px;background:#f8fafc;border-radius:8px;margin-bottom:24px;border:1px solid #e2e8f0}
        .section{margin-bottom:24px}
        .section h3{font-size:16px;border-left:4px solid #0d9488;padding-left:8px;margin-bottom:10px}
        .alert-box{background:#fef2f2;border:2px solid #ef4444;padding:12px;border-radius:8px;color:#b91c1c}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}
        th{background:#f8fafc}
        .muted{color:#888}
        ul{padding-left:20px}
        .contact-box{margin-top:8px;padding:16px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px}
        .encourage-box{margin-bottom:24px;padding:18px 20px;background:linear-gradient(135deg,#f0fdfa,#ecfdf5);border:1px solid #99f6e4;border-radius:10px;color:#334155;line-height:1.8}
        .encourage-box p{margin:0 0 10px}
        .encourage-box p:last-child{margin-bottom:0}
      </style></head><body>
      <div class="header">
        <p>社区糖尿病并发症筛查</p>
        <h1>糖尿病专项筛查评估报告</h1>
        <div class="meta"><span>姓名：${pName} ${pGender} ${pAge}</span><span>${pDept ? `单位：${pDept}` : ''}</span><span>生成日期：${report.generatedAt.slice(0, 10)}</span></div>
      </div>
      ${encouragementHtml()}
      <div class="summary-box"><p>${report.summary}</p></div>
      ${alertsHtml}
      <div class="section"><h3>一、本次检查风险提示</h3>${screeningNote ? `<p>${screeningNote}</p>` : ''}${screeningFindingTableHtml(screeningRows)}</div>
      <div class="section"><h3>二、项目补检建议</h3>${missedHtml}</div>
      <div class="section"><h3>三、已检项目复检与进一步检查建议</h3>${retestHtml}</div>
      <div class="section"><h3>四、膳食指导</h3>
        <p><strong>原则：</strong></p>${listHtml(report.dietPlan.principles)}
        <p><strong>升糖指数（GI）科普：</strong></p>${giEducationHtml(giEducation)}
        <p><strong>常见食物 GI 参考（中国居民日常膳食）：</strong></p>
        ${giHtml}
        <p><strong>烹调方法：</strong></p>${listHtml(report.dietPlan.cookingTips)}
        <p><strong>进食技巧：</strong></p>${listHtml(report.dietPlan.eatingTips)}
      </div>
      <div class="section"><h3>五、运动指导</h3>
        <p>${report.exercisePlan.summary}</p>
        <table><thead><tr><th>星期</th><th>活动</th><th>时长</th><th>强度</th></tr></thead><tbody>${exerciseHtml}</tbody></table>
        <p><strong>注意事项：</strong></p>${listHtml(report.exercisePlan.precautions)}
      </div>
      <div class="section"><h3>六、并发症就医提醒</h3>
        ${report.complicationAlerts.length ? listHtml(report.complicationAlerts) : '<p class="muted">本次未见需及时就医的并发症相关信号，请继续保持定期筛查。</p>'}
      </div>
      <div class="section"><h3>七、指南与系统建议</h3>${listHtml(report.guidelineNotes)}</div>
      <div class="section"><h3>八、糖尿病常见检测指标科普</h3>${indicatorEducationTableHtml(report.indicatorEducation)}</div>
      <div class="section"><h3>九、健康咨询与联系方式</h3>${contactSectionHtml()}</div>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">糖尿病专项筛查评估报告</h3>
        <button
          onClick={handlePrint}
          className="bg-slate-800 text-white px-4 py-1.5 rounded-lg text-sm font-bold"
        >
          打印报告
        </button>
      </div>

      <EncouragementBlock />

      <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-100">{report.summary}</p>

      {report.initialScreeningCoverage && report.initialScreeningCoverage.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {report.initialScreeningCoverage.map((c) => (
            <span
              key={c.itemId}
              className={`text-xs px-2 py-1 rounded-full ${
                c.done ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400 border border-slate-200'
              }`}
            >
              {c.done ? '✓' : '○'} {c.label}
            </span>
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

      <Section title="一、本次检查风险提示">
        {screeningNote && <p className="text-sm text-slate-600 mb-2">{screeningNote}</p>}
        <ScreeningFindingTable rows={screeningRows} />
      </Section>
      <Section title="二、项目补检建议">
        {report.missedItems.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="border border-slate-200 px-3 py-2 text-left font-bold">项目</th>
                  <th className="border border-slate-200 px-3 py-2 text-left font-bold">临床意义</th>
                  <th className="border border-slate-200 px-3 py-2 text-left font-bold">建议周期</th>
                </tr>
              </thead>
              <tbody>
                {report.missedItems.map((m, i) => (
                  <tr key={i} className="text-slate-700">
                    <td className="border border-slate-200 px-3 py-2 font-medium whitespace-nowrap">{m.label}</td>
                    <td className="border border-slate-200 px-3 py-2">{m.clinicalMeaning}</td>
                    <td className="border border-slate-200 px-3 py-2 whitespace-nowrap">{m.recommendedCycle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">暂无项目补检建议</p>
        )}
      </Section>
      <Section title="三、复检与进一步检查建议">
        {report.retestAdvice.length ? (
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
            {report.retestAdvice.map((r, i) => (
              <li key={i}>
                <strong>{r.label}</strong>：{r.currentFinding} → {r.advice}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">暂无</p>
        )}
      </Section>
      <Section title="四、膳食指导">
        <p className="text-sm text-slate-600 mb-3">{report.dietPlan.principles.join('；')}</p>
        <p className="text-sm font-bold text-slate-800 mb-2">升糖指数（GI）科普</p>
        <GiEducationBlock guide={giEducation} />
        <p className="text-sm font-bold text-slate-800 mb-2">常见食物 GI 参考（中国居民日常膳食）</p>
        <GiFoodTable foods={giFoods} />
        <p className="text-sm font-bold text-slate-800 mt-3 mb-1">烹调方法</p>
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          {report.dietPlan.cookingTips.slice(0, 4).map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </Section>
      <Section title="五、运动指导">
        <p className="text-sm text-slate-600">{report.exercisePlan.summary}</p>
      </Section>
      <Section
        title="六、并发症就医提醒"
        items={
          report.complicationAlerts.length
            ? report.complicationAlerts
            : ['本次未见需及时就医的并发症相关信号，请继续保持定期筛查。']
        }
      />
      <Section title="七、指南与系统建议" items={report.guidelineNotes.slice(0, 4)} />
      <Section title="八、糖尿病常见检测指标科普">
        <IndicatorEducationTable items={report.indicatorEducation} />
      </Section>
      <Section title="九、健康咨询与联系方式">
        <ContactSection />
      </Section>
    </div>
  );
};

const Section: React.FC<{
  title: string;
  items?: string[];
  children?: React.ReactNode;
}> = ({ title, items, children }) => (
  <div>
    <h4 className="text-sm font-bold text-slate-800 mb-2 border-l-4 border-teal-500 pl-2">{title}</h4>
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
