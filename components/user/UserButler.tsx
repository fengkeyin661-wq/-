import React, { useState, useEffect, useRef } from 'react';
import { HealthRecord, HealthAssessment, FollowUpRecord } from '../../types';
import { fetchContent, ContentItem } from '../../services/contentService';
import { getButlerChatResponse } from '../../services/geminiService';

interface Props {
    record: HealthRecord;
    assessment?: HealthAssessment;
    followUps?: FollowUpRecord[];
    onNavigate: (tab: string) => void;
}

interface Message {
    role: 'user' | 'ai';
    content: string;
    items?: ContentItem[];
    metric?: string;
}

export const UserButler: React.FC<Props> = ({ record, assessment, followUps = [], onNavigate }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isInit, setIsInit] = useState(false);
    const [resources, setResources] = useState<ContentItem[]>([]);
    
    const scrollRef = useRef<HTMLDivElement>(null);

    // 1. 获取中心全量资源（医生、方案、活动、文章等）
    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchContent();
                setResources(data);
            } catch (e) {
                console.error("加载资源失败", e);
            }
        };
        load();
    }, []);

    // 2. 主动干预：基于体检结果自动开启对话
    useEffect(() => {
        if (!isInit && record && resources.length > 0) {
            const abnormalities = record.checkup.abnormalities || [];
            let welcomeMsg = `您好，${record.profile.name}老师。我是您的专属 AI 健康管家。`;
            
            if (abnormalities.length > 0) {
                const mainIssue = abnormalities[0].item;
                welcomeMsg += `我已为您分析了最新的体检报告，发现您的 **${mainIssue}** 存在异常。我已针对性为您匹配了改善建议和中心服务，您可以点击卡片查看，或直接向我咨询。`;
            } else {
                welcomeMsg += `很高兴看到您的各项指标都在理想范围内！请问今天有什么我可以帮您的吗？`;
            }

            setMessages([{ role: 'ai', content: welcomeMsg }]);
            setIsInit(true);
        }
    }, [record, resources, isInit]);

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
            const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
            // 调用重构后的深度咨询接口
            const result = await getButlerChatResponse(userMsg, history, record, followUps, resources);

            const recommendedItems = result.recommendedItemIds 
                ? resources.filter(r => result.recommendedItemIds?.includes(r.id))
                : undefined;

            setMessages(prev => [...prev, { 
                role: 'ai', 
                content: result.reply, 
                items: recommendedItems,
                metric: result.focusMetric
            }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'ai', content: "抱歉，管家正在翻阅档案，请稍后再问我一次吧。" }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#F4F7F9] relative overflow-hidden">
            {/* 灵动岛顶栏 */}
            <div className="bg-white/80 backdrop-blur-xl px-6 py-4 flex justify-between items-center border-b border-slate-100 z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 bg-teal-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-teal-100">🤖</div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full animate-pulse"></span>
                    </div>
                    <div>
                        <h1 className="font-black text-slate-800 text-sm">AI 诊后干预助手</h1>
                        <p className="text-[10px] text-teal-600 font-bold tracking-tight">已同步体检与随访档案</p>
                    </div>
                </div>
                <button 
                    onClick={() => onNavigate('profile')} 
                    className="text-[10px] font-black text-teal-600 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-100 active:scale-95"
                >
                    我的档案
                </button>
            </div>

            {/* 对话列表 */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-slideUp`}>
                        <div className={`max-w-[88%] px-4 py-3 rounded-[1.5rem] shadow-sm text-sm leading-relaxed ${
                            msg.role === 'user' 
                            ? 'bg-teal-600 text-white rounded-tr-none font-medium' 
                            : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                        }`}>
                            {msg.content}
                            {msg.metric && (
                                <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] flex items-center gap-1 opacity-60">
                                    <span>🔍 针对指标:</span>
                                    <span className="font-bold text-teal-600">{msg.metric}</span>
                                </div>
                            )}
                        </div>
                        
                        {/* 混合推荐卡片组 */}
                        {msg.items && msg.items.length > 0 && (
                            <div className="mt-4 w-full animate-fadeIn overflow-hidden">
                                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-2 px-2 snap-x">
                                    {msg.items.map(item => (
                                        <RecommendationCard key={item.id} item={item} onNavigate={onNavigate} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                
                {isThinking && (
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold ml-2">
                        <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:0s]"></span>
                            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                        管家正在检索最佳方案...
                    </div>
                )}
            </div>

            {/* 输入栏 */}
            <div className="absolute bottom-24 left-0 w-full px-4 z-30">
                <div className="bg-white/90 backdrop-blur-xl p-2 rounded-[2rem] shadow-2xl border border-white flex gap-2 items-center">
                    <input 
                        className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none placeholder:text-slate-400 font-medium"
                        placeholder="您可以问：体检报告中的异常该如何调理？"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || isThinking}
                        className="w-12 h-12 bg-teal-600 text-white rounded-2xl flex items-center justify-center hover:bg-teal-700 disabled:opacity-30 transition-all active:scale-90 shadow-lg shadow-teal-100"
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

// 内部卡片组件，解决 TS2339 错误
const RecommendationCard: React.FC<{ item: ContentItem, onNavigate: (tab: string) => void }> = ({ item, onNavigate }) => {
    // 补全所有业务类型的标签映射
    const typeLabel: Record<string, string> = {
        'doctor': '专家门诊',
        'event': '线下活动',
        'meal': '膳食建议',
        'exercise': '运动方案',
        'drug': '常用药品',
        'service': '特色项目',
        'article': '健康科普',
        'circle': '打卡圈子'
    };

    const typeColor: Record<string, string> = {
        'doctor': 'bg-blue-50 text-blue-600',
        'event': 'bg-purple-50 text-purple-600',
        'meal': 'bg-orange-50 text-orange-600',
        'exercise': 'bg-green-50 text-green-600',
        'drug': 'bg-rose-50 text-rose-600',
        'service': 'bg-teal-50 text-teal-600',
        'article': 'bg-indigo-50 text-indigo-600',
        'circle': 'bg-amber-50 text-amber-600'
    };

    return (
        <div className="snap-start min-w-[180px] bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-3 group active:scale-95 transition-all">
            <div className="flex justify-between items-start">
                <div className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${typeColor[item.type] || 'bg-slate-50 text-slate-500'}`}>
                    {typeLabel[item.type] || '健康服务'}
                </div>
                <div className="text-2xl">{item.image || '✨'}</div>
            </div>
            
            <div className="flex-1">
                <h4 className="text-xs font-black text-slate-800 line-clamp-1">{item.title}</h4>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">
                    {item.description || item.details?.dept || '为您匹配的健康资源'}
                </p>
            </div>

            <button 
                onClick={() => {
                    if (['doctor', 'drug', 'service'].includes(item.type)) onNavigate('medical');
                    else if (['meal', 'exercise'].includes(item.type)) onNavigate('diet_motion');
                    else onNavigate('community');
                }}
                className="w-full bg-slate-900 text-white text-[10px] font-black py-2 rounded-xl shadow-sm"
            >
                立即查看
            </button>
        </div>
    );
};