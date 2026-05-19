
import React from 'react';
import { HealthRecord, HealthAssessment, RiskAnalysisData } from '../../types';
import { HealthTrendCharts } from '../HealthTrendCharts';

interface Props {
  record: HealthRecord;
  assessment?: HealthAssessment;
  riskAnalysis?: RiskAnalysisData;
  checkupId: string;
}

export const UserHealth: React.FC<Props> = ({ record, assessment, riskAnalysis, checkupId }) => {
  return (
    <div className="p-4 space-y-6 animate-fadeIn bg-slate-50 min-h-full">
      <h1 className="text-xl font-bold text-slate-800">我的健康档案</h1>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4">基础指标</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-slate-400 mb-1">BMI</div>
            <div className="text-lg font-black text-slate-800">{record.checkup.basics.bmi || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">血压</div>
            <div className="text-lg font-black text-slate-800">
              {record.checkup.basics.sbp}/{record.checkup.basics.dbp}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">空腹血糖</div>
            <div className="text-lg font-black text-slate-800">
              {record.checkup.labBasic.glucose?.fasting || '-'}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <HealthTrendCharts checkupId={checkupId} variant="dashboard" />
      </div>

      {riskAnalysis && (
        <div>
          <h3 className="font-bold text-slate-800 mb-3">系统健康画像</h3>
          <div className="space-y-3">
            {riskAnalysis.portraits.map((p, i) => (
              <div
                key={i}
                className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{p.icon}</div>
                  <div>
                    <div className="font-bold text-sm">{p.systemName}</div>
                    <div className="text-xs text-slate-400 max-w-[150px] truncate">
                      {p.keyFindings[0] || '无明显异常'}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded font-bold ${
                    p.status === 'High'
                      ? 'bg-red-100 text-red-600'
                      : p.status === 'Medium'
                      ? 'bg-yellow-100 text-yellow-600'
                      : 'bg-green-100 text-green-600'
                  }`}
                >
                  {p.status === 'High' ? '关注' : p.status === 'Medium' ? '预警' : '健康'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 pb-20">
        <h3 className="font-bold text-slate-700 mb-3">我的健康管理方案</h3>
        <div className="space-y-4">
          <div className="bg-teal-50 p-3 rounded-lg border border-teal-100">
            <div className="font-bold text-teal-800 text-sm mb-2">饮食建议</div>
            <ul className="text-xs text-teal-700 space-y-1 list-disc pl-4">
              {assessment?.managementPlan.dietary.slice(0, 3).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
            <div className="font-bold text-orange-800 text-sm mb-2">运动建议</div>
            <ul className="text-xs text-orange-700 space-y-1 list-disc pl-4">
              {assessment?.managementPlan.exercise.slice(0, 3).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
