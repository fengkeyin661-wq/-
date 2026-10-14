/**
 * 用户端个人健康档案打印稿：不含医生署名，并标明不能作为诊断或处方。
 */
import type { HealthAssessment, HealthRecord } from '../types';
import { ARCHIVE_TREND_PRINT_CSS, buildArchiveTrendPrintHtml } from './archiveTrendPrintHtml';
import { ensureHealthRecordShape } from './healthRecordDefaults';
import { HEALTH_MANAGEMENT_HOTLINE } from './userServiceCatalog';

const esc = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmt = (value: unknown, unit?: string): string => {
  if (value == null || value === '') return '';
  const text = String(value).trim();
  if (!text) return '';
  return unit ? `${text}${unit}` : text;
};

const hasText = (value: unknown): boolean => value != null && String(value).trim() !== '';

const kvGrid = (items: { label: string; value: string }[]): string => {
  const visible = items.filter((item) => item.value);
  if (!visible.length) return '';
  return `<div class="kv-grid">${visible
    .map(
      (item) =>
        `<div class="kv"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></div>`
    )
    .join('')}</div>`;
};

const textBlocks = (items: { label: string; value?: string }[]): string => {
  const visible = items.filter((item) => hasText(item.value));
  if (!visible.length) return '';
  return visible
    .map(
      (item) =>
        `<div class="text-block"><div class="text-label">${esc(item.label)}</div><div>${esc(String(item.value))}</div></div>`
    )
    .join('');
};

