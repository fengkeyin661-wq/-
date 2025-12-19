
import React, { useState, useEffect } from 'react';
import { HealthAssessment, HealthRecord } from '../../types';
import { HabitRecord, UserGamification, findArchiveByCheckupId, updateHabits } from '../../services/dataService';
import { generatePersonalizedHabits } from '../../services/geminiService';

interface Props {
    assessment?: HealthAssessment;
    userCheckupId?: string;
    record?: HealthRecord;
    onRefresh?: () => void;
}

export const UserHabits: React.FC<Props> = ({ assessment, userCheckupId, record }) => {
    const [habits, setHabits] = useState<HabitRecord[]>([]);
    const [gameData, setGameData] = useState<UserGamification>({ totalXP:0, level:1, currentStreak:0, lastCheckInDate:'', badges:[] });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, [userCheckupId, assessment]);

    const loadData = async () => {
        if (!userCheckupId) return;
        const archive = await findArchiveByCheckupId(userCheckupId);
        if (archive) {
            if (archive.habit_tracker?.length) setHabits(archive.habit_tracker);
            if (archive.gamification) setGameData(archive.gamification);
        }
    };

    const handleCheckIn = async (habitId: string) => {
        const today = new Date().toISOString().split('T')[0];
        const updated = habits.map(h => {
            if (h.id === habitId && !h.history.includes(today)) {
                return { ...h, history: [...h.history, today], streak: h.streak + 1 };
            }
            return h;
        });
        setHabits(updated);
        // Simplified XP logic for demo
        const newGameData = { ...gameData, totalXP: gameData.totalXP + 15 };
        setGameData(newGameData);
        await updateHabits(userCheckupId!, updated, newGameData);
    };

    return (
        <div className="space-y-10 animate-fadeIn">
            {/* Header: Global Design Language */}
            <header className="flex justify-between items-end px-2">
                <div>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-1">
                        {new Date().toLocaleDateString('zh-CN', {month:'long', day:'numeric', weekday:'long'})}
                    </p>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">摘要</h1>
                </div>
                <div className="w-12 h-12 bg-white rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.05)] flex items-center justify-center text-xl border border-white">
                    👤
                </div>
            </header>

            {/* Assessment Focus: Addressing the "Only Checkup" gap */}
            <section className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.03)] border border-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-700"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-black text-slate-800">健康风险评估</h2>
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border ${
                            assessment?.riskLevel === 'RED' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                            assessment?.riskLevel === 'YELLOW' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        }`}>
                            {assessment?.riskLevel === 'RED' ? 'High Risk' : assessment?.riskLevel === 'YELLOW' ? 'Attention' : 'Optimal'}
                        </span>
                    </div>
                    <p className="text-slate-500 leading-relaxed font-medium mb-8 text-sm">
                        {assessment?.summary || "正在分析您的体检指标与干预方案..."}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#F2F2F7] p-4 rounded-3xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">当前等级</span>
                            <p className="text-2xl font-black text-slate-900 mt-1">Lv.{gameData.level}</p>
                        </div>
                        <div className="bg-[#F2F2F7] p-4 rounded-3xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">健康积分</span>
                            <p className="text-2xl font-black text-slate-900 mt-1">{gameData.totalXP}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Habits List: Apple Health Activity Style */}
            <section className="space-y-6">
                <div className="flex justify-between items-center px-2">
                    <h2 className="text-xl font-black text-slate-800">今日目标</h2>
                    <button className="text-xs font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-full">管理</button>
                </div>

                <div className="space-y-4">
                    {habits.length === 0 ? (
                        <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[2rem] p-10 text-center">
                            <p className="text-slate-400 text-sm font-bold">暂无打卡任务，请咨询医生开具方案</p>
                        </div>
                    ) : (
                        habits.map(habit => {
                            const isDone = habit.history.includes(new Date().toISOString().split('T')[0]);
                            return (
                                <div 
                                    key={habit.id}
                                    className={`group bg-white p-5 rounded-[2.2rem] border transition-all duration-500 flex items-center justify-between ${
                                        isDone ? 'border-transparent bg-slate-50 opacity-60' : 'border-white shadow-[0_10px_30px_rgba(0,0,0,0.02)]'
                                    }`}
                                >
                                    <div className="flex items-center gap-5">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500 ${
                                            isDone ? 'bg-slate-200 grayscale scale-90' : 'bg-[#E5E5EA] text-slate-800 shadow-inner'
                                        }`}>
                                            {habit.icon}
                                        </div>
                                        <div>
                                            <h3 className={`font-black text-base transition-all ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                                {habit.title}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] font-black tracking-tight uppercase ${isDone ? 'text-slate-300' : 'text-orange-500'}`}>
                                                    🔥 Streak {habit.streak} d
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => !isDone && handleCheckIn(habit.id)}
                                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-sm ${
                                            isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                                        }`}
                                    >
                                        {isDone ? (
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                        ) : (
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg>
                                        )}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>
        </div>
    );
};
