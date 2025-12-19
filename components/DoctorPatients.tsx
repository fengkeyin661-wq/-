
import React, { useState, useEffect, useRef } from 'react';
import { fetchInteractions, updateInteractionStatus, InteractionItem, ChatMessage, fetchMessages, sendMessage, getUnreadCount, markAsRead, fetchContent, saveContent } from '../services/contentService';
import { findArchiveByCheckupId, HealthArchive } from '../services/dataService';

interface Props {
    doctorId: string; 
    onSelectPatient: (archive: HealthArchive, mode: 'assessment' | 'followup') => void;
}

interface PatientData {
    interaction: InteractionItem;
    archive?: HealthArchive;
    unread?: number;
}

const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS = [{id: 'AM', label: '上午'}, {id: 'PM', label: '下午'}];

export const DoctorPatients: React.FC<Props> = ({ doctorId, onSelectPatient }) => {
    const [mainTab, setMainTab] = useState<'patients' | 'workboard' | 'schedule' | 'bookings'>('workboard');
    const [signedPatients, setSignedPatients] = useState<PatientData[]>([]);
    const [pendingRequests, setPendingRequests] = useState<InteractionItem[]>([]);
    const [confirmedBookings, setConfirmedBookings] = useState<InteractionItem[]>([]);
    const [loading, setLoading] = useState(false);

    // Schedule State (Enhanced with Quotas)
    const [weeklySchedule, setWeeklySchedule] = useState<Record<string, string[]>>({});
    const [slotQuotas, setSlotQuotas] = useState<Record<string, Record<string, number>>>({});
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);

    // Chat State
    const [chatPatient, setChatPatient] = useState<PatientData | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const totalUnread = signedPatients.reduce((acc, curr) => acc + (curr.unread || 0), 0);

    useEffect(() => {
        loadData();
        loadDoctorProfile();
    }, [doctorId]);

    useEffect(() => {
        let interval: any;
        if (chatPatient) {
            loadMessages();
            markAsRead(doctorId, chatPatient.interaction.userId).then(() => {
                 setSignedPatients(prev => prev.map(p => p.interaction.userId === chatPatient.interaction.userId ? { ...p, unread: 0 } : p));
            });
            interval = setInterval(loadMessages, 3000);
        }
        return () => clearInterval(interval);
    }, [chatPatient]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const loadDoctorProfile = async () => {
        const allDocs = await fetchContent('doctor');
        const me = allDocs.find(d => d.id === doctorId);
        if (me) {
            if (me.details?.weeklySchedule) setWeeklySchedule(me.details.weeklySchedule);
            if (me.details?.slotQuotas) setSlotQuotas(me.details.slotQuotas);
        }
    };

    const loadData = async () => {
        if (!chatPatient) setLoading(true);
        const interactions = await fetchInteractions();
        
        // Signed Patients
        const signings = interactions
            .filter(i => i.type === 'doctor_signing' && i.targetId === doctorId && i.status === 'confirmed');

        const patientsList: PatientData[] = [];
        const seenUserIds = new Set<string>();
        
        for (const s of signings) {
            if (seenUserIds.has(s.userId)) continue;
            seenUserIds.add(s.userId);
            let archive = await findArchiveByCheckupId(s.userId);
            let unreadCount = await getUnreadCount(doctorId, s.userId);
            patientsList.push({ interaction: s, archive: archive || undefined, unread: unreadCount });
        }
        setSignedPatients(patientsList);

        // Confirmed Bookings (Already confirmed, waiting for visit)
        const confirmed = interactions.filter(i => i.type === 'doctor_booking' && i.targetId === doctorId && i.status === 'confirmed');
        setConfirmedBookings(confirmed);

        // Pending Audit Requests
        const requests = interactions.filter(i => 
            i.status === 'pending' && 
            ((i.type === 'doctor_signing' && i.targetId === doctorId) || 
             (i.type === 'doctor_booking' && i.targetId === doctorId) ||
             (i.type === 'drug_order' && seenUserIds.has(i.userId)))
        );
        setPendingRequests(requests);
        if (!chatPatient) setLoading(false);
    };

    const loadMessages = async () => {
        if (!chatPatient) return;
        const msgs = await fetchMessages(chatPatient.interaction.userId, doctorId);
        setChatMessages(msgs);
    };

    const toggleSchedule = (dayKey: string, slotId: string) => {
        const current = weeklySchedule[dayKey] || [];
        let updated = [];
        if (current.includes(slotId)) {
            updated = current.filter(s => s !== slotId);
        } else {
            updated = [...current, slotId];
            // Initialize quota if not exists
            if (!slotQuotas[dayKey]?.[slotId]) {
                setSlotQuotas(prev => ({
                    ...prev,
                    [dayKey]: { ...(prev[dayKey] || {}), [slotId]: 10 } // Default to 10
                }));
            }
        }
        setWeeklySchedule({ ...weeklySchedule, [dayKey]: updated });
    };

    const handleQuotaChange = (dayKey: string, slotId: string, value: number) => {
        setSlotQuotas(prev => ({
            ...prev,
            [dayKey]: { ...(prev[dayKey] || {}), [slotId]: Math.max(1, value) }
        }));
    };

    const saveSchedule = async () => {
        setIsSavingSchedule(true);
        try {
            const allDocs = await fetchContent('doctor');
            const me = allDocs.find(d => d.id === doctorId);
            if (!me) throw new Error("未找到医生信息");

            const updatedMe = {
                ...me,
                details: { ...me.details, weeklySchedule, slotQuotas }
            };
            await saveContent(updatedMe);
            alert("设置已保存！");
        } catch (e) {
            alert("保存失败，请稍后重试");
        } finally {
            setIsSavingSchedule(false);
        }
    };

    const handleAudit = async (id: string, pass: boolean) => {
        if (confirm(`确定要${pass ? '通过' : '拒绝'}此申请吗？`)) {
            await updateInteractionStatus(id, pass ? 'confirmed' : 'cancelled');
            loadData();
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] flex flex-col relative">
            <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center bg-slate-50 rounded-t-xl gap-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span>🩺</span> 医生工作站
                </h2>
                <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm flex-wrap">
                    <button 
                        onClick={() => setMainTab('workboard')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${mainTab === 'workboard' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        待办工作台 {pendingRequests.length > 0 && <span className="bg-white text-orange-500 text-[10px] px-1.5 rounded-full">{pendingRequests.length}</span>}
                    </button>
                    <button 
                        onClick={() => setMainTab('bookings')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${mainTab === 'bookings' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        📅 预约清单 {confirmedBookings.length > 0 && <span className="bg-white text-indigo-600 text-[10px] px-1.5 rounded-full">{confirmedBookings.length}</span>}
                    </button>
                    <button 
                        onClick={() => setMainTab('patients')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${mainTab === 'patients' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        签约用户 {totalUnread > 0 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                    </button>
                    <button 
                        onClick={() => setMainTab('schedule')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${mainTab === 'schedule' ? 'bg-teal-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        🗓️ 出诊设置
                    </button>
                </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
                {loading && mainTab !== 'schedule' ? (
                    <div className="text-center py-20 text-slate-400">加载中...</div>
                ) : (
                    <>
                        {mainTab === 'workboard' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pendingRequests.length === 0 ? <div className="col-span-full text-center py-20 text-slate-400">暂无待处理申请</div> : 
                                pendingRequests.map(req => (
                                    <div key={req.id} className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${req.type === 'doctor_signing' ? 'bg-blue-100 text-blue-700' : req.type === 'doctor_booking' ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'}`}>
                                                {req.type === 'doctor_signing' ? '签约申请' : req.type === 'doctor_booking' ? '挂号预约' : '药品预约'}
                                            </span>
                                            <div className="text-[10px] text-slate-400">{req.date}</div>
                                        </div>
                                        <div className="font-bold text-slate-800 text-base">{req.userName}</div>
                                        <div className="bg-slate-50 p-2 rounded text-xs text-slate-600 my-3 leading-relaxed">
                                            {req.details}
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleAudit(req.id, false)} className="flex-1 py-1.5 border border-slate-200 text-slate-500 rounded text-xs">拒绝</button>
                                            <button onClick={() => handleAudit(req.id, true)} className="flex-1 py-1.5 bg-blue-600 text-white rounded text-xs font-bold">同意</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {mainTab === 'bookings' && (
                            <div className="space-y-6">
                                {confirmedBookings.length === 0 ? (
                                    <div className="text-center py-20 text-slate-400">近期暂无已约人员</div>
                                ) : (
                                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                        <table className="w-full text-left text-sm border-collapse">
                                            <thead className="bg-slate-50 text-slate-500 font-bold border-b">
                                                <tr>
                                                    <th className="p-4">预约时间段</th>
                                                    <th className="p-4">受检人员</th>
                                                    <th className="p-4">预约项目</th>
                                                    <th className="p-4">操作</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {confirmedBookings.map(bk => (
                                                    <tr key={bk.id} className="hover:bg-slate-50">
                                                        <td className="p-4 font-bold text-indigo-600">
                                                            {bk.details?.match(/周[一二三四五六日][上下]午/)?.[0] || '常规时段'}
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="font-bold text-slate-800">{bk.userName}</div>
                                                            <div className="text-[10px] text-slate-400">{bk.userId}</div>
                                                        </td>
                                                        <td className="p-4 text-slate-600 text-xs">{bk.details}</td>
                                                        <td className="p-4">
                                                            <button 
                                                                onClick={async () => {
                                                                    const arch = await findArchiveByCheckupId(bk.userId);
                                                                    if (arch) onSelectPatient(arch, 'followup');
                                                                }}
                                                                className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold"
                                                            >
                                                                查看病历
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {mainTab === 'patients' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {signedPatients.length === 0 ? <div className="col-span-full text-center py-20 text-slate-400">暂无签约用户</div> : 
                                signedPatients.map((item) => (
                                    <div key={item.interaction.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-white relative">
                                        {item.unread! > 0 && <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold border-2 border-white animate-bounce">{item.unread}</div>}
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-2xl">
                                                {item.archive?.gender === '女' ? '👩' : '👨'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800">{item.interaction.userName}</div>
                                                <div className="text-xs text-slate-400">{item.archive?.age || '?'}岁 · {item.archive?.department || '未录入'}</div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => item.archive && onSelectPatient(item.archive, 'assessment')} className="py-1.5 bg-indigo-50 text-indigo-600 rounded text-xs font-bold hover:bg-indigo-100 transition-colors">查看评估</button>
                                            <button onClick={() => item.archive && onSelectPatient(item.archive, 'followup')} className="py-1.5 bg-teal-50 text-teal-600 rounded text-xs font-bold hover:bg-teal-100 transition-colors">随访监测</button>
                                            <button onClick={() => setChatPatient(item)} className="col-span-2 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm">在线咨询</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {mainTab === 'schedule' && (
                            <div className="max-w-5xl mx-auto animate-fadeIn pb-20">
                                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6">
                                    <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-1">
                                        <span>🗓️</span> 出诊计划与限号量设定
                                    </h3>
                                    <p className="text-xs text-blue-600">设置您的常规出诊规律和每个时段的最大挂号限额。用户预约时若该时段约满将自动关闭。</p>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
                                    <table className="w-full text-center border-collapse min-w-[700px]">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest border-r border-slate-200">时段</th>
                                                {DAYS.map(day => (
                                                    <th key={day} className="p-4 text-sm font-bold text-slate-700">{day}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {SLOTS.map(slot => (
                                                <tr key={slot.id} className="border-b border-slate-100 last:border-0">
                                                    <td className="p-4 bg-slate-50/50 font-bold text-slate-500 text-xs border-r border-slate-200">{slot.label}</td>
                                                    {DAY_KEYS.map(dayKey => {
                                                        const isActive = weeklySchedule[dayKey]?.includes(slot.id);
                                                        const quota = slotQuotas[dayKey]?.[slot.id] || 10;
                                                        return (
                                                            <td key={dayKey} className="p-2 align-top">
                                                                <div className={`p-3 rounded-xl transition-all duration-300 flex flex-col gap-2 ${
                                                                    isActive 
                                                                    ? 'bg-white border-2 border-teal-500 shadow-lg' 
                                                                    : 'bg-slate-50 border-2 border-dashed border-slate-200'
                                                                }`}>
                                                                    <button 
                                                                        onClick={() => toggleSchedule(dayKey, slot.id)}
                                                                        className={`py-2 rounded-lg text-sm font-bold transition-colors ${isActive ? 'bg-teal-500 text-white' : 'text-slate-300 hover:text-slate-500'}`}
                                                                    >
                                                                        {isActive ? '🏥 出诊中' : '休息'}
                                                                    </button>
                                                                    
                                                                    {isActive && (
                                                                        <div className="flex flex-col gap-1 items-start mt-1">
                                                                            <span className="text-[10px] text-slate-400 font-bold uppercase">限号量</span>
                                                                            <div className="flex items-center gap-1 w-full">
                                                                                <input 
                                                                                    type="number" 
                                                                                    min="1"
                                                                                    max="100"
                                                                                    value={quota}
                                                                                    onChange={(e) => handleQuotaChange(dayKey, slot.id, parseInt(e.target.value) || 1)}
                                                                                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mt-8 flex justify-center">
                                    <button 
                                        onClick={saveSchedule}
                                        disabled={isSavingSchedule}
                                        className="bg-slate-900 text-white px-12 py-3 rounded-xl font-bold shadow-xl hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isSavingSchedule ? '正在同步云端...' : '💾 保存所有设置'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Chat Modal */}
            {chatPatient && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-[#F0F2F5] w-full max-w-2xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn">
                        <div className="bg-white px-6 py-4 flex justify-between items-center shadow-sm border-b">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">
                                    {chatPatient.archive?.gender === '女' ? '👩' : '👨'}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{chatPatient.interaction.userName}</h3>
                                    <p className="text-[10px] text-green-600 font-medium">正在咨询中</p>
                                </div>
                            </div>
                            <button onClick={() => setChatPatient(null)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {chatMessages.map(msg => {
                                const isMe = msg.senderRole === 'doctor';
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm text-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white text-slate-800 rounded-tl-sm'}`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="bg-white p-4 flex gap-3 border-t">
                            <input className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="回复患者..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMsg()} />
                            <button onClick={handleSendMsg} className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition-colors">发送</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    async function handleSendMsg() {
        if (!chatPatient || !chatInput.trim()) return;
        await sendMessage({ senderId: doctorId, senderRole: 'doctor', receiverId: chatPatient.interaction.userId, content: chatInput });
        setChatInput('');
        loadMessages();
    }
};
