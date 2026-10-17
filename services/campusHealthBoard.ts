import type { HealthArchive } from './dataService';
import type { HealthObservationRow } from './observationService';
import type { XlmsExamSnapshot } from '../types';
import { RiskLevel } from '../types';
import { isCriticalFollowUpPending } from './followUpLinkageService';
import { fetchBoardObservations } from './observationService';

export const BOARD_METRIC_CODES = [
  'core.sbp',
  'core.dbp',
  'core.fasting_glucose',
  'core.tc',
  'core.tg',
  'core.ldl',
  'core.hdl',
  'core.uric_acid',
  'core.bmi',
  'core.weight',
] as const;

export type BoardPerson = {
  checkupId: string;
  name: string;
  department: string;
  riskLabel: string;
  archive: HealthArchive;
};

export type RateCard = {
  id: string;
  title: string;
  count: number;
  denominator: number;
  rate: number | null;
  note: string;
  people: BoardPerson[];
};

export type YearPoint = {
  year: string;
  rate: number;
  count: number;
  denominator: number;
};

export type TrendSeries = {
  id: string;
  label: string;
  points: YearPoint[];
  note?: string;
};

export type PriorityItem = {
  title: string;
  detail: string;
};

export type CampusBoardModel = {
  enrolled: BoardPerson[];
  assessed: BoardPerson[];
  high: BoardPerson[];
  mid: BoardPerson[];
  low: BoardPerson[];
  critical: BoardPerson[];
  followUp: BoardPerson[];
  cards: RateCard[];
  numericTrends: TrendSeries[];
  textTrends: TrendSeries[];
  priorities: PriorityItem[];
};

type YearValue = { year: string; date: string; value: number };

const asText = (value: unknown): string => (value == null ? '' : String(value).trim());

const yearOf = (raw: string | undefined | null): string | null => {
  const text = asText(raw);
  const match = text.match(/(19|20)\d{2}/);
  return match ? match[0] : null;
};

const num = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  const text = asText(value).replace(/,/g, '');
  if (!text || /未查|未检|未做|无/.test(text)) return null;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const isFemale = (archive: HealthArchive): boolean =>
  /女|f|female/i.test(asText(archive.gender) || asText(archive.health_record?.profile?.gender));

const riskLabel = (archive: HealthArchive): string => {
  const level = archive.assessment_data?.riskLevel;
  if (level === RiskLevel.RED) return '高风险';
  if (level === RiskLevel.YELLOW) return '中风险';
  if (level === RiskLevel.GREEN) return '低风险';
  return '未评估';
};

const toPerson = (archive: HealthArchive): BoardPerson => ({
  checkupId: archive.checkup_id,
  name: archive.name || archive.health_record?.profile?.name || '未命名',
  department: archive.department || archive.health_record?.profile?.department || '未填部门',
  riskLabel: riskLabel(archive),
  archive,
});

const hasPublishedRisk = (archive: HealthArchive): boolean => {
  const level = archive.assessment_data?.riskLevel;
  return level === RiskLevel.RED || level === RiskLevel.YELLOW || level === RiskLevel.GREEN;
};

const hasPendingFollowUp = (archive: HealthArchive): boolean =>
  (archive.follow_up_schedule || []).some((item) => item.status === 'pending' || item.status === 'overdue');

const currentRecordText = (archive: HealthArchive): string => {
  const checkup = archive.health_record?.checkup;
  const assessment = archive.assessment_data;
  const chunks: string[] = [];
  (checkup?.abnormalities || []).forEach((item) => {
    chunks.push(item.item, item.result, item.clinicalSig);
  });
  (['red', 'yellow', 'green'] as const).forEach((key) => {
    (assessment?.risks?.[key] || []).forEach((item) => chunks.push(item));
  });
  const imaging = checkup?.imagingBasic;
  const optional = checkup?.optional;
  [
    imaging?.ecg,
    imaging?.ultrasound?.thyroid,
    imaging?.ultrasound?.breast,
    imaging?.ultrasound?.abdomen,
    optional?.carotidUltrasound,
    optional?.ct,
    optional?.mammography,
  ].forEach((item) => {
    if (item) chunks.push(item);
  });
  return chunks.join(' ');
};

const examText = (exam: XlmsExamSnapshot): string => {
  const lines = (exam.results || []).map((row) => `${row.name || ''} ${row.result || ''}`);
  const departments = (exam.departments || []).map((row) => row.summary || '');
  return [exam.summary, exam.advice, ...(exam.diagnoses || []), ...departments, ...lines]
    .filter(Boolean)
    .join(' ');
};

