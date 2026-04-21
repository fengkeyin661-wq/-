
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { fetchContent, ContentItem, fetchInteractions, InteractionItem, ChatMessage, fetchMessages, sendMessage, markAsRead, getUnreadCount, saveInteraction } from '../../services/contentService';
import { HealthArchive } from '../../services/dataService';
import { HealthAssessment } from '../../types';
import { DAY_MAP, SLOT_MAP, getNextMonthSlotsForDoctor } from '../../services/doctorScheduleUtils';

interface Props {
    userId?: string;
    userName?: string;
    archive?: HealthArchive;
    assessment?: HealthAssessment;
    onMessageRead?: () => void;
    onOpenDoctors?: () => void;
}

interface DoctorWithUnread {
    interaction: InteractionItem;
    unread: number;
}

type ViewMode = 'doctors' | 'chat_list' | 'chat';

const getMedicalIcon = (item: ContentItem): string => {
    const t = (item.title + (item.details?.dept || '')).toLowerCase();
    if (t.includes('中医')) return '🌿';
    if (t.includes('牙') || t.includes('口腔')) return '🦷';
    if (t.includes('骨') || t.includes('康复')) return '🦴';
    if (t.includes('心')) return '🫀';
    if (t.includes('妇') || t.includes('产')) return '👩‍⚕️';
    if (t.includes('儿') || t.includes('小儿')) return '👶';
    return '👨‍⚕️';
};

