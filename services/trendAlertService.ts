export interface TrendPoint {
  metric_code: string;
  value_numeric: number | null;
  observed_at: string;
}

export interface TrendAlert {
  code: string;
  label: string;
  previousDate: string;
  latestDate: string;
  previous: number;
  latest: number;
  unit: string;
  text: string;
}

interface TrendRule {
  code: string;
  label: string;
  unit: string;
  worse: 'up' | 'down';
  minDelta: number;
  digits: number;
}

/** 最近两次有效观测的变化达到这个幅度，才在档案里提醒。 */
export const TREND_RULES: TrendRule[] = [
  { code: 'core.sbp', label: '收缩压', unit: 'mmHg', worse: 'up', minDelta: 10, digits: 0 },
  { code: 'core.dbp', label: '舒张压', unit: 'mmHg', worse: 'up', minDelta: 6, digits: 0 },
  { code: 'core.weight', label: '体重', unit: 'kg', worse: 'up', minDelta: 3, digits: 1 },
  { code: 'core.bmi', label: 'BMI', unit: '', worse: 'up', minDelta: 1, digits: 1 },
  { code: 'core.fasting_glucose', label: '空腹血糖', unit: 'mmol/L', worse: 'up', minDelta: 0.6, digits: 2 },
  { code: 'core.hba1c', label: '糖化血红蛋白', unit: '%', worse: 'up', minDelta: 0.4, digits: 2 },
  { code: 'core.tc', label: '总胆固醇', unit: 'mmol/L', worse: 'up', minDelta: 0.5, digits: 2 },
  { code: 'core.tg', label: '甘油三酯', unit: 'mmol/L', worse: 'up', minDelta: 0.4, digits: 2 },
  { code: 'core.ldl', label: '低密度脂蛋白', unit: 'mmol/L', worse: 'up', minDelta: 0.4, digits: 2 },
  { code: 'core.hdl', label: '高密度脂蛋白', unit: 'mmol/L', worse: 'down', minDelta: 0.15, digits: 2 },
];

export const TREND_METRIC_CODES = TREND_RULES.map((rule) => rule.code);

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const formatDay = (day: string) => {
  const match = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return day;
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
};

const withUnit = (value: number, unit: string) => (unit ? `${value} ${unit}` : String(value));

export const buildTrendAlerts = (rows: TrendPoint[]): TrendAlert[] => {
  const alerts: TrendAlert[] = [];
  for (const rule of TREND_RULES) {
    const byDate = new Map<string, number>();
    for (const row of rows) {
      if (row.metric_code !== rule.code || row.value_numeric == null) continue;
      const day = row.observed_at.slice(0, 10);
      const value = Number(row.value_numeric);
      if (!day || !Number.isFinite(value)) continue;
      byDate.set(day, value);
    }
    const dates = [...byDate.keys()].sort();
    if (dates.length < 2) continue;
    const previousDate = dates[dates.length - 2];
    const latestDate = dates[dates.length - 1];
    const previous = byDate.get(previousDate) as number;
    const latest = byDate.get(latestDate) as number;
    const delta = latest - previous;
    const worsened = rule.worse === 'up' ? delta >= rule.minDelta : -delta >= rule.minDelta;
    if (!worsened) continue;
    const shownPrevious = round(previous, rule.digits);
    const shownLatest = round(latest, rule.digits);
    const shownDelta = round(Math.abs(delta), rule.digits);
    const verb = rule.worse === 'up' ? '升高' : '下降';
    alerts.push({
      code: rule.code,
      label: rule.label,
      previousDate,
      latestDate,
      previous: shownPrevious,
      latest: shownLatest,
      unit: rule.unit,
      text: `${rule.label}较 ${formatDay(previousDate)} 的 ${withUnit(shownPrevious, rule.unit)} ${verb} ${withUnit(shownDelta, rule.unit)}，最近一次 ${formatDay(latestDate)} 为 ${withUnit(shownLatest, rule.unit)}。`,
    });
  }
  return alerts;
};
