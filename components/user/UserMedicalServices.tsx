
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
    
    // Search & Filter State
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('全部');
    
    // Modal State
    const [selectedService, setSelectedService] = useState<ContentItem | null>(null);

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
            if (type === 'booking') setSelectedService(null);
        }
    };

    // --- Filtering Logic ---
    
    // 1. Doctors & Drugs (Simple Search)
    const filteredDoctors = doctors.filter(d => d.title.includes(search) || d.tags.join('').includes(search));
    const filteredDrugs = drugs.filter(d => d.title.includes(search));

    // 2. Services (Search + Category)
    // Extract unique categories from loaded services
    const serviceCategories = ['全部', ...Array.from(new Set(services.map(s => s.details?.categoryL1 || '其他').filter(Boolean)))];
    
    const filteredServices = services.filter(s => {
        const matchesSearch = s.title.includes(search) || (s.description || '').includes(search);
        const matchesCategory = activeCategory === '全部' || (s.details?.categoryL1 || '其他') === activeCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="bg-[#F8FAFC] min-h-full pb-20">
            {/* Sticky Search Header */}
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md px-6 py-4 border-b border-slate-100">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-4">寻医问药</h1>
                <div className="relative">
                    <input 
                        className="w-full bg-slate-100/50 border-none rounded-2xl py-3 pl-11 pr-4 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                        placeholder="搜索医生、项目或药品..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <span className="absolute left-4 top-3.5 text-slate-400 text-lg">🔍</span>
                </div>
            </div>

            <div className="p-6 space-y-8">
                {/* 1. Featured Doctor */}
                {(!activeCategory || activeCategory === '全部') && (
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
                            <div className="text-center text-slate-400 text-sm py-4">暂无符合条件的医生</div>
                        )}
                    </section>
                )}

                {/* 2. Medical Services Grid */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-bold text-slate-800 text-lg">便民服务</h2>
                    </div>
                    
                    {/* Category Filter */}
                    <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
                        {serviceCategories.map(cat => (
                            <button 
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
                                    activeCategory === cat 
                                    ? 'bg-blue-600 text-white shadow-blue-200' 
                                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {filteredServices.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                            {filteredServices.map((s, i) => {
                                const colors = ['bg-orange-50 text-orange-600', 'bg-purple-50 text-purple-600', 'bg-teal-50 text-teal-600', 'bg-pink-50 text-pink-600'];
                                const colorClass = colors[i % colors.length];
                                
                                return (
                                    <div 
                                        key={s.id} 
                                        onClick={() => setSelectedService(s)}
                                        className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between h-full active:scale-95 transition-transform cursor-pointer group hover:border-blue-200"
                                    >
                                        <div className="flex flex-col items-center text-center gap-2 mb-2">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-1 group-hover:scale-110 transition-transform ${colorClass}`}>
                                                {s.image}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-slate-800 line-clamp-1">{s.title}</div>
                                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">{s.details?.categoryL2 || s.details?.dept || '医疗服务'}</div>
                                            </div>
                                        </div>
                                        <div className="flex justify-center">
                                            <span className="text-[10px] bg-slate-50 text-slate-500 px-2 py-1 rounded-full font-medium">
                                                {s.details?.price ? `¥${s.details.price}` : '免费'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-slate-200">
                            <div className="text-4xl mb-2 opacity-30">🔍</div>
                            <p className="text-sm text-slate-400">未找到相关服务项目</p>
                        </div>
                    )}
                </section>

                {/* 3. Pharmacy List */}
                {(!activeCategory || activeCategory === '全部') && (
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
                )}
            </div>

            {/* Service Detail Modal */}
            {selectedService && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-end justify-center backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedService(null)}>
                    <div className="bg-white w-full max-w-md rounded-t-3xl p-0 animate-slideUp overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        
                        {/* Modal Header Image/Title */}
                        <div className="bg-slate-50 p-6 pb-8 text-center relative border-b border-slate-100">
                            <button 
                                onClick={() => setSelectedService(null)}
                                className="absolute top-4 right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-400 font-bold shadow-sm z-10"
                            >
                                ×
                            </button>
                            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-5xl shadow-sm mx-auto mb-4">
                                {selectedService.image}
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-1">{selectedService.title}</h3>
                            <div className="flex items-center justify-center gap-2">
                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                                    {selectedService.details?.dept || '综合科'}
                                </span>
                                <span className="text-sm text-slate-500">
                                    预计耗时: {selectedService.details?.duration || '待定'}
                                </span>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            {/* Key Info Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-3 rounded-xl">
                                    <div className="text-xs text-slate-400 mb-1">参考价格</div>
                                    <div className="font-bold text-slate-800">
                                        {selectedService.details?.price ? `¥${selectedService.details.price}` : '免费'}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">{selectedService.details?.insuranceType || '自费'}</div>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl">
                                    <div className="text-xs text-slate-400 mb-1">就诊地点</div>
                                    <div className="font-bold text-slate-800 text-sm line-clamp-2">
                                        {selectedService.details?.location || '门诊楼'}
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm mb-2">项目简介</h4>
                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl">
                                    {selectedService.description || '暂无简介'}
                                </p>
                            </div>

                            {/* Workflow */}
                            {selectedService.details?.workflow && (
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm mb-2">服务流程</h4>
                                    <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line pl-4 border-l-2 border-slate-200">
                                        {selectedService.details.workflow}
                                    </div>
                                </div>
                            )}

                            {/* Audience & Warnings */}
                            <div className="space-y-3">
                                {selectedService.details?.audience && (
                                    <div className="flex gap-2 text-sm">
                                        <span className="text-slate-400 shrink-0">适宜人群:</span>
                                        <span className="text-slate-700">{selectedService.details.audience}</span>
                                    </div>
                                )}
                                {selectedService.details?.contraindications && (
                                    <div className="flex gap-2 text-sm">
                                        <span className="text-red-400 shrink-0">注意事项:</span>
                                        <span className="text-slate-700">{selectedService.details.contraindications}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Action */}
                        <div className="p-4 border-t border-slate-100 bg-white">
                            <button 
                                onClick={() => handleInteract('booking', selectedService)}
                                className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <span>📅</span> 立即预约
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
