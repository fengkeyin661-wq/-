
import React, { useState } from 'react';
import { generateExercisePlan } from '../../services/geminiService';

export const UserExercise: React.FC = () => {
    // AI Planner State
    const [planInput, setPlanInput] = useState('');
    const [generatedPlan, setGeneratedPlan] = useState<{day:string, content:string}[] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

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

    return (
        <div className="min-h-full bg-slate-50">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">科学运动</h1>
                    <p className="text-xs text-slate-500 font-medium">生命在于运动，科学在于坚持</p>
                </div>
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-xl">🏃</div>
            </div>

            <div className="p-4 space-y-8">
                
                {/* 1. AI Planner Card */}
                <section>
                    {!generatedPlan ? (
                        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-indigo-100/50 border border-slate-100">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xl">✨</div>
                                <h2 className="text-lg font-bold text-slate-800">AI 专属计划定制</h2>
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
                                {isGenerating ? 'AI 正在思考中...' : '生成我的专属计划'}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-indigo-600 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                             <div className="flex justify-between items-center mb-6 relative z-10">
                                <h3 className="font-bold text-xl">本周运动计划</h3>
                                <button onClick={() => setGeneratedPlan(null)} className="text-xs bg-white/20 px-3 py-1 rounded-full hover:bg-white/30 transition-colors">重新定制</button>
                             </div>
                             <div className="space-y-3 relative z-10">
                                 {generatedPlan.map((day, i) => (
                                     <div key={i} className="flex gap-4 items-center bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/5">
                                         <div className="w-10 text-center text-xs font-bold opacity-70">{day.day}</div>
                                         <div className="w-px h-8 bg-white/20"></div>
                                         <div className="flex-1 text-sm font-medium">{day.content}</div>
                                     </div>
                                 ))}
                             </div>
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
        </div>
    );
};
