import React, { useMemo, useState } from 'react';
import type { LipidIndicatorProfile } from '../types';
import { printIndicatorProfile } from '../services/indicatorProfilePrintService';

interface Props {
  profile: LipidIndicatorProfile;
  patientName?: string;
}

const SOURCE_LABEL: Record<string, string> = {
  screening: '专项筛查',
  checkup: '健康档案',
  both: '筛查+档案',
};

export const LipidIndicatorProfilePanel: React.FC<Props> = ({ profile, patientName }) => {
  const [showMissingOnly, setShowMissingOnly] = useState(false);

  const filteredCategories = useMemo(() => {
    if (!showMissingOnly) return profile.categories;
    return profile.categories
      .map((cat) => ({ ...cat, items: cat.items.filter((i) => i.status === 'missing') }))
      .filter((cat) => cat.items.length > 0);
  }, [profile.categories, showMissingOnly]);

  const handlePrint = () => {
    printIndicatorProfile({
      moduleTitle: '社区血脂异常专项管理',
      documentTitle: '分项指标档案',
      accentColor: '#d97706',
      patientName,
      profile,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800">分项指标档案</h3>
            <p className="text-sm text-slate-500 mt-1">
              {patientName ? `${patientName} · ` : ''}
              汇总血脂专项筛查与健康档案数据，未检测项目给出补测建议
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs items-center">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700"
            >
              🖨️ 打印档案
            </button>
            <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 font-medium">
              已检 {profile.presentCount}/{profile.totalItems}
            </span>
            <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 font-medium">
              待补测 {profile.missingCount}
            </span>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 mt-3 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showMissingOnly}
            onChange={(e) => setShowMissingOnly(e.target.checked)}
            className="rounded border-slate-300"
          />
          仅看待补测项目
        </label>
      </div>

      {profile.missingHighPriority.length > 0 && (
        <div className="px-5 py-4 bg-amber-50 border-b border-amber-100">
          <h4 className="text-sm font-bold text-amber-900 mb-2">优先补测提醒</h4>
          <ul className="space-y-2">
            {profile.missingHighPriority.map((item) => (
              <li key={item.itemId} className="text-sm text-amber-900">
                <span className="font-medium">{item.label}</span>
                <span className="text-amber-800"> — {item.retestCycle}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {filteredCategories.map((cat) => (
          <section key={cat.categoryId} className="px-5 py-4">
            <h4 className="text-sm font-bold text-slate-800 mb-3">
              {cat.label}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {cat.presentCount}/{cat.items.length} 项已有数据
              </span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-2 pr-3 font-medium">指标</th>
                    <th className="pb-2 pr-3 font-medium">结果</th>
                    <th className="pb-2 pr-3 font-medium">参考范围</th>
                    <th className="pb-2 pr-3 font-medium">来源</th>
                    <th className="pb-2 font-medium">复查周期</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.items.map((item) => (
                    <tr
                      key={item.itemId}
                      className={`border-b border-slate-50 ${item.status === 'missing' ? 'bg-amber-50/40' : ''}`}
                    >
                      <td className="py-2.5 pr-3 font-medium text-slate-800">{item.label}</td>
                      <td className="py-2.5 pr-3 text-slate-700">
                        {item.status === 'present' ? item.value : <span className="text-amber-700">未检测</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-slate-500">{item.referenceRange}</td>
                      <td className="py-2.5 pr-3 text-xs text-slate-500">
                        {item.dataSource ? SOURCE_LABEL[item.dataSource] : '—'}
                      </td>
                      <td className="py-2.5 text-xs text-slate-600">{item.retestCycle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
