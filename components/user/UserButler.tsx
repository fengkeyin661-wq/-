
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
        { id: '1', role: 'model', text: `您好 ${record.profile.name}，我是您的私人健康助理。我已经根据您 ${record.profile.checkupDate || '近期'} 的体检数据（${assessment?.riskLevel === 'RED' ? '高风险' : '一般风险'}）为您定制了回复策略。请问您今天感觉如何？` }
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

        const profileStr = `年龄:${record.profile.age}, 性别:${record.profile.gender}, 诊断:${assessment?.summary}, 风险:${[...(assessment?.risks.red || []), ...(assessment?.risks.yellow || [])].join('/')}`;
        const resourceStr = resources.map(r => `[ID:${r.id},类型:${r.type},标题:${r.title}]`).join(';');
        const history = messages.map(m => ({ role: m.role, text: m.text }));

        try {
            const aiRes = await chatWithHealthButler(userMsg, profileStr, resourceStr, history);
            setMessages(prev => [...prev, { 
                id: (Date.now()+1).toString(), 
                role: 'model', 
                text: aiRes.text,
                recommendations: aiRes.recommendations 
            }]);
        } catch (e) {
            setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'model', text: "抱歉，由于咨询人数较多，请稍后再试。" }]);
        } finally {
            setIsThinking(false);
        }
    };

    const toggleVoice = () => {
        setIsListening(!isListening);
        if (!isListening) {
            // 模拟语音识别
            setTimeout(() => {
                setIsListening(false);
                handleSend("我最近感觉膝盖不舒服，体检结果说有尿酸高。");
            }, 2500);
        }
    };

    const handleAction = async (item: ContentItem) => {
        if (item.type === 'doctor') {
            onNavigate('interaction'); 
        } else if (item.type === 'drug') {
             if (confirm(`确定要加入购药计划【${item.title}】吗？`)) {
                 await saveInteraction({
                    id: `butler_drug_${Date.now()}`, type: 'drug_order', userId, userName: record.profile.name,
                    targetId: item.id, targetName: item.title, status: 'pending', 
                    date: new Date().toISOString().split('T')[0], details: 'AI助手推荐'
                 });
                 alert("已加入预约列表！");
             }
        } else if (item.type === 'exercise') {
            onNavigate('diet_motion');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-100 z-[100] flex flex-col animate-slideUp">
            {/* Glass Header */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 px-5 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-xl shadow-lg">🤖</div>
                    <div>
                        <h3 className="font-black text-slate-800 text-sm">AI 健康管家</h3>
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Powered by DeepSeek</span>
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
                        
                        {/* Recommendation Rail */}
                        {msg.recommendations && msg.recommendations.length > 0 && (
                            <div className="mt-4 w-full space-y-3 animate-fadeIn">
                                <div className="flex items-center gap-2 pl-1">
                                    <div className="h-[2px] w-4 bg-indigo-500 rounded-full"></div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">管家为您推荐</p>
                                </div>
                                <div className="flex overflow-x-auto gap-4 pb-2 px-1 snap-x scrollbar-hide">
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
                        <div className="bg-white px-4 py-2 rounded-2xl rounded-tl-none border border-slate-100 text-slate-400 text-xs italic">
                            正在联想档案数据并分析资源...
                        </div>
                    </div>
                )}
                <div ref={scrollRef} className="h-10" />
            </div>

            {/* Interaction Bar */}
            <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
                {isListening && (
                    <div className="mb-4 flex flex-col items-center animate-fadeIn">
                        <div className="flex gap-1 h-8 items-end mb-2">
                           {[...Array(12)].map((_, i) => (
                               <div key={i} className="w-1 bg-indigo-500 rounded-full animate-voice-wave" style={{height: `${Math.random()*100}%`, animationDelay: `${i*0.05}s`}}></div>
                           ))}
                        </div>
                        <p className="text-[10px] text-indigo-600 font-black animate-pulse">正在倾听您的描述...</p>
                    </div>
                )}

                <div className="flex gap-3 items-center">
                    <button 
                        onClick={toggleVoice}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                            isListening ? 'bg-red-500 text-white shadow-lg ring-4 ring-red-100' : 'bg-slate-100 text-slate-500'
                        }`}
                    >
                        {isListening ? '⏹' : '🎙️'}
                    </button>
                    
                    <div className="flex-1 bg-slate-100 rounded-2xl px-4 py-1 flex items-center border border-slate-200/50">
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
                            disabled={!input.trim() || isThinking}
                            className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 disabled:opacity-30"
                        >
                            ➤
                        </button>
                    </div>
                </div>
                
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                     {["膝盖疼", "尿酸高", "预约挂号", "减重餐单", "解读报告"].map(tag => (
                         <button key={tag} onClick={() => handleSend(tag)} className="text-[10px] bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-full font-bold whitespace-nowrap active:bg-slate-100">
                             {tag}
                         </button>
                     ))}
                </div>
            </div>
        </div>
    );
};

// Sub-component: Recommendation Card
const ButlerCard: React.FC<{ item: ContentItem, onAction: () => void }> = ({ item, onAction }) => {
    const isDoc = item.type === 'doctor';
    const isDrug = item.type === 'drug';
    const isEx = item.type === 'exercise';

    return (
        <div className="snap-start min-w-[240px] max-w-[240px] bg-white rounded-[2rem] border border-slate-100 shadow-xl flex flex-col overflow-hidden group">
            <div className={`h-32 flex items-center justify-center text-5xl relative ${isDoc ? 'bg-blue-50' : isDrug ? 'bg-orange-50' : 'bg-emerald-50'}`}>
                {isDoc ? '👨‍⚕️' : isDrug ? '🍱' : '🏃'}
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-white/80 backdrop-blur-md text-[8px] font-black text-slate-500 uppercase tracking-tighter">
                    {isDoc ? '名医' : isDrug ? '优选' : '推荐'}
                </div>
            </div>
            <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-1">
                    <h4 className="font-black text-slate-800 text-sm truncate flex-1">{item.title}</h4>
                    {isDrug && <span className="text-orange-600 font-black text-xs ml-2">¥{item.details?.price || '99'}</span>}
                </div>
                
                <div className="space-y-1 mb-4 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 line-clamp-2 leading-relaxed">
                        {item.description || '智能匹配您的健康需求'}
                    </p>
                    {isDoc && <p className="text-[9px] text-blue-600 font-black">擅长: {item.details?.dept || '全科'}</p>}
                    {isEx && <p className="text-[9px] text-emerald-600 font-black">时长: {item.details?.duration || '15'}min</p>}
                </div>

                <button 
                    onClick={onAction}
                    className={`w-full py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 shadow-md ${
                        isDoc ? 'bg-blue-600 text-white' : 
                        isDrug ? 'bg-orange-500 text-white' : 
                        'bg-slate-900 text-white'
                    }`}
                >
                    {isDoc ? '立即挂号' : isDrug ? '查看详情' : '开始训练'}
                </button>
            </div>
        </div>
    );
};
