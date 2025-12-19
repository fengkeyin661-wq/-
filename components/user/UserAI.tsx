
import React, { useState, useEffect, useRef } from 'react';
import { HealthRecord, FollowUpRecord } from '../../types';
import { ContentItem, fetchContent } from '../../services/contentService';
import { chatWithHealthAssistant } from '../../services/geminiService';

interface Props {
    record: HealthRecord;
    followUps: FollowUpRecord[];
    onNavigate: (tab: string, params?: any) => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant'; // Changed from 'model' to 'assistant' to match OpenAI standard used by DeepSeek
    text: string;
    recommendations?: ContentItem[];
    timestamp: Date;
}

export const UserAI: React.FC<Props> = ({ record, followUps, onNavigate }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [resources, setResources] = useState<ContentItem[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const init = async () => {
            const all = await fetchContent();
            setResources(all);
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                text: `你好，${record.profile.name}老师！我是您的专属健康助手“副驾驶”。我已经分析了您最近的体检报告，发现您的${record.checkup.abnormalities.slice(0,2).map(a => a.item).join('和')}需要持续关注。今天有什么我可以帮您的吗？`,
                timestamp: new Date()
            }]);
        };
        init();
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;
        
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: input,
            timestamp: new Date()
        };
        
        setMessages(prev => [...prev, userMsg]);
        const currentInput = input;
        setInput('');
        setIsTyping(true);

        try {
            // Map messages to DeepSeek API format
            const history = messages.map(m => ({
                role: m.role,
                content: m.text
            }));

            const result = await chatWithHealthAssistant(currentInput, history, {
                record,
                followUps,
                availableResources: resources
            });

            const recommendedItems = resources.filter(r => 
                result.recommendedResourceIds?.includes(r.id)
            );

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: result.reply,
                recommendations: recommendedItems,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (e) {
            setMessages(prev => [...prev, {
                id: 'err',
                role: 'assistant',
                text: '抱歉，我现在无法处理您的请求，请稍后再试。',
                timestamp: new Date()
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md p-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    🪄
                </div>
                <div>
                    <h1 className="font-black text-slate-800">健康副驾驶</h1>
                    <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">DeepSeek Powered</span>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((m) => (
                    <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${
                            m.role === 'user' 
                            ? 'bg-teal-600 text-white rounded-tr-sm' 
                            : 'bg-white text-slate-700 rounded-tl-sm border border-slate-100'
                        }`}>
                            {m.text}
                        </div>
                        
                        {m.recommendations && m.recommendations.length > 0 && (
                            <div className="w-full mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                                {m.recommendations.map(res => (
                                    <div 
                                        key={res.id}
                                        onClick={() => onNavigate(res.type === 'meal' ? 'diet_motion' : res.type === 'doctor' ? 'medical' : 'community')}
                                        className="min-w-[140px] bg-white border border-teal-100 p-3 rounded-xl shadow-md active:scale-95 transition-transform"
                                    >
                                        <div className="text-2xl mb-1">{res.image || '✨'}</div>
                                        <div className="font-bold text-xs text-slate-800 line-clamp-1">{res.title}</div>
                                        <div className="text-[9px] text-slate-400 mt-1 line-clamp-1">{res.description}</div>
                                        <button className="mt-2 w-full bg-teal-50 text-teal-600 text-[9px] font-bold py-1 rounded">查看详情</button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <span className="text-[9px] text-slate-300 mt-1 px-1">
                            {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs italic">
                        <span className="animate-bounce">●</span>
                        <span className="animate-bounce delay-75">●</span>
                        <span className="animate-bounce delay-150">●</span>
                        副驾驶正在为您规划方案...
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                <div className="flex gap-2 items-center bg-slate-100 rounded-2xl p-1.5 pr-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-500 transition-all">
                    <input 
                        className="flex-1 bg-transparent px-4 py-2 text-sm outline-none placeholder:text-slate-400"
                        placeholder="咨询健康问题或获取方案建议..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="w-10 h-10 bg-teal-600 text-white rounded-xl flex items-center justify-center shadow-lg disabled:opacity-50 active:scale-90 transition-all"
                    >
                        ➤
                    </button>
                </div>
                <div className="flex gap-3 mt-3 px-1 overflow-x-auto scrollbar-hide">
                    {['最近检查建议', '推荐健康餐', '专家咨询', '本周活动'].map(q => (
                        <button 
                            key={q} 
                            onClick={() => { setInput(q); }}
                            className="text-[10px] whitespace-nowrap bg-white border border-slate-200 px-3 py-1 rounded-full text-slate-500 hover:border-teal-500 hover:text-teal-600"
                        >
                            {q}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
