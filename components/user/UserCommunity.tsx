
import React, { useState, useEffect } from 'react';
import { fetchContent, ContentItem } from '../../services/contentService';
import { HealthAssessment } from '../../types';

export interface UserCommunityProps {
    userId: string;
    userName: string;
    assessment?: HealthAssessment;
}

export const UserCommunity: React.FC<UserCommunityProps> = ({ userId, userName, assessment }) => {
    const [events, setEvents] = useState<ContentItem[]>([]);

    useEffect(() => {
        fetchContent('event', 'active').then(setEvents);
    }, []);

    return (
        <div className="space-y-10 animate-fadeIn pb-10">
            <header className="px-2">
                <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-1">健康广场</p>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">探索活动</h1>
            </header>

            <section className="space-y-8 px-2">
                <h2 className="text-xl font-black text-slate-800">即将开始</h2>
                <div className="space-y-6">
                    {events.map(evt => (
                        <div key={evt.id} className="flex gap-6 bg-white p-6 rounded-[2.5rem] shadow-sm border border-white active:scale-[0.98] transition-all">
                            <div className="w-24 h-24 bg-slate-100 rounded-[1.8rem] flex-shrink-0 flex items-center justify-center text-4xl shadow-inner">
                                {evt.image || '🎉'}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h3 className="font-black text-slate-800 text-lg truncate tracking-tight">{evt.title}</h3>
                                <div className="flex justify-between items-center mt-4">
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{evt.details?.date || '待定'}</span>
                                    <button className="text-[10px] font-black bg-slate-900 text-white px-4 py-1.5 rounded-full uppercase shadow-md">报名</button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {events.length === 0 && <p className="text-center text-slate-400 py-10">暂无活动</p>}
                </div>
            </section>
        </div>
    );
};
