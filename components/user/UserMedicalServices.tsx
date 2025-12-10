
import React, { useState, useEffect } from 'react';
import { fetchContent, ContentItem, saveInteraction, InteractionItem } from '../../services/contentService';
import { HealthAssessment } from '../../types';

interface Props {
    userId: string;
    userName: string;
    assessment?: HealthAssessment; // Added
}

// --- Smart Icon Helper for Medical ---
const getMedicalIcon = (item: ContentItem): string => {
    const t = (item.title + (item.details?.dept || '') + (item.details?.deptCode || '')).toLowerCase();
    
    if (item.type === 'doctor') {
        if (t.includes('中医')) return '🌿';
        if (t.includes('牙') || t.includes('口腔')) return '🦷';
        if (t.includes('眼')) return '👁️';
        if (t.includes('骨') || t.includes('康复')) return '🦴';
        if (t.includes('心')) return '🫀';
        if (t.includes('儿')) return '👶';
        if (t.includes('妇') || t.includes('产')) return '👩‍⚕️';
        if (t.includes('心理') || t.includes('精神')) return '🧠';
        if (t.includes('药')) return '💊';
        if (t.includes('检')) return '📋';
        return '👨‍⚕️'; // Default Doctor
    } 
    
    if (item.type === 'drug') {
        if (t.includes('液') || t.includes('口服液') || t.includes('水')) return '🧪';
        if (t.includes('膏') || t.includes('乳')) return '🧴';
        if (t.includes('胶囊')) return '💊';
        if (t.includes('颗粒') || t.includes('冲剂')) return '🍵';
        if (t.includes('注射') || t.includes('针')) return '💉';
        return '💊'; // Default Drug
    }

    if (item.type === 'service') {
        if (t.includes('查') || t.includes('ct') || t.includes('核磁')) return '☢️';
        if (t.includes('超') || t.includes('b超')) return '🖥️';
        if (t.includes('血') || t.includes('尿') || t.includes('验')) return '🩸';
        if (t.includes('挂号') || t.includes('预约')) return '📅';
        if (t.includes('咨询') || t.includes('问诊')) return '💬';
        if (t.includes('护理') || t.includes('陪诊')) return '👩‍✈️';
        return '🏥'; // Default Service
    }

    return '🏥';
};

// Helper: Score items based on risk profile
const scoreItem = (item: ContentItem, risks: string[]) => {
    let score = 0;
    const text = (item.title + (item.tags?.join(' ') || '') + (item.description || '') + (item.details?.dept || '')).toLowerCase();
    
    // Mapping
    const map: Record<string, string[]> = {
        '高血压': ['心血管', '内科', '降压', '头晕'],
        '糖尿病': ['内分泌', '胰岛素', '血糖', '代谢'],
        '心脏': ['心血管', '胸痛', '心电图'],
        '骨折': ['骨科', '康复', '钙'],
        '胃': ['消化', '胃镜', '幽门'],
        '肺': ['呼吸', 'CT', '咳'],
        '肿瘤': ['肿瘤', '筛查', '标志物']
    };

    risks.forEach(r => {
        const key = Object.keys(map).find(k => r.includes(k));
        if (key) {
            map[key].forEach(word => { if (text.includes(word.toLowerCase())) score += 2; });
        }
        if (text.includes(r.replace('风险',''))) score += 1;
    });
    return score + Math.random();
};

