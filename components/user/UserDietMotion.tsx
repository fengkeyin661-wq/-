
import React, { useState, useEffect, useMemo } from 'react';
import { fetchContent, ContentItem } from '../../services/contentService';
import { ResourceCover } from './ResourceCover';
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

// --- Icons & Helpers ---
const getSmartIcon = (title: string, type: string): string => {
    const t = title.toLowerCase();
    if (type === 'meal') {
        if (t.includes('鸡') || t.includes('肉') || t.includes('牛')) return '🥩';
        if (t.includes('鱼') || t.includes('海鲜')) return '🐟';
        if (t.includes('面') || t.includes('粉') || t.includes('饭') || t.includes('粥')) return '🍜';
        if (t.includes('菜') || t.includes('沙拉')) return '🥗';
        if (t.includes('果') || t.includes('瓜')) return '🍎';
        if (t.includes('奶') || t.includes('蛋')) return '🥛';
        return '🍱';
    } else {
        if (t.includes('跑') || t.includes('走')) return '🏃';
        if (t.includes('瑜伽') || t.includes('普拉提')) return '🧘';
        if (t.includes('力') || t.includes('举')) return '🏋️';
        if (t.includes('泳')) return '🏊';
        if (t.includes('球')) return '🏀';
        return '🤸';
    }
};

const MEAL_SLOTS = [
    { id: 'breakfast', label: '早餐', icon: '🍳', color: 'bg-orange-50 text-orange-600' },
    { id: 'lunch', label: '午餐', icon: '🍱', color: 'bg-green-50 text-green-600' },
    { id: 'dinner', label: '晚餐', icon: '🍲', color: 'bg-indigo-50 text-indigo-600' },
    // Removed Snack slot for simplified auto-planning
];

const parseCal = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val.replace(/[^\d.]/g, '')) || 0;
    return 0;
};

// [NEW] Smart Calorie Estimator based on Exercise Type
const estimateCalories = (name: string, duration: number): number => {
    const n = name.toLowerCase();
    let kcalPerMin = 6; // Default Moderate

    if (n.includes('游泳')) kcalPerMin = 11;
    else if (n.includes('快跑') || n.includes('冲刺')) kcalPerMin = 14;
    else if (n.includes('跑')) kcalPerMin = 10;
    else if (n.includes('跳绳')) kcalPerMin = 12;
    else if (n.includes('球') || n.includes('对抗')) kcalPerMin = 9;
    else if (n.includes('骑行') || n.includes('单车')) kcalPerMin = 8;
    else if (n.includes('力量') || n.includes('举铁') || n.includes('哑铃')) kcalPerMin = 7;
    else if (n.includes('快走')) kcalPerMin = 6;
    else if (n.includes('走') || n.includes('散步')) kcalPerMin = 4;
    else if (n.includes('瑜伽') || n.includes('普拉提') || n.includes('拉伸')) kcalPerMin = 3;
    else if (n.includes('太极') || n.includes('八段锦')) kcalPerMin = 4;
    else if (n.includes('操') || n.includes('舞')) kcalPerMin = 6; // 广场舞/健身操

    return Math.round(kcalPerMin * duration);
};

