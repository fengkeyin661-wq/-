import React, { useEffect, useState } from 'react';
import { fetchObservationSeries } from '../../services/observationService';
import { buildTrendAlerts, TREND_METRIC_CODES, type TrendAlert } from '../../services/trendAlertService';

interface Props {
  checkupId?: string;
}

export const TrendReminders: React.FC<Props> = ({ checkupId }) => {
  const [alerts, setAlerts] = useState<TrendAlert[]>([]);

  useEffect(() => {
    const id = (checkupId || '').trim();
    if (!/^\d{6}$/.test(id)) {
      setAlerts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchObservationSeries(id, TREND_METRIC_CODES, 500);
        if (!cancelled) setAlerts(buildTrendAlerts(rows));
      } catch {
        if (!cancelled) setAlerts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkupId]);

  if (!alerts.length) return null;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" aria-live="polite">
      <h3 className="text-sm font-bold text-amber-900">指标趋势提醒</h3>
      <ul className="mt-2 space-y-1">
        {alerts.map((alert) => (
          <li key={alert.code} className="text-sm leading-relaxed text-amber-950">
            {alert.text}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-amber-800">对照的是历次体检和随访录入的数值，用来提示变化，不能代替医生诊断。</p>
    </section>
  );
};
