
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
            markAsRead(userId, signedDoctor.targetId).then(() => {
                if(onMessageRead) onMessageRead();
            });
            interval = setInterval(() => {
                loadMessages();
                markAsRead(userId, signedDoctor.targetId).then(() => {
                    if(onMessageRead) onMessageRead();
                });
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [signedDoctor]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const loadData = async () => {
        const allInteractions = await fetchInteractions();
        const signing = allInteractions.find(i => i.type === 'signing' && i.userId === userId && i.status === 'confirmed');
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

    return (
        <div className="bg-slate-50 h-full flex flex-col">
            {/* Header */}
            <div className="bg-white px-6 py-4 shadow-sm z-10">
                <h1 className="text-xl font-black text-slate-800 tracking-tight">医生咨询</h1>
                <p className="text-xs text-slate-500 font-medium">专属家庭医生在线服务</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-20">
                {signedDoctor ? (
                    <>
                        {/* Chat Header Card */}
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4 flex items-center justify-between shrink-0 sticky top-0 z-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-2xl">👨‍⚕️</div>
                                <div>
                                    <h3 className="font-bold text-blue-800">{signedDoctor.targetName} 医生</h3>
                                    <p className="text-xs text-blue-600 mt-0.5">专属家庭医生 · 24h响应</p>
                                </div>
                            </div>
                        </div>

                        {/* Chat History */}
                        <div className="space-y-4 mb-4">
                            {chatMessages.length === 0 && (
                                <div className="text-center text-xs text-slate-400 mt-10">暂无消息，向医生问个好吧~</div>
                            )}
                            {chatMessages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.senderRole === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                                        msg.senderRole === 'user' 
                                        ? 'bg-teal-600 text-white rounded-br-none' 
                                        : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
                                    }`}>
                                        {msg.content}
                                        <div className={`text-[10px] mt-1 text-right ${msg.senderRole === 'user' ? 'text-teal-200' : 'text-slate-400'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center pb-20">
                        <div className="text-6xl mb-4 opacity-50">👨‍⚕️</div>
                        <h3 className="text-lg font-bold text-slate-600">尚未签约家庭医生</h3>
                        <p className="text-sm mt-2 max-w-[200px]">请前往“寻医问药”板块查看医生并申请签约。</p>
                    </div>
                )}
            </div>

            {/* Input Area (Only if signed) */}
            {signedDoctor && (
                <div className="bg-white p-3 border-t border-slate-100 flex gap-2 fixed bottom-20 left-0 w-full max-w-md mx-auto z-20">
                    <input 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-sm shadow-inner focus:ring-2 focus:ring-teal-500 outline-none"
                        placeholder="请输入咨询问题..."
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendMsg()}
                    />
                    <button 
                        onClick={handleSendMsg}
                        className="bg-teal-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-teal-700 shadow-md active:scale-95 transition-transform"
                    >
                        ➤
                    </button>
                </div>
            )}
        </div>
    );
};
