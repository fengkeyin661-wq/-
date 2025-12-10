
import React, { useState, useEffect, useRef } from 'react';
import { fetchInteractions, InteractionItem, ChatMessage, fetchMessages, sendMessage, markAsRead } from '../../services/contentService';
import { HealthArchive } from '../../services/dataService';

interface Props {
    userId: string;
    archive?: HealthArchive;
    onMessageRead?: () => void;
}

export const UserInteraction: React.FC<Props> = ({ userId, archive, onMessageRead }) => {
    const [signedDoctor, setSignedDoctor] = useState<InteractionItem | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        let interval: any;
        if (signedDoctor) {
            loadMessages();
            markAsRead(userId, signedDoctor.targetId).then(() => { if(onMessageRead) onMessageRead(); });
            interval = setInterval(() => {
                loadMessages();
                markAsRead(userId, signedDoctor.targetId).then(() => { if(onMessageRead) onMessageRead(); });
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [signedDoctor]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const loadData = async () => {
        const allInteractions = await fetchInteractions();
        const signing = allInteractions.find(i => i.type === 'doctor_signing' && i.userId === userId && i.status === 'confirmed');
        setSignedDoctor(signing || null);
    };

    const loadMessages = async () => {
        if (!signedDoctor) return;
        const msgs = await fetchMessages(userId, signedDoctor.targetId);
        setChatMessages(msgs);
    };

    const handleSendMsg = async () => {
        if (!signedDoctor || !chatInput.trim()) return;
        await sendMessage({
            senderId: userId,
            senderRole: 'user',
            receiverId: signedDoctor.targetId,
            content: chatInput
        });
        setChatInput('');
        loadMessages();
    };

    if (!signedDoctor) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-50 text-center px-6">
                <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center text-4xl mb-6 grayscale opacity-50">👨‍⚕️</div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">暂无家庭医生</h3>
                <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                    签约家庭医生后，您可以在此进行一对一健康咨询。请前往“寻医问药”板块申请。
                </p>
            </div>
        );
    }

    return (
        <div className="bg-[#F0F2F5] h-full flex flex-col relative">
            {/* Header */}
            <div className="bg-white/90 backdrop-blur-md px-6 py-4 shadow-sm z-10 flex items-center gap-3 border-b border-slate-100">
                <div className="relative">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg shadow-inner">👨‍⚕️</div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                </div>
                <div>
                    <h1 className="text-base font-bold text-slate-800">{signedDoctor.targetName} 医生</h1>
                    <p className="text-[10px] text-green-600 font-medium">在线</p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
                <div className="text-center text-[10px] text-slate-400 my-4 bg-slate-200/50 py-1 px-3 rounded-full mx-auto w-fit">
                    仅提供健康咨询，急诊请及时就医
                </div>
                
                {chatMessages.map(msg => {
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
                })}
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