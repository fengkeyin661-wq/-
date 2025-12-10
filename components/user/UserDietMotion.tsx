
import React, { useState, useEffect, useMemo } from 'react';
import { fetchContent, saveContent, ContentItem } from '../../services/contentService';
import { HealthAssessment, HealthRecord } from '../../types';
import { generateDailyIntegratedPlan } from '../../services/geminiService';
import { updateUserPlan, DailyHealthPlan, DietLogItem, ExerciseLogItem } from '../../services/dataService';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface Props {
    assessment?: HealthAssessment;
    userCheckupId?: string;
    record?: HealthRecord;
    dailyPlan?: DailyHealthPlan;
}

// Helper to calculate BMR and Needs
const calculateNeeds = (record?: HealthRecord) => {
    if (!record) return { bmr: 0, tdee: 0, protein: 0, fat: 0, carbs: 0, fiber: 25 };
    
    const weight = record.checkup.basics.weight || 65;
    const height = record.checkup.basics.height || 170;
    const age = record.profile.age || 40;
    const gender = record.profile.gender || '男';

    // Mifflin-St Jeor Equation
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += gender === '女' ? -161 : 5;

    // Light Activity Factor (Office work + light exercise)
    const tdee = Math.round(bmr * 1.375);

    // Macronutrients (Standard Balance)
    // Protein: ~15-20% (or 1g/kg)
    const proteinCal = tdee * 0.18; 
    const proteinG = Math.round(proteinCal / 4);

    // Fat: ~25-30%
    const fatCal = tdee * 0.28;
    const fatG = Math.round(fatCal / 9);

    // Carbs: ~50-55%
    const carbsCal = tdee * 0.54;
    const carbsG = Math.round(carbsCal / 4);

    return { 
        bmr: Math.round(bmr), 
        tdee, 
        protein: proteinG, 
        fat: fatG, 
        carbs: carbsG, 
        fiber: 25 // Standard guideline > 25g
    };
};

