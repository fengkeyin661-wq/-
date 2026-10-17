/**
 * 管理端与用户端共用的健康档案打印稿。
 * 版式一致；用户端不印医师签名，并写明不能作为诊断或处方。
 */
import type { HealthAssessment, HealthProfile, RiskAnalysisData } from '../types';
import { RiskLevel } from '../types';
import { ARCHIVE_TREND_PRINT_CSS, buildArchiveTrendPrintHtml } from './archiveTrendPrintHtml';

export type ArchivePrintAudience = 'staff' | 'user';

const esc = (raw: unknown): string =>
  String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const renderList = (items: string[] | undefined): string => {
  const visible = (items || []).map((item) => item.trim()).filter(Boolean);
  if (!visible.length) return '<p class="empty-text">无特定建议</p>';
  return `<ul class="list">${visible.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
};

const RISK_LABEL = { RED: '高风险', YELLOW: '中风险', GREEN: '低风险' } as const;
const RISK_BG = { RED: '#fee2e2', YELLOW: '#fef9c3', GREEN: '#dcfce7' } as const;
const RISK_TEXT = { RED: '#991b1b', YELLOW: '#854d0e', GREEN: '#166534' } as const;

const USER_DISCLAIMER =
  '本资料仅供个人健康参考，不能作为疾病诊断或处方依据。具体诊疗请到医疗机构，由执业医师当面判定。';

export const buildHealthArchivePrintHtml = async (input: {
  assessment?: HealthAssessment;
  patientName?: string;
  profile?: HealthProfile;
  checkupId?: string;
  riskAnalysis?: RiskAnalysisData;
  includeRiskModels?: boolean;
  audience: ArchivePrintAudience;
}): Promise<string> => {
  const assessment = input.assessment;
  const profile = input.profile;
  const checkupId = input.checkupId || profile?.checkupId || '';
  const riskLevel = assessment?.riskLevel;
  const knownRisk = riskLevel === RiskLevel.RED || riskLevel === RiskLevel.YELLOW || riskLevel === RiskLevel.GREEN;
  const riskBg = knownRisk ? RISK_BG[riskLevel] : '#f8fafc';
  const riskText = knownRisk ? RISK_TEXT[riskLevel] : '#475569';
  const riskLabel = knownRisk ? RISK_LABEL[riskLevel] : '暂无评估';
  const pName = profile?.name || input.patientName || '未命名';
  const pGender = profile?.gender || '';
  const pAge = profile?.age ? `${profile.age}岁` : '';
  const pDept = profile?.department || '';

  let trendsHtml = '';
  if (checkupId) {
    try {
      trendsHtml = await buildArchiveTrendPrintHtml(checkupId);
    } catch {
      trendsHtml = '';
    }
  }

  let modelsHtml = '';
  if (input.includeRiskModels && input.riskAnalysis?.models?.length) {
    const modelsRows = input.riskAnalysis.models
      .map(
        (model) => `
            <tr>
                <td>${esc(model.category)}</td>
                <td><strong>${esc(model.modelName)}</strong></td>
                <td>${esc(model.score)}</td>
                <td class="${model.riskLevel === 'RED' ? 'risk-red' : model.riskLevel === 'YELLOW' ? 'risk-yellow' : 'risk-green'}">
                    ${esc(model.riskLabel)}
                </td>
                <td>${esc(model.description)}</td>
            </tr>`
      )
      .join('');
    modelsHtml = `
            <div class="section-title">📊 疾病风险预测模型评估</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 20%">类别</th>
                        <th style="width: 25%">模型</th>
                        <th style="width: 15%">评分</th>
                        <th style="width: 15%">等级</th>
                        <th>解读</th>
                    </tr>
                </thead>
                <tbody>${modelsRows}</tbody>
            </table>`;
  }

  const criticalBanner = assessment?.isCritical
    ? `<div class="critical-banner">⚠️ 危急值警示：${esc(assessment.criticalWarning || '存在严重异常指标，请立即处理！')}</div>`
    : '';

  const summary = assessment?.summary?.trim() || '暂无已发布的综合评估综述。';
  const frequency = assessment?.followUpPlan?.frequency?.trim() || '暂无';
  const isUser = input.audience === 'user';
  const signature = isUser
    ? ''
    : `<div class="footer">
                    <div>评估医师签名: _________________</div>
                    <div>受检者确认: _________________</div>
                </div>`;
  const disclaimer = isUser ? USER_DISCLAIMER : '本方案仅供参考，具体治疗请遵医嘱。';

  return `<!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <title>健康风险评估报告</title>
            <style>
                body {
                    font-family: "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif;
                    background-color: #fff;
                    color: #333;
                    margin: 0;
                    padding: 40px;
                    font-size: 14px;
                    line-height: 1.6;
                }
                .container { max-width: 800px; margin: 0 auto; }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #111827;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .header h1 { font-size: 20px; color: #4b5563; margin-bottom: 5px; font-weight: normal; }
                .header h2 { font-size: 28px; font-weight: 800; margin: 0; letter-spacing: 2px; color: #111827; }
                .meta-row { display: flex; justify-content: space-between; margin-top: 15px; font-size: 14px; color: #4b5563; }
                .risk-banner {
                    background-color: ${riskBg};
                    color: ${riskText};
                    padding: 20px;
                    border-radius: 8px;
                    text-align: center;
                    margin-bottom: 30px;
                    border: 1px solid currentColor;
                }
                .risk-label { font-size: 24px; font-weight: 900; display: block; margin-bottom: 5px; }
                .risk-desc { font-size: 14px; opacity: 0.9; }
                .critical-banner {
                    background-color: #fef2f2;
                    color: #b91c1c;
                    border: 2px solid #ef4444;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 25px;
                    text-align: center;
                    font-weight: bold;
                    font-size: 16px;
                }
                .section { margin-bottom: 25px; }
                .section-title {
                    font-size: 16px; font-weight: bold; border-left: 5px solid #0d9488;
                    padding-left: 10px; margin-bottom: 12px; color: #111827;
                    background-color: #f0fdfa; padding-top: 5px; padding-bottom: 5px;
                    margin-top: 25px;
                }
                .content-box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; }
                .summary-text { font-size: 15px; text-align: justify; white-space: pre-line; }
                .risk-grid { display: flex; gap: 20px; margin-bottom: 20px; }
                .risk-col { flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
                .risk-header { padding: 8px 15px; font-weight: bold; font-size: 14px; }
                .rh-red { background-color: #fef2f2; color: #991b1b; }
                .rh-yellow { background-color: #fefce8; color: #854d0e; }
                .risk-body { padding: 15px; }
                .plan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .plan-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; }
                .plan-title { font-weight: bold; color: #0f766e; margin-bottom: 10px; font-size: 15px; border-bottom: 1px solid #ccfbf1; padding-bottom: 5px; }
                ul.list { padding-left: 20px; margin: 0; }
                ul.list li { margin-bottom: 4px; color: #374151; }
                .empty-text { color: #9ca3af; font-style: italic; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
                th, td { border: 1px solid #eee; padding: 8px; text-align: left; }
                th { background: #f9fafb; font-weight: bold; }
                .risk-red { color: #dc2626; font-weight: bold; }
                .risk-yellow { color: #d97706; font-weight: bold; }
                .risk-green { color: #16a34a; }
                .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 20px; }
                .disclaimer-box { border-top: 2px solid #374151; padding-top: 15px; margin-top: 20px; text-align: center; }
                .disclaimer { font-weight: bold; font-size: 14px; color: #dc2626; margin-bottom: 8px; }
                .contact-info { font-size: 12px; color: #4b5563; display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; }
                .contact-info span { display: inline-block; }
                ${ARCHIVE_TREND_PRINT_CSS}
                @media print {
                    body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .plan-card, .risk-col, .disclaimer-box, .trend-card { break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>郑州大学医院健康管理中心</h1>
                    <h2>健康风险评估与健康方案</h2>
                    <div class="meta-row">
                        <span>受检人: <strong>${esc(pName)}</strong> ${esc(pGender)} ${esc(pAge)}</span>
                        <span>部门: ${esc(pDept)}</span>
                        <span>评估日期: ${esc(new Date().toLocaleDateString())}</span>
                    </div>
                </div>
                ${criticalBanner}
                <div class="risk-banner">
                    <span class="risk-label">${esc(riskLabel)}</span>
                    <span class="risk-desc">${knownRisk ? '根据您的体检数据与健康问卷综合判定' : '档案中尚无已发布的综合评估'}</span>
                </div>
                ${modelsHtml}
                <div class="section">
                    <div class="section-title">综合评估综述</div>
                    <div class="content-box summary-text">${esc(summary)}</div>
                </div>
                <div class="risk-grid">
                    <div class="risk-col">
                        <div class="risk-header rh-red">🔴 高危因素</div>
                        <div class="risk-body">${renderList(assessment?.risks?.red)}</div>
                    </div>
                    <div class="risk-col">
                        <div class="risk-header rh-yellow">🟡 中危因素</div>
                        <div class="risk-body">${renderList(assessment?.risks?.yellow)}</div>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">健康管理方案</div>
                    <div class="plan-grid">
                        <div class="plan-card">
                            <div class="plan-title">🥗 饮食干预</div>
                            ${renderList(assessment?.managementPlan?.dietary)}
                        </div>
                        <div class="plan-card">
                            <div class="plan-title">🏃 运动方案</div>
                            ${renderList(assessment?.managementPlan?.exercise)}
                        </div>
                        <div class="plan-card">
                            <div class="plan-title">💊 医疗建议</div>
                            ${renderList(assessment?.managementPlan?.medication)}
                        </div>
                        <div class="plan-card">
                            <div class="plan-title">🔍 监测与随访</div>
                            ${renderList(assessment?.managementPlan?.monitoring)}
                        </div>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">📅 随访计划建议</div>
                    <div class="content-box">
                        <p style="margin-bottom: 8px;"><strong>建议随访频率:</strong> ${esc(frequency)}</p>
                        <div>
                            <strong>重点复查项目:</strong>
                            <div style="margin-top: 5px;">
                                ${renderList(assessment?.followUpPlan?.nextCheckItems)}
                            </div>
                        </div>
                    </div>
                </div>
                ${trendsHtml}
                ${signature}
                <div class="disclaimer-box">
                    <p class="disclaimer">${esc(disclaimer)}</p>
                    <div class="contact-info">
                        <span>制定机构：郑州大学医院</span>
                        <span>服务热线：0371-67739538</span>
                        <span>工作时间：周一至周五上午8:00-12:00，下午2:30-5:30</span>
                    </div>
                </div>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() { window.print(); }, 500);
                };
            </script>
        </body>
        </html>`;
};
