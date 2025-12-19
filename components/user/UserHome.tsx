import React, { useState } from 'react';
import { HealthProfile, HealthAssessment, HealthRecord } from '../../types';

interface Props {
  profile: HealthProfile;
  assessment?: HealthAssessment;
  record?: HealthRecord;
  onNavigate: (tab: string) => void;
}

export const UserHome: React.FC<Props> = ({ profile, assessment, record, onNavigate }) => {
  const [points] = useState(1240);

  // 提取体检报告中的异常项，用于提醒
  const abnormalities = record?.checkup?.abnormalities || [];
  const riskLevel = assessment?.riskLevel || 'GREEN';

  return (
    <div className="p-4 space-y-6 animate-fadeIn pb-32">
      {/* 状态栏 */}
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-3">
           <div className="w-12 h-12 bg-teal-600 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-teal-100 text-xl">
             {profile.name.charAt(0)}
           </div>
           <div>
             <h1 className="text-lg font-bold text-slate-800 tracking-tight">您好, {profile.name}老师</h1>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Employee Health Center</p>
           </div>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
          <span className="text-lg">🪙</span>
          <span className="text-sm font-black text-slate-700">{points}</span>
        </div>
      </div>

      {/* AI 健康管家 - 核心引导入口 */}
      <div 
        onClick={() => onNavigate('butler')}
        className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl relative overflow-hidden group cursor-pointer active:scale-95 transition-all"
      >
         <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-500"></div>
         <div className="relative z-10 flex gap-5 items-center">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center text-5xl shadow-inner border border-white/20">
               🤖
            </div>
            <div className="flex-1">
               <h2 className="text-2xl font-black tracking-tight mb-1">AI 诊后管家</h2>
               <p className="text-xs text-slate-300 leading-relaxed font-medium">针对您的体检指标，<br/>为您解读并制定改善计划。</p>
               <div className="mt-3 flex items-center gap-2 text-teal-400 text-xs font-black group-hover:translate-x-1 transition-transform">
                  进入管理会话 <span className="text-lg">→</span>
               </div>
            </div>
         </div>
      </div>

      {/* 体检发现：异常项追踪（解决用户痛点：发现问题没处问） */}
      {abnormalities.length > 0 && (
        <section className="space-y-4 animate-slideUp">
           <div className="flex justify-between items-center px-2">
              <h3 className="font-black text-slate-800 flex items-center gap-2">
                 发现健康风险 <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{abnormalities.length} 项</span>
              </h3>
              <button onClick={() => onNavigate('butler')} className="text-xs text-teal-600 font-bold">查看对策</button>
           </div>
           
           <div className="grid grid-cols-1 gap-3">
              {abnormalities.slice(0, 3).map((item, idx) => (
                <div key={idx} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                   <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center text-lg">⚠️</div>
                   <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-sm truncate">{item.item}</div>
                      <div className="text-[10px] text-slate-400 font-medium truncate">{item.result}</div>
                   </div>
                   <div className={`px-2 py-1 rounded-lg text-[9px] font-black ${idx === 0 ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'}`}>
                      {idx === 0 ? '待解决' : '需观察'}
                   </div>
                </div>
              ))}
              {abnormalities.length > 3 && (
                  <p className="text-center text-[10px] text-slate-400 font-medium">还有 {(abnormalities.length - 3)} 项异常，进入管家查看完整清单</p>
              )}
           </div>
        </section>
      )}

      {/* 风险概览卡片 */}
      <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex flex-col gap-5">
         <div className="flex justify-between items-center">
            <div>
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Overview</div>
               <h3 className="text-xl font-black text-slate-800">
                {riskLevel === 'RED' ? '高风险预警' : riskLevel === 'YELLOW' ? '中风险关注' : '低风险良好'}
               </h3>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black shadow-lg ${
                riskLevel === 'RED' ? 'bg-rose-500 shadow-rose-100' : riskLevel === 'YELLOW' ? 'bg-orange-400 shadow-orange-100' : 'bg-teal-500 shadow-teal-100'
            }`}>
                {riskLevel === 'RED' ? '!' : riskLevel === 'YELLOW' ? '!' : '✓'}
            </div>
         </div>
         <p className="text-xs text-slate-500 leading-relaxed italic border-l-2 border-slate-100 pl-4 py-1">
            "{assessment?.summary || '暂无详细评估数据，建议联系中心完成问卷。'}"
         </p>
      </div>

      {/* 快捷操作 */}
      <div className="grid grid-cols-4 gap-4">
         {[
           { icon: '📅', label: '我的随访', tab: 'profile' },
           { icon: '🍔', label: '膳食记录', tab: 'diet_motion' },
           { icon: '🏥', label: '签约医生', tab: 'medical' },
           { icon: '💬', label: '问诊记录', tab: 'interaction' },
         ].map((action, i) => (
           <button 
             key={i} 
             onClick={() => onNavigate(action.tab)}
             className="flex flex-col items-center gap-2 active:scale-90 transition-transform"
           >
              <div className="w-14 h-14 bg-white rounded-3xl flex items-center justify-center text-2xl shadow-sm border border-slate-50">
                {action.icon}
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{action.label}</span>
           </button>
         ))}
      </div>

      <div className="h-10"></div>
    </div>
  );
};