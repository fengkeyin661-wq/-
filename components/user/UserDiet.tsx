
import React, { useState } from 'react';
import { generateDietAssessment } from '../../services/geminiService';

export const UserDiet: React.FC = () => {
    // AI Chat State
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState<{role: 'user'|'ai', content: string}[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [showAiInput, setShowAiInput] = useState(false);

    // Mock Data (Salons removed)
    const meals = [
        { id: 1, name: '低脂鸡胸肉套餐', cal: '450kcal', tags: ['高蛋白', '低盐'], img: '🍱', ingredients: '鸡胸肉 150g, 西兰花 100g, 杂粮饭 150g' },
        { id: 2, name: '清蒸鲈鱼套餐', cal: '520kcal', tags: ['优质脂肪', '护脑'], img: '🐟', ingredients: '鲈鱼 200g, 青菜 100g, 米饭 150g' },
        { id: 3, name: '素食什锦小炒', cal: '380kcal', tags: ['高纤维', '通便'], img: '🥗', ingredients: '木耳, 藕片, 胡萝卜, 荷兰豆' },
    ];

    const handleChat = async () => {
        if(!chatInput.trim()) return;
        const msg = chatInput;
        setChatInput('');
        setChatHistory(prev => [...prev, {role: 'user', content: msg}]);
        setIsThinking(true);
        try {
            const res = await generateDietAssessment(msg);
            setChatHistory(prev => [...prev, {role: 'ai', content: res.reply}]);
        } catch(e) {
            setChatHistory(prev => [...prev, {role: 'ai', content: '抱歉，我现在有点累，请稍后再试。'}]);
        } finally {
            setIsThinking(false);
        }
    };

    const [selectedMeal, setSelectedMeal] = useState<any>(null);

    return (
        <div className="min-h-full bg-slate-50">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">健康饮食</h1>
                    <p className="text-xs text-slate-500 font-medium">三分练，七分吃</p>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl">🥑</div>
            </div>

            <div className="p-4 space-y-8">
                
                {/* 1. AI Assistant Card */}
                <section className="relative overflow-hidden">
                    <div className="bg-gradient-to-br from-teal-600 to-emerald-600 rounded-3xl p-6 text-white shadow-xl shadow-teal-200/50">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-xl font-bold">膳食AI助手</h2>
                                <p className="text-xs text-teal-100 mt-1 opacity-90">拍一拍或输入食物，分析营养热量</p>
                            </div>
                            <span className="text-4xl opacity-20">🤖</span>
                        </div>
                        
                        {/* Chat Display Area */}
                        <div className="bg-white/10 rounded-xl p-3 mb-4 min-h-[80px] max-h-[150px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 text-sm space-y-2">
                            {chatHistory.length === 0 && <p className="text-teal-50 opacity-60 italic text-xs">试试输入: "我中午吃了一碗牛肉面，热量高吗？"</p>}
                            {chatHistory.map((msg, i) => (
                                <div key={i} className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                    <span className={`inline-block px-2 py-1 rounded-lg text-xs ${msg.role === 'user' ? 'bg-white/20' : 'bg-black/20'}`}>
                                        {msg.content}
                                    </span>
                                </div>
                            ))}
                            {isThinking && <p className="text-xs animate-pulse">Thinking...</p>}
                        </div>

                        <div className="flex gap-2">
                            <input 
                                className="flex-1 bg-white/20 border border-white/30 rounded-xl px-4 py-2 text-sm text-white placeholder-teal-100 focus:outline-none focus:bg-white/30 transition-all"
                                placeholder="输入您的问题..."
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleChat()}
                            />
                            <button onClick={handleChat} className="bg-white text-teal-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-teal-50 transition-colors">
                                发送
                            </button>
                        </div>
                    </div>
                </section>

                {/* 2. Canteen Menu (Horizontal Scroll) */}
                <section>
                    <div className="flex justify-between items-center mb-4 px-2">
                        <h2 className="text-lg font-bold text-slate-800">社区食堂 · 今日特供</h2>
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-bold">营养科认证</span>
                    </div>
                    
                    <div className="flex overflow-x-auto gap-4 pb-4 px-2 scrollbar-hide snap-x">
                        {meals.map(meal => (
                            <div 
                                key={meal.id} 
                                onClick={() => setSelectedMeal(meal)}
                                className="snap-center min-w-[200px] bg-white rounded-2xl p-3 shadow-sm border border-slate-100 cursor-pointer active:scale-95 transition-transform"
                            >
                                <div className="aspect-square bg-slate-50 rounded-xl flex items-center justify-center text-6xl mb-3">
                                    {meal.img}
                                </div>
                                <h3 className="font-bold text-slate-800 text-sm truncate">{meal.name}</h3>
                                <div className="text-xs text-slate-400 mt-1 font-mono">{meal.cal}</div>
                                <div className="flex gap-1 mt-2">
                                    {meal.tags.map(t => <span key={t} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{t}</span>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 3. Knowledge Base (Vertical List) */}
                <section className="px-2">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">营养科普</h2>
                    <div className="space-y-3">
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-slate-50">
                            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-2xl">📘</div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-800 text-sm">HealthHub 权威指南</h3>
                                <p className="text-xs text-slate-400 mt-1">新加坡健康促进局官方膳食建议</p>
                            </div>
                            <span className="text-slate-300">›</span>
                        </div>
                        {[
                            {title: '如何读懂食品营养标签？', cat: '选购指南', icon: '🏷️'},
                            {title: '隐形盐无处不在，教你如何减盐', cat: '慢病管理', icon: '🧂'},
                            {title: '地中海饮食模式详解', cat: '健康饮食', icon: '🥗'},
                        ].map((k, i) => (
                            <div key={i} className="flex gap-4 items-center p-2 rounded-xl active:bg-slate-100 transition-colors">
                                <div className="w-10 h-10 bg-white border border-slate-100 rounded-lg flex items-center justify-center shadow-sm">
                                    {k.icon}
                                </div>
                                <div className="flex-1 border-b border-slate-100 pb-2">
                                    <div className="font-bold text-slate-700 text-sm">{k.title}</div>
                                    <div className="text-[10px] text-slate-400 mt-1 bg-slate-100 inline-block px-1.5 rounded">{k.cat}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="h-10"></div>
            </div>

            {/* Meal Modal */}
            {selectedMeal && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm" onClick={() => setSelectedMeal(null)}>
                    <div className="bg-white w-full sm:w-80 rounded-t-3xl sm:rounded-3xl p-6 animate-slideUp" onClick={e => e.stopPropagation()}>
                        <div className="text-center mb-6">
                            <div className="text-8xl mb-4 animate-bounce">{selectedMeal.img}</div>
                            <h3 className="text-2xl font-black text-slate-800">{selectedMeal.name}</h3>
                            <p className="text-orange-500 font-bold mt-1">{selectedMeal.cal}</p>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-slate-50 p-4 rounded-2xl">
                                <div className="text-xs font-bold text-slate-400 uppercase mb-2">核心配料</div>
                                <p className="text-sm text-slate-700 font-medium">{selectedMeal.ingredients}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl">
                                <div className="text-xs font-bold text-slate-400 uppercase mb-2">营养点评</div>
                                <p className="text-sm text-slate-700">该餐品{selectedMeal.tags.join('、')}，膳食纤维丰富，适合作为午餐食用，建议细嚼慢咽。</p>
                            </div>
                        </div>
                        <button className="mt-8 w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-transform" onClick={() => setSelectedMeal(null)}>
                            关闭
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
