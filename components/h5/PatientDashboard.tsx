
import React, { useState } from 'react';
import { HealthArchive } from '../../services/dataService';
import { RiskLevel } from '../../types';

interface Props {
    archive: HealthArchive;
    onViewReport: () => void;
}

export const PatientDashboard: React.FC<Props> = ({ archive, onViewReport }) => {
    // Mock Tasks (Livongo style)
    const [tasks, setTasks] = useState(() => [
        { txt: '记录血压', done: false, icon: '🩺' },
        { txt: '服药打卡', done: false, icon: '💊' },
        { txt: '阅读: 高血压饮食指南', done: false, icon: '📖' }
    ]);

    const toggleTask = (index: number) => {
        const newTasks = [...tasks];
        newTasks[index].done = !newTasks[index].done;
        setTasks(newTasks);
    };

    const completedCount = tasks.filter(t => t.done).length;
    const progress = (completedCount / tasks.length) * 100;

    return (
        <div className="bg-slate-50 min-h-full pb-10">
            {/* Hero Section */}
            <div className="bg-slate-900 text-white rounded-b-[2rem] p-6 pb-12 relative overflow-hidden shadow-2xl">
                {/* Decorative Circles */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500 rounded-full blur-[80px] opacity-20 -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500 rounded-full blur-[60px] opacity-20 -ml-10 -mb-10"></div>
                
                <div className="relative z-10 flex justify-between items-start mb-6">
                    <div>
                        <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Health Overview</div>
                        <h1 className="text-2xl font-bold">你好，{archive.name}</h1>
                    </div>
                    <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center bg-white/10 backdrop-blur-md">
                        {archive.gender === '女' ? '👩🏻' : '👨🏻'}
                    </div>
                </div>

                {/* Risk Card (Apple Health Style) */}
                <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-300 mb-1">当前健康风险评估</div>
                        <div className="font-bold text-xl flex items-center gap-2">
                            {archive.risk_level === 'RED' ? '高风险' : archive.risk_level === 'YELLOW' ? '中风险' : '低风险'}
                            <span className={`w-2.5 h-2.5 rounded-full ${
                                archive.risk_level === 'RED' ? 'bg-red-500 shadow-[0_0_10px_red]' : 
                                archive.risk_level === 'YELLOW' ? 'bg-yellow-400 shadow-[0_0_10px_orange]' : 'bg-green-400 shadow-[0_0_10px_lime]'
                            }`}></span>
                        </div>
                    </div>
                    <button onClick={onViewReport} className="bg-white text-slate-900 px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-slate-100 transition-colors">
                        查看报告
                    </button>
                </div>
            </div>

            <div className="px-5 -mt-8 relative z-20 space-y-6">
                
                {/* Quick Actions (Babylon Health Style) */}
                <div className="grid grid-cols-4 gap-3">
                    <QuickAction icon="🩺" label="症状自查" color="bg-blue-50 text-blue-600" />
                    <QuickAction icon="💬" label="咨询医生" color="bg-teal-50 text-teal-600" />
                    <QuickAction icon="📅" label="预约挂号" color="bg-purple-50 text-purple-600" />
                    <QuickAction icon="💊" label="我的用药" color="bg-orange-50 text-orange-600" />
                </div>

                {/* Daily Plan (Livongo Style) */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 text-lg">今日任务</h3>
                        <div className="text-xs font-bold text-slate-400">{Math.round(progress)}% 完成</div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-slate-100 rounded-full mb-5 overflow-hidden">
                        <div className="h-full bg-teal-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>

                    <div className="space-y-3">
                        {tasks.map((task, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => toggleTask(idx)}
                                className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer ${
                                    task.done ? 'bg-slate-50 border-transparent opacity-60' : 'bg-white border-slate-100 shadow-sm hover:border-teal-200'
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${task.done ? 'bg-slate-200 grayscale' : 'bg-teal-50'}`}>
                                    {task.icon}
                                </div>
                                <div className="flex-1">
                                    <div className={`font-bold text-sm ${task.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                        {task.txt}
                                    </div>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                    task.done ? 'bg-teal-500 border-teal-500' : 'border-slate-300'
                                }`}>
                                    {task.done && <span className="text-white text-xs">✓</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Promotion / Education Banner */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="text-xs font-bold opacity-80 uppercase mb-1">健康百科</div>
                        <h3 className="font-bold text-lg mb-2">了解“高血压”的隐形危害</h3>
                        <p className="text-xs opacity-90 mb-3 line-clamp-2">为什么高血压被称为沉默的杀手？如何通过饮食控制？点击阅读全科普。</p>
                        <button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                            开始阅读
                        </button>
                    </div>
                    <div className="absolute right-[-20px] bottom-[-20px] text-8xl opacity-10 group-hover:scale-110 transition-transform">
                        📖
                    </div>
                </div>
            </div>
        </div>
    );
};

const QuickAction = ({ icon, label, color }: any) => (
    <button className="flex flex-col items-center gap-2 group">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-transform group-active:scale-95 ${color}`}>
            {icon}
        </div>
        <span className="text-xs font-bold text-slate-600">{label}</span>
    </button>
);
