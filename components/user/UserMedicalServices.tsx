
import React, { useState, useEffect } from 'react';
import { fetchContent, ContentItem, saveInteraction, InteractionItem, fetchInteractions } from '../../services/contentService';
import { ResourceCover } from './ResourceCover';
import { HealthAssessment } from '../../types';
import { SLOT_MAP, getNextMonthSlotsForDoctor } from '../../services/doctorScheduleUtils';

interface Props {
    userId: string;
    userName: string;
    assessment?: HealthAssessment; 
}

const getMedicalIcon = (item: ContentItem): string => {
    const t = (item.title + (item.details?.dept || '') + (item.details?.deptCode || '')).toLowerCase();
    if (item.type === 'doctor') {
        if (t.includes('中医')) return '🌿';
        if (t.includes('牙') || t.includes('口腔')) return '🦷';
        if (t.includes('骨') || t.includes('康复')) return '🦴';
        if (t.includes('心')) return '🫀';
        return '👨‍⚕️';
    } 
    if (item.type === 'drug') return '💊';
    return '🏥';
};

const scoreItem = (item: ContentItem, risks: string[]) => {
    let score = 0;
    const text = (item.title + (item.tags?.join(' ') || '') + (item.description || '') + (item.details?.dept || '')).toLowerCase();
    risks.forEach(r => {
        if (text.includes(r.replace('风险',''))) score += 2;
    });
    return score + Math.random();
};

