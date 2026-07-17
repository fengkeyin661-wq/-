import React, { useEffect, useMemo, useState } from 'react';
import { ALL_METRICS, CORE_METRICS } from '../services/metricCatalog';
import {
  fetchObservationSeries,
  buildBpChartData,
  buildContinuousChartSeries,
} from '../services/observationService';
import { BpTrendChart, MetricTrendChart } from './MetricTrendChart';

interface Props {
  checkupId: string;
  variant?: 'bp' | 'weight' | 'glucose' | 'tc' | 'tg' | 'ldl' | 'hdl' | 'lipids' | 'all' | 'dashboard' | 'admin';
  className?: string;
}

const DEFAULT_CODES = ['core.sbp', 'core.dbp', 'core.weight', 'core.fasting_glucose'];
const USER_PRIMARY_CHART_CODES = ['core.hba1c', 'core.abi', 'core.ba_pwv'] as const;
const USER_DASHBOARD_FETCH_CODES = [
  ...DEFAULT_CODES,
  ...USER_PRIMARY_CHART_CODES,
  'core.tc',
  'core.tg',
  'core.ldl',
  'core.hdl',
  'core.waist',
  'core.body_fat_rate',
  'core.creatinine',
  'core.homocysteine',
  'core.wbc',
  'core.hgb',
  'core.plt',
  'core.visceral_fat_level',
  'core.skeletal_muscle_mass',
  'core.waist_hip_ratio',
  'core.inbody_score',
];
const LIPID_CODES = ['core.tc', 'core.tg', 'core.ldl', 'core.hdl'] as const;

const DASHBOARD_EXCLUDED_OPTIONAL = new Set([
  'core.sbp',
  'core.dbp',
  'core.weight',
  'core.fasting_glucose',
  'core.bmi',
  ...USER_PRIMARY_CHART_CODES,
]);

const OPTIONAL_METRICS = ALL_METRICS.filter((m) => !DASHBOARD_EXCLUDED_OPTIONAL.has(m.code));

const ADMIN_OPTIONAL_METRICS = OPTIONAL_METRICS.filter(
  (m) => !LIPID_CODES.includes(m.code as (typeof LIPID_CODES)[number])
);

const UI = {
  loading: '加载趋势数据…',
  empty: '暂无历史观测，更新指标后将自动生成趋势',
  bp: '血压趋势',
  weight: '体重趋势',
  glucose: '空腹血糖趋势',
  hba1c: '糖化血红蛋白趋势',
  abi: 'ABI趋势',
  pwv: 'PWV趋势',
  lipidSection: '血脂指标（分项展示，含高密度脂蛋白）',
  moreAdmin: '查看更多指标趋势',
  moreUser: '查看更多定量指标趋势',
  phAdmin: '请选择指标（腰围、体脂率、肾功能等）',
  phUser: '请选择指标（血脂、腰围、肾功能等）',
  optLoading: '加载指标趋势…',
  optEmpty: '该指标暂无历史数据',
  trend: '趋势',
  renal: '趋势（肾功能）',
} as const;

const metricLabel = (code: string): string =>
  ALL_METRICS.find((m) => m.code === code)?.label ?? code;

const metricUnit = (code: string): string =>
  ALL_METRICS.find((m) => m.code === code)?.unit ?? '';

const hasSeriesData = (data: { value: number | null }[]) => data.some((p) => p.value != null);

const CHART_COLORS: Record<string, string> = {
  'core.tc': '#0d9488',
  'core.tg': '#f59e0b',
  'core.ldl': '#ef4444',
  'core.hdl': '#3b82f6',
  'core.waist': '#6366f1',
  'core.body_fat_rate': '#ec4899',
  'core.creatinine': '#14b8a6',
  'core.hba1c': '#dc2626',
  'core.abi': '#2563eb',
  'core.ba_pwv': '#7c3aed',
  'core.fasting_glucose': '#8b5cf6',
  'core.weight': '#0d9488',
};

