
import React, { useState, useEffect, useMemo } from 'react';
import { fetchContent, ContentItem } from '../../services/contentService';
import { HealthAssessment, HealthRecord } from '../../types';
import { generateDailyIntegratedPlan } from '../../services/geminiService';
import { updateUserPlan, DailyHealthPlan, DietLogItem, ExerciseLogItem, findArchiveByCheckupId } from '../../services/dataService';

interface Props {
    assessment?: HealthAssessment;
    userCheckupId?: string;
    record?: HealthRecord;
    dailyPlan?: DailyHealthPlan;
    onRefresh?: () => void;
}

// Fix: Added snack slot to UI configuration
const MEAL_SLOTS = [
    { id: 'breakfast', label: '早餐', icon: '🍳', color: 'bg-orange-50 text-orange-600' },
    { id: 'lunch', label: '午餐', icon: '🍱', color: 'bg-blue-50 text-blue-600' },
    { id: 'dinner', label: '晚餐', icon: '🍲', color: 'bg-indigo-50 text-indigo-600' },
    { id: 'snack', label: '加餐', icon: '🍎', color: 'bg-teal-50 text-teal-600' },
];

const parseCal = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val.replace(/[^\d.]/g, '')) || 0;
    return 0;
};

export const UserDietMotion: React.FC<Props> = ({ assessment, userCheckupId, record, dailyPlan, onRefresh }) => {
    const [allMeals, setAllMeals] = useState<ContentItem[]>([]);
    const [activeTab, setActiveTab] = useState<'diary' | 'resources'>('diary');
    const [isGenerating, setIsGenerating] = useState(false);

    const targets = useMemo(() => ({ tdee: 2000, protein: 100, fat: 60, carbs: 250 }), []);
    
    const intake = useMemo(() => {
        const dLogs = dailyPlan?.dietLogs || [];
        return dLogs.reduce((acc, item) => ({
            cal: acc.cal + (Number(item.calories) || 0),
            p: acc.p + (Number(item.protein) || 0),
            f: acc.f + (Number(item.fat) || 0),
            c: acc.c + (Number(item.carbs) || 0),
        }), { cal: 0, p: 0, f: 0, c: 0 });
    }, [dailyPlan]);

    const progressCal = Math.min(100, (intake.cal / targets.tdee) * 100);

    useEffect(() => {
        fetchContent('meal', 'active').then(setAllMeals);
    }, []);

    const handleGenerate = async () => {
        if (!userCheckupId) return;
        setIsGenerating(true);
        // Fix: generateDailyIntegratedPlan now returns snack, resolving previous type mismatch
        try {
            const plan = await generateDailyIntegratedPlan("高风险", "[]", targets.tdee);
            // Fix: Include snack in dietLogs to satisfy DailyHealthPlan requirement
            const dietLogs: DietLogItem[] = [
                { id: 'b1', name: plan.diet.breakfast, calories: 400, protein: 20, fat: 10, carbs: 50, fiber: 0, type: 'breakfast' },
                { id: 'l1', name: plan.diet.lunch, calories: 700, protein: 40, fat: 20, carbs: 80, fiber: 0, type: 'lunch' },
                { id: 'd1', name: plan.diet.dinner, calories: 500, protein: 30, fat: 15, carbs: 60, fiber: 0, type: 'dinner' },
                { id: 's1', name: plan.diet.snack, calories: 150, protein: 5, fat: 5, carbs: 15, fiber: 0, type: 'snack' },
            ];
            await updateUserPlan(userCheckupId, {
                generatedAt: new Date().toISOString(),
                diet: plan.diet,
                exercise: plan.exercise,
                tips: plan.tips,
                dietLogs
            });
            if(onRefresh) onRefresh();
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-8 animate-fadeIn">
            <header className="px-2">
                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">生活志</p>
                <h1 className="text-4xl font-black text-slate-900 mt-1">日志记录</h1>
            </header>

            {/* Calorie Ring Card */}
            <section className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_40px_rgba(0,0,0,0.02)] border border-white flex flex-col items-center">
                <div className="relative w-48 h-48 mb-8">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="96" cy="96" r="80" stroke="#F2F2F7" strokeWidth="16" fill="transparent" />
                        <circle cx="96" cy="96" r="80" stroke="black" strokeWidth="16" fill="transparent" 
                            strokeDasharray={502.4} strokeDashoffset={502.4 - (502.4 * progressCal) / 100} 
                            strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-black text-slate-900">{targets.tdee - intake.cal}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">剩余预算</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-8 w-full border-t border-slate-50 pt-6">
                    <MacroStat label="碳水" current={intake.c} target={targets.carbs} color="bg-emerald-400" />
                    <MacroStat label="蛋白" current={intake.p} target={targets.protein} color="bg-blue-400" />
                    <MacroStat label="脂肪" current={intake.f} target={targets.fat} color="bg-orange-400" />
                </div>
            </section>

            {/* Meal Slots */}
            <section className="space-y-4">
                <div className="flex justify-between items-center px-2">
                    <h2 className="text-xl font-black text-slate-800">推荐干预方案</h2>
                    <button onClick={handleGenerate} disabled={isGenerating} className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                        {isGenerating ? 'AI 生成中...' : '智能生成'}
                    </button>
                </div>
                <div className="space-y-3">
                    {MEAL_SLOTS.map(slot => {
                        const logs = dailyPlan?.dietLogs?.filter(l => l.type === slot.id) || [];
                        return (
                            <div key={slot.id} className="bg-white p-6 rounded-[2rem] border border-white shadow-sm flex items-center justify-between group">
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${slot.color}`}>
                                        {slot.icon}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-800">{slot.label}</h3>
                                        <p className="text-xs text-slate-400 font-bold">
                                            {logs.length > 0 ? logs[0].name : '待录入'}
                                        </p>
                                    </div>
                                </div>
                                <button className="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center">+</button>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};

const MacroStat = ({ label, current, target, color }: any) => (
    <div className="text-center">
        <div className="text-[10px] font-black text-slate-400 uppercase mb-2">{label}</div>
        <div className="h-1.5 w-full bg-[#F2F2F7] rounded-full overflow-hidden mb-1">
            <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(100, (current/target)*100)}%` }}></div>
        </div>
        <div className="text-[10px] font-black text-slate-800">{current}g</div>
    </div>
);
