import React, { useEffect, useMemo, useState } from 'react';
import type { HealthRecord } from '../../types';
import type { UserMetricKey } from '../../services/observationMapper';
import { buildChartSeries, fetchObservationSeries } from '../../services/observationService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const METRIC_OPTIONS: { key: UserMetricKey; label: string; hint: string }[] = [
  { key: 'bp', label: '血压', hint: '收缩压 / 舒张压' },
  { key: 'weight', label: '体重', hint: 'kg' },
  { key: 'glucose', label: '空腹血糖', hint: 'mmol/L' },
  { key: 'tc', label: '总胆固醇 TC', hint: 'mmol/L' },
  { key: 'tg', label: '甘油三酯 TG', hint: 'mmol/L' },
  { key: 'ldl', label: '低密度脂蛋白 LDL', hint: 'mmol/L' },
  { key: 'hdl', label: '高密度脂蛋白 HDL', hint: 'mmol/L' },
  { key: 'waist', label: '腰围', hint: 'cm（仅更新档案，不入核心趋势）' },
  { key: 'height', label: '身高', hint: 'cm（用于计算 BMI）' },
];

const METRIC_CODE: Record<UserMetricKey, string | null> = {
  bp: null,
  weight: 'core.weight',
  glucose: 'core.fasting_glucose',
  tc: 'core.tc',
  tg: 'core.tg',
  ldl: 'core.ldl',
  hdl: 'core.hdl',
  waist: null,
  height: null,
};

interface Props {
  open: boolean;
  onClose: () => void;
  record: HealthRecord;
  checkupId: string;
  onSave: (payload: {
    metric: UserMetricKey;
    values: Record<string, number | string>;
    measuredAt: string;
  }) => Promise<void>;
}