export const UserMedicalServices: React.FC<Props> = ({ userId, userName, assessment }) => {
    const [allDoctors, setAllDoctors] = useState<ContentItem[]>([]);
    const [allDrugs, setAllDrugs] = useState<ContentItem[]>([]);
    const [allServices, setAllServices] = useState<ContentItem[]>([]);
    
    // Recommendations (Limited to 4)
    const [recommendedDoctors, setRecommendedDoctors] = useState<ContentItem[]>([]);
    const [recommendedDrugs, setRecommendedDrugs] = useState<ContentItem[]>([]);
    
    // Search & Filter State
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('全部');
    
    // UI State for Expansion (Only if searching or explicitly expanding)
    const [showAllDoctors, setShowAllDoctors] = useState(false);
    const [showAllDrugs, setShowAllDrugs] = useState(false);
    
    // Modal State
    const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

    useEffect(() => {
        const load = async () => {
            const docs = await fetchContent('doctor');
            const meds = await fetchContent('drug');
            const svcs = await fetchContent('service');
            setAllDoctors(docs);
            setAllDrugs(meds);
            setAllServices(svcs);
            
            refreshRecommendations('doctor', docs);
            refreshRecommendations('drug', meds);
        };
        load();
    }, [assessment]); // Re-run if assessment changes

    const refreshRecommendations = (type: 'doctor' | 'drug', sourceList?: ContentItem[]) => {
        const list = sourceList || (type === 'doctor' ? allDoctors : allDrugs);
        const risks = assessment ? [...assessment.risks.red, ...assessment.risks.yellow] : [];
        
        const sorted = [...list].sort((a, b) => scoreItem(b, risks) - scoreItem(a, risks));
        
        // Pick random 4 from top 10
        const topPool = sorted.slice(0, Math.min(sorted.length, 10));
        const shuffled = topPool.sort(() => 0.5 - Math.random()).slice(0, 4);
        
        if (type === 'doctor') setRecommendedDoctors(shuffled);
        else setRecommendedDrugs(shuffled);
    };

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
            setSelectedItem(null);
        }
    };

    // --- Filtering Logic ---
    
    // 1. Doctors & Drugs (Logic: if search, show all filtered; if no search, show recommendations)
    const visibleDoctors = search ? allDoctors.filter(d => d.title.includes(search) || d.tags.join('').includes(search)) : (showAllDoctors ? allDoctors : recommendedDoctors);
    const visibleDrugs = search ? allDrugs.filter(d => d.title.includes(search)) : (showAllDrugs ? allDrugs : recommendedDrugs);

    // 2. Services (Search + Category)
    const serviceCategories = ['全部', ...Array.from(new Set(allServices.map(s => s.details?.categoryL1 || '其他').filter(Boolean)))];
    
    const filteredServices = allServices.filter(s => {
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
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-bold text-slate-800 text-lg">名医推荐</h2>
                            {!search && !showAllDoctors && (
                                <button 
                                    onClick={() => refreshRecommendations('doctor')} 
                                    className="text-xs font-bold text-slate-500 flex items-center gap-1 active:scale-95 transition-transform"
                                >
                                    🔄 换一换
                                </button>
                            )}
                        </div>
                        {visibleDoctors.length > 0 ? (
                            <div className="space-y-4">
                                {visibleDoctors.map(doc => (
                                    <div 
                                        key={doc.id} 
                                        onClick={() => setSelectedItem(doc)}
                                        className="bg-white p-5 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-50 flex items-start gap-4 hover:shadow-md transition-shadow cursor-pointer active:scale-98"
                                    >
                                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-inner">
                                            {getMedicalIcon(doc)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-slate-800 text-base">{doc.title}</h3>
                                                    <p className="text-xs text-slate-500 font-medium mt-0.5">{doc.details?.dept} · {doc.details?.title}</p>
                                                </div>
                                                <button 
                                                    className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold"
                                                >
                                                    详情
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {doc.tags.map(t => <span key={t} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded-md">{t}</span>)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {!search && (
                                    <button 
                                        onClick={() => setShowAllDoctors(!showAllDoctors)}
                                        className="w-full text-xs text-slate-500 font-bold bg-slate-100 py-3 rounded-2xl hover:bg-slate-200 transition-colors"
                                    >
                                        {showAllDoctors ? '收起 ⬆️' : `查看更多医生 ⬇️`}
                                    </button>
                                )}
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
                                        onClick={() => setSelectedItem(s)}
                                        className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between h-full active:scale-95 transition-transform cursor-pointer group hover:border-blue-200"
                                    >
                                        <div className="flex flex-col items-center text-center gap-2 mb-2">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-1 group-hover:scale-110 transition-transform ${colorClass}`}>
                                                {getMedicalIcon(s)}
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
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-bold text-slate-800 text-lg">智慧药房</h2>
                            {!search && !showAllDrugs && (
                                <button 
                                    onClick={() => refreshRecommendations('drug')} 
                                    className="text-xs font-bold text-slate-500 flex items-center gap-1 active:scale-95 transition-transform"
                                >
                                    🔄 换一换
                                </button>
                            )}
                        </div>
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                            {visibleDrugs.length > 0 ? visibleDrugs.map(drug => (
                                <div 
                                    key={drug.id} 
                                    onClick={() => setSelectedItem(drug)}
                                    className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="text-2xl bg-slate-50 w-10 h-10 rounded-xl flex items-center justify-center">{getMedicalIcon(drug)}</div>
                                        <div>
                                            <div className="font-bold text-sm text-slate-700">{drug.title}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{drug.details?.spec}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] px-2 py-1 rounded-md font-bold ${drug.details?.stock === '充足' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                            {drug.details?.stock || '有货'}
                                        </span>
                                        <button className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold">
                                            +
                                        </button>
                                    </div>
                                </div>
                            )) : <div className="p-6 text-center text-xs text-slate-400">暂无相关药品</div>}
                            
                            {!search && (
                                <div className="p-3">
                                    <button 
                                        onClick={() => setShowAllDrugs(!showAllDrugs)}
                                        className="w-full text-xs text-slate-500 font-bold bg-slate-50 py-2 rounded-xl hover:bg-slate-100 transition-colors"
                                    >
                                        {showAllDrugs ? '收起 ⬆️' : `查看更多药品 ⬇️`}
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>

            {/* General Item Modal */}
            {selectedItem && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-end justify-center backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedItem(null)}>
                    <div className="bg-white w-full max-w-md rounded-t-3xl p-0 animate-slideUp overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        
                        {/* Modal Header */}
                        <div className="bg-slate-50 p-6 pb-8 text-center relative border-b border-slate-100">
                            <button 
                                onClick={() => setSelectedItem(null)}
                                className="absolute top-4 right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-400 font-bold shadow-sm z-10"
                            >
                                ×
                            </button>
                            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-5xl shadow-sm mx-auto mb-4">
                                {getMedicalIcon(selectedItem)}
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-1">{selectedItem.title}</h3>
                            <div className="flex items-center justify-center gap-2">
                                {selectedItem.type === 'doctor' && (
                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                                        {selectedItem.details?.dept} · {selectedItem.details?.title}
                                    </span>
                                )}
                                {selectedItem.type === 'drug' && (
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${selectedItem.details?.stock === '充足' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        库存: {selectedItem.details?.stock}
                                    </span>
                                )}
                                {selectedItem.type === 'service' && (
                                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">
                                        {selectedItem.details?.deptCode || '医疗服务'}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            
                            {/* Doctor Specific */}
                            {selectedItem.type === 'doctor' && (
                                <>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm mb-2">医生简介</h4>
                                        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl">
                                            {selectedItem.description || '暂无简介'}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="bg-blue-50 p-3 rounded-xl">
                                            <div className="text-xs text-blue-400 mb-1">出诊时间</div>
                                            <div className="font-bold text-blue-900">{selectedItem.details?.schedule || '详询导诊台'}</div>
                                        </div>
                                        <div className="bg-blue-50 p-3 rounded-xl">
                                            <div className="text-xs text-blue-400 mb-1">挂号费</div>
                                            <div className="font-bold text-blue-900">¥{selectedItem.details?.fee || '0'}</div>
                                        </div>
                                    </div>
                                    {selectedItem.details?.resume && (
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm mb-2">详细履历</h4>
                                            <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-line">
                                                {selectedItem.details.resume}
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Drug Specific */}
                            {selectedItem.type === 'drug' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-3 rounded-xl">
                                            <div className="text-xs text-slate-400 mb-1">参考价格</div>
                                            <div className="font-bold text-slate-800">¥{selectedItem.details?.price || '-'}</div>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl">
                                            <div className="text-xs text-slate-400 mb-1">医保类型</div>
                                            <div className="font-bold text-slate-800">{selectedItem.details?.insuranceType || '自费'}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm mb-2">主要功效</h4>
                                        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl">
                                            {selectedItem.description || '暂无说明'}
                                        </p>
                                    </div>
                                    {selectedItem.details?.usage && (
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm mb-2">用法用量</h4>
                                            <p className="text-sm text-slate-600">{selectedItem.details.usage}</p>
                                        </div>
                                    )}
                                    {selectedItem.details?.contraindications && (
                                        <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                                            <h4 className="font-bold text-red-800 text-xs mb-1">⚠️ 禁忌/注意事项</h4>
                                            <p className="text-xs text-red-700">{selectedItem.details.contraindications}</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Service Specific */}
                            {selectedItem.type === 'service' && (
                                <>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm mb-2">项目简介</h4>
                                        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl">
                                            {selectedItem.description || '暂无简介'}
                                        </p>
                                    </div>
                                    {selectedItem.details?.workflow && (
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm mb-2">服务流程</h4>
                                            <p className="text-xs text-slate-500 whitespace-pre-line border-l-2 border-slate-200 pl-3">
                                                {selectedItem.details.workflow}
                                            </p>
                                        </div>
                                    )}
                                    {selectedItem.details?.location && (
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <span>📍 就诊地点:</span>
                                            <span className="font-bold">{selectedItem.details.location}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer Action */}
                        <div className="p-4 border-t border-slate-100 bg-white">
                            {selectedItem.type === 'doctor' && (
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => handleInteract('booking', selectedItem)}
                                        className="flex-1 bg-white border border-blue-200 text-blue-600 py-3.5 rounded-xl font-bold text-sm shadow-sm hover:bg-blue-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span>📅</span> 预约挂号
                                    </button>
                                    <button 
                                        onClick={() => handleInteract('signing', selectedItem)}
                                        className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span>✍️</span> 签约家庭医生
                                    </button>
                                </div>
                            )}
                            {selectedItem.type === 'drug' && (
                                <button 
                                    onClick={() => handleInteract('drug_order', selectedItem)}
                                    className="w-full bg-orange-500 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-orange-200 hover:bg-orange-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <span>💊</span> 预约购药
                                </button>
                            )}
                            {selectedItem.type === 'service' && (
                                <button 
                                    onClick={() => handleInteract('booking', selectedItem)}
                                    className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-purple-200 hover:bg-purple-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <span>📅</span> 立即预约
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