const LIPID_VARIANTS = ['tc', 'tg', 'ldl', 'hdl'] as const;
const LIPID_META: Record<(typeof LIPID_VARIANTS)[number], { code: string; color: string }> = {
  tc: { code: 'core.tc', color: '#0d9488' },
  tg: { code: 'core.tg', color: '#f59e0b' },
  ldl: { code: 'core.ldl', color: '#ef4444' },
  hdl: { code: 'core.hdl', color: '#3b82f6' },
};

export const HealthTrendCharts: React.FC<Props> = ({
  checkupId,
  variant = 'bp',
  className = '',
}) => {
  const isUserDashboard = variant === 'dashboard';
  const isAdminDashboard = variant === 'admin';
  const isCompactDashboard = isUserDashboard || isAdminDashboard;
  const [bpData, setBpData] = useState<{ date: string; label: string; sbp?: number; dbp?: number }[]>([]);
  const [weightData, setWeightData] = useState<{ label: string; value: number | null }[]>([]);
  const [glucoseData, setGlucoseData] = useState<{ label: string; value: number | null }[]>([]);
  const [hba1cData, setHba1cData] = useState<{ label: string; value: number | null }[]>([]);
  const [abiData, setAbiData] = useState<{ label: string; value: number | null }[]>([]);
  const [pwvData, setPwvData] = useState<{ label: string; value: number | null }[]>([]);
  const [lipidData, setLipidData] = useState<
    Record<(typeof LIPID_VARIANTS)[number], { label: string; value: number | null }[]>
  >({ tc: [], tg: [], ldl: [], hdl: [] });
  const [waistData, setWaistData] = useState<{ label: string; value: number | null }[]>([]);
  const [bodyFatData, setBodyFatData] = useState<{ label: string; value: number | null }[]>([]);
  const [creatinineData, setCreatinineData] = useState<{ label: string; value: number | null }[]>([]);
  const [optionalSeries, setOptionalSeries] = useState<{ label: string; value: number | null }[]>([]);
  const [optionalLoading, setOptionalLoading] = useState(false);
  const [selectedOptional, setSelectedOptional] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!checkupId) return;
      setLoading(true);
      const codes = isUserDashboard
        ? USER_DASHBOARD_FETCH_CODES
        : isAdminDashboard
          ? [...DEFAULT_CODES, ...LIPID_CODES, ...USER_PRIMARY_CHART_CODES]
          : [
              'core.sbp',
              'core.dbp',
              'core.weight',
              'core.fasting_glucose',
              'core.tc',
              'core.tg',
              'core.ldl',
              'core.hdl',
              'core.waist',
              'core.body_fat_rate',
              'core.creatinine',
              'core.hba1c',
              'core.abi',
              'core.ba_pwv',
            ];
      const rows = await fetchObservationSeries(checkupId, codes, 200);
      if (cancelled) return;
      setBpData(buildBpChartData(rows));
      const toSeries = (code: string) =>
        buildContinuousChartSeries(rows, code).map((p) => ({ label: p.label, value: p.value }));

      setWeightData(toSeries('core.weight'));
      setGlucoseData(toSeries('core.fasting_glucose'));
      if (isCompactDashboard) {
        setHba1cData(toSeries('core.hba1c'));
        setAbiData(toSeries('core.abi'));
        setPwvData(toSeries('core.ba_pwv'));
      }
      if (isAdminDashboard || !isCompactDashboard) {
        setLipidData({
          tc: toSeries('core.tc'),
          tg: toSeries('core.tg'),
          ldl: toSeries('core.ldl'),
          hdl: toSeries('core.hdl'),
        });
      }
      if (!isCompactDashboard) {
        setWaistData(toSeries('core.waist'));
        setBodyFatData(toSeries('core.body_fat_rate'));
        setCreatinineData(toSeries('core.creatinine'));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [checkupId, isUserDashboard, isAdminDashboard, isCompactDashboard]);

  useEffect(() => {
    if (!isCompactDashboard || !selectedOptional || !checkupId) {
      setOptionalSeries([]);
      return;
    }
    let cancelled = false;
    setOptionalLoading(true);
    (async () => {
      const rows = await fetchObservationSeries(
        checkupId,
        [...new Set([...USER_DASHBOARD_FETCH_CODES, ...LIPID_CODES, selectedOptional])],
        200
      );
      if (cancelled) return;
      setOptionalSeries(
        buildContinuousChartSeries(rows, selectedOptional).map((p) => ({
          label: p.label,
          value: p.value,
        }))
      );
      setOptionalLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [checkupId, isCompactDashboard, selectedOptional]);

  const optionalMetricList = isAdminDashboard ? ADMIN_OPTIONAL_METRICS : OPTIONAL_METRICS;

  const optionalMeta = useMemo(
    () => optionalMetricList.find((m) => m.code === selectedOptional),
    [optionalMetricList, selectedOptional]
  );

  if (loading) {
    return <div className={`text-center text-xs text-slate-400 py-6 ${className}`}>{UI.loading}</div>;
  }

  const renderLipidChart = (key: (typeof LIPID_VARIANTS)[number]) => {
    const data = lipidData[key];
    const meta = LIPID_META[key];
    return (
      <MetricTrendChart
        key={key}
        title={metricLabel(meta.code)}
        data={data}
        metricCode={meta.code}
        stroke={meta.color}
        valueName="mmol/L"
      />
    );
  };

  if (isCompactDashboard) {
    const hasLipidCharts = isAdminDashboard && LIPID_VARIANTS.some((k) => hasSeriesData(lipidData[k]));
    const hasDefault =
      bpData.length > 0 ||
      hasSeriesData(weightData) ||
      hasSeriesData(glucoseData) ||
      hasSeriesData(hba1cData) ||
      hasSeriesData(abiData) ||
      hasSeriesData(pwvData) ||
      hasLipidCharts;
    const hasOptional = selectedOptional && hasSeriesData(optionalSeries);

    if (!hasDefault && !hasOptional && !optionalLoading) {
      return (
        <div className={`text-center text-xs text-slate-400 py-6 ${className}`}>
          {UI.empty}
        </div>
      );
    }

    return (
      <div className={`space-y-4 ${className}`}>
        <BpTrendChart
          title={UI.bp}
          data={bpData}
          sbpName={metricLabel('core.sbp')}
          dbpName={metricLabel('core.dbp')}
        />
        <MetricTrendChart
          title={UI.weight}
          data={weightData}
          metricCode="core.weight"
          stroke={CHART_COLORS['core.weight']}
          valueName={`${metricLabel('core.weight')}(kg)`}
        />
        <MetricTrendChart
          title={UI.glucose}
          data={glucoseData}
          metricCode="core.fasting_glucose"
          stroke={CHART_COLORS['core.fasting_glucose']}
          valueName="mmol/L"
        />
        <MetricTrendChart
          title={UI.hba1c}
          data={hba1cData}
          metricCode="core.hba1c"
          stroke={CHART_COLORS['core.hba1c']}
          valueName="%"
        />
        <MetricTrendChart
          title={UI.abi}
          data={abiData}
          metricCode="core.abi"
          stroke={CHART_COLORS['core.abi']}
        />
        <MetricTrendChart
          title={UI.pwv}
          data={pwvData}
          metricCode="core.ba_pwv"
          stroke={CHART_COLORS['core.ba_pwv']}
          valueName="cm/s"
        />
        {isAdminDashboard && hasLipidCharts && (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-600">{UI.lipidSection}</p>
            {LIPID_VARIANTS.map(renderLipidChart)}
          </div>
        )}
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <label className="mb-1 block text-xs font-bold text-slate-600">
            {isAdminDashboard ? UI.moreAdmin : UI.moreUser}
          </label>
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
            value={selectedOptional}
            onChange={(e) => setSelectedOptional(e.target.value)}
          >
            <option value="">
              {isAdminDashboard ? UI.phAdmin : UI.phUser}
            </option>
            {optionalMetricList.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {optionalLoading && (
          <div className="text-center text-xs text-slate-400 py-4">{UI.optLoading}</div>
        )}
        {!optionalLoading && selectedOptional && !hasSeriesData(optionalSeries) && (
          <div className="text-center text-xs text-slate-400 py-4">{UI.optEmpty}</div>
        )}
        {!optionalLoading && hasOptional && optionalMeta && (
          <MetricTrendChart
            title={`${optionalMeta.label}${UI.trend}`}
            data={optionalSeries}
            metricCode={selectedOptional}
            stroke={CHART_COLORS[selectedOptional] || '#0d9488'}
            valueName={optionalMeta.unit}
          />
        )}
      </div>
    );
  }

  const showBp = variant === 'bp' || variant === 'all';
  const showWeight = variant === 'weight' || variant === 'all';
  const showGlucose = variant === 'glucose' || variant === 'all';
  const showLipids =
    variant === 'lipids' ||
    variant === 'all' ||
    LIPID_VARIANTS.includes(variant as (typeof LIPID_VARIANTS)[number]);

  const lipidKeysToShow: (typeof LIPID_VARIANTS)[number][] =
    variant === 'lipids' || variant === 'all'
      ? [...LIPID_VARIANTS]
      : LIPID_VARIANTS.includes(variant as (typeof LIPID_VARIANTS)[number])
        ? [variant as (typeof LIPID_VARIANTS)[number]]
        : [];

  const hasLipid = lipidKeysToShow.some((k) => hasSeriesData(lipidData[k]));
  const showExtra = variant === 'all';
  const hasAny =
    (showBp && bpData.length > 0) ||
    (showWeight && hasSeriesData(weightData)) ||
    (showGlucose && hasSeriesData(glucoseData)) ||
    (showLipids && hasLipid) ||
    (showExtra && hasSeriesData(waistData)) ||
    (showExtra && hasSeriesData(bodyFatData)) ||
    (showExtra && hasSeriesData(creatinineData));

  if (!hasAny) {
    return (
      <div className={`text-center text-xs text-slate-400 py-6 ${className}`}>
        {UI.empty}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {showBp && bpData.length > 0 && (
        <BpTrendChart
          title={UI.bp}
          data={bpData}
          sbpName={metricLabel('core.sbp')}
          dbpName={metricLabel('core.dbp')}
        />
      )}
      {showWeight && hasSeriesData(weightData) && (
        <MetricTrendChart
          title={UI.weight}
          data={weightData}
          metricCode="core.weight"
          stroke={CHART_COLORS['core.weight']}
          valueName={`${metricLabel('core.weight')}(kg)`}
        />
      )}
      {showGlucose && hasSeriesData(glucoseData) && (
        <MetricTrendChart
          title={UI.glucose}
          data={glucoseData}
          metricCode="core.fasting_glucose"
          stroke={CHART_COLORS['core.fasting_glucose']}
          valueName="mmol/L"
        />
      )}
      {showLipids && lipidKeysToShow.map(renderLipidChart)}
      {showExtra && hasSeriesData(waistData) && (
        <MetricTrendChart
          title={`${metricLabel('core.waist')}趋势`}
          data={waistData}
          metricCode="core.waist"
          stroke={CHART_COLORS['core.waist']}
          valueName="cm"
        />
      )}
      {showExtra && hasSeriesData(bodyFatData) && (
        <MetricTrendChart
          title={`${metricLabel('core.body_fat_rate')}趋势`}
          data={bodyFatData}
          metricCode="core.body_fat_rate"
          stroke={CHART_COLORS['core.body_fat_rate']}
          valueName="%"
        />
      )}
      {showExtra && hasSeriesData(creatinineData) && (
        <MetricTrendChart
          title={`${metricLabel('core.creatinine')}${UI.renal}`}
          data={creatinineData}
          metricCode="core.creatinine"
          stroke={CHART_COLORS['core.creatinine']}
          valueName={CORE_METRICS.find((m) => m.code === 'core.creatinine')?.unit ?? 'μmol/L'}
        />
      )}
    </div>
  );
};
