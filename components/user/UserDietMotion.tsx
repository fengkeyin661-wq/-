
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
    onRefresh?: () => void;
}

// Helper: Get Icon
const getSmartIcon = (title: string, type: 'meal' | 'exercise'): string => {
    const t = title.toLowerCase();
    if (type === 'meal') {
        if (t.includes('鸡') || t.includes('肉') || t.includes('牛')) return '🥩';
        if (t.includes('鱼') || t.includes('海鲜')) return '🐟';
        if (t.includes('面') || t.includes('粉') || t.includes('饭')) return '🍜';
        if (t.includes('菜') || t.includes('沙拉')) return '🥗';
        return '🍱';
    } else {
        if (t.includes('跑') || t.includes('走')) return '🏃';
        if (t.includes('瑜伽')) return '🧘';
        if (t.includes('力') || t.includes('举')) return '🏋️';
        return '🤸';
    }
};

export const UserDietMotion: React.FC<Props> = ({ assessment, userCheckupId, record, dailyPlan, onRefresh }) => {
    const [allMeals, setAllMeals] = useState<ContentItem[]>([]);
    const [allExercises, setAllExercises] = useState<ContentItem[]>([]);
    
    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
    const [showAddLog, setShowAddLog] = useState<'diet' | 'exercise' | null>(null);
    
    // AI Gen State
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewPlan, setPreviewPlan] = useState<any>(null);
    const [recommendedItems, setRecommendedItems] = useState<ContentItem[]>([]);

    // Manual Forms
    const [dietForm, setDietForm] = useState<Omit<DietLogItem, 'id'>>({ name: '', calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, type: 'lunch' });
    const [exForm, setExForm] = useState<Omit<ExerciseLogItem, 'id'>>({ name: '', calories: 0, duration: 30 });

    // 1. Calculate Targets (BMR/TDEE)
    const recommended = useMemo(() => {
        if (!record) return { bmr: 0, tdee: 0, protein: 0, fat: 0, carbs: 0 };
        const weight = record.checkup.basics.weight || 65;
        const height = record.checkup.basics.height || 170;
        const age = record.profile.age || 40;
        const gender = record.profile.gender || '男';
        let bmr = (10 * weight) + (6.25 * height) - (5 * age) + (gender === '女' ? -161 : 5);
        const tdee = Math.round(bmr * 1.375);
        return {
            tdee,
            protein: Math.round(tdee * 0.18 / 4),
            fat: Math.round(tdee * 0.28 / 9),
            carbs: Math.round(tdee * 0.54 / 4)
        };
    }, [record]);

    // 2. Calculate Current Logs
    const currentIntake = useMemo(() => {
        if (!dailyPlan?.dietLogs) return { cal: 0, p: 0, f: 0, c: 0 };
        return dailyPlan.dietLogs.reduce((acc, item) => ({
            cal: acc.cal + Number(item.calories || 0),
            p: acc.p + Number(item.protein || 0),
            f: acc.f + Number(item.fat || 0),
            c: acc.c + Number(item.carbs || 0),
        }), { cal: 0, p: 0, f: 0, c: 0 });
    }, [dailyPlan]);

    const currentBurn = useMemo(() => {
        if (!dailyPlan?.exerciseLogs) return 0;
        return dailyPlan.exerciseLogs.reduce((acc, item) => acc + Number(item.calories || 0), 0);
    }, [dailyPlan]);

    const netCalories = currentIntake.cal - currentBurn;
    const remaining = Math.max(0, recommended.tdee - netCalories);
    const balanceData = [
        { name: '已摄入', value: Math.max(0, netCalories) },
        { name: '剩余', value: remaining }
    ];

    useEffect(() => {
        const load = async () => {
            const [m, e] = await Promise.all([fetchContent('meal'), fetchContent('exercise')]);
            setAllMeals(m); setAllExercises(e);
        };
        load();
    }, []);

    const filterList = (list: ContentItem[]) => {
        if (!searchTerm) return list.slice(0, 6); // Show top 6 recommendations by default
        return list.filter(i => i.title.includes(searchTerm) || i.tags.join('').includes(searchTerm));
    };

    // --- Actions ---

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
            
            // Map IDs back to objects
            const recIds = [...(plan.recommendedMealIds || []), ...(plan.recommendedExerciseIds || [])];
            const recItems = [...allMeals, ...allExercises].filter(i => recIds.includes(i.id));
            
            setPreviewPlan(plan);
            setRecommendedItems(recItems);
        } catch (e) {
            console.error(e);
            alert("生成失败");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirmPlan = async () => {
        if (!previewPlan || !userCheckupId) return;
        
        const newDietLogs: DietLogItem[] = recommendedItems.filter(i => i.type === 'meal').map(i => ({
            id: Date.now() + Math.random().toString(),
            name: i.title,
            calories: Number(i.details?.cal) || 400,
            protein: Number(i.details?.macros?.protein) || 20,
            fat: Number(i.details?.macros?.fat) || 10,
            carbs: Number(i.details?.macros?.carbs) || 50,
            fiber: 5,
            type: 'lunch'
        }));

        const newExLogs: ExerciseLogItem[] = recommendedItems.filter(i => i.type === 'exercise').map(i => ({
            id: Date.now() + Math.random().toString(),
            name: i.title,
            calories: Number(i.details?.cal) || 150,
            duration: Number(i.details?.duration) || 30
        }));

        const newPlan: DailyHealthPlan = {
            generatedAt: new Date().toISOString(),
            diet: previewPlan.diet,
            exercise: previewPlan.exercise,
            tips: previewPlan.tips,
            dietLogs: [...(dailyPlan?.dietLogs || []), ...newDietLogs],
            exerciseLogs: [...(dailyPlan?.exerciseLogs || []), ...newExLogs]
        };

        await updateUserPlan(userCheckupId, newPlan);
        setPreviewPlan(null);
        if (onRefresh) onRefresh();
    };

    const handleAddManual = async () => {
        if (!userCheckupId) return;
        let newPlan = dailyPlan || { generatedAt: '', diet: {} as any, exercise: {} as any, tips: '', dietLogs: [], exerciseLogs: [] };
        
        if (showAddLog === 'diet') {
            newPlan = { ...newPlan, dietLogs: [...(newPlan.dietLogs || []), { ...dietForm, id: Date.now().toString() }] };
        } else {
            newPlan = { ...newPlan, exerciseLogs: [...(newPlan.exerciseLogs || []), { ...exForm, id: Date.now().toString() }] };
        }
        
        await updateUserPlan(userCheckupId, newPlan);
        setShowAddLog(null);
        if (onRefresh) onRefresh();
    };

    const handleAddFromCard = async () => {
        if (!selectedContent || !userCheckupId) return;
        let newPlan = dailyPlan || { generatedAt: '', diet: {} as any, exercise: {} as any, tips: '', dietLogs: [], exerciseLogs: [] };
        
        if (selectedContent.type === 'meal') {
            const log: DietLogItem = {
                id: Date.now().toString(),
                name: selectedContent.title,
                calories: Number(selectedContent.details?.cal) || 0,
                protein: Number(selectedContent.details?.macros?.protein) || 0,
                fat: Number(selectedContent.details?.macros?.fat) || 0,
                carbs: Number(selectedContent.details?.macros?.carbs) || 0,
                fiber: 0,
                type: 'lunch'
            };
            newPlan = { ...newPlan, dietLogs: [...(newPlan.dietLogs || []), log] };
        } else {
            const log: ExerciseLogItem = {
                id: Date.now().toString(),
                name: selectedContent.title,
                calories: Number(selectedContent.details?.cal) || 100,
                duration: Number(selectedContent.details?.duration) || 30
            };
            newPlan = { ...newPlan, exerciseLogs: [...(newPlan.exerciseLogs || []), log] };
        }
        await updateUserPlan(userCheckupId, newPlan);
        setSelectedContent(null);
        if (onRefresh) onRefresh();
    };

    return (
        <div className="bg-[#F8FAFC] min-h-full pb-24">
            {/* Header / Dashboard */}
            <div className="bg-white rounded-b-3xl shadow-sm border-b border-slate-100 p-6">
                <h1 className="text-xl font-black text-slate-800 mb-4">今日热量平衡</h1>
                <div className="flex items-center gap-6">
                    <div className="w-32 h-32 relative">
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie data={balanceData} innerRadius={35} outerRadius={45} dataKey="value" startAngle={90} endAngle={-270} stroke="none">
                                    <Cell fill={netCalories > recommended.tdee ? '#ef4444' : '#14b8a6'} />
                                    <Cell fill="#f1f5f9" />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[10px] text-slate-400">剩余可用</span>
                            <span className="text-xl font-black text-slate-800">{remaining}</span>
                        </div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <div className="flex justify-between text-xs"><span>摄入</span><span className="font-bold">{currentIntake.cal} / {recommended.tdee}</span></div>
                        <div className="flex justify-between text-xs"><span>运动</span><span className="font-bold text-orange-500">-{currentBurn}</span></div>
                        <div className="h-px bg-slate-100"></div>
                        <div className="flex gap-2">
                            <MacroBar label="蛋" current={currentIntake.p} target={recommended.protein} color="bg-blue-500" />
                            <MacroBar label="脂" current={currentIntake.f} target={recommended.fat} color="bg-yellow-500" />
                            <MacroBar label="碳" current={currentIntake.c} target={recommended.carbs} color="bg-green-500" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {/* Actions */}
                <div className="flex gap-3">
                    <button onClick={handleGenerate} disabled={isGenerating} className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-teal-200 active:scale-95 transition-transform flex items-center justify-center gap-2">
                        {isGenerating ? 'AI 生成中...' : '✨ 生成今日方案'}
                    </button>
                    <button onClick={() => setShowAddLog('diet')} className="w-12 bg-white text-slate-600 rounded-xl shadow-sm border border-slate-200 font-bold text-lg">+</button>
                </div>

                {/* Today's Logs */}
                {dailyPlan && (dailyPlan.dietLogs?.length || dailyPlan.exerciseLogs?.length) ? (
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-3">今日记录</h3>
                        <div className="space-y-2">
                            {dailyPlan.dietLogs?.map((l, i) => (
                                <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-50 last:border-0">
                                    <span>{getSmartIcon(l.name, 'meal')} {l.name}</span>
                                    <span className="font-bold text-teal-600">+{l.calories}</span>
                                </div>
                            ))}
                            {dailyPlan.exerciseLogs?.map((l, i) => (
                                <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-50 last:border-0">
                                    <span>{getSmartIcon(l.name, 'exercise')} {l.name}</span>
                                    <span className="font-bold text-orange-500">-{l.calories}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {/* AI Plan Text (If exists) */}
                {dailyPlan?.diet?.breakfast && (
                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 text-sm text-indigo-900 space-y-2">
                        <h3 className="font-bold">📅 AI 推荐日程</h3>
                        <div>🍳 早: {dailyPlan.diet.breakfast}</div>
                        <div>🍱 午: {dailyPlan.diet.lunch}</div>
                        <div>🥗 晚: {dailyPlan.diet.dinner}</div>
                        <div className="text-xs opacity-70 mt-2">💡 {dailyPlan.tips}</div>
                    </div>
                )}

                {/* Resource Feed */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800">推荐食谱与运动</h3>
                        <input className="bg-white border border-slate-200 rounded-full px-3 py-1 text-xs outline-none" placeholder="搜索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {filterList(allMeals).map(m => (
                            <ResourceCard key={m.id} item={m} onClick={() => setSelectedContent(m)} />
                        ))}
                        {filterList(allExercises).map(e => (
                            <ResourceCard key={e.id} item={e} onClick={() => setSelectedContent(e)} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Modals */}
            
            {/* 1. Preview Modal */}
            {previewPlan && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scaleIn">
                        <h3 className="text-xl font-bold mb-4">✨ 专属方案预览</h3>
                        <div className="bg-slate-50 p-3 rounded-lg text-sm mb-4 space-y-1">
                            <div>早: {previewPlan.diet.breakfast}</div>
                            <div>午: {previewPlan.diet.lunch}</div>
                            <div>晚: {previewPlan.diet.dinner}</div>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">AI已为您精选 {recommendedItems.length} 项资源，点击确认将自动加入今日记录。</p>
                        <div className="flex gap-2">
                            <button onClick={() => setPreviewPlan(null)} className="flex-1 py-2 border rounded-lg text-sm">取消</button>
                            <button onClick={handleConfirmPlan} className="flex-1 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold">确认应用</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Detail/Add Modal */}
            {selectedContent && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedContent(null)}>
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 animate-scaleIn" onClick={e => e.stopPropagation()}>
                        <div className="text-center mb-4">
                            <div className="text-4xl mb-2">{getSmartIcon(selectedContent.title, selectedContent.type as any)}</div>
                            <h3 className="font-bold text-lg">{selectedContent.title}</h3>
                            <p className="text-teal-600 font-black text-xl mt-1">{selectedContent.details?.cal || 0} kcal</p>
                        </div>
                        
                        <div className="space-y-4 mb-6">
                            {selectedContent.type === 'meal' && selectedContent.details?.macros && (
                                <div className="grid grid-cols-4 gap-2 text-center bg-slate-50 p-3 rounded-xl">
                                    <MacroBox label="蛋" val={selectedContent.details.macros.protein} />
                                    <MacroBox label="脂" val={selectedContent.details.macros.fat} />
                                    <MacroBox label="碳" val={selectedContent.details.macros.carbs} />
                                    <MacroBox label="纤" val={selectedContent.details.macros.fiber} />
                                </div>
                            )}
                            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{selectedContent.description}</p>
                        </div>

                        <button onClick={handleAddFromCard} className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold shadow-lg">
                            + 加入今日记录
                        </button>
                    </div>
                </div>
            )}

            {/* 3. Manual Add Modal */}
            {showAddLog && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                        <h3 className="font-bold mb-4">手动添加{showAddLog==='diet'?'饮食':'运动'}</h3>
                        <div className="space-y-3 mb-6">
                            {showAddLog === 'diet' ? (
                                <>
                                    <input className="w-full border p-2 rounded" placeholder="名称" value={dietForm.name} onChange={e=>setDietForm({...dietForm, name: e.target.value})} />
                                    <input type="number" className="w-full border p-2 rounded" placeholder="热量 (kcal)" value={dietForm.calories || ''} onChange={e=>setDietForm({...dietForm, calories: Number(e.target.value)})} />
                                </>
                            ) : (
                                <>
                                    <input className="w-full border p-2 rounded" placeholder="名称" value={exForm.name} onChange={e=>setExForm({...exForm, name: e.target.value})} />
                                    <input type="number" className="w-full border p-2 rounded" placeholder="消耗 (kcal)" value={exForm.calories || ''} onChange={e=>setExForm({...exForm, calories: Number(e.target.value)})} />
                                </>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowAddLog(null)} className="flex-1 py-2 border rounded">取消</button>
                            <button onClick={handleAddManual} className="flex-1 py-2 bg-teal-600 text-white rounded font-bold">保存</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const MacroBar = ({ label, current, target, color }: any) => (
    <div className="flex-1">
        <div className="text-[9px] text-slate-400 mb-0.5">{label}</div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${color}`} style={{ width: `${Math.min(100, (current/target)*100)}%` }}></div>
        </div>
    </div>
);

const MacroBox = ({ label, val }: any) => (
    <div>
        <div className="text-[10px] text-slate-400">{label}</div>
        <div className="font-bold">{val}g</div>
    </div>
);

const ResourceCard = ({ item, onClick }: any) => (
    <div onClick={onClick} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer active:scale-95 transition-transform">
        <div className="text-2xl mb-2">{getSmartIcon(item.title, item.type)}</div>
        <div className="font-bold text-sm truncate">{item.title}</div>
        <div className="text-xs text-slate-400 mt-1">{item.type === 'meal' ? `${item.details?.cal} kcal` : `${item.details?.duration} min`}</div>
    </div>
);
