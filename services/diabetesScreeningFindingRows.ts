import type { ScreeningDomainSummary, ScreeningFindingSection } from '../types';

export interface ScreeningFindingRow {
  domainLabel: string;
  itemLabel: string;
  result: string;
  referenceRange: string;
}

export interface ScreeningFindingContext {
  skeletalMuscleRefLow?: number;
  skeletalMuscleRefHigh?: number;
  bodyFatMassRefLow?: number;
  bodyFatMassRefHigh?: number;
}

const formatImportedRefRange = (low?: number, high?: number, unit = 'kg'): string => {
  if (low != null && high != null) return `${low}–${high} ${unit}`;
  if (low != null) return `≥${low} ${unit}`;
  if (high != null) return `≤${high} ${unit}`;
  return '';
};

const REF = {
  fastingGlucose: '3.9–6.1 mmol/L',
  postprandialGlucose: '<7.8 mmol/L',
  glucoseDeviceRisk: '低风险（设备评估）',
  heartRate: '60–100 次/分',
  abi: '0.9–1.3',
  baPWV: '<1400 cm/s',
  cfPWV: '<10 m/s',
  bloodPressure: '<130/80 mmHg（糖尿病人群）',
  bmi: '18.5–24 kg/m²',
  bodyFatRate: '男10–20%、女18–28%',
  vfa: '<100 cm²',
  whr: '男<0.9、女<0.85',
  inbodyScore: '≥70 分',
} as const;

/** 定性结论类描述，报告正文不附正常参考范围 */
const QUALITATIVE_FINDING_PATTERNS = [
  /^心电图诊断提示：/,
  /^心电图异常：/,
  /^心电图：/,
  /^心电图参数已记录/,
  /^动脉硬化风险评估：/,
  /^动脉硬化结论：/,
  /^特别提示：/,
  /^[左右]眼：/,
  /^双眼评估结果不对称/,
] as const;

const isQualitativeFinding = (finding: string): boolean =>
  QUALITATIVE_FINDING_PATTERNS.some((p) => p.test(finding));

const DOMAIN_SUMMARY_REF: Record<string, string> = {
  glucose: `空腹血糖 ${REF.fastingGlucose}；餐后随机血糖 ${REF.postprandialGlucose}`,
  arteriosclerosis: `ABI ${REF.abi}；臂踝 PWV ${REF.baPWV}；颈股 PWV ${REF.cfPWV}`,
  blood_pressure: REF.bloodPressure,
  body_composition: `BMI ${REF.bmi}；内脏脂肪面积 ${REF.vfa}；InBody 评分 ${REF.inbodyScore}`,
};

const REPORT_SECTION_ORDER = [
  'glucose',
  'ecg',
  'arteriosclerosis',
  'blood_pressure',
  'fundus',
  'body_composition',
] as const;

const getReferenceForFinding = (
  domainId: string,
  finding: string,
  ctx?: ScreeningFindingContext
): string => {
  if (finding.includes('正常参考范围') || isQualitativeFinding(finding)) return '';

  let m = finding.match(/^空腹血糖 /);
  if (m) return REF.fastingGlucose;

  m = finding.match(/^餐后随机血糖 /);
  if (m) return REF.postprandialGlucose;

  if (finding.startsWith('本次未测空腹血糖')) return REF.fastingGlucose;
  if (finding.startsWith('本次未测餐后随机血糖')) return REF.postprandialGlucose;

  m = finding.match(/^设备糖代谢风险评估：/);
  if (m) return REF.glucoseDeviceRisk;

  m = finding.match(/^心率偏慢|^心率偏快/);
  if (m) return REF.heartRate;

  m = finding.match(/^([左右])踝臂指数 ABI |^([左右])ABI |^左右 ABI 不对称/);
  if (m) return REF.abi;

  m = finding.match(/^([左右])臂踝 PWV /);
  if (m) return REF.baPWV;

  m = finding.match(/^颈股 PWV /);
  if (m) return REF.cfPWV;

  m = finding.match(/^身高 .+，BMI /);
  if (m) return REF.bmi;

  m = finding.match(/^BMI /);
  if (m) return REF.bmi;

  m = finding.match(/^体脂率 /);
  if (m) return REF.bodyFatRate;

  m = finding.match(/^内脏脂肪面积 /);
  if (m) return REF.vfa;

  m = finding.match(/^骨骼肌质量 |^骨骼肌质量相对偏低/);
  if (m) {
    const ref = formatImportedRefRange(ctx?.skeletalMuscleRefLow, ctx?.skeletalMuscleRefHigh);
    return ref || '';
  }

  m = finding.match(/^身体脂肪量 /);
  if (m) {
    const ref = formatImportedRefRange(ctx?.bodyFatMassRefLow, ctx?.bodyFatMassRefHigh);
    return ref || '';
  }

  m = finding.match(/^腰臀比 /);
  if (m) return REF.whr;

  m = finding.match(/^InBody 评分 /);
  if (m) return REF.inbodyScore;

  return DOMAIN_SUMMARY_REF[domainId] ?? '—';
};

export const findingToParagraph = (
  domainId: string,
  finding: string,
  ctx?: ScreeningFindingContext
): string => {
  if (finding.includes('正常参考范围')) return finding;
  const ref = getReferenceForFinding(domainId, finding, ctx);
  if (!ref || ref === '—') return finding;
  return `${finding}（正常参考范围：${ref}）`;
};

export const buildScreeningFindingSections = (
  domains: Pick<ScreeningDomainSummary, 'domainId' | 'label' | 'status' | 'findings'>[],
  ctx?: ScreeningFindingContext
): ScreeningFindingSection[] => {
  const byId = new Map(domains.map((d) => [d.domainId, d]));

  return REPORT_SECTION_ORDER.map((domainId) => {
    const d = byId.get(domainId);
    if (!d) return null;

    if (d.status === 'not_done') {
      const summaryRef = DOMAIN_SUMMARY_REF[d.domainId];
      const notDoneText = summaryRef
        ? `本次未检测。正常参考范围：${summaryRef}`
        : '本次未检测。';
      return {
        domainId: d.domainId,
        itemLabel: d.label,
        status: 'not_done' as const,
        paragraphs: [notDoneText],
      };
    }

    return {
      domainId: d.domainId,
      itemLabel: d.label,
      status: 'done' as const,
      paragraphs: d.findings.map((f) => findingToParagraph(d.domainId, f, ctx)),
    };
  }).filter((s): s is ScreeningFindingSection => s != null);
};

export const screeningSectionsToStrings = (sections: ScreeningFindingSection[]): string[] =>
  sections.flatMap((s) => s.paragraphs.map((p) => `【${s.itemLabel}】${p}`));

/** @deprecated 保留兼容，报告已不再使用表格 */
export const buildScreeningFindingRows = (
  domains: Pick<ScreeningDomainSummary, 'domainId' | 'label' | 'status' | 'findings'>[]
): ScreeningFindingRow[] =>
  buildScreeningFindingSections(domains).flatMap((s) =>
    s.paragraphs.map((p, i) => ({
      domainLabel: s.itemLabel,
      itemLabel: s.paragraphs.length > 1 ? `${i + 1}` : '—',
      result: p,
      referenceRange: '—',
    }))
  );

export const screeningFindingRowsToStrings = screeningSectionsToStrings;
