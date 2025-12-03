import React, { useState, useEffect } from 'react';
import { generateExercisePlan } from '../../services/geminiService';
import { ExercisePlanData } from '../../services/dataService';

interface Props {
    savedPlan?: ExercisePlanData;
    onSavePlan?: (plan: ExercisePlanData) => void;
}

export const UserExercise: React.FC<Props> = ({ savedPlan, onSavePlan }) => {
    // AI Planner State
    const [planInput, setPlanInput] = useState('');
    const [generatedPlan, setGeneratedPlan] = useState<{day:string, content:string}[] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Check-in State
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const todayStr = new Date().toISOString().split('T')[0];
    const isCheckedIn = savedPlan?.logs?.includes(todayStr);

    const handlePlan = async () => {
        if (!planInput.trim()) return;
        setIsGenerating(true);
        try {
            const res = await generateExercisePlan(planInput);
            setGeneratedPlan(res.plan);
        } catch (e) {
            alert("生成失败，请重试");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = () => {
        if (!generatedPlan || !onSavePlan) return;
        if (confirm("确定要保存此计划吗？" + (savedPlan ? "\n注意：这将覆盖您当前的运动计划。" : ""))) {
            onSavePlan({
                generatedAt: new Date().toISOString(),
                items: generatedPlan,
                logs: savedPlan?.logs || [] // Keep existing logs if any
            });
            setGeneratedPlan(null); // Clear generated view to show saved view
            setPlanInput('');
            alert("计划已保存！可在上方“我的运动计划”查看。");
        }
    };

    const handleCheckIn = () => {
        if (!onSavePlan || !savedPlan) return;
        
        const newLogs = [...(savedPlan.logs || []), todayStr];
        // Deduplicate just in case
        const uniqueLogs = Array.from(new Set(newLogs));
        
        onSavePlan({
            ...savedPlan,
            logs: uniqueLogs
        });
        
        setShowCheckInModal(true);
    };

    return (
        <div className="min-h-full bg-slate-50 relative">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">科学运动</h1>
                    <p className="text-xs text-slate-500 font-medium">生命在于运动，科学在于坚持</p>
                </div>
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-xl">🏃</div>
            </div>

            <div className="p-4 space-y-8 pb-20">
                
                {/* 0. My Plan Section (If exists) */}
                {savedPlan && (
                    <section className="animate-fadeIn">
                        <div className="bg-indigo-600 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                             
                             <div className="relative z-10">
                                 <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="font-bold text-xl flex items-center gap-2">
                                            我的运动计划
                                            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-normal">
                                                制定于 {new Date(savedPlan.generatedAt).toLocaleDateString()}
                                            </span>
                                        </h3>
                                        <div className="text-xs text-indigo-200 mt-1">
                                            累计打卡 {savedPlan.logs?.length || 0} 天
                                        </div>
                                    </div>
                                    
                                    {/* Check-in Button */}
                                    <button 
                                        onClick={handleCheckIn}
                                        disabled={isCheckedIn}
                                        className={`px-4 py-2 rounded-xl font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-2 ${
                                            isCheckedIn 
                                            ? 'bg-white/20 text-white/70 cursor-default' 
                                            : 'bg-white text-indigo-600 hover:bg-indigo-50 animate-pulse'
                                        }`}
                                    >
                                        {isCheckedIn ? '✅ 今日已打卡' : '🕒 运动打卡'}
                                    </button>
                                 </div>

                                 <div className="space-y-3">
                                     {savedPlan.items.map((day, i) => (
                                         <div key={i} className="flex gap-4 items-start bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/5">
                                             <div className="w-10 text-center text-xs font-bold opacity-70 pt-1">{day.day}</div>
                                             <div className="w-px h-auto bg-white/20 self-stretch"></div>
                                             <div className="flex-1 text-sm font-medium leading-relaxed">{day.content}</div>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                        </div>
                    </section>
                )}

                {/* 1. AI Planner Card */}
                <section>
                    {!generatedPlan ? (
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xl">✨</div>
                                <h2 className="text-lg font-bold text-slate-800">
                                    {savedPlan ? '重新定制计划' : 'AI 专属计划定制'}
                                </h2>
                            </div>
                            <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded-xl">
                                请告诉我您的身体状况（如膝盖痛、高血压）、运动目标及每周可用时间。
                            </p>
                            <textarea 
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-32 mb-4 resize-none transition-all"
                                placeholder="例如：我有轻度高血压，膝盖偶尔疼，想减重，每周能运动3-4次..."
                                value={planInput}
                                onChange={e => setPlanInput(e.target.value)}
                            />
                            <button 
                                onClick={handlePlan}
                                disabled={isGenerating}
                                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 disabled:opacity-50 active:scale-95 transition-transform"
                            >
                                {isGenerating ? 'AI 正在思考中...' : '生成运动计划'}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-indigo-100 animate-slideUp">
                             <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-xl text-indigo-900">新生成的计划预览</h3>
                                <button onClick={() => setGeneratedPlan(null)} className="text-xs text-slate-400 hover:text-slate-600">取消</button>
                             </div>
                             <div className="space-y-3 mb-6">
                                 {generatedPlan.map((day, i) => (
                                     <div key={i} className="flex gap-4 items-start bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                                         <div className="w-12 text-center text-xs font-bold text-indigo-400 pt-1">{day.day}</div>
                                         <div className="flex-1 text-sm font-medium text-slate-700">{day.content}</div>
                                     </div>
                                 ))}
                             </div>
                             <button 
                                onClick={handleSave}
                                className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                             >
                                 <span>💾</span> 保存到我的计划
                             </button>
                        </div>
                    )}
                </section>

                {/* 2. Course Library (Grid) */}
                <section>
                    <div className="flex justify-between items-center mb-4 px-2">
                        <h2 className="text-lg font-bold text-slate-800">专业跟练课程</h2>
                        <span className="text-xs text-slate-400 font-bold">查看全部</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { title: '办公室肩颈拉伸', time: '5 min', color: 'bg-orange-100', icon: '🧘‍♀️' },
                            { title: '膝关节养护操', time: '12 min', color: 'bg-blue-100', icon: '🦵' },
                            { title: '核心力量初级', time: '15 min', color: 'bg-red-100', icon: '🔥' },
                            { title: '心肺功能提升', time: '20 min', color: 'bg-green-100', icon: '🫀' },
                        ].map((c, i) => (
                            <div key={i} className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 active:scale-95 transition-transform cursor-pointer group">
                                <div className={`aspect-video ${c.color} rounded-xl flex items-center justify-center text-4xl mb-3 relative overflow-hidden`}>
                                    <span className="group-hover:scale-110 transition-transform duration-300">{c.icon}</span>
                                    <div className="absolute bottom-2 right-2 bg-black/20 text-white text-[10px] px-1.5 rounded backdrop-blur-sm">
                                        {c.time}
                                    </div>
                                </div>
                                <div className="font-bold text-slate-800 text-sm leading-tight px-1">{c.title}</div>
                                <div className="text-[10px] text-slate-400 mt-1 px-1">专业教练演示</div>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="h-10"></div>
            </div>

            {/* Check-in Success Modal */}
            {showCheckInModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => setShowCheckInModal(false)}>
                    <div className="bg-white p-8 rounded-3xl text-center shadow-2xl transform animate-bounce w-64" onClick={e => e.stopPropagation()}>
                        <div className="text-6xl mb-4">🎉</div>
                        <h3 className="text-xl font-black text-indigo-600 mb-2">打卡成功!</h3>
                        <p className="text-sm text-slate-500 mb-6">今日运动目标已达成<br/>离健康又近了一步</p>
                        <button onClick={() => setShowCheckInModal(false)} className="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold shadow-lg">
                            太棒了
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};