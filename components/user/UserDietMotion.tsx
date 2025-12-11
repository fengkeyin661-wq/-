
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

// --- Smart Icon Helper ---
const getSmartIcon = (title: string, type: 'meal' | 'exercise'): string => {
    const t = title.toLowerCase();
    
    if (type === 'meal') {
        if (t.includes('鸡')) return '🍗';
        if (t.includes('鱼') || t.includes('虾') || t.includes('海鲜')) return '🐟';
        if (t.includes('牛') || t.includes('排') || t.includes('肉')) return '🥩';
        if (t.includes('蛋')) return '🥚';
        if (t.includes('面') || t.includes('粉')) return '🍜';
        if (t.includes('饭') || t.includes('粥')) return '🍚';
        if (t.includes('菜') || t.includes('沙拉') || t.includes('素')) return '🥗';
        if (t.includes('果') || t.includes('苹') || t.includes('蕉')) return '🍎';
        if (t.includes('奶') || t.includes('拿铁')) return '🥛';
        if (t.includes('茶') || t.includes('咖')) return '☕';
        if (t.includes('汤')) return '🥣';
        return '🍱'; // Default Meal
    } else {
        if (t.includes('跑')) return '🏃';
        if (t.includes('走') || t.includes('步')) return '🚶';
        if (t.includes('游') || t.includes('水')) return '🏊';
        if (t.includes('骑') || t.includes('车')) return '🚴';
        if (t.includes('瑜伽') || t.includes('冥想') || t.includes('静')) return '🧘';
        if (t.includes('球')) return '🏀';
        if (t.includes('力量') || t.includes('举') || t.includes('铃')) return '🏋️';
        if (t.includes('舞') || t.includes('操')) return '💃';
        if (t.includes('拳')) return '🥊';
        if (t.includes('爬') || t.includes('山')) return '🧗';
        return '🤸'; // Default Exercise
    }
};

// Helper: Scoring logic for relevance
const scoreItemRelevance = (item: ContentItem, risks: string[]) => {
    let score = 0;
    const combinedText = (item.title + (item.tags?.join(' ') || '') + (item.description || '')).toLowerCase();
    
    const keywords: Record<string, string[]> = {
        '高血压': ['低盐', '降压', '舒缓', '有氧', 'DASH'],
        '糖尿病': ['低糖', '低GI', '控糖', '膳食纤维', '有氧'],
        '高血脂': ['低脂', '清淡', '减脂', '有氧'],
        '肥胖': ['减脂', '低卡', '燃脂', '高蛋白', '力量'],
        '痛风': ['低嘌呤', '多喝水'],
        '骨质疏松': ['钙', '维生素D', '力量', '负重'],
        '颈椎': ['颈椎', '拉伸', '体态'],
        '失眠': ['助眠', '瑜伽', '冥想']
    };

    risks.forEach(risk => {
        const key = Object.keys(keywords).find(k => risk.includes(k));
        if (key) {
            keywords[key].forEach(word => {
                if (combinedText.includes(word.toLowerCase())) score += 2;
            });
        }
        if (combinedText.includes(risk.replace('风险','').replace('高危',''))) score += 1;
    });

    return score + Math.random();
};

