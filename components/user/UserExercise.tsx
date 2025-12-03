
import React, { useState } from 'react';
import { generateExercisePlan } from '../../services/geminiService';

export const UserExercise: React.FC = () => {
    const [subTab, setSubTab] = useState<'activity' | 'course' | 'planner'>('activity');
    
    // AI Planner State
    const [planInput, setPlanInput] = useState('');
    const [generatedPlan, setGeneratedPlan] = useState<{day:string, content:string}[] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const activities = [
        { id: 1, title: '环湖健步走', time: '周六 08:00', loc: '如意湖广场', people: 45, suit: '全年龄', cal: '200-300kcal' },
        { id: 2, title: '广场舞交流', time: '周日 19:30', loc: '社区文化广场', people: 20, suit: '中老年', cal: '150-200kcal' },
        { id: 3, title: '太极拳晨练', time: '每日 07:00', loc: '中心花园', people: 15, suit: '老年', cal: '100-150kcal' },
    ];

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
        <div className="p-4 bg-slate-50 min-h-full space-y-4 animate-fadeIn">
            {/* Sub-navigation */}
            <div className="flex bg-white p-1 rounded-xl shadow-sm">
                {[{id:'activity', label:'集体活动'}, {id:'course', label:'运动科普'}, {id:'planner', label:'计划助手'}].map(t => (
                    <button 
                        key={t.id} 
                        onClick={() => setSubTab(t.id as any)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${subTab === t.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-500'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {subTab === 'activity' && (
                <div className="space-y-4">
                    {activities.map(act => (
                        <div key={act.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                             <div className="flex justify-between items-start mb-2">
                                 <h4 className="font-bold text-slate-800 text-lg">{act.title}</h4>
                                 <div className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded font-bold">🔥 {act.cal}</div>
                             </div>
                             <div className="grid grid-cols-2 gap-y-2 text-sm text-slate-600 mb-4">
                                 <div>🕒 {act.time}</div>
                                 <div>📍 {act.loc}</div>
                                 <div>👥 已报: {act.people}人</div>
                                 <div>🎯 适合: {act.suit}</div>
                             </div>
                             <button className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold shadow-sm hover:bg-indigo-700">预约报名</button>
                        </div>
                    ))}
                </div>
            )}

            {subTab === 'course' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        {['办公室拉伸', '膝关节保护', '核心力量初级', '心肺功能提升'].map((c, i) => (
                            <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200 group cursor-pointer">
                                <div className="aspect-video bg-slate-800 flex items-center justify-center relative">
                                    <span className="text-3xl group-hover:scale-110 transition-transform">▶️</span>
                                </div>
                                <div className="p-3">
                                    <div className="font-bold text-sm text-slate-800">{c}</div>
                                    <div className="text-xs text-slate-400 mt-1">专业教练演示 • 10分钟</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {subTab === 'planner' && (
                <div className="space-y-4">
                    {!generatedPlan ? (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-lg text-slate-800 mb-2">AI 运动计划定制</h3>
                            <p className="text-xs text-slate-500 mb-4">告诉我您的身体状况（如膝盖痛、高血压）、运动目标（减脂、增肌）及每周可用时间。</p>
                            <textarea 
                                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-32 mb-4"
                                placeholder="例如：我有轻度高血压，膝盖偶尔疼，想减重，每周能运动3-4次..."
                                value={planInput}
                                onChange={e => setPlanInput(e.target.value)}
                            />
                            <button 
                                onClick={handlePlan}
                                disabled={isGenerating}
                                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold shadow-lg disabled:opacity-50"
                            >
                                {isGenerating ? '生成中...' : '生成专属计划'}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                             <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-slate-800">您的专属周计划</h3>
                                <button onClick={() => setGeneratedPlan(null)} className="text-xs text-indigo-600 underline">重新定制</button>
                             </div>
                             <div className="space-y-3">
                                 {generatedPlan.map((day, i) => (
                                     <div key={i} className="flex gap-3 items-start pb-3 border-b border-slate-50 last:border-0">
                                         <div className="w-12 pt-1 font-bold text-slate-400 text-sm">{day.day}</div>
                                         <div className="flex-1">
                                             <div className="text-sm text-slate-800">{day.content}</div>
                                             <button className="mt-2 text-xs border border-slate-200 px-2 py-0.5 rounded text-slate-400 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors">
                                                 打卡完成
                                             </button>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