export const UserMedicalServices: React.FC<Props> = ({ userId, userName, assessment }) => {
    const [allDoctors, setAllDoctors] = useState<ContentItem[]>([]);
    const [allDrugs, setAllDrugs] = useState<ContentItem[]>([]);
    const [allServices, setAllServices] = useState<ContentItem[]>([]);
    const [allInteractions, setAllInteractions] = useState<InteractionItem[]>([]);
    
    const [recommendedDoctors, setRecommendedDoctors] = useState<ContentItem[]>([]);
    const [recommendedDrugs, setRecommendedDrugs] = useState<ContentItem[]>([]);
    
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('全部');
    const [showAllDoctors, setShowAllDoctors] = useState(false);
    const [showAllDrugs, setShowAllDrugs] = useState(false);
    
    const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

    // Appointment Time Modal State
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [bookingDoctor, setBookingDoctor] = useState<ContentItem | null>(null);

    useEffect(() => {
        const load = async () => {
            const [docs, meds, svcs, inters] = await Promise.all([
                fetchContent('doctor', 'active'),
                fetchContent('drug', 'active'),
                fetchContent('service', 'active'),
                fetchInteractions()
            ]);
            setAllDoctors(docs);
            setAllDrugs(meds);
            setAllServices(svcs);
            setAllInteractions(inters);
            refreshRecommendations('doctor', docs);
            refreshRecommendations('drug', meds);
        };
        load();
    }, [assessment]);

    const refreshRecommendations = (type: 'doctor' | 'drug', sourceList?: ContentItem[]) => {
        const list = sourceList || (type === 'doctor' ? allDoctors : allDrugs);
        const risks = assessment ? [...assessment.risks.red, ...assessment.risks.yellow] : [];
        const sorted = [...list].sort((a, b) => scoreItem(b, risks) - scoreItem(a, risks));
        const shuffled = sorted.slice(0, 10).sort(() => 0.5 - Math.random()).slice(0, 4);
        if (type === 'doctor') setRecommendedDoctors(shuffled);
        else setRecommendedDrugs(shuffled);
    };

    const handleInteract = async (type: string, target: ContentItem, timeSlot?: string) => {
        if (!userId) return alert("用户信息缺失，请重新登录后再试");
        
        let interactionType: InteractionItem['type'] = 'doctor_booking'; 
        let confirmMsg = '';
        let details = '';

        if (type === 'signing') {
            interactionType = 'doctor_signing';
            confirmMsg = `确定申请签约【${target.title}】为家庭医生吗？`;
            details = '申请家庭医生签约';
        } else if (type === 'booking' && target.type === 'doctor') {
            interactionType = 'doctor_booking';
            if (!timeSlot) {
                setBookingDoctor(target);
                setShowBookingModal(true);
                setSelectedItem(null);
                return;
            }
            confirmMsg = `确定预约【${target.title}】在【${timeSlot}】的门诊吗？`;
            details = `预约挂号：${timeSlot}，费用: ${target.details?.fee || 0}元`;
        } else if (type === 'drug_order') {
            interactionType = 'drug_order';
            confirmMsg = `确定申请预约药品【${target.title}】吗？`;
            details = `预约药品，规格: ${target.details?.spec}`;
        } else if (type === 'booking' && target.type === 'service') {
            interactionType = 'service_booking';
            confirmMsg = `确定预约服务【${target.title}】吗？`;
            details = `服务预约，价格: ${target.details?.price || 0}`;
        }

        if(confirm(confirmMsg)) {
            await saveInteraction({
                id: `${interactionType}_${Date.now()}`,
                type: interactionType,
                userId: userId,
                userName: userName?.trim() || '用户',
                targetId: target.id,
                targetName: target.title,
                status: 'pending',
                date: new Date().toISOString().split('T')[0],
                details: details
            });
            alert("申请已提交，请等待审核。");
            setSelectedItem(null);
            setShowBookingModal(false);
            setBookingDoctor(null);
            // Refresh interactions to update quotas
            fetchInteractions().then(setAllInteractions);
        }
    };

    const getSlotUsage = (docId: string, slot: { displayDate: string; dayKey: string; slotId: string }) => {
        const fragment = `${slot.displayDate}${SLOT_MAP[slot.slotId]}`;
        const count = allInteractions.filter(i => 
            i.type === 'doctor_booking' && 
            i.targetId === docId && 
            i.status !== 'cancelled' && 
            i.details?.includes(fragment)
        ).length;
        
        const quota = bookingDoctor?.details?.slotQuotas?.[slot.dayKey]?.[slot.slotId] || 10;
        return { count, quota, full: count >= quota };
    };

    const visibleDoctors = search ? allDoctors.filter(d => d.title.includes(search) || d.tags.join('').includes(search)) : (showAllDoctors ? allDoctors : recommendedDoctors);
    const visibleDrugs = search ? allDrugs.filter(d => d.title.includes(search)) : (showAllDrugs ? allDrugs : recommendedDrugs);
    const serviceCategories = ['全部', ...Array.from(new Set(allServices.map(s => s.details?.categoryL1 || '其他').filter(Boolean)))];
    const filteredServices = allServices.filter(s => {
        const matchesSearch = s.title.includes(search) || (s.description || '').includes(search);
        const matchesCategory = activeCategory === '全部' || (s.details?.categoryL1 || '其他') === activeCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="bg-[#F8FAFC] min-h-full pb-20">
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md px-6 py-4 border-b border-slate-100">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-4">寻医问药</h1>
                <div className="relative">
                    <input className="w-full bg-slate-100/50 border-none rounded-2xl py-3 pl-11 pr-4 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" placeholder="搜索医生、项目或药品..." value={search} onChange={e => setSearch(e.target.value)} />
                    <span className="absolute left-4 top-3.5 text-slate-400 text-lg">🔍</span>
                </div>
            </div>

            <div className="p-6 space-y-8">
                {/* Sections: Recommended Doctors, Services, etc. */}
                <section>
                    <div className="flex justify-between items-center mb-4"><h2 className="font-bold text-slate-800 text-lg">名医推荐</h2></div>
                    <div className="space-y-4">
                        {visibleDoctors.map(doc => (
                            <div key={doc.id} onClick={() => setSelectedItem(doc)} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50 flex items-start gap-4 hover:shadow-md transition-shadow cursor-pointer active:scale-98">
                                <ResourceCover
                                    item={doc}
                                    fallback={<span className="text-3xl">{getMedicalIcon(doc)}</span>}
                                    className="h-16 w-16 shrink-0 rounded-2xl border border-slate-200 bg-blue-50 text-3xl"
                                    imgClassName="h-full w-full rounded-2xl object-cover"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-base">{doc.title}</h3>
                                            <p className="text-xs text-slate-500 font-medium mt-0.5">{doc.details?.dept} · {doc.details?.title}</p>
                                        </div>
                                        <button className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold">详情</button>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-2">{doc.tags.map(t => <span key={t} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded-md">{t}</span>)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                {/* (Keep other sections like services unchanged) */}
                <section>
                    <div className="flex justify-between items-center mb-4"><h2 className="font-bold text-slate-800 text-lg">便民服务</h2></div>
                    <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
                        {serviceCategories.map(cat => (
                            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white text-slate-500 border border-slate-200'}`}>{cat}</button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {filteredServices.map((s, i) => (
                            <div key={s.id} onClick={() => setSelectedItem(s)} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between h-full active:scale-95 transition-transform cursor-pointer group hover:border-blue-200">
                                <div className="flex flex-col items-center text-center gap-2 mb-2">
                                    <ResourceCover
                                        item={s}
                                        fallback={<span className="text-2xl">{getMedicalIcon(s)}</span>}
                                        className="mb-1 h-12 w-12 rounded-2xl bg-blue-50 text-2xl text-blue-600"
                                        imgClassName="h-full w-full rounded-2xl object-cover"
                                    />
                                    <div className="font-bold text-sm text-slate-800 line-clamp-1">{s.title}</div>
                                </div>
                                <div className="flex justify-center"><span className="text-[10px] bg-slate-50 text-slate-500 px-2 py-1 rounded-full">{s.details?.price ? `¥${s.details.price}` : '免费'}</span></div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* Doctor Info Modal */}
            {selectedItem && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-end justify-center backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedItem(null)}>
                    <div className="bg-white w-full max-w-md rounded-t-3xl p-0 animate-slideUp overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-50 p-6 pb-8 text-center relative border-b border-slate-100">
                            <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-400 font-bold shadow-sm z-10">×</button>
                            <div className="mx-auto mb-4 h-20 w-20">
                                <ResourceCover
                                    item={selectedItem}
                                    fallback={<span className="text-5xl">{getMedicalIcon(selectedItem)}</span>}
                                    className="h-full w-full rounded-2xl border border-slate-200 bg-white text-5xl shadow-sm"
                                    imgClassName="h-full w-full rounded-2xl object-cover shadow-sm"
                                />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-1">{selectedItem.title}</h3>
                            <div className="flex items-center justify-center gap-2">
                                {selectedItem.type === 'doctor' && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">{selectedItem.details?.dept} · {selectedItem.details?.title}</span>}
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
                            <div>
                                <h4 className="font-bold text-slate-800 mb-2">专家简介</h4>
                                <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl">{selectedItem.description || '暂无简介'}</p>
                            </div>
                            {selectedItem.type === 'doctor' && (
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="bg-blue-50 p-3 rounded-xl">
                                        <div className="text-xs text-blue-400 mb-1">挂号费</div>
                                        <div className="font-bold text-blue-900">¥{selectedItem.details?.fee || '0'}</div>
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded-xl">
                                        <div className="text-xs text-blue-400 mb-1">科室</div>
                                        <div className="font-bold text-blue-900">{selectedItem.details?.dept || '全科'}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-white">
                            {selectedItem.type === 'doctor' && (
                                <div className="flex gap-3">
                                    <button onClick={() => handleInteract('booking', selectedItem)} className="flex-1 bg-white border border-blue-200 text-blue-600 py-3.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-2"><span>📅</span> 预约挂号</button>
                                    <button onClick={() => handleInteract('signing', selectedItem)} className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"><span>✍️</span> 签约家庭医生</button>
                                </div>
                            )}
                            {selectedItem.type === 'drug' && <button onClick={() => handleInteract('drug_order', selectedItem)} className="w-full bg-orange-500 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2"><span>💊</span> 预约购药</button>}
                            {selectedItem.type === 'service' && <button onClick={() => handleInteract('booking', selectedItem)} className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2"><span>📅</span> 立即预约</button>}
                        </div>
                    </div>
                </div>
            )}

            {/* Time Selection Modal with Quota Logic */}
            {showBookingModal && bookingDoctor && (
                <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-end justify-center backdrop-blur-sm animate-fadeIn" onClick={() => setShowBookingModal(false)}>
                    <div className="bg-white w-full max-w-md rounded-t-[2.5rem] p-6 animate-slideUp max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
                        <h3 className="text-xl font-black text-slate-800 text-center mb-1">选择就诊时间</h3>
                        <p className="text-xs text-slate-400 text-center mb-6">预约专家：{bookingDoctor.title}</p>
                        
                        <div className="flex-1 overflow-y-auto space-y-3 pb-6">
                            {(() => {
                                const monthSlots = getNextMonthSlotsForDoctor(bookingDoctor);
                                if (!monthSlots.length) {
                                    return (
                                        <div className="text-center py-10">
                                            <div className="text-4xl mb-3 opacity-20">📅</div>
                                            <p className="text-sm text-slate-400">未来30天暂无可预约号源<br/>请通过电话或现场咨询</p>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="grid grid-cols-1 gap-2">
                                        {monthSlots.map((slot) => {
                                            const { count, quota, full } = getSlotUsage(bookingDoctor.id, slot);
                                            return (
                                                <button
                                                    key={`${slot.dateKey}-${slot.slotId}`}
                                                    disabled={full}
                                                    onClick={() =>
                                                        handleInteract(
                                                            'booking',
                                                            bookingDoctor,
                                                            `${slot.displayDate}${SLOT_MAP[slot.slotId]}`
                                                        )
                                                    }
                                                    className={`border p-4 rounded-2xl flex items-center justify-between transition-all text-left ${
                                                        full
                                                            ? 'opacity-50 cursor-not-allowed border-slate-100 bg-slate-50 grayscale'
                                                            : 'border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-200'
                                                    }`}
                                                >
                                                    <span className="font-bold text-slate-700">
                                                        {slot.displayDate} · {SLOT_MAP[slot.slotId]}
                                                    </span>
                                                    <span className={`text-xs font-bold ${full ? 'text-red-500' : 'text-slate-400'}`}>
                                                        {full ? '约满' : `余 ${quota - count} 位`}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                        
                        <button onClick={() => setShowBookingModal(false)} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold text-sm active:scale-95 transition-transform">取消</button>
                    </div>
                </div>
            )}
        </div>
    );
};
