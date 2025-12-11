
import React, { useState, useEffect, useMemo } from 'react';
import { fetchContent, ContentItem } from '../../services/contentService';
import { HealthAssessment, HealthRecord } from '../../types';
import { generateDailyIntegratedPlan } from '../../services/geminiService';
import { updateUserPlan, DailyHealthPlan, DietLogItem, ExerciseLogItem, findArchiveByCheckupId } from '../../services/dataService';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface Props {
    assessment?: HealthAssessment;
    userCheckupId?: string;
    record?: HealthRecord;
    dailyPlan?: DailyHealthPlan;
    onRefresh?: () => void;
}

// --- Icons & Helpers ---
const getSmartIcon = (title: string, type: 'meal' | 'exercise'): string => {
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
    { id: 'snack', label: '加餐', icon: '🥨', color: 'bg-pink-50 text-pink-600' }
];

// --- Main Component ---
export const UserDietMotion: React.FC<Props> = ({ assessment, userCheckupId, record, dailyPlan, onRefresh }) => {
    const [allMeals, setAllMeals] = useState<ContentItem[]>([]);
    const [allExercises, setAllExercises] = useState<ContentItem[]>([]);
    
    // UI State
    const [activeTab, setActiveTab] = useState<'diary' | 'resources'>('diary');
    const [searchTerm, setSearchTerm] = useState('');
    const [resourceFilter, setResourceFilter] = useState<'all' | 'meal' | 'exercise'>('all');
    
    // Modals
    const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    
    // AI Gen State
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewPlan, setPreviewPlan] = useState<any>(null);
    const [recommendedItems, setRecommendedItems] = useState<ContentItem[]>([]);

    // Manual Form
    const [manualForm, setManualForm] = useState<Partial<DietLogItem & ExerciseLogItem>>({ 
        name: '', calories: undefined, protein: undefined, fat: undefined, carbs: undefined, type: 'lunch' 
    });
    const [manualType, setManualType] = useState<'meal' | 'exercise'>('meal');

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

    // --- 2. Current Intake Calculations ---
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
            const [m, e] = await Promise.all([fetchContent('meal'), fetchContent('exercise')]);
            setAllMeals(m); setAllExercises(e);
        };
        load();
    }, []);

    // --- Logic: Add Log ---
    const handleAddLog = async (item: Partial<DietLogItem> | Partial<ExerciseLogItem>, type: 'meal' | 'exercise') => {
        if (!userCheckupId) return;
        
        // 1. Get Fresh Data
        let currentDiet = dailyPlan?.dietLogs || [];
        let currentEx = dailyPlan?.exerciseLogs || [];
        
        try {
            const fresh = await findArchiveByCheckupId(userCheckupId);
            if(fresh?.custom_daily_plan) {
                currentDiet = fresh.custom_daily_plan.dietLogs || [];
                currentEx = fresh.custom_daily_plan.exerciseLogs || [];
            }
        } catch(e) {}

        // 2. Prepare Payload
        const newPlan = dailyPlan || { generatedAt: new Date().toISOString(), diet: {} as any, exercise: {} as any, tips: '', dietLogs: [], exerciseLogs: [] };
        
        if (type === 'meal') {
            const log: DietLogItem = {
                id: Date.now().toString(),
                name: item.name || '未知餐食',
                calories: Number(item.calories) || 0,
                protein: Number((item as DietLogItem).protein) || 0,
                fat: Number((item as DietLogItem).fat) || 0,
                carbs: Number((item as DietLogItem).carbs) || 0,
                fiber: 0,
                type: (item as DietLogItem).type || 'lunch'
            };
            newPlan.dietLogs = [...currentDiet, log];
        } else {
            const log: ExerciseLogItem = {
                id: Date.now().toString(),
                name: item.name || '未知运动',
                calories: Number(item.calories) || 0,
                duration: (item as ExerciseLogItem).duration || 30
            };
            newPlan.exerciseLogs = [...currentEx, log];
        }

        // 3. Save
        const success = await updateUserPlan(userCheckupId, newPlan);
        if (success) {
            setSelectedItem(null);
            setIsManualModalOpen(false);
            if(onRefresh) onRefresh();
        } else {
            alert("保存失败");
        }
    };

    // --- Logic: AI Generation ---
    const handleGenerate = async () => {
        if (!assessment || !userCheckupId) return alert("请先完善档案");
        setIsGenerating(true);
        try {
            const context = JSON.stringify({
                meals: allMeals.slice(0, 30).map(m => ({ id: m.id, name: m.title })),
                exercises: allExercises.slice(0, 10).map(e => ({ id: e.id, name: e.title }))
            });
            const profileStr = `风险:${assessment.riskLevel}, ${assessment.summary}`;
            const plan = await generateDailyIntegratedPlan(profileStr, context);
            
            // Map IDs back to objects for display preview
            const recIds = [...(plan.recommendedMealIds || []), ...(plan.recommendedExerciseIds || [])];
            const recItems = [...allMeals, ...allExercises].filter(i => recIds.includes(i.id));
            
            setPreviewPlan(plan);
            setRecommendedItems(recItems);
        } catch (e) {
            console.error(e);
            alert("AI 生成服务繁忙，请稍后再试");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirmPlan = async () => {
        if (!previewPlan || !userCheckupId) return;
        
        // 1. Precise Mapping with Data Extraction
        const targetMealIds = previewPlan.recommendedMealIds || [];
        const targetExIds = previewPlan.recommendedExerciseIds || [];

        const foundMeals = allMeals.filter(m => targetMealIds.includes(m.id));
        const foundExercises = allExercises.filter(e => targetExIds.includes(e.id));
        
        // Extract Macros & Calories
        const recMeals: DietLogItem[] = foundMeals.map(i => ({
            id: Date.now() + Math.random().toString(),
            name: i.title,
            calories: Number(i.details?.cal) || 0,
            protein: Number(i.details?.macros?.protein) || 0,
            fat: Number(i.details?.macros?.fat) || 0,
            carbs: Number(i.details?.macros?.carbs) || 0,
            fiber: Number(i.details?.macros?.fiber) || 0,
            type: 'lunch' // Default, user can move later if we implement that
        }));

        const recExercises: ExerciseLogItem[] = foundExercises.map(i => ({
            id: Date.now() + Math.random().toString(),
            name: i.title,
            calories: Number(i.details?.cal) || 150,
            duration: Number(i.details?.duration) || 30
        }));

        // 2. Fetch Fresh & Merge
        let existingDietLogs = dailyPlan?.dietLogs || [];
        let existingExerciseLogs = dailyPlan?.exerciseLogs || [];
        
        try {
            const freshArchive = await findArchiveByCheckupId(userCheckupId);
            if (freshArchive && freshArchive.custom_daily_plan) {
                existingDietLogs = freshArchive.custom_daily_plan.dietLogs || [];
                existingExerciseLogs = freshArchive.custom_daily_plan.exerciseLogs || [];
            }
        } catch (e) {}

        const newPlan: DailyHealthPlan = {
            generatedAt: new Date().toISOString(),
            diet: previewPlan.diet,
            exercise: previewPlan.exercise,
            tips: previewPlan.tips,
            dietLogs: existingDietLogs,
            exerciseLogs: existingExerciseLogs,
            recommendations: {
                meals: recMeals,
                exercises: recExercises
            }
        };

        const success = await updateUserPlan(userCheckupId, newPlan);
        if (success) {
            setPreviewPlan(null);
            alert("方案已更新！推荐内容已保存至「我的方案」");
            if(onRefresh) onRefresh();
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
                        <button onClick={() => setIsManualModalOpen(true)} className="bg-white/20 hover:bg-white/30 p-2 rounded-full backdrop-blur-sm transition-colors">
                            <span className="text-xl">➕</span>
                        </button>
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
                <button onClick={() => setActiveTab('diary')} className={`text-sm font-bold pb-2 transition-all ${activeTab==='diary' ? 'text-slate-800 border-b-2 border-teal-500' : 'text-slate-400'}`}>今日日记</button>
                <button onClick={() => setActiveTab('resources')} className={`text-sm font-bold pb-2 transition-all ${activeTab==='resources' ? 'text-slate-800 border-b-2 border-teal-500' : 'text-slate-400'}`}>资源库</button>
            </div>

            {/* 3. Diary View */}
            {activeTab === 'diary' && (
                <div className="px-4 space-y-4 animate-fadeIn">
                    {/* Meal Slots */}
                    {MEAL_SLOTS.map(slot => {
                        const items = dailyPlan?.dietLogs?.filter(l => l.type === slot.id) || [];
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
                                                <span>{item.name}</span>
                                                <span className="font-mono text-slate-500">{item.calories}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-2">
                                        <button onClick={() => { setManualType('meal'); setManualForm({...manualForm, type: slot.id as any}); setIsManualModalOpen(true); }} className="text-xs text-teal-600 font-bold bg-teal-50 px-3 py-1.5 rounded-full hover:bg-teal-100">
                                            + 添加{slot.label}
                                        </button>
                                    </div>
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
                        {dailyPlan?.exerciseLogs && dailyPlan.exerciseLogs.length > 0 ? (
                            <div className="space-y-2">
                                {dailyPlan.exerciseLogs.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded px-2 -mx-2">
                                        <span>{item.name}</span>
                                        <span className="font-mono text-orange-500">-{item.calories}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-2">
                                <button onClick={() => { setManualType('exercise'); setIsManualModalOpen(true); }} className="text-xs text-orange-600 font-bold bg-orange-50 px-3 py-1.5 rounded-full hover:bg-orange-100">
                                    + 添加运动
                                </button>
                            </div>
                        )}
                    </div>

                    {/* AI Button */}
                    <button onClick={handleGenerate} disabled={isGenerating} className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-transform flex items-center justify-center gap-2">
                        {isGenerating ? '🔮 AI 正在思考中...' : '✨ 生成今日 AI 方案'}
                    </button>
                </div>
            )}

            {/* 4. Resources View (Pinterest Style) */}
            {activeTab === 'resources' && (
                <div className="px-4 animate-fadeIn">
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                        {['all', 'meal', 'exercise'].map(f => (
                            <button key={f} onClick={() => setResourceFilter(f as any)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${resourceFilter===f ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border'}`}>
                                {f==='all'?'全部':f==='meal'?'食谱':'运动'}
                            </button>
                        ))}
                    </div>
                    <div className="columns-2 gap-4 space-y-4">
                        {filteredResources.map(item => (
                            <div key={item.id} onClick={() => setSelectedItem(item)} className="break-inside-avoid bg-white p-3 rounded-xl shadow-sm border border-slate-100 cursor-pointer active:scale-95 transition-transform hover:shadow-md">
                                <div className="text-3xl mb-2 text-center py-2 bg-slate-50 rounded-lg">{getSmartIcon(item.title, item.type)}</div>
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

            {/* 1. Item Detail Modal */}
            {selectedItem && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedItem(null)}>
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-scaleIn relative overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-teal-50 to-white -z-10"></div>
                        
                        <div className="text-center mb-6 mt-2">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-5xl shadow-lg mx-auto mb-4 border-4 border-white">
                                {getSmartIcon(selectedItem.title, selectedItem.type as any)}
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
                                <div className="text-2xl font-black text-orange-600">{selectedItem.details?.cal || 100} <span className="text-sm font-normal text-orange-400">kcal</span></div>
                                <div className="text-xs text-orange-400 mt-1">预计消耗 ({selectedItem.details?.duration || 30}分钟)</div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setSelectedItem(null)} className="py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200">取消</button>
                            {selectedItem.type === 'meal' ? (
                                <button 
                                    onClick={() => handleAddLog({
                                        name: selectedItem.title,
                                        calories: selectedItem.details?.cal,
                                        protein: selectedItem.details?.macros?.protein,
                                        fat: selectedItem.details?.macros?.fat,
                                        carbs: selectedItem.details?.macros?.carbs,
                                        type: 'lunch' // Default, maybe add selector later
                                    }, 'meal')}
                                    className="py-3 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-lg"
                                >
                                    + 加入午餐
                                </button>
                            ) : (
                                <button 
                                    onClick={() => handleAddLog({
                                        name: selectedItem.title,
                                        calories: selectedItem.details?.cal,
                                        duration: selectedItem.details?.duration
                                    }, 'exercise')}
                                    className="py-3 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-lg"
                                >
                                    + 加入运动
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Manual Add Modal */}
            {isManualModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsManualModalOpen(false)}>
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-scaleIn" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-lg mb-4 text-slate-800">手动记录</h3>
                        
                        <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                            <button onClick={() => setManualType('meal')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${manualType==='meal'?'bg-white shadow text-teal-600':'text-slate-400'}`}>饮食</button>
                            <button onClick={() => setManualType('exercise')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${manualType==='exercise'?'bg-white shadow text-orange-500':'text-slate-400'}`}>运动</button>
                        </div>

                        <div className="space-y-3 mb-6">
                            <input className="w-full border p-3 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none transition-all" placeholder="名称 (如: 红烧肉)" value={manualForm.name} onChange={e => setManualForm({...manualForm, name: e.target.value})} />
                            <div className="flex gap-3">
                                <input type="number" className="flex-1 border p-3 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none" placeholder="热量 (kcal)" value={manualForm.calories || ''} onChange={e => setManualForm({...manualForm, calories: Number(e.target.value)})} />
                                {manualType === 'meal' && (
                                    <select className="flex-1 border p-3 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none" value={manualForm.type} onChange={e => setManualForm({...manualForm, type: e.target.value as any})}>
                                        {MEAL_SLOTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                    </select>
                                )}
                            </div>
                            {manualType === 'meal' && (
                                <div className="grid grid-cols-3 gap-3">
                                    <input type="number" className="border p-2 rounded-xl text-xs bg-slate-50" placeholder="蛋白(g)" onChange={e => setManualForm({...manualForm, protein: Number(e.target.value)})} />
                                    <input type="number" className="border p-2 rounded-xl text-xs bg-slate-50" placeholder="脂肪(g)" onChange={e => setManualForm({...manualForm, fat: Number(e.target.value)})} />
                                    <input type="number" className="border p-2 rounded-xl text-xs bg-slate-50" placeholder="碳水(g)" onChange={e => setManualForm({...manualForm, carbs: Number(e.target.value)})} />
                                </div>
                            )}
                        </div>

                        <button onClick={() => handleAddLog(manualForm, manualType)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 shadow-lg">
                            确认添加
                        </button>
                    </div>
                </div>
            )}

            {/* 3. AI Preview Modal */}
            {previewPlan && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-scaleIn">
                        <h3 className="text-xl font-bold mb-4 text-center">✨ AI 专属方案预览</h3>
                        <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-2xl border border-indigo-100 text-sm space-y-3 mb-6 max-h-60 overflow-y-auto">
                            <div><span className="font-bold text-indigo-600">🍳 早餐:</span> {previewPlan.diet.breakfast}</div>
                            <div><span className="font-bold text-indigo-600">🍱 午餐:</span> {previewPlan.diet.lunch}</div>
                            <div><span className="font-bold text-indigo-600">🥗 晚餐:</span> {previewPlan.diet.dinner}</div>
                            <div className="pt-2 border-t border-indigo-100 text-xs text-slate-500 italic">"{previewPlan.tips}"</div>
                        </div>
                        <p className="text-xs text-slate-400 text-center mb-4">包含 {recommendedItems.length} 项精选资源，确认后将自动匹配营养数据并存入。</p>
                        <div className="flex gap-2">
                            <button onClick={() => setPreviewPlan(null)} className="flex-1 py-3 border rounded-xl text-sm font-bold text-slate-500">取消</button>
                            <button onClick={handleConfirmPlan} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg">确认应用</button>
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
