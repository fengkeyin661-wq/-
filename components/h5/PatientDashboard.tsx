
import React, { useState } from 'react';
import { HealthArchive } from '../../services/dataService';
import { RiskLevel } from '../../types';

interface Props {
    archive: HealthArchive;
    onViewReport: () => void;
}

export const PatientDashboard: React.FC<Props> = ({ archive, onViewReport }) => {
    // Check local storage for daily task completion (mock persistence)
    const [tasks, setTasks] = useState(() => {
        // Extract specific tasks from assessment
        const items = [
            ...archive.assessment_data.managementPlan.medication.slice(0, 2).map(t => ({ txt: `用药: ${t}`, done: false })),
            ...archive.assessment_data.managementPlan.exercise.slice(0, 1).map(t => ({ txt: `运动: ${t}`, done: false })),
            { txt: '每日体重/血压监测', done: false }
        ];
        return items;
    });

    const toggleTask = (index: number) => {
        const newTasks = [...tasks];
        newTasks[index].done = !newTasks[index].done;
        setTasks(newTasks);
    };

    // Calculate Health Score (Mock Algorithm)
    const riskScore = archive.risk_level === 'RED' ? 65 : archive.risk_level === 'YELLOW' ? 82 : 95;
    const completedTasks = tasks.filter(t => t.done).length;
    const dailyScore = riskScore + (completedTasks * 2); // Dynamic score based on action

    const nextTask = archive.follow_up_schedule?.find(s => s.status === 'pending');
    
    // Quick extract portraits for dashboard summary
    const portraits = archive.risk_analysis?.portraits || [];
    const highRisks = portraits.filter(p => p.status === 'High');

    return (
        <div className="bg-slate-50 min-h-full">
            {/* Hero Header with Score */}
            <div className="bg-gradient-to-b from-teal-600 to-teal-500 text-white rounded-b-[2.5rem] p-6 pb-12 shadow-xl shadow-teal-900/10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                
                <div className="relative z-10 flex justify-between items-center mb-6">
                    <div>
                        <div className="text-teal-100 text-xs font-medium mb-0.5">
                            {new Date().toLocaleDateString(undefined, {weekday: 'long', month:'long', day:'numeric'})}
                        </div>
                        <h1 className="text-2xl font-bold">
                            早安，{archive.name}
                        </h1>
                    </div>
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30 text-lg">
                        {archive.gender === '女' ? '👩🏻' : '👨🏻'}
                    </div>
                </div>

                {/* Health Score Ring */}
                <div className="flex flex-col items-center justify-center mb-2">
                    <div className="relative w-40 h-40 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="80" cy="80" r="70" stroke="rgba(255,255,255,0.2)" strokeWidth="12" fill="transparent" />
                            <circle 
                                cx="80" cy="80" r="70" 
                                stroke="white" strokeWidth="12" 
                                fill="transparent" 
                                strokeDasharray={440} 
                                strokeDashoffset={440 - (440 * dailyScore / 100)} 
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-5xl font-bold tracking-tighter">{Math.min(100, dailyScore)}</span>
                            <span className="text-xs text-teal-100 font-medium bg-white/20 px-2 py-0.5 rounded-full mt-1">健康指数</span>
                        </div>
                    </div>
                    <p className="text-teal-50 text-xs mt-2 opacity-80">
                        {completedTasks === tasks.length ? '今日任务已全部完成，棒！' : `完成今日打卡可提升指数`}
                    </p>
                </div>
            </div>

            <div className="px-5 -mt-8 relative z-20 space-y-6">
                {/* 1. Daily Action List (Interactive) */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
                        <span className="flex items-center gap-2">📝 今日健康清单</span>
                        <span className="text-xs text-slate-400 font-normal">{completedTasks}/{tasks.length} 已完成</span>
                    </h3>
                    <div className="space-y-3">
                        {tasks.map((task, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => toggleTask(idx)}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                                    task.done ? 'bg-teal-50 border-teal-100' : 'bg-white border-slate-100 hover:border-teal-200'
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    task.done ? 'bg-teal-500 border-teal-500' : 'border-slate-300'
                                }`}>
                                    {task.done && <span className="text-white text-xs font-bold">✓</span>}
                                </div>
                                <span className={`text-sm font-medium transition-colors ${
                                    task.done ? 'text-teal-800 line-through opacity-70' : 'text-slate-700'
                                }`}>{task.txt}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. Risk Status Card */}
                <div className={`rounded-2xl p-5 text-white shadow-lg relative overflow-hidden ${
                    archive.risk_level === 'RED' ? 'bg-gradient-to-r from-red-500 to-rose-600' :
                    archive.risk_level === 'YELLOW' ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                    'bg-gradient-to-r from-emerald-500 to-teal-600'
                }`}>
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1">当前评估结果</p>
                            <h2 className="text-2xl font-black mb-2">
                                {archive.risk_level === 'RED' ? '高风险关注' : archive.risk_level === 'YELLOW' ? '中风险关注' : '健康状态良好'}
                            </h2>
                            <button 
                                onClick={onViewReport}
                                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 mt-2"
                            >
                                查看详细解读 <span>→</span>
                            </button>
                        </div>
                        <div className="text-4xl opacity-90 drop-shadow-md">
                            {archive.risk_level === 'RED' ? '🚨' : archive.risk_level === 'YELLOW' ? '⚠️' : '🛡️'}
                        </div>
                    </div>
                </div>

                {/* 3. Next Appointment Snippet */}
                {nextTask && (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-3 text-sm">📅 下次复查提醒</h3>
                        <div className="flex items-start gap-4">
                            <div className="bg-blue-50 text-blue-600 w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 font-bold border border-blue-100">
                                <span className="text-[10px] uppercase">{new Date(nextTask.date).toLocaleString('default', { month: 'short' })}</span>
                                <span className="text-lg leading-none">{new Date(nextTask.date).getDate()}</span>
                            </div>
                            <div>
                                <div className="font-bold text-slate-800 text-sm mb-1">预约复查</div>
                                <p className="text-xs text-slate-500 leading-relaxed mb-2 line-clamp-2">
                                    重点关注: {nextTask.focusItems.join('、')}
                                </p>
                            </div>
                        </div>
                    </div>