export const UserMetricEntryModal: React.FC<Props> = ({
  open,
  onClose,
  record,
  checkupId,
  onSave,
}) => {
  const [step, setStep] = useState<'pick' | 'enter'>('pick');
  const [selected, setSelected] = useState<UserMetricKey | null>(null);
  const [measuredAt, setMeasuredAt] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [trend, setTrend] = useState<{ label: string; value: number }[]>([]);
  const [values, setValues] = useState({
    sbp: record.checkup.basics.sbp || 0,
    dbp: record.checkup.basics.dbp || 0,
    weight: record.checkup.basics.weight || 0,
    height: record.checkup.basics.height || 0,
    waist: record.checkup.basics.waist || 0,
    glucose: record.checkup.labBasic.glucose?.fasting || '',
    tc: record.checkup.labBasic.lipids?.tc || '',
    tg: record.checkup.labBasic.lipids?.tg || '',
    ldl: record.checkup.labBasic.lipids?.ldl || '',
    hdl: record.checkup.labBasic.lipids?.hdl || '',
  });

  const lipidKeys: UserMetricKey[] = ['tc', 'tg', 'ldl', 'hdl'];

  useEffect(() => {
    if (!open) {
      setStep('pick');
      setSelected(null);
      return;
    }
    setMeasuredAt(new Date().toISOString().slice(0, 10));
  }, [open]);

  useEffect(() => {
    if (!open || !selected || step !== 'enter') return;
    const code = METRIC_CODE[selected];
    if (!code) {
      setTrend([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const rows = await fetchObservationSeries(checkupId, [code], 100);
      if (cancelled) return;
      setTrend(buildChartSeries(rows, code).map((p) => ({ label: p.label, value: p.value })));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, selected, step, checkupId]);

  const selectedMeta = useMemo(
    () => METRIC_OPTIONS.find((m) => m.key === selected),
    [selected]
  );

  const handlePick = (key: UserMetricKey) => {
    setSelected(key);
    setStep('enter');
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await onSave({
        metric: selected,
        values,
        measuredAt,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-800">
            {step === 'pick' ? '选择要更新的指标' : `填写：${selectedMeta?.label}`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 font-black"
          >
            ×
          </button>
        </div>

        {step === 'pick' && (
          <>
            <p className="mb-3 text-xs text-slate-500">每次只更新一项指标，历史将按测量日期记入趋势。</p>
            <div className="grid grid-cols-2 gap-2">
              {METRIC_OPTIONS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => handlePick(m.key)}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-teal-300 hover:bg-teal-50"
                >
                  <div className="text-sm font-bold text-slate-800">{m.label}</div>
                  <div className="text-[11px] text-slate-500">{m.hint}</div>
                </button>
              ))}
            </div>
            {lipidKeys.length > 0 && (
              <p className="mt-3 text-[11px] text-slate-400">
                血脂四项（TC/TG/LDL/HDL）请分别选择对应项目更新，可在详情中查看各自趋势。
              </p>
            )}
          </>
        )}

        {step === 'enter' && selected && (
          <>
            <button
              type="button"
              className="mb-3 text-xs font-bold text-teal-600"
              onClick={() => setStep('pick')}
            >
              ← 重新选择指标
            </button>
            <div className="mb-3">
              <label className="text-xs text-slate-500">测量/检查日期</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"
                value={measuredAt}
                onChange={(e) => setMeasuredAt(e.target.value)}
              />
            </div>
            {trend.length > 0 && (
              <div className="mb-4 h-32 w-full rounded-lg border border-slate-100 bg-slate-50 p-2">
                <div className="text-[11px] text-slate-500 mb-1">{selectedMeta?.label} 历史趋势</div>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" fontSize={9} />
                    <YAxis fontSize={9} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              {selected === 'bp' && (
                <>
                  <div>
                    <label className="text-xs text-slate-400">收缩压</label>
                    <input
                      type="number"
                      className="mt-1 w-full rounded border p-2"
                      value={values.sbp}
                      onChange={(e) => setValues({ ...values, sbp: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">舒张压</label>
                    <input
                      type="number"
                      className="mt-1 w-full rounded border p-2"
                      value={values.dbp}
                      onChange={(e) => setValues({ ...values, dbp: Number(e.target.value) })}
                    />
                  </div>
                </>
              )}
              {selected === 'weight' && (
                <div className="col-span-2">
                  <label className="text-xs text-slate-400">体重 (kg)</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border p-2"
                    value={values.weight}
                    onChange={(e) => setValues({ ...values, weight: Number(e.target.value) })}
                  />
                </div>
              )}
              {selected === 'glucose' && (
                <div className="col-span-2">
                  <label className="text-xs text-slate-400">空腹血糖 (mmol/L)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded border p-2"
                    value={values.glucose}
                    onChange={(e) => setValues({ ...values, glucose: e.target.value })}
                  />
                </div>
              )}
              {selected === 'tc' && (
                <div className="col-span-2">
                  <label className="text-xs text-slate-400">总胆固醇 TC</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded border p-2"
                    value={values.tc}
                    onChange={(e) => setValues({ ...values, tc: e.target.value })}
                  />
                </div>
              )}
              {selected === 'tg' && (
                <div className="col-span-2">
                  <label className="text-xs text-slate-400">甘油三酯 TG</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded border p-2"
                    value={values.tg}
                    onChange={(e) => setValues({ ...values, tg: e.target.value })}
                  />
                </div>
              )}
              {selected === 'ldl' && (
                <div className="col-span-2">
                  <label className="text-xs text-slate-400">低密度脂蛋白 LDL</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded border p-2"
                    value={values.ldl}
                    onChange={(e) => setValues({ ...values, ldl: e.target.value })}
                  />
                </div>
              )}
              {selected === 'hdl' && (
                <div className="col-span-2">
                  <label className="text-xs text-slate-400">高密度脂蛋白 HDL</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded border p-2"
                    value={values.hdl}
                    onChange={(e) => setValues({ ...values, hdl: e.target.value })}
                  />
                </div>
              )}
              {selected === 'waist' && (
                <div className="col-span-2">
                  <label className="text-xs text-slate-400">腰围 (cm)</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border p-2"
                    value={values.waist}
                    onChange={(e) => setValues({ ...values, waist: Number(e.target.value) })}
                  />
                </div>
              )}
              {selected === 'height' && (
                <div className="col-span-2">
                  <label className="text-xs text-slate-400">身高 (cm)</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border p-2"
                    value={values.height}
                    onChange={(e) => setValues({ ...values, height: Number(e.target.value) })}
                  />
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className="w-full rounded-lg bg-teal-600 py-3 font-bold text-white shadow-md disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存此项指标'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
