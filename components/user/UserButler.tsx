
import React, { useState, useEffect, useRef } from 'react';
import { HealthRecord, HealthAssessment } from '../../types';
import { fetchContent, ContentItem, saveInteraction } from '../../services/contentService';
import { chatWithHealthButler } from '../../services/geminiService';

interface Props {
    record: HealthRecord;
    assessment?: HealthAssessment;
    userId: string;
    onClose: () => void;
    onNavigate: (tab: string) => void;
}

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    recommendations?: string[];
}

export const UserButler: React.FC<Props> = ({ record, assessment, userId, onClose, onNavigate }) => {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'model', text: `您好，我是您的私人健康助手。我已经审阅了您的健康档案（目前风险：${assessment?.riskLevel === 'RED' ? '高风险' : assessment?.riskLevel === 'YELLOW' ? '中风险' : '低风险'}）。请问今天有什么可以帮您？` }
    ]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isListening, setIsListening] = useState(false); // 模拟语音交互
    const [resources, setResources] = useState<ContentItem[]>([]);
    
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchContent().then(setResources);
    }, []);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    const handleSend = async (textOverride?: string) => {
        const textToSend = textOverride || input;
        if (!textToSend.trim() || isThinking) return;
        
        setInput('');
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: textToSend }]);
        setIsThinking(true);

        // Prepare context
        const profileStr = `年龄:${record.profile.age}, 性别:${record.profile.gender}, 诊断:${assessment?.summary}, 风险点:${[...(assessment?.risks.red || []), ...(assessment?.risks.yellow || [])].join('/')}`;
        const resourceStr = resources.map(r => `[ID:${r.id},类型:${r.type},标题:${r.title},标签:${r.tags.join('/')}]`).join('; ');
        const history = messages.map(m => ({ role: m.role, text: m.text }));

        try {
            const aiRes = await chatWithHealthButler(textToSend, profileStr, resourceStr, history);
            setMessages(prev => [...prev, { 
                id: (Date.now()+1).toString(), 
                role: 'model', 
                text: aiRes.text,
                recommendations: aiRes.recommendations 
            }]);
        } catch (e) {
            setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'model', text: "非常抱歉，我的网络连接出现了一些状况。如有紧急健康疑问，请咨询在线医生。" }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleVoiceClick = () => {
        setIsListening(!isListening);
        if (!isListening) {
            // 模拟 2秒后停止录音并发送
            setTimeout(() => {
                setIsListening(false);
                handleSend("我最近感觉膝盖不太舒服，尿酸也有点偏高。");
            }, 2500);
        }
    };

    const handleAction = async (item: ContentItem) => {
        if (item.type === 'doctor') {
            onNavigate('interaction');
        } else if (item.type === 'drug') {
             if (confirm(`确定要预约购药【${item.title}】吗？`)) {
                 await saveInteraction({
                    id: `drug_${Date.now()}`, type: 'drug_order', userId, userName: record.profile.name,
                    targetId: item.id, targetName: item.title, status: 'pending', 
                    date: new Date().toISOString().split('T')[0], details: '由 AI 推荐预约'
                 });
                 alert("已加入购药计划！");
             }
        } else if (item.type === 'exercise') {
            onNavigate('diet_motion');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] backdrop-blur-sm flex flex-col animate-fadeIn">
            {/* Header */}
            <div className="bg-white/90 backdrop-blur-xl border-b border-slate-100 px-4 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-indigo-200">🤖</div>
                    <div>
                        <h3 className="font-black text-slate-800">AI 健康助手</h3>
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Consultant</span>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 font-bold bg-slate-50 rounded-full transition-colors active:scale-90">×</button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed ${
                            msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-br-none' 
                            : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
                        }`}>
                            {msg.text}
                        </div>
                        
                        {/* Recommendations Section */}
                        {msg.recommendations && msg.recommendations.length > 0 && (
                            <div className="mt-4 w-full space-y-3 animate-slideUp">
                                <div className="flex items-center gap-2 pl-1 mb-1">
                                    <div className="h-px w-4 bg-slate-200"></div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">智能管家为您匹配:</p>
                                </div>
                                <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide px-1 snap-x">
                                    {msg.recommendations.map(id => {
                                        const item = resources.find(r => r.id === id);
                                        if (!item) return null;
                                        return <RecommendationCard key={id} item={item} onAction={() => handleAction(item)} />;
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {isThinking && (
                    <div className="flex items-start gap-2">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center animate-pulse shadow-sm">🤖</div>
                        <div className="bg-white px-4 py-2 rounded-2xl rounded-tl-none border border-slate-100 text-slate-400 text-xs italic flex items-center gap-2">
                            <span className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-100"></span>
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-200"></span>
                            </span>
                            正在查阅医学百科与您的档案...
                        </div>
                    </div>
                )}
                <div ref={scrollRef} className="h-10" />
            </div>

            {/* Input Bar with Voice UI */}
            <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                {isListening && (
                    <div className="mb-4 flex flex-col items-center animate-fadeIn">
                        <div className="flex gap-1 items-end h-8 mb-2">
                            {[1,2,3,4,5,6,5,4,3,2].map((h, i) => (
                                <div key={i} className="w-1 bg-indigo-500 rounded-full animate-pulse-height" style={{ height: `${h * 10}%`, animationDelay: `${i * 0.1}s` }}></div>
                            ))}
                        </div>
                        <p className="text-[10px] text-indigo-600 font-bold animate-pulse">正在倾听您的描述...</p>
                    </div>
                )}
                
                <div className="flex gap-2 items-center">
                    <button 
                        onClick={handleVoiceClick}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md active:scale-90 transition-all ${
                            isListening ? 'bg-red-500 text-white ring-4 ring-red-100 animate-pulse' : 'bg-slate-100 text-slate-600'
                        }`}
                    >
                        {isListening ? '⏹️' : '🎙️'}
                    </button>
                    
                    <div className="flex-1 flex gap-2 items-center bg-slate-100 rounded-2xl px-4 py-1.5 border border-slate-200">
                        <input 
                            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-slate-400 font-medium"
                            placeholder={isListening ? "请说话..." : "输入您的健康困惑..."}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            disabled={isListening}
                        />
                        <button 
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isThinking || isListening}
                            className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 active:scale-90 transition-all disabled:opacity-50"
                        >
                            ➤
                        </button>
                    </div>
                </div>
                
                <div className="mt-4 flex overflow-x-auto gap-2 pb-1 scrollbar-hide">
                     {["膝盖疼", "尿酸高", "适合我的食谱", "体检报告解读", "最近失眠"].map(tag => (
                         <button key={tag} onClick={() => handleSend(tag)} className="text-[10px] bg-slate-50 text-slate-500 px-3 py-1.5 rounded-full border border-slate-200 whitespace-nowrap hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-colors">
                             {tag}
                         </button>
                     ))}
                </div>
            </div>
        </div>
    );
};

