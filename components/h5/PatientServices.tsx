import React from 'react';
import { HealthArchive } from '../../services/dataService';

export const PatientServices: React.FC<{ archive: HealthArchive }> = ({ archive }) => {
  // Logic to determine recommended services based on risks
  const recommendations = [];
  const riskStr = JSON.stringify(archive.assessment_data).toLowerCase();
  
  // Rule-based recommendations
  if (riskStr.includes('血压') || riskStr.includes('心脏') || riskStr.includes('冠心病')) {
      recommendations.push({ dept: '心血管内科', service: '24小时动态血压监测', reason: '发现血压异常或心血管风险' });
  }
  if (riskStr.includes('血糖') || riskStr.includes('糖尿病')) {
      recommendations.push({ dept: '内分泌科', service: '胰岛功能测定', reason: '血糖代谢异常' });
  }
  if (riskStr.includes('肺结节') || riskStr.includes('磨玻璃')) {
      recommendations.push({ dept: '呼吸内科', service: '低剂量螺旋CT复查', reason: '肺部结节筛查' });
  }
  if (riskStr.includes('胃') || riskStr.includes('幽门') || riskStr.includes('肠')) {
      recommendations.push({ dept: '消化内科', service: 'C13呼气试验 / 胃肠镜', reason: '消化系统风险提示' });
  }
  
  // Default recommendation if no specific risks found or as a general item
  if (recommendations.length === 0) {
      recommendations.push({ dept: '健康管理中心', service: '年度常规体检套餐', reason: '定期健康监测' });
  } else {
      recommendations.push({ dept: '中医科', service: '体质辨识与调理', reason: '亚健康状态干预' });
  }

  return (
    <div className="p-6 min-h-full bg-slate-50 space-y-6 animate-fadeIn pb-24">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">医疗服务推荐</h2>
            <p className="text-sm text-slate-500 mt-1">基于您的健康画像智能匹配</p>
        </div>

        {/* AI Recommendation Cards */}
        <div className="space-y-4">
            {recommendations.map((rec, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-50 relative overflow-hidden group transition-all hover:shadow-md">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md mb-2 inline-block">
                                ✦ 智能导诊
                            </span>
                            <span className="text-4xl opacity-20">🏥</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mt-1">{rec.service}</h3>
                        <div className="text-sm text-slate-500 mb-3 font-medium">
                             {rec.dept}
                        </div>
                        <div className="text-xs text-indigo-600 mb-4 bg-indigo-50/50 p-2 rounded border border-indigo-100/50 flex items-start gap-1">
                            <span>💡</span> 推荐原因: {rec.reason}
                        </div>
                        <button className="w-full py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                            <span>📅</span> 立即预约
                        </button>
                    </div>
                </div>
            ))}
        </div>

        {/* Common Departments Grid */}
        <div>
            <h3 className="font-bold text-slate-700 mb-4 text-sm flex items-center gap-2">
                <span>⚡</span> 快速挂号
            </h3>
            <div className="grid grid-cols-4 gap-3">
                {[
                    {name:'内科', icon:'🩺'}, 
                    {name:'外科', icon:'🔪'}, 
                    {name:'妇科', icon:'🌸'}, 
                    {name:'眼科', icon:'👁️'}, 
                    {name:'口腔', icon:'🦷'}, 
                    {name:'耳鼻喉', icon:'👂'}, 
                    {name:'皮肤', icon:'✨'}, 
                    {name:'中医', icon:'🌿'}
                ].map(d => (
                    <button key={d.name} className="bg-white flex flex-col items-center justify-center p-3 rounded-xl shadow-sm border border-slate-100 active:scale-95 transition-colors hover:border-teal-200">
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-1 text-xl">{d.icon}</div>
                        <span className="text-xs font-medium text-slate-600">{d.name}</span>
                    </button>
                ))}
            </div>
        </div>
    </div>
  );
};