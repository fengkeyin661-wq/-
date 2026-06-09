import type { ScreeningDomainSummary } from '../types';

export interface ScreeningFindingRow {
  domainLabel: string;
  itemLabel: string;
  result: string;
  referenceRange: string;
}

const REF = {
  fastingGlucose: '3.9–6.1 mmol/L',
  postprandialGlucose: '<7.8 mmol/L',
  glucoseDeviceRisk: '低风险（设备评估）',
  ecg: '窦性心律，无显著ST-T异常',
  heartRate: '60–100 次/分',
  abi: '0.9–1.3',
  baPWV: '<1400 cm/s（boso）',
  cfPWV: '<10 m/s（boso）',
  bloodPressure: '<130/80 mmHg（糖尿病人群）',
  arteriosclerosisDevice: '低风险（设备评估）',
  fundus: '无糖尿病视网膜病变',
  bmi: '18.5–24 kg/m²',
  bodyFatRate: '男10–20%、女18–28%',
  vfa: '<100 cm²',
  whr: '男<0.9、女<0.85',
  inbodyScore: '≥80 分（设备参考）',
  skeletalMuscle: '与身高体重匹配（个体化）',
} as const;

const DOMAIN_SUMMARY_REF: Record<string, string> = {
  glucose: `空腹血糖 ${REF.fastingGlucose}；餐后随机血糖 ${REF.postprandialGlucose}`,
  ecg: REF.ecg,
  arteriosclerosis: `ABI ${REF.abi}；臂踝 PWV ${REF.baPWV}；颈股 PWV ${REF.cfPWV}；血压 ${REF.bloodPressure}`,
  fundus: REF.fundus,
  body_composition: `BMI ${REF.bmi}；内脏脂肪面积 ${REF.vfa}`,
};

const row = (
  domainLabel: string,
  itemLabel: string,
  result: string,
  referenceRange: string
): ScreeningFindingRow => ({ domainLabel, itemLabel, result, referenceRange });

