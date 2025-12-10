
import React, { useState, useEffect, useRef } from 'react';
import { fetchInteractions, updateInteractionStatus, InteractionItem, ChatMessage, fetchMessages, sendMessage, getUnreadCount, markAsRead } from '../services/contentService';
import { findArchiveByCheckupId, HealthArchive } from '../services/dataService';

interface Props {
    doctorId: string; // The ID of the currently logged-in doctor
    onSelectPatient: (archive: HealthArchive, mode: 'assessment' | 'followup') => void;
}

interface PatientData {
    interaction: InteractionItem;
    archive?: HealthArchive;
    unread?: number; // Add unread count
}

export const DoctorPatients: React.FC<Props> = ({ doctorId, onSelectPatient }) => {
    // New tab structure: 'patients' (Signed) vs 'workboard' (Pending Requests)
    const [mainTab, setMainTab] = useState<'patients' | 'workboard'>('workboard');
    
    // Data Lists
    const [signedPatients, setSignedPatients] = useState<PatientData[]>([]);
    const [pendingRequests, setPendingRequests] = useState<InteractionItem[]>([]);
    
    const [loading, setLoading] = useState(false);

    // Chat State
    const [chatPatient, setChatPatient] = useState<PatientData | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Calculated total unread
    const totalUnread = signedPatients.reduce((acc, curr) => acc + (curr.unread || 0), 0);

    useEffect(() => {
        loadData();
        // Poll for unread counts even when not chatting
        const interval = setInterval(loadData, 5000); 
        return () => clearInterval(interval);
    }, [doctorId]);

    // Polling for new messages in active chat
    useEffect(() => {
        let interval: any;
        if (chatPatient) {
            loadMessages();
            // Mark as read immediately when chat is open
            markAsRead(doctorId, chatPatient.interaction.userId).then(() => {
                 // Update local count after marking
                 setSignedPatients(prev => prev.map(p => p.interaction.userId === chatPatient.interaction.userId ? { ...p, unread: 0 } : p));
            });
            interval = setInterval(loadMessages, 3000);
        }
        return () => clearInterval(interval);
    }, [chatPatient]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const loadData = async () => {
        if (!chatPatient) setLoading(true); // Don't show full loading spinner if just background polling
        const interactions = await fetchInteractions();
        
        // 1. Filter Signed Patients (Confirmed Signings)
        const signings = interactions.filter(i => i.type === 'doctor_signing' && i.targetId === doctorId && i.status === 'confirmed');
        const patientsList: PatientData[] = [];
        
        for (const s of signings) {
            let archive = await findArchiveByCheckupId(s.userId);
            let unreadCount = await getUnreadCount(doctorId, s.userId);
            patientsList.push({ interaction: s, archive: archive || undefined, unread: unreadCount });
        }
        setSignedPatients(patientsList);

        // 2. Filter Workboard Requests
        const requests = interactions.filter(i => {
            if (i.status !== 'pending') return false;
            
            // Case A: Signing Request directed to me
            if (i.type === 'doctor_signing' && i.targetId === doctorId) return true;
            
            // Case B: Appointment Booking directed to me
            if (i.type === 'doctor_booking' && i.targetId === doctorId) return true;

            // Case C: Drug Order from MY signed patient
            const isMyPatient = signings.some(s => s.userId === i.userId);
            if (i.type === 'drug_order' && isMyPatient) return true;

            return false;
        });
        setPendingRequests(requests);

        if (!chatPatient) setLoading(false);
    };

    const loadMessages = async () => {
        if (!chatPatient) return;
        const msgs = await fetchMessages(chatPatient.interaction.userId, doctorId);
        setChatMessages(msgs);
    };

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

    const handleAudit = async (id: string, pass: boolean) => {
        if (confirm(`确定要${pass ? '通过' : '拒绝'}此申请吗？`)) {
            await updateInteractionStatus(id, pass ? 'confirmed' : 'cancelled');
            loadData();
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] flex flex-col relative">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <span>🩺</span> 医生工作站
                    </h2>
                </div>
                <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                    <button 
                        onClick={() => setMainTab('workboard')}
                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${mainTab === 'workboard' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        待办工作台 
                        {pendingRequests.length > 0 && <span className="bg-white text-orange-500 text-xs px-1.5 rounded-full">{pendingRequests.length}</span>}
                    </button>
                    <button 
                        onClick={() => setMainTab('patients')}
                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${mainTab === 'patients' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        我的签约用户 
                        <div className="flex items-center gap-1">
                            <span className="text-xs">({signedPatients.length})</span>
                            {totalUnread > 0 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                        </div>
                    </button>
                </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
                {loading && !chatPatient ? (
                    <div className="text-center py-20 text-slate-400">加载中...</div>
                ) : (
                    <>
                        {/* WORKBOARD VIEW */}
                        {mainTab === 'workboard' && (
                            <div className="space-y-4">
                                {pendingRequests.length === 0 ? (
                                    <div className="text-center py-20 text-slate-400">暂无待处理申请</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {pendingRequests.map(req => (
                                            <div key={req.id} className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                                                            req.type === 'doctor_signing' ? 'bg-blue-100 text-blue-700' :
                                                            req.type === 'doctor_booking' ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'
                                                        }`}>
                                                            {req.type === 'doctor_signing' ? '签约申请' : req.type === 'doctor_booking' ? '挂号预约' : '药品预约'}
                                                        </span>
                                                        <div className="font-bold text-slate-800 mt-1">{req.userName}</div>
                                                    </div>
                                                    <div className="text-xs text-slate-400">{req.date}</div>
                                                </div>
                                                <div className="bg-slate-50 p-2 rounded text-xs text-slate-600 mb-4">
                                                    <div className="font-bold mb-1">目标: {req.targetName}</div>
                                                    <div>详情: {req.details}</div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleAudit(req.id, false)} className="flex-1 py-1.5 border border-slate-200 text-slate-500 rounded text-xs hover:bg-slate-50">拒绝</button>
                                                    <button onClick={() => handleAudit(req.id, true)} className="flex-1 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700">同意/确认</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* PATIENTS VIEW */}
                        {mainTab === 'patients' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {signedPatients.length === 0 ? (
                                    <div className="col-span-full text-center py-20 text-slate-400">暂无签约用户</div>
                                ) : signedPatients.map((item) => (
                                    <div key={item.interaction.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-white flex flex-col justify-between h-full relative">
                                        {/* Unread Badge on Card */}
                                        {(item.unread || 0) > 0 && (
                                            <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shadow-sm animate-pulse">
                                                {item.unread}
                                            </div>
                                        )}
                                        
                                        <div>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-lg font-bold text-slate-600">
                                                        {item.archive ? (item.archive.gender === '女' ? '👩' : '👨') : '👤'}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800 text-lg">
                                                            {item.archive?.name || item.interaction.userName}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            {item.archive ? `${item.archive.age}岁 · ${item.archive.department}` : `ID: ${item.interaction.userId}`}
                                                        </div>
                                                    </div>
                                                </div>
                                                {item.archive && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border mt-1 inline-block ${
                                                        item.archive.risk_level === 'RED' ? 'bg-red-50 text-red-600 border-red-200' :
                                                        item.archive.risk_level === 'YELLOW' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                                        'bg-green-50 text-green-600 border-green-200'
                                                    }`}>
                                                        {item.archive.risk_level === 'RED' ? '高风险' : item.archive.risk_level === 'YELLOW' ? '中风险' : '低风险'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
                                            <button 
                                                onClick={() => setChatPatient(item)}
                                                className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                                                    (item.unread || 0) > 0 ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                                }`}
                                            >
                                                💬 在线咨询 {(item.unread || 0) > 0 && '(新消息)'}
                                            </button>
                                            <div className="flex gap-2">
                                                {item.archive ? (
                                                    <>
                                                        <button 
                                                            onClick={() => onSelectPatient(item.archive!, 'assessment')}
                                                            className="flex-1 py-1.5 rounded text-xs font-bold bg-white border border-blue-200 text-blue-600 hover:bg-blue-50"
                                                        >
                                                            健康档案
                                                        </button>
                                                        <button 
                                                            onClick={() => onSelectPatient(item.archive!, 'followup')}
                                                            className="flex-1 py-1.5 rounded text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                                        >
                                                            随访管理
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button disabled className="flex-1 py-1.5 bg-slate-100 text-slate-400 text-xs rounded cursor-not-allowed">
                                                        档案未关联
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Chat Modal */}
            {chatPatient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[600px] animate-scaleIn">
                        <div className="bg-indigo-600 p-4 flex justify-between items-center text-white shadow-md">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg">
                                    {chatPatient.archive?.gender === '女' ? '👩' : '👨'}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{chatPatient.archive?.name || chatPatient.interaction.userName}</h3>
                                    <p className="text-xs opacity-80 flex items-center gap-1">
                                        <span className="w-2 h-2 bg-green-400 rounded-full"></span> 在线
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => { setChatPatient(null); loadData(); }} className="text-white/80 hover:text-white text-2xl font-bold">×</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                            {chatMessages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.senderRole === 'doctor' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                                        msg.senderRole === 'doctor' 
                                        ? 'bg-indigo-600 text-white rounded-br-none' 
                                        : 'bg-white text-slate-700 rounded-bl-none border border-slate-200'
                                    }`}>
                                        {msg.content}
                                        <div className={`text-[10px] mt-1 text-right ${msg.senderRole === 'doctor' ? 'text-indigo-200' : 'text-slate-400'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
                            <input 
                                className="flex-1 border border-slate-300 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="输入回复内容..."
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSendMsg()}
                            />
                            <button 
                                onClick={handleSendMsg}
                                className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-indigo-700 shadow-md active:scale-95 transition-transform"
                            >
                                ➤
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
