/** 趋势图 Y 轴等距刻度与临床参考范围（各指标统一，不随个人数据漂移） */

export interface ChartReferenceLine {
  value: number;
  label: string;
  color?: string;
}

export interface ChartAxisConfig {
  domain: [number, number];
  ticks: number[];
  /** Y 轴刻度显示小数位数 */
  tickDecimals: number;
  referenceLines: ChartReferenceLine[];
}

const range = (min: number, max: number, step: number): number[] => {
  const ticks: number[] = [];
  for (let v = min; v <= max + step * 0.001; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }
  return ticks;
};

/** 在固定步长网格上扩展 domain，使数据点与参考线均可见 */
export const snapDomainToStep = (
  values: number[],
  refValues: number[],
  step: number,
  opts: { minFloor?: number; maxCeil?: number; padSteps?: number } = {}
): [number, number] => {
  const pad = opts.padSteps ?? 1;
  const all = [...values, ...refValues].filter((v) => Number.isFinite(v));
  if (!all.length) {
    const lo = opts.minFloor ?? 0;
    const hi = opts.maxCeil ?? lo + step * 5;
    return [lo, hi];
  }
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  lo = Math.floor((lo - pad * step) / step) * step;
  hi = Math.ceil((hi + pad * step) / step) * step;
  if (opts.minFloor != null) lo = Math.max(opts.minFloor, lo);
  if (opts.maxCeil != null) hi = Math.min(opts.maxCeil, hi);
  if (lo >= hi) hi = lo + step * 4;
  return [lo, hi];
};

export const formatChartTick = (value: number, decimals: number): string => {
  if (decimals <= 0) return String(Math.round(value));
  return value.toFixed(decimals).replace(/\.?0+$/, '');
};

const METRIC_AXIS: Record<
  string,
  Omit<ChartAxisConfig, 'domain' | 'ticks'> & {
    step: number;
    minFloor?: number;
    maxCeil?: number;
    padSteps?: number;
  }
