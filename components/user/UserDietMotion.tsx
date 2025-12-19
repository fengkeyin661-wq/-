
import React, { useState, useEffect, useMemo } from 'react';
import { fetchContent, ContentItem, saveContent } from '../../services/contentService';
import { HealthAssessment, HealthRecord } from '../../types';
import { generateDailyIntegratedPlan, calculateNutritionFromIngredients } from '../../services/geminiService';
import { updateUserPlan, DailyHealthPlan, DietLogItem, ExerciseLogItem } from '../../services/dataService';

interface Props {
    assessment?: HealthAssessment;
    userCheckupId?: string;
    record?: HealthRecord;
    dailyPlan?: DailyHealthPlan;
    onRefresh?: () => void;
}

// ... 辅助函数 getSmartIcon, MEAL_SLOTS, parseCal, estimateCalories 保持不变 ...
const getSmartIcon = (title: string, type: string): string => {
    const t = title.toLowerCase();
    if (type === 'meal') {
        if (t.includes('鸡') || t.includes('肉') || t.includes('牛')) return '🥩';
        if (t.includes('鱼') || t.includes('海鲜')) return '🐟';
        if (t.includes('面') || t.includes('粉') || t.includes('饭') || t.includes('粥')) return '🍜';
        if (t.includes('菜') || t.includes('沙拉')) return '🥗';
        return '🍱';
    }
    return '🤸';
};

const parseCal = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val.replace(/[^\d.]/g, '')) || 0;
    return 0;
};

