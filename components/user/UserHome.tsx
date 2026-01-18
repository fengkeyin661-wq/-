
import React, { useState, useRef, useEffect } from 'react';
import { HealthProfile, HealthAssessment, HealthRecord } from '../../types';
import { generateBaichuanConsultation } from '../../services/geminiService';

interface Props {
  profile: HealthProfile;
  assessment?: HealthAssessment;
  record?: HealthRecord;
  dailyPlan?: any;
  onNavigate: (tab: string) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export const UserHome: React.FC<Props> = ({ profile, assessment, record, dailyPlan, onNavigate }) => {
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: 'welcome', 
      role: 'assistant', 
      content: `您好 ${profile.name}，我是您的智慧健康助手。我已经深度解读了您 2024 年度的体检报告。\n\n您目前的健康风险等级为【${assessment?.riskLevel === 'RED' ? '高风险' : assessment?.riskLevel === 'YELLOW' ? '中风险' : '低风险'}】。关于报告中的异常指标或后续健康管理，您可以直接在这里问我。`, 
      timestamp: Date.now() 
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 快捷问题建议
  const suggestions = [
    "解读我的体检异常",
    "我需要复查什么项目？",
    "这种异常饮食要注意什么？",
    "如何降低我的健康风险？"
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSend = async (text?: string) => {
    const content = text || inputValue.trim();
    if (!content || isThinking) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsThinking(true);

    try {
      // 提取核心数据作为上下文
      const abnormalities = record?.checkup.abnormalities.map(a => `${a.item}: ${a.result}`).join('; ') || '未见明显异常';
      const context = {
          riskLevel: assessment?.riskLevel || '未知',
          summary: assessment?.summary || '暂无详细综述',
          abnormalities,
          name: profile.name
      };

      // 获取对话历史
      const history = messages.slice(-5).map(m => ({ role: m.role, content: m.content }));

      const reply = await generateBaichuanConsultation(content, history, context);
      
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: reply, timestamp: Date.now() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      const errMsg: Message = { id: 'err', role: 'assistant', content: "对不起，智能助手暂时无法响应。请尝试重新提问，或咨询您的专属医生。", timestamp: Date.now() };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const riskLevel = assessment?.riskLevel || 'GREEN';

  return (
    <div className="p-4 h-full flex flex-col space-y-4 animate-fadeIn pb-24">
      {/* 1. 顶部身份卡 */}
      <div className="shrink-0 flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center text-2xl shadow-inner border border-white">
            {profile.gender === '女' ? '👩‍💼' : '👨‍💼'}
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 leading-tight">你好，{profile.name}</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{profile.department}</p>
          </div>
        </div>
        <div className="text-right">
           <div className={`text-[10px] font-black px-2 py-0.5 rounded-full border mb-1 inline-block ${
               riskLevel === 'RED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
               riskLevel === 'YELLOW' ? 'bg-orange-50 text-orange-600 border-orange-100' :
               'bg-teal-50 text-teal-600 border-teal-100'
           }`}>
               {riskLevel === 'RED' ? '高风险' : riskLevel === 'YELLOW' ? '中风险' : '低风险'}
           </div>
           <p className="text-[9px] text-slate-300">2024年度档案</p>
        </div>
      </div>

      {/* 2. 百川 AI 问诊对话流 (替代原打卡部分) */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-lg shadow-slate-100 border border-slate-100 overflow-hidden relative">
          <div className="px-5 py-3 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
              <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                  <span className="text-xs font-black text-slate-700">百川智能问诊助手</span>
              </div>
              <button 
                onClick={() => setMessages([messages[0]])}
                className="text-[10px] text-slate-400 font-bold hover:text-rose-500 transition-colors"
              >
                重置对话
              </button>
          </div>

          {/* 对话消息展示区 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
              {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${
                          msg.role === 'user' 
                          ? 'bg-teal-600 text-white rounded-tr-sm' 
                          : 'bg-slate-100 text-slate-800 rounded-tl-sm border border-white'
                      }`}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <div className={`text-[8px] mt-1 opacity-50 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                      </div>
                  </div>
              ))}
              {isThinking && (
                  <div className="flex justify-start">
                      <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-tl-sm border border-white flex gap-1 items-center">
                          <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce"></span>
                          <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                          <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                          <span className="text-[10px] text-slate-400 ml-2">正在分析报告...</span>
                      </div>
                  </div>
              )}
              <div ref={chatEndRef} />
          </div>

          {/* 输入与快捷建议区 */}
          <div className="shrink-0 p-4 pt-0 bg-white">
              <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
                  {suggestions.map(s => (
                      <button 
                        key={s}
                        onClick={() => handleSend(s)}
                        className="shrink-0 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 transition-all"
                      >
                        {s}
                      </button>
                  ))}
              </div>
              <div className="flex items-center gap-2 bg-slate-100 rounded-2xl p-1.5 shadow-inner">
                  <input 
                      type="text" 
                      placeholder="咨询体检报告中的异常项..." 
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-4 py-2 outline-none font-medium placeholder:text-slate-400"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSend()}
                  />
                  <button 
                      onClick={() => handleSend()}
                      disabled={!inputValue.trim() || isThinking}
                      className="w-10 h-10 bg-teal-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-teal-100 disabled:opacity-50 active:scale-90 transition-transform"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                      </svg>
                  </button>
              </div>
          </div>
      </div>

      {/* 3. 底部人工咨询快速入口 */}
      <div 
        onClick={() => onNavigate('interaction')}
        className="shrink-0 bg-slate-900 rounded-3xl p-5 text-white flex items-center justify-between shadow-xl active:scale-95 transition-transform cursor-pointer relative overflow-hidden"
      >
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12"></div>
          <div className="flex items-center gap-4 relative z-10">
             <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl border border-white/10">👩‍⚕️</div>
             <div>
                <div className="font-bold text-sm tracking-tight">需要人工介入？</div>
                <div className="text-[10px] text-slate-400 font-medium">点击联系您的专属校医专家团队</div>
             </div>
          </div>
          <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center relative z-10 font-black text-slate-400">›</div>
      </div>
    </div>
  );
};
