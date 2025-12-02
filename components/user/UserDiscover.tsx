
import React, { useState } from 'react';

export const UserDiscover: React.FC = () => {
    const [tab, setTab] = useState<'learn' | 'map' | 'community'>('learn');

    return (
        <div className="p-4 space-y-4 animate-fadeIn bg-slate-50 min-h-full">
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                {[{id:'learn', label:'健康科普'}, {id:'map', label:'周边资源'}, {id:'community', label:'职工圈子'}].map(t => (
                    <button 
                        key={t.id}
                        onClick={() => setTab(t.id as any)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                            tab === t.id ? 'bg-slate-800 text-white shadow' : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'learn' && (
                <div className="space-y-4">
                    {/* Featured Video */}
                    <div className="bg-slate-800 rounded-xl overflow-hidden shadow-lg relative aspect-video flex items-center justify-center group cursor-pointer">
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all"></div>
                        <span className="text-4xl relative z-10 transition-transform group-hover:scale-110">▶️</span>
                        <div className="absolute bottom-0 left-0 p-3 text-white w-full bg-gradient-to-t from-black/80 to-transparent">
                            <div className="font-bold text-sm">办公室肩颈舒缓操 (5分钟)</div>
                            <div className="text-[10px] opacity-80">运动康复科 • 2300次播放</div>
                        </div>
                    </div>

                    {/* Article List */}
                    <div className="space-y-3">
                        {[
                            { title: '春季流感高发，校医院教你三招预防', tag: '传染病预防', img: '🍃' },
                            { title: '体检报告里的“结节”都要切吗？', tag: '体检解读', img: '📄' },
                            { title: '如何科学控糖？营养师的一周食谱推荐', tag: '慢病管理', img: '🥗' },
                        ].map((art, i) => (
                            <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer">
                                <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center text-2xl shrink-0">
                                    {art.img}
                                </div>
                                <div className="flex flex-col justify-between py-1">
                                    <h4 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">{art.title}</h4>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{art.tag}</span>
                                        <span className="text-[10px] text-slate-400">3分钟前</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'map' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 min-h-[400px]">
                    <h3 className="font-bold text-slate-800 mb-2">周边健康地图</h3>
                    <div className="bg-slate-100 rounded-lg h-48 w-full mb-4 flex items-center justify-center text-slate-400">
                        🗺️ 地图组件占位符
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">🥗</div>
                            <div className="flex-1">
                                <div className="font-bold text-sm">轻食主义 (大学路店)</div>
                                <div className="text-xs text-slate-500">距您 500m • 低脂健康餐</div>
                            </div>
                            <button className="text-xs bg-slate-100 px-2 py-1 rounded">导航</button>
                        </div>
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">🏋️</div>
                            <div className="flex-1">
                                <div className="font-bold text-sm">乐刻健身 (校区北门店)</div>
                                <div className="text-xs text-slate-500">距您 800m • 24小时营业</div>
                            </div>
                            <button className="text-xs bg-slate-100 px-2 py-1 rounded">导航</button>
                        </div>
                    </div>
                </div>
            )}
            
            {tab === 'community' && (
                <div className="space-y-4">
                    <div className="bg-teal-50 p-4 rounded-xl text-center border border-teal-100">
                        <h3 className="font-bold text-teal-800">加入职工健康圈子</h3>
                        <p className="text-xs text-teal-600 mt-1 mb-3">和同事一起打卡，互相鼓励</p>
                        <button className="bg-teal-600 text-white px-6 py-2 rounded-full text-xs font-bold shadow-md">创建或加入圈子</button>
                    </div>
                    
                    <div className="space-y-3">
                        {[
                            { name: '减重互助小组', members: 45, desc: '管住嘴迈开腿，一起瘦！' },
                            { name: '每日万步走', members: 128, desc: '晒微信步数，赢健康积分' },
                            { name: '控糖交流区', members: 32, desc: '分享控糖食谱和心得' },
                        ].map((group, i) => (
                            <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                                <div>
                                    <div className="font-bold text-sm text-slate-800">#{group.name}</div>
                                    <div className="text-xs text-slate-500 mt-1">{group.desc}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs font-bold text-slate-700">{group.members}</div>
                                    <div className="text-[10px] text-slate-400">成员</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
