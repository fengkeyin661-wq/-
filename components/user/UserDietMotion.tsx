
import React, { useMemo } from 'react';
import { DailyHealthPlan } from '../../services/dataService';
import { HealthRecord, HealthAssessment } from '../../types';

interface Props {
    assessment?: HealthAssessment;
    userCheckupId?: string;
    record?: HealthRecord;
    dailyPlan?: DailyHealthPlan;
    onRefresh?: () => void;
}

export const UserDietMotion: React.FC<Props> = ({ record, dailyPlan }) => {
    const targets = { cal: 2150, p: 120, f: 55, c: 260 };
    const intake = useMemo(() => {
        return dailyPlan?.dietLogs?.reduce((acc, curr) => ({
            cal: acc.cal + curr.calories,
            p: acc.p + curr.protein,
            f: acc.f + curr.fat,
            c: acc.c + curr.carbs
        }), { cal: 0, p: 0, f: 0, c: 0 }) || { cal: 450, p: 25, f: 12, c: 45 }; // Demo fallback
    }, [dailyPlan]);

    const progress = Math.min(100, (intake.cal / targets.cal) * 100);

    return (
        <div className="space-y-10 animate-fadeIn pb-10">
            <header className="px-2">
                <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-1">干预日志</p>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">生活实验室</h1>
            </header>

            {/* Noom-style Calorie Budget */}
            <section className="bg-white rounded-[3rem] p-10 shadow-[0_30px_70px_rgba(0,0,0,0.04)] border border-white flex flex-col items-center relative overflow-hidden">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-50 rounded-full opacity-40"></div>
                
                <div className="relative w-56 h-56 mb-8">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="112" cy="112" r="95" stroke="#F2F2F7" strokeWidth="20" fill="transparent" />
                        <circle cx="112" cy="112" r="95" stroke="url(#gradient)" strokeWidth="20" fill="transparent" 
                            strokeDasharray={596.6} strokeDashoffset={596.6 - (596.6 * progress) / 100} 
                            strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                        <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="100%" stopColor="#a855f7" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-5xl font-black text-slate-900 tracking-tighter">{targets.cal - intake.cal}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">剩余预算 kcal</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-6 w-full border-t border-slate-50 pt-8">
                    <MacroStat label="碳水" current={intake.c} target={targets.c} color="bg-emerald-400" />
                    <MacroStat label="蛋白" current={intake.p} target={targets.p} color="bg-blue-400" />
                    <MacroStat label="脂肪" current={intake.f} target={targets.f} color="bg-orange-400" />
                </div>
            </section>

            {/* Meal Recommendations: High-contrast Cards */}
            <section className="space-y-6">
                <div className="flex justify-between items-center px-2">
                    <h2 className="text-xl font-black text-slate-800">推荐干预方案</h2>
                    <button className="text-xs font-black text-slate-400">查看历史</button>
                </div>
                <div className="space-y-4">
                    {[
                        { meal: '早餐', desc: '全麦面包、水煮蛋、脱脂牛奶', icon: '🍳', kcal: 320, color: 'bg-yellow-50' },
                        { meal: '午餐', desc: '清蒸鲈鱼、西兰花、糙米饭', icon: '🍱', kcal: 550, color: 'bg-blue-50' },
                        { meal: '晚餐', desc: '嫩煎鸡胸肉、生菜沙拉', icon: '🍲', kcal: 410, color: 'bg-rose-50' },
                    ].map((item, idx) => (
                        <div key={item.meal} className="bg-white p-6 rounded-[2.5rem] border border-white shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all duration-300">
                            <div className="flex items-center gap-6">
                                <div className={`w-16 h-16 ${item.color} rounded-3xl flex items-center justify-center text-3xl shadow-inner`}>
                                    {item.icon}
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-lg">{item.meal}</h3>
                                    <p className="text-xs text-slate-400 font-bold mt-0.5 line-clamp-1">{item.desc}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-black text-slate-900">{item.kcal}</div>
                                <div className="text-[10px] font-black text-slate-300 uppercase">kcal</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

const MacroStat = ({ label, current, target, color }: any) => (
    <div className="text-center">
        <div className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-wider">{label}</div>
        <div className="h-2 w-full bg-[#F2F2F7] rounded-full overflow-hidden mb-2">
            <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${Math.min(100, (current/target)*100)}%` }}></div>
        </div>
        <div className="text-xs font-black text-slate-800">{current}<span className="text-[10px] text-slate-300 ml-0.5">g</span></div>
    </div>
);
