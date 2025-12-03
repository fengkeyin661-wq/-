
import React, { useState } from 'react';

export const UserCommunity: React.FC = () => {
    // Aggregated Data from Diet (Salons), Exercise (Activities), Medical (Lectures)
    const [events, setEvents] = useState([
        { 
            id: 1, type: 'salon', category: '美食沙龙', title: '春季养生药膳分享会', 
            date: '5月20日 14:00', loc: '社区活动中心201', count: 12, max: 20, 
            image: '🍵', color: 'bg-green-100 text-green-700', joined: false 
        },
        { 
            id: 2, type: 'activity', category: '集体活动', title: '环湖健步走', 
            date: '周六 08:00', loc: '如意湖广场', count: 45, max: 60, 
            image: '🚶', color: 'bg-orange-100 text-orange-700', joined: true 
        },
        { 
            id: 3, type: 'lecture', category: '医学讲座', title: '心血管健康与急救', 
            date: '5月22日 15:30', loc: '大礼堂', count: 88, max: 200, 
            image: '🎤', color: 'bg-blue-100 text-blue-700', joined: false 
        },
        { 
            id: 4, type: 'salon', category: '美食沙龙', title: '减糖烘焙体验课', 
            date: '5月25日 09:30', loc: '共享厨房', count: 8, max: 10, 
            image: '🍪', color: 'bg-yellow-100 text-yellow-700', joined: false 
        },
        { 
            id: 5, type: 'activity', category: '集体活动', title: '太极拳晨练小组', 
            date: '每日 07:00', loc: '中心花园', count: 15, max: 30, 
            image: '🥋', color: 'bg-indigo-100 text-indigo-700', joined: false 
        },
    ]);

    const handleJoin = (id: number) => {
        setEvents(prev => prev.map(e => e.id === id ? { ...e, joined: !e.joined, count: e.joined ? e.count - 1 : e.count + 1 } : e));
    };

    return (
        <div className="min-h-full bg-slate-50">
            {/* Modern Header */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md px-6 py-4 border-b border-slate-100">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">社区生活</h1>
                <p className="text-xs text-slate-500 font-medium">发现身边的健康伙伴与精彩活动</p>
            </div>

            <div className="p-4 space-y-8">
                
                {/* 1. Featured / Highlights (Horizontal Scroll) */}
                <section>
                    <div className="flex justify-between items-end mb-4 px-2">
                        <h2 className="text-lg font-bold text-slate-800">热门推荐 🔥</h2>
                        <span className="text-xs text-slate-400 font-bold">查看全部</span>
                    </div>
                    <div className="flex overflow-x-auto gap-4 pb-4 px-2 scrollbar-hide snap-x">
                        {events.slice(0, 3).map(evt => (
                            <div key={evt.id} className="snap-center min-w-[260px] bg-white rounded-2xl p-4 shadow-[0_8px_20px_rgb(0,0,0,0.06)] border border-slate-100 flex flex-col justify-between h-40 relative overflow-hidden group">
                                <div className={`absolute top-0 right-0 p-3 opacity-10 text-6xl group-hover:scale-125 transition-transform duration-500`}>{evt.image}</div>
                                <div>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${evt.color}`}>{evt.category}</span>
                                    <h3 className="font-bold text-slate-800 text-lg mt-2 leading-tight">{evt.title}</h3>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div className="text-xs text-slate-500">
                                        <div className="font-medium">{evt.date}</div>
                                        <div>{evt.loc}</div>
                                    </div>
                                    <button 
                                        onClick={() => handleJoin(evt.id)}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all ${evt.joined ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white active:scale-90'}`}
                                    >
                                        {evt.joined ? '✓' : '+'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 2. Community Circles */}
                <section>
                    <h2 className="text-lg font-bold text-slate-800 mb-4 px-2">健康圈子</h2>
                    <div className="grid grid-cols-2 gap-3 px-2">
                        {[
                            { name: '减重打卡', members: 128, icon: '⚖️', bg: 'bg-blue-50' },
                            { name: '控糖互助', members: 45, icon: '🥗', bg: 'bg-green-50' },
                            { name: '每日万步', members: 320, icon: '👟', bg: 'bg-orange-50' },
                            { name: '中医养生', members: 89, icon: '🌿', bg: 'bg-stone-50' },
                        ].map((g, i) => (
                            <div key={i} className={`p-4 rounded-2xl flex items-center gap-3 ${g.bg} border border-white/50 shadow-sm active:scale-95 transition-transform cursor-pointer`}>
                                <div className="text-2xl bg-white w-10 h-10 rounded-full flex items-center justify-center shadow-sm">{g.icon}</div>
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">{g.name}</div>
                                    <div className="text-[10px] text-slate-500 font-medium">{g.members} 成员</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 3. All Events Feed (Vertical) */}
                <section className="px-2">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">最新动态</h2>
                    <div className="space-y-4">
                        {events.map(evt => (
                            <div key={evt.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl shrink-0">
                                    {evt.image}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-slate-800">{evt.title}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{evt.category}</span>
                                                <span className="text-xs text-slate-500 font-medium">{evt.date}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex justify-between items-center">
                                        <div className="flex -space-x-2">
                                            {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white"></div>)}
                                            <div className="text-[10px] text-slate-400 pl-3 pt-1">{evt.count}人已报名</div>
                                        </div>
                                        <button 
                                            onClick={() => handleJoin(evt.id)}
                                            className={`text-xs px-4 py-1.5 rounded-full font-bold transition-colors ${
                                                evt.joined ? 'bg-slate-100 text-slate-400' : 'bg-teal-600 text-white shadow-md shadow-teal-200'
                                            }`}
                                        >
                                            {evt.joined ? '已报名' : '报名'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="h-10"></div>
            </div>
        </div>
    );
};
