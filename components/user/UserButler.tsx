import React, { useState, useEffect, useRef } from 'react';
import { HealthRecord, HealthAssessment } from '../../types';
import { fetchContent, ContentItem } from '../../services/contentService';
import { getButlerChatResponse } from '../../services/geminiService';

interface Props {
    record: HealthRecord;
    assessment?: HealthAssessment;
    onNavigate: (tab: string) => void;
}

export const UserButler: React.FC<Props> = ({ record, assessment, onNavigate }) => {
    const [messages, setMessages] = useState<{role: 'user'|'ai', content: string, items?: ContentItem[]}[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [allContent, setAllContent] = useState<ContentItem[]>([]);
    const [isInit, setIsInit] = useState(false);
    
    const scrollRef = useRef<HTMLDivElement>(null);

    // 1. 加载资源库
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await fetchContent();
                setAllContent(data);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    // 2. 自动发起针对性咨询 (诊后主动干预)
    useEffect(() => {
        if (!isInit && !isLoading && record && record.profile.name) {
            const abnormalities = record.checkup.abnormalities || [];
            const abnormalSummary = abnormalities.length > 0 
                ? abnormalities.map(a => a.item).join('、')
                : "";
            
            let initialMsg = `您好，${record.profile.name}老师。我是您的专属 AI 健康管家。`;
            
            if (abnormalities.length > 0) {
                initialMsg += `我已仔细查阅了您的最新体检报告，发现您的 **${abnormalSummary}** 等指标存在异常。为了帮您科学管理这些问题，您可以咨询我如何调整饮食、运动或了解复查建议。`;
            } else {
                initialMsg += `您的体检指标目前都在理想范围内，请继续保持！今天有什么我可以为您服务的吗？`;
            }

            setMessages([{ role: 'ai', content: initialMsg }]);
            setIsInit(true);
        }
    }, [record, isInit, isLoading]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isThinking]);

    const handleSend = async () => {
        if (!input.trim() || isThinking) return;
        
        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsThinking(true);

        try {
            const result = await getButlerChatResponse(
                userMsg, 
                messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
                record,
                allContent
            );

            const recommendedItems = result.recommendedItemIds 
                ? allContent.filter(c => result.recommendedItemIds?.includes(c.id))
                : undefined;

            setMessages(prev => [...prev, { 
                role: 'ai', 
                content: result.reply, 
                items: recommendedItems 
            }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'ai', content: "管家稍微走神了，请再问我一次吧。" }]);
        } finally {
            setIsThinking(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-[#F5F7FA]">
                <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-400 text-xs font-bold">管家正在为您翻阅健康档案...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#F5F7FA] relative overflow-hidden">
            {/* 顶栏 */}
            <div className="bg-white/80 backdrop-blur-xl px-6 py-4 flex justify-between items-center border-b border-slate-100 z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-teal-100">🤖</div>
                    <div>
                        <h1 className="font-black text-slate-800 text-sm">健康管理中心</h1>
                        <p className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                            AI 诊后干预模式
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => onNavigate('profile')} 
                    className="text-[10px] font-black text-teal-600 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-100"
                >
                    我的档案
                </button>
            </div>

            {/* 对话列表 */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-slideUp`}>
                        <div className={`max-w-[85%] px-4 py-3 rounded-[1.5rem] shadow-sm text-sm leading-relaxed ${
                            msg.role === 'user' 
                            ? 'bg-teal-600 text-white rounded-tr-none font-medium' 
                            : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                        }`}>
                            {msg.content}
                        </div>
                        
                        {/* 资源推荐卡片 */}
                        {msg.items && msg.items.length > 0 && (
                            <div className="mt-3 w-full animate-fadeIn">
                                <p className="text-[10px] font-black text-slate-400 ml-2 mb-2 uppercase tracking-widest">相关管理方案推荐</p>
                                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-2 px-2">
                                    {msg.items.map(item => (
                                        <div key={item.id} className="min-w-[150px] bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-95 transition-transform flex flex-col items-center text-center">
                                            <div className="text-4xl mb-3">{item.image || '✨'}</div>
                                            <div className="text-xs font-black text-slate-800 line-clamp-1">{item.title}</div>
                                            <div className="text-[9px] text-slate-400 mt-1 mb-3">{item.type === 'doctor' ? item.details?.dept : item.tags[0]}</div>
                                            <button className="w-full bg-teal-600 text-white text-[10px] font-black py-2 rounded-xl shadow-sm">立即查看</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                
                {isThinking && (
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold ml-2 animate-pulse">
                        <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:0s]"></span>
                            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                        管家正在分析档案数据...
                    </div>
                )}
            </div>

            {/* 输入栏 */}
            <div className="absolute bottom-24 left-0 w-full px-4 z-30">
                <div className="bg-white/90 backdrop-blur-xl p-2 rounded-[2rem] shadow-2xl border border-white flex gap-2 items-center">
                    <input 
                        className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none placeholder:text-slate-400 font-medium"
                        placeholder="关于体检报告或健康问题，请问我..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || isThinking}
                        className="w-12 h-12 bg-teal-600 text-white rounded-2xl flex items-center justify-center hover:bg-teal-700 disabled:opacity-30 transition-all active:scale-90 shadow-lg shadow-teal-100 shrink-0"
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};