
import React, { useState } from 'react';
import { generateDietAssessment } from '../../services/geminiService';

export const UserDiet: React.FC = () => {
    const [subTab, setSubTab] = useState<'canteen' | 'salon' | 'knowledge' | 'ai'>('canteen');
    
    // AI Chat State
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState<{role: 'user'|'ai', content: string}[]>([
        {role: 'ai', content: '你好！我是你的膳食智能评估助手。请告诉我你今天吃了什么，或者有什么饮食方面的困惑？'}
    ]);
    const [isThinking, setIsThinking] = useState(false);

    // Mock Data
    const meals = [
        { id: 1, name: '低脂鸡胸肉套餐', cal: '450kcal', tags: ['高蛋白', '低盐'], img: '🍱', ingredients: '鸡胸肉 150g, 西兰花 100g, 杂粮饭 150g' },
        { id: 2, name: '清蒸鲈鱼套餐', cal: '520kcal', tags: ['优质脂肪', '护脑'], img: '🐟', ingredients: '鲈鱼 200g, 青菜 100g, 米饭 150g' },
        { id: 3, name: '素食什锦小炒', cal: '380kcal', tags: ['高纤维', '通便'], img: '🥗', ingredients: '木耳, 藕片, 胡萝卜, 荷兰豆' },
    ];

    const salons = [
        { id: 1, title: '春季养生药膳分享会', date: '5月20日 14:00', loc: '社区活动中心201', count: 12, max: 20 },
        { id: 2, title: '减糖烘焙体验课', date: '5月25日 09:30', loc: '共享厨房', count: 8, max: 10 },
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
        <div className="p-4 bg-slate-50 min-h-full space-y-4 animate-fadeIn">
            {/* Sub-navigation */}
            <div className="flex bg-white p-1 rounded-xl shadow-sm">
                {[{id:'canteen', label:'社区食堂'}, {id:'salon', label:'美食沙龙'}, {id:'knowledge', label:'营养科普'}, {id:'ai', label:'AI助手'}].map(t => (
                    <button 
                        key={t.id} 
                        onClick={() => setSubTab(t.id as any)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${subTab === t.id ? 'bg-teal-600 text-white shadow' : 'text-slate-500'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Content Areas */}
            {subTab === 'canteen' && (
                <div className="space-y-4">
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-center justify-between">
                        <div>
                            <div className="font-bold text-orange-800">今日健康推荐</div>
                            <div className="text-xs text-orange-600">经医院营养科审核认证</div>
                        </div>
                        <span className="text-2xl">👩‍🍳</span>
                    </div>
                    <div className="grid gap-4">
                        {meals.map(meal => (
                            <div key={meal.id} onClick={() => setSelectedMeal(meal)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex gap-4 cursor-pointer hover:border-teal-400 transition-all">
                                <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-3xl">{meal.img}</div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-800">{meal.name}</h4>
                                    <div className="text-xs text-slate-500 mt-1">热量: {meal.cal}</div>
                                    <div className="flex gap-2 mt-2">
                                        {meal.tags.map(t => <span key={t} className="text-[10px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded">{t}</span>)}
                                    </div>
                                </div>
                                <div className="self-center">
                                    <button className="text-xs bg-slate-100 px-3 py-1.5 rounded-full font-bold text-slate-600">详情</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Meal Detail Modal */}
                    {selectedMeal && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMeal(null)}>
                            <div className="bg-white rounded-xl p-6 w-full max-w-sm animate-scaleIn" onClick={e => e.stopPropagation()}>
                                <div className="text-center mb-4">
                                    <div className="text-6xl mb-2">{selectedMeal.img}</div>
                                    <h3 className="text-xl font-bold">{selectedMeal.name}</h3>
                                </div>
                                <div className="space-y-3 text-sm text-slate-600">
                                    <div className="bg-slate-50 p-3 rounded-lg">
                                        <span className="font-bold block mb-1">🥘 核心配料:</span>
                                        {selectedMeal.ingredients}
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg">
                                        <span className="font-bold block mb-1">🥗 营养亮点:</span>
                                        {selectedMeal.tags.join('、')}，适合需要控制体重及慢性病人群食用。
                                    </div>
                                </div>
                                <button className="mt-6 w-full bg-teal-600 text-white py-2 rounded-lg font-bold" onClick={() => setSelectedMeal(null)}>关闭</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {subTab === 'salon' && (
                <div className="space-y-4">
                     {salons.map(salon => (
                         <div key={salon.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                             <div className="flex justify-between items-start mb-2">
                                 <h4 className="font-bold text-slate-800 text-lg">{salon.title}</h4>
                                 <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded font-bold">报名中</span>
                             </div>
                             <div className="space-y-1 text-sm text-slate-600 mb-4">
                                 <div>🕒 时间: {salon.date}</div>
                                 <div>📍 地点: {salon.loc}</div>
                                 <div>👥 人数: {salon.count}/{salon.max}</div>
                             </div>
                             <button className="w-full bg-teal-600 text-white py-2 rounded-lg font-bold shadow-sm hover:bg-teal-700">立即报名</button>
                         </div>
                     ))}
                </div>
            )}

            {subTab === 'knowledge' && (
                <div className="space-y-3">
                    <div className="bg-teal-600 text-white p-4 rounded-xl shadow-md mb-4">
                        <h3 className="font-bold text-lg mb-1">HealthHub 营养中心</h3>
                        <p className="text-xs opacity-90">权威科学的膳食指南，助您吃出健康。</p>
                        <a href="https://www.healthhub.sg/programmes/nutrition-hub/" target="_blank" className="inline-block mt-3 text-xs bg-white text-teal-600 px-3 py-1 rounded font-bold">
                            访问官网学习 🔗
                        </a>
                    </div>
                    {[
                        {title: '如何读懂食品营养标签？', cat: '选购指南'},
                        {title: '隐形盐无处不在，教你如何减盐', cat: '慢病管理'},
                        {title: '地中海饮食模式详解', cat: '健康饮食'},
                        {title: '蛋白质摄入误区：多吃就好吗？', cat: '营养基础'}
                    ].map((k, i) => (
                        <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-50">
                            <div>
                                <div className="font-bold text-slate-800 text-sm">{k.title}</div>
                                <div className="text-xs text-slate-400 mt-1">{k.cat}</div>
                            </div>
                            <span className="text-slate-300">›</span>
                        </div>
                    ))}
                </div>
            )}

            {subTab === 'ai' && (
                <div className="flex flex-col h-[calc(100vh-180px)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                        {chatHistory.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-teal-600 text-white rounded-tr-none' : 'bg-white text-slate-700 shadow-sm border border-slate-200 rounded-tl-none'}`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isThinking && (
                            <div className="flex justify-start">
                                <div className="bg-white text-slate-500 p-3 rounded-xl shadow-sm text-xs italic">AI 正在思考中...</div>
                            </div>
                        )}
                    </div>
                    <div className="p-3 border-t bg-white flex gap-2">
                        <input 
                            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                            placeholder="输入吃了什么，或询问营养建议..."
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleChat()}
                        />
                        <button onClick={handleChat} disabled={isThinking} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">发送</button>
                    </div>
                </div>
            )}
        </div>
    );
};
