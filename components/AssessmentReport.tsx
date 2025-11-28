
import React from 'react';
import { HealthAssessment, RiskLevel } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  assessment: HealthAssessment;
  patientName?: string;
}

const COLORS = {
  [RiskLevel.GREEN]: '#22c55e',
  [RiskLevel.YELLOW]: '#eab308',
  [RiskLevel.RED]: '#ef4444',
};

export const AssessmentReport: React.FC<Props> = ({ assessment, patientName }) => {
  const riskColor = COLORS[assessment.riskLevel];
  
  const riskData = [
    { name: '高风险', value: assessment.risks.red.length, color: COLORS[RiskLevel.RED] },
    { name: '中风险', value: assessment.risks.yellow.length, color: COLORS[RiskLevel.YELLOW] },
    { name: '正常', value: Math.max(1, 5 - assessment.risks.red.length), color: COLORS[RiskLevel.GREEN] },
  ];

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-end no-print">
         <button onClick={handlePrint} className="bg-teal-600 text-white px-5 py-2 rounded-lg font-medium">打印报告</button>
      </div>

      <div className="hidden print:block text-center border-b-2 border-slate-800 pb-4 mb-8">
          <h1 className="text-3xl font-bold">健康风险评估报告</h1>
          <div className="mt-4 text-sm">受检人: <span className="font-bold text-lg">{patientName}</span></div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 flex items-center gap-8 print:shadow-none print:border">
        <div className="w-32 h-32 flex-shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={riskData} innerRadius={40} outerRadius={60} dataKey="value">
                {riskData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">综合评估: <span style={{ color: riskColor }}>{assessment.riskLevel === 'RED' ? '高风险' : assessment.riskLevel === 'YELLOW' ? '中风险' : '低风险'}</span></h2>
          <p className="text-slate-600 text-sm leading-relaxed">{assessment.summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-red-50 p-4 rounded border-l-4 border-red-500">
             <h3 className="font-bold text-red-700 mb-2">🔴 高危因素</h3>
             <ul className="list-disc pl-5 text-sm text-red-800 space-y-1">
                 {assessment.risks.red.length > 0 ? assessment.risks.red.map((r,i)=><li key={i}>{r}</li>) : <li>无明显高危因素</li>}
             </ul>
          </div>
          <div className="bg-yellow-50 p-4 rounded border-l-4 border-yellow-500">
             <h3 className="font-bold text-yellow-700 mb-2">🟡 中危因素</h3>
             <ul className="list-disc pl-5 text-sm text-yellow-800 space-y-1">
                 {assessment.risks.yellow.length > 0 ? assessment.risks.yellow.map((r,i)=><li key={i}>{r}</li>) : <li>无明显中危因素</li>}
             </ul>
          </div>
      </div>

      <div className="bg-white p-6 rounded shadow border print:shadow-none">
          <h3 className="font-bold text-lg mb-4 bg-slate-800 text-white p-2 rounded print:text-black print:bg-transparent print:border-b">健康管理方案</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
             <div className="space-y-4">
                 <div>
                    <h4 className="font-bold text-teal-600 border-b border-teal-100 pb-1 mb-2">🥗 饮食干预</h4>
                    <ul className="list-disc pl-5 space-y-1 text-slate-700">{assessment.managementPlan.dietary.map((x,i)=><li key={i}>{x}</li>)}</ul>
                 </div>
                 <div>
                    <h4 className="font-bold text-teal-600 border-b border-teal-100 pb-1 mb-2">🏃 运动方案</h4>
                    <ul className="list-disc pl-5 space-y-1 text-slate-700">{assessment.managementPlan.exercise.map((x,i)=><li key={i}>{x}</li>)}</ul>
                 </div>
             </div>
             <div className="space-y-4">
                 <div>
                    <h4 className="font-bold text-blue-600 border-b border-blue-100 pb-1 mb-2">💊 医疗建议</h4>
                    <ul className="list-disc pl-5 space-y-1 text-slate-700">{assessment.managementPlan.medication.map((x,i)=><li key={i}>{x}</li>)}</ul>
                 </div>
                 <div>
                    <h4 className="font-bold text-blue-600 border-b border-blue-100 pb-1 mb-2">🔍 监测与随访</h4>
                    <ul className="list-disc pl-5 space-y-1 text-slate-700">{assessment.managementPlan.monitoring.map((x,i)=><li key={i}>{x}</li>)}</ul>
                 </div>
             </div>
          </div>
      </div>
      
      {assessment.followUpPlan && (
          <div className="bg-blue-50 p-6 rounded border border-blue-200 print:bg-transparent print:border-slate-300">
              <h3 className="font-bold text-blue-800 mb-2">📅 随访计划</h3>
              <p className="text-sm text-blue-900 mb-2">建议频率: <span className="font-bold">{assessment.followUpPlan.frequency}</span></p>
              <div className="text-sm text-blue-900">
                  <span className="font-bold">重点复查项目: </span>
                  {assessment.followUpPlan.nextCheckItems.join('、')}
              </div>
          </div>
      )}

      {/* Signature for Print */}
      <div className="hidden print:flex justify-between mt-12 pt-8 border-t border-slate-300">
          <div>医生签名: _________________</div>
          <div>日期: {new Date().toLocaleDateString()}</div>
      </div>
    </div>
  );
};
