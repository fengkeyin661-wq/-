import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HealthRecord, HealthAssessment } from '../../types';
import { fetchContent, ContentItem } from '../../services/contentService';
import { getButlerChatResponse } from '../../services/geminiService';

interface Props {
    record: HealthRecord;
    assessment?: HealthAssessment;
    onNavigate: (tab: string) => void;
}

export const UserButler: React.FC<Props> = ({ record, assessment, onNavigate }) => {
    const [messages, setMessages] = useState<{role: 'user'|'ai', content: string, items?: ContentItem[]}[]>([
        { role: 'ai', content: `你好，${record.profile.name}。我是你的 AI 健康管家。我会基于你的健康档案，为你提供专业的健康建议和中心资源推荐。今天有什么可以帮你的吗？` }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [allContent, setAllContent] = useState<ContentItem[]>([]);
    
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const load = async () => {
            const data = await fetchContent();
            setAllContent(data);
        };
        load();
    }, []);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        
        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const result = await getButlerChatResponse(
                userMsg, 
                messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
                record,
                allContent
            );

            // Match recommended items
            const recommendedItems = result.recommendedItemIds 
                ? allContent.filter(c => result.recommendedItemIds?.includes(c.id))
                : undefined;

            setMessages(prev => [...prev, { 
                role: 'ai', 
                content: result.reply, 
                items: recommendedItems 
            }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'ai', content: "管家开小差了，请稍后再试。" }]);
        } finally {
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 500); // Visual buffer
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#F0F2F5] relative overflow-hidden">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl px-6 py-4 flex justify-between items-center border-b border-slate-100 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-teal-100">🤖</div>
                    <div>
                        <h1 className="font-black text-slate-800">健康管家</h1>
                        <p className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                            已同步您的健康档案
                        </p>
                    </div>
                </div>
                <button onClick={() => onNavigate('profile')} className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">查看档案</button>
            </div>

            {/* Chat Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-slideUp`}>
                        <div className={`max-w-[85%] px-4 py-3 rounded-2xl shadow-sm text-sm ${
                            msg.role === 'user' 
                            ? 'bg-teal-600 text-white rounded-tr-none' 
                            : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                        }`}>
                            {msg.content}
                        </div>
                        
                        {/* Recommended Cards Block */}
                        {msg.items && msg.items.length > 0 && (
                            <div className="mt-3 w-full space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 ml-1">相关推荐资源：</p>
                                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                    {msg.items.map(item => (
                                        <div key={item.id} className="min-w-[140px] bg-white rounded-xl p-3 border border-slate-100 shadow-sm active:scale-95 transition-transform">
                                            <div className="text-2xl mb-1">{item.image || '✨'}</div>
                                            <div className="text-xs font-bold text-slate-800 line-clamp-1">{item.title}</div>
                                            <div className="text-[9px] text-slate-400 mt-0.5">{item.type === 'doctor' ? item.details?.title : item.tags[0]}</div>
                                            <button className="mt-2 w-full bg-slate-50 text-teal-600 text-[9px] font-black py-1 rounded-md border border-teal-50">查看详情</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs italic ml-2">
                        <div className="flex gap-1">
                            <span className="w-1 h-1 bg-slate-300 rounded-full animate-bounce"></span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                        管家正在翻阅档案...
                    </div>
                )}
            </div>

            {/* Input Bar */}
            <div className="absolute bottom-20 left-0 w-full px-4 pb-2 z-30">
                <div className="bg-white/90 backdrop-blur-xl p-2 rounded-full shadow-2xl border border-white flex gap-2 items-center">
                    <input 
                        className="flex-1 bg-transparent px-4 py-2 text-sm focus:outline-none placeholder:text-slate-400 font-medium"
                        placeholder="在此输入您的健康疑问..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="w-10 h-10 bg-teal-600 text-white rounded-full flex items-center justify-center hover:bg-teal-700 disabled:opacity-30 transition-all active:scale-90 shadow-lg shadow-teal-200"
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};