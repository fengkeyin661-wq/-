import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ContentItem } from '../../services/contentService';
import type { CheckupPortalGuide } from '../../services/checkupPortalContentService';
import {
  buildCheckupAssistantContext,
  CHECKUP_CHAT_QUICK_QUESTIONS,
  isCheckupChatConfigured,
  sendCheckupChatMessage,
  type CheckupChatMessage,
} from '../../services/checkupChatService';
import { ModalPortal } from '../user/ModalPortal';

interface Props {
  packages: ContentItem[];
  portalGuide: CheckupPortalGuide;
}

const WELCOME =
  '您好！我是体检问答助手，可以为您解答体检套餐推荐、到检指引、检前准备和检后服务等问题。请问有什么可以帮您？';

export const CheckupChatBot: React.FC<Props> = ({ packages, portalGuide }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<CheckupChatMessage[]>([
    { role: 'assistant', content: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const contextBlock = useMemo(
    () => buildCheckupAssistantContext(portalGuide, packages),
    [portalGuide, packages],
  );

  const configured = isCheckupChatConfigured();
  const hasUserMessage = messages.some((m) => m.role === 'user');

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, loading]);

  const handleSend = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;

    const nextMessages: CheckupChatMessage[] = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const reply = await sendCheckupChatMessage(nextMessages, contextBlock);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '发送失败，请稍后重试';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 z-[85] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white shadow-lg shadow-emerald-900/25 ring-4 ring-white/80 transition-transform hover:bg-emerald-700 active:scale-95 bottom-[calc(env(safe-area-inset-bottom)+5rem)]"
          aria-label="打开体检问答助手"
          title="体检问答助手"
        >
          🤖
        </button>
      )}

      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[115] flex flex-col justify-end bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkup-chat-title"
          >
            <div
              className="mx-auto flex h-[min(88dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="checkup-chat-title" className="text-lg font-black">
                      体检问答助手
                    </h2>
                    <p className="mt-0.5 text-xs text-emerald-50/90">
                      DeepSeek 智能解答 · 套餐推荐与到检指引
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold hover:bg-white/30"
                  >
                    关闭
                  </button>
                </div>
                {!configured && (
                  <p className="mt-2 rounded-lg bg-amber-500/90 px-3 py-2 text-[11px] font-medium">
                    问答服务未配置密钥，仍可查看常见问题；如需启用请联系管理员配置 VITE_DEEPSEEK_API_KEY
                  </p>
                )}
              </div>

              <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3 bg-slate-50">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {m.role === 'assistant' && (
                      <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm text-white">
                        🤖
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                        m.role === 'user'
                          ? 'rounded-br-sm bg-emerald-600 text-white'
                          : 'rounded-bl-sm border border-slate-100 bg-white text-slate-700'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm text-white">
                      🤖
                    </div>
                    <div className="rounded-2xl rounded-bl-sm border border-slate-100 bg-white px-4 py-2.5 text-sm text-slate-400">
                      正在思考…
                    </div>
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-slate-100 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                {!hasUserMessage && (
                  <div className="mb-3">
                    <p className="mb-2 text-[11px] font-bold text-slate-400">快捷提问</p>
                    <div className="flex flex-wrap gap-2">
                      {CHECKUP_CHAT_QUICK_QUESTIONS.map(({ label, prompt }) => (
                        <button
                          key={label}
                          type="button"
                          disabled={loading || !configured}
                          onClick={() => void handleSend(prompt)}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    placeholder={configured ? '输入您的体检问题…' : '问答服务暂未开通，请致电 0371-67739261'}
                    disabled={!configured || loading}
                    className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={!configured || loading || !input.trim()}
                    onClick={() => void handleSend()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white shadow-md hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    ↑
                  </button>
                </div>
                <p className="mt-2 text-center text-[10px] text-slate-400">
                  仅供参考，不能替代医生诊断 · 急症请立即就医
                </p>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};
