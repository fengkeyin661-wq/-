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
  variant?: 'bp' | 'weight' | 'glucose' | 'all';
  className?: string;
}

export const HealthTrendCharts: React.FC<Props> = ({
  checkupId,
  variant = 'bp',
  className = '',
}) => {
  const [bpData, setBpData] = useState<{ date: string; label: string; sbp?: number; dbp?: number }[]>([]);
  const [weightData, setWeightData] = useState<{ label: string; value: number }[]>([]);
  const [glucoseData, setGlucoseData] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!checkupId) return;
      setLoading(true);
      const rows = await fetchObservationSeries(
        checkupId,
        ['core.sbp', 'core.dbp', 'core.weight', 'core.fasting_glucose'],
        200
      );
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

  const hasAny =
    (showBp && bpData.length > 0) ||
    (showWeight && weightData.length > 0) ||
    (showGlucose && glucoseData.length > 0);

  if (!hasAny) {
    return (
      <div className={`text-center text-xs text-slate-400 py-6 ${className}`}>
        暂无历史观测，更新指标后将自动生成趋势
      </div>
    );
  }

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
    </div>
  );
};