> = {
  'core.fasting_glucose': {
    step: 1,
    minFloor: 0,
    maxCeil: 16,
    tickDecimals: 0,
    referenceLines: [
      { value: 6.1, label: '上限 6.1', color: '#f59e0b' },
      { value: 7.0, label: '诊断 7.0', color: '#ef4444' },
    ],
  },
  'core.postprandial_glucose': {
    step: 1,
    minFloor: 0,
    maxCeil: 20,
    tickDecimals: 0,
    referenceLines: [
      { value: 7.8, label: '上限 7.8', color: '#f59e0b' },
      { value: 11.1, label: '诊断 11.1', color: '#ef4444' },
    ],
  },
  'core.hba1c': {
    step: 0.5,
    minFloor: 4,
    maxCeil: 12,
    tickDecimals: 1,
    referenceLines: [
      { value: 6.0, label: '上限 6.0%', color: '#f59e0b' },
      { value: 7.0, label: '控制 7.0%', color: '#ef4444' },
    ],
  },
  'core.sbp': {
    step: 20,
    minFloor: 80,
    maxCeil: 200,
    tickDecimals: 0,
    referenceLines: [
      { value: 120, label: '正常 120', color: '#22c55e' },
      { value: 140, label: '高压 140', color: '#ef4444' },
    ],
  },
  'core.dbp': {
    step: 10,
    minFloor: 50,
    maxCeil: 120,
    tickDecimals: 0,
    referenceLines: [
      { value: 80, label: '正常 80', color: '#22c55e' },
      { value: 90, label: '高压 90', color: '#ef4444' },
    ],
  },
  'core.weight': {
    step: 5,
    minFloor: 40,
    maxCeil: 120,
    tickDecimals: 0,
    referenceLines: [],
  },
  'core.tc': {
    step: 0.5,
    minFloor: 0,
    maxCeil: 10,
    tickDecimals: 1,
    referenceLines: [{ value: 5.2, label: '上限 5.2', color: '#f59e0b' }],
  },
  'core.tg': {
    step: 0.5,
    minFloor: 0,
    maxCeil: 6,
    tickDecimals: 1,
    referenceLines: [{ value: 1.7, label: '上限 1.7', color: '#f59e0b' }],
  },
  'core.ldl': {
    step: 0.5,
    minFloor: 0,
    maxCeil: 6,
    tickDecimals: 1,
    referenceLines: [
      { value: 2.6, label: '理想 2.6', color: '#22c55e' },
      { value: 3.4, label: '上限 3.4', color: '#f59e0b' },
    ],
  },
  'core.hdl': {
    step: 0.2,
    minFloor: 0,
    maxCeil: 2.5,
    tickDecimals: 1,
    referenceLines: [{ value: 1.0, label: '偏低 1.0', color: '#f59e0b' }],
  },
  'core.waist': {
    step: 5,
    minFloor: 60,
    maxCeil: 120,
    tickDecimals: 0,
    referenceLines: [
      { value: 85, label: '女限 85', color: '#f59e0b' },
      { value: 90, label: '男限 90', color: '#ef4444' },
    ],
  },
  'core.body_fat_rate': {
    step: 5,
    minFloor: 0,
    maxCeil: 45,
    tickDecimals: 0,
    referenceLines: [
      { value: 20, label: '男上限 20%', color: '#f59e0b' },
      { value: 28, label: '女上限 28%', color: '#f97316' },
    ],
  },
  'core.creatinine': {
    step: 20,
    minFloor: 40,
    maxCeil: 200,
    tickDecimals: 0,
    referenceLines: [
      { value: 97, label: '男上限 97', color: '#f59e0b' },
      { value: 81, label: '女上限 81', color: '#f97316' },
    ],
  },
  'core.abi': {
    step: 0.1,
    minFloor: 0.7,
    maxCeil: 1.4,
    tickDecimals: 1,
    referenceLines: [
      { value: 0.9, label: '下限 0.9', color: '#ef4444' },
      { value: 1.3, label: '上限 1.3', color: '#f59e0b' },
    ],
  },
  'core.ba_pwv': {
    step: 200,
    minFloor: 800,
    maxCeil: 2400,
    tickDecimals: 0,
    referenceLines: [{ value: 1400, label: '上限 1400', color: '#ef4444' }],
  },
  'core.homocysteine': {
    step: 2,
    minFloor: 0,
    maxCeil: 30,
    tickDecimals: 0,
    referenceLines: [{ value: 15, label: '上限 15', color: '#f59e0b' }],
  },
  'core.wbc': {
    step: 1,
    minFloor: 0,
    maxCeil: 15,
    tickDecimals: 0,
    referenceLines: [
      { value: 3.5, label: '下限 3.5', color: '#f59e0b' },
      { value: 9.5, label: '上限 9.5', color: '#f59e0b' },
    ],
  },
  'core.hgb': {
    step: 20,
    minFloor: 80,
    maxCeil: 200,
    tickDecimals: 0,
    referenceLines: [
      { value: 115, label: '女下限 115', color: '#f59e0b' },
      { value: 130, label: '男下限 130', color: '#f97316' },
    ],
  },
  'core.plt': {
    step: 50,
    minFloor: 0,
    maxCeil: 400,
    tickDecimals: 0,
    referenceLines: [
      { value: 125, label: '下限 125', color: '#f59e0b' },
      { value: 350, label: '上限 350', color: '#f59e0b' },
    ],
  },
  'core.visceral_fat_level': {
    step: 2,
    minFloor: 0,
    maxCeil: 20,
    tickDecimals: 0,
    referenceLines: [{ value: 10, label: '偏高 10', color: '#ef4444' }],
  },
  'core.inbody_score': {
    step: 10,
    minFloor: 0,
    maxCeil: 100,
    tickDecimals: 0,
    referenceLines: [{ value: 70, label: '良好 70', color: '#22c55e' }],
  },
};

const DEFAULT_AXIS = {
  step: 1,
  tickDecimals: 0,
  referenceLines: [] as ChartReferenceLine[],
  padSteps: 1,
};

/** 血压双线图：统一 Y 轴 60–200，步长 20 */
export const buildBpAxisConfig = (
  sbpValues: number[],
  dbpValues: number[]
): ChartAxisConfig => {
  const step = 20;
  const refValues = [120, 140, 80, 90];
  const domain = snapDomainToStep(
    [...sbpValues, ...dbpValues],
    refValues,
    step,
    { minFloor: 60, maxCeil: 200, padSteps: 0 }
  );
  return {
    domain,
    ticks: range(domain[0], domain[1], step),
    tickDecimals: 0,
    referenceLines: [
      { value: 120, label: 'SBP 120', color: '#22c55e' },
      { value: 140, label: 'SBP 140', color: '#ef4444' },
      { value: 80, label: 'DBP 80', color: '#86efac' },
      { value: 90, label: 'DBP 90', color: '#f97316' },
    ],
  };
};

export const buildMetricAxisConfig = (
  metricCode: string,
  values: (number | null | undefined)[]
): ChartAxisConfig => {
  const spec = METRIC_AXIS[metricCode] || DEFAULT_AXIS;
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  const refValues = spec.referenceLines.map((r) => r.value);
  const domain = snapDomainToStep(nums, refValues, spec.step, {
    minFloor: spec.minFloor,
    maxCeil: spec.maxCeil,
    padSteps: spec.padSteps ?? 1,
  });
  return {
    domain,
    ticks: range(domain[0], domain[1], spec.step),
    tickDecimals: spec.tickDecimals,
    referenceLines: spec.referenceLines,
  };
};
