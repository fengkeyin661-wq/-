import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ChatMessage,
    fetchInteractions,
    fetchMessages,
    getUnreadCount,
    InteractionItem,
    markAsRead,
    sendMessage,
} from '../services/contentService';
import { findArchiveByCheckupId, HealthArchive } from '../services/dataService';

interface Props {
    doctorId: string;
    doctorName?: string;
    /** 同步到侧栏角标（全部签约用户未读之和） */
    onUnreadTotalChange?: (total: number) => void;
}

interface ThreadRow {
    userId: string;
    userName: string;
    archive?: HealthArchive;
    unread: number;
    signing: InteractionItem;
}

const matchesDoctor = (i: InteractionItem, doctorId: string, doctorName?: string) => {
    if (i.targetId === doctorId) return true;
    if (doctorName && i.targetName === doctorName) return true;
    return false;
};

export const DoctorMessageCenter: React.FC<Props> = ({ doctorId, doctorName, onUnreadTotalChange }) => {
    const [threads, setThreads] = useState<ThreadRow[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loadingList, setLoadingList] = useState(true);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const selected = useMemo(
        () => threads.find((t) => t.userId === selectedUserId) || null,
        [threads, selectedUserId]
    );

    const refreshThreads = useCallback(async () => {
        const interactions = await fetchInteractions();
        const signings = interactions.filter(
            (i) =>
                i.type === 'doctor_signing' &&
                i.status === 'confirmed' &&
                matchesDoctor(i, doctorId, doctorName)
        );
        const seen = new Set<string>();
        const rows: ThreadRow[] = [];
        for (const s of signings) {
            if (seen.has(s.userId)) continue;
            seen.add(s.userId);
            const archive = await findArchiveByCheckupId(s.userId);
            const unread = await getUnreadCount(doctorId, s.userId);
            rows.push({
                userId: s.userId,
                userName: s.userName,
                archive: archive || undefined,
                unread,
                signing: s,
            });
        }
        rows.sort((a, b) => {
            if (b.unread !== a.unread) return b.unread - a.unread;
            return a.userName.localeCompare(b.userName, 'zh-CN');
        });
        setThreads(rows);
        const total = rows.reduce((acc, r) => acc + r.unread, 0);
        onUnreadTotalChange?.(total);
        setLoadingList(false);
    }, [doctorId, doctorName, onUnreadTotalChange]);

    const loadMessages = useCallback(async () => {
        if (!selectedUserId) {
            setMessages([]);
            return;
        }
        const rows = await fetchMessages(selectedUserId, doctorId);
        setMessages(rows);
    }, [selectedUserId, doctorId]);

    useEffect(() => {
        refreshThreads();
    }, [refreshThreads]);

    useEffect(() => {
        const id = window.setInterval(() => {
            refreshThreads();
        }, 8000);
        return () => window.clearInterval(id);
    }, [refreshThreads]);

    useEffect(() => {
        if (!selectedUserId) return;
        loadMessages();
        markAsRead(doctorId, selectedUserId).then(() => refreshThreads());
        const id = window.setInterval(loadMessages, 3000);
        return () => window.clearInterval(id);
    }, [selectedUserId, doctorId, loadMessages, refreshThreads]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const openThread = (userId: string) => {
        setSelectedUserId(userId);
    };

    const send = async () => {
        if (!selectedUserId || !input.trim()) return;
        await sendMessage({
            senderId: doctorId,
            senderRole: 'doctor',
            receiverId: selectedUserId,
            content: input.trim(),
        });
        setInput('');
        await loadMessages();
        await refreshThreads();
    };

    const totalUnread = threads.reduce((a, t) => a + t.unread, 0);

    return (
        <div className="flex h-[calc(100vh-8rem)] min-h-[520px] max-w-6xl mx-auto gap-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <aside className="w-[300px] shrink-0 border-r border-slate-200 flex flex-col bg-slate-50/80">
                <div className="p-4 border-b border-slate-200 bg-white">
                    <h2 className="text-lg font-black text-slate-800">签约用户消息</h2>
                    <p className="text-xs text-slate-500 mt-1">
                        {totalUnread > 0 ? (
                            <span className="text-red-600 font-bold">{totalUnread} 条未读</span>
                        ) : (
                            '暂无未读'
                        )}
                    </p>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loadingList ? (
                        <div className="p-6 text-center text-slate-400 text-sm">加载会话…</div>
                    ) : threads.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-sm">暂无已签约用户，无法发起会话</div>
                    ) : (
                        threads.map((t) => (
                            <button
                                key={t.userId}
                                type="button"
                                onClick={() => openThread(t.userId)}
                                className={`w-full text-left px-4 py-3 border-b border-slate-100 flex items-center gap-3 transition-colors ${
                                    selectedUserId === t.userId ? 'bg-teal-50 border-l-4 border-l-teal-600' : 'hover:bg-white'
                                }`}
                            >
                                <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-lg shrink-0">
                                    {t.archive?.gender === '女' ? '👩' : '👨'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-800 truncate">{t.userName}</div>
                                    <div className="text-[10px] text-slate-400 truncate">{t.userId}</div>
                                </div>
                                {t.unread > 0 && (
                                    <span className="shrink-0 min-w-[22px] h-[22px] rounded-full bg-red-500 text-white text-[11px] font-black flex items-center justify-center px-1">
                                        {t.unread > 99 ? '99+' : t.unread}
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </aside>

            <section className="flex-1 flex flex-col min-w-0 bg-[#F0F2F5]">
                {!selected ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                        <div className="text-5xl mb-4">💬</div>
                        <p className="font-bold text-slate-600">请选择左侧用户开始对话</p>
                        <p className="text-sm mt-2 text-center max-w-md">新消息会定期刷新未读数；进入会话后会自动标记已读。</p>
                    </div>
                ) : (
                    <>
                        <header className="shrink-0 bg-white px-4 py-3 border-b border-slate-200 flex items-center gap-3 shadow-sm">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl">
                                {selected.archive?.gender === '女' ? '👩' : '👨'}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">{selected.userName}</h3>
                                <p className="text-[10px] text-green-600 font-medium">在线咨询</p>
                            </div>
                        </header>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.length === 0 ? (
                                <div className="text-center text-slate-400 text-sm py-12">暂无消息，向用户打个招呼吧</div>
                            ) : (
                                messages.map((msg) => {
                                    const isMe = msg.senderRole === 'doctor' && msg.senderId === doctorId;
                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div
                                                className={`max-w-[78%] p-3 rounded-2xl shadow-sm text-sm ${
                                                    isMe
                                                        ? 'bg-blue-600 text-white rounded-tr-sm'
                                                        : 'bg-white text-slate-800 rounded-tl-sm border border-slate-100'
                                                }`}
                                            >
                                                {msg.messageType === 'image' && msg.mediaUrl ? (
                                                    <div className="space-y-2">
                                                        <img
                                                            src={msg.mediaUrl}
                                                            alt=""
                                                            className="max-h-56 rounded-lg border border-slate-200"
                                                        />
                                                        <div>{msg.content}</div>
                                                    </div>
                                                ) : msg.messageType === 'card_recommend' ? (
                                                    <div>
                                                        <div className="font-bold mb-1">{msg.metadata?.title || '推荐'}</div>
                                                        <div className="text-xs opacity-90">
                                                            {msg.metadata?.description || msg.content}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    msg.content
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={chatEndRef} />
                        </div>
                        <footer className="shrink-0 bg-white p-3 border-t border-slate-200 flex gap-2">
                            <input
                                className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="输入回复…"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && send()}
                            />
                            <button
                                type="button"
                                onClick={send}
                                disabled={!input.trim()}
                                className="px-5 py-2 rounded-full bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40"
                            >
                                发送
                            </button>
                        </footer>
                    </>
                )}
            </section>
        </div>
    );
};