const listHtml = (items: string[] | undefined): string => {
  const visible = (items || []).map((item) => item.trim()).filter(Boolean);
  if (!visible.length) return '<p class="empty">无</p>';
  return `<ul>${visible.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
};

const section = (title: string, body: string): string => {
  if (!body.trim()) return '';
  return `<div class="section"><div class="section-title">${esc(title)}</div>${body}</div>`;
};

const riskLabel = (level?: string): string => {
  if (level === 'RED') return '高风险';
  if (level === 'YELLOW') return '中风险';
  if (level === 'GREEN') return '低风险';
  return '';
};

const snapshotHtml = (raw: HealthRecord): string => {
  const record = ensureHealthRecordShape(raw);
  const c = record.checkup;
  const bc = c.bodyComposition || {};
  const lab = c.labBasic;
  const img = c.imagingBasic;
  const opt = c.optional;
  const art = opt.arteriosclerosis || {};
  const bodyFatRate = bc.bodyFatRate ?? record.riskModelExtras?.bodyFatRate;
  const hba1c = lab.hba1c ?? opt.hba1c;
  const homocysteine = lab.homocysteine ?? opt.homocysteine;

  return [
    section(
      '基础体征',
      kvGrid([
        { label: '身高', value: fmt(c.basics.height, ' cm') },
        { label: '体重', value: fmt(c.basics.weight, ' kg') },
        { label: 'BMI', value: fmt(c.basics.bmi) },
        {
          label: '血压',
          value: c.basics.sbp && c.basics.dbp ? `${c.basics.sbp}/${c.basics.dbp} mmHg` : '',
        },
        { label: '腰围', value: fmt(c.basics.waist, ' cm') },
        { label: '体脂率', value: fmt(bodyFatRate, '%') },
      ])
    ),
    section(
      '人体成分',
      kvGrid([
        { label: '体脂率', value: fmt(bodyFatRate, '%') },
        { label: '体脂肪量', value: fmt(bc.bodyFatMass, ' kg') },
        { label: '去脂体重', value: fmt(bc.leanBodyMass, ' kg') },
        { label: '骨骼肌质量', value: fmt(bc.skeletalMuscleMass, ' kg') },
        { label: '肌肉量', value: fmt(bc.muscleMass, ' kg') },
        { label: '内脏脂肪面积', value: fmt(bc.visceralFatArea, ' cm²') },
        { label: '内脏脂肪等级', value: fmt(bc.visceralFatLevel, ' 级') },
        { label: '腰臀比', value: fmt(bc.waistHipRatio) },
        { label: 'InBody评分', value: fmt(bc.inbodyScore, ' 分') },
      ])
    ),
    section(
      '实验室检查',
      [
        kvGrid([
          { label: '空腹血糖', value: fmt(lab.glucose?.fasting, ' mmol/L') },
          { label: '糖化血红蛋白', value: fmt(hba1c, '%') },
          { label: '同型半胱氨酸', value: fmt(homocysteine, ' μmol/L') },
          { label: '总胆固醇', value: fmt(lab.lipids?.tc, ' mmol/L') },
          { label: '甘油三酯', value: fmt(lab.lipids?.tg, ' mmol/L') },
          { label: 'LDL-C', value: fmt(lab.lipids?.ldl, ' mmol/L') },
          { label: 'HDL-C', value: fmt(lab.lipids?.hdl, ' mmol/L') },
          { label: '血肌酐', value: fmt(lab.renal?.creatinine, ' μmol/L') },
          { label: '尿素', value: fmt(lab.renal?.urea) },
          { label: '尿酸', value: fmt(lab.renal?.ua) },
          { label: '白细胞', value: fmt(lab.bloodRoutine?.wbc) },
          { label: '血红蛋白', value: fmt(lab.bloodRoutine?.hgb, ' g/L') },
          { label: '血小板', value: fmt(lab.bloodRoutine?.plt) },
          { label: '尿蛋白', value: fmt(lab.urineRoutine?.protein) },
          { label: '尿糖', value: fmt(lab.urineRoutine?.glucose) },
          { label: '尿潜血', value: fmt(lab.urineRoutine?.blood) },
        ]),
        textBlocks([
          { label: '血常规小结', value: lab.bloodRoutine?.summary },
          { label: '尿常规小结', value: lab.urineRoutine?.summary },
        ]),
      ].join('')
    ),
    section(
      '影像与功能检查',
      textBlocks([
        { label: '心电图', value: img.ecg },
        { label: '甲状腺彩超', value: img.ultrasound?.thyroid },
        { label: '腹部彩超', value: img.ultrasound?.abdomen },
        { label: '乳腺彩超', value: img.ultrasound?.breast },
        { label: '颈动脉彩超', value: opt.carotidUltrasound },
        { label: '心脏彩超', value: opt.heartUltrasound },
        { label: 'CT', value: opt.ct },
        { label: '眼底照相', value: opt.fundusPhoto },
      ])
    ),
    section(
      '动脉硬化检测',
      [
        kvGrid([
          { label: 'ABI', value: fmt(art.abi ?? art.rightABI ?? art.leftABI) },
          { label: 'PWV', value: fmt(art.pwv ?? art.rightBaPWV ?? art.leftBaPWV, ' cm/s') },
          { label: '分级', value: fmt(art.grade) },
        ]),
        textBlocks([
          { label: '结论', value: art.conclusion },
          { label: '风险提示', value: art.risk },
        ]),
      ].join('')
    ),
  ].join('');
};

const assessmentHtml = (assessment?: HealthAssessment): string => {
  if (!assessment) return '';
  const level = riskLabel(assessment.riskLevel);
  const critical = assessment.isCritical
    ? `<div class="critical">如有明显不适，请尽快就医。${assessment.criticalWarning ? esc(assessment.criticalWarning) : ''}</div>`
    : '';
  return `<div class="section">
    <div class="section-title">健康管理建议</div>
    ${level ? `<p class="level">当前分层：${esc(level)}。此分层仅供自我健康管理参考。</p>` : ''}
    ${critical}
    ${assessment.summary ? `<div class="text-block"><div class="text-label">综述</div><div>${esc(assessment.summary)}</div></div>` : ''}
    <div class="risk-grid">
      <div><div class="rh rh-red">需关注</div>${listHtml(assessment.risks?.red)}</div>
      <div><div class="rh rh-yellow">建议留意</div>${listHtml(assessment.risks?.yellow)}</div>
    </div>
    <div class="plan-grid">
      <div class="plan-card"><div class="plan-title">饮食</div>${listHtml(assessment.managementPlan?.dietary)}</div>
      <div class="plan-card"><div class="plan-title">运动</div>${listHtml(assessment.managementPlan?.exercise)}</div>
      <div class="plan-card"><div class="plan-title">健康建议</div>${listHtml(assessment.managementPlan?.medication)}</div>
      <div class="plan-card"><div class="plan-title">监测</div>${listHtml(assessment.managementPlan?.monitoring)}</div>
    </div>
    <div class="text-block">
      <div class="text-label">复查提示</div>
      <div>${esc(assessment.followUpPlan?.frequency || '按健康管理计划安排')}${
        assessment.followUpPlan?.nextCheckItems?.length
          ? `。项目：${esc(assessment.followUpPlan.nextCheckItems.join('、'))}`
          : ''
      }</div>
    </div>
  </div>`;
};

const DISCLAIMER =
  '本资料仅供个人健康参考，不能作为疾病诊断或处方依据。指标变化与文字建议不能替代执业医师的当面诊疗。如有不适，请及时到医疗机构就诊。';

export const buildUserHealthArchivePrintHtml = async (input: {
  record: HealthRecord;
  assessment?: HealthAssessment;
  checkupId: string;
  extraMetricCodes?: string[];
}): Promise<string> => {
  const profile = input.record.profile;
  const trends = await buildArchiveTrendPrintHtml(input.checkupId, input.extraMetricCodes || []);
  const name = profile?.name || '未命名';
  const meta = [
    profile?.gender,
    profile?.age ? `${profile.age}岁` : '',
    profile?.department ? `单位 ${profile.department}` : '',
    profile?.checkupId ? `体检编号 ${profile.checkupId}` : '',
    profile?.checkupDate ? `体检日期 ${profile.checkupDate}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>个人健康档案</title>
  <style>
    body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; color: #111827; margin: 0; padding: 32px; font-size: 13px; line-height: 1.55; }
    .wrap { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 14px; font-weight: 500; color: #4b5563; margin: 0; }
    h2 { font-size: 26px; margin: 4px 0 8px; letter-spacing: 1px; }
    .meta { color: #4b5563; font-size: 13px; }
    .header { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 18px; }
    .disclaimer { border: 2px solid #b91c1c; background: #fef2f2; color: #991b1b; border-radius: 8px; padding: 12px 14px; font-weight: 700; margin-bottom: 18px; }
    .section { margin-bottom: 18px; }
    .section-title { font-size: 15px; font-weight: 700; border-left: 4px solid #0d9488; padding: 4px 8px; background: #f0fdfa; margin: 0 0 10px; }
    .kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
    .kv span { display: block; color: #6b7280; font-size: 11px; }
    .kv strong { font-weight: 700; }
    .text-block { margin-top: 8px; }
    .text-label { font-size: 11px; font-weight: 700; color: #6b7280; }
    .level { margin: 0 0 8px; }
    .critical { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 8px 10px; border-radius: 6px; margin-bottom: 8px; }
    .risk-grid, .plan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
    .plan-card, .risk-grid > div { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
    .rh, .plan-title { font-weight: 700; margin-bottom: 4px; }
    .rh-red { color: #991b1b; }
    .rh-yellow { color: #854d0e; }
    .plan-title { color: #0f766e; }
    ul { margin: 0; padding-left: 18px; }
    li { margin-bottom: 2px; }
    .empty { color: #9ca3af; margin: 0; }
    .foot { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #4b5563; font-size: 12px; display: flex; justify-content: space-between; gap: 12px; }
    ${ARCHIVE_TREND_PRINT_CSS}
    @media print {
      body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .trend-card, .plan-card, .disclaimer { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>郑州大学医院健康管理中心</h1>
      <h2>个人健康档案</h2>
      <div class="meta"><strong>${esc(name)}</strong>${meta ? ` · ${esc(meta)}` : ''}</div>
      <div class="meta">打印日期 ${esc(new Date().toLocaleDateString())}</div>
    </div>
    <div class="disclaimer">${esc(DISCLAIMER)}</div>
    ${snapshotHtml(input.record)}
    ${assessmentHtml(input.assessment)}
    ${trends}
    <div class="disclaimer">${esc(DISCLAIMER)}</div>
    <div class="foot">
      <span>咨询电话 ${esc(HEALTH_MANAGEMENT_HOTLINE)}</span>
      <span>本页由本人自助打印，无需医师署名</span>
    </div>
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
</body>
</html>`;
};