const TEXT_RULES: {
  id: string;
  title: string;
  resource: string;
  examined: RegExp;
  positive: (text: string) => boolean;
}[] = [
  {
    id: 'fatty_liver',
    title: '脂肪肝',
    resource: '体重与饮食运动管理',
    examined: /脂肪肝|腹部超声|腹部彩超|肝胆/,
    positive: (text) => /脂肪肝/.test(text) && !/无脂肪肝|未见脂肪肝|未发现脂肪肝|未见明显脂肪肝/.test(text),
  },
  {
    id: 'thyroid_nodule',
    title: '甲状腺结节',
    resource: '阳性结果复查随访',
    examined: /甲状腺/,
    positive: (text) =>
      /甲状腺/.test(text) &&
      /结节|TI-?RADS/i.test(text) &&
      !/未见.{0,6}结节|无结节|未发现.{0,6}结节/.test(text),
  },
  {
    id: 'lung_nodule',
    title: '肺结节',
    resource: '阳性结果复查随访',
    examined: /肺/,
    positive: (text) =>
      /肺/.test(text) &&
      /结节|磨玻璃/.test(text) &&
      !/未见.{0,6}结节|无结节|未发现.{0,6}结节/.test(text),
  },
  {
    id: 'carotid_plaque',
    title: '颈动脉斑块',
    resource: '阳性结果复查随访',
    examined: /颈动脉/,
    positive: (text) => /颈动脉/.test(text) && /斑块/.test(text) && !/未见斑块|无斑块|未发现斑块/.test(text),
  },
  {
    id: 'breast_birads',
    title: '乳腺 BI-RADS 3 类及以上',
    resource: '阳性结果复查随访',
    examined: /乳腺|BI-?RADS/i,
    positive: (text) =>
      /BI-?RADS\s*[3-6]/i.test(text) ||
      /BI-?RADS[^0-9]{0,6}(3|4|5|6)/i.test(text) ||
      /乳腺[^。]{0,12}([3-6]类|4a|4b|4c)/i.test(text),
  },
];

type SnapshotNums = {
  sbp: number | null;
  dbp: number | null;
  glucose: number | null;
  tc: number | null;
  tg: number | null;
  ldl: number | null;
  hdl: number | null;
  ua: number | null;
  bmi: number | null;
};

const snapshotNums = (archive: HealthArchive): SnapshotNums => {
  const checkup = archive.health_record?.checkup;
  const basics = checkup?.basics;
  const labs = checkup?.labBasic;
  return {
    sbp: num(basics?.sbp),
    dbp: num(basics?.dbp),
    glucose: num(labs?.glucose?.fasting),
    tc: num(labs?.lipids?.tc),
    tg: num(labs?.lipids?.tg),
    ldl: num(labs?.lipids?.ldl),
    hdl: num(labs?.lipids?.hdl),
    ua: num(labs?.renal?.ua),
    bmi: num(basics?.bmi),
  };
};

const latestInYear = (rows: YearValue[], year: string): number | null => {
  const hits = rows.filter((row) => row.year === year);
  if (!hits.length) return null;
  hits.sort((a, b) => a.date.localeCompare(b.date));
  return hits[hits.length - 1].value;
};

const indexObservations = (rows: HealthObservationRow[]) => {
  const byPerson = new Map<string, Map<string, YearValue[]>>();
  rows.forEach((row) => {
    const value = num(row.value_numeric);
    const year = yearOf(row.observed_at);
    if (value == null || !year) return;
    const metrics = byPerson.get(row.checkup_id) || new Map<string, YearValue[]>();
    const list = metrics.get(row.metric_code) || [];
    list.push({ year, date: row.observed_at, value });
    metrics.set(row.metric_code, list);
    byPerson.set(row.checkup_id, metrics);
  });
  return byPerson;
};

const metricValue = (
  series: Map<string, YearValue[]> | undefined,
  code: string,
  year: string,
  snapshotYear: string | null,
  snapshotValue: number | null
): { value: number | null; fromSnapshot: boolean } => {
  const observed = latestInYear(series?.get(code) || [], year);
  if (observed != null) return { value: observed, fromSnapshot: false };
  if (year === snapshotYear && snapshotValue != null) return { value: snapshotValue, fromSnapshot: true };
  return { value: null, fromSnapshot: false };
};

const rateOf = (count: number, denominator: number): number | null =>
  denominator > 0 ? count / denominator : null;

