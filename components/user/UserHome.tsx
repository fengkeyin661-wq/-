
import React, { useState } from 'react';
import { HealthProfile, DailyTask, HealthAssessment } from '../../types';

interface Props {
  profile: HealthProfile;
  assessment?: HealthAssessment;
}

export const UserHome: React.FC<Props> = ({ profile, assessment }) => {
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
  const riskColor = riskLevel === 'RED' ? 'bg-red-500' : riskLevel === 'YELLOW' ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="p-4 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800">早安，{profile.name}</h1>
          <p className="text-xs text-slate-500">今天也要保持健康好状态！</p>
        </div>
        <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200">
          <span className="text-lg">🪙</span>
          <span className="text-sm font-bold text-yellow-700">{points} 积分</span>
        </div>
      </div>

      {/* Health Score Card */}
      <div className="bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10"></div>
         <div className="relative z-10 flex justify-between items-center">
            <div>
               <div className="text-xs opacity-80 mb-1">健康风险评估</div>
               <div className="text-3xl font-bold flex items-center gap-2">
                 <span className={`w-3 h-3 rounded-full ${riskLevel === 'RED' ? 'bg-red-300' : riskLevel === 'YELLOW' ? 'bg-yellow-300' : 'bg-green-300'}`}></span>
                 {riskLevel === 'RED' ? '高风险' : riskLevel === 'YELLOW' ? '中风险' : '低风险'}
               </div>
               <p className="text-xs mt-2 opacity-90 max-w-[200px] truncate">
                  {assessment?.summary || '暂无评估数据'}
               </p>
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center text-xl font-bold bg-white/10 backdrop-blur-sm">
                85
            </div>
         </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2">
         {[
           { icon: '💊', label: '服药提醒', color: 'bg-blue-100 text-blue-600' },
           { icon: '🩺', label: '症状自查', color: 'bg-red-100 text-red-600' },
           { icon: '🥗', label: '饮食打卡', color: 'bg-green-100 text-green-600' },
           { icon: '💬', label: '咨询医生', color: 'bg-purple-100 text-purple-600' },
         ].map((action, i) => (
           <button key={i} className="flex flex-col items-center gap-2 p-2 active:scale-95 transition-transform">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${action.color}`}>
                {action.icon}
              </div>
              <span className="text-xs font-medium text-slate-600">{action.label}</span>
           </button>
         ))}
      </div>

      {/* Daily Tasks */}
      <div>
         <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-slate-800">今日健康任务</h2>
            <span className="text-xs text-slate-500">已完成 {tasks.filter(t => t.isCompleted).length}/{tasks.length}</span>
         </div>
         <div className="space-y-3">
            {tasks.map(task => (
               <div key={task.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg
                        ${task.type === 'measure' ? 'bg-blue-50 text-blue-500' : 
                          task.type === 'exercise' ? 'bg-orange-50 text-orange-500' : 
                          task.type === 'med' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}
                     `}>
                        {task.type === 'measure' ? '📏' : task.type === 'exercise' ? '🏃' : task.type === 'med' ? '💊' : '📖'}
                     </div>
                     <div>
                        <div className="font-bold text-slate-800 text-sm">{task.title}</div>
                        <div className="text-xs text-yellow-600 font-bold">+{task.points} 积分</div>
                     </div>
                  </div>
                  <button 
                    onClick={() => handleTaskComplete(task.id)}
                    disabled={task.isCompleted}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                       task.isCompleted ? 'bg-slate-100 text-slate-400' : 'bg-teal-600 text-white hover:bg-teal-700 shadow-md active:scale-95'
                    }`}
                  >
                     {task.isCompleted ? '已完成' : '打卡'}
                  </button>
               </div>
            ))}
         </div>
      </div>

      {/* Banner */}
      <div className="bg-indigo-600 rounded-xl p-4 text-white flex items-center justify-between shadow-lg">
          <div>
             <div className="font-bold mb-1">积分商城上新啦 🎁</div>
             <div className="text-xs opacity-80">用健康积分兑换体检优惠券</div>
          </div>
          <button className="bg-white text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold">去兑换</button>
      </div>
    </div>
  );
};
