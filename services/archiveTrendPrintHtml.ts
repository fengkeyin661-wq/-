/**
 * 健康档案打印稿中的核心指标趋势（静态 SVG，不依赖页面上的图表组件）
 */
import {
  buildBpAxisConfig,
  buildMetricAxisConfig,
  formatChartTick,
  formatObservedValue,
  snapDomainToStep,
} from './chartAxisConfig';
import { ALL_METRICS } from './metricCatalog';
import {
  buildBpChartData,
  buildContinuousChartSeries,
  fetchObservationSeries,
  formatObservationChartLabel,
} from './observationService';

const PRINT_CODES = [
  'core.sbp',
  'core.dbp',
  'core.weight',
  'core.tc',
  'core.tg',
  'core.ldl',
  'core.hdl',
  'core.fasting_glucose',
  'core.uric_acid',
];

const PRINT_CODE_SET = new Set(PRINT_CODES);

/** 打印稿默认带上的趋势，不出现在可勾选列表里 */
export const DEFAULT_ARCHIVE_TREND_LABELS = ['血压', '体重', '血脂', '空腹血糖', '尿酸'] as const;

export const optionalArchivePrintMetrics = (): { code: string; label: string; unit: string }[] =>
  ALL_METRICS.filter((metric) => !PRINT_CODE_SET.has(metric.code)).map((metric) => ({
    code: metric.code,
    label: metric.label,
    unit: metric.unit,
  }));

export const ARCHIVE_TREND_PRINT_CSS = `
.trend-note { font-size: 12px; color: #6b7280; margin: 0 0 12px; }
.trend-card { break-inside: avoid; margin-bottom: 18px; }
.trend-card h3 { font-size: 14px; margin: 0 0 6px; color: #111827; }
.trend-legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 11px; color: #4b5563; margin: 0 0 4px; }
.trend-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
.trend-table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 6px 0 0; }
.trend-table th, .trend-table td { border: 1px solid #e5e7eb; padding: 4px 6px; text-align: left; }
.trend-table th { background: #f9fafb; font-weight: bold; }
`;

const EXTRA_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#2563eb', '#7c3aed', '#0f766e', '#dc2626', '#0891b2'];

const KNOWN_COLORS: Record<string, string> = {
  'core.hba1c': '#dc2626',
  'core.abi': '#2563eb',
  'core.ba_pwv': '#7c3aed',
  'core.waist': '#6366f1',
  'core.body_fat_rate': '#ec4899',
  'core.creatinine': '#14b8a6',
  'core.urea': '#0f766e',
  'core.plt': '#0891b2',
};

const LIPID_SERIES = [
  { code: 'core.tc', name: '总胆固醇', color: '#0d9488' },
  { code: 'core.tg', name: '甘油三酯', color: '#f59e0b' },
  { code: 'core.ldl', name: '低密度脂蛋白', color: '#ef4444' },
  { code: 'core.hdl', name: '高密度脂蛋白', color: '#3b82f6' },
] as const;

interface LineSeries {
  name: string;
  color: string;
  values: (number | null)[];
}

interface DatedPoint {
  date: string;
  value: number | null;
}

const esc = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const hasNumber = (values: (number | null | undefined)[]): boolean =>
  values.some((v) => v != null && Number.isFinite(v));

const axisDate = (iso: string): string => {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  return `${match[1].slice(2)}/${Number(match[2])}/${Number(match[3])}`;
};

const fullDate = (iso: string): string => formatObservationChartLabel(`${iso}T12:00:00`);

const ticksBetween = (lo: number, hi: number, step: number): number[] => {
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step * 0.001; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }
  return ticks;
};

