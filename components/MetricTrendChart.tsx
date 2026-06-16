import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Label,
} from 'recharts';
import { buildMetricAxisConfig, buildBpAxisConfig, formatChartTick } from '../services/chartAxisConfig';

const TREND_LINE_PROPS = {
  type: 'monotone' as const,
  connectNulls: true,
  strokeWidth: 2,
  dot: { r: 3 },
};

const ReferenceLines: React.FC<{ lines: { value: number; label: string; color?: string }[] }> = ({
  lines,
}) => (
  <>
    {lines.map((ref) => (
      <ReferenceLine
        key={`${ref.value}-${ref.label}`}
        y={ref.value}
        stroke={ref.color || '#94a3b8'}
        strokeDasharray="4 4"
        strokeWidth={1}
      >
        <Label
          value={ref.label}
          position="insideTopRight"
          fontSize={9}
          fill={ref.color || '#64748b'}
        />
      </ReferenceLine>
    ))}
  </>
);

interface SingleProps {
  title: string;
  data: { label: string; value: number | null }[];
  metricCode: string;
  stroke: string;
  valueName?: string;
  height?: number;
}

export const MetricTrendChart: React.FC<SingleProps> = ({
  title,
  data,
  metricCode,
  stroke,
  valueName,
  height = 160,
}) => {
  const hasData = data.some((p) => p.value != null);
  if (!hasData) return null;

  const axis = buildMetricAxisConfig(
    metricCode,
    data.map((p) => p.value)
  );

  return (
    <div>
      <h4 className="text-sm font-bold text-slate-700 mb-2">{title}</h4>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
            <YAxis
              fontSize={10}
              domain={axis.domain}
              ticks={axis.ticks}
              tickFormatter={(v) => formatChartTick(Number(v), axis.tickDecimals)}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
              formatter={(val: number) =>
                formatChartTick(val, axis.tickDecimals)
              }
            />
            <ReferenceLines lines={axis.referenceLines} />
            <Line
              {...TREND_LINE_PROPS}
              dataKey="value"
              name={valueName || ''}
              stroke={stroke}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

interface BpProps {
  title: string;
  data: { label: string; sbp?: number; dbp?: number }[];
  sbpName: string;
  dbpName: string;
  height?: number;
}

export const BpTrendChart: React.FC<BpProps> = ({
  title,
  data,
  sbpName,
  dbpName,
  height = 192,
}) => {
  if (!data.length) return null;

  const axis = buildBpAxisConfig(
    data.map((p) => p.sbp).filter((v): v is number => v != null),
    data.map((p) => p.dbp).filter((v): v is number => v != null)
  );

  return (
    <div>
      <h4 className="text-sm font-bold text-slate-700 mb-2">{title}</h4>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
            <YAxis
              fontSize={10}
              domain={axis.domain}
              ticks={axis.ticks}
              tickFormatter={(v) => formatChartTick(Number(v), 0)}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            <ReferenceLines lines={axis.referenceLines} />
            <Line {...TREND_LINE_PROPS} dataKey="sbp" name={sbpName} stroke="#ef4444" />
            <Line {...TREND_LINE_PROPS} dataKey="dbp" name={dbpName} stroke="#f97316" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
