
import React, { useState, useEffect, useMemo } from 'react';
import { HealthAssessment, HealthRecord, FollowUpRecord, RiskLevel } from '../../types';
import { HabitRecord, UserGamification, findArchiveByCheckupId, updateHabits } from '../../services/dataService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface Props {
    assessment?: HealthAssessment;
    userCheckupId?: string;
    record?: HealthRecord;
    followUps?: FollowUpRecord[];
    onRefresh?: () => void;
}

export const UserHabits: React.FC<Props> = ({ assessment, userCheckupId, record, followUps = [] }) => {
    const [habits, setHabits] = useState<HabitRecord[]>([]);
    const [gameData, setGameData] = useState<UserGamification>({ totalXP: 0, level: 1, currentStreak: 0, lastCheckInDate: '', badges: [] });
    const [activeMetric, setActiveMetric] = useState<'bp' | 'glucose' | 'lipids'>('bp');

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
        await updateHabits(userCheckupId!, updated, gameData);
    };

    // 数据聚合逻辑：体检基线 + 随访记录
    const chartData = useMemo(() => {
        const data = [];
        // 1. 体检基线
        if (record?.checkup?.basics) {
            data.push({
                date: '体检基线',
                sbp: record.checkup.basics.sbp,
                dbp: record.checkup.basics.dbp,
                glucose: parseFloat(record.checkup.labBasic.glucose?.fasting || '0'),
                tc: parseFloat(record.checkup.labBasic.lipids?.tc || '0'),
            });
        }
        // 2. 随访动态
        followUps.forEach(f => {
            data.push({
                date: f.date.split('-').slice(1).join('/'), // 格式化为 MM/DD
                sbp: f.indicators.sbp,
                dbp: f.indicators.dbp,
                glucose: f.indicators.glucose,
                tc: f.indicators.tc,
            });
        });
        return data;
    }, [record, followUps]);

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <header className="flex justify-between items-end px-2">
                <div>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">{new Date().toLocaleDateString('zh-CN', {month:'long', day:'numeric', weekday:'long'})}</p>
                    <h1 className="text-4xl font-black text-slate-900 mt-1">今日摘要</h1>
                </div>
                <div className="flex flex-col items-end">
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-xl border border-white">👤</div>
                </div>
            </header>

            {/* 1. 指标监测趋势 (Apple Health Trend Style) */}
            <section className="bg-white rounded-[2.5rem] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.02)] border border-white">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-slate-800">指标动态监测</h2>
                    <div className="flex bg-[#F2F2F7] p-1 rounded-xl">
                        <MetricTab active={activeMetric === 'bp'} onClick={() => setActiveMetric('bp')} label="血压" />
                        <MetricTab active={activeMetric === 'glucose'} onClick={() => setActiveMetric('glucose')} label="血糖" />
                        <MetricTab active={activeMetric === 'lipids'} onClick={() => setActiveMetric('lipids')} label="血脂" />
                    </div>
                </div>

                <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2F2F7" />
                            <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip 
                                contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}} 
                                itemStyle={{fontSize: '12px', fontWeight: '900'}}
                            />
                            {activeMetric === 'bp' && (
                                <>
                                    <ReferenceLine y={140} stroke="#FDA4AF" strokeDasharray="3 3" />
                                    <Line type="monotone" dataKey="sbp" name="收缩压" stroke="#E11D48" strokeWidth={4} dot={{r: 4, fill: '#E11D48'}} animationDuration={1500} />
                                    <Line type="monotone" dataKey="dbp" name="舒张压" stroke="#FB7185" strokeWidth={3} dot={{r: 3, fill: '#FB7185'}} />
                                </>
                            )}
                            {activeMetric === 'glucose' && (
                                <>
                                    <ReferenceLine y={6.1} stroke="#93C5FD" strokeDasharray="3 3" />
                                    <Line type="monotone" dataKey="glucose" name="空腹血糖" stroke="#2563EB" strokeWidth={4} dot={{r: 4, fill: '#2563EB'}} animationDuration={1500} />
                                </>
                            )}
                            {activeMetric === 'lipids' && (
                                <Line type="monotone" dataKey="tc" name="总胆固醇" stroke="#D97706" strokeWidth={4} dot={{r: 4, fill: '#D97706'}} animationDuration={1500} />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                
                <div className="mt-4 flex justify-between items-center px-2">
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-tight">
                        数据来源于: 院内体检 + {followUps.length}次随访记录
                    </div>
                    <button className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">录入新数据</button>
                </div>
            </section>

            {/* 2. 核心风险评估卡片 */}
            <section className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-xl font-black text-white">健康评估状态</h2>
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase ${
                            assessment?.riskLevel === 'RED' ? 'bg-rose-500 text-white' : 
                            assessment?.riskLevel === 'YELLOW' ? 'bg-orange-400 text-white' : 'bg-emerald-500 text-white'
                        }`}>
                            {assessment?.riskLevel === 'RED' ? 'High Risk' : assessment?.riskLevel === 'YELLOW' ? 'Warning' : 'Healthy'}
                        </span>
                    </div>
                    <p className="text-slate-300 text-sm font-medium leading-relaxed mb-6">
                        {assessment?.summary || "正在同步您的最新干预方案..."}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-sm border border-white/5">
                            <span className="text-[10px] font-black text-slate-400 uppercase">健康值</span>
                            <p className="text-2xl font-black text-white mt-1">Lv.{gameData.level}</p>
                        </div>
                        <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-sm border border-white/5">
                            <span className="text-[10px] font-black text-slate-400 uppercase">累计积分</span>
                            <p className="text-2xl font-black text-white mt-1">{gameData.totalXP} XP</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. 今日干预目标 (Habits) */}
            <section className="space-y-4">
                <div className="flex justify-between items-center px-2">
                    <h2 className="text-xl font-black text-slate-800">干预计划执行</h2>
                    <button className="text-sm font-bold text-slate-400">查看历史</button>
                </div>
                <div className="space-y-3">
                    {habits.map(habit => {
                        const isDone = habit.history.includes(new Date().toISOString().split('T')[0]);
                        return (
                            <div key={habit.id} className={`bg-white p-5 rounded-[2.2rem] border transition-all duration-500 flex items-center justify-between ${isDone ? 'opacity-60 bg-slate-50' : 'shadow-sm border-white'}`}>
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${isDone ? 'grayscale' : 'bg-[#E5E5EA]'}`}>
                                        {habit.icon}
                                    </div>
                                    <div>
                                        <h3 className={`font-black text-base ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{habit.title}</h3>
                                        <span className="text-[10px] font-black text-orange-500 uppercase">🔥 STREAK {habit.streak} DAYS</span>
                                    </div>
                                </div>
                                <button onClick={() => !isDone && handleCheckIn(habit.id)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'}`}>
                                    {isDone ? '✓' : '+'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};

const MetricTab = ({ active, onClick, label }: any) => (
    <button onClick={onClick} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${active ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
        {label}
    </button>
);