const renderSvgChart = (opts: {
  dates: string[];
  series: LineSeries[];
  domain: [number, number];
  ticks: number[];
  tickDecimals: number;
  referenceLines: { value: number; label: string; color?: string }[];
}): string => {
  const { dates, series, domain, ticks, tickDecimals, referenceLines } = opts;
  const width = 680;
  const height = 188;
  const left = 46;
  const top = 16;
  const right = 12;
  const bottom = 28;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const [yMin, yMax] = domain;
  const yOf = (value: number): number => {
    if (yMax === yMin) return top + innerH / 2;
    return top + ((yMax - value) / (yMax - yMin)) * innerH;
  };
  const xOf = (index: number): number => {
    if (dates.length <= 1) return left + innerW / 2;
    return left + (index / (dates.length - 1)) * innerW;
  };
  const showTick = (index: number): boolean => {
    if (dates.length <= 8) return true;
    const step = Math.ceil(dates.length / 8);
    return index % step === 0 || index === dates.length - 1;
  };
  const yTicks = ticks.length <= 8
    ? ticks
    : ticks.filter((tick, index) => {
        const step = Math.ceil(ticks.length / 8);
        return index % step === 0 || tick === ticks[ticks.length - 1];
      });

  const grid = yTicks
    .map((tick) => {
      const y = yOf(tick);
      return `<line x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1"/>
        <text x="${left - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#64748b">${esc(formatChartTick(tick, tickDecimals))}</text>`;
    })
    .join('');

  const refs = referenceLines
    .filter((ref) => ref.value >= yMin && ref.value <= yMax)
    .map((ref) => {
      const y = yOf(ref.value);
      const color = ref.color || '#94a3b8';
      return `<line x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}" stroke="${color}" stroke-dasharray="4 4" stroke-width="1"/>
        <text x="${width - right - 2}" y="${(y - 2).toFixed(1)}" text-anchor="end" font-size="9" fill="${color}">${esc(ref.label)}</text>`;
    })
    .join('');

  const lines = series
    .map((item, seriesIndex) => {
      const pts = item.values
        .map((value, index) => (value == null || !Number.isFinite(value) ? null : { index, value }))
        .filter((p): p is { index: number; value: number } => p != null);
      if (!pts.length) return '';
      const poly = pts
        .map((p) => `${xOf(p.index).toFixed(1)},${yOf(p.value).toFixed(1)}`)
        .join(' ');
      const dots = pts
        .map((p) => {
          const x = xOf(p.index);
          const y = yOf(p.value);
          const showValue = dates.length <= 6 && series.length <= 2;
          const dy = series.length === 1 || seriesIndex === 0 ? -7 : 12;
          const valueLabel = showValue
            ? `<text x="${x.toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="middle" font-size="9" fill="${item.color}">${esc(formatObservedValue(p.value))}</text>`
            : '';
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${item.color}"/>${valueLabel}`;
        })
        .join('');
      return `<polyline fill="none" stroke="${item.color}" stroke-width="2" points="${poly}"/>${dots}`;
    })
    .join('');

  const xLabels = dates
    .map((date, index) => {
      if (!showTick(index)) return '';
      const x = xOf(index);
      const anchor = index === 0 ? 'start' : index === dates.length - 1 ? 'end' : 'middle';
      return `<text x="${x.toFixed(1)}" y="${height - 6}" text-anchor="${anchor}" font-size="9" fill="#64748b">${esc(axisDate(date))}</text>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img">
    ${grid}
    ${refs}
    ${lines}
    ${xLabels}
  </svg>`;
};

const legendHtml = (series: LineSeries[]): string =>
  `<div class="trend-legend">${series
    .map(
      (item) =>
        `<span><i style="background:${item.color}"></i>${esc(item.name)}</span>`
    )
    .join('')}</div>`;

const tableHtml = (dates: string[], series: LineSeries[]): string => {
  const head = series.map((item) => `<th>${esc(item.name)}</th>`).join('');
  const body = dates
    .map((date, index) => {
      const cells = series
        .map((item) => {
          const value = item.values[index];
          return `<td>${value == null || !Number.isFinite(value) ? '—' : esc(formatObservedValue(value))}</td>`;
        })
        .join('');
      return `<tr><td>${esc(fullDate(date))}</td>${cells}</tr>`;
    })
    .join('');
  return `<table class="trend-table"><thead><tr><th>日期</th>${head}</tr></thead><tbody>${body}</tbody></table>`;
};

const chartCard = (opts: {
  title: string;
  dates: string[];
  series: LineSeries[];
  domain: [number, number];
  ticks: number[];
  tickDecimals: number;
  referenceLines: { value: number; label: string; color?: string }[];
}): string => {
  if (!opts.dates.length || !opts.series.some((item) => hasNumber(item.values))) return '';
  return `<div class="trend-card">
    <h3>${esc(opts.title)}</h3>
    ${legendHtml(opts.series)}
    ${renderSvgChart(opts)}
    ${tableHtml(opts.dates, opts.series)}
  </div>`;
};

const pointsOf = (
  rows: Parameters<typeof buildContinuousChartSeries>[0],
  code: string
): DatedPoint[] =>
  buildContinuousChartSeries(rows, code).map((point) => ({
    date: point.date,
    value: point.value,
  }));

const singleMetricCard = (
  rows: Parameters<typeof buildContinuousChartSeries>[0],
  code: string,
  color: string
): string => {
  const def = ALL_METRICS.find((metric) => metric.code === code);
  if (!def) return '';
  const points = pointsOf(rows, code);
  const axis = buildMetricAxisConfig(
    code,
    points.map((point) => point.value)
  );
  const unit = def.unit ? `（${def.unit}）` : '';
  return chartCard({
    title: `${def.label}趋势${unit}`,
    dates: points.map((point) => point.date),
    series: [{ name: def.label, color, values: points.map((point) => point.value) }],
    domain: axis.domain,
    ticks: axis.ticks,
    tickDecimals: axis.tickDecimals,
    referenceLines: axis.referenceLines,
  });
};

export const buildArchiveTrendPrintHtml = async (
  checkupId: string,
  extraMetricCodes: string[] = []
): Promise<string> => {
  if (!checkupId) return '';
  const extras = [...new Set(extraMetricCodes)].filter(
    (code) => !PRINT_CODE_SET.has(code) && ALL_METRICS.some((metric) => metric.code === code)
  );
  const rows = await fetchObservationSeries(checkupId, [...PRINT_CODES, ...extras], 800);
  if (!rows.length) return '';

  const weight = pointsOf(rows, 'core.weight');
  const glucose = pointsOf(rows, 'core.fasting_glucose');
  const uric = pointsOf(rows, 'core.uric_acid');
  const lipids = LIPID_SERIES.map((item) => ({
    name: item.name,
    color: item.color,
    points: pointsOf(rows, item.code),
  }));
  const lipidDates = [...new Set(lipids.flatMap((item) => item.points.map((point) => point.date)))].sort();
  const lipidSeries: LineSeries[] = lipids.map((item) => {
    const byDate = new Map(item.points.map((point) => [point.date, point.value]));
    return {
      name: item.name,
      color: item.color,
      values: lipidDates.map((date) => byDate.get(date) ?? null),
    };
  });
  const lipidValues = lipidSeries.flatMap((item) => item.values).filter((v): v is number => v != null && Number.isFinite(v));
  const lipidDomain = snapDomainToStep(lipidValues, [], 0.5, { minFloor: 0, padSteps: 1 });

  const bp = buildBpChartData(rows).filter((point) => point.sbp != null || point.dbp != null);
  const bpAxis = buildBpAxisConfig(
    bp.map((point) => point.sbp).filter((v): v is number => v != null),
    bp.map((point) => point.dbp).filter((v): v is number => v != null)
  );
  const weightAxis = buildMetricAxisConfig(
    'core.weight',
    weight.map((point) => point.value)
  );
  const glucoseAxis = buildMetricAxisConfig(
    'core.fasting_glucose',
    glucose.map((point) => point.value)
  );
  const uricAxis = buildMetricAxisConfig(
    'core.uric_acid',
    uric.map((point) => point.value)
  );

  const cards = [
    chartCard({
      title: '血压趋势（mmHg）',
      dates: bp.map((point) => point.date),
      series: [
        { name: '收缩压', color: '#ef4444', values: bp.map((point) => point.sbp ?? null) },
        { name: '舒张压', color: '#f97316', values: bp.map((point) => point.dbp ?? null) },
      ],
      domain: bpAxis.domain,
      ticks: bpAxis.ticks,
      tickDecimals: bpAxis.tickDecimals,
      referenceLines: bpAxis.referenceLines,
    }),
    chartCard({
      title: '体重趋势（kg）',
      dates: weight.map((point) => point.date),
      series: [{ name: '体重', color: '#0d9488', values: weight.map((point) => point.value) }],
      domain: weightAxis.domain,
      ticks: weightAxis.ticks,
      tickDecimals: weightAxis.tickDecimals,
      referenceLines: weightAxis.referenceLines,
    }),
    chartCard({
      title: '血脂趋势（mmol/L）',
      dates: lipidDates,
      series: lipidSeries,
      domain: lipidDomain,
      ticks: ticksBetween(lipidDomain[0], lipidDomain[1], 0.5),
      tickDecimals: 1,
      referenceLines: [],
    }),
    chartCard({
      title: '空腹血糖趋势（mmol/L）',
      dates: glucose.map((point) => point.date),
      series: [{ name: '空腹血糖', color: '#8b5cf6', values: glucose.map((point) => point.value) }],
      domain: glucoseAxis.domain,
      ticks: glucoseAxis.ticks,
      tickDecimals: glucoseAxis.tickDecimals,
      referenceLines: glucoseAxis.referenceLines,
    }),
    chartCard({
      title: '尿酸趋势（μmol/L）',
      dates: uric.map((point) => point.date),
      series: [{ name: '尿酸', color: '#b45309', values: uric.map((point) => point.value) }],
      domain: uricAxis.domain,
      ticks: uricAxis.ticks,
      tickDecimals: uricAxis.tickDecimals,
      referenceLines: uricAxis.referenceLines,
    }),
    ...extras.map((code, index) =>
      singleMetricCard(rows, code, KNOWN_COLORS[code] || EXTRA_COLORS[index % EXTRA_COLORS.length])
    ),
  ].filter(Boolean);

  if (!cards.length) return '';

  const extraLabels = extras
    .map((code) => ALL_METRICS.find((metric) => metric.code === code)?.label)
    .filter((label): label is string => Boolean(label));
  const note = extraLabels.length
    ? `默认包含血压、体重、血脂、空腹血糖、尿酸，并附带${extraLabels.join('、')}。横轴为观测日期。`
    : '血压、体重、血脂、空腹血糖、尿酸。横轴为观测日期，便于对照历次结果。';

  return `<div class="section">
    <div class="section-title">近年核心指标变化趋势</div>
    <p class="trend-note">${esc(note)}</p>
    ${cards.join('')}
  </div>`;
};
