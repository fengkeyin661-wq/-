
import React, { useState, useEffect } from 'react';
import { HealthAssessment, RiskLevel } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  assessment: HealthAssessment;
  patientName?: string;
  onSave?: (newAssessment: HealthAssessment) => void;
}

const COLORS = {
  [RiskLevel.GREEN]: '#22c55e',
  [RiskLevel.YELLOW]: '#eab308',
  [RiskLevel.RED]: '#ef4444',
};

export const AssessmentReport: React.FC<Props> = ({ assessment, patientName, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<HealthAssessment>(assessment);

  // Sync state when props change (e.g. switching patients)
  useEffect(() => {
      setEditData(assessment);
      setIsEditing(false);
  }, [assessment]);

  const riskColor = COLORS[editData.riskLevel];
  
  const riskData = [
    { name: '高风险', value: editData.risks.red.length, color: COLORS[RiskLevel.RED] },
    { name: '中风险', value: editData.risks.yellow.length, color: COLORS[RiskLevel.YELLOW] },
    { name: '正常', value: Math.max(1, 5 - editData.risks.red.length), color: COLORS[RiskLevel.GREEN] },
  ];

  const handlePrint = () => {
      setIsEditing(false);
      setTimeout(() => window.print(), 100);
  };

  const handleSave = () => {
      if (onSave) {
          onSave(editData);
          setIsEditing(false);
      }
  };

  const handleArrayChange = (
      section: 'risks' | 'managementPlan' | 'followUpPlan', 
      subKey: string, 
      text: string
  ) => {
      const array = text.split('\n').filter(item => item.trim() !== '');
      setEditData(prev => {
          if (section === 'risks') {
              return { ...prev, risks: { ...prev.risks, [subKey]: array } };
          } else if (section === 'managementPlan') {
              return { ...prev, managementPlan: { ...prev.managementPlan, [subKey]: array } };
          } else if (section === 'followUpPlan') {
               // Special handling for followUpPlan keys if needed, currently nextCheckItems is array
               if (subKey === 'nextCheckItems') {
                   return { ...prev, followUpPlan: { ...prev.followUpPlan, nextCheckItems: array } };
               }
          }
          return prev;
      });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      <div className="flex justify-end gap-3 no-print">
         {isEditing ? (
             <>
                <button onClick={() => setIsEditing(false)} className="px-5 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100">取消</button>
                <button onClick={handleSave} className="bg-teal-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-teal-700 shadow-lg">💾 保存修改</button>
             </>
         ) : (
             <>
                <button onClick={() => setIsEditing(true)} className="bg-white border border-teal-200 text-teal-700 px-5 py-2 rounded-lg font-medium hover:bg-teal-50 flex items-center gap-2">
                    ✏️ 医生修订
                </button>
                <button onClick={handlePrint} className="bg-slate-800 text-white px-5 py-2 rounded-lg font-medium hover:bg-slate-700 flex items-center gap-2">
                    🖨️ 打印报告
                </button>
             </>
         )}
      </div>

      <div className="hidden print:block text-center border-b-2 border-slate-800 pb-4 mb-8">
          <h1 className="text-3xl font-bold">健康风险评估报告</h1>
          <div className="mt-4 text-sm">受检人: <span className="font-bold text-lg">{patientName}</span></div>
      </div>

      {isEditing && (
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-4 text-sm text-yellow-800 flex items-center gap-2 animate-pulse">
              <span>⚠️ 编辑模式：您可以直接修改下方的文本内容，修改完成后请点击右上角“保存”。</span>
          </div>
      )}

      {/* Summary Section */}
      <div className="bg-white rounded-xl shadow p-6 flex flex-col md:flex-row items-start gap-8 print:shadow-none print:border">
        <div className="w-32 h-32 flex-shrink-0 mx-auto md:mx-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={riskData} innerRadius={40} outerRadius={60} dataKey="value">
                {riskData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 w-full">
          <div className="flex items-center gap-4 mb-3">
              <h2 className="text-xl font-bold">综合评估: </h2>
              {isEditing ? (
                  <select 
                    value={editData.riskLevel} 
                    onChange={e => setEditData({...editData, riskLevel: e.target.value as RiskLevel})}
                    className="border border-slate-300 rounded p-1 text-sm font-bold"
                  >
                      <option value={RiskLevel.GREEN}>低风险</option>
                      <option value={RiskLevel.YELLOW}>中风险</option>
                      <option value={RiskLevel.RED}>高风险</option>
                  </select>
              ) : (
                  <span className="text-xl font-bold" style={{ color: riskColor }}>
                    {editData.riskLevel === 'RED' ? '高风险' : editData.riskLevel === 'YELLOW' ? '中风险' : '低风险'}
                  </span>
              )}
          </div>
          
          {isEditing ? (
              <textarea 
                  className="w-full border border-slate-300 rounded p-2 text-sm text-slate-700 h-32 focus:ring-2 focus:ring-teal-500"
                  value={editData.summary}
                  onChange={e => setEditData({...editData, summary: e.target.value})}
              />
          ) : (
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{editData.summary}</p>
          )}
        </div>
      </div>

      {/* Risk Factors Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-red-50 p-4 rounded border-l-4 border-red-500">
             <h3 className="font-bold text-red-700 mb-2">🔴 高危因素</h3>
             {isEditing ? (
                 <textarea 
                     className="w-full bg-white border border-red-200 rounded p-2 text-sm h-32"
                     value={editData.risks.red.join('\n')}
                     onChange={e => handleArrayChange('risks', 'red', e.target.value)}
                     placeholder="每行输入一个风险点"
                 />
             ) : (
                 <ul className="list-disc pl-5 text-sm text-red-800 space-y-1">
                     {editData.risks.red.length > 0 ? editData.risks.red.map((r,i)=><li key={i}>{r}</li>) : <li>无明显高危因素</li>}
                 </ul>
             )}
          </div>
          <div className="bg-yellow-50 p-4 rounded border-l-4 border-yellow-500">
             <h3 className="font-bold text-yellow-700 mb-2">🟡 中危因素</h3>
             {isEditing ? (
                 <textarea 
                     className="w-full bg-white border border-yellow-200 rounded p-2 text-sm h-32"
                     value={editData.risks.yellow.join('\n')}
                     onChange={e => handleArrayChange('risks', 'yellow', e.target.value)}
                     placeholder="每行输入一个风险点"
                 />
             ) : (
                 <ul className="list-disc pl-5 text-sm text-yellow-800 space-y-1">
                     {editData.risks.yellow.length > 0 ? editData.risks.yellow.map((r,i)=><li key={i}>{r}</li>) : <li>无明显中危因素</li>}
                 </ul>
             )}
          </div>
      </div>

      {/* Management Plan Section */}
      <div className="bg-white p-6 rounded shadow border print:shadow-none">
          <h3 className="font-bold text-lg mb-4 bg-slate-800 text-white p-2 rounded print:text-black print:bg-transparent print:border-b">健康管理方案</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
             <div className="space-y-4">
                 <PlanSection 
                    title="🥗 饮食干预" color="teal" 
                    isEditing={isEditing} 
                    items={editData.managementPlan.dietary}
                    onChange={(val) => handleArrayChange('managementPlan', 'dietary', val)}
                 />
                 <PlanSection 
                    title="🏃 运动方案" color="teal" 
                    isEditing={isEditing} 
                    items={editData.managementPlan.exercise}
                    onChange={(val) => handleArrayChange('managementPlan', 'exercise', val)}
                 />
             </div>
             <div className="space-y-4">
                 <PlanSection 
                    title="💊 医疗建议" color="blue" 
                    isEditing={isEditing} 
                    items={editData.managementPlan.medication}
                    onChange={(val) => handleArrayChange('managementPlan', 'medication', val)}
                 />
                 <PlanSection 
                    title="🔍 监测与随访" color="blue" 
                    isEditing={isEditing} 
                    items={editData.managementPlan.monitoring}
                    onChange={(val) => handleArrayChange('managementPlan', 'monitoring', val)}
                 />
             </div>
          </div>
      </div>
      
      {/* Follow-up Plan Section */}
      <div className="bg-blue-50 p-6 rounded border border-blue-200 print:bg-transparent print:border-slate-300">
          <h3 className="font-bold text-blue-800 mb-2">📅 随访计划建议</h3>
          <div className="mb-2 flex items-center gap-2">
             <span className="text-sm text-blue-900 font-bold">建议频率:</span>
             {isEditing ? (
                 <input 
                    type="text" 
                    className="border border-blue-300 rounded px-2 py-1 text-sm w-48"
                    value={editData.followUpPlan.frequency}
                    onChange={e => setEditData({...editData, followUpPlan: {...editData.followUpPlan, frequency: e.target.value}})}
                 />
             ) : (
                 <span className="text-sm text-blue-900">{editData.followUpPlan.frequency}</span>
             )}
          </div>
          
          <div className="text-sm text-blue-900">
              <div className="font-bold mb-1">重点复查项目:</div>
              {isEditing ? (
                  <textarea 
                     className="w-full border border-blue-300 rounded p-2 text-sm h-20"
                     value={editData.followUpPlan.nextCheckItems.join('\n')}
                     onChange={e => handleArrayChange('followUpPlan', 'nextCheckItems', e.target.value)}
                     placeholder="每行输入一个复查项目"
                  />
              ) : (
                  <div>{editData.followUpPlan.nextCheckItems.join('、')}</div>
              )}
          </div>
      </div>

      {/* Signature for Print */}
      <div className="hidden print:flex justify-between mt-12 pt-8 border-t border-slate-300">
          <div>医生签名: _________________</div>
          <div>日期: {new Date().toLocaleDateString()}</div>
      </div>
    </div>
  );
};

// Helper Component for Plan Sections
const PlanSection: React.FC<{
    title: string; 
    color: string; 
    isEditing: boolean; 
    items: string[]; 
    onChange: (val: string) => void;
}> = ({ title, color, isEditing, items, onChange }) => (
    <div>
        <h4 className={`font-bold text-${color}-600 border-b border-${color}-100 pb-1 mb-2`}>{title}</h4>
        {isEditing ? (
            <textarea 
                className={`w-full border border-${color}-200 rounded p-2 text-sm h-32 focus:ring-1 focus:ring-${color}-500`}
                value={items.join('\n')}
                onChange={e => onChange(e.target.value)}
                placeholder="每行一条建议"
            />
        ) : (
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
                {items.map((x,i)=><li key={i}>{x}</li>)}
            </ul>
        )}
    </div>
);
