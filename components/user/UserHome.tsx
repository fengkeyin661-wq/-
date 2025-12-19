import React, { useState } from 'react';
import { HealthProfile, DailyTask, HealthAssessment } from '../../types';

interface Props {
  profile: HealthProfile;
  assessment?: HealthAssessment;
  onNavigate: (tab: string) => void; // Added for internal jump
}

export const UserHome: React.FC<Props> = ({ profile, assessment, onNavigate }) => {
  const [points, setPoints] = useState(1240);

  const riskLevel = assessment?.riskLevel || 'GREEN';

  return (
    <div className="p-4 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold shadow-md">
             {profile.name.charAt(0)}
           </div>
           <div>
             <h1 className="text-lg font-bold text-slate-800">你好，{profile.name}</h1>
             <p className="text-[10px] text-slate-500 font-medium">今天也要保持健康好状态！</p>
           </div>
        </div>
        <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200 shadow-sm active:scale-95 transition-transform cursor-pointer">
          <span className="text-lg">🪙</span>
          <span className="text-sm font-bold text-yellow-700">{points}</span>
        </div>
      </div>

      {/* AI Health Butler Entry Card (New Hero) */}
      <div 
        onClick={() => onNavigate('butler')}
        className="bg-white rounded-[2rem] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-slate-100 relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all"
      >
         <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-500"></div>
         <div className="relative z-10 flex gap-4">
            <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center text-4xl shadow-lg shadow-teal-100 group-hover:rotate-6 transition-transform">
               🤖
            </div>
            <div className="flex-1">
               <h2 className="text-xl font-black text-slate-800 tracking-tight">AI 健康管家</h2>
               <p className="text-xs text-slate-500 mt-1 leading-relaxed">您的专属 7*24h 私人助手，<br/>基于档案为您提供个性化建议。</p>
               <div className="mt-3 flex items-center gap-1 text-teal-600 text-xs font-bold">
                  立即咨询 <span className="text-lg">→</span>
               </div>
            </div>
         </div>
      </div>

      {/* Health Score Card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-20 -mt-20"></div>
         <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
               <div>
                  <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Health Assessment</div>
                  <div className="text-2xl font-black flex items-center gap-2">
                    {riskLevel === 'RED' ? '高风险预警' : riskLevel === 'YELLOW' ? '中风险关注' : '低风险良好'}
                  </div>
               </div>
               <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/10">
                  郑大医院权威评估
               </div>
            </div>
            
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
               <p className="text-xs text-slate-300 leading-relaxed italic line-clamp-2">
                  "{assessment?.summary || '暂无详细评估数据，请联系中心进行体检。'}"
               </p>
            </div>
         </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-4 gap-4">
         {[
           { icon: '💊', label: '服药提醒', color: 'bg-rose-50 text-rose-500' },
           { icon: '📅', label: '随访记录', color: 'bg-blue-50 text-blue-500', tab: 'profile' },
           { icon: '🥗', label: '饮食分析', color: 'bg-green-50 text-green-500', tab: 'diet_motion' },
           { icon: '💬', label: '咨询医生', color: 'bg-indigo-50 text-indigo-500', tab: 'interaction' },
         ].map((action, i) => (
           <button 
             key={i} 
             onClick={() => action.tab && onNavigate(action.tab)}
             className="flex flex-col items-center gap-2 active:scale-90 transition-transform"
           >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${action.color}`}>
                {action.icon}
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{action.label}</span>
           </button>
         ))}
      </div>

      {/* Interactive Banner */}
      <div className="bg-orange-500 rounded-[2rem] p-6 text-white flex items-center justify-between shadow-lg shadow-orange-100 relative overflow-hidden group">
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10">
             <div className="font-black text-lg mb-1 italic">积分商城上新 🎁</div>
             <div className="text-[10px] opacity-80 font-medium">用健康积分，换专业体检深度套餐</div>
          </div>
          <button className="bg-white text-orange-600 px-4 py-2 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-transform">去发现</button>
      </div>

      <div className="h-10"></div>
    </div>
  );
};