const isImageLike = (value?: string) => !!value && (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:image'));
const withImageVersion = (item: ContentItem): string => {
    const src = item.image || '';
    if (!src || src.startsWith('data:image')) return src;
    const ver = encodeURIComponent(item.updatedAt || '');
    if (!ver) return src;
    return src.includes('?') ? `${src}&v=${ver}` : `${src}?v=${ver}`;
};

const DoctorAvatar: React.FC<{ doctor: ContentItem; className?: string; fallbackClassName?: string }> = ({
    doctor,
    className = 'w-14 h-14',
    fallbackClassName = 'bg-blue-50 rounded-xl flex items-center justify-center text-3xl'
}) => {
    if (isImageLike(doctor.image)) {
        return <img src={withImageVersion(doctor)} alt={doctor.title} className={`${className} rounded-xl object-cover border border-slate-200 shrink-0`} />;
    }
    return <div className={`${className} ${fallbackClassName} shrink-0`}>{getMedicalIcon(doctor)}</div>;
};

const scoreDoctor = (doc: ContentItem, risks: string[]) => {
    let score = 0;
    const text = (doc.title + (doc.tags?.join(' ') || '') + (doc.description || '') + (doc.details?.dept || '')).toLowerCase();
    risks.forEach(r => {
        if (text.includes(r.replace('风险',''))) score += 2;
    });
    return score + Math.random();
};

export const UserInteraction: React.FC<Props> = ({ userId, userName, archive, assessment, onMessageRead, onOpenDoctors }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('chat_list');
    
    // Doctor List State
    const [allDoctors, setAllDoctors] = useState<ContentItem[]>([]);
    const [allInteractions, setAllInteractions] = useState<InteractionItem[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState<ContentItem | null>(null);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [bookingDoctor, setBookingDoctor] = useState<ContentItem | null>(null);
    
    // Signed Doctors (for Chat)
    const [doctorList, setDoctorList] = useState<DoctorWithUnread[]>([]);
    const [activeDoctor, setActiveDoctor] = useState<InteractionItem | null>(null);
    
    // Chat State
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);
    
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAllData();
    }, [userId]);

    useEffect(() => {
        if (!userId) return;
        let interval: ReturnType<typeof setInterval>;
        const poll = () => {
            if (activeDoctor) {
                loadMessages();
                markAsRead(userId, activeDoctor.targetId).then(() => {
                    if (onMessageRead) onMessageRead();
                });
            } else {
                loadSignedDoctors();
            }
        };
        poll();
        interval = setInterval(poll, 3000);
        return () => clearInterval(interval);
    }, [activeDoctor, userId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [docs, inters] = await Promise.all([
                fetchContent('doctor', 'active'),
                fetchInteractions()
            ]);
            setAllDoctors(docs);
            setAllInteractions(inters);

            if (!userId) {
                setDoctorList([]);
            } else {
                const signings = inters.filter(
                    (i) => i.type === 'doctor_signing' && i.userId === userId && i.status === 'confirmed'
                );
                const listWithCount: DoctorWithUnread[] = [];
                for (const sign of signings) {
                    const count = await getUnreadCount(userId, sign.targetId);
                    listWithCount.push({ interaction: sign, unread: count });
                }
                setDoctorList(listWithCount);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadSignedDoctors = async () => {
        if (!userId) {
            setDoctorList([]);
            return;
        }
        const inters = await fetchInteractions();
        setAllInteractions(inters);
        const signings = inters.filter((i) => i.type === 'doctor_signing' && i.userId === userId && i.status === 'confirmed');
        const listWithCount: DoctorWithUnread[] = [];
        for (const sign of signings) {
            const count = await getUnreadCount(userId, sign.targetId);
            listWithCount.push({ interaction: sign, unread: count });
        }
        setDoctorList(listWithCount);
    };

    const loadMessages = async () => {
        if (!activeDoctor || !userId) return;
        const msgs = await fetchMessages(userId, activeDoctor.targetId);
        setChatMessages(msgs);
    };

    const handleSendMsg = async () => {
        if (!userId) {
            alert('请先在底部「我的」登录后再发送消息');
            return;
        }
        if (!activeDoctor || !chatInput.trim()) return;
        await sendMessage({
            senderId: userId,
            senderRole: 'user',
            receiverId: activeDoctor.targetId,
            content: chatInput
        });
        setChatInput('');
        loadMessages();
    };

    const handleInteract = async (type: string, target: ContentItem, timeSlot?: string) => {
        if (!userId) return alert('请先在底部「我的」登录后再签约或挂号');
        
        let interactionType: InteractionItem['type'] = 'doctor_booking';
        let confirmMsg = '';
        let details = '';

        if (type === 'signing') {
            interactionType = 'doctor_signing';
            confirmMsg = `确定申请签约【${target.title}】为家庭医生吗？`;
            details = '申请家庭医生签约';
        } else if (type === 'booking') {
            interactionType = 'doctor_booking';
            if (!timeSlot) {
                setBookingDoctor(target);
                setShowBookingModal(true);
                setSelectedDoctor(null);
                return;
            }
            confirmMsg = `确定预约【${target.title}】在【${timeSlot}】的门诊吗？`;
            details = `预约挂号：${timeSlot}，费用: ${target.details?.fee || 0}元`;
        }

        if (confirm(confirmMsg)) {
            await saveInteraction({
                id: `${interactionType}_${Date.now()}`,
                type: interactionType,
                userId,
                userName: userName?.trim() || archive?.name?.trim() || '用户',
                targetId: target.id,
                targetName: target.title,
                status: 'pending',
                date: new Date().toISOString().split('T')[0],
                details
            });
            alert("申请已提交！");
            setSelectedDoctor(null);
            setShowBookingModal(false);
            setBookingDoctor(null);
            loadAllData();
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

    // AI 排序医生
    const risks = assessment ? [...assessment.risks.red, ...assessment.risks.yellow] : [];
    const sortedDoctors = useMemo(() => {
        return [...allDoctors].sort((a, b) => scoreDoctor(b, risks) - scoreDoctor(a, risks)).slice(0, 20);
    }, [allDoctors, risks]);

    const totalUnread = doctorList.reduce((sum, d) => sum + d.unread, 0);

    // ======== RENDER: CHAT VIEW ========
    if (viewMode === 'chat' && activeDoctor) {
        return (
            <div className="relative flex h-full flex-col bg-[#F0F2F5]">
                <div className="z-10 flex items-center gap-3 border-b border-slate-100 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md">
                    <button onClick={() => { setViewMode('chat_list'); setActiveDoctor(null); }} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">←</button>
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg shadow-inner">👨‍⚕️</div>
                    <div>
                        <h1 className="text-base font-bold text-slate-800">{activeDoctor.targetName} 医生</h1>
                        <p className="text-xs font-medium text-green-600">在线</p>
                    </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-28">
                    <div className="mx-auto my-4 w-fit rounded-full bg-slate-200/50 px-3 py-1 text-center text-xs text-slate-500">
                        仅提供健康咨询，急诊请及时就医
                    </div>
                    
                    {chatMessages.length === 0 ? (
                        <div className="text-center text-slate-400 text-xs mt-10">暂无消息，打个招呼吧 👋</div>
                    ) : (
                        chatMessages.map(msg => {
                            const isMe = msg.senderRole === 'user';
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[75%] px-4 py-3 text-sm shadow-sm ${
                                        isMe ? 'bg-teal-600 text-white rounded-2xl rounded-tr-sm' : 'bg-white text-slate-800 rounded-2xl rounded-tl-sm border border-slate-100'
                                    }`}>
                                        <p className="leading-relaxed">{msg.content}</p>
                                        <div className={`mt-1 text-right text-xs ${isMe ? 'text-teal-200' : 'text-slate-400'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div className="absolute bottom-0 left-0 w-full px-4 pb-[calc(env(safe-area-inset-bottom)+10px)]">
                    <div className="bg-white p-2 rounded-full shadow-lg border border-slate-100 flex gap-2 items-center">
                        <input 
                            className="flex-1 bg-transparent px-4 py-2 text-sm focus:outline-none"
                            placeholder="输入消息..."
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSendMsg()}
                        />
                        <button onClick={handleSendMsg} disabled={!chatInput.trim()} className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700 disabled:bg-slate-300 disabled:opacity-50 active:scale-90">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ======== RENDER: MAIN VIEW (Doctors + Chat List Tabs) ========
    return (
        <div className="min-h-full bg-slate-50 pb-28">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">消息中心</h1>
                <p className="mt-1 text-sm text-slate-500">医生资源 · 在线咨询</p>
            </div>

            {/* Header actions */}
            <div className="sticky top-[72px] z-10 flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-3">
                <button
                    onClick={() => setViewMode('chat_list')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all relative ${
                        viewMode === 'chat_list' ? 'bg-teal-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600'
                    }`}
                >
                    💬 我的咨询
                    {totalUnread > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse">
                            {totalUnread > 9 ? '9+' : totalUnread}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => onOpenDoctors ? onOpenDoctors() : setViewMode('doctors')}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-50 text-blue-700 border border-blue-100"
                >
                    去医生页
                </button>
            </div>

            <div className="p-4">
                {loading ? (
                    <div className="text-center py-16 text-slate-400">加载中...</div>
                ) : viewMode === 'doctors' ? (
                    // ======== DOCTORS LIST ========
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <h2 className="font-bold text-slate-800">名医推荐</h2>
                            <span className="text-xs text-teal-600 font-bold">AI匹配</span>
                        </div>
                        {sortedDoctors.length === 0 ? (
                            <div className="text-center py-16 text-slate-400 bg-white rounded-2xl">暂无医生资源</div>
                        ) : (
                            sortedDoctors.map(doc => (
                                <div 
                                    key={doc.id}
                                    onClick={() => setSelectedDoctor(doc)}
                                    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4 cursor-pointer active:scale-[0.98] transition-transform"
                                >
                                    <DoctorAvatar doctor={doc} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-bold text-slate-800">{doc.title}</h3>
                                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold shrink-0">详情</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mb-2">{doc.details?.dept} · {doc.details?.title}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {doc.tags.slice(0, 3).map(t => (
                                                <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    // ======== CHAT LIST ========
                    <div className="space-y-3">
                        {doctorList.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-2xl">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 opacity-50">👨‍⚕️</div>
                                <h3 className="text-lg font-bold text-slate-700 mb-2">
                                    {!userId ? '登录后查看咨询' : '暂无签约医生'}
                                </h3>
                                <p className="text-sm text-slate-400 mb-4 px-4">
                                    {!userId
                                        ? '请先在底部「我的」登录，签约家庭医生后即可在此咨询'
                                        : '签约家庭医生后，可在此进行咨询'}
                                </p>
                                <button
                                    onClick={() =>
                                        userId
                                            ? setViewMode('doctors')
                                            : alert('请切换到底部「我的」完成登录后再签约医生')
                                    }
                                    className={`px-6 py-2 rounded-xl text-sm font-bold ${
                                        userId ? 'bg-blue-600 text-white' : 'bg-teal-600 text-white'
                                    }`}
                                >
                                    {userId ? '去签约医生' : '我知道了'}
                                </button>
                            </div>
                        ) : (
                            doctorList.map(item => (
                                <div 
                                    key={item.interaction.id}
                                    onClick={() => { setActiveDoctor(item.interaction); setViewMode('chat'); }}
                                    className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:bg-blue-50 active:scale-[0.98] transition-all"
                                >
                                    <div className="relative">
                                        <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-2xl shadow-inner border-2 border-white">
                                            👨‍⚕️
                                        </div>
                                        {item.unread > 0 && (
                                            <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 text-xs font-bold text-white animate-pulse">
                                                {item.unread}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-800">{item.interaction.targetName}</h3>
                                        <p className="text-xs text-slate-500">点击进入咨询...</p>
                                    </div>
                                    <div className="text-slate-300 text-lg">›</div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Doctor Detail Modal */}
            {selectedDoctor && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-end justify-center backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedDoctor(null)}>
                    <div className="bg-white w-full max-w-md rounded-t-3xl p-0 animate-slideUp overflow-hidden max-h-[85dvh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="relative border-b border-slate-100 bg-slate-50 p-6 pb-8 text-center">
                            <button onClick={() => setSelectedDoctor(null)} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 font-bold shadow-sm">×</button>
                            {isImageLike(selectedDoctor.image) ? (
                                <img src={withImageVersion(selectedDoctor)} alt={selectedDoctor.title} className="w-20 h-20 rounded-2xl object-cover border border-slate-200 shadow-sm mx-auto mb-4" />
                            ) : (
                                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-5xl shadow-sm mx-auto mb-4">
                                    {getMedicalIcon(selectedDoctor)}
                                </div>
                            )}
                            <h3 className="text-xl font-black text-slate-800 mb-1">{selectedDoctor.title}</h3>
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                                {selectedDoctor.details?.dept} · {selectedDoctor.details?.title}
                            </span>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4 flex-1">
                            <div className="flex flex-wrap gap-2 justify-center">
                                {selectedDoctor.tags.map(t => <span key={t} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{t}</span>)}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-blue-50 p-3 rounded-xl text-center">
                                    <div className="text-xs text-blue-400 mb-1">挂号费</div>
                                    <div className="font-bold text-blue-900 text-lg">¥{selectedDoctor.details?.fee || '0'}</div>
                                </div>
                                <div className="bg-blue-50 p-3 rounded-xl text-center">
                                    <div className="text-xs text-blue-400 mb-1">科室</div>
                                    <div className="font-bold text-blue-900">{selectedDoctor.details?.dept || '全科'}</div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold text-slate-800 text-sm mb-2">专家简介</h4>
                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl">
                                    {selectedDoctor.description || '暂无简介'}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-white">
                            <div className="flex gap-3">
                                <button onClick={() => handleInteract('booking', selectedDoctor)} className="flex-1 bg-white border border-blue-200 text-blue-600 py-3.5 rounded-xl font-bold text-sm hover:bg-blue-50 flex items-center justify-center gap-2">
                                    <span>📅</span> 预约挂号
                                </button>
                                <button onClick={() => handleInteract('signing', selectedDoctor)} className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                                    <span>✍️</span> 签约医生
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Time Selection Modal */}
            {showBookingModal && bookingDoctor && (
                <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm animate-fadeIn" onClick={() => setShowBookingModal(false)}>
                    <div className="max-h-[85dvh] w-full max-w-md animate-slideUp rounded-t-[2.5rem] bg-white p-6 flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
                        <h3 className="text-xl font-black text-slate-800 text-center mb-1">选择就诊时间</h3>
                        <p className="text-xs text-slate-400 text-center mb-6">预约专家：{bookingDoctor.title}</p>
                        
                        <div className="flex-1 overflow-y-auto space-y-6 pb-6">
                            {(() => {
                                const monthSlots = getNextMonthSlotsForDoctor(bookingDoctor);
                                if (!monthSlots.length) {
                                    return <div className="text-center text-slate-400 text-sm py-8">未来30天暂无可预约号源</div>;
                                }
                                return (
                                    <div className="grid grid-cols-1 gap-3">
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
                                                    className={`border p-4 rounded-2xl flex items-center justify-between transition-all ${
                                                        full
                                                            ? 'opacity-50 cursor-not-allowed border-slate-100 bg-slate-50'
                                                            : 'border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-200'
                                                    }`}
                                                >
                                                    <span className="font-bold text-slate-700">
                                                        {slot.displayDate} · {SLOT_MAP[slot.slotId]}
                                                    </span>
                                                    <span className={`text-xs font-bold ${full ? 'text-red-500' : 'text-slate-500'}`}>
                                                        {full ? '约满' : `余 ${quota - count} 位`}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                        
                        <button onClick={() => setShowBookingModal(false)} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold text-sm active:scale-95">取消</button>
                    </div>
                </div>
            )}
        </div>
    );
};
