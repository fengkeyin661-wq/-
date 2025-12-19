
import React, { useState, useEffect } from 'react';
import { fetchContent, ContentItem } from '../../services/contentService';
import { HealthAssessment } from '../../types';

interface Props {
    userId: string;
    userName: string;
    assessment?: HealthAssessment;
}

export const UserMedicalServices: React.FC<Props> = ({ userId, userName, assessment }) => {
    const [doctors, setDoctors] = useState<ContentItem[]>([]);
    const [search, setSearch] = useState('');
    const [activeCat, setActiveCat] = useState('全部');

    useEffect(() => {
        fetchContent('doctor').then(setDoctors);
    }, []);

    const categories = ['全部', '内科', '外科', '中医', '口腔', '康复'];

    return (
        <div className="space-y-10 animate-fadeIn pb-10">
            <header className="px-2">
                <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-1">医疗资源</p>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">找医生</h1>
            </header>

            {/* Search: iOS Modern Pill */}
            <div className="px-2">
                <div className="relative group">
                    <input 
                        className="w-full bg-[#E5E5EA] border-none rounded-[2rem] py-5 pl-14 pr-6 text-base font-medium focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all outline-none shadow-inner"
                        placeholder="搜索医生、科室或症状"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <span className="absolute left-6 top-5 text-xl opacity-40">🔍</span>
                </div>
            </div>

            {/* Categories: Meetup horizontal style */}
            <div className="flex gap-3 overflow-x-auto px-2 scrollbar-hide">
                {categories.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setActiveCat(cat)}
                        className={`px-6 py-2.5 rounded-full text-xs font-black whitespace-nowrap transition-all border ${
                            activeCat === cat ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-100'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Quick Actions: Feature Grid */}
            <section className="grid grid-cols-2 gap-4 px-2">
                <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] flex flex-col justify-between h-48 shadow-2xl shadow-slate-200 active:scale-95 transition-transform cursor-pointer">
                    <span className="text-4xl">🩺</span>
                    <div>
                        <h3 className="text-lg font-black tracking-tight">在线咨询</h3>
                        <p className="text-[10px] opacity-60 font-bold uppercase tracking-widest mt-1">Instant Response</p>
                    </div>
                </div>
                <div className="bg-white text-slate-900 p-8 rounded-[2.5rem] border border-white shadow-sm flex flex-col justify-between h-48 active:scale-95 transition-transform cursor-pointer">
                    <span className="text-4xl">📅</span>
                    <div>
                        <h3 className="text-lg font-black tracking-tight">预约挂号</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time Booking</p>
                    </div>
                </div>
            </section>

            {/* Experts: Airbnb Listing Style */}
            <section className="space-y-8 px-2">
                <h2 className="text-xl font-black text-slate-800">推荐专家</h2>
                <div className="grid grid-cols-1 gap-10">
                    {doctors.map(doc => (
                        <div key={doc.id} className="group cursor-pointer">
                            <div className="aspect-[1.1] bg-white rounded-[3rem] overflow-hidden mb-4 shadow-sm border border-white relative transition-all group-hover:shadow-xl group-hover:-translate-y-1">
                                <div className="w-full h-full flex items-center justify-center text-8xl bg-gradient-to-br from-slate-50 to-slate-100">
                                    {doc.image || '👨‍⚕️'}
                                </div>
                                <div className="absolute top-6 right-6 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black uppercase border border-white/50">
                                    ★ 4.9
                                </div>
                            </div>
                            <div className="px-4 flex justify-between items-start">
                                <div>
                                    <h3 className="font-black text-xl text-slate-900">{doc.title}</h3>
                                    <p className="text-sm text-slate-500 font-bold mt-1 uppercase tracking-wider">{doc.details?.dept} · {doc.details?.title}</p>
                                    <div className="flex gap-2 mt-3">
                                        {doc.tags.slice(0, 3).map(t => (
                                            <span key={t} className="text-[9px] font-black text-slate-400 border border-slate-100 px-2.5 py-1 rounded-lg uppercase bg-slate-50">{t}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-black text-slate-900">¥{doc.details?.fee}</span>
                                    <p className="text-[10px] font-black text-slate-300 uppercase">Consult Fee</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};
