import React, { useState } from 'react';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

interface Props {
  userName?: string;
  fullPage?: boolean; // 全屏模式
}

// Helper to safely read env in Vite/browser
const getBaichuanApiKey = (): string => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta && (import.meta as any).env) {
      // @ts-ignore
      return (import.meta as any).env.VITE_BAICHUAN_API_KEY || '';
    }
  } catch (e) {
    console.warn('Cannot read import.meta.env in current environment');
  }
  return '';
};

const BAICHUAN_API_KEY = getBaichuanApiKey();

// Use proxy in development, direct URL in production
const isDev = (() => {
  try {
    // @ts-ignore
    return !!import.meta.env.DEV;
  } catch {
    return false;
  }
})();

const BAICHUAN_API_URL = isDev 
  ? '/api/baichuan/v1/chat/completions'  // Use Vite proxy in development
  : 'https://api.baichuan-ai.com/v1/chat/completions';  // Direct call in production

export const VirtualHealthAssistant: React.FC<Props> = ({ userName, fullPage = false }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        '您好，我是郑州大学医院的虚拟健康助手，可以帮您解读体检结果、优化饮食与运动习惯，但不能替代线下就诊和急诊处理。如有胸痛、呼吸困难等急症，请立即就医。',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const newUserMsg: ChatMessage = { role: 'user', content: input.trim() };
    const nextMessages = [...messages, newUserMsg];
    setMessages(nextMessages);
    setInput('');
    setError(null);

    setIsLoading(true);
    try {
      if (!BAICHUAN_API_KEY) {
        const errorMsg = '未配置百川API密钥，请在环境变量中设置 VITE_BAICHUAN_API_KEY';
        console.error(errorMsg);
        setError(errorMsg);
        setIsLoading(false);
        return;
      }

      const systemPrompt =
        '你是郑州大学医院“虚拟健康助手”，面向已完成体检或持续随访的职工/学生用户：' +
        '1) 回答时用简体中文，语气温暖专业、简洁，避免给出具体处方药名和剂量；' +
        '2) 可以基于用户描述给出生活方式干预建议（饮食、运动、睡眠、减压等）；' +
        '3) 对于疑似严重情况（如持续胸痛、明显呼吸困难、意识变化、剧烈头痛等），务必提醒用户尽快线下就诊或急诊处理；' +
        '4) 如果问题超出你能力或涉及具体诊断/用药调整，请建议用户咨询线下医生或签约医生；' +
        '5) 回答长度一般控制在 3～6 条要点之内。';

      const payload: any = {
        model: 'Baichuan2-Turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          ...nextMessages.map((m) => ({
            role: m.role,
            content: (userName && m.role === 'user'
              ? `用户「${userName}」的问题：${m.content}`
              : m.content),
          })),
        ],
        stream: false,
        temperature: 0.3,
      };

      console.log('[Baichuan] Calling API:', BAICHUAN_API_URL);
      console.log('[Baichuan] Payload:', JSON.stringify(payload, null, 2));

      const resp = await fetch(BAICHUAN_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BAICHUAN_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      console.log('[Baichuan] Response status:', resp.status, resp.statusText);

      if (!resp.ok) {
        const text = await resp.text();
        console.error('[Baichuan] Error response:', text);
        throw new Error(`百川接口返回错误：${resp.status} ${resp.statusText} - ${text.slice(0, 200)}`);
      }

      const data = await resp.json();
      console.log('[Baichuan] Response data:', data);

      // 百川API响应格式：{ choices: [{ message: { content: "..." } }] }
      const assistantContent =
        data?.choices?.[0]?.message?.content ||
        data?.data?.choices?.[0]?.message?.content ||
        data?.reply ||
        data?.message ||
        data?.content ||
        '抱歉，暂时没有获取到明确的回复，请稍后再试或联系线下医生。';

      setMessages((prev) => [...prev, { role: 'assistant', content: String(assistantContent) }]);
    } catch (e: any) {
      console.error('[Baichuan] Exception:', e);
      const errorMessage = e?.message || '调用虚拟助手失败，请稍后重试。';
      setError(errorMessage);
      
      // 如果是网络错误，提供更友好的提示
      if (e?.message?.includes('Failed to fetch') || e?.message?.includes('NetworkError')) {
        setError('网络连接失败，请检查网络或稍后重试。如果问题持续，请联系技术支持。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 全屏模式 - 用于首页
  if (fullPage) {
    return (
      <div className="flex min-h-full flex-col bg-slate-50">
        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
            >
              {m.role === 'assistant' && (
                <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center text-lg mr-2 shrink-0 shadow-md">
                  🤖
                </div>
              )}
              <div
                className={`max-w-[84%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  m.role === 'user'
                    ? 'bg-teal-600 text-white rounded-br-sm'
                    : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm'
                }`}
              >
                {m.content}
              </div>
              {m.role === 'user' && (
                <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-lg ml-2 shrink-0">
                  👤
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start animate-fadeIn">
              <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center text-lg mr-2 shrink-0 shadow-md">
                🤖
              </div>
              <div className="bg-white text-slate-400 px-4 py-3 rounded-2xl rounded-bl-sm border border-slate-100 shadow-sm">
                <span className="animate-pulse">正在思考...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Questions */}
        <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide">
          {['血压偏高怎么办？', '如何改善睡眠？', '推荐减脂运动', '体检报告解读'].map((q) => (
            <button
              key={q}
              onClick={() => setInput(q)}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-100 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          {error && (
            <div className="mb-2 px-1 text-sm text-rose-500">{error}</div>
          )}
          <div className="flex items-end gap-3">
            <textarea
              className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows={2}
              placeholder="请描述您的健康问题..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className={`h-12 w-12 rounded-full flex items-center justify-center text-white text-xl shadow-lg active:scale-95 transition-all ${
                isLoading || !input.trim()
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {isLoading ? '...' : '↑'}
            </button>
          </div>
          <div className="mt-2 text-center text-xs text-slate-400">
            仅供健康科普参考，不能作为诊断或处方依据
          </div>
        </div>
      </div>
    );
  }

  // 卡片模式 - 用于其他页面嵌入
  return (
    <div className="px-4 pt-4">
      <div className="bg-gradient-to-r from-teal-500 to-emerald-500 rounded-3xl p-[1px] shadow-lg mb-4">
        <div className="bg-white rounded-[22px] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500 flex items-center justify-center text-2xl shadow-md">
                🤖
              </div>
              <div>
                <div className="text-sm font-black text-teal-600">
                  虚拟健康助手
                </div>
                <div className="text-xs text-slate-500">
                  针对体检和日常习惯的健康问答，不替代线下诊疗
                </div>
              </div>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-600">
              百川大模型
            </span>
          </div>

          {/* Chat history (last 4 messages for compact view) */}
          <div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3 text-sm">
            {messages.slice(-4).map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`px-3 py-2 rounded-2xl max-w-[80%] leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-teal-600 text-white rounded-br-sm'
                      : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          {/* Input area */}
          <div className="flex items-end gap-2 mt-1">
            <textarea
              className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows={2}
              placeholder="简单描述您的健康疑问..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-lg shadow-md active:scale-95 transition-all ${
                isLoading || !input.trim()
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {isLoading ? '…' : '↑'}
            </button>
          </div>

          {error && (
            <div className="mt-1 text-sm text-rose-500">
              {error}
            </div>
          )}

          <div className="mt-1 text-xs text-slate-400">
            本功能基于百川大模型，仅供健康科普与生活方式建议参考，不能作为诊断或处方依据。
          </div>
        </div>
      </div>
    </div>
  );
};

