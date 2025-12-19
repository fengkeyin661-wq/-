import React, { useState, useEffect, useRef } from 'react';
import { HealthRecord, HealthAssessment } from '../../types';
import { fetchContent, ContentItem, saveInteraction } from '../../services/contentService';
import { chatWithDeepSeekButler } from '../../services/deepseekService';

interface Props {
    record: HealthRecord;
    assessment?: HealthAssessment;
    userId: string;
    onClose: () => void;
    onNavigate: (tab: string) => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    recommendations?: string[];
}

export const UserButler: React.FC<Props> = ({ record, assessment, userId, onClose, onNavigate }) => {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', text: `您好 ${record.profile.name}，我是您的 AI 健康管家。我已经同步了您最新的体检数据（${assessment?.riskLevel === 'RED' ? '高风险' : '正常'}），DeepSeek 引擎已就绪，请问有什么可以帮您？` }
    ]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [resources, setResources] = useState<ContentItem[]>([]);
    
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchContent().then(setResources);
    }, []);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    const handleSend = async (textOverride?: string) => {
        const userMsg = textOverride || input;
        if (!userMsg.trim() || isThinking) return;
        
        setInput('');
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userMsg }]);
        setIsThinking(true);

        const profileStr = `年龄:${record.profile.age}, 风险:${assessment?.riskLevel}, 评估:${assessment?.summary}`;
        const resourceStr = resources.map(r => `[ID:${r.id},类型:${r.type},标题:${r.title}]`).join(';');
        const history = messages.map(m => ({ role: m.role, content: m.text }));

        try {
            const aiRes = await chatWithDeepSeekButler(userMsg, profileStr, resourceStr, history);
            setMessages(prev => [...prev, { 
                id: (Date.now()+1).toString(), 
                role: 'assistant', 
                text: aiRes.text,
                recommendations: aiRes.recommendations 
            }]);
        } catch (e) {
            setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'assistant', text: "DeepSeek 响应异常，请检查 API 配置。" }]);
        } finally {
            setIsThinking(false);
        }
    };

    const toggleVoice = () => {
        setIsListening(!isListening);
        if (!isListening) {
            setTimeout(() => {
                setIsListening(false);
                handleSend("我最近经常感觉头晕，是不是血压不稳？");
            }, 2500);
        }
    };

    const handleAction = async (item: ContentItem) => {
        if (item.type === 'doctor') onNavigate('interaction'); 
        else if (item.type === 'drug') onNavigate('medical');
        else if (item.type === 'exercise') onNavigate('diet_motion');
        // Fix: Removed non-existent setSelectedItem(null);
    };

    return (
        <div className="fixed inset-0 bg-slate-100 z-[100] flex flex-col animate-slideUp">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 px-5 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-xl shadow-lg">🤖</div>
                    <div>
                        <h3 className="font-black text-slate-800 text-sm">AI 健康管家</h3>
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Powered by DeepSeek-V3</span>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-900 font-bold bg-slate-50 rounded-full">×</button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                            msg.role === 'user' 
                            ? 'bg-slate-900 text-white rounded-br-none' 
                            : 'bg-white text-slate-700 rounded-bl-none border border-slate-200/50'
                        }`}>
                            {msg.text}
                        </div>
                        {msg.recommendations && msg.recommendations.length > 0 && (
                            <div className="mt-4 w-full space-y-3 animate-fadeIn">
                                <p className="text-[10px] text-slate-400 font-black uppercase pl-1">智能引擎精准匹配</p>
                                <div className="flex overflow-x-auto gap-4 pb-2 px-1 scrollbar-hide">
                                    {msg.recommendations.map(id => {
                                        const item = resources.find(r => r.id === id);
                                        if (!item) return null;
                                        return <ButlerCard key={id} item={item} onAction={() => handleAction(item)} />;
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {isThinking && (
                    <div className="flex items-start gap-2 animate-pulse">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-xs">🤖</div>
                        <div className="bg-white px-4 py-2 rounded-2xl text-slate-400 text-xs italic">
                            DeepSeek 正在深入分析您的健康档案...
                        </div>
                    </div>
                )}
                <div ref={scrollRef} className="h-10" />
            </div>

            {/* Interaction Bar */}
            <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
                {isListening && (
                    <div className="mb-4 flex flex-col items-center">
                        <div className="flex gap-1 h-8 items-end mb-2">
                           {[...Array(12)].map((_, i) => (
                               <div key={i} className="w-1 bg-blue-500 rounded-full animate-voice-wave" style={{height: `${Math.random()*100}%`, animationDelay: `${i*0.05}s`}}></div>
                           ))}
                        </div>
                        <p className="text-[10px] text-blue-600 font-black animate-pulse">DeepSeek 正在倾听...</p>
                    </div>
                )}
                <div className="flex gap-3 items-center">
                    <button onClick={toggleVoice} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isListening ? 'bg-red-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>
                        {isListening ? '⏹' : '🎙️'}
                    </button>
                    <div className="flex-1 bg-slate-100 rounded-2xl px-4 py-1 flex items-center">
                        <input className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-slate-400 font-medium" placeholder={isListening ? "请说话..." : "输入健康疑问..."} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} disabled={isListening} />
                        <button onClick={() => handleSend()} disabled={!input.trim() || isThinking} className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 disabled:opacity-30">➤</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ButlerCard: React.FC<{ item: ContentItem, onAction: () => void }> = ({ item, onAction }) => (
    <div className="snap-start min-w-[200px] bg-white rounded-2xl border border-slate-100 shadow-lg flex flex-col overflow-hidden">
        <div className="h-24 bg-blue-50 flex items-center justify-center text-4xl">{item.type === 'doctor' ? '👨‍⚕️' : item.type === 'drug' ? '💊' : '🏃'}</div>
        <div className="p-3 flex-1 flex flex-col justify-between">
            <h4 className="font-bold text-slate-800 text-xs truncate">{item.title}</h4>
            <button onClick={onAction} className="w-full mt-2 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg">查看详情</button>
        </div>
    </div>
);