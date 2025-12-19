
import React, { useState } from 'react';
import { HealthProfile, DailyTask, HealthAssessment } from '../../types';

interface Props {
  profile: HealthProfile;
  assessment?: HealthAssessment;
  onOpenButler?: () => void;
}

export const UserHome: React.FC<Props> = ({ profile, assessment, onOpenButler }) => {
  const [points, setPoints] = useState(1240);
  const [tasks, setTasks] = useState<DailyTask[]>([
    { id: '1', title: '测量并记录晨起血压', type: 'measure', isCompleted: false, points: 50 },
    { id: '2', title: '午餐后步行 15 分钟', type: 'exercise', isCompleted: true, points: 30 },
    { id: '3', title: '按时服用降压药', type: 'med', isCompleted: false, points: 20 },
    { id: '4', title: '阅读一篇健康科普文章', type: 'diet', isCompleted: false, points: 10 },
  ]);

  const handleTaskComplete = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id && !t.isCompleted) {
        setPoints(p => p + t.points);
        return { ...t, isCompleted: true };
      }
      return t;
    }));
  };

  const riskLevel = assessment?.riskLevel || 'GREEN';

  return (
    <div className="p-4 space-y-6 animate-fadeIn pb-24">
      {/* Header */}
      <div className="flex justify-between items-center px-1">
        <div>
          <h1 className="text-xl font-bold text-slate-800">早安，{profile.name}</h1>
          <p className="text-xs text-slate-500">郑大智慧健康助手随时待命</p>
        </div>
        <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200 shadow-sm">
          <span className="text-lg">🪙</span>
          <span className="text-sm font-bold text-yellow-700">{points}</span>
        </div>
      </div>

      {/* AI Butler Entry - Floating Island Style */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
        <button 
          onClick={onOpenButler}
          className="relative w-full bg-slate-900 rounded-[2rem] p-6 text-white shadow-2xl flex items-center justify-between overflow-hidden active:scale-[0.98] transition-all"
        >
           <div className="absolute -right-4 -top-4 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>
           <div className="flex items-center gap-5 relative z-10">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-4xl shadow-inner animate-pulse-slow">
                  🤖
              </div>
              <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-xl tracking-tight">AI 健康管家</h3>
                    <span className="bg-blue-500 text-[9px] px-1.5 py-0.5 rounded-full font-black animate-bounce">PRO</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">智能分析档案 · 推送精准方案</p>
              </div>
           </div>
           <div className="bg-white/10 p-2.5 rounded-full backdrop-blur-md relative z-10 border border-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
           </div>
        </button>
      </div>

      {/* Health Risk Card */}
      <div className="bg-white rounded-3xl p-6 text-slate-800 shadow-sm border border-slate-100 relative overflow-hidden">
         <div className="flex justify-between items-center">
            <div>
               <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Current Status</div>
               <div className="text-2xl font-black flex items-center gap-2">
                 <span className={`w-3 h-3 rounded-full ${riskLevel === 'RED' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : riskLevel === 'YELLOW' ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                 {riskLevel === 'RED' ? '高风险' : riskLevel === 'YELLOW' ? '中风险' : '低风险'}
               </div>
               <p className="text-xs mt-2 text-slate-500 max-w-[220px] line-clamp-1">
                  {assessment?.summary || '请等待医生审核报告'}
               </p>
            </div>
            <div className="w-14 h-14 rounded-2xl border border-teal-100 flex flex-col items-center justify-center bg-teal-50 text-teal-600">
                <span className="text-xs font-bold">得分</span>
                <span className="text-xl font-black">88</span>
            </div>
         </div>
      </div>

      {/* Daily Tasks */}
      <div>
         <div className="flex justify-between items-center mb-4 px-1">
            <h2 className="font-bold text-slate-800 text-lg">健康打卡</h2>
            <span className="text-xs text-slate-400 font-medium">已完成 {tasks.filter(t => t.isCompleted).length}/{tasks.length}</span>
         </div>
         <div className="space-y-3">
            {tasks.map(task => (
               <div key={task.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-center justify-between group hover:border-teal-100 transition-colors">
                  <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform group-hover:scale-110
                        ${task.type === 'measure' ? 'bg-blue-50 text-blue-500' : 
                          task.type === 'exercise' ? 'bg-orange-50 text-orange-500' : 
                          task.type === 'med' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}
                     `}>
                        {task.type === 'measure' ? '📏' : task.type === 'exercise' ? '🏃' : task.type === 'med' ? '💊' : '📖'}
                     </div>
                     <div>
                        <div className="font-bold text-slate-800 text-sm">{task.title}</div>
                        <div className="text-[10px] text-yellow-600 font-black tracking-tighter">EARN +{task.points} POINTS</div>
                     </div>
                  </div>
                  <button 
                    onClick={() => handleTaskComplete(task.id)}
                    disabled={task.isCompleted}
                    className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${
                       task.isCompleted ? 'bg-slate-50 text-slate-300' : 'bg-teal-600 text-white shadow-lg shadow-teal-100 active:scale-90'
                    }`}
                  >
                     {task.isCompleted ? 'SUCCESS' : 'GO'}
                  </button>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
};
