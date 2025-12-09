
import React, { useState, useEffect } from 'react';
import { fetchContent, saveContent, ContentItem } from '../../services/contentService';
import { HealthAssessment } from '../../types';
import { generateDailyIntegratedPlan } from '../../services/geminiService';
import { updateUserPlan, DailyHealthPlan } from '../../services/dataService';

interface Props {
    assessment?: HealthAssessment;
    userCheckupId?: string;
}

export const UserDietMotion: React.FC<Props> = ({ assessment, userCheckupId }) => {
    const [meals, setMeals] = useState<ContentItem[]>([]);
    const [exercises, setExercises] = useState<ContentItem[]>([]);
    
    const [showUpload, setShowUpload] = useState(false);
    const [uploadType, setUploadType] = useState<'meal'|'exercise'>('meal');
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Upload Form State
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newTags, setNewTags] = useState('');

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
            const dailyPlan: DailyHealthPlan = {
                generatedAt: new Date().toISOString(),
                ...plan
            };
            
            const success = await updateUserPlan(userCheckupId, dailyPlan);
            if (success) {
                alert("方案已生成并保存到【我的-我的方案】中！");
            } else {
                alert("生成成功但保存失败，请检查网络");
            }
        } catch (e) {
            alert("生成失败，请重试");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="bg-slate-50 min-h-full">
            {/* Header */}
            <div className="bg-white sticky top-0 z-20 px-6 py-4 shadow-sm flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-black text-slate-800 tracking-tight">饮食与运动</h1>
                    <p className="text-xs text-slate-500 font-medium">Daily Health Routine</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleGenerateOneClick}
                        disabled={isGenerating}
                        className="bg-gradient-to-r from-orange-400 to-pink-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-md animate-pulse disabled:opacity-50 flex items-center gap-1"
                    >
                        {isGenerating ? '⏳ 生成中' : '⚡ 智能方案'}
                    </button>
                    <button onClick={() => { setUploadType('meal'); setShowUpload(true); }} className="text-xl bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center text-slate-600 font-bold hover:bg-slate-200">
                        +
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-8">
                {/* 1. Diet Section */}
                <section>
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <span className="text-lg bg-green-100 w-8 h-8 rounded-full flex items-center justify-center">🥗</span>
                        <h2 className="font-bold text-slate-800 text-lg">
                            健康饮食
                        </h2>
                    </div>
                    <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide snap-x">
                        {meals.map(item => (
                            <Card key={item.id} item={item} />
                        ))}
                        {meals.length === 0 && <div className="text-xs text-slate-400 p-2">暂无食谱推荐</div>}
                    </div>
                </section>

                {/* 2. Motion Section */}
                <section>
                    <div className="flex items-center gap-2 mb-3 px-1 border-t border-slate-200 pt-6">
                        <span className="text-lg bg-blue-100 w-8 h-8 rounded-full flex items-center justify-center">🏃</span>
                        <h2 className="font-bold text-slate-800 text-lg">
                            科学运动
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {exercises.map(item => (
                            <Card key={item.id} item={item} />
                        ))}
                    </div>
                    {exercises.length === 0 && <div className="text-xs text-slate-400 p-2 text-center">暂无运动课程</div>}
                </section>
            </div>

            {/* Upload Modal */}
            {showUpload && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scaleIn">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">发布新内容</h3>
                            <div className="flex bg-slate-100 rounded p-1">
                                <button onClick={()=>setUploadType('meal')} className={`px-3 py-1 rounded text-xs font-bold ${uploadType==='meal'?'bg-white shadow':''}`}>食谱</button>
                                <button onClick={()=>setUploadType('exercise')} className={`px-3 py-1 rounded text-xs font-bold ${uploadType==='exercise'?'bg-white shadow':''}`}>运动</button>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <input 
                                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                placeholder="标题 (如: 减脂早餐)"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                            />
                            <textarea 
                                className="w-full border border-slate-200 rounded-lg p-3 text-sm h-24 focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                                placeholder="描述 (配料、步骤、心得...)"
                                value={newDesc}
                                onChange={e => setNewDesc(e.target.value)}
                            />
                            <input 
                                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                placeholder="标签 (如: 减重, 低脂)"
                                value={newTags}
                                onChange={e => setNewTags(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowUpload(false)} className="flex-1 py-2 text-slate-500 hover:bg-slate-50 rounded-lg text-sm">取消</button>
                            <button onClick={handleUpload} className="flex-1 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 text-sm">发布</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Card: React.FC<{item: ContentItem}> = ({ item }) => (
    <div className={`bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 flex flex-col group active:scale-95 transition-transform min-w-[160px]`}>
        <div className={`h-24 bg-slate-50 flex items-center justify-center text-5xl relative`}>
            {item.image}
            {item.isUserUpload && <span className="absolute top-2 right-2 text-[10px] bg-white/80 px-1.5 rounded text-slate-500 border border-slate-200">用户</span>}
        </div>
        <div className="p-3 flex-1 flex flex-col">
            <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{item.title}</h3>
            <div className="flex gap-1 mt-1 flex-wrap">
                {item.tags.slice(0, 2).map((t, i) => (
                    <span key={i} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded">{t}</span>
                ))}
            </div>
        </div>
    </div>
);