const mapFinding = (domainLabel: string, domainId: string, finding: string): ScreeningFindingRow => {
  let m = finding.match(/^空腹血糖 (.+)$/);
  if (m) return row(domainLabel, '空腹血糖', m[1], REF.fastingGlucose);

  m = finding.match(/^餐后随机血糖 (.+)$/);
  if (m) return row(domainLabel, '餐后随机血糖', m[1], REF.postprandialGlucose);

  if (finding.startsWith('本次未测空腹血糖')) {
    return row(domainLabel, '空腹血糖', '未检测', REF.fastingGlucose);
  }
  if (finding.startsWith('本次未测餐后随机血糖')) {
    return row(domainLabel, '餐后随机血糖', '未检测', REF.postprandialGlucose);
  }

  m = finding.match(/^设备糖代谢风险评估：(.+)$/);
  if (m) return row(domainLabel, '设备糖代谢风险评估', m[1], REF.glucoseDeviceRisk);

  m = finding.match(/^心电图参数：(.+)$/);
  if (m) return row(domainLabel, '心电图参数', m[1], REF.ecg);

  m = finding.match(/^心率偏慢（(.+?)），需结合症状评估$/);
  if (m) return row(domainLabel, '心率', m[1], REF.heartRate);

  m = finding.match(/^心率偏快（(.+?)）$/);
  if (m) return row(domainLabel, '心率', m[1], REF.heartRate);

  m = finding.match(/^心电图诊断提示：(.+)$/);
  if (m) return row(domainLabel, '心电图诊断', m[1], REF.ecg);

  m = finding.match(/^心电图异常：(.+)$/);
  if (m) return row(domainLabel, '心电图', m[1], REF.ecg);

  m = finding.match(/^心电图：(.+)$/);
  if (m) return row(domainLabel, '心电图', m[1], REF.ecg);

  if (finding === '心电图参数已记录，未见明确异常诊断描述') {
    return row(domainLabel, '心电图', '参数已记录，未见明确异常诊断描述', REF.ecg);
  }

  m = finding.match(/^([左右])踝臂指数 ABI ([^，]+)，(.+)$/);
  if (m) return row(domainLabel, `${m[1]}踝臂指数 ABI`, `${m[2]}，${m[3]}`, REF.abi);

  m = finding.match(/^([左右])ABI ([^，]+)，(.+)$/);
  if (m) return row(domainLabel, `${m[1]}踝臂指数 ABI`, `${m[2]}，${m[3]}`, REF.abi);

  m = finding.match(/^左右 ABI 不对称（差值 ([^）]+)），(.+)$/);
  if (m) return row(domainLabel, '左右 ABI 对比', `差值 ${m[1]}，${m[2]}`, REF.abi);

  m = finding.match(/^([左右])臂踝 PWV ([^，]+)，(.+)$/);
  if (m) return row(domainLabel, `${m[1]}臂踝 PWV`, `${m[2]}，${m[3]}`, REF.baPWV);

  m = finding.match(/^颈股 PWV ([^，]+)，(.+)$/);
  if (m) return row(domainLabel, '颈股 PWV', `${m[1]}，${m[2]}`, REF.cfPWV);

  m = finding.match(/^([左右])上肢血压 ([^，]+)，(.+)$/);
  if (m) return row(domainLabel, `${m[1]}上肢血压`, `${m[2]}，${m[3]}`, REF.bloodPressure);

  m = finding.match(/^动脉硬化风险评估：(.+)$/);
  if (m) return row(domainLabel, '动脉硬化风险评估', m[1], REF.arteriosclerosisDevice);

  m = finding.match(/^动脉硬化结论：(.+)$/);
  if (m) return row(domainLabel, '动脉硬化结论', m[1], REF.arteriosclerosisDevice);

  m = finding.match(/^特别提示：(.+)$/);
  if (m) return row(domainLabel, '特别提示', m[1], REF.arteriosclerosisDevice);

  m = finding.match(/^([左右])眼：(.+)$/);
  if (m) return row(domainLabel, `${m[1]}眼眼底`, m[2], REF.fundus);

  if (finding === '双眼评估结果不对称，建议眼科进一步检查') {
    return row(domainLabel, '双眼对比', '评估结果不对称，建议眼科进一步检查', REF.fundus);
  }

  m = finding.match(/^身高 (\d+(?:\.\d+)?) cm，体重 (\d+(?:\.\d+)?) kg$/);
  if (m) return row(domainLabel, '身高/体重', `${m[1]} cm / ${m[2]} kg`, REF.bmi);

  m = finding.match(/^BMI ([^，]+)，(.+)$/);
  if (m) return row(domainLabel, 'BMI', `${m[1]}，${m[2]}`, REF.bmi);

  m = finding.match(/^体脂率 ([^，]+)，(.+)$/);
  if (m) return row(domainLabel, '体脂率', `${m[1]}，${m[2]}`, REF.bodyFatRate);

  m = finding.match(/^体脂率 (.+)$/);
  if (m) return row(domainLabel, '体脂率', m[1], REF.bodyFatRate);

  m = finding.match(/^内脏脂肪面积 ([^，]+)，(.+)$/);
  if (m) return row(domainLabel, '内脏脂肪面积', `${m[1]}，${m[2]}`, REF.vfa);

  m = finding.match(/^骨骼肌质量 (.+?) kg$/);
  if (m) return row(domainLabel, '骨骼肌质量', `${m[1]} kg`, REF.skeletalMuscle);

  if (finding === '骨骼肌质量相对偏低，存在肌少症风险') {
    return row(domainLabel, '骨骼肌质量', '相对偏低，存在肌少症风险', REF.skeletalMuscle);
  }

  m = finding.match(/^腰臀比 ([^，]+)，(.+)$/);
  if (m) return row(domainLabel, '腰臀比', `${m[1]}，${m[2]}`, REF.whr);

  m = finding.match(/^InBody 评分 ([^，]+)，(.+)$/);
  if (m) return row(domainLabel, 'InBody 评分', `${m[1]}，${m[2]}`, REF.inbodyScore);

  m = finding.match(/^InBody 评分 (.+)$/);
  if (m) return row(domainLabel, 'InBody 评分', m[1], REF.inbodyScore);

  return row(domainLabel, '—', finding, DOMAIN_SUMMARY_REF[domainId] ?? '—');
};

export const buildScreeningFindingRows = (
  domains: Pick<ScreeningDomainSummary, 'domainId' | 'label' | 'status' | 'findings'>[]
): ScreeningFindingRow[] => {
  const rows: ScreeningFindingRow[] = [];
  for (const d of domains) {
    if (d.status === 'not_done') {
      rows.push(
        row(d.label, '—', '本次未检测', DOMAIN_SUMMARY_REF[d.domainId] ?? '—')
      );
      continue;
    }
    for (const f of d.findings) {
      rows.push(mapFinding(d.label, d.domainId, f));
    }
  }
  return rows;
};

/** 由表格行生成兼容旧版的字符串列表 */
export const screeningFindingRowsToStrings = (rows: ScreeningFindingRow[]): string[] =>
  rows.map((r) =>
    r.itemLabel === '—'
      ? `【${r.domainLabel}】${r.result}`
      : `【${r.domainLabel}】${r.itemLabel} ${r.result}`
  );
