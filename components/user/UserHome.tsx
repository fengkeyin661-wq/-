import React, { useState } from 'react';
import { HealthProfile, HealthAssessment, HealthRecord } from '../../types';

interface Props {
  profile: HealthProfile;
  assessment?: HealthAssessment;
  record?: HealthRecord;
  onNavigate: (tab: string) => void;
}

export const UserHome: React.FC<Props> = ({ profile, assessment, record, onNavigate }) => {
  const abnormalities = record?.checkup?.abnormalities || [];
  const riskLevel = assessment?.riskLevel || 'GREEN';

  return (
    <div className="p-4 space-y-6 animate-fadeIn pb-32">
      {/* 状态栏 */}
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-3">
           <div className="w-12 h-12 bg-teal-600 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-teal-100 text-xl border-2 border-white">
             {profile.name.charAt(0)}
           </div>
           <div>
             <h1 className="text-lg font-bold text-slate-800 tracking-tight">您好, {profile.name}老师</h1>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">郑州大学医院健康管理</p>
           </div>
        </div>
        <div className="bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm flex items-center gap-1.5">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-[10px] font-bold text-slate-500">管家在线</span>
        </div>
      </div>

      {/* AI 健康管家 - 动态终端风格 */}
      <div 
        onClick={() => onNavigate('butler')}
        className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl relative overflow-hidden group cursor-pointer active:scale-95 transition-all"
      >
         {/* 背景流光动画 */}
         <div className="absolute inset-0 bg-gradient-to-br from-teal-600/20 to-transparent opacity-50"></div>
         <div className="absolute -top-10 -right-10 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>

         <div className="relative z-10 flex gap-5 items-center">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-[2rem] flex items-center justify-center text-5xl shadow-inner border border-white/20 relative overflow-hidden">
               <span className="animate-float">🤖</span>
               <div className="absolute inset-0 bg-gradient-to-t from-teal-500/20 to-transparent"></div>
            </div>
            <div className="flex-1">
               <div className="text-[10px] font-black text-teal-400 uppercase tracking-tighter mb-1">AI Health Butler</div>
               <h2 className="text-2xl font-black tracking-tight mb-1">智能咨询终端</h2>
               <p className="text-xs text-slate-400 leading-relaxed">
                  {abnormalities.length > 0 
                    ? `发现 ${abnormalities.length} 项关键异常，立即获取改善方案` 
                    : "您的健康档案已更新，点击进入深度咨询"}
               </p>
            </div>
         </div>
         <div className="mt-6 flex items-center justify-between bg-white/5 rounded-2xl p-3 border border-white/5">
             <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300">有问题随时问我</span>
             </div>
             <span className="text-teal-400 text-sm">●●●</span>
         </div>
      </div>

      {/* 风险雷达概览 */}
      <section className="space-y-4">
         <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-4">
               <div>
                  <h3 className="text-lg font-black text-slate-800">健康风险评估</h3>
                  <div className={`mt-1 inline-block px-2 py-0.5 rounded-lg text-[10px] font-black ${
                    riskLevel === 'RED' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                  }`}>
                    {riskLevel === 'RED' ? '需要临床干预' : '整体状况良好'}
                  </div>
               </div>
               <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-inner border-4 ${
                  riskLevel === 'RED' ? 'border-red-50 text-red-500' : 'border-green-50 text-green-500'
               }`}>
                  {riskLevel === 'RED' ? '!' : '✓'}
               </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed italic line-clamp-2 bg-slate-50 p-3 rounded-2xl">
               "{assessment?.summary || '暂无详细评估数据，建议完善健康问卷。'}"
            </p>
         </div>
      </section>

      {/* 待办异常追踪 */}
      {abnormalities.length > 0 && (
        <section className="space-y-4">
           <h3 className="font-black text-slate-800 flex items-center gap-2 px-2">
              体检异常点追踪 <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full">{abnormalities.length}</span>
           </h3>
           <div className="grid grid-cols-1 gap-3">
              {abnormalities.slice(0, 2).map((item, idx) => (
                <div key={idx} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                   <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center text-lg">⚠️</div>
                   <div className="flex-1">
                      <div className="font-bold text-slate-800 text-sm">{item.item}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{item.result}</div>
                   </div>
                   <button onClick={() => onNavigate('butler')} className="text-[10px] font-black text-teal-600 bg-teal-50 px-3 py-2 rounded-xl">问管家</button>
                </div>
              ))}
           </div>
        </section>
      )}

      {/* 底部功能区 */}
      <div className="grid grid-cols-4 gap-4">
         {[
           { icon: '🍔', label: '膳食记录', tab: 'diet_motion' },
           { icon: '📅', label: '我的随访', tab: 'profile' },
           { icon: '🏥', label: '医疗服务', tab: 'medical' },
           { icon: '👥', label: '健康社区', tab: 'community' },
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
    </div>
  );
};
