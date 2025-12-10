
import React, { useState, useEffect, useRef } from 'react';
import { fetchInteractions, InteractionItem, ChatMessage, fetchMessages, sendMessage, markAsRead, getUnreadCount } from '../../services/contentService';
import { HealthArchive } from '../../services/dataService';

interface Props {
    userId: string;
    archive?: HealthArchive;
    onMessageRead?: () => void;
}

interface DoctorWithUnread {
    interaction: InteractionItem;
    unread: number;
}

export const UserInteraction: React.FC<Props> = ({ userId, archive, onMessageRead }) => {
    // New State: List of signed doctors
    const [doctorList, setDoctorList] = useState<DoctorWithUnread[]>([]);
    // New State: Currently active doctor for chat
    const [activeDoctor, setActiveDoctor] = useState<InteractionItem | null>(null);
    
    // Chat state
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadDoctors();
    }, []);

    // Polling for updates (list unread counts OR active chat messages)
    useEffect(() => {
        let interval: any;
        
        const poll = () => {
            if (activeDoctor) {
                // If chatting, refresh messages
                loadMessages();
                markAsRead(userId, activeDoctor.targetId).then(() => { if(onMessageRead) onMessageRead(); });
            } else {
                // If in list view, refresh doctor list to update unread counts
                loadDoctors();
            }
        };

        // Initial call
        poll();
        
        interval = setInterval(poll, 3000);
        return () => clearInterval(interval);
    }, [activeDoctor]); // Re-run effect when activeDoctor changes

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const loadDoctors = async () => {
        const allInteractions = await fetchInteractions();
        // Filter confirmed doctor signings
        const signings = allInteractions.filter(i => i.type === 'doctor_signing' && i.userId === userId && i.status === 'confirmed');
        
        // Calculate unread for each
        const listWithCount: DoctorWithUnread[] = [];
        for (const sign of signings) {
            const count = await getUnreadCount(userId, sign.targetId);
            listWithCount.push({ interaction: sign, unread: count });
        }
        
        setDoctorList(listWithCount);

        // Auto-select if only 1 doctor and not currently selected (optional, but good UX for single-doctor users)
        if (listWithCount.length === 1 && !activeDoctor) {
            setActiveDoctor(listWithCount[0].interaction);
        }
    };

    const loadMessages = async () => {
        if (!activeDoctor) return;
        const msgs = await fetchMessages(userId, activeDoctor.targetId);
        setChatMessages(msgs);
    };

    const handleSendMsg = async () => {
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

    const handleBackToList = () => {
        setActiveDoctor(null);
        setChatMessages([]);
        loadDoctors(); // Refresh list to update unread status
    };

    // --- RENDER: LIST VIEW ---
    if (!activeDoctor) {
        if (doctorList.length === 0) {
            return (
                <div className="h-full flex flex-col items-center justify-center bg-slate-50 text-center px-6">
                    <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center text-4xl mb-6 grayscale opacity-50">👨‍⚕️</div>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">暂无家庭医生</h3>
                    <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                        签约家庭医生后，您可以在此进行一对一健康咨询。请前往“医疗”板块申请。
                    </p>
                </div>
            );
        }

        return (
            <div className="h-full bg-slate-50 flex flex-col">
                <div className="bg-white px-6 py-4 border-b border-slate-100 shadow-sm sticky top-0 z-10">
                    <h1 className="text-xl font-bold text-slate-800">我的咨询列表</h1>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto">
                    {doctorList.map(item => (
                        <div 
                            key={item.interaction.id}
                            onClick={() => setActiveDoctor(item.interaction)}
                            className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:bg-blue-50 transition-colors active:scale-[0.98] relative"
                        >
                            <div className="relative">
                                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-2xl shadow-inner border-2 border-white">
                                    👨‍⚕️
                                </div>
                                {item.unread > 0 && (
                                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold border-2 border-white animate-pulse">
                                        {item.unread}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                    <h3 className="font-bold text-slate-800 text-lg">{item.interaction.targetName}</h3>
                                    <span className="text-[10px] text-slate-400">刚刚</span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-1">点击进入咨询...</p>
                            </div>
                            <div className="text-slate-300">›</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // --- RENDER: CHAT VIEW ---
    return (
        <div className="bg-[#F0F2F5] h-full flex flex-col relative">
            {/* Header */}
            <div className="bg-white/90 backdrop-blur-md px-4 py-3 shadow-sm z-10 flex items-center gap-3 border-b border-slate-100">
                <button 
                    onClick={handleBackToList}
                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                >
                    ←
                </button>
                <div className="relative">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg shadow-inner">👨‍⚕️</div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                </div>
                <div>
                    <h1 className="text-base font-bold text-slate-800">{activeDoctor.targetName} 医生</h1>
                    <p className="text-[10px] text-green-600 font-medium">在线</p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
                <div className="text-center text-[10px] text-slate-400 my-4 bg-slate-200/50 py-1 px-3 rounded-full mx-auto w-fit">
                    仅提供健康咨询，急诊请及时就医
                </div>
                
                {chatMessages.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs mt-10">
                        暂无消息，打个招呼吧 👋
                    </div>
                ) : (
                    chatMessages.map(msg => {
                        const isMe = msg.senderRole === 'user';
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] px-4 py-3 text-sm shadow-sm ${
                                    isMe 
                                    ? 'bg-teal-600 text-white rounded-2xl rounded-tr-sm' 
                                    : 'bg-white text-slate-800 rounded-2xl rounded-tl-sm border border-slate-100'
                                }`}>
                                    <p className="leading-relaxed">{msg.content}</p>
                                    <div className={`text-[9px] mt-1 text-right ${isMe ? 'text-teal-200' : 'text-slate-300'}`}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="absolute bottom-20 left-0 w-full px-4 pb-2">
                <div className="bg-white p-2 rounded-full shadow-lg border border-slate-100 flex gap-2 items-center">
                    <input 
                        className="flex-1 bg-transparent px-4 py-2 text-sm focus:outline-none placeholder:text-slate-400"
                        placeholder="输入消息..."
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendMsg()}
                    />
                    <button 
                        onClick={handleSendMsg}
                        disabled={!chatInput.trim()}
                        className="w-9 h-9 bg-teal-600 text-white rounded-full flex items-center justify-center hover:bg-teal-700 disabled:opacity-50 disabled:bg-slate-300 transition-all active:scale-90"
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
