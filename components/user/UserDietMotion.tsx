
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
        <div className="bg-[#F8FAFC] min-h-full pb-20">
            {/* Header: Clean & Modern */}
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl px-6 py-5 border-b border-slate-100 flex justify-between items-end">
                <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">{new Date().toDateString()}</p>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">健康生活</h1>
                </div>
                <button onClick={() => { setUploadType('meal'); setShowUpload(true); }} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold hover:bg-slate-200 transition-colors">
                    +
                </button>
            </div>

            {/* AI Generator Banner */}
            <div className="px-6 mt-6">
                <div className="bg-gradient-to-r from-teal-500 to-emerald-500 rounded-3xl p-5 text-white shadow-lg shadow-teal-200/50 relative overflow-hidden flex justify-between items-center">
                    <div className="relative z-10">
                        <h3 className="font-bold text-lg mb-1">今日定制方案</h3>
                        <p className="text-teal-100 text-xs opacity-90 mb-3">基于您的最新体检数据生成</p>
                        <button 
                            onClick={handleGenerateOneClick}
                            disabled={isGenerating}
                            className="bg-white text-teal-600 px-4 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-transform flex items-center gap-2"
                        >
                            {isGenerating ? '⏳ 生成中...' : '✨ 一键生成'}
                        </button>
                    </div>
                    <div className="text-6xl opacity-20 absolute -right-2 -bottom-4 rotate-12">⚡</div>
                </div>
            </div>

            <div className="p-6 space-y-10">
                {/* 1. Diet Section */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-teal-500 rounded-full"></span>
                            健康饮食
                        </h2>
                        <span className="text-xs text-slate-400 font-bold">查看全部 ›</span>
                    </div>
                    
                    {/* Horizontal Scroll Cards */}
                    <div className="flex overflow-x-auto gap-4 pb-4 -mx-6 px-6 scrollbar-hide snap-x">
                        {meals.map(item => (
                            <div key={item.id} className="snap-center shrink-0 w-44 bg-white rounded-3xl p-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col group active:scale-95 transition-transform">
                                <div className="aspect-square bg-[#F1F5F9] rounded-2xl flex items-center justify-center text-5xl mb-3 relative overflow-hidden">
                                    <span className="group-hover:scale-110 transition-transform">{item.image}</span>
                                    {item.isUserUpload && <span className="absolute top-2 right-2 text-[8px] bg-white/90 px-1.5 py-0.5 rounded-md text-slate-500 font-bold shadow-sm">U</span>}
                                </div>
                                <h3 className="font-bold text-slate-800 text-sm truncate px-1">{item.title}</h3>
                                <p className="text-xs text-slate-400 mt-1 line-clamp-1 px-1">{item.description || '暂无描述'}</p>
                                <div className="flex gap-1 mt-2 px-1">
                                    {item.tags.slice(0, 2).map((t, i) => (
                                        <span key={i} className="text-[9px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded font-medium">{t}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {meals.length === 0 && <div className="text-sm text-slate-400 w-full text-center py-4">暂无推荐</div>}
                    </div>
                </section>

                {/* 2. Motion Section */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>
                            科学运动
                        </h2>
                        <span className="text-xs text-slate-400 font-bold">查看全部 ›</span>
                    </div>
                    
                    <div className="space-y-3">
                        {exercises.map(item => (
                            <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4 active:bg-slate-50 transition-colors">
                                <div className="w-14 h-14 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                                    {item.image}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-800 text-sm truncate">{item.title}</h3>
                                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.description}</p>
                                    <div className="flex gap-2 mt-2">
                                        {item.tags.map(t => <span key={t} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 rounded">{t}</span>)}
                                    </div>
                                </div>
                                <button className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100">
                                    ▶
                                </button>
                            </div>
                        ))}
                        {exercises.length === 0 && <div className="text-center text-sm text-slate-400 py-4">暂无运动课程</div>}
                    </div>
                </section>
            </div>

            {/* Upload Modal (iOS Style Sheet) */}
            {showUpload && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-t-3xl w-full max-w-md p-6 animate-slideUp shadow-2xl">
                        <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6"></div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">发布新内容</h3>
                            <div className="flex bg-slate-100 rounded-lg p-1">
                                <button onClick={()=>setUploadType('meal')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${uploadType==='meal'?'bg-white shadow text-slate-800':'text-slate-500'}`}>食谱</button>
                                <button onClick={()=>setUploadType('exercise')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${uploadType==='exercise'?'bg-white shadow text-slate-800':'text-slate-500'}`}>运动</button>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <input 
                                className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-teal-500 outline-none font-bold placeholder:font-normal"
                                placeholder="标题 (如: 减脂早餐)"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                            />
                            <textarea 
                                className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm h-32 focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                                placeholder="描述 (配料、步骤、心得...)"
                                value={newDesc}
                                onChange={e => setNewDesc(e.target.value)}
                            />
                            <input 
                                className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                placeholder="标签 (如: 减重, 低脂)"
                                value={newTags}
                                onChange={e => setNewTags(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setShowUpload(false)} className="flex-1 py-3 text-slate-500 bg-slate-50 rounded-xl text-sm font-bold">取消</button>
                            <button onClick={handleUpload} className="flex-1 py-3 bg-teal-600 text-white font-bold rounded-xl shadow-lg shadow-teal-200 hover:bg-teal-700 active:scale-95 transition-transform">发布</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
