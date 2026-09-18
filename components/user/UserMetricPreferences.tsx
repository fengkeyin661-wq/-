import React, { useEffect, useState } from 'react';
import { CORE_METRICS } from '../../services/metricCatalog';
import {
  fetchMetricPreferences,
  saveMetricPreferences,
  ensureDefaultMetricPreferences,
  type MetricPreference,
} from '../../services/observationService';

interface Props {
  archiveId: string;
}

export const UserMetricPreferences: React.FC<Props> = ({ archiveId }) => {
  const [prefs, setPrefs] = useState<MetricPreference[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureDefaultMetricPreferences(archiveId);
      const rows = await fetchMetricPreferences(archiveId);
      if (!cancelled) setPrefs(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [archiveId]);

  const toggle = (code: string) => {
    setPrefs((prev) =>
      prev.map((p) => (p.metric_code === code ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    const ok = await saveMetricPreferences(archiveId, prefs);
    setSaving(false);
    setMsg(ok ? '已保存指标显示偏好' : '保存失败');
  };

  const labelOf = (code: string) => CORE_METRICS.find((m) => m.code === code)?.label || code;

  return (
    <div className="mt-4 rounded-xl border border-slate-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-800">关注的健康指标</h4>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-xs font-bold text-teal-600 disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
      <p className="mb-3 text-[11px] text-slate-500">关闭后不在详情中突出显示；历史数据仍保留。</p>
      <div className="flex flex-wrap gap-2">
        {prefs.map((p) => (
          <button
            key={p.metric_code}
            type="button"
            onClick={() => toggle(p.metric_code)}
            className={`rounded-full px-3 py-1 text-xs font-bold border transition-colors ${
              p.enabled
                ? 'bg-teal-50 border-teal-200 text-teal-800'
                : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
            }`}
          >
            {labelOf(p.metric_code)}
          </button>
        ))}
      </div>
      {msg ? <p className="mt-2 text-xs text-teal-600">{msg}</p> : null}
    </div>
  );
};