const pct = (rate: number | null): string => (rate == null ? '—' : `${(rate * 100).toFixed(1)}%`);

type Hit = { person: BoardPerson; positive: boolean };

const cardFromHits = (id: string, title: string, hits: Hit[], note: string): RateCard => {
  const people = hits.filter((hit) => hit.positive).map((hit) => hit.person);
  return {
    id,
    title,
    count: people.length,
    denominator: hits.length,
    rate: rateOf(people.length, hits.length),
    note,
    people,
  };
};

const deltaVsPrior = (points: YearPoint[]): number | null => {
  if (points.length < 2) return null;
  const prev = points[points.length - 2];
  const last = points[points.length - 1];
  if (!prev.denominator || !last.denominator) return null;
  return (last.rate - prev.rate) * 100;
};

export const buildCampusHealthBoard = (
  archives: HealthArchive[],
  observations: HealthObservationRow[]
): CampusBoardModel => {
  const people = archives.map(toPerson);
  const assessed = people.filter((person) => hasPublishedRisk(person.archive));
  const high = assessed.filter((person) => person.riskLabel === '高风险');
  const mid = assessed.filter((person) => person.riskLabel === '中风险');
  const low = assessed.filter((person) => person.riskLabel === '低风险');
  const critical = people.filter((person) => isCriticalFollowUpPending(person.archive));
  const followUp = people.filter((person) => hasPendingFollowUp(person.archive));

  const obs = indexObservations(observations);
  const snapshotUsed = new Set<string>();

  const yearly = new Map<string, Map<string, Hit[]>>();
  const ensureYear = (id: string, year: string) => {
    const series = yearly.get(id) || new Map<string, Hit[]>();
    const list = series.get(year) || [];
    series.set(year, list);
    yearly.set(id, series);
    return list;
  };

  const currentHits = new Map<string, Hit[]>();
  const pushCurrent = (id: string, hit: Hit) => {
    const list = currentHits.get(id) || [];
    list.push(hit);
    currentHits.set(id, list);
  };

  archives.forEach((archive) => {
    const person = toPerson(archive);
    const series = obs.get(archive.checkup_id);
    const snap = snapshotNums(archive);
    const snapshotYear = yearOf(archive.health_record?.profile?.checkupDate);
    const yearSet = new Set<string>();
    series?.forEach((rows) => rows.forEach((row) => yearSet.add(row.year)));
    if (snapshotYear) yearSet.add(snapshotYear);
    const years = [...yearSet].sort();
    const latestYear = years[years.length - 1] || null;

    const read = (code: string, year: string, snapshotValue: number | null) => {
      const found = metricValue(series, code, year, snapshotYear, snapshotValue);
      if (found.fromSnapshot) snapshotUsed.add(code);
      return found.value;
    };

    years.forEach((year) => {
      const sbp = read('core.sbp', year, snap.sbp);
      const dbp = read('core.dbp', year, snap.dbp);
      if (sbp != null || dbp != null) {
        ensureYear('bp', year).push({
          person,
          positive: (sbp != null && sbp >= 140) || (dbp != null && dbp >= 90),
        });
      }
      const glucose = read('core.fasting_glucose', year, snap.glucose);
      if (glucose != null) {
        ensureYear('ifg', year).push({ person, positive: glucose >= 6.1 && glucose < 7 });
        ensureYear('dm', year).push({ person, positive: glucose >= 7 });
      }
      const tc = read('core.tc', year, snap.tc);
      const tg = read('core.tg', year, snap.tg);
      const ldl = read('core.ldl', year, snap.ldl);
      const hdl = read('core.hdl', year, snap.hdl);
      if (tc != null || tg != null || ldl != null || hdl != null) {
        ensureYear('lipid', year).push({
          person,
          positive:
            (tc != null && tc >= 5.2) ||
            (ldl != null && ldl >= 3.4) ||
            (tg != null && tg >= 1.7) ||
            (hdl != null && hdl < 1),
        });
      }
      const ua = read('core.uric_acid', year, snap.ua);
      if (ua != null) {
        const limit = isFemale(archive) ? 360 : 420;
        ensureYear('ua', year).push({ person, positive: ua >= limit });
      }
      const bmi = read('core.bmi', year, snap.bmi);
      if (bmi != null) {
        ensureYear('overweight', year).push({ person, positive: bmi >= 24 && bmi < 28 });
        ensureYear('obese', year).push({ person, positive: bmi >= 28 });
      }
    });

    if (latestYear) {
      const sbp = read('core.sbp', latestYear, snap.sbp);
      const dbp = read('core.dbp', latestYear, snap.dbp);
      if (sbp != null || dbp != null) {
        pushCurrent('bp', { person, positive: (sbp != null && sbp >= 140) || (dbp != null && dbp >= 90) });
      }
      const glucose = read('core.fasting_glucose', latestYear, snap.glucose);
      if (glucose != null) {
        pushCurrent('ifg', { person, positive: glucose >= 6.1 && glucose < 7 });
        pushCurrent('dm', { person, positive: glucose >= 7 });
      }
      const tc = read('core.tc', latestYear, snap.tc);
      const tg = read('core.tg', latestYear, snap.tg);
      const ldl = read('core.ldl', latestYear, snap.ldl);
      const hdl = read('core.hdl', latestYear, snap.hdl);
      if (tc != null || tg != null || ldl != null || hdl != null) {
        pushCurrent('lipid', {
          person,
          positive:
            (tc != null && tc >= 5.2) ||
            (ldl != null && ldl >= 3.4) ||
            (tg != null && tg >= 1.7) ||
            (hdl != null && hdl < 1),
        });
      }
      const ua = read('core.uric_acid', latestYear, snap.ua);
      if (ua != null) {
        pushCurrent('ua', { person, positive: ua >= (isFemale(archive) ? 360 : 420) });
      }
      const bmi = read('core.bmi', latestYear, snap.bmi);
      if (bmi != null) {
        pushCurrent('overweight', { person, positive: bmi >= 24 && bmi < 28 });
        pushCurrent('obese', { person, positive: bmi >= 28 });
      }
    }

    const exams = archive.health_record?.xlmsExams || [];
    const byYear = new Map<string, string>();
    exams.forEach((exam) => {
      const year = yearOf(exam.examDate);
      if (!year) return;
      byYear.set(year, `${byYear.get(year) || ''} ${examText(exam)}`);
    });
    const recordYear = snapshotYear || latestYear;
    if (recordYear) {
      byYear.set(recordYear, `${byYear.get(recordYear) || ''} ${currentRecordText(archive)}`);
    }

    TEXT_RULES.forEach((rule) => {
      const examinedYears = [...byYear.entries()].filter(([, text]) => rule.examined.test(text));
      if (!examinedYears.length && recordYear) {
        const fallback = currentRecordText(archive);
        if (rule.examined.test(fallback)) {
          examinedYears.push([recordYear, fallback]);
        }
      }
      examinedYears.forEach(([year, text]) => {
        ensureYear(rule.id, year).push({ person, positive: rule.positive(text) });
      });
      const sortedYears = examinedYears.sort((a, b) => a[0].localeCompare(b[0]));
      const newest = sortedYears[sortedYears.length - 1];
      if (newest) {
        pushCurrent(rule.id, { person, positive: rule.positive(newest[1]) });
      }
    });
  });

  const numericNote = (code: string, rule: string) =>
    snapshotUsed.has(code)
      ? `${rule}。最近一年缺少观测时，回退到档案快照中的体检数值。`
      : `${rule}。按检查年份的有效观测计算，没有该项结果的人不进入当年分母。`;

  const numericDefs: { id: string; title: string; note: string; resource: string }[] = [
    { id: 'bp', title: '血压升高', note: numericNote('core.sbp', '收缩压 ≥140 或舒张压 ≥90 mmHg'), resource: '高血压随访' },
    { id: 'ifg', title: '空腹血糖受损', note: numericNote('core.fasting_glucose', '空腹血糖 6.1–6.9 mmol/L'), resource: '糖尿病管理' },
    { id: 'dm', title: '糖尿病范围', note: numericNote('core.fasting_glucose', '空腹血糖 ≥7.0 mmol/L'), resource: '糖尿病管理' },
    {
      id: 'lipid',
      title: '血脂异常',
      note: numericNote('core.tc', '总胆固醇 ≥5.2、低密度 ≥3.4、甘油三酯 ≥1.7 或高密度 <1.0 mmol/L'),
      resource: '血脂管理',
    },
    { id: 'ua', title: '尿酸升高', note: numericNote('core.uric_acid', '男 ≥420、女 ≥360 μmol/L'), resource: '代谢随访' },
    { id: 'overweight', title: '超重', note: numericNote('core.bmi', 'BMI 24–27.9'), resource: '体重与饮食运动管理' },
    { id: 'obese', title: '肥胖', note: numericNote('core.bmi', 'BMI ≥28'), resource: '体重与饮食运动管理' },
  ];

  const cards: RateCard[] = [
    ...numericDefs.map((def) => cardFromHits(def.id, def.title, currentHits.get(def.id) || [], def.note)),
    ...TEXT_RULES.map((rule) => {
      const hits = currentHits.get(rule.id) || [];
      const years = [...(yearly.get(rule.id)?.keys() || [])];
      const onlyCurrent = years.length <= 1;
      const note = onlyCurrent
        ? '仅当前档案。只统计文字中能确认检查过该项的人，每人只计一次。'
        : '按最近一次有该项文字的体检计。没有该项文字的人不进入分母，每人只计一次。';
      return cardFromHits(rule.id, rule.title, hits, note);
    }),
  ];

  const toSeries = (id: string, label: string, note?: string): TrendSeries => {
    const yearMap = yearly.get(id) || new Map<string, Hit[]>();
    const points = [...yearMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, hits]) => {
        const count = hits.filter((hit) => hit.positive).length;
        return { year, count, denominator: hits.length, rate: rateOf(count, hits.length) || 0 };
      });
    return { id, label, points, note };
  };

  const numericTrends = numericDefs.map((def) => toSeries(def.id, def.title));
  const textTrends = TEXT_RULES.map((rule) => {
    const series = toSeries(rule.id, rule.title);
    const onlyCurrent = series.points.length <= 1;
    return { ...series, note: onlyCurrent ? '仅当前档案' : undefined };
  });

  const resourceOf = (id: string) =>
    numericDefs.find((def) => def.id === id)?.resource || TEXT_RULES.find((rule) => rule.id === id)?.resource || '随访管理';

  const ranked = cards
    .map((card) => {
      const points = (yearly.get(card.id) && toSeries(card.id, card.title).points) || [];
      const delta = deltaVsPrior(points);
      const followBoost = card.id === 'bp' ? followUp.length + critical.length : 0;
      const score = (card.rate || 0) * 100 + Math.max(0, delta || 0) * 2 + (followBoost > 0 && card.id === 'bp' ? 8 : 0);
      return { card, delta, score };
    })
    .filter((row) => row.card.denominator > 0)
    .sort((a, b) => b.score - a.score);

  const priorities: PriorityItem[] = [];
  if (critical.length) {
    priorities.push({
      title: '危急值尚未闭环',
      detail: `当前有 ${critical.length} 人危急值未归档。资源方向：优先纳入随访，完成告知、复查和归档。`,
    });
  }
  ranked.forEach((row) => {
    if (priorities.length >= 5) return;
    const sameResource = priorities.some((item) => item.detail.includes(resourceOf(row.card.id)) && item.title.includes(row.card.title));
    if (sameResource) return;
    const change =
      row.delta == null
        ? ''
        : row.delta > 0.5
          ? `较上年上升 ${row.delta.toFixed(1)} 个百分点。`
          : row.delta < -0.5
            ? `较上年下降 ${Math.abs(row.delta).toFixed(1)} 个百分点。`
            : '较上年基本持平。';
    priorities.push({
      title: row.card.title,
      detail: `${row.card.title} ${row.card.count} 人，检出率 ${pct(row.card.rate)}（分母 ${row.card.denominator} 人）。${change}资源方向：${resourceOf(row.card.id)}。`,
    });
  });

  if (followUp.length && priorities.length < 5) {
    priorities.push({
      title: '随访待办',
      detail: `有 ${followUp.length} 人随访尚未完成。资源方向：先消化待办，再扩展新的筛查。`,
    });
  }

  return {
    enrolled: people,
    assessed,
    high,
    mid,
    low,
    critical,
    followUp,
    cards,
    numericTrends,
    textTrends,
    priorities: priorities.slice(0, 5),
  };
};

export const loadCampusHealthBoard = async (archives: HealthArchive[]): Promise<CampusBoardModel> => {
  const observations = await fetchBoardObservations(
    archives.map((archive) => archive.checkup_id),
    [...BOARD_METRIC_CODES]
  );
  return buildCampusHealthBoard(archives, observations);
};

export const listDepartments = (archives: HealthArchive[]): string[] => {
  const names = new Set<string>();
  archives.forEach((archive) => {
    const name = asText(archive.department) || asText(archive.health_record?.profile?.department);
    if (name) names.add(name);
  });
  return [...names].sort((a, b) => a.localeCompare(b, 'zh'));
};

export { pct };
