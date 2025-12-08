
import React, { useState, useEffect } from 'react';
import { fetchContent, ContentItem } from '../../services/contentService';

export const UserInteraction: React.FC = () => {
    const [events, setEvents] = useState<ContentItem[]>([]);
    const [activeSegment, setActiveSegment] = useState<'chat' | 'event'>('chat');

    useEffect(() => {
        const load = async () => {
            const data = await fetchContent('event');
            setEvents(data);
        };
        load();
    }, []);

    return (
        <div className="bg-slate-50 min-h-full">
            {/* Segment Control */}
            <div className="sticky top-0 z-20 bg-white border-b border-slate-200 flex">
                <button 
                    onClick={() => setActiveSegment('chat')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeSegment === 'chat' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}
                >
                    医生互动
                </button>
                <button 
                    onClick={() => setActiveSegment('event')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeSegment === 'event' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}
                >
                    社区活动
                </button>
            </div>

            <div className="p-4">
                {activeSegment === 'chat' && (
                    <div className="space-y-4">
                        {/* Mock Chat List */}
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-blue-800">我的家庭医生</h3>
                                <p className="text-xs text-blue-600 mt-1">专属健康管家，随时响应</p>
                            </div>
                            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md">立即咨询</button>
                        </div>

                        <div className="space-y-2">
                            {[
                                { name: '张主任 (心内科)', lastMsg: '您的血压控制得不错，继续保持。', time: '10:30', unread: 0, avatar: '👨‍⚕️' },
                                { name: '李营养师', lastMsg: '收到您的饮食打卡，建议晚餐减少碳水...', time: '昨天', unread: 2, avatar: '👩‍⚕️' },
                                { name: '王康复师', lastMsg: '[图片] 请按照这个视频进行膝关节训练', time: '周一', unread: 0, avatar: '🏃' },
                            ].map((chat, i) => (
                                <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex gap-3 active:bg-slate-50">
                                    <div className="relative">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-2xl">{chat.avatar}</div>
                                        {chat.unread > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center border border-white">{chat.unread}</span>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-slate-800 text-sm">{chat.name}</span>
                                            <span className="text-[10px] text-slate-400">{chat.time}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 truncate">{chat.lastMsg}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeSegment === 'event' && (
                    <div className="space-y-4">
                        <div className="bg-teal-600 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="font-bold text-lg mb-1">健康生活，一起行动！</h3>
                                <p className="text-xs opacity-90 mb-3">参加集体活动，赢取健康积分兑换好礼</p>
                                <button className="bg-white text-teal-700 px-3 py-1 rounded text-xs font-bold">查看积分商城</button>
                            </div>
                            <div className="absolute right-0 top-0 text-8xl opacity-20">🎉</div>
                        </div>

                        <div className="space-y-4">
                            {events.map(evt => (
                                <div key={evt.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 group">
                                    <div className="h-32 bg-slate-100 relative flex items-center justify-center text-6xl group-hover:scale-105 transition-transform duration-500">
                                        {evt.image}
                                        <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm">
                                            {evt.tags[0] || '活动'}
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-bold text-slate-800 text-base">{evt.title}</h3>
                                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                                            <span>📅 {evt.details?.date}</span>
                                            <span>📍 {evt.details?.loc}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2 line-clamp-2">{evt.description}</p>
                                        
                                        <div className="mt-4 flex justify-between items-center border-t border-slate-50 pt-3">
                                            <div className="text-xs text-slate-500">
                                                已报名 <span className="font-bold text-teal-600">{evt.details?.registered || 0}</span> / {evt.details?.max}
                                            </div>
                                            <button className="bg-teal-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow hover:bg-teal-700">
                                                立即报名
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
