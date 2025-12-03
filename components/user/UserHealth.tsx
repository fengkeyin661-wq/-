
import React from 'react';
import { HealthRecord, HealthAssessment, RiskAnalysisData } from '../../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  record: HealthRecord;
  assessment?: HealthAssessment;
  riskAnalysis?: RiskAnalysisData;
}

export const UserHealth: React.FC<Props> = ({ record, assessment, riskAnalysis }) => {
  // Mock Data for Trend
  const bpData = [
    { date: '1月', sbp: 135, dbp: 85 },
    { date: '2月', sbp: 132, dbp: 82 },
    { date: '3月', sbp: 128, dbp: 80 },
    { date: '4月', sbp: 130, dbp: 84 },
    { date: '5月', sbp: 125, dbp: 78 },
  ];

  return (
    <div className="p-4 space-y-6 animate-fadeIn bg-slate-50 min-h-full">
      <h1 className="text-xl font-bold text-slate-800">我的健康档案</h1>

      {/* Basic Info Card */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
         <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-700">基础指标</h3>
            <button className="text-xs text-teal-600 font-bold bg-teal-50 px-2 py-1 rounded">更新数据</button>
         </div>
         <div className="grid grid-cols-3 gap-4 text-center">
             <div>
                <div className="text-xs text-slate-400 mb-1">BMI</div>
                <div className="text-lg font-black text-slate-800">{record.checkup.basics.bmi || '-'}</div>
                <div className="text-[10px] text-green-500 bg-green-50 inline-block px-1 rounded">正常</div>
             </div>
             <div>
                <div className="text-xs text-slate-400 mb-1">血压</div>
                <div className="text-lg font-black text-slate-800">
                    {record.checkup.basics.sbp}/{record.checkup.basics.dbp}
                </div>
                <div className="text-[10px] text-yellow-600 bg-yellow-50 inline-block px-1 rounded">偏高</div>
             </div>
             <div>
                <div className="text-xs text-slate-400 mb-1">空腹血糖</div>
                <div className="text-lg font-black text-slate-800">
                    {record.checkup.labBasic.glucose?.fasting || '-'}
                </div>
                <div className="text-[10px] text-green-500 bg-green-50 inline-block px-1 rounded">正常</div>
             </div>
         </div>
      </div>

      {/* Trend Chart */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
         <h3 className="font-bold text-slate-700 mb-4">血压趋势</h3>
         <div className="h-48 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bpData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} domain={['dataMin - 10', 'dataMax + 10']} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                    <Line type="monotone" dataKey="sbp" stroke="#ef4444" strokeWidth={2} dot={{r:3}} />
                    <Line type="monotone" dataKey="dbp" stroke="#f97316" strokeWidth={2} dot={{r:3}} />
                </LineChart>
             </ResponsiveContainer>
         </div>
      </div>

      {/* Risk Portrait Summary */}
      {riskAnalysis && (
          <div>
              <h3 className="font-bold text-slate-800 mb-3">系统健康画像</h3>
              <div className="space-y-3">
                  {riskAnalysis.portraits.map((p, i) => (
                      <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm">
                          <div className="flex items-center gap-3">
                              <div className="text-2xl">{p.icon}</div>
                              <div>
                                  <div className="font-bold text-sm">{p.systemName}</div>
                                  <div className="text-xs text-slate-400 max-w-[150px] truncate">{p.keyFindings[0] || '无明显异常'}</div>
                              </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded font-bold ${
                              p.status === 'High' ? 'bg-red-100 text-red-600' : 
                              p.status === 'Medium' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'
                          }`}>
                              {p.status === 'High' ? '关注' : p.status === 'Medium' ? '预警' : '健康'}
                          </span>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Management Plan */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 pb-20">
          <h3 className="font-bold text-slate-700 mb-3">我的健康管理方案</h3>
          <div className="space-y-4">
              <div className="bg-teal-50 p-3 rounded-lg border border-teal-100">
                  <div className="font-bold text-teal-800 text-sm mb-2">🥗 饮食建议</div>
                  <ul className="text-xs text-teal-700 space-y-1 list-disc pl-4">
                      {assessment?.managementPlan.dietary.slice(0, 3).map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                  <div className="font-bold text-orange-800 text-sm mb-2">🏃 运动建议</div>
                  <ul className="text-xs text-orange-700 space-y-1 list-disc pl-4">
                      {assessment?.managementPlan.exercise.slice(0, 3).map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
              </div>
          </div>
      </div>
    </div>
  );
};
