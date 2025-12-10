
import React, { useState, useEffect, useMemo } from 'react';
import { fetchContent, saveContent, ContentItem } from '../../services/contentService';
import { HealthAssessment, HealthRecord } from '../../types';
import { generateDailyIntegratedPlan } from '../../services/geminiService';
import { updateUserPlan, DailyHealthPlan, DietLogItem, ExerciseLogItem } from '../../services/dataService';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

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
            const plan = await generateDailyIntegratedPlan(profileStr);
            const newDailyPlan: DailyHealthPlan = {
                generatedAt: new Date().toISOString(),
                ...plan,
                dietLogs: dailyPlan?.dietLogs || [], // Preserve logs
                exerciseLogs: dailyPlan?.exerciseLogs || []
            };
            
            const success = await updateUserPlan(userCheckupId, newDailyPlan);
            if (success) {
                alert("方案已生成并保存！");
                window.location.reload(); // Force refresh to show new plan
            } else {
                alert("生成成功但保存失败，请检查网络");
            }
        } catch (e) {
            alert("生成失败，请重试");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAddLog = async () => {
        if (!userCheckupId) return;
        setIsSavingLog(true);
        
        let newPlan = dailyPlan;
        
        // If no plan exists, create an empty structure
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
            // Need to update local state via props refresh in real app, but here we can't easily trigger parent refresh without callback.
            // For now, reload window is simplest approach in this constraint environment, or just accept optimistic update is hard.
            // Let's assume parent passes dailyPlan which updates on refresh. 
            // We will trigger a window reload or alert.
            alert("记录添加成功！");
            window.location.reload();
        } else {
            alert("保存失败");
        }
        setIsSavingLog(false);
        setShowAddLog(null);
        // Reset forms
        setDietForm({ name: '', calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, type: 'lunch' });
        setExForm({ name: '', calories: 0, duration: 30 });
    };

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
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-black text-slate-800 tracking-tight">健康生活</h1>
                    <p className="text-xs text-slate-500">今日推荐摄入: {recommended.tdee} kcal</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowAddLog('exercise')} className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold hover:bg-orange-200">🏃</button>
                    <button onClick={() => setShowAddLog('diet')} className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-bold hover:bg-teal-200">🥗</button>
                    <button onClick={() => { setUploadType('meal'); setShowUpload(true); }} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold hover:bg-slate-200">+</button>
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

                {/* 6. Content Feed (Existing) */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-teal-500 rounded-full"></span>
                            推荐食谱
                        </h2>
                    </div>
                    <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 scrollbar-hide snap-x">
                        {meals.map(item => (
                            <div key={item.id} className="snap-center shrink-0 w-40 bg-white rounded-2xl p-2 shadow-sm border border-slate-100 flex flex-col">
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
                    </div>
                </section>
            </div>

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
