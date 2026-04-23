
import React, { useState, useEffect } from 'react';
import { fetchContent, ContentItem, saveInteraction, InteractionItem, fetchInteractions } from '../../services/contentService';
import { ResourceCover } from './ResourceCover';
import { HealthAssessment } from '../../types';
import { getNextMonthSlotsForDoctor } from '../../services/doctorScheduleUtils';

interface Props {
    userId: string;
    userName: string;
    assessment?: HealthAssessment; 
}

const getMedicalIcon = (item: ContentItem): string => {
    const t = (item.title + (item.details?.dept || '') + (item.details?.deptCode || '')).toLowerCase();
    if (item.type === 'doctor') {
        if (t.includes('涓尰')) return '馃尶';
        if (t.includes('鐗?) || t.includes('鍙ｈ厰')) return '馃Ψ';
        if (t.includes('楠?) || t.includes('搴峰')) return '馃Υ';
        if (t.includes('蹇?)) return '馃珋';
        return '馃懆鈥嶁殨锔?;
    } 
    if (item.type === 'drug') return '馃拪';
    return '馃彞';
};

const scoreItem = (item: ContentItem, risks: string[]) => {
    let score = 0;
    const text = (item.title + (item.tags?.join(' ') || '') + (item.description || '') + (item.details?.dept || '')).toLowerCase();
    risks.forEach(r => {
        if (text.includes(r.replace('椋庨櫓',''))) score += 2;
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
    const [activeCategory, setActiveCategory] = useState('鍏ㄩ儴');
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
        if (!userId) return alert("鐢ㄦ埛淇℃伅缂哄け锛岃閲嶆柊鐧诲綍鍚庡啀璇?);
        
        let interactionType: InteractionItem['type'] = 'doctor_booking'; 
        let confirmMsg = '';
        let details = '';

        if (type === 'signing') {
            interactionType = 'doctor_signing';
            confirmMsg = `纭畾鐢宠绛剧害銆?{target.title}銆戜负瀹跺涵鍖荤敓鍚楋紵`;
            details = '鐢宠瀹跺涵鍖荤敓绛剧害';
        } else if (type === 'booking' && target.type === 'doctor') {
            interactionType = 'doctor_booking';
            if (!timeSlot) {
                setBookingDoctor(target);
                setShowBookingModal(true);
                setSelectedItem(null);
                return;
            }
            confirmMsg = `纭畾棰勭害銆?{target.title}銆戝湪銆?{timeSlot}銆戠殑闂ㄨ瘖鍚楋紵`;
            details = `棰勭害鎸傚彿锛?{timeSlot}锛岃垂鐢? ${target.details?.fee || 0}鍏僠;
        } else if (type === 'drug_order') {
            interactionType = 'drug_order';
            confirmMsg = `纭畾鐢宠棰勭害鑽搧銆?{target.title}銆戝悧锛焋;
            details = `棰勭害鑽搧锛岃鏍? ${target.details?.spec}`;
        } else if (type === 'booking' && target.type === 'service') {
            interactionType = 'service_booking';
            confirmMsg = `纭畾棰勭害鏈嶅姟銆?{target.title}銆戝悧锛焋;
            details = `鏈嶅姟棰勭害锛屼环鏍? ${target.details?.price || 0}`;
        }

        if(confirm(confirmMsg)) {
            await saveInteraction({
                id: `${interactionType}_${Date.now()}`,
                type: interactionType,
                userId: userId,
                userName: userName?.trim() || '鐢ㄦ埛',
                targetId: target.id,
                targetName: target.title,
                status: 'pending',
                date: new Date().toISOString().split('T')[0],
                details: details
            });
            alert("鐢宠宸叉彁浜わ紝璇风瓑寰呭鏍搞€?);
            setSelectedItem(null);
            setShowBookingModal(false);
            setBookingDoctor(null);
            // Refresh interactions to update quotas
            fetchInteractions().then(setAllInteractions);
        }
    };

    const getSlotUsage = (docId: string, slot: { displayDate: string; dayKey: string; slotId: string }) => {
        const fragment = `${slot.displayDate}${slot.slotLabel}`;
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
    const serviceCategories = ['鍏ㄩ儴', ...Array.from(new Set(allServices.map(s => s.details?.categoryL1 || '鍏朵粬').filter(Boolean)))];
    const filteredServices = allServices.filter(s => {
        const matchesSearch = s.title.includes(search) || (s.description || '').includes(search);
        const matchesCategory = activeCategory === '鍏ㄩ儴' || (s.details?.categoryL1 || '鍏朵粬') === activeCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="bg-[#F8FAFC] min-h-full pb-20">
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md px-6 py-4 border-b border-slate-100">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-4">瀵诲尰闂嵂</h1>
                <div className="relative">
                    <input className="w-full bg-slate-100/50 border-none rounded-2xl py-3 pl-11 pr-4 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" placeholder="鎼滅储鍖荤敓銆侀」鐩垨鑽搧..." value={search} onChange={e => setSearch(e.target.value)} />
                    <span className="absolute left-4 top-3.5 text-slate-400 text-lg">馃攳</span>
                </div>
            </div>

            <div className="p-6 space-y-8">
                {/* Sections: Recommended Doctors, Services, etc. */}
                <section>
                    <div className="flex justify-between items-center mb-4"><h2 className="font-bold text-slate-800 text-lg">鍚嶅尰鎺ㄨ崘</h2></div>
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
                                            <p className="text-xs text-slate-500 font-medium mt-0.5">{doc.details?.dept} 路 {doc.details?.title}</p>
                                        </div>
                                        <button className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold">璇︽儏</button>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-2">{doc.tags.map(t => <span key={t} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded-md">{t}</span>)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                {/* (Keep other sections like services unchanged) */}
                <section>
                    <div className="flex justify-between items-center mb-4"><h2 className="font-bold text-slate-800 text-lg">渚挎皯鏈嶅姟</h2></div>
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
                                <div className="flex justify-center"><span className="text-[10px] bg-slate-50 text-slate-500 px-2 py-1 rounded-full">{s.details?.price ? `楼${s.details.price}` : '鍏嶈垂'}</span></div>
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
                            <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-400 font-bold shadow-sm z-10">脳</button>
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
                                {selectedItem.type === 'doctor' && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">{selectedItem.details?.dept} 路 {selectedItem.details?.title}</span>}
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
                            <div>
                                <h4 className="font-bold text-slate-800 mb-2">涓撳绠€浠?/h4>
                                <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl">{selectedItem.description || '鏆傛棤绠€浠?}</p>
                            </div>
                            {selectedItem.type === 'doctor' && (
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="bg-blue-50 p-3 rounded-xl">
                                        <div className="text-xs text-blue-400 mb-1">鎸傚彿璐?/div>
                                        <div className="font-bold text-blue-900">楼{selectedItem.details?.fee || '0'}</div>
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded-xl">
                                        <div className="text-xs text-blue-400 mb-1">绉戝</div>
                                        <div className="font-bold text-blue-900">{selectedItem.details?.dept || '鍏ㄧ'}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-white">
                            {selectedItem.type === 'doctor' && (
                                <div className="flex gap-3">
                                    <button onClick={() => handleInteract('booking', selectedItem)} className="flex-1 bg-white border border-blue-200 text-blue-600 py-3.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-2"><span>馃搮</span> 棰勭害鎸傚彿</button>
                                    <button onClick={() => handleInteract('signing', selectedItem)} className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"><span>鉁嶏笍</span> 绛剧害瀹跺涵鍖荤敓</button>
                                </div>
                            )}
                            {selectedItem.type === 'drug' && <button onClick={() => handleInteract('drug_order', selectedItem)} className="w-full bg-orange-500 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2"><span>馃拪</span> 棰勭害璐嵂</button>}
                            {selectedItem.type === 'service' && <button onClick={() => handleInteract('booking', selectedItem)} className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2"><span>馃搮</span> 绔嬪嵆棰勭害</button>}
                        </div>
                    </div>
                </div>
            )}

            {/* Time Selection Modal with Quota Logic */}
            {showBookingModal && bookingDoctor && (
                <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-end justify-center backdrop-blur-sm animate-fadeIn" onClick={() => setShowBookingModal(false)}>
                    <div className="bg-white w-full max-w-md rounded-t-[2.5rem] p-6 animate-slideUp max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
                        <h3 className="text-xl font-black text-slate-800 text-center mb-1">閫夋嫨灏辫瘖鏃堕棿</h3>
                        <p className="text-xs text-slate-400 text-center mb-6">棰勭害涓撳锛歿bookingDoctor.title}</p>
                        
                        <div className="flex-1 overflow-y-auto space-y-3 pb-6">
                            {(() => {
                                const monthSlots = getNextMonthSlotsForDoctor(bookingDoctor);
                                if (!monthSlots.length) {
                                    return (
                                        <div className="text-center py-10">
                                            <div className="text-4xl mb-3 opacity-20">馃搮</div>
                                            <p className="text-sm text-slate-400">鏈潵30澶╂殏鏃犲彲棰勭害鍙锋簮<br/>璇烽€氳繃鐢佃瘽鎴栫幇鍦哄挩璇?/p>
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
                                                            `${slot.displayDate}${slot.slotLabel}`
                                                        )
                                                    }
                                                    className={`border p-4 rounded-2xl flex items-center justify-between transition-all text-left ${
                                                        full
                                                            ? 'opacity-50 cursor-not-allowed border-slate-100 bg-slate-50 grayscale'
                                                            : 'border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-200'
                                                    }`}
                                                >
                                                    <span className="font-bold text-slate-700">
                                                        {slot.displayDate} 路 {slot.slotLabel}
                                                    </span>
                                                    <span className={`text-xs font-bold ${full ? 'text-red-500' : 'text-slate-400'}`}>
                                                        {full ? '绾︽弧' : `浣?${quota - count} 浣峘}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                        
                        <button onClick={() => setShowBookingModal(false)} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold text-sm active:scale-95 transition-transform">鍙栨秷</button>
                    </div>
                </div>
            )}
        </div>
    );
};

