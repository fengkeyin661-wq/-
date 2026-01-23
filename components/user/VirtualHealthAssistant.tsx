import React, { useState } from 'react';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

interface Props {
  userName?: string;
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
const BAICHUAN_API_URL = 'https://api.baichuan-ai.com/v1/assistants';

export const VirtualHealthAssistant: React.FC<Props> = ({ userName }) => {
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
        console.warn('Missing VITE_BAICHUAN_API_KEY for Baichuan assistant');
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

      const resp = await fetch(BAICHUAN_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(BAICHUAN_API_KEY ? { Authorization: `Bearer ${BAICHUAN_API_KEY}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`百川接口返回错误：${resp.status} - ${text.slice(0, 100)}`);
      }

      const data = await resp.json();
      const assistantContent =
        data?.choices?.[0]?.message?.content ||
        data?.reply ||
        data?.message ||
        '抱歉，暂时没有获取到明确的回复，请稍后再试或联系线下医生。';

      setMessages((prev) => [...prev, { role: 'assistant', content: String(assistantContent) }]);
    } catch (e: any) {
      console.error('Baichuan assistant error', e);
      setError(e?.message || '调用虚拟助手失败，请稍后重试。');
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

  return (
    <div className="px-6 pt-4">
      <div className="bg-gradient-to-r from-teal-500 to-emerald-500 rounded-3xl p-[1px] shadow-lg mb-4">
        <div className="bg-white rounded-[22px] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500 flex items-center justify-center text-2xl shadow-md">
                🤖
              </div>
              <div>
                <div className="text-xs font-black text-teal-600 uppercase tracking-widest">
                  虚拟健康助手
                </div>
                <div className="text-[11px] text-slate-500">
                  针对体检和日常习惯的健康问答，不替代线下诊疗
                </div>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold">
              百川大模型
            </span>
          </div>

          {/* Chat history (last 4 messages for compact view) */}
          <div className="bg-slate-50 rounded-2xl p-3 max-h-40 overflow-y-auto space-y-2 text-[13px]">
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
              className="flex-1 text-[13px] resize-none rounded-2xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50/60"
              rows={2}
              placeholder="简单描述您的健康疑问，例如：最近血压有点高，应该怎么调整作息和饮食？"
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
            <div className="text-[11px] text-rose-500 mt-1">
              {error}
            </div>
          )}

          <div className="text-[10px] text-slate-400 mt-1">
            本功能基于百川大模型，仅供健康科普与生活方式建议参考，不能作为诊断或处方依据。
          </div>
        </div>
      </div>
    </div>
  );
};

