
import React, { useState, useEffect } from 'react';
import { fetchContent, ContentItem } from '../../services/contentService';
import { HealthAssessment } from '../../types';

interface Props {
    userId: string;
    userName: string;
    assessment?: HealthAssessment;
}

export const UserCommunity: React.FC<Props> = ({ userId, userName, assessment }) => {
    const [events, setEvents] = useState<ContentItem[]>([]);

    useEffect(() => {
        fetchContent('event').then(setEvents);
    }, []);

    return (
        <div className="space-y-10 animate-fadeIn pb-10">
            <header className="px-2">
                <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-1">健康广场</p>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">探索活动</h1>
            </header>

            {/* Featured Event: Immersive Card */}
            {events[0] && (
                <div className="relative group cursor-pointer px-2">
                    <div className="bg-slate-900 rounded-[3rem] p-10 text-white h-[28rem] flex flex-col justify-end overflow-hidden relative shadow-2xl shadow-slate-300">
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent"></div>
                        <div className="absolute top-10 right-10 p-4 text-7xl opacity-20 transform group-hover:rotate-12 group-hover:scale-125 transition-all duration-700">✨</div>
                        
                        <div className="relative z-10">
                            <span className="bg-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">精选活动</span>
                            <h2 className="text-3xl font-black mt-4 mb-3 tracking-tight">{events[0].title}</h2>
                            <p className="text-slate-300 text-sm font-medium line-clamp-2 mb-6 opacity-80 leading-relaxed">{events[0].description}</p>
                            <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest opacity-60">
                                <span>🗓️ {events[0].details?.date}</span>
                                <span>📍 {events[0].details?.loc}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Event Feed: Detailed Stack */}
            <section className="space-y-8 px-2">
                <h2 className="text-xl font-black text-slate-800">即将开始</h2>
                <div className="space-y-6">
                    {events.slice(1).map(evt => (
                        <div key={evt.id} className="flex gap-6 bg-white p-6 rounded-[2.5rem] shadow-sm border border-white active:scale-[0.98] transition-all">
                            <div className="w-24 h-24 bg-slate-100 rounded-[1.8rem] flex-shrink-0 flex items-center justify-center text-4xl shadow-inner">
                                {evt.image || '🎉'}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h3 className="font-black text-slate-800 text-lg truncate tracking-tight">{evt.title}</h3>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📍 {evt.details?.loc}</span>
                                </div>
                                <div className="flex justify-between items-center mt-4">
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{evt.details?.date}</span>
                                    <button className="text-[10px] font-black bg-slate-900 text-white px-4 py-1.5 rounded-full uppercase shadow-md active:scale-90 transition-transform">报名</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};
