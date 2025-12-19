import React, { useState, useEffect, useRef } from 'react';
// Added ContentItem to the imports
import { fetchInteractions, updateInteractionStatus, InteractionItem, ChatMessage, fetchMessages, sendMessage, getUnreadCount, markAsRead, fetchContent, saveContent, ContentItem } from '../services/contentService';
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
    const [mainTab, setMainTab] = useState<'patients' | 'workboard' | 'schedule' | 'bookings' | 'circles'>('workboard');
    const [signedPatients, setSignedPatients] = useState<PatientData[]>([]);
    const [pendingRequests, setPendingRequests] = useState<InteractionItem[]>([]);
    const [confirmedBookings, setConfirmedBookings] = useState<InteractionItem[]>([]);
    const [loading, setLoading] = useState(false);

    // Circles Management
    const [myCircles, setMyCircles] = useState<ContentItem[]>([]);
    const [circleJoins, setCircleJoins] = useState<InteractionItem[]>([]);
    const [showCreateCircle, setShowCreateCircle] = useState(false);
    const [newCircle, setNewCircle] = useState({ title: '', description: '', image: '👨‍⚕️' });

    // ... (keep previous state)
    const [weeklySchedule, setWeeklySchedule] = useState<Record<string, string[]>>({});
    const [slotQuotas, setSlotQuotas] = useState<Record<string, Record<string, number>>>({});
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);

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
            markAsRead(doctorId, chatPatient.interaction.userId);
            interval = setInterval(loadMessages, 3000);
        }
        return () => clearInterval(interval);
    }, [chatPatient]);

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
        const [inters, content] = await Promise.all([
            fetchInteractions(),
            fetchContent('circle')
        ]);
        
        // My Initiated Circles
        setMyCircles(content.filter(c => c.details?.creatorId === doctorId));
        setCircleJoins(inters.filter(i => i.type === 'circle_join' && i.status === 'pending'));

        // Signed Patients
        const signings = inters.filter(i => i.type === 'doctor_signing' && i.targetId === doctorId && i.status === 'confirmed');
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

        // Confirmed Bookings
        setConfirmedBookings(inters.filter(i => i.type === 'doctor_booking' && i.targetId === doctorId && i.status === 'confirmed'));

        // Pending Audit
        setPendingRequests(inters.filter(i => i.status === 'pending' && ((i.type === 'doctor_signing' && i.targetId === doctorId) || (i.type === 'doctor_booking' && i.targetId === doctorId))));
        if (!chatPatient) setLoading(false);
    };

    const handleCreateCircle = async () => {
        if(!newCircle.title) return;
        await saveContent({
            id: `doc_circle_${Date.now()}`,
            type: 'circle',
            title: newCircle.title,
            description: newCircle.description,
            tags: ['专家领航', '医学背景'],
            image: newCircle.image,
            status: 'pending',
            updatedAt: new Date().toISOString(),
            details: { creatorId: doctorId, creatorName: '邱医生', creatorRole: 'doctor', memberCount: 1 }
        });
        alert("圈子发起成功，请联系健康管理中心管理员审核上架。");
        setShowCreateCircle(false);
        loadData();
    };

    const loadMessages = async () => {
        if (!chatPatient) return;
        const msgs = await fetchMessages(chatPatient.interaction.userId, doctorId);
        setChatMessages(msgs);
    };

    const toggleSchedule = (dayKey: string, slotId: string) => {
        const current = weeklySchedule[dayKey] || [];
        const updated = current.includes(slotId) ? current.filter(s => s !== slotId) : [...current, slotId];
        setWeeklySchedule({ ...weeklySchedule, [dayKey]: updated });
    };

    const saveSchedule = async () => {
        setIsSavingSchedule(true);
        try {
            const allDocs = await fetchContent('doctor');
            const me = allDocs.find(d => d.id === doctorId);
            if (me) {
                await saveContent({ ...me, details: { ...me.details, weeklySchedule, slotQuotas } });
                alert("出诊设置已同步");
            }
        } finally { setIsSavingSchedule(false); }
    };

    const handleAudit = async (id: string, pass: boolean) => {
        await updateInteractionStatus(id, pass ? 'confirmed' : 'cancelled');
        loadData();
    };

    // Implemented missing handleSendMsg function
    const handleSendMsg = async () => {
        if (!chatPatient || !chatInput.trim()) return;
        await sendMessage({
            senderId: doctorId,
            senderRole: 'doctor',
            receiverId: chatPatient.interaction.userId,
            content: chatInput
        });
        setChatInput('');
        loadMessages();
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center bg-slate-50 gap-4">
                <h2 className="text-xl font-bold text-slate-800">🩺 医生工作站</h2>
                <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                    <button onClick={() => setMainTab('workboard')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mainTab === 'workboard' ? 'bg-orange-50 text-white shadow' : 'text-slate-500'}`}>待办工作台</button>
                    <button onClick={() => setMainTab('bookings')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mainTab === 'bookings' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500'}`}>预约清单</button>
                    <button onClick={() => setMainTab('patients')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mainTab === 'patients' ? 'bg-blue-600 text-white shadow' : 'text-slate-500'}`}>签约用户</button>
                    <button onClick={() => setMainTab('circles')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mainTab === 'circles' ? 'bg-purple-600 text-white shadow' : 'text-slate-500'}`}>我的圈子</button>
                    <button onClick={() => setMainTab('schedule')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mainTab === 'schedule' ? 'bg-teal-600 text-white shadow' : 'text-slate-500'}`}>出诊设置</button>
                </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
                {mainTab === 'circles' && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-700">我发起的兴趣圈子</h3>
                            <button onClick={() => setShowCreateCircle(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md">发起学术/科普圈</button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {myCircles.map(c => {
                                const pending = circleJoins.filter(j => j.targetId === c.id);
                                return (
                                    <div key={c.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="text-3xl">{c.image}</span>
                                            <div>
                                                <div className="font-bold text-slate-800">{c.title}</div>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {c.status === 'active' ? '已上架' : '审核中'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-slate-100">
                                            <div className="text-xs font-bold text-slate-400 mb-2">待审批入圈申请 ({pending.length})</div>
                                            <div className="space-y-2">
                                                {pending.map(m => (
                                                    <div key={m.id} className="flex justify-between items-center text-xs p-2 hover:bg-slate-50 rounded">
                                                        <span className="font-bold text-slate-700">{m.userName}</span>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleAudit(m.id, true)} className="text-teal-600 font-bold">同意</button>
                                                            <button onClick={() => handleAudit(m.id, false)} className="text-red-500">忽略</button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {pending.length === 0 && <p className="text-[10px] text-slate-300">暂无待处理人员</p>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                
                {/* (Keep previous workboard, bookings, schedule logic unchanged) */}
                {mainTab === 'workboard' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pendingRequests.map(req => (
                            <div key={req.id} className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${req.type === 'doctor_signing' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'}`}>
                                        {req.type === 'doctor_signing' ? '签约申请' : '挂号预约'}
                                    </span>
                                    <div className="text-[10px] text-slate-400">{req.date}</div>
                                </div>
                                <div className="font-bold text-slate-800 text-base">{req.userName}</div>
                                <div className="bg-slate-50 p-2 rounded text-xs text-slate-600 my-3 leading-relaxed">{req.details}</div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleAudit(req.id, false)} className="flex-1 py-1.5 border border-slate-200 text-slate-500 rounded text-xs">拒绝</button>
                                    <button onClick={() => handleAudit(req.id, true)} className="flex-1 py-1.5 bg-blue-600 text-white rounded text-xs font-bold">同意</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {mainTab === 'patients' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {signedPatients.map((item) => (
                            <div key={item.interaction.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-white relative">
                                {item.unread! > 0 && <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold border-2 border-white">{item.unread}</div>}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-2xl">{item.archive?.gender === '女' ? '👩' : '👨'}</div>
                                    <div>
                                        <div className="font-bold text-slate-800">{item.interaction.userName}</div>
                                        <div className="text-xs text-slate-400">{item.archive?.age || '?'}岁 · {item.archive?.department || '未录入'}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => item.archive && onSelectPatient(item.archive, 'assessment')} className="py-1.5 bg-indigo-50 text-indigo-600 rounded text-xs font-bold">查看评估</button>
                                    <button onClick={() => setChatPatient(item)} className="py-1.5 bg-blue-600 text-white rounded text-xs font-bold">在线咨询</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {mainTab === 'schedule' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-center border-collapse">
                                <thead className="bg-slate-50 border-b"><tr><th className="p-4 text-xs font-bold text-slate-400 uppercase">时段</th>{DAYS.map(day => (<th key={day} className="p-4 text-sm font-bold text-slate-700">{day}</th>))}</tr></thead>
                                <tbody>
                                    {SLOTS.map(slot => (
                                        <tr key={slot.id} className="border-b last:border-0">
                                            <td className="p-4 bg-slate-50/50 font-bold text-slate-500 text-xs">{slot.label}</td>
                                            {DAY_KEYS.map(dayKey => {
                                                const isActive = weeklySchedule[dayKey]?.includes(slot.id);
                                                return (<td key={dayKey} className="p-2"><button onClick={() => toggleSchedule(dayKey, slot.id)} className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${isActive ? 'bg-teal-500 text-white shadow-inner' : 'text-slate-300 hover:bg-slate-50'}`}>{isActive ? '🏥 出诊' : '休息'}</button></td>);
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-8 flex justify-center"><button onClick={saveSchedule} disabled={isSavingSchedule} className="bg-slate-900 text-white px-12 py-3 rounded-xl font-bold shadow-xl active:scale-95 transition-all disabled:opacity-50">{isSavingSchedule ? '同步中...' : '💾 保存排班设置'}</button></div>
                    </div>
                )}
            </div>

            {/* Doctor Create Circle Modal */}
            {showCreateCircle && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-scaleIn">
                        <h3 className="text-xl font-black text-slate-800 mb-6 text-center">作为医生发起圈子</h3>
                        <div className="space-y-4">
                            <input className="w-full border p-3 rounded-xl text-sm" placeholder="圈子名称 (如：糖友专家共管群)" value={newCircle.title} onChange={e => setNewCircle({...newCircle, title: e.target.value})} />
                            <textarea className="w-full border p-3 rounded-xl text-sm h-32" placeholder="圈子简介..." value={newCircle.description} onChange={e => setNewCircle({...newCircle, description: e.target.value})} />
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-500">图标:</span>
                                <input className="w-16 border p-2 rounded-xl text-center" value={newCircle.image} onChange={e => setNewCircle({...newCircle, image: e.target.value})} />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowCreateCircle(false)} className="flex-1 py-3 text-slate-500">取消</button>
                            <button onClick={handleCreateCircle} className="flex-1 bg-purple-600 text-white rounded-xl font-bold">发起申请</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Modal */}
            {chatPatient && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-[#F0F2F5] w-full max-w-2xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn">
                        <div className="bg-white px-6 py-4 flex justify-between items-center shadow-sm border-b">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">{chatPatient.archive?.gender === '女' ? '👩' : '👨'}</div>
                                <div><h3 className="font-bold text-slate-800">{chatPatient.interaction.userName}</h3><p className="text-[10px] text-green-600 font-medium">咨询中</p></div>
                            </div>
                            <button onClick={() => setChatPatient(null)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {chatMessages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.senderRole === 'doctor' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm text-sm ${msg.senderRole === 'doctor' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white text-slate-800 rounded-tl-sm'}`}>{msg.content}</div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="bg-white p-4 flex gap-3 border-t">
                            {/* Fixed handleSendMsg call */}
                            <input className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="回复患者..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMsg()} />
                            <button onClick={handleSendMsg} className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold">发送</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};