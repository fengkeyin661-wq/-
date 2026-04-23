
import React, { useState, useEffect, useRef } from 'react';
import { fetchContent, ContentItem, fetchInteractions, InteractionItem, ChatMessage, fetchMessages, sendMessage, markAsRead, getUnreadCount, saveInteraction, isHealthManagerContent } from '../../services/contentService';
import { HealthArchive } from '../../services/dataService';
import { HealthAssessment } from '../../types';
import { getNextMonthSlotsForDoctor } from '../../services/doctorScheduleUtils';

interface Props {
    userId?: string;
    userName?: string;
    archive?: HealthArchive;
    assessment?: HealthAssessment;
    onMessageRead?: () => void;
    onOpenDoctors?: () => void;
    onOpenCommunity?: () => void;
}

interface DoctorWithUnread {
    interaction: InteractionItem;
    unread: number;
    isManager?: boolean;
}

type ViewMode = 'chat_list' | 'chat';
const MANAGER_DEEP_LINK_KEY = 'user_manager_recommend_deeplink';
const MANAGER_DEEP_LINK_TTL_MS = 2 * 60 * 1000;

const getMedicalIcon = (item: ContentItem): string => {
    const t = (item.title + (item.details?.dept || '')).toLowerCase();
    if (t.includes('涓尰')) return '馃尶';
    if (t.includes('鐗?) || t.includes('鍙ｈ厰')) return '馃Ψ';
    if (t.includes('楠?) || t.includes('搴峰')) return '馃Υ';
    if (t.includes('蹇?)) return '馃珋';
    if (t.includes('濡?) || t.includes('浜?)) return '馃懇鈥嶁殨锔?;
    if (t.includes('鍎?) || t.includes('灏忓効')) return '馃懚';
    return '馃懆鈥嶁殨锔?;
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

export const UserInteraction: React.FC<Props> = ({ userId, userName, archive, onMessageRead, onOpenDoctors, onOpenCommunity }) => {
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
        const poll = async () => {
            if (activeDoctor) {
                await loadMessages();
                await markAsRead(userId, activeDoctor.targetId);
                if (onMessageRead) onMessageRead();
            } else {
                await refreshUnreadOnly();
            }
        };
        poll();
        interval = setInterval(poll, 3000);
        return () => clearInterval(interval);
    }, [activeDoctor, userId, doctorList.length]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const docs = await fetchContent('doctor', 'active');
            let inters: InteractionItem[] = [];
            try {
                inters = await fetchInteractions();
            } catch {
                inters = [];
            }
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
                const doctorRows = listWithCount.sort((a, b) => {
                    if (b.unread !== a.unread) return b.unread - a.unread;
                    return new Date(b.interaction.date).getTime() - new Date(a.interaction.date).getTime();
                });
                setDoctorList(doctorRows);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const refreshUnreadOnly = async () => {
        if (!userId || doctorList.length === 0) return;
        const next = await Promise.all(
            doctorList.map(async (item) => ({
                ...item,
                unread: await getUnreadCount(userId, item.interaction.targetId),
            }))
        );
        const doctorRows = next
            .sort((a, b) => {
                if (b.unread !== a.unread) return b.unread - a.unread;
                return new Date(b.interaction.date).getTime() - new Date(a.interaction.date).getTime();
            });
        setDoctorList(doctorRows);
    };

    const loadMessages = async () => {
        if (!activeDoctor || !userId) return;
        const msgs = await fetchMessages(userId, activeDoctor.targetId);
        setChatMessages(msgs);
    };

    const handleSendMsg = async () => {
        if (!userId) {
            alert('璇峰厛鍦ㄥ簳閮ㄣ€屾垜鐨勩€嶇櫥褰曞悗鍐嶅彂閫佹秷鎭?);
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
        if (!userId) return alert('璇峰厛鍦ㄥ簳閮ㄣ€屾垜鐨勩€嶇櫥褰曞悗鍐嶇绾︽垨鎸傚彿');
        
        let interactionType: InteractionItem['type'] = 'doctor_booking';
        let confirmMsg = '';
        let details = '';

        if (type === 'signing') {
            interactionType = 'doctor_signing';
            confirmMsg = `纭畾鐢宠绛剧害銆?{target.title}銆戜负瀹跺涵鍖荤敓鍚楋紵`;
            details = '鐢宠瀹跺涵鍖荤敓绛剧害';
        } else if (type === 'booking') {
            interactionType = 'doctor_booking';
            if (!timeSlot) {
                setBookingDoctor(target);
                setShowBookingModal(true);
                setSelectedDoctor(null);
                return;
            }
            confirmMsg = `纭畾棰勭害銆?{target.title}銆戝湪銆?{timeSlot}銆戠殑闂ㄨ瘖鍚楋紵`;
            details = `棰勭害鎸傚彿锛?{timeSlot}锛岃垂鐢? ${target.details?.fee || 0}鍏僠;
        }

        if (confirm(confirmMsg)) {
            await saveInteraction({
                id: `${interactionType}_${Date.now()}`,
                type: interactionType,
                userId,
                userName: userName?.trim() || archive?.name?.trim() || '鐢ㄦ埛',
                targetId: target.id,
                targetName: target.title,
                status: 'pending',
                date: new Date().toISOString().split('T')[0],
                details
            });
            alert("鐢宠宸叉彁浜わ紒");
            setSelectedDoctor(null);
            setShowBookingModal(false);
            setBookingDoctor(null);
            loadAllData();
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

    const totalUnread = doctorList.reduce((sum, d) => sum + d.unread, 0);

    const openFromRecommendCard = (msg: ChatMessage) => {
        const type = String(msg.metadata?.resourceType || '');
        const resourceId = String(msg.metadata?.resourceId || '');
        if (resourceId) {
            try {
                sessionStorage.setItem(
                    MANAGER_DEEP_LINK_KEY,
                    JSON.stringify({
                        resourceId,
                        resourceType: type,
                        at: Date.now(),
                        ttlMs: MANAGER_DEEP_LINK_TTL_MS,
                    })
                );
            } catch {
                // ignore
            }
        }
        if (type === 'doctor') {
            if (onOpenDoctors) onOpenDoctors();
            return;
        }
        if (onOpenCommunity) onOpenCommunity();
    };

    // ======== RENDER: CHAT VIEW ========
    if (viewMode === 'chat' && activeDoctor) {
        const activeProvider = allDoctors.find((d) => d.id === activeDoctor.targetId);
        const isManagerChat = !!activeProvider && isHealthManagerContent(activeProvider);
        return (
            <div className="relative flex h-full flex-col bg-[#F0F2F5]">
                <div className="z-10 flex items-center gap-3 border-b border-slate-100 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md">
                    <button onClick={() => { setViewMode('chat_list'); setActiveDoctor(null); }} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">鈫?/button>
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg shadow-inner">馃懆鈥嶁殨锔?/div>
                    <div>
                        <h1 className="text-base font-bold text-slate-800">
                            {activeDoctor.targetName} {isManagerChat ? '鍋ュ悍绠＄悊甯? : '鍖荤敓'}
                        </h1>
                        <p className="text-xs font-medium text-green-600">鍦ㄧ嚎</p>
                    </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-28">
                    <div className="mx-auto my-4 w-fit rounded-full bg-slate-200/50 px-3 py-1 text-center text-xs text-slate-500">
                        浠呮彁渚涘仴搴峰挩璇紝鎬ヨ瘖璇峰強鏃跺氨鍖?
                    </div>
                    
                    {chatMessages.length === 0 ? (
                        <div className="text-center text-slate-400 text-xs mt-10">鏆傛棤娑堟伅锛屾墦涓嫑鍛煎惂 馃憢</div>
                    ) : (
                        chatMessages.map(msg => {
                            const isMe = msg.senderRole === 'user';
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[75%] px-4 py-3 text-sm shadow-sm ${
                                        isMe ? 'bg-teal-600 text-white rounded-2xl rounded-tr-sm' : 'bg-white text-slate-800 rounded-2xl rounded-tl-sm border border-slate-100'
                                    }`}>
                                        {msg.messageType === 'image' && msg.mediaUrl ? (
                                            <div className="space-y-2">
                                                <img src={msg.mediaUrl} alt="chat" className="max-h-64 rounded-lg border border-slate-200" />
                                                <p className="leading-relaxed">{msg.content}</p>
                                            </div>
                                        ) : msg.messageType === 'card_recommend' ? (
                                            <div>
                                                <p className="font-bold">{msg.metadata?.title || '鎺ㄨ崘璧勬簮'}</p>
                                                <p className="leading-relaxed mt-1 text-xs opacity-90">{msg.metadata?.description || msg.content}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => openFromRecommendCard(msg)}
                                                    className={`mt-2 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                                                        isMe ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700 border border-blue-100'
                                                    }`}
                                                >
                                                    鍘绘煡鐪?
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="leading-relaxed">{msg.content}</p>
                                        )}
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
                            placeholder="杈撳叆娑堟伅..."
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

    // ======== RENDER: MAIN VIEW (Care workflow + Chat List) ========
    return (
        <div className="min-h-full bg-slate-50 pb-28">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">娑堟伅涓績</h1>
                <p className="mt-1 text-sm text-slate-500">鍖荤敓涓庡仴搴风鐞嗗洟闃熷湪绾挎矡閫?/p>
            </div>

            {/* Header actions */}
            <div className="sticky top-[72px] z-10 flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-3">
                <button className="px-4 py-2 rounded-xl text-sm font-bold bg-teal-600 text-white shadow-lg relative">
                    馃挰 鎴戠殑娑堟伅
                    {totalUnread > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse">
                            {totalUnread > 9 ? '9+' : totalUnread}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => onOpenDoctors?.()}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-50 text-blue-700 border border-blue-100"
                >
                    鍘诲尰鐢熺绾?
                </button>
            </div>

            <div className="p-4">
                {loading ? (
                    <div className="text-center py-16 text-slate-400">鍔犺浇涓?..</div>
                ) : (
                    // ======== CHAT LIST + CARE WORKFLOW ========
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-100 bg-white p-4">
                            <h2 className="font-bold text-slate-800">绀惧尯鏀寔</h2>
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                <button type="button" onClick={() => onOpenCommunity?.()} className="rounded-xl bg-blue-50 px-2 py-2 text-xs font-bold text-blue-700">娲诲姩</button>
                                <button type="button" onClick={() => onOpenCommunity?.()} className="rounded-xl bg-emerald-50 px-2 py-2 text-xs font-bold text-emerald-700">楗</button>
                                <button type="button" onClick={() => onOpenCommunity?.()} className="rounded-xl bg-purple-50 px-2 py-2 text-xs font-bold text-purple-700">鏈嶅姟</button>
                            </div>
                        </div>
                        <div className="pt-1">
                            <h2 className="mb-2 text-sm font-black text-slate-700">鎴戠殑鍜ㄨ浼氳瘽</h2>
                        </div>
                        {doctorList.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-2xl">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 opacity-50">馃懆鈥嶁殨锔?/div>
                                <h3 className="text-lg font-bold text-slate-700 mb-2">
                                    {!userId ? '鐧诲綍鍚庢煡鐪嬪挩璇? : '鏆傛棤绛剧害鍖荤敓'}
                                </h3>
                                <p className="text-sm text-slate-400 mb-4 px-4">
                                    {!userId
                                        ? '璇峰厛鍦ㄥ簳閮ㄣ€屾垜鐨勩€嶇櫥褰曞悗浣跨敤鍋ュ悍绠″涓庡尰鐢熷挩璇?
                                        : '褰撳墠鏆傛棤宸茬绾﹀尰鐢?鍋ュ悍绠＄悊甯堜細璇濊褰?}
                                </p>
                                <button
                                    onClick={() =>
                                        userId
                                            ? onOpenDoctors?.()
                                            : alert('璇峰垏鎹㈠埌搴曢儴銆屾垜鐨勩€嶅畬鎴愮櫥褰曞悗鍐嶄娇鐢ㄥ挩璇?)
                                    }
                                    className={`px-6 py-2 rounded-xl text-sm font-bold ${
                                        userId ? 'bg-blue-600 text-white' : 'bg-teal-600 text-white'
                                    }`}
                                >
                                    {userId ? '鍘诲尰鐢熺绾? : '鎴戠煡閬撲簡'}
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
                                            馃懆鈥嶁殨锔?
                                        </div>
                                        {item.unread > 0 && (
                                            <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 text-xs font-bold text-white animate-pulse">
                                                {item.unread}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-800">{item.interaction.targetName}</h3>
                                        <p className="text-xs text-slate-500">{item.isManager ? '鍋ュ悍绠＄悊甯堝湪绾挎湇鍔? : '鐐瑰嚮杩涘叆鍜ㄨ...'}</p>
                                    </div>
                                    <div className="text-slate-300 text-lg">鈥?/div>
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
                            <button onClick={() => setSelectedDoctor(null)} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 font-bold shadow-sm">脳</button>
                            {isImageLike(selectedDoctor.image) ? (
                                <img src={withImageVersion(selectedDoctor)} alt={selectedDoctor.title} className="w-20 h-20 rounded-2xl object-cover border border-slate-200 shadow-sm mx-auto mb-4" />
                            ) : (
                                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-5xl shadow-sm mx-auto mb-4">
                                    {getMedicalIcon(selectedDoctor)}
                                </div>
                            )}
                            <h3 className="text-xl font-black text-slate-800 mb-1">{selectedDoctor.title}</h3>
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                                {selectedDoctor.details?.dept} 路 {selectedDoctor.details?.title}
                            </span>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4 flex-1">
                            <div className="flex flex-wrap gap-2 justify-center">
                                {selectedDoctor.tags.map(t => <span key={t} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{t}</span>)}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-blue-50 p-3 rounded-xl text-center">
                                    <div className="text-xs text-blue-400 mb-1">鎸傚彿璐?/div>
                                    <div className="font-bold text-blue-900 text-lg">楼{selectedDoctor.details?.fee || '0'}</div>
                                </div>
                                <div className="bg-blue-50 p-3 rounded-xl text-center">
                                    <div className="text-xs text-blue-400 mb-1">绉戝</div>
                                    <div className="font-bold text-blue-900">{selectedDoctor.details?.dept || '鍏ㄧ'}</div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold text-slate-800 text-sm mb-2">涓撳绠€浠?/h4>
                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl">
                                    {selectedDoctor.description || '鏆傛棤绠€浠?}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-white">
                            <div className="flex gap-3">
                                <button onClick={() => handleInteract('booking', selectedDoctor)} className="flex-1 bg-white border border-blue-200 text-blue-600 py-3.5 rounded-xl font-bold text-sm hover:bg-blue-50 flex items-center justify-center gap-2">
                                    <span>馃搮</span> 棰勭害鎸傚彿
                                </button>
                                <button onClick={() => handleInteract('signing', selectedDoctor)} className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                                    <span>鉁嶏笍</span> 绛剧害鍖荤敓
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
                        <h3 className="text-xl font-black text-slate-800 text-center mb-1">閫夋嫨灏辫瘖鏃堕棿</h3>
                        <p className="text-xs text-slate-400 text-center mb-6">棰勭害涓撳锛歿bookingDoctor.title}</p>
                        
                        <div className="flex-1 overflow-y-auto space-y-6 pb-6">
                            {(() => {
                                const monthSlots = getNextMonthSlotsForDoctor(bookingDoctor);
                                if (!monthSlots.length) {
                                    return <div className="text-center text-slate-400 text-sm py-8">鏈潵30澶╂殏鏃犲彲棰勭害鍙锋簮</div>;
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
                                                            `${slot.displayDate}${slot.slotLabel}`
                                                        )
                                                    }
                                                    className={`border p-4 rounded-2xl flex items-center justify-between transition-all ${
                                                        full
                                                            ? 'opacity-50 cursor-not-allowed border-slate-100 bg-slate-50'
                                                            : 'border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-200'
                                                    }`}
                                                >
                                                    <span className="font-bold text-slate-700">
                                                        {slot.displayDate} 路 {slot.slotLabel}
                                                    </span>
                                                    <span className={`text-xs font-bold ${full ? 'text-red-500' : 'text-slate-500'}`}>
                                                        {full ? '绾︽弧' : `浣?${quota - count} 浣峘}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                        
                        <button onClick={() => setShowBookingModal(false)} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold text-sm active:scale-95">鍙栨秷</button>
                    </div>
                </div>
            )}
        </div>
    );
};

