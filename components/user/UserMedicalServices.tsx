
import React, { useState, useEffect } from 'react';
import { fetchContent, ContentItem, saveInteraction, InteractionItem } from '../../services/contentService';

interface Props {
    userId: string;
    userName: string;
}

export const UserMedicalServices: React.FC<Props> = ({ userId, userName }) => {
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

    const handleInteract = async (type: InteractionItem['type'], target: ContentItem) => {
        if (!userId) return alert("用户信息缺失");
        
        const textMap: any = {
            'signing': '签约申请',
            'booking': '服务预约',
            'drug_order': '开药申请'
        };

        if(confirm(`确定要提交【${target.title}】的${textMap[type]}吗？`)) {
            await saveInteraction({
                id: `${type}_${Date.now()}`,
                type: type,
                userId: userId,
                userName: userName,
                targetId: target.id,
                targetName: target.title,
                status: 'pending',
                date: new Date().toISOString().split('T')[0],
                details: type === 'drug_order' ? `规格: ${target.details?.spec}` : type === 'booking' ? `价格: ${target.details?.price}` : '申请家庭医生签约'
            });
            alert("申请已提交，请等待医生审核。");
        }
    };

    const filteredDoctors = doctors.filter(d => d.title.includes(search) || d.tags.join('').includes(search));
    const filteredDrugs = drugs.filter(d => d.title.includes(search));

    return (
        <div className="bg-[#F8FAFC] min-h-full pb-20">
            {/* Sticky Search Header */}
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md px-6 py-4 border-b border-slate-100">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-4">寻医问药</h1>
                <div className="relative">
                    <input 
                        className="w-full bg-slate-100/50 border-none rounded-2xl py-3 pl-11 pr-4 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                        placeholder="搜索医生、药品或服务..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <span className="absolute left-4 top-3.5 text-slate-400 text-lg">🔍</span>
                </div>
            </div>

            <div className="p-6 space-y-8">
                {/* 1. Featured Doctor */}
                <section>
                    <h2 className="font-bold text-slate-800 mb-4 text-lg">名医推荐</h2>
                    {filteredDoctors.length > 0 ? (
                        <div className="space-y-4">
                            {filteredDoctors.slice(0,3).map(doc => (
                                <div key={doc.id} className="bg-white p-5 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-50 flex items-start gap-4 hover:shadow-md transition-shadow cursor-pointer">
                                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-inner">
                                        {doc.image}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-base">{doc.title}</h3>
                                                <p className="text-xs text-slate-500 font-medium mt-0.5">{doc.details?.dept} · {doc.details?.title}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleInteract('signing', doc)}
                                                className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-blue-200 active:scale-95 transition-transform"
                                            >
                                                签约
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {doc.tags.map(t => <span key={t} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded-md">{t}</span>)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-slate-400 text-sm py-4">暂无医生</div>
                    )}
                </section>

                {/* 2. Medical Services Grid */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-bold text-slate-800 text-lg">便民服务</h2>
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-bold">支持预约</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {services.map((s, i) => {
                            const colors = ['bg-orange-50 text-orange-600', 'bg-purple-50 text-purple-600', 'bg-teal-50 text-teal-600', 'bg-pink-50 text-pink-600'];
                            const colorClass = colors[i % colors.length];
                            
                            return (
                                <div 
                                    key={s.id} 
                                    onClick={() => handleInteract('booking', s)}
                                    className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center gap-2 active:scale-95 transition-transform cursor-pointer"
                                >
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-1 ${colorClass}`}>
                                        {s.image}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-slate-800">{s.title}</div>
                                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">{s.details?.price ? `¥${s.details.price}` : '免费咨询'}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 3. Pharmacy List */}
                <section>
                    <h2 className="font-bold text-slate-800 mb-4 text-lg">智慧药房</h2>
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                        {filteredDrugs.length > 0 ? filteredDrugs.map(drug => (
                            <div key={drug.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="text-2xl bg-slate-50 w-10 h-10 rounded-xl flex items-center justify-center">{drug.image}</div>
                                    <div>
                                        <div className="font-bold text-sm text-slate-700">{drug.title}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">{drug.details?.spec}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-[10px] px-2 py-1 rounded-md font-bold ${drug.details?.stock === '充足' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                        {drug.details?.stock || '有货'}
                                    </span>
                                    <button 
                                        onClick={() => handleInteract('drug_order', drug)}
                                        className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-orange-100 hover:text-orange-600 transition-colors"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        )) : <div className="p-6 text-center text-xs text-slate-400">暂无相关药品</div>}
                    </div>
                </section>
            </div>
        </div>
    );
};
