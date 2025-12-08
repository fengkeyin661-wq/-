
import React, { useState, useEffect } from 'react';
import { fetchContent, ContentItem } from '../../services/contentService';

export const UserMedicalServices: React.FC = () => {
    const [doctors, setDoctors] = useState<ContentItem[]>([]);
    const [drugs, setDrugs] = useState<ContentItem[]>([]);
    const [services, setServices] = useState<ContentItem[]>([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const load = async () => {
            const docs = await fetchContent('doctor');
            const meds = await fetchContent('drug');
            const svcs = await fetchContent('service');
            setDoctors(docs);
            setDrugs(meds);
            setServices(svcs);
        };
        load();
    }, []);

    const filteredDoctors = doctors.filter(d => d.title.includes(search) || d.tags.join('').includes(search));
    const filteredDrugs = drugs.filter(d => d.title.includes(search));

    return (
        <div className="bg-slate-50 min-h-full p-4 space-y-6">
            {/* Search */}
            <div className="relative">
                <input 
                    className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="搜医生、查药品、找检查..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <span className="absolute left-3 top-3 text-slate-400">🔍</span>
            </div>

            {/* 1. Quick Services */}
            <section>
                <h2 className="font-bold text-slate-800 mb-3 flex justify-between">
                    医疗服务
                    <span className="text-xs text-blue-600 font-normal">支持预约/上门</span>
                </h2>
                <div className="grid grid-cols-2 gap-3">
                    {services.map(s => (
                        <div key={s.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 active:bg-blue-50 cursor-pointer">
                            <div className="text-2xl bg-blue-50 w-10 h-10 rounded-full flex items-center justify-center">{s.image}</div>
                            <div>
                                <div className="font-bold text-sm text-slate-800">{s.title}</div>
                                <div className="text-[10px] text-slate-500">{s.details?.price || '预约咨询'}</div>
                            </div>
                        </div>
                    ))}
                    {/* Hardcoded Actions */}
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 active:bg-blue-50 cursor-pointer">
                        <div className="text-2xl bg-green-50 w-10 h-10 rounded-full flex items-center justify-center">📅</div>
                        <div>
                            <div className="font-bold text-sm text-slate-800">门诊预约</div>
                            <div className="text-[10px] text-slate-500">实时号源</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 2. Doctor Recommendation */}
            <section>
                <h2 className="font-bold text-slate-800 mb-3">名医专家 & 健康管家</h2>
                <div className="space-y-3">
                    {filteredDoctors.map(doc => (
                        <div key={doc.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex gap-4">
                            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-3xl shadow-inner">
                                {doc.image}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-base">{doc.title}</h3>
                                        <div className="text-xs text-slate-500 mt-0.5">{doc.details?.dept} · {doc.details?.title}</div>
                                    </div>
                                    <button className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow hover:bg-blue-700">问诊</button>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {doc.tags.map(t => <span key={t} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{t}</span>)}
                                </div>
                                <p className="text-xs text-slate-400 mt-2 line-clamp-1">{doc.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 3. Pharmacy */}
            <section>
                <h2 className="font-bold text-slate-800 mb-3 flex justify-between">
                    便民药房
                    <span className="text-xs text-slate-400 font-normal">支持配送</span>
                </h2>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 divide-y divide-slate-50">
                    {filteredDrugs.length > 0 ? filteredDrugs.map(drug => (
                        <div key={drug.id} className="p-3 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="text-xl bg-slate-50 w-10 h-10 rounded flex items-center justify-center">{drug.image}</div>
                                <div>
                                    <div className="font-bold text-sm text-slate-700">{drug.title}</div>
                                    <div className="text-[10px] text-slate-400">{drug.description}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold text-orange-600">{drug.details?.price || '询价'}</div>
                                <span className={`text-[10px] px-1.5 rounded ${drug.details?.stock === '充足' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {drug.details?.stock || '有货'}
                                </span>
                            </div>
                        </div>
                    )) : <div className="p-4 text-center text-xs text-slate-400">暂无相关药品</div>}
                </div>
            </section>
        </div>
    );
};
