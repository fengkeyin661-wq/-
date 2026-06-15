import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { CORE_METRICS } from '../services/metricCatalog';
import {
  fetchObservationSeries,
  buildBpChartData,
  buildContinuousChartSeries,
} from '../services/observationService';

const TREND_LINE_PROPS = {
  type: 'monotone' as const,
  connectNulls: true,
  strokeWidth: 2,
  dot: { r: 3 },
};

interface Props {
  checkupId: string;
  variant?: 'bp' | 'weight' | 'glucose' | 'tc' | 'tg' | 'ldl' | 'hdl' | 'lipids' | 'all' | 'dashboard' | 'admin';
  className?: string;
}

const DEFAULT_CODES = ['core.sbp', 'core.dbp', 'core.weight', 'core.fasting_glucose'];
const LIPID_CODES = ['core.tc', 'core.tg', 'core.ldl', 'core.hdl'] as const;

const OPTIONAL_METRICS = CORE_METRICS.filter(
  (m) => !['core.sbp', 'core.dbp', 'core.weight', 'core.fasting_glucose', 'core.bmi'].includes(m.code)
);

/** Admin optional metrics exclude lipids (shown as separate charts). */
const ADMIN_OPTIONAL_METRICS = OPTIONAL_METRICS.filter(
  (m) => !LIPID_CODES.includes(m.code as (typeof LIPID_CODES)[number])
);

const UI = {
  loading: '\u52a0\u8f7d\u8d8b\u52bf\u6570\u636e\u2026',
  empty: '\u6682\u65e0\u5386\u53f2\u89c2\u6d4b\uff0c\u66f4\u65b0\u6307\u6807\u540e\u5c06\u81ea\u52a8\u751f\u6210\u8d8b\u52bf',
  bp: '\u8840\u538b\u8d8b\u52bf',
  weight: '\u4f53\u91cd\u8d8b\u52bf',
  glucose: '\u7a7a\u8179\u8840\u7cd6\u8d8b\u52bf',
  lipidSection: '\u8840\u8102\u6307\u6807\uff08\u5206\u9879\u5c55\u793a\uff0c\u542b\u9ad8\u5bc6\u5ea6\u8102\u86cb\u767d\uff09',
  moreAdmin: '\u67e5\u770b\u66f4\u591a\u6307\u6807\u8d8b\u52bf',
  moreUser: '\u67e5\u770b\u66f4\u591a\u5b9a\u91cf\u6307\u6807\u8d8b\u52bf',
  phAdmin: '\u8bf7\u9009\u62e9\u6307\u6807\uff08\u8170\u56f4\u3001\u4f53\u8102\u7387\u3001\u80be\u529f\u80fd\u7b49\uff09',
  phUser: '\u8bf7\u9009\u62e9\u6307\u6807\uff08\u8840\u8102\u3001\u8170\u56f4\u3001\u80be\u529f\u80fd\u7b49\uff09',
  optLoading: '\u52a0\u8f7d\u6307\u6807\u8d8b\u52bf\u2026',
  optEmpty: '\u8be5\u6307\u6807\u6682\u65e0\u5386\u53f2\u6570\u636e',
  trend: '\u8d8b\u52bf',
  renal: '\u8d8b\u52bf\uff08\u80be\u529f\u80fd\uff09',
} as const;

const metricLabel = (code: string): string =>
  CORE_METRICS.find((m) => m.code === code)?.label ?? code;

const hasSeriesData = (data: { value: number | null }[]) => data.some((p) => p.value != null);