export const UserDietMotion: React.FC<Props> = ({ assessment, userCheckupId, record, dailyPlan }) => {
    const [meals, setMeals] = useState<ContentItem[]>([]);
    const [exercises, setExercises] = useState<ContentItem[]>([]);
    
    // UI State
    const [showUpload, setShowUpload] = useState(false);
    const [showAddLog, setShowAddLog] = useState<'diet' | 'exercise' | null>(null);
    const [uploadType, setUploadType] = useState<'meal'|'exercise'>('meal');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSavingLog, setIsSavingLog] = useState(false);

    // Search & Expand State
    const [searchTerm, setSearchTerm] = useState('');
    const [isContentExpanded, setIsContentExpanded] = useState(false);

    // Preview Modal State
    const [previewPlan, setPreviewPlan] = useState<any>(null);
    const [recommendedItems, setRecommendedItems] = useState<ContentItem[]>([]);

    // Content Detail Modal
    const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);

    // Manual Log Forms
    const [dietForm, setDietForm] = useState<Omit<DietLogItem, 'id'>>({
        name: '', calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, type: 'lunch'
    });
    const [exForm, setExForm] = useState<Omit<ExerciseLogItem, 'id'>>({
        name: '', calories: 0, duration: 30
    });

    // Upload Content Form State
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newTags, setNewTags] = useState('');

    const recommended = useMemo(() => calculateNeeds(record), [record]);

    // Current Totals
    const currentIntake = useMemo(() => {
        if (!dailyPlan?.dietLogs) return { cal: 0, p: 0, f: 0, c: 0, fib: 0 };
        return dailyPlan.dietLogs.reduce((acc, item) => ({
            cal: acc.cal + Number(item.calories),
            p: acc.p + Number(item.protein),
            f: acc.f + Number(item.fat),
            c: acc.c + Number(item.carbs),
            fib: acc.fib + Number(item.fiber),
        }), { cal: 0, p: 0, f: 0, c: 0, fib: 0 });
    }, [dailyPlan]);

    const currentBurn = useMemo(() => {
        if (!dailyPlan?.exerciseLogs) return 0;
        return dailyPlan.exerciseLogs.reduce((acc, item) => acc + Number(item.calories), 0);
    }, [dailyPlan]);

    // Derived Net Calories
    const netCalories = currentIntake.cal - currentBurn;
    const balance = Math.round(((netCalories) / recommended.tdee) * 100); 
    const isOver = netCalories > recommended.tdee;

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        const [mealsData, exercisesData] = await Promise.all([
            fetchContent('meal'),
            fetchContent('exercise')
        ]);
        setMeals(mealsData);
        setExercises(exercisesData);
    };

    const handleUpload = async () => {
        if (!newTitle) return;
        const newItem: ContentItem = {
            id: Date.now().toString(),
            type: uploadType,
            title: newTitle,
            description: newDesc,
            tags: newTags.split(/[,， ]+/).filter(Boolean),
            image: uploadType === 'meal' ? '🍲' : '🏃‍♂️',
            author: '我',
            isUserUpload: true,
            status: 'active',
            updatedAt: new Date().toISOString(),
            details: {}
        };
        await saveContent(newItem);
        setShowUpload(false);
        setNewTitle(''); setNewDesc(''); setNewTags('');
        loadAllData();
        alert("发布成功！");
    };

    const handleGenerateOneClick = async () => {
        if (!assessment || !userCheckupId) {
            alert("需要完善健康档案后才能生成方案");
            return;
        }
        setIsGenerating(true);
        try {
            const profileStr = `风险评估:${assessment.summary}, 风险点:${assessment.risks.red.join(',')}, ${assessment.risks.yellow.join(',')}`;
            
            // Prepare resource context
            const resourceContext = JSON.stringify({
                meals: meals.slice(0, 30).map(m => ({ id: m.id, name: m.title, tags: m.tags })),
                exercises: exercises.slice(0, 10).map(e => ({ id: e.id, name: e.title, tags: e.tags }))
            });

            const plan = await generateDailyIntegratedPlan(profileStr, resourceContext);
            
            // Resolve recommendations
            const recIds = [...(plan.recommendedMealIds || []), ...(plan.recommendedExerciseIds || [])];
            const recItems = [...meals, ...exercises].filter(i => recIds.includes(i.id));
            
            setPreviewPlan(plan);
            setRecommendedItems(recItems);
            
        } catch (e) {
            console.error(e);
            alert("生成失败，请重试");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirmPlan = async () => {
        if (!previewPlan || !userCheckupId) return;
        
        setIsSavingLog(true);
        
        // 1. Convert Recommended Items to Logs
        const newDietLogs: DietLogItem[] = recommendedItems
            .filter(i => i.type === 'meal')
            .map(i => ({
                id: Date.now().toString() + Math.random().toString(36).substr(2,5),
                name: i.title,
                calories: Number(i.details?.cal) || 0,
                protein: Number(i.details?.macros?.protein) || 0,
                fat: Number(i.details?.macros?.fat) || 0,
                carbs: Number(i.details?.macros?.carbs) || 0,
                fiber: Number(i.details?.macros?.fiber) || 0,
                type: 'lunch' // Default, user can adjust later if we had that UI
            }));

        const newExerciseLogs: ExerciseLogItem[] = recommendedItems
            .filter(i => i.type === 'exercise')
            .map(i => ({
                id: Date.now().toString() + Math.random().toString(36).substr(2,5),
                name: i.title,
                calories: Number(i.details?.cal) || 100, // Estimate
                duration: Number(i.details?.duration) || 30
            }));

        // 2. Merge with existing logs
        const newDailyPlan: DailyHealthPlan = {
            generatedAt: new Date().toISOString(),
            diet: previewPlan.diet,
            exercise: previewPlan.exercise,
            tips: previewPlan.tips,
            dietLogs: [...(dailyPlan?.dietLogs || []), ...newDietLogs],
            exerciseLogs: [...(dailyPlan?.exerciseLogs || []), ...newExerciseLogs]
        };

        // 3. Save
        try {
            const success = await updateUserPlan(userCheckupId, newDailyPlan);
            if (success) {
                alert("方案已保存！请前往【我的 - 饮食与运动方案】查看详细记录。");
                // Optional: reload to ensure data consistency if parent doesn't auto-refresh
                window.location.reload(); 
            } else {
                alert("保存失败，请重试");
            }
        } catch (e) {
            console.error("Save plan failed", e);
            alert("保存过程发生错误");
        }
        setIsSavingLog(false);
        setPreviewPlan(null);
    };

    const handleAddLog = async () => {
        if (!userCheckupId) return;
        setIsSavingLog(true);
        
        let newPlan = dailyPlan;
        if (!newPlan) {
            newPlan = {
                generatedAt: new Date().toISOString(),
                diet: { breakfast: '', lunch: '', dinner: '', snack: '' },
                exercise: { morning: '', afternoon: '', evening: '' },
                tips: '',
                dietLogs: [],
                exerciseLogs: []
            };
        }

        if (showAddLog === 'diet') {
            if (!dietForm.name) return alert("请输入食物名称");
            const logItem: DietLogItem = { ...dietForm, id: Date.now().toString() };
            newPlan = { ...newPlan, dietLogs: [...(newPlan.dietLogs || []), logItem] };
        } else if (showAddLog === 'exercise') {
            if (!exForm.name) return alert("请输入运动名称");
            const logItem: ExerciseLogItem = { ...exForm, id: Date.now().toString() };
            newPlan = { ...newPlan, exerciseLogs: [...(newPlan.exerciseLogs || []), logItem] };
        }

        const success = await updateUserPlan(userCheckupId, newPlan);
        if (success) {
            alert("记录添加成功！");
            window.location.reload();
        } else {
            alert("保存失败");
        }
        setIsSavingLog(false);
        setShowAddLog(null);
        setDietForm({ name: '', calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, type: 'lunch' });
        setExForm({ name: '', calories: 0, duration: 30 });
    };

    const handleAddFromCard = async () => {
        if (!selectedContent || !userCheckupId) return;
        
        setIsSavingLog(true);
        let newPlan = dailyPlan;
        if (!newPlan) {
            newPlan = {
                generatedAt: new Date().toISOString(),
                diet: { breakfast: '', lunch: '', dinner: '', snack: '' },
                exercise: { morning: '', afternoon: '', evening: '' },
                tips: '',
                dietLogs: [],
                exerciseLogs: []
            };
        }

        if (selectedContent.type === 'meal') {
            const logItem: DietLogItem = {
                id: Date.now().toString(),
                name: selectedContent.title,
                calories: Number(selectedContent.details?.cal) || 0,
                protein: Number(selectedContent.details?.macros?.protein) || 0,
                fat: Number(selectedContent.details?.macros?.fat) || 0,
                carbs: Number(selectedContent.details?.macros?.carbs) || 0,
                fiber: Number(selectedContent.details?.macros?.fiber) || 0,
                type: 'lunch' // Default
            };
            newPlan = { ...newPlan, dietLogs: [...(newPlan.dietLogs || []), logItem] };
        } else if (selectedContent.type === 'exercise') {
            const logItem: ExerciseLogItem = {
                id: Date.now().toString(),
                name: selectedContent.title,
                calories: Number(selectedContent.details?.cal) || 100, // Estimate if missing
                duration: Number(selectedContent.details?.duration) || 30
            };
            newPlan = { ...newPlan, exerciseLogs: [...(newPlan.exerciseLogs || []), logItem] };
        }

        const success = await updateUserPlan(userCheckupId, newPlan);
        if (success) {
            alert(`已将【${selectedContent.title}】加入今日记录！`);
            window.location.reload();
        }
        setIsSavingLog(false);
        setSelectedContent(null);
    };

    // Filter Content based on search
    const filteredContent = useMemo(() => {
        const all = [...meals, ...exercises];
        if (!searchTerm) return all;
        const lowerSearch = searchTerm.toLowerCase();
        return all.filter(item => 
            item.title.toLowerCase().includes(lowerSearch) || 
            item.tags.some(t => t.toLowerCase().includes(lowerSearch))
        );
    }, [meals, exercises, searchTerm]);

    // Chart Data
    const macroData = [
        { name: '蛋白质', current: currentIntake.p, target: recommended.protein, unit: 'g', color: '#3b82f6' },
        { name: '脂肪', current: currentIntake.f, target: recommended.fat, unit: 'g', color: '#eab308' },
        { name: '碳水', current: currentIntake.c, target: recommended.carbs, unit: 'g', color: '#10b981' },
        { name: '膳食纤维', current: currentIntake.fib, target: recommended.fiber, unit: 'g', color: '#8b5cf6' },
    ];

    const balanceData = [
        { name: '已摄入', value: netCalories < 0 ? 0 : netCalories }, // Net (Food - Exercise)
        { name: '剩余', value: Math.max(0, recommended.tdee - netCalories) }
    ];

    return (
        <div className="bg-[#F8FAFC] min-h-full pb-24">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-sm">
                <div className="px-6 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">健康生活</h1>
                        <p className="text-xs text-slate-500">今日推荐: {recommended.tdee} kcal</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowAddLog('exercise')} className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold hover:bg-orange-200">🏃</button>
                        <button onClick={() => setShowAddLog('diet')} className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-bold hover:bg-teal-200">🥗</button>
                        <button onClick={() => { setUploadType('meal'); setShowUpload(true); }} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold hover:bg-slate-200">+</button>
                    </div>
                </div>
                {/* Search Bar */}
                <div className="px-6 pb-3">
                    <div className="relative">
                        <input 
                            className="w-full bg-slate-100 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:bg-white focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                            placeholder="搜索食谱、运动..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                    </div>
                </div>
            </div>

            {/* Dashboard Section */}
            <div className="p-4 space-y-4">
                {/* 1. Calorie Balance Card */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex items-center gap-6">
                    <div className="w-28 h-28 relative flex items-center justify-center">
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie data={balanceData} innerRadius={35} outerRadius={45} dataKey="value" startAngle={90} endAngle={-270} stroke="none">
                                    <Cell fill={isOver ? '#ef4444' : '#14b8a6'} />
                                    <Cell fill="#f1f5f9" />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute text-center">
                            <div className="text-[10px] text-slate-400">热量平衡</div>
                            <div className={`text-xl font-black ${isOver ? 'text-red-500' : 'text-teal-600'}`}>
                                {Math.round((netCalories / recommended.tdee) * 100)}%
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">饮食摄入</span>
                            <span className="font-bold text-slate-800">{currentIntake.cal} kcal</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">运动消耗</span>
                            <span className="font-bold text-orange-500">-{currentBurn} kcal</span>
                        </div>
                        <div className="w-full h-px bg-slate-100"></div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">推荐剩余</span>
                            <span className="font-bold text-teal-600">
                                {Math.max(0, recommended.tdee - netCalories)} kcal
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. Nutrient Progress */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 text-sm mb-4">营养素摄入 (NRV%)</h3>
                    <div className="space-y-4">
                        {macroData.map((m, i) => {
                            const pct = Math.min(100, Math.round((m.current / m.target) * 100));
                            return (
                                <div key={i}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-slate-600">{m.name}</span>
                                        <span className="text-slate-400">{m.current}/{m.target}{m.unit}</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full rounded-full transition-all duration-500" 
                                            style={{ width: `${pct}%`, backgroundColor: m.color }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 3. My Logs */}
                {(dailyPlan?.dietLogs?.length || dailyPlan?.exerciseLogs?.length) ? (
                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-800 text-sm px-2">今日记录</h3>
                        {dailyPlan?.dietLogs?.map((log, i) => (
                            <div key={`d-${i}`} className="bg-white p-3 rounded-2xl flex justify-between items-center border border-slate-50">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">🥗</span>
                                    <div>
                                        <div className="text-sm font-bold text-slate-700">{log.name}</div>
                                        <div className="text-[10px] text-slate-400">
                                            P:{log.protein} F:{log.fat} C:{log.carbs}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-teal-600">+{log.calories}</span>
                            </div>
                        ))}
                        {dailyPlan?.exerciseLogs?.map((log, i) => (
                            <div key={`e-${i}`} className="bg-white p-3 rounded-2xl flex justify-between items-center border border-slate-50">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">🏃</span>
                                    <div>
                                        <div className="text-sm font-bold text-slate-700">{log.name}</div>
                                        <div className="text-[10px] text-slate-400">{log.duration} 分钟</div>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-orange-500">-{log.calories}</span>
                            </div>
                        ))}
                    </div>
                ) : null}

                {/* 4. AI Plan (Existing) */}
                {dailyPlan && dailyPlan.diet.breakfast && (
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-2">今日 AI 推荐方案</h3>
                            <div className="text-xs space-y-1 opacity-90">
                                <p>🍳 早: {dailyPlan.diet.breakfast}</p>
                                <p>🍱 午: {dailyPlan.diet.lunch}</p>
                                <p>🥗 晚: {dailyPlan.diet.dinner}</p>
                                <div className="mt-2 pt-2 border-t border-white/20">
                                    <p>💡 {dailyPlan.tips}</p>
                                </div>
                            </div>
                        </div>
                        <div className="absolute -right-4 -bottom-4 text-8xl opacity-10">✨</div>
                    </div>
                )}

                {/* 5. Generator Button */}
                <div className="flex justify-center pb-4">
                    <button 
                        onClick={handleGenerateOneClick}
                        disabled={isGenerating}
                        className="bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-transform flex items-center gap-2"
                    >
                        {isGenerating ? '⏳ 生成中...' : '✨ (重新)生成今日方案'}
                    </button>
                </div>

                {/* 6. Content Feed (Expandable Grid) */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-teal-500 rounded-full"></span>
                            推荐食谱 & 运动
                        </h2>
                        {filteredContent.length > 3 && (
                            <button 
                                onClick={() => setIsContentExpanded(!isContentExpanded)}
                                className="text-xs font-bold text-teal-600 flex items-center gap-1"
                            >
                                {isContentExpanded ? '收起 ⬆️' : '全部 ⬇️'}
                            </button>
                        )}
                    </div>
                    
                    <div className={
                        isContentExpanded 
                        ? "grid grid-cols-2 gap-4 animate-fadeIn" 
                        : "flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 scrollbar-hide snap-x"
                    }>
                        {filteredContent.map(item => (
                            <div 
                                key={item.id} 
                                onClick={() => setSelectedContent(item)}
                                className={`bg-white rounded-2xl p-2 shadow-sm border border-slate-100 flex flex-col cursor-pointer active:scale-95 transition-transform ${
                                    isContentExpanded ? 'w-full' : 'snap-center shrink-0 w-40'
                                }`}
                            >
                                <div className="aspect-square bg-slate-50 rounded-xl flex items-center justify-center text-4xl mb-2">
                                    {item.image}
                                </div>
                                <h3 className="font-bold text-slate-800 text-xs truncate px-1">{item.title}</h3>
                                <div className="flex gap-1 mt-1 px-1">
                                    {item.tags.slice(0, 1).map((t, i) => (
                                        <span key={i} className="text-[8px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded">{t}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {filteredContent.length === 0 && <div className="text-slate-400 text-xs w-full text-center py-4">无相关内容</div>}
                    </div>
                </section>
            </div>

            {/* Plan Preview Modal (New) */}
            {previewPlan && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-0 shadow-2xl animate-scaleIn overflow-hidden max-h-[85vh] flex flex-col">
                        <div className="bg-gradient-to-r from-teal-500 to-emerald-600 p-6 text-white shrink-0">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                ✨ 今日专属推荐
                            </h3>
                            <p className="text-xs opacity-80 mt-1">AI 结合您的健康档案与资源库智能生成</p>
                        </div>
                        
                        <div className="p-6 flex-1 overflow-y-auto space-y-6">
                            {/* Text Plan */}
                            <div className="space-y-3">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">饮食建议</div>
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-700 space-y-1">
                                    <div className="flex gap-2"><span className="text-teal-600 font-bold">早</span> {previewPlan.diet.breakfast}</div>
                                    <div className="flex gap-2"><span className="text-teal-600 font-bold">午</span> {previewPlan.diet.lunch}</div>
                                    <div className="flex gap-2"><span className="text-teal-600 font-bold">晚</span> {previewPlan.diet.dinner}</div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">运动建议</div>
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-700 space-y-1">
                                    {previewPlan.exercise.morning && <div>🌅 {previewPlan.exercise.morning}</div>}
                                    {previewPlan.exercise.afternoon && <div>🌇 {previewPlan.exercise.afternoon}</div>}
                                    {previewPlan.exercise.evening && <div>🌙 {previewPlan.exercise.evening}</div>}
                                </div>
                            </div>

                            {/* Recommended Cards */}
                            {recommendedItems.length > 0 && (
                                <div className="space-y-3">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                                        <span>精选内容 (点击添加)</span>
                                        <span className="text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full text-[10px]">{recommendedItems.length}项</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {recommendedItems.map(item => (
                                            <div key={item.id} className="bg-white border border-teal-100 p-2 rounded-xl shadow-sm flex flex-col items-center text-center">
                                                <div className="text-2xl mb-1">{item.image}</div>
                                                <div className="text-xs font-bold text-slate-700 line-clamp-1">{item.title}</div>
                                                <div className="text-[10px] text-slate-400 mt-1">
                                                    {item.type === 'meal' ? `${item.details?.cal} kcal` : `${item.details?.duration} min`}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                            <button onClick={() => setPreviewPlan(null)} className="flex-1 py-3 text-slate-500 font-bold text-sm bg-white border border-slate-200 rounded-xl">取消</button>
                            <button 
                                onClick={handleConfirmPlan} 
                                disabled={isSavingLog}
                                className="flex-[2] py-3 bg-teal-600 text-white font-bold text-sm rounded-xl shadow-lg hover:bg-teal-700 disabled:opacity-50"
                            >
                                {isSavingLog ? '应用中...' : '确认并加入今日记录'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Content Detail Modal */}
            {selectedContent && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedContent(null)}>
                    <div className="bg-white w-full sm:w-96 rounded-t-3xl sm:rounded-3xl p-6 animate-slideUp max-h-[90vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="text-center mb-4">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-5xl mx-auto mb-3 shadow-inner">
                                {selectedContent.image}
                            </div>
                            <h3 className="text-xl font-black text-slate-800 leading-tight">{selectedContent.title}</h3>
                            <div className="flex justify-center gap-2 mt-2">
                                {selectedContent.tags.map(t => <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t}</span>)}
                            </div>
                        </div>

                        <div className="space-y-4 flex-1 overflow-y-auto mb-4">
                            <div className="bg-slate-50 p-4 rounded-xl">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase">核心数据</span>
                                    <span className="text-sm font-bold text-teal-600">{selectedContent.details?.cal || 0} kcal</span>
                                </div>
                                {selectedContent.type === 'meal' && selectedContent.details?.macros && (
                                    <div className="grid grid-cols-4 gap-2 text-center">
                                        <div className="bg-white p-1 rounded"><div className="text-[10px] text-slate-400">蛋</div><div className="text-xs font-bold">{selectedContent.details.macros.protein}</div></div>
                                        <div className="bg-white p-1 rounded"><div className="text-[10px] text-slate-400">脂</div><div className="text-xs font-bold">{selectedContent.details.macros.fat}</div></div>
                                        <div className="bg-white p-1 rounded"><div className="text-[10px] text-slate-400">碳</div><div className="text-xs font-bold">{selectedContent.details.macros.carbs}</div></div>
                                        <div className="bg-white p-1 rounded"><div className="text-[10px] text-slate-400">纤</div><div className="text-xs font-bold">{selectedContent.details.macros.fiber}</div></div>
                                    </div>
                                )}
                                {selectedContent.type === 'exercise' && (
                                    <div className="text-sm text-slate-600">
                                        时长: {selectedContent.details?.duration} 分钟 | 强度: {selectedContent.details?.intensity}
                                    </div>
                                )}
                            </div>

                            <div className="text-sm text-slate-600 leading-relaxed">
                                <h4 className="font-bold text-slate-800 mb-1">简介</h4>
                                {selectedContent.description || '暂无描述'}
                            </div>

                            {selectedContent.details?.steps && (
                                <div className="text-sm text-slate-600 leading-relaxed">
                                    <h4 className="font-bold text-slate-800 mb-1">{selectedContent.type === 'meal' ? '制作步骤' : '动作要领'}</h4>
                                    <p className="whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                                        {selectedContent.details.steps}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setSelectedContent(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm">关闭</button>
                            <button 
                                onClick={handleAddFromCard}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm text-white shadow-lg flex items-center justify-center gap-2 ${
                                    selectedContent.type === 'meal' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-orange-500 hover:bg-orange-600'
                                }`}
                            >
                                <span>+</span> 加入今日记录
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Log Modal */}
            {showAddLog && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scaleIn">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">
                            添加{showAddLog === 'diet' ? '饮食' : '运动'}记录
                        </h3>
                        
                        <div className="space-y-3 mb-6">
                            {showAddLog === 'diet' ? (
                                <>
                                    <input className="w-full border rounded p-2 text-sm" placeholder="食物名称" value={dietForm.name} onChange={e=>setDietForm({...dietForm, name: e.target.value})} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input type="number" className="border rounded p-2 text-sm" placeholder="热量(kcal)" value={dietForm.calories || ''} onChange={e=>setDietForm({...dietForm, calories: Number(e.target.value)})} />
                                        <select className="border rounded p-2 text-sm bg-white" value={dietForm.type} onChange={e=>setDietForm({...dietForm, type: e.target.value as any})}>
                                            <option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="snack">加餐</option>
                                        </select>
                                    </div>
                                    <div className="text-xs font-bold text-slate-500 mt-2">营养素 (克)</div>
                                    <div className="grid grid-cols-4 gap-2">
                                        <input type="number" className="border rounded p-1 text-xs text-center" placeholder="蛋" value={dietForm.protein || ''} onChange={e=>setDietForm({...dietForm, protein: Number(e.target.value)})} />
                                        <input type="number" className="border rounded p-1 text-xs text-center" placeholder="脂" value={dietForm.fat || ''} onChange={e=>setDietForm({...dietForm, fat: Number(e.target.value)})} />
                                        <input type="number" className="border rounded p-1 text-xs text-center" placeholder="碳" value={dietForm.carbs || ''} onChange={e=>setDietForm({...dietForm, carbs: Number(e.target.value)})} />
                                        <input type="number" className="border rounded p-1 text-xs text-center" placeholder="纤" value={dietForm.fiber || ''} onChange={e=>setDietForm({...dietForm, fiber: Number(e.target.value)})} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <input className="w-full border rounded p-2 text-sm" placeholder="运动名称" value={exForm.name} onChange={e=>setExForm({...exForm, name: e.target.value})} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input type="number" className="border rounded p-2 text-sm" placeholder="消耗热量(kcal)" value={exForm.calories || ''} onChange={e=>setExForm({...exForm, calories: Number(e.target.value)})} />
                                        <input type="number" className="border rounded p-2 text-sm" placeholder="时长(分钟)" value={exForm.duration || ''} onChange={e=>setExForm({...exForm, duration: Number(e.target.value)})} />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowAddLog(null)} className="flex-1 py-2 text-slate-500 bg-slate-50 rounded-xl font-bold text-sm">取消</button>
                            <button onClick={handleAddLog} disabled={isSavingLog} className="flex-1 py-2 bg-teal-600 text-white rounded-xl font-bold text-sm shadow-lg">
                                {isSavingLog ? '保存中...' : '确认添加'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Modal (Existing) */}
            {showUpload && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-t-3xl w-full max-w-md p-6 animate-slideUp shadow-2xl">
                        <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6"></div>
                        <h3 className="text-xl font-bold text-slate-800 mb-4">发布新内容 (社区分享)</h3>
                        <div className="space-y-4">
                            <input className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-bold" placeholder="标题" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                            <textarea className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm h-24 resize-none" placeholder="描述" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                            <input className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm" placeholder="标签" value={newTags} onChange={e => setNewTags(e.target.value)} />
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowUpload(false)} className="flex-1 py-3 text-slate-500 bg-slate-50 rounded-xl font-bold text-sm">取消</button>
                            <button onClick={handleUpload} className="flex-1 py-3 bg-teal-600 text-white font-bold rounded-xl shadow-lg">发布</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
