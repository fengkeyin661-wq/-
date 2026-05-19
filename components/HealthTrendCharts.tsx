import React, { useEffect, useState } from 'react';
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
import {
  fetchObservationSeries,
  buildBpChartData,
  buildChartSeries,
} from '../services/observationService';

interface Props {
  checkupId: string;
  variant?: 'bp' | 'weight' | 'glucose' | 'tc' | 'tg' | 'ldl' | 'hdl' | 'lipids' | 'all';
  className?: string;
}

const LIPID_VARIANTS = ['tc', 'tg', 'ldl', 'hdl'] as const;
const LIPID_META: Record<(typeof LIPID_VARIANTS)[number], { code: string; title: string; color: string }> = {
  tc: { code: 'core.tc', title: '总胆固醇 TC', color: '#0d9488' },
  tg: { code: 'core.tg', title: '甘油三酯 TG', color: '#f59e0b' },
  ldl: { code: 'core.ldl', title: '低密度脂蛋白 LDL', color: '#ef4444' },
  hdl: { code: 'core.hdl', title: '高密度脂蛋白 HDL', color: '#3b82f6' },
};

export const HealthTrendCharts: React.FC<Props> = ({
  checkupId,
  variant = 'bp',
  className = '',
}) => {
  const [bpData, setBpData] = useState<{ date: string; label: string; sbp?: number; dbp?: number }[]>([]);
  const [weightData, setWeightData] = useState<{ label: string; value: number }[]>([]);
  const [glucoseData, setGlucoseData] = useState<{ label: string; value: number }[]>([]);
  const [lipidData, setLipidData] = useState<
    Record<(typeof LIPID_VARIANTS)[number], { label: string; value: number }[]>
  >({ tc: [], tg: [], ldl: [], hdl: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!checkupId) return;
      setLoading(true);
      const metricCodes = [
        'core.sbp',
        'core.dbp',
        'core.weight',
        'core.fasting_glucose',
        'core.tc',
        'core.tg',
        'core.ldl',
        'core.hdl',
      ];
      const rows = await fetchObservationSeries(checkupId, metricCodes, 200);
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
      setLipidData({
        tc: buildChartSeries(rows, 'core.tc').map((p) => ({ label: p.label, value: p.value })),
        tg: buildChartSeries(rows, 'core.tg').map((p) => ({ label: p.label, value: p.value })),
        ldl: buildChartSeries(rows, 'core.ldl').map((p) => ({ label: p.label, value: p.value })),
        hdl: buildChartSeries(rows, 'core.hdl').map((p) => ({ label: p.label, value: p.value })),
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [checkupId]);

  if (loading) {
    return <div className={`text-center text-xs text-slate-400 py-6 ${className}`}>加载趋势数据…</div>;
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
  const hasAny =
    (showBp && bpData.length > 0) ||
    (showWeight && weightData.length > 0) ||
    (showGlucose && glucoseData.length > 0) ||
    (showLipids && hasLipid);

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
    return (
      <div key={key}>
        <h4 className="text-sm font-bold text-slate-700 mb-2">{meta.title}</h4>
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
                <Line type="monotone" dataKey="sbp" name="收缩压" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="dbp" name="舒张压" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
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
                <Line type="monotone" dataKey="value" name="体重(kg)" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} />
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
    </div>
  );
};
