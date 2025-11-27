import React from 'react';
import { HealthAssessment, RiskLevel } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  assessment: HealthAssessment;
  patientName?: string;
}

const COLORS = {
  [RiskLevel.GREEN]: '#22c55e', // green-500
  [RiskLevel.YELLOW]: '#eab308', // yellow-500
  [RiskLevel.RED]: '#ef4444', // red-500
};

export const AssessmentReport: React.FC<Props> = ({ assessment, patientName }) => {
  const riskColor = COLORS[assessment.riskLevel];
  
  // Dummy data for visual flair in the chart
  const riskData = [
    { name: '高风险', value: assessment.risks.red.length, color: COLORS[RiskLevel.RED] },
    { name: '中风险', value: assessment.risks.yellow.length, color: COLORS[RiskLevel.YELLOW] },
    { name: '低风险/正常', value: Math.max(1, 5 - assessment.risks.red.length - assessment.risks.yellow.length), color: COLORS[RiskLevel.GREEN] },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn print:space-y-4 print:animate-none">
      {/* Action Bar (Hidden in Print) */}
      <div className="flex justify-end no-print">
         <button 
            onClick={handlePrint}
            className="bg-teal-600 text-white px-5 py-2 rounded-lg hover:bg-teal-700 flex items-center gap-2 shadow-lg transition-colors font-medium"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            导出 / 打印报告
        </button>
      </div>

      {/* Formal Report Header (Visible only in Print) */}
      <div className="hidden print:block text-center border-b-2 border-slate-800 pb-4 mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-wider">职工健康管理中心</h1>
          <h2 className="text-xl font-medium text-slate-700 mt-2">个人健康风险评估报告</h2>
          <div className="flex justify-between mt-8 text-sm text-slate-600 px-4 font-mono">
               <div className="flex gap-8">
                   <span>受检人: <span className="font-bold text-slate-900 text-base border-b border-slate-400 px-2">{patientName || '___________'}</span></span>
                   <span>性别: <span className="font-bold text-slate-900 text-base border-b border-slate-400 px-2">______</span></span>
                   <span>年龄: <span className="font-bold text-slate-900 text-base border-b border-slate-400 px-2">______</span></span>
               </div>
               <div className="flex gap-8">
                   <span>档案编号: <span className="font-bold text-slate-900 text-base">{Math.floor(Math.random() * 900000) + 100000}</span></span>
                   <span>报告日期: <span className="font-bold text-slate-900 text-base">{new Date().toLocaleDateString()}</span></span>
               </div>
          </div>
      </div>

      {/* Main Status Card */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6 flex flex-col md:flex-row items-center gap-8 print:shadow-none print:border print:border-slate-300 break-inside-avoid">
        <div className="relative w-40 h-40 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={riskData}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {riskData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className="text-xs text-slate-400">综合评估</span>
            <span className="text-xl font-bold" style={{ color: riskColor }}>
              {assessment.riskLevel === 'RED' ? '高危' : assessment.riskLevel === 'YELLOW' ? '中危' : '低危'}
            </span>
          </div>
        </div>
        
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">健康评估摘要</h2>
          <p className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100 print:bg-white print:border-none print:p-0 print:text-justify">
            {assessment.summary}
          </p>
        </div>
      </div>

      {/* Traffic Light System */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:gap-4 break-inside-avoid">
        {/* Red Light */}
        <div className="bg-white rounded-xl shadow-md border-t-4 border-red-500 p-6 print:shadow-none print:border print:border-t-4 print:border-slate-200 print:border-t-red-500">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse print:animate-none"></div>
                <h3 className="font-bold text-lg text-slate-800">高风险 (红灯)</h3>
            </div>
            {assessment.risks.red.length > 0 ? (
                <ul className="space-y-2">
                    {assessment.risks.red.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-red-700 bg-red-50 p-2 rounded text-sm print:bg-white print:p-0 print:text-slate-700">
                            <span className="mt-1 font-bold text-red-600">⚠️</span> {item}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-slate-400 text-sm italic">未发现高风险因素</p>
            )}
        </div>

        {/* Yellow Light */}
        <div className="bg-white rounded-xl shadow-md border-t-4 border-yellow-500 p-6 print:shadow-none print:border print:border-t-4 print:border-slate-200 print:border-t-yellow-500">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                <h3 className="font-bold text-lg text-slate-800">中风险 (黄灯)</h3>
            </div>
            {assessment.risks.yellow.length > 0 ? (
                <ul className="space-y-2">
                    {assessment.risks.yellow.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-yellow-800 bg-yellow-50 p-2 rounded text-sm print:bg-white print:p-0 print:text-slate-700">
                            <span className="mt-1 font-bold text-yellow-600">⚡</span> {item}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-slate-400 text-sm italic">未发现中风险因素</p>
            )}
        </div>

         {/* Green Light */}
         <div className="bg-white rounded-xl shadow-md border-t-4 border-green-500 p-6 print:shadow-none print:border print:border-t-4 print:border-slate-200 print:border-t-green-500">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <h3 className="font-bold text-lg text-slate-800">低风险 (绿灯)</h3>
            </div>
            {assessment.risks.green.length > 0 ? (
                <ul className="space-y-2">
                    {assessment.risks.green.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-green-800 bg-green-50 p-2 rounded text-sm print:bg-white print:p-0 print:text-slate-700">
                            <span className="mt-1 font-bold text-green-600">✅</span> {item}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-slate-400 text-sm italic">无特别说明</p>
            )}
        </div>
      </div>

      {/* Management Plan */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden print:shadow-none print:border print:border-slate-300 break-inside-avoid">
        <div className="bg-slate-800 text-white px-6 py-4 print:bg-slate-100 print:text-slate-900 print:border-b print:border-slate-300">
            <h3 className="text-lg font-bold">个性化健康管理方案</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 print:divide-slate-300">
            {/* Diet */}
            <div className="p-6">
                <div className="flex items-center gap-2 mb-4 text-teal-600">
                    <span className="text-2xl">🥗</span>
                    <h4 className="font-bold">饮食建议</h4>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                    {assessment.managementPlan.dietary.map((plan, i) => (
                        <li key={i} className="flex gap-2">
                            <span className="text-teal-500 font-bold">•</span>
                            {plan}
                        </li>
                    ))}
                </ul>
            </div>
             {/* Exercise */}
             <div className="p-6">
                <div className="flex items-center gap-2 mb-4 text-blue-600">
                    <span className="text-2xl">🏃</span>
                    <h4 className="font-bold">运动处方</h4>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                    {assessment.managementPlan.exercise.map((plan, i) => (
                        <li key={i} className="flex gap-2">
                            <span className="text-blue-500 font-bold">•</span>
                            {plan}
                        </li>
                    ))}
                </ul>
            </div>
             {/* Medication */}
             <div className="p-6">
                <div className="flex items-center gap-2 mb-4 text-purple-600">
                    <span className="text-2xl">💊</span>
                    <h4 className="font-bold">规律用药</h4>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                    {assessment.managementPlan.medication.map((plan, i) => (
                        <li key={i} className="flex gap-2">
                            <span className="text-purple-500 font-bold">•</span>
                            {plan}
                        </li>
                    ))}
                </ul>
            </div>
             {/* Monitoring */}
             <div className="p-6">
                <div className="flex items-center gap-2 mb-4 text-orange-600">
                    <span className="text-2xl">📈</span>
                    <h4 className="font-bold">自我监测</h4>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                    {assessment.managementPlan.monitoring.map((plan, i) => (
                        <li key={i} className="flex gap-2">
                            <span className="text-orange-500 font-bold">•</span>
                            {plan}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
      </div>
      
      {/* Follow Up Plan Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col md:flex-row justify-between items-center text-blue-900 print:bg-white print:border print:border-slate-300 break-inside-avoid">
        <div className='mb-2 md:mb-0'>
            <span className="font-bold mr-2">📅 随访计划:</span>
            {assessment.followUpPlan.frequency}
        </div>
        <div>
            <span className="font-bold mr-2">🔎 下次重点:</span>
            <span className="text-sm">{assessment.followUpPlan.nextCheckItems.join(', ')}</span>
        </div>
      </div>

       {/* Formal Report Footer (Visible only in Print) */}
       <div className="hidden print:flex justify-between items-end mt-12 pt-8 border-t border-slate-300 break-inside-avoid">
            <div className="text-sm text-slate-500">
                <p className="font-bold text-slate-800">职工健康管理中心 • HealthGuard CN</p>
                <p>地址：中国 · 示范大学校医院</p>
                <p>电话：010-88888888</p>
            </div>
            <div className="text-right">
                <div className="mb-8">
                     <p className="font-bold text-slate-800 text-lg mb-2">主检医师签名:</p>
                     <div className="w-48 border-b-2 border-slate-800 h-8"></div>
                </div>
                <p className="text-sm text-slate-500">打印时间: {new Date().toLocaleString()}</p>
            </div>
       </div>
    </div>
  );
};