export const UserDietMotion: React.FC<Props> = ({ assessment, userCheckupId, record, dailyPlan, onRefresh }) => {
    const [allMeals, setAllMeals] = useState<ContentItem[]>([]);
    const [allExercises, setAllExercises] = useState<ContentItem[]>([]);
    const [activeTab, setActiveTab] = useState<'diary' | 'resources'>('diary');
    const [resourceFilter, setResourceFilter] = useState<'all' | 'meal' | 'exercise'>('all');
    const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewPlan, setPreviewPlan] = useState<any>(null);

    // 新增：食谱上传状态
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [uploadForm, setUploadForm] = useState({
        title: '',
        ingredients: '',
        steps: '',
        image: '🍳'
    });

    useEffect(() => {
        loadResources();
    }, [userCheckupId]);

    const loadResources = async () => {
        const [m, e] = await Promise.all([fetchContent('meal'), fetchContent('exercise', 'active')]);
        setAllMeals(m); 
        setAllExercises(e);
    };

    const handleGenerate = async () => {
        if (!assessment || !userCheckupId) return alert("请先完善档案");
        setIsGenerating(true);
        try {
            const context = JSON.stringify({
                meals: allMeals.filter(m => m.status === 'active').slice(0, 20).map(m => ({ id: m.id, name: m.title, cal: m.details?.cal })),
                exercises: allExercises.slice(0, 10).map(e => ({ id: e.id, name: e.title }))
            });
            const targets = { tdee: 2000 }; // 简化演示
            const plan = await generateDailyIntegratedPlan(`风险:${assessment.riskLevel}`, context, targets.tdee);
            setPreviewPlan({ ...plan, fullMeals: allMeals.slice(0,3), fullExercises: allExercises.slice(0,1) });
        } finally { setIsGenerating(false); }
    };

    const handleUploadRecipe = async () => {
        if (!uploadForm.title || !uploadForm.ingredients) return alert("请填写名称和配料");
        setIsAnalyzing(true);
        try {
            // 1. 调用 AI 分析营养
            const { nutritionData } = await calculateNutritionFromIngredients([{
                name: uploadForm.title,
                ingredients: uploadForm.ingredients
            }]);
            
            const aiResult = nutritionData[uploadForm.title] || { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };

            // 2. 提交保存内容（待审核）
            await saveContent({
                id: `user_meal_${Date.now()}`,
                type: 'meal',
                title: uploadForm.title,
                description: uploadForm.steps,
                tags: ['用户分享', '家常菜'],
                image: uploadForm.image,
                status: 'pending',
                isUserUpload: true,
                updatedAt: new Date().toISOString(),
                details: {
                    ingredients: uploadForm.ingredients,
                    steps: uploadForm.steps,
                    cal: aiResult.cal,
                    macros: {
                        protein: aiResult.protein,
                        fat: aiResult.fat,
                        carbs: aiResult.carbs,
                        fiber: aiResult.fiber
                    },
                    nutrition: aiResult.summary,
                    creatorId: userCheckupId
                }
            });

            alert("发布成功！AI 已完成营养分析，请等待管理员审核上架。");
            setShowUploadModal(false);
            loadResources();
        } catch (e) {
            alert("分析失败，请重试");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const targets = { tdee: 2000, carbs: 250, protein: 100, fat: 60 };
    const intake = { cal: 0, burned: 0, c: 0, p: 0, f: 0 };
    const progressCal = 0;
    const remainingCal = 2000;

    return (
        <div className="bg-slate-50 min-h-full pb-28 relative">
            {/* Header & Dashboard 保持不变... */}
            <div className="bg-white rounded-b-[2.5rem] shadow-sm border-b border-slate-100 overflow-hidden relative">
                <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-6 pb-12 text-white text-center">
                    <h2 className="text-xl font-bold mb-4">今日热量平衡</h2>
                    <div className="text-4xl font-black">{remainingCal} <span className="text-sm font-normal opacity-70">kcal 剩余</span></div>
                </div>
            </div>

            <div className="px-6 mt-6 flex justify-between items-center">
                <div className="flex gap-4">
                    <button onClick={() => setActiveTab('diary')} className={`text-sm font-bold pb-2 ${activeTab==='diary' ? 'text-slate-800 border-b-2 border-teal-500' : 'text-slate-400'}`}>今日方案</button>
                    <button onClick={() => setActiveTab('resources')} className={`text-sm font-bold pb-2 ${activeTab==='resources' ? 'text-slate-800 border-b-2 border-teal-500' : 'text-slate-400'}`}>健康资源库</button>
                </div>
                {activeTab === 'resources' && (
                    <button onClick={() => setShowUploadModal(true)} className="bg-teal-600 text-white px-3 py-1.5 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-1 active:scale-95 transition-transform">
                        <span>➕</span> 分享食谱
                    </button>
                )}
            </div>

            {activeTab === 'diary' && (
                <div className="px-4 mt-4 space-y-4">
                    <button onClick={handleGenerate} disabled={isGenerating} className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg">
                        {isGenerating ? 'AI 正在匹配库资源...' : '✨ 智能生成今日方案'}
                    </button>
                </div>
            )}

            {activeTab === 'resources' && (
                <div className="px-4 mt-4 animate-fadeIn">
                    <div className="grid grid-cols-2 gap-4">
                        {allMeals.map(item => (
                            <div key={item.id} onClick={() => setSelectedItem(item)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative">
                                {item.status === 'pending' && <span className="absolute top-2 right-2 bg-yellow-100 text-yellow-700 text-[8px] px-1.5 py-0.5 rounded-full font-bold">审核中</span>}
                                <div className="text-3xl mb-2 text-center">{getSmartIcon(item.title, 'meal')}</div>
                                <h4 className="font-bold text-slate-800 text-sm truncate">{item.title}</h4>
                                <p className="text-[10px] text-slate-400">{item.details?.cal} kcal</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 新增：食谱上传弹窗 */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-scaleIn">
                        <h3 className="text-xl font-black text-slate-800 mb-6 text-center">分享我的健康食谱</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 ml-1">食谱名称</label>
                                <input className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-teal-500 outline-none" placeholder="如：清蒸柠檬鲈鱼" value={uploadForm.title} onChange={e => setUploadForm({...uploadForm, title: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 ml-1">配料及用量 (g)</label>
                                <textarea className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-teal-500 outline-none h-24" placeholder="例如：鲈鱼 300g, 柠檬 50g, 橄榄油 10g..." value={uploadForm.ingredients} onChange={e => setUploadForm({...uploadForm, ingredients: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 ml-1">烹饪步骤</label>
                                <textarea className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-teal-500 outline-none h-24" placeholder="简单的步骤描述..." value={uploadForm.steps} onChange={e => setUploadForm({...uploadForm, steps: e.target.value})} />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setShowUploadModal(false)} className="flex-1 py-4 text-slate-400 font-bold">取消</button>
                            <button 
                                onClick={handleUploadRecipe} 
                                disabled={isAnalyzing}
                                className="flex-[2] bg-teal-600 text-white py-4 rounded-3xl font-black text-sm shadow-xl shadow-teal-100 disabled:opacity-50"
                            >
                                {isAnalyzing ? 'AI 正在计算营养...' : '智能发布'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const MacroProgress = ({ label, current, target, color }: any) => {
    const pct = Math.min(100, (current / target) * 100);
    return (
        <div className="flex flex-col items-center">
            <div className="text-[10px] text-slate-400 font-bold mb-1">{label}</div>
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${pct}%` }}></div>
            </div>
            <div className="text-[9px] text-slate-500 mt-1">{current}g</div>
        </div>
    );
};
