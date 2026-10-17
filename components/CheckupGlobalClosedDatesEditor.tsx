import React, { useEffect, useState } from 'react';
import {
  DEFAULT_CHECKUP_GLOBAL_CLOSED_DATES,
  fetchCheckupGlobalClosedDates,
  saveCheckupGlobalClosedDates,
  syncGlobalClosedDatesToAllPackages,
  type CheckupGlobalClosedDatesConfig,
} from '../services/checkupGlobalClosedDatesService';
import { enumerateDateKeys, mergeClosedDateKeys } from '../services/doctorScheduleUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const CheckupGlobalClosedDatesEditor: React.FC<Props> = ({ open, onClose, onSaved }) => {
  const [draft, setDraft] = useState<CheckupGlobalClosedDatesConfig>(
    DEFAULT_CHECKUP_GLOBAL_CLOSED_DATES,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateInput, setDateInput] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [syncMode, setSyncMode] = useState<'merge' | 'replace'>('merge');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const config = await fetchCheckupGlobalClosedDates();
        if (!cancelled) setDraft(config);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const addDate = (value: string) => {
    const v = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    setDraft((prev) => ({
      closedDates: mergeClosedDateKeys(prev.closedDates, [v]),
    }));
  };

  const addRange = () => {
    if (!rangeStart || !rangeEnd) {
      alert('请先选择区间的开始日期和结束日期');
      return;
    }
    const extra = enumerateDateKeys(rangeStart, rangeEnd);
    if (!extra.length) {
      alert('日期区间无效');
      return;
    }
    if (extra.length > 62 && !confirm(`该区间共 ${extra.length} 天，是否全部加入？`)) return;
    setDraft((prev) => ({
      closedDates: mergeClosedDateKeys(prev.closedDates, extra),
    }));
    setRangeStart('');
    setRangeEnd('');
  };

  const handleSaveGlobal = async () => {
    setSaving(true);
    try {
      const res = await saveCheckupGlobalClosedDates(draft);
      if (!res.success) {
        alert(`保存失败：${res.error || '未知错误'}`);
        return;
      }
      alert('全局例外关闭日已保存，预约站将自动生效');
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSyncAll = async () => {
    if (!draft.closedDates.length) {
      alert('请至少添加一个关闭日期');
      return;
    }
    const modeLabel = syncMode === 'replace' ? '覆盖各套餐关闭日为同一清单' : '追加到各套餐已有关闭日';
    if (
      !confirm(
        `将保存全局关闭日（${draft.closedDates.length} 个），并同步写入全部体检套餐（${modeLabel}）。是否继续？`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const saveRes = await saveCheckupGlobalClosedDates(draft);
      if (!saveRes.success) {
        alert(`保存全局配置失败：${saveRes.error || '未知错误'}`);
        return;
      }
      const { updated } = await syncGlobalClosedDatesToAllPackages(draft, syncMode);
      alert(`已保存全局配置，并同步至 ${updated} 个体检套餐`);
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">体检套餐全局例外关闭日</h3>
            <p className="mt-1 text-xs text-slate-500">
              设置后所有体检套餐预约站号源均不可约；也可同步写入各套餐明细便于查看
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl font-bold text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {loading ? (
            <p className="text-sm text-slate-500">加载中…</p>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="text-xs font-bold text-slate-700">添加单日</div>
                <div className="flex flex-wrap items-end gap-2">
                  <input
                    type="date"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      addDate(dateInput);
                      setDateInput('');
                    }}
                    className="rounded bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
                  >
                    添加该日
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                <div className="text-xs font-bold text-amber-900">按区间统一关闭（含起止当天）</div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs text-slate-600">
                    开始
                    <input
                      type="date"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                      className="mt-1 block rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-600">
                    结束
                    <input
                      type="date"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      className="mt-1 block rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={addRange}
                    className="rounded bg-amber-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800"
                  >
                    生成并加入区间
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700">
                    全局关闭日（{draft.closedDates.length}）
                  </div>
                  {draft.closedDates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDraft({ closedDates: [] })}
                      className="text-xs font-bold text-slate-400 hover:text-red-600"
                    >
                      清空
                    </button>
                  )}
                </div>
                <div className="flex min-h-[40px] flex-wrap gap-2 rounded-xl border border-dashed border-slate-200 p-3">
                  {draft.closedDates.length === 0 ? (
                    <span className="text-xs text-slate-400">尚未添加日期</span>
                  ) : (
                    draft.closedDates.map((d) => (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 py-0.5 pl-2 pr-1 text-xs font-bold text-slate-700"
                      >
                        {d}
                        <button
                          type="button"
                          className="h-5 w-5 rounded-full hover:bg-slate-200"
                          onClick={() =>
                            setDraft((prev) => ({
                              closedDates: prev.closedDates.filter((x) => x !== d),
                            }))
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="text-xs font-bold text-slate-700">同步至全部套餐时的写入方式</div>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    className="mt-1"
                    name="globalSyncMode"
                    checked={syncMode === 'merge'}
                    onChange={() => setSyncMode('merge')}
                  />
                  <span>追加：把全局关闭日加到各套餐已有关闭日中</span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    className="mt-1"
                    name="globalSyncMode"
                    checked={syncMode === 'replace'}
                    onChange={() => setSyncMode('replace')}
                  />
                  <span>覆盖：各套餐关闭日全部改成与全局相同的清单</span>
                </label>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 p-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-6 py-2 font-bold text-slate-500 hover:bg-slate-200"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void handleSaveGlobal()}
            className="rounded-lg bg-teal-600 px-6 py-2 font-bold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : '仅保存全局配置'}
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void handleSaveAndSyncAll()}
            className="rounded-lg bg-amber-700 px-6 py-2 font-bold text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {saving ? '处理中…' : '保存并同步全部套餐'}
          </button>
        </div>
      </div>
    </div>
  );
};
