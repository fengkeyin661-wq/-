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
  buildChartSeries,
} from '../services/observationService';

interface Props {
  checkupId: string;
  variant?: 'bp' | 'weight' | 'glucose' | 'tc' | 'tg' | 'ldl' | 'hdl' | 'lipids' | 'all' | 'dashboard';
  className?: string;
}

const DEFAULT_CODES = ['core.sbp', 'core.dbp', 'core.weight', 'core.fasting_glucose'];

const OPTIONAL_METRICS = CORE_METRICS.filter(
  (m) => !['core.sbp', 'core.dbp', 'core.weight', 'core.fasting_glucose', 'core.bmi'].includes(m.code)
);

const metricLabel = (code: string): string =>
  CORE_METRICS.find((m) => m.code === code)?.label ?? code;

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
  const isDashboard = variant === 'dashboard';
  const [bpData, setBpData] = useState<{ date: string; label: string; sbp?: number; dbp?: number }[]>([]);
  const [weightData, setWeightData] = useState<{ label: string; value: number }[]>([]);
  const [glucoseData, setGlucoseData] = useState<{ label: string; value: number }[]>([]);
  const [lipidData, setLipidData] = useState<
    Record<(typeof LIPID_VARIANTS)[number], { label: string; value: number }[]>
  >({ tc: [], tg: [], ldl: [], hdl: [] });
  const [waistData, setWaistData] = useState<{ label: string; value: number }[]>([]);
  const [bodyFatData, setBodyFatData] = useState<{ label: string; value: number }[]>([]);
  const [creatinineData, setCreatinineData] = useState<{ label: string; value: number }[]>([]);
  const [optionalSeries, setOptionalSeries] = useState<{ label: string; value: number }[]>([]);
  const [optionalLoading, setOptionalLoading] = useState(false);
  const [selectedOptional, setSelectedOptional] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!checkupId) return;
      setLoading(true);
      const codes = isDashboard
        ? DEFAULT_CODES
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
      setWeightData(
        buildChartSeries(rows, 'core.weight').map((p) => ({ label: p.label, value: p.value }))
      );
      setGlucoseData(
        buildChartSeries(rows, 'core.fasting_glucose').map((p) => ({
          label: p.label,
          value: p.value,
        }))
      );
      if (!isDashboard) {
        setLipidData({
          tc: buildChartSeries(rows, 'core.tc').map((p) => ({ label: p.label, value: p.value })),
          tg: buildChartSeries(rows, 'core.tg').map((p) => ({ label: p.label, value: p.value })),
          ldl: buildChartSeries(rows, 'core.ldl').map((p) => ({ label: p.label, value: p.value })),
          hdl: buildChartSeries(rows, 'core.hdl').map((p) => ({ label: p.label, value: p.value })),
        });
        setWaistData(buildChartSeries(rows, 'core.waist').map((p) => ({ label: p.label, value: p.value })));
        setBodyFatData(
          buildChartSeries(rows, 'core.body_fat_rate').map((p) => ({ label: p.label, value: p.value }))
        );
        setCreatinineData(
          buildChartSeries(rows, 'core.creatinine').map((p) => ({ label: p.label, value: p.value }))
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [checkupId, isDashboard]);

  useEffect(() => {
    if (!isDashboard || !selectedOptional || !checkupId) {
      setOptionalSeries([]);
      return;
    }
    let cancelled = false;
    setOptionalLoading(true);
    (async () => {
      const rows = await fetchObservationSeries(checkupId, [selectedOptional], 200);
      if (cancelled) return;
      setOptionalSeries(
        buildChartSeries(rows, selectedOptional).map((p) => ({ label: p.label, value: p.value }))
      );
      setOptionalLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [checkupId, isDashboard, selectedOptional]);

  const optionalMeta = useMemo(
    () => OPTIONAL_METRICS.find((m) => m.code === selectedOptional),
    [selectedOptional]
  );

  if (loading) {
    return <div className={`text-center text-xs text-slate-400 py-6 ${className}`}>加载趋势数据…</div>;
  }

  if (isDashboard) {
    const hasDefault =
      bpData.length > 0 || weightData.length > 0 || glucoseData.length > 0;
    const hasOptional = selectedOptional && optionalSeries.length > 0;

    if (!hasDefault && !hasOptional && !optionalLoading) {
      return (
        <div className={`text-center text-xs text-slate-400 py-6 ${className}`}>
          暂无历史观测，更新指标后将自动生成趋势
        </div>
      );
    }

    return (
      <div className={`space-y-4 ${className}`}>
        {bpData.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">血压趋势</h4>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bpData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} domain={['dataMin - 10', 'dataMax + 10']} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="sbp"
                    name={metricLabel('core.sbp')}
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="dbp"
                    name={metricLabel('core.dbp')}
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {weightData.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">体重趋势</h4>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" fontSize={10} />
                  <YAxis fontSize={10} domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={`${metricLabel('core.weight')}(kg)`}
                    stroke="#0d9488"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {glucoseData.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">空腹血糖趋势</h4>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={glucoseData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="mmol/L"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <label className="mb-1 block text-xs font-bold text-slate-600">查看更多定量指标趋势</label>
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
            value={selectedOptional}
            onChange={(e) => setSelectedOptional(e.target.value)}
          >
            <option value="">请选择指标（血脂、腰围、肾功能等）</option>
            {OPTIONAL_METRICS.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {optionalLoading && (
          <div className="text-center text-xs text-slate-400 py-4">加载指标趋势…</div>
        )}
        {!optionalLoading && selectedOptional && optionalSeries.length === 0 && (
          <div className="text-center text-xs text-slate-400 py-4">该指标暂无历史数据</div>
        )}
        {!optionalLoading && hasOptional && optionalMeta && (
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">{optionalMeta.label} 趋势</h4>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={optionalSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={optionalMeta.unit}
                    stroke={CHART_COLORS[selectedOptional] || '#0d9488'}
                    strokeWidth={2}
                    dot={{ r: 3 }}
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

  const hasLipid = lipidKeysToShow.some((k) => lipidData[k].length > 0);
  const showExtra = variant === 'all';
  const hasAny =
    (showBp && bpData.length > 0) ||
    (showWeight && weightData.length > 0) ||
    (showGlucose && glucoseData.length > 0) ||
    (showLipids && hasLipid) ||
    (showExtra && waistData.length > 0) ||
    (showExtra && bodyFatData.length > 0) ||
    (showExtra && creatinineData.length > 0);

  if (!hasAny) {
    return (
      <div className={`text-center text-xs text-slate-400 py-6 ${className}`}>
        暂无历史观测，更新指标后将自动生成趋势
      </div>
    );
  }

  const renderLipidChart = (key: (typeof LIPID_VARIANTS)[number]) => {
    const data = lipidData[key];
    if (!data.length) return null;
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
                type="monotone"
                dataKey="value"
                name="mmol/L"
                stroke={meta.color}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {showBp && bpData.length > 0 && (
        <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">血压趋势</h4>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bpData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} domain={['dataMin - 10', 'dataMax + 10']} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Line
                  type="monotone"
                  dataKey="sbp"
                  name={metricLabel('core.sbp')}
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="dbp"
                  name={metricLabel('core.dbp')}
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {showWeight && weightData.length > 0 && (
        <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">体重趋势</h4>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={`${metricLabel('core.weight')}(kg)`}
                  stroke="#0d9488"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {showGlucose && glucoseData.length > 0 && (
        <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2">空腹血糖趋势</h4>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={glucoseData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Line type="monotone" dataKey="value" name="mmol/L" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {showLipids && lipidKeysToShow.map(renderLipidChart)}
      {showExtra && waistData.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-2">{metricLabel('core.waist')}??</h4>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={waistData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip />
                <Line type="monotone" dataKey="value" name="cm" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {showExtra && bodyFatData.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-2">{metricLabel('core.body_fat_rate')}??</h4>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bodyFatData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip />
                <Line type="monotone" dataKey="value" name="%" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {showExtra && creatinineData.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-2">{metricLabel('core.creatinine')}趋势（肾功能）</h4>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={creatinineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} domain={['auto', 'auto']} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={CORE_METRICS.find((m) => m.code === 'core.creatinine')?.unit ?? '?mol/L'}
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