// --- Main Component ---
export const UserDietMotion: React.FC<Props> = ({ assessment, userCheckupId, record, dailyPlan, onRefresh }) => {
    const [allMeals, setAllMeals] = useState<ContentItem[]>([]);
    const [allExercises, setAllExercises] = useState<ContentItem[]>([]);
    
    const [activeTab, setActiveTab] = useState<'diary' | 'resources'>('diary');
    const [searchTerm, setSearchTerm] = useState('');
    const [resourceFilter, setResourceFilter] = useState<'all' | 'meal' | 'exercise'>('all');
    
    // Modals
    const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
    
    // AI Gen State
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewPlan, setPreviewPlan] = useState<any>(null);
    const [calculatedStats, setCalculatedStats] = useState({ totalCal: 0, protein: 0, fat: 0, carbs: 0, burn: 0 });

    // --- 1. Target Calculations (TDEE) ---
    const targets = useMemo(() => {
        if (!record) return { tdee: 2000, protein: 100, fat: 60, carbs: 250 };
        const w = record.checkup.basics.weight || 65;
        const h = record.checkup.basics.height || 170;
        const age = record.profile.age || 40;
        const gender = record.profile.gender || '男';
        
        // Mifflin-St Jeor Equation
        let bmr = (10 * w) + (6.25 * h) - (5 * age) + (gender === '女' ? -161 : 5);
        const tdee = Math.round(bmr * 1.375); // Sedentary/Lightly active baseline
        
        // Macro Split (Moderate Carb: 50C/30F/20P)
        return {
            tdee,
            protein: Math.round((tdee * 0.20) / 4),
            fat: Math.round((tdee * 0.30) / 9),
            carbs: Math.round((tdee * 0.50) / 4)
        };
    }, [record]);

    // --- 2. Current Intake Calculations (From saved plan) ---
    const intake = useMemo(() => {
        const dLogs = dailyPlan?.dietLogs || [];
        const eLogs = dailyPlan?.exerciseLogs || [];
        
        const sum = dLogs.reduce((acc, item) => ({
            cal: acc.cal + (Number(item.calories) || 0),
            p: acc.p + (Number(item.protein) || 0),
            f: acc.f + (Number(item.fat) || 0),
            c: acc.c + (Number(item.carbs) || 0),
        }), { cal: 0, p: 0, f: 0, c: 0 });

        const burned = eLogs.reduce((acc, item) => acc + (Number(item.calories) || 0), 0);
        
        return { ...sum, burned };
    }, [dailyPlan]);

    const remainingCal = Math.max(0, targets.tdee - intake.cal + intake.burned);
    const progressCal = Math.min(100, ((intake.cal - intake.burned) / targets.tdee) * 100);

    // Initial Load
    useEffect(() => {
        const load = async () => {
            const [m, e] = await Promise.all([fetchContent('meal', 'active'), fetchContent('exercise', 'active')]);
            setAllMeals(m); setAllExercises(e);
        };
        load();
    }, [userCheckupId]);

    // --- Logic: AI Generation ---
    const handleGenerate = async () => {
        if (!assessment || !userCheckupId) return alert("请先完善档案");
        setIsGenerating(true);
        try {
            // Provide context to AI
            const context = JSON.stringify({
                meals: allMeals.slice(0, 30).map(m => ({ 
                    id: m.id, 
                    name: m.title, 
                    cal: m.details?.cal,
                    tags: m.tags
                })),
                exercises: allExercises.slice(0, 15).map(e => ({ 
                    id: e.id, 
                    name: e.title,
                    intensity: e.details?.intensity
                }))
            });
            const profileStr = `风险:${assessment.riskLevel}, ${assessment.summary}`;
            
            // [UPDATED] Pass targets.tdee explicitly
            const plan = await generateDailyIntegratedPlan(profileStr, context, targets.tdee);
            
            // Map IDs back to full objects for calculation
            const recMealIds = plan.recommendedMealIds || [];
            const recExIds = plan.recommendedExerciseIds || [];

            const recMeals = allMeals.filter(m => recMealIds.includes(m.id));
            const recExercises = allExercises.filter(e => recExIds.includes(e.id));

            // Fallback: If AI fails to pick specific IDs or picks invalid ones, auto-select based on tags
            if (recMeals.length < 3) {
                // Simple logic: pick 1 breakfast-like, 1 lunch-like, 1 dinner-like if possible, or random
                const remaining = 3 - recMeals.length;
                const randomFill = allMeals.filter(m => !recMealIds.includes(m.id)).slice(0, remaining);
                recMeals.push(...randomFill);
            }

            // Calculate Planned Nutrition
            let stats = { totalCal: 0, protein: 0, fat: 0, carbs: 0, burn: 0 };
            
            recMeals.forEach(m => {
                stats.totalCal += parseCal(m.details?.cal);
                stats.protein += Number(m.details?.macros?.protein) || 0;
                stats.fat += Number(m.details?.macros?.fat) || 0;
                stats.carbs += Number(m.details?.macros?.carbs) || 0;
            });

            recExercises.forEach(e => {
                const duration = parseCal(e.details?.duration) || 30;
                let burned = parseCal(e.details?.cal);
                if (burned <= 0) burned = estimateCalories(e.title, duration);
                stats.burn += burned;
            });

            setPreviewPlan({
                ...plan,
                fullMeals: recMeals,
                fullExercises: recExercises
            });
            setCalculatedStats(stats);

        } catch (e) {
            console.error(e);
            alert("AI 生成服务繁忙，请稍后再试");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirmPlan = async () => {
        if (!previewPlan || !userCheckupId) return;
        
        // Transform Preview to Log Items
        const dietLogs: DietLogItem[] = previewPlan.fullMeals.map((m: ContentItem, index: number) => {
            const types: DietLogItem['type'][] = ['breakfast', 'lunch', 'dinner'];
            return {
                id: Date.now() + index + '_meal',
                name: m.title,
                calories: parseCal(m.details?.cal),
                protein: Number(m.details?.macros?.protein) || 0,
                fat: Number(m.details?.macros?.fat) || 0,
                carbs: Number(m.details?.macros?.carbs) || 0,
                fiber: 0,
                type: types[index] || 'lunch'
            };
        });

        const exerciseLogs: ExerciseLogItem[] = previewPlan.fullExercises.map((e: ContentItem, index: number) => {
            const dur = parseCal(e.details?.duration) || 30;
            let cal = parseCal(e.details?.cal);
            if (cal <= 0) cal = estimateCalories(e.title, dur);
            
            return {
                id: Date.now() + index + '_ex',
                name: e.title,
                calories: Math.round(cal),
                duration: dur
            };
        });

        const newPlan: DailyHealthPlan = {
            generatedAt: new Date().toISOString(),
            diet: previewPlan.diet, // Text summary
            exercise: previewPlan.exercise,
            tips: previewPlan.tips,
            dietLogs: dietLogs, // Actual Data
            exerciseLogs: exerciseLogs,
            recommendations: { // Keep for reference
                meals: dietLogs,
                exercises: exerciseLogs
            }
        };

        const success = await updateUserPlan(userCheckupId, newPlan);
        if (success) {
            setPreviewPlan(null);
            if(onRefresh) onRefresh();
        } else {
            alert("保存失败");
        }
    };

    // --- Render Helpers ---
    const filteredResources = useMemo(() => {
        let list = [...allMeals, ...allExercises];
        if (resourceFilter === 'meal') list = allMeals;
        if (resourceFilter === 'exercise') list = allExercises;
        
        if (searchTerm) {
            list = list.filter(i => i.title.includes(searchTerm) || i.tags.join('').includes(searchTerm));
        }
        return list;
    }, [allMeals, allExercises, resourceFilter, searchTerm]);

    return (
        <div className="bg-slate-50 min-h-full pb-28">
            {/* 1. Header & Dashboard */}
            <div className="bg-white rounded-b-[2.5rem] shadow-sm border-b border-slate-100 overflow-hidden relative">
                <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-6 pb-12 text-white">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-xl font-bold">今日热量管理</h2>
                            <p className="text-xs text-teal-100 opacity-90">目标: {targets.tdee} kcal</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-center gap-8">
                        <div className="text-center">
                            <div className="text-2xl font-bold">{intake.cal}</div>
                            <div className="text-[10px] opacity-70">已摄入</div>
                        </div>
                        
                        {/* Main Ring */}
                        <div className="relative w-32 h-32 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-teal-700/30" />
                                <circle cx="64" cy="64" r="56" stroke="white" strokeWidth="8" fill="transparent" strokeDasharray={351.86} strokeDashoffset={351.86 - (351.86 * progressCal) / 100} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                            </svg>
                            <div className="absolute flex flex-col items-center">
                                <span className="text-3xl font-black">{remainingCal}</span>
                                <span className="text-[9px] opacity-80 uppercase tracking-widest">剩余</span>
                            </div>
                        </div>

                        <div className="text-center">
                            <div className="text-2xl font-bold">{intake.burned}</div>
                            <div className="text-[10px] opacity-70">已消耗</div>
                        </div>
                    </div>
                </div>

                {/* Macro Bars */}
                <div className="px-6 py-4 -mt-6">
                    <div className="bg-white rounded-2xl shadow-lg p-4 grid grid-cols-3 gap-4 border border-slate-100">
                        <MacroProgress label="碳水" current={intake.c} target={targets.carbs} color="bg-green-500" />
                        <MacroProgress label="蛋白质" current={intake.p} target={targets.protein} color="bg-blue-500" />
                        <MacroProgress label="脂肪" current={intake.f} target={targets.fat} color="bg-yellow-500" />
                    </div>
                </div>
            </div>

            {/* 2. Navigation Tabs */}
            <div className="px-6 mt-4 mb-2 flex gap-4">
                <button onClick={() => setActiveTab('diary')} className={`text-sm font-bold pb-2 transition-all ${activeTab==='diary' ? 'text-slate-800 border-b-2 border-teal-500' : 'text-slate-400'}`}>今日方案</button>
                <button onClick={() => setActiveTab('resources')} className={`text-sm font-bold pb-2 transition-all ${activeTab==='resources' ? 'text-slate-800 border-b-2 border-teal-500' : 'text-slate-400'}`}>资源库</button>
            </div>

            {/* 3. Diary View (My Plan) */}
            {activeTab === 'diary' && (
                <div className="px-4 space-y-4 animate-fadeIn">
                    
                    {/* Only show AI Button if plan is empty or user wants to regenerate */}
                    <button onClick={handleGenerate} disabled={isGenerating} className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-transform flex items-center justify-center gap-2">
                        {isGenerating ? '🔮 AI 正在从资源库匹配方案...' : (dailyPlan?.dietLogs?.length ? '🔄 重新生成今日方案' : '✨ 智能生成今日方案')}
                    </button>

                    {dailyPlan?.dietLogs && dailyPlan.dietLogs.length > 0 ? (
                        <>
                            {/* Meal Slots */}
                            {MEAL_SLOTS.map(slot => {
                                const items = dailyPlan.dietLogs?.filter(l => l.type === slot.id) || [];
                                const slotCal = items.reduce((sum, i) => sum + i.calories, 0);
                                
                                return (
                                    <div key={slot.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${slot.color}`}>
                                                    {slot.icon}
                                                </div>
                                                <span className="font-bold text-slate-700">{slot.label}</span>
                                            </div>
                                            <div className="text-xs text-slate-400 font-bold">{slotCal} kcal</div>
                                        </div>
                                        {items.length > 0 ? (
                                            <div className="space-y-2">
                                                {items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between text-sm py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded px-2 -mx-2 transition-colors">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-700">{item.name}</span>
                                                            <div className="text-[10px] text-slate-400 flex gap-2">
                                                                <span>C:{item.carbs}</span>
                                                                <span>P:{item.protein}</span>
                                                                <span>F:{item.fat}</span>
                                                            </div>
                                                        </div>
                                                        <span className="font-mono text-slate-500 self-center">{item.calories}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-300 text-center py-2">无内容 (由AI自动规划)</div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Exercise Slot */}
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center text-lg">🏃</div>
                                        <span className="font-bold text-slate-700">运动消耗</span>
                                    </div>
                                    <div className="text-xs text-orange-500 font-bold">-{intake.burned} kcal</div>
                                </div>
                                {dailyPlan.exerciseLogs && dailyPlan.exerciseLogs.length > 0 ? (
                                    <div className="space-y-2">
                                        {dailyPlan.exerciseLogs.map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-sm py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded px-2 -mx-2">
                                                <span className="flex items-center gap-2 font-bold text-slate-700">
                                                    {item.name}
                                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1 rounded font-normal">{item.duration} min</span>
                                                </span>
                                                <span className="font-mono text-orange-500">-{item.calories}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-300 text-center py-2">无内容 (由AI自动规划)</div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-10 text-slate-400 text-sm">
                            <div className="text-4xl mb-2 opacity-50">📋</div>
                            点击上方按钮，生成您的专属健康方案
                        </div>
                    )}
                </div>
            )}

            {/* 4. Resources View (Read Only Browser) */}
            {activeTab === 'resources' && (
                <div className="px-4 animate-fadeIn">
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                        {['all', 'meal', 'exercise'].map(f => (
                            <button key={f} onClick={() => setResourceFilter(f as any)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${resourceFilter===f ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border'}`}>
                                {f==='all'?'全部':f==='meal'?'食谱库':'运动库'}
                            </button>
                        ))}
                    </div>
                    <div className="columns-2 gap-4 space-y-4">
                        {filteredResources.map(item => (
                            <div key={item.id} onClick={() => setSelectedItem(item)} className="break-inside-avoid bg-white p-3 rounded-xl shadow-sm border border-slate-100 cursor-pointer active:scale-95 transition-transform hover:shadow-md">
                                <ResourceCover
                                    item={item}
                                    fallback={<span className="text-3xl">{getSmartIcon(item.title, item.type)}</span>}
                                    className="mb-2 h-20 w-full rounded-lg bg-slate-50 text-center text-3xl"
                                    imgClassName="h-full w-full object-cover rounded-lg"
                                />
                                <h4 className="font-bold text-slate-800 text-sm leading-tight mb-1">{item.title}</h4>
                                <div className="text-[10px] text-slate-400">
                                    {item.type === 'meal' ? `${item.details?.cal || 0} kcal` : `${item.details?.duration || 0} min`}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- MODALS --- */}

            {/* 1. Item Detail Modal (Read Only) */}
            {selectedItem && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedItem(null)}>
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-scaleIn relative overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-teal-50 to-white -z-10"></div>
                        
                        <div className="text-center mb-6 mt-2">
                            <div className="mx-auto mb-4 h-20 w-20 rounded-full border-4 border-white">
                                <ResourceCover
                                    item={selectedItem}
                                    fallback={<span className="text-5xl">{getSmartIcon(selectedItem.title, selectedItem.type)}</span>}
                                    className="h-full w-full rounded-full bg-white text-5xl shadow-lg"
                                    imgClassName="h-full w-full rounded-full object-cover shadow-lg"
                                />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 leading-tight">{selectedItem.title}</h3>
                            <div className="flex justify-center gap-2 mt-2">
                                {selectedItem.tags.slice(0, 3).map(t => <span key={t} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">{t}</span>)}
                            </div>
                        </div>

                        {selectedItem.type === 'meal' ? (
                            <div className="mb-6">
                                <div className="grid grid-cols-4 gap-2 mb-4">
                                    <MacroBox label="热量" val={selectedItem.details?.cal} unit="kcal" highlight />
                                    <MacroBox label="蛋白质" val={selectedItem.details?.macros?.protein} unit="g" />
                                    <MacroBox label="脂肪" val={selectedItem.details?.macros?.fat} unit="g" />
                                    <MacroBox label="碳水" val={selectedItem.details?.macros?.carbs} unit="g" />
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 leading-relaxed max-h-32 overflow-y-auto">
                                    <span className="font-bold block mb-1">食材/简介:</span>
                                    {selectedItem.details?.ingredients || selectedItem.description || '暂无详情'}
                                </div>
                            </div>
                        ) : (
                            <div className="mb-6 bg-orange-50 p-4 rounded-xl border border-orange-100 text-center">
                                <div className="text-2xl font-black text-orange-600">
                                    {parseCal(selectedItem.details?.cal) || estimateCalories(selectedItem.title, parseCal(selectedItem.details?.duration) || 30)} 
                                    <span className="text-sm font-normal text-orange-400">kcal</span>
                                </div>
                                <div className="text-xs text-orange-400 mt-1">预计消耗 ({selectedItem.details?.duration || 30}分钟)</div>
                            </div>
                        )}

                        <button onClick={() => setSelectedItem(null)} className="w-full py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200">关闭</button>
                    </div>
                </div>
            )}

            {/* 3. AI Preview Modal (Confirmation) */}
            {previewPlan && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-scaleIn">
                        <h3 className="text-xl font-bold mb-2 text-center">✨ AI 自动生成方案</h3>
                        <p className="text-xs text-center text-slate-400 mb-4">已为您从资源库自动匹配并计算营养</p>
                        
                        {/* Nutrition Summary */}
                        <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-3 gap-2 text-center mb-4">
                            <div><div className="text-xs text-slate-400">总热量</div><div className="font-bold text-teal-600">{calculatedStats.totalCal}</div></div>
                            <div><div className="text-xs text-slate-400">蛋白质</div><div className="font-bold text-slate-700">{calculatedStats.protein}g</div></div>
                            <div><div className="text-xs text-slate-400">预计消耗</div><div className="font-bold text-orange-500">{calculatedStats.burn}</div></div>
                        </div>

                        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden text-sm space-y-0 mb-6 max-h-60 overflow-y-auto">
                            {previewPlan.fullMeals.map((m: any, i: number) => (
                                <div key={i} className="p-3 border-b border-slate-50 flex justify-between">
                                    <span className="font-bold text-slate-700">{i===0?'早':i===1?'午':'晚'}: {m.title}</span>
                                    <span className="text-xs text-slate-400">{m.details?.cal} kcal</span>
                                </div>
                            ))}
                            {previewPlan.fullExercises.map((e: any, i: number) => (
                                <div key={i} className="p-3 bg-orange-50/50 flex justify-between">
                                    <span className="font-bold text-orange-800">🏃 {e.title}</span>
                                    <span className="text-xs text-orange-600">{e.details?.duration} min</span>
                                </div>
                            ))}
                            <div className="p-3 text-xs text-slate-500 italic bg-slate-50">"{previewPlan.tips}"</div>
                        </div>
                        
                        <div className="flex gap-2">
                            <button onClick={() => setPreviewPlan(null)} className="flex-1 py-3 border rounded-xl text-sm font-bold text-slate-500">取消</button>
                            <button onClick={handleConfirmPlan} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg">确认应用此方案</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Sub Components ---
const MacroProgress = ({ label, current, target, color }: any) => {
    const pct = Math.min(100, (current / target) * 100);
    return (
        <div className="flex flex-col items-center">
            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">{label}</div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }}></div>
            </div>
            <div className="text-[10px] font-mono text-slate-600">{current}/{target}g</div>
        </div>
    );
};

const MacroBox = ({ label, val, unit, highlight }: any) => (
    <div className={`text-center p-2 rounded-lg border ${highlight ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-100'}`}>
        <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
        <div className={`font-bold ${highlight ? 'text-teal-700' : 'text-slate-700'}`}>{val || 0}<span className="text-[9px] font-normal">{unit}</span></div>
    </div>
);