// Sub-component: Recommendation Card (Enhanced styles per request)
const RecommendationCard: React.FC<{ item: ContentItem, onAction: () => void | Promise<void> }> = ({ item, onAction }) => {
    const isDoc = item.type === 'doctor';
    const isDrug = item.type === 'drug'; // Commodity
    const isEx = item.type === 'exercise'; // Course

    return (
        <div className="snap-start min-w-[240px] max-w-[240px] bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden group">
            {/* Image/Visual Area */}
            <div className={`h-32 flex items-center justify-center text-5xl relative overflow-hidden ${isDoc ? 'bg-blue-50' : isDrug ? 'bg-orange-50' : 'bg-green-50'}`}>
                {isDoc ? '👨‍⚕️' : isDrug ? '🍱' : '🏃'}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors"></div>
                {/* Badge */}
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-white/80 backdrop-blur-md text-[9px] font-black uppercase text-slate-500 shadow-sm">
                    {isDoc ? '专家' : isDrug ? '限时' : 'HOT'}
                </div>
            </div>

            {/* Content Area */}
            <div className="p-4 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-1">
                    <h4 className="font-black text-slate-800 text-sm truncate flex-1">{item.title}</h4>
                    {isDrug && <span className="text-orange-600 font-black text-xs">¥{item.details?.price || '99'}</span>}
                </div>
                
                {/* Meta Metadata based on type */}
                <div className="space-y-1 mb-4">
                    {isDoc && (
                        <p className="text-[10px] text-blue-600 font-bold flex items-center gap-1">
                            <span className="w-1 h-1 bg-blue-600 rounded-full"></span>
                            擅长: {item.details?.title || '全科医学专家'}
                        </p>
                    )}
                    {isDrug && (
                        <p className="text-[10px] text-orange-600 font-bold flex items-center gap-1">
                            <span className="w-1 h-1 bg-orange-600 rounded-full"></span>
                            适用: {item.details?.target || '尿酸偏高人群'}
                        </p>
                    )}
                    {isEx && (
                        <div className="flex gap-2">
                             <p className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                🕒 {item.details?.duration || '15'}min
                            </p>
                            <p className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                                🔥 {item.details?.cal || '120'}kcal
                            </p>
                        </div>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 min-h-[2.4em] leading-relaxed">
                        {item.description}
                    </p>
                </div>

                {/* Bottom Action */}
                <button 
                    onClick={(e) => { e.stopPropagation(); onAction(); }}
                    className={`w-full py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 ${
                        isDoc ? 'bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700' : 
                        isDrug ? 'bg-orange-500 text-white shadow-orange-100 hover:bg-orange-600' : 
                        'bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800'
                    }`}
                >
                    {isDoc ? '🏥 立即预约' : isDrug ? '🛒 加入购药' : '⚡ 开始训练'}
                </button>
            </div>
        </div>
    );
}