export const UserDietMotion: React.FC<Props> = ({ assessment, userCheckupId, record, dailyPlan, onRefresh }) => {
    const [allMeals, setAllMeals] = useState<ContentItem[]>([]);
    const [allExercises, setAllExercises] = useState<ContentItem[]>([]);
    
    // Displayed (Recommendations)
    const [displayedMeals, setDisplayedMeals] = useState<ContentItem[]>([]);
    const [displayedExercises, setDisplayedExercises] = useState<ContentItem[]>([]);

    // UI State
    const [showUpload, setShowUpload] = useState(false);
    const [showAddLog, setShowAddLog] = useState<'diet' | 'exercise' | null>(null);
    const [uploadType, setUploadType] = useState<'meal'|'exercise'>('meal');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSavingLog, setIsSavingLog] = useState(false);

    // Search
    const [searchTerm, setSearchTerm] = useState('');

    // Preview Modal State
    const [previewPlan, setPreviewPlan] = useState<any>(null);
    const [recommendedItems, setRecommendedItems] = useState<ContentItem[]>([]);

    // Content Detail Modal
    const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);

    // Manual Log Forms - NOW INCLUDES MACROS
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

    const recommended = useMemo(() => {
        if (!record) return { bmr: 0, tdee: 0, protein: 0, fat: 0, carbs: 0, fiber: 25 };
        const weight = record.checkup.basics.weight || 65;
        const height = record.checkup.basics.height || 170;
        const age = record.profile.age || 40;
        const gender = record.profile.gender || '男';
        let bmr = (10 * weight) + (6.25 * height) - (5 * age);
        bmr += gender === '女' ? -161 : 5;
        const tdee = Math.round(bmr * 1.375); // Light activity base
        const proteinCal = tdee * 0.18; 
        const proteinG = Math.round(proteinCal / 4);
        const fatCal = tdee * 0.28;
        const fatG = Math.round(fatCal / 9);
        const carbsCal = tdee * 0.54;
        const carbsG = Math.round(carbsCal / 4);
        return { bmr: Math.round(bmr), tdee, protein: proteinG, fat: fatG, carbs: carbsG, fiber: 25 };
    }, [record]);

    // Current Totals - Calculates directly from the logs
    const currentIntake = useMemo(() => {
        if (!dailyPlan?.dietLogs) return { cal: 0, p: 0, f: 0, c: 0, fib: 0 };
        return dailyPlan.dietLogs.reduce((acc, item) => ({
            cal: acc.cal + Number(item.calories || 0),
            p: acc.p + Number(item.protein || 0),
            f: acc.f + Number(item.fat || 0),
            c: acc.c + Number(item.carbs || 0),
            fib: acc.fib + Number(item.fiber || 0),
        }), { cal: 0, p: 0, f: 0, c: 0, fib: 0 });
    }, [dailyPlan]);

    const currentBurn = useMemo(() => {
        if (!dailyPlan?.exerciseLogs) return 0;
        return dailyPlan.exerciseLogs.reduce((acc, item) => acc + Number(item.calories || 0), 0);
    }, [dailyPlan]);

    const netCalories = currentIntake.cal - currentBurn;
    const isOver = netCalories > recommended.tdee;

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        const [mealsData, exercisesData] = await Promise.all([
            fetchContent('meal'),
            fetchContent('exercise')
        ]);
        setAllMeals(mealsData);
        setAllExercises(exercisesData);
        refreshRecommendations(mealsData, exercisesData);
    };

    const refreshRecommendations = (meals = allMeals, exercises = allExercises) => {
        const risks = assessment ? [...assessment.risks.red, ...assessment.risks.yellow] : [];
        
        const sortedMeals = [...meals].sort((a, b) => scoreItemRelevance(b, risks) - scoreItemRelevance(a, risks));
        const sortedEx = [...exercises].sort((a, b) => scoreItemRelevance(b, risks) - scoreItemRelevance(a, risks));

        const pickRandom = (arr: ContentItem[], count: number) => {
            const pool = arr.slice(0, Math.max(arr.length, 10)); 
            const shuffled = pool.sort(() => 0.5 - Math.random());
            return shuffled.slice(0, count);
        };

        setDisplayedMeals(pickRandom(sortedMeals, 4));
        setDisplayedExercises(pickRandom(sortedEx, 4));
    };

    const handleUpload = async () => {
        if (!newTitle) return;
        const newItem: ContentItem = {
            id: Date.now().toString(),
            type: uploadType,
            title: newTitle,
            description: newDesc,
            tags: newTags.split(/[,， ]+/).filter(Boolean),
            image: getSmartIcon(newTitle, uploadType), // Use smart icon here too
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
            const resourceContext = JSON.stringify({
                meals: allMeals.slice(0, 30).map(m => ({ id: m.id, name: m.title, tags: m.tags })),
                exercises: allExercises.slice(0, 10).map(e => ({ id: e.id, name: e.title, tags: e.tags }))
            });
            const plan = await generateDailyIntegratedPlan(profileStr, resourceContext);
            const recIds = [...(plan.recommendedMealIds || []), ...(plan.recommendedExerciseIds || [])];
            const recItems = [...allMeals, ...allExercises].filter(i => recIds.includes(i.id));
            setPreviewPlan(plan);
            setRecommendedItems(recItems);
        } catch (e) {
            console.error(e);
            alert("生成失败，请重试");
        } finally {
            setIsGenerating(false);
        }
    };

    // CRITICAL: Transforms AI Plan + Recommended Items into DB Logs
    const handleConfirmPlan = async () => {
        if (!previewPlan || !userCheckupId) return;
        setIsSavingLog(true);
        
        // 1. Convert Recommended Meals to Logs (Auto-Calculation!)
        const newDietLogs: DietLogItem[] = recommendedItems
            .filter(i => i.type === 'meal')
            .map(i => ({
                id: Date.now().toString() + Math.random().toString(36).substr(2,5),
                name: i.title,
                calories: Number(i.details?.cal) || 400, // Fallback avg meal
                protein: Number(i.details?.macros?.protein) || 20,
                fat: Number(i.details?.macros?.fat) || 15,
                carbs: Number(i.details?.macros?.carbs) || 50,
                fiber: Number(i.details?.macros?.fiber) || 5,
                type: 'lunch' // Default to lunch for bulk add
            }));

        // 2. Convert Recommended Exercises to Logs
        const newExerciseLogs: ExerciseLogItem[] = recommendedItems
            .filter(i => i.type === 'exercise')
            .map(i => ({
                id: Date.now().toString() + Math.random().toString(36).substr(2,5),
                name: i.title,
                calories: Number(i.details?.cal) || 150,
                duration: Number(i.details?.duration) || 30
            }));

        // 3. Construct Updated Plan Object
        const newDailyPlan: DailyHealthPlan = {
            generatedAt: new Date().toISOString(),
            diet: previewPlan.diet,
            exercise: previewPlan.exercise,
            tips: previewPlan.tips,
            // MERGE with existing logs or replace? Typically append for the day.
            dietLogs: [...(dailyPlan?.dietLogs || []), ...newDietLogs],
            exerciseLogs: [...(dailyPlan?.exerciseLogs || []), ...newExerciseLogs]
        };

        try {
            const success = await updateUserPlan(userCheckupId, newDailyPlan);
            if (success) {
                alert("方案已应用！相关饮食运动已自动加入今日记录，热量统计已更新。");
                if (onRefresh) onRefresh(); 
            } else {
                alert("保存失败，请检查网络或重试");
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
            if (onRefresh) onRefresh();
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
                type: 'lunch' 
            };
            newPlan = { ...newPlan, dietLogs: [...(newPlan.dietLogs || []), logItem] };
        } else if (selectedContent.type === 'exercise') {
            const logItem: ExerciseLogItem = {
                id: Date.now().toString(),
                name: selectedContent.title,
                calories: Number(selectedContent.details?.cal) || 100, 
                duration: Number(selectedContent.details?.duration) || 30
            };
            newPlan = { ...newPlan, exerciseLogs: [...(newPlan.exerciseLogs || []), logItem] };
        }
        const success = await updateUserPlan(userCheckupId, newPlan);
        if (success) {
            alert(`已将【${selectedContent.title}】加入今日记录！`);
            if (onRefresh) onRefresh();
        }
        setIsSavingLog(false);
        setSelectedContent(null);
    };

    // Filter Logic
    const filterList = (list: ContentItem[]) => {
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            return list.filter(item => 
                item.title.toLowerCase().includes(lowerSearch) || 
                item.tags.some(t => t.toLowerCase().includes(lowerSearch))
            );
        }
        // If not searching, use the pre-calculated recommendations (4 items)
        return list === allMeals ? displayedMeals : displayedExercises;
    };

    const mealsToRender = filterList(allMeals);
    const exercisesToRender = filterList(allExercises);

    // Chart Data
    const macroData = [
        { name: '蛋白质', current: currentIntake.p, target: recommended.protein, unit: 'g', color: '#3b82f6' },
        { name: '脂肪', current: currentIntake.f, target: recommended.fat, unit: 'g', color: '#eab308' },
        { name: '碳水', current: currentIntake.c, target: recommended.carbs, unit: 'g', color: '#10b981' },
        { name: '膳食纤维', current: currentIntake.fib, target: recommended.fiber, unit: 'g', color: '#8b5cf6' },
    ];

    const balanceData = [
        { name: '已摄入', value: netCalories < 0 ? 0 : netCalories }, 
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
                {/* ... Charts ... */}
                {/* (Chart code remains the same) */}
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
                                    <span className="text-xl">{getSmartIcon(log.name, 'meal')}</span>
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
                                    <span className="text-xl">{getSmartIcon(log.name, 'exercise')}</span>
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

                {/* 6. Content Feed (Split Sections) */}
                <section>
                    {/* Meals Section */}
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-teal-500 rounded-full"></span>
                            {searchTerm ? '食谱搜索' : '今日推荐食谱'}
                        </h2>
                        {!searchTerm && (
                            <button 
                                onClick={() => refreshRecommendations(allMeals, allExercises)} 
                                className="text-xs font-bold text-slate-500 flex items-center gap-1 active:scale-95 transition-transform"
                            >
                                🔄 换一换
                            </button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        {mealsToRender.map(item => (
                            <div 
                                key={item.id} 
                                onClick={() => setSelectedContent(item)}
                                className={`bg-white rounded-2xl p-2 shadow-sm border border-slate-100 flex flex-col cursor-pointer active:scale-95 transition-transform`}
                            >
                                <div className="aspect-square bg-slate-50 rounded-xl flex items-center justify-center text-4xl mb-2">
                                    {getSmartIcon(item.title, 'meal')}
                                </div>
                                <h3 className="font-bold text-slate-800 text-xs truncate px-1">{item.title}</h3>
                                <div className="flex gap-1 mt-1 px-1">
                                    {item.tags.slice(0, 1).map((t, i) => (
                                        <span key={i} className="text-[8px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded">{t}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {mealsToRender.length === 0 && <div className="text-slate-400 text-xs w-full text-center py-4 col-span-2">无相关推荐</div>}
                    </div>

                    {/* Exercises Section */}
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>
                            {searchTerm ? '运动搜索' : '今日推荐运动'}
                        </h2>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        {exercisesToRender.map(item => (
                            <div 
                                key={item.id} 
                                onClick={() => setSelectedContent(item)}
                                className={`bg-white rounded-2xl p-2 shadow-sm border border-slate-100 flex flex-col cursor-pointer active:scale-95 transition-transform`}
                            >
                                <div className="aspect-square bg-slate-50 rounded-xl flex items-center justify-center text-4xl mb-2 relative">
                                    {getSmartIcon(item.title, 'exercise')}
                                    <span className="absolute bottom-1 right-1 text-[8px] bg-white/80 px-1 rounded">运动</span>
                                </div>
                                <h3 className="font-bold text-slate-800 text-xs truncate px-1">{item.title}</h3>
                                <div className="flex gap-1 mt-1 px-1">
                                    {item.tags.slice(0, 1).map((t, i) => (
                                        <span key={i} className="text-[8px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">{t}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {exercisesToRender.length === 0 && <div className="text-slate-400 text-xs w-full text-center py-4 col-span-2">无相关推荐</div>}
                    </div>
                </section>
            </div>

            {/* Plan Preview Modal */}
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
                                                <div className="text-2xl mb-1">{getSmartIcon(item.title, item.type as any)}</div>
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
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-5xl mx-auto mb-3 shadow-inner border-2 border-white">
                                {getSmartIcon(selectedContent.title, selectedContent.type as any)}
                            </div>
                            <h3 className="text-xl font-black text-slate-800 leading-tight mb-2">{selectedContent.title}</h3>
                            <div className="flex justify-center gap-2 flex-wrap">
                                {selectedContent.tags.map(t => <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">{t}</span>)}
                            </div>
                        </div>

                        <div className="space-y-6 flex-1 overflow-y-auto mb-4">
                            
                            {/* MEAL DETAIL VIEW */}
                            {selectedContent.type === 'meal' && (
                                <>
                                   {/* Key Metrics Row */}
                                   <div className="flex justify-around items-center py-4 border-y border-slate-50 bg-slate-50/50 rounded-xl">
                                       <div className="text-center">
                                           <div className="text-lg font-black text-teal-600">{selectedContent.details?.cal || '-'}</div>
                                           <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">kcal</div>
                                       </div>
                                       <div className="w-px h-8 bg-slate-200"></div>
                                       <div className="text-center">
                                           <div className="text-lg font-bold text-slate-800">{parseInt(selectedContent.details?.prepTime||0) + parseInt(selectedContent.details?.cookTime||0)}<span className="text-xs font-normal text-slate-400">min</span></div>
                                           <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">总时长</div>
                                       </div>
                                       <div className="w-px h-8 bg-slate-200"></div>
                                       <div className="text-center">
                                           <div className="text-lg font-bold text-slate-800">{selectedContent.details?.difficulty || '初级'}</div>
                                           <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">难度</div>
                                       </div>
                                   </div>

                                   {/* Macros Cards */}
                                   {selectedContent.details?.macros && (
                                       <div>
                                           <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">核心营养素</h4>
                                           <div className="grid grid-cols-4 gap-2">
                                               <MacroBox label="蛋白质" value={selectedContent.details.macros.protein} color="bg-blue-50 text-blue-700" unit="g" />
                                               <MacroBox label="脂肪" value={selectedContent.details.macros.fat} color="bg-yellow-50 text-yellow-700" unit="g" />
                                               <MacroBox label="碳水" value={selectedContent.details.macros.carbs} color="bg-green-50 text-green-700" unit="g" />
                                               <MacroBox label="膳食纤维" value={selectedContent.details.macros.fiber} color="bg-purple-50 text-purple-700" unit="g" />
                                           </div>
                                       </div>
                                   )}

                                   {/* Intro */}
                                   <div>
                                       <h4 className="font-bold text-slate-800 mb-2 text-sm">简介</h4>
                                       <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            {selectedContent.description}
                                       </p>
                                   </div>

                                   {/* Ingredients */}
                                   {selectedContent.details?.ingredients && (
                                       <div>
                                           <h4 className="font-bold text-slate-800 mb-2 text-sm">所需食材</h4>
                                           <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                                               <p className="text-sm text-slate-700 leading-loose">
                                                   {selectedContent.details.ingredients}
                                               </p>
                                           </div>
                                       </div>
                                   )}

                                   {/* Steps */}
                                   {selectedContent.details?.steps && (
                                       <div>
                                           <h4 className="font-bold text-slate-800 mb-2 text-sm">制作步骤</h4>
                                           <div className="space-y-3">
                                               {selectedContent.details.steps.split(/[\n;]/).map((step: string, i: number) => step.trim() && (
                                                   <div key={i} className="flex gap-3 text-sm text-slate-600">
                                                       <span className="flex-shrink-0 w-5 h-5 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">{i+1}</span>
                                                       <p className="leading-relaxed">{step.trim()}</p>
                                                   </div>
                                               ))}
                                           </div>
                                       </div>
                                   )}
                                   
                                   {/* Nutrition Tip */}
                                   {selectedContent.details?.nutrition && (
                                       <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 text-xs text-orange-800 leading-relaxed flex gap-2">
                                           <span className="text-lg">💡</span>
                                           <div>
                                               <div className="font-bold mb-1">营养师点评</div>
                                               {selectedContent.details.nutrition}
                                           </div>
                                       </div>
                                   )}
                                </>
                            )}

                            {/* EXERCISE DETAIL VIEW */}
                            {selectedContent.type === 'exercise' && (
                                <>
                                   <div className="flex justify-around items-center py-4 border-y border-slate-50 bg-slate-50/50 rounded-xl">
                                       <div className="text-center">
                                           <div className="text-lg font-black text-orange-500">{selectedContent.details?.cal || '-'}</div>
                                           <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">消耗(kcal)</div>
                                       </div>
                                       <div className="w-px h-8 bg-slate-200"></div>
                                       <div className="text-center">
                                           <div className="text-lg font-bold text-slate-800">{selectedContent.details?.duration}<span className="text-xs font-normal text-slate-400">min</span></div>
                                           <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">时长</div>
                                       </div>
                                       <div className="w-px h-8 bg-slate-200"></div>
                                       <div className="text-center">
                                           <div className="text-lg font-bold text-slate-800">{selectedContent.details?.intensity || '中'}</div>
                                           <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">强度</div>
                                       </div>
                                   </div>

                                   {/* Targets & Equipment */}
                                   <div className="grid grid-cols-2 gap-4">
                                       <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                           <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">适宜人群</div>
                                           <div className="text-xs font-bold text-slate-700">{selectedContent.details?.audience || '全人群'}</div>
                                       </div>
                                       <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                           <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">所需器材</div>
                                           <div className="text-xs font-bold text-slate-700">{selectedContent.details?.equipment || '无'}</div>
                                       </div>
                                   </div>

                                   <div>
                                       <h4 className="font-bold text-slate-800 mb-2 text-sm">训练介绍</h4>
                                       <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            {selectedContent.description}
                                       </p>
                                   </div>

                                   {selectedContent.details?.steps && (
                                       <div>
                                           <h4 className="font-bold text-slate-800 mb-2 text-sm">动作要领 / 流程</h4>
                                           <div className="space-y-3">
                                               {selectedContent.details.steps.split(/[\n;]/).map((step: string, i: number) => step.trim() && (
                                                   <div key={i} className="flex gap-3 text-sm text-slate-600">
                                                       <span className="flex-shrink-0 w-5 h-5 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">{i+1}</span>
                                                       <p className="leading-relaxed">{step.trim()}</p>
                                                   </div>
                                               ))}
                                           </div>
                                       </div>
                                   )}

                                   {selectedContent.details?.risks && (
                                       <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-xs text-red-800 leading-relaxed flex gap-2">
                                           <span className="text-lg">⚠️</span>
                                           <div>
                                               <div className="font-bold mb-1">禁忌与风险</div>
                                               {selectedContent.details.risks}
                                           </div>
                                       </div>
                                   )}
                                </>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setSelectedContent(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">关闭</button>
                            <button 
                                onClick={handleAddFromCard}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm text-white shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all ${
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

// Helper Component for Macro Display
const MacroBox = ({ label, value, color, unit }: any) => (
    <div className={`p-2 rounded-lg text-center ${color.split(' ')[0]}`}>
        <div className="text-[10px] opacity-70 mb-0.5 font-bold uppercase">{label}</div>
        <div className={`text-sm font-black ${color.split(' ')[1]}`}>
            {value || 0}<span className="text-[9px] ml-0.5 font-normal opacity-80">{unit}</span>
        </div>
    </div>
);