const CHART_COLORS: Record<string, string> = {
  'core.tc': '#0d9488',
  'core.tg': '#f59e0b',
  'core.ldl': '#ef4444',
  'core.hdl': '#3b82f6',
  'core.waist': '#6366f1',
  'core.body_fat_rate': '#ec4899',
  'core.creatinine': '#14b8a6',
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
        ? DEFAULT_CODES
        : isAdminDashboard
          ? [...DEFAULT_CODES, ...LIPID_CODES]
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
            ];
      const rows = await fetchObservationSeries(checkupId, codes, 200);
      if (cancelled) return;
      setBpData(buildBpChartData(rows));
      const toSeries = (code: string) =>
        buildContinuousChartSeries(rows, code).map((p) => ({ label: p.label, value: p.value }));

      setWeightData(toSeries('core.weight'));
      setGlucoseData(toSeries('core.fasting_glucose'));
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
        [...new Set([...DEFAULT_CODES, ...LIPID_CODES, selectedOptional])],
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
    if (!hasSeriesData(data)) return null;
    const meta = LIPID_META[key];
    const title = metricLabel(meta.code);
    return (
      <div key={key}>
        <h4 className="text-sm font-bold text-slate-700 mb-2">{title}</h4>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} domain={['dataMin - 0.5', 'dataMax + 0.5']} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
              <Line
                {...TREND_LINE_PROPS}
                dataKey="value"
                name="mmol/L"
                stroke={meta.color}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  if (isCompactDashboard) {
    const hasLipidCharts = isAdminDashboard && LIPID_VARIANTS.some((k) => hasSeriesData(lipidData[k]));
    const hasDefault =
      bpData.length > 0 ||
      hasSeriesData(weightData) ||
      hasSeriesData(glucoseData) ||
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
        {bpData.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">{UI.bp}</h4>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bpData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} domain={['dataMin - 10', 'dataMax + 10']} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Line
                    {...TREND_LINE_PROPS}
                    dataKey="sbp"
                    name={metricLabel('core.sbp')}
                    stroke="#ef4444"
                  />
                  <Line
                    {...TREND_LINE_PROPS}
                    dataKey="dbp"
                    name={metricLabel('core.dbp')}
                    stroke="#f97316"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {hasSeriesData(weightData) && (
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">{UI.weight}</h4>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" fontSize={10} />
                  <YAxis fontSize={10} domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip />
                  <Line
                    {...TREND_LINE_PROPS}
                    dataKey="value"
                    name={`${metricLabel('core.weight')}(kg)`}
                    stroke="#0d9488"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {hasSeriesData(glucoseData) && (
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">{UI.glucose}</h4>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={glucoseData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Line
                    {...TREND_LINE_PROPS}
                    dataKey="value"
                    name="mmol/L"
                    stroke="#8b5cf6"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
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
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">{optionalMeta.label}{UI.trend}</h4>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={optionalSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  <Line
                    {...TREND_LINE_PROPS}
                    dataKey="value"
                    name={optionalMeta.unit}
                    stroke={CHART_COLORS[selectedOptional] || '#0d9488'}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
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
        <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">{UI.bp}</h4>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bpData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} domain={['dataMin - 10', 'dataMax + 10']} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Line
                  {...TREND_LINE_PROPS}
                  dataKey="sbp"
                  name={metricLabel('core.sbp')}
                  stroke="#ef4444"
                />
                <Line
                  {...TREND_LINE_PROPS}
                  dataKey="dbp"
                  name={metricLabel('core.dbp')}
                  stroke="#f97316"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {showWeight && hasSeriesData(weightData) && (
        <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">{UI.weight}</h4>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip />
                <Line
                  {...TREND_LINE_PROPS}
                  dataKey="value"
                  name={`${metricLabel('core.weight')}(kg)`}
                  stroke="#0d9488"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {showGlucose && hasSeriesData(glucoseData) && (
        <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">{UI.glucose}</h4>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={glucoseData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Line {...TREND_LINE_PROPS} dataKey="value" name="mmol/L" stroke="#8b5cf6" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {showLipids && lipidKeysToShow.map(renderLipidChart)}
      {showExtra && hasSeriesData(waistData) && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-2">{metricLabel('core.waist')}??</h4>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={waistData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip />
                <Line {...TREND_LINE_PROPS} dataKey="value" name="cm" stroke="#6366f1" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {showExtra && hasSeriesData(bodyFatData) && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-2">{metricLabel('core.body_fat_rate')}??</h4>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bodyFatData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip />
                <Line {...TREND_LINE_PROPS} dataKey="value" name="%" stroke="#ec4899" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {showExtra && hasSeriesData(creatinineData) && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-2">{metricLabel('core.creatinine')}{UI.renal}</h4>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={creatinineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} domain={['auto', 'auto']} />
                <Tooltip />
                <Line
                  {...TREND_LINE_PROPS}
                  dataKey="value"
                  name={CORE_METRICS.find((m) => m.code === 'core.creatinine')?.unit ?? '?mol/L'}
                  stroke="#14b8a6"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
