
import React, { useState } from 'react';

export const UserCommunity: React.FC = () => {
    // Aggregated Data
    const [events, setEvents] = useState([
        { 
            id: 1, type: 'salon', category: '美食沙龙', title: '春季养生药膳分享会', 
            date: '5月20日 14:00', loc: '社区活动中心', count: 12, max: 20, 
            image: '🍵', color: 'bg-green-100 text-green-700', joined: false 
        },
        { 
            id: 2, type: 'activity', category: '运动', title: '环湖健步走', 
            date: '周六 08:00', loc: '如意湖广场', count: 45, max: 60, 
            image: '🚶', color: 'bg-orange-100 text-orange-700', joined: true 
        },
        { 
            id: 3, type: 'lecture', category: '医学讲座', title: '心血管健康与急救', 
            date: '5月22日 15:30', loc: '大礼堂', count: 88, max: 200, 
            image: '🎤', color: 'bg-blue-100 text-blue-700', joined: false 
        }
    ]);

    const handleJoin = (id: number) => {
        setEvents(prev => prev.map(e => e.id === id ? { ...e, joined: !e.joined, count: e.joined ? e.count - 1 : e.count + 1 } : e));
    };

    return (
        <div className="min-h-full bg-[#F8FAFC] pb-20">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-5 border-b border-slate-100">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">社区生活</h1>
                <p className="text-xs text-slate-500 font-medium">发现身边的健康伙伴</p>
            </div>

            <div className="p-6 space-y-8">
                
                {/* 1. Hero / Featured Event */}
                <section>
                    <div className="w-full bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group cursor-pointer">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                        <div className="relative z-10">
                            <span className="bg-white/20 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm">Featured</span>
                            <h2 className="text-2xl font-bold mt-3 mb-2 leading-tight">全员减重挑战赛<br/>第四季开启</h2>
                            <p className="text-slate-400 text-xs mb-4">赢取健康好礼，专业教练全程指导</p>
                            <div className="flex -space-x-2 mb-4">
                                {[1,2,3,4].map(i => <div key={i} className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-xs">👤</div>)}
                                <div className="w-8 h-8 rounded-full bg-teal-600 border-2 border-slate-900 flex items-center justify-center text-xs font-bold">+120</div>
                            </div>
                            <button className="bg-white text-slate-900 px-5 py-2 rounded-full text-xs font-bold hover:bg-slate-200 transition-colors">立即报名</button>
                        </div>
                    </div>
                </section>

                {/* 2. Circles (Horizontal Bubbles) */}
                <section>
                    <h2 className="text-lg font-bold text-slate-800 mb-4 px-1">热门圈子</h2>
                    <div className="flex gap-4 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
                        {[
                            { name: '减重打卡', icon: '⚖️', bg: 'bg-blue-50 border-blue-100' },
                            { name: '控糖互助', icon: '🥗', bg: 'bg-green-50 border-green-100' },
                            { name: '每日万步', icon: '👟', bg: 'bg-orange-50 border-orange-100' },
                            { name: '中医养生', icon: '🌿', bg: 'bg-stone-50 border-stone-100' },
                        ].map((g, i) => (
                            <div key={i} className={`flex-shrink-0 flex flex-col items-center justify-center w-24 h-28 ${g.bg} border rounded-2xl cursor-pointer active:scale-95 transition-transform`}>
                                <div className="text-3xl mb-2">{g.icon}</div>
                                <span className="text-xs font-bold text-slate-700">{g.name}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 3. Events Feed (Social Cards) */}
                <section>
                    <h2 className="text-lg font-bold text-slate-800 mb-4 px-1">活动动态</h2>
                    <div className="space-y-5">
                        {events.map(evt => (
                            <div key={evt.id} className="bg-white rounded-3xl p-5 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-100">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-3">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${evt.color}`}>
                                            {evt.image}
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-400 font-bold mb-0.5">{evt.category}</div>
                                            <h3 className="font-bold text-slate-800 text-base">{evt.title}</h3>
                                        </div>
                                    </div>
                                    <button className="text-slate-300 hover:text-slate-600">•••</button>
                                </div>
                                
                                <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center mb-4">
                                    <div className="text-xs text-slate-500 space-y-1">
                                        <div className="flex items-center gap-1">🕒 {evt.date}</div>
                                        <div className="flex items-center gap-1">📍 {evt.loc}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-black text-slate-800">{evt.count}</div>
                                        <div className="text-[10px] text-slate-400 uppercase">已报名</div>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => handleJoin(evt.id)}
                                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 ${
                                        evt.joined 
                                        ? 'bg-slate-100 text-slate-400' 
                                        : 'bg-black text-white hover:bg-slate-800'
                                    }`}
                                >
                                    {evt.joined ? '已报名' : '我要参加'}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};
