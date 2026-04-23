import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ContentItem,
    ChatMessage,
    DeskInboxSummary,
    fetchContent,
    fetchMessages,
    getDeskInboxSummaries,
    markAsRead,
    pickDeskManager,
    saveInteraction,
    sendMessage,
} from '../services/contentService';
import { fetchArchives, HealthArchive } from '../services/dataService';

export const HealthManagerWorkspace: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [primaryManager, setPrimaryManager] = useState<ContentItem | null>(null);
    const [resources, setResources] = useState<ContentItem[]>([]);
    const [archives, setArchives] = useState<HealthArchive[]>([]);
    const [selectedArchiveId, setSelectedArchiveId] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [selectedResourceId, setSelectedResourceId] = useState('');
    const [inboxByUser, setInboxByUser] = useState<Record<string, DeskInboxSummary>>({});
    const [toast, setToast] = useState<string>('');
    const inboxByUserRef = useRef(inboxByUser);
    const archivesRef = useRef(archives);
    useEffect(() => {
        inboxByUserRef.current = inboxByUser;
    }, [inboxByUser]);
    useEffect(() => {
        archivesRef.current = archives;
    }, [archives]);

    const selectedArchive = useMemo(
        () => archives.find((a) => a.checkup_id === selectedArchiveId) || null,
        [archives, selectedArchiveId]
    );
    const selectedResource = useMemo(
        () => resources.find((r) => r.id === selectedResourceId) || null,
        [resources, selectedResourceId]
    );
    const sortedArchives = useMemo(() => {
        return [...archives].sort((a, b) => {
            const sa = inboxByUser[a.checkup_id];
            const sb = inboxByUser[b.checkup_id];
            if ((sb?.unread || 0) !== (sa?.unread || 0)) return (sb?.unread || 0) - (sa?.unread || 0);
            const ta = sa?.lastMessage ? new Date(sa.lastMessage.timestamp).getTime() : 0;
            const tb = sb?.lastMessage ? new Date(sb.lastMessage.timestamp).getTime() : 0;
            return tb - ta;
        });
    }, [archives, inboxByUser]);

    const loadInboxSummaries = async (
        manager: ContentItem | null,
        users: HealthArchive[],
        previous?: Record<string, DeskInboxSummary>
    ) => {
        if (!manager || !users.length) {
            setInboxByUser({});
            return;
        }
        const summaries = await getDeskInboxSummaries(manager.id, users.map((u) => u.checkup_id));
        const nextMap: Record<string, DeskInboxSummary> = {};
        let raisedToast = '';
        summaries.forEach((s) => {
            nextMap[s.userId] = s;
            const prevUnread = previous?.[s.userId]?.unread || 0;
            if (!raisedToast && s.unread > prevUnread) {
                const matchedUser = users.find((u) => u.checkup_id === s.userId);
                raisedToast = `${matchedUser?.name || s.userId} 发来新消息（${s.unread}）`;
            }
        });
        setInboxByUser(nextMap);
        if (raisedToast) {
            setToast(raisedToast);
            window.setTimeout(() => setToast(''), 2500);
        }
    };

    const loadAll = async () => {
        setLoading(true);
        try {
            const [docs, allArchives, svc, drug] = await Promise.all([
                fetchContent('doctor'),
                fetchArchives(),
                fetchContent('service', 'active'),
                fetchContent('drug', 'active'),
            ]);
            const uniqueManager = pickDeskManager(docs);
            setPrimaryManager(uniqueManager);
            setArchives(allArchives);
            setResources([
                ...docs.filter((d) => d.type === 'doctor' && d.status === 'active'),
                ...svc,
                ...drug,
            ]);
            await loadInboxSummaries(uniqueManager, allArchives, inboxByUserRef.current);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, []);

    useEffect(() => {
        const loadMsgs = async () => {
            if (!selectedArchive || !primaryManager) {
                setMessages([]);
                return;
            }
            await markAsRead(primaryManager.id, selectedArchive.checkup_id);
            const rows = await fetchMessages(selectedArchive.checkup_id, primaryManager.id);
            setMessages(rows);
            await loadInboxSummaries(primaryManager, archivesRef.current, inboxByUserRef.current);
        };
        loadMsgs();
    }, [selectedArchive?.checkup_id, primaryManager?.id]);

    useEffect(() => {
        if (!primaryManager || !archives.length) return;
        const id = window.setInterval(() => {
            loadInboxSummaries(primaryManager, archivesRef.current, inboxByUserRef.current);
        }, 3000);
        return () => window.clearInterval(id);
    }, [primaryManager?.id, archives.length]);

    const sendText = async () => {
        if (!selectedArchive) {
            alert('请先在左侧选择用户');
            return;
        }
        if (!primaryManager) {
            alert('未识别到健康管家小郑，请先在医生资源中确认“小郑”条目存在');
            return;
        }
        if (!chatInput.trim()) return;
        await sendMessage({
            senderId: primaryManager.id,
            senderRole: 'manager',
            receiverId: selectedArchive.checkup_id,
            content: chatInput.trim(),
            messageType: 'text',
        });
        setChatInput('');
        const rows = await fetchMessages(selectedArchive.checkup_id, primaryManager.id);
        setMessages(rows);
        await loadInboxSummaries(primaryManager, archivesRef.current, inboxByUserRef.current);
    };

    const sendImage = async () => {
        if (!selectedArchive) {
            alert('请先在左侧选择用户');
            return;
        }
        if (!primaryManager) {
            alert('未识别到健康管家小郑，请先在医生资源中确认“小郑”条目存在');
            return;
        }
        if (!imageUrl.trim()) return;
        await sendMessage({
            senderId: primaryManager.id,
            senderRole: 'manager',
            receiverId: selectedArchive.checkup_id,
            content: '图片消息',
            messageType: 'image',
            mediaUrl: imageUrl.trim(),
        });
        setImageUrl('');
        const rows = await fetchMessages(selectedArchive.checkup_id, primaryManager.id);
        setMessages(rows);
        await loadInboxSummaries(primaryManager, archivesRef.current, inboxByUserRef.current);
    };

    const sendRecommendation = async () => {
        if (!selectedArchive) {
            alert('请先在左侧选择用户');
            return;
        }
        if (!primaryManager) {
            alert('未识别到健康管家小郑，请先在医生资源中确认“小郑”条目存在');
            return;
        }
        if (!selectedResource) return;
        const isDoctor = selectedResource.type === 'doctor';
        await sendMessage({
            senderId: primaryManager.id,
            senderRole: 'manager',
            receiverId: selectedArchive.checkup_id,
            content: `推荐${isDoctor ? '医生' : '资源'}：${selectedResource.title}`,
            messageType: 'card_recommend',
            metadata: {
                resourceId: selectedResource.id,
                resourceType: selectedResource.type,
                title: selectedResource.title,
                description: selectedResource.description || '',
            },
        });
        await saveInteraction({
            id: `manager_recommend_${Date.now()}`,
            type: isDoctor ? 'manager_recommend_doctor' : 'manager_recommend_resource',
            userId: selectedArchive.checkup_id,
            userName: selectedArchive.name,
            targetId: selectedResource.id,
            targetName: selectedResource.title,
            status: 'confirmed',
            date: new Date().toISOString().split('T')[0],
            details: `健康管家 ${primaryManager.title} 推荐`,
        });
        setSelectedResourceId('');
        const rows = await fetchMessages(selectedArchive.checkup_id, primaryManager.id);
        setMessages(rows);
        await loadInboxSummaries(primaryManager, archivesRef.current, inboxByUserRef.current);
    };

    return (
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-[calc(100vh-210px)] min-h-[560px]">
            <h3 className="text-lg font-bold text-slate-800 mb-3">医院总台收件箱</h3>
            {toast && (
                <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {toast}
                </div>
            )}
            <div className="grid grid-cols-12 gap-4 h-[calc(100%-36px)]">
                <div className="col-span-3 border border-slate-200 rounded-xl p-3 flex flex-col min-h-0">
                    <label className="text-xs font-bold text-slate-600 mb-1">医院总台账号</label>
                    <div className="border border-teal-200 bg-teal-50 rounded-lg p-2 text-sm mb-3 text-teal-800 font-bold">
                        {primaryManager?.title || '未配置（请在医生资源中添加小郑）'}
                    </div>
                    <div className="text-xs text-slate-500 mb-2">用户列表</div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {sortedArchives.map((a) => (
                            <div
                                key={a.checkup_id}
                                className={`rounded-lg border p-2 cursor-pointer ${
                                    selectedArchiveId === a.checkup_id ? 'border-teal-400 bg-teal-50' : 'border-slate-200'
                                }`}
                                onClick={() => setSelectedArchiveId(a.checkup_id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-bold text-slate-800">{a.name}</div>
                                    {(inboxByUser[a.checkup_id]?.unread || 0) > 0 && (
                                        <span className="min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[10px] font-bold text-white">
                                            {inboxByUser[a.checkup_id].unread}
                                        </span>
                                    )}
                                </div>
                                <div className="text-[11px] text-slate-500">{a.department} · {a.risk_level}</div>
                                {inboxByUser[a.checkup_id]?.lastMessage && (
                                    <div className="mt-1 truncate text-[11px] text-slate-400">
                                        {inboxByUser[a.checkup_id].lastMessage?.content || '图片/推荐消息'}
                                    </div>
                                )}
                            </div>
                        ))}
                        {!archives.length && (
                            <div className="text-center text-xs text-slate-400 py-8">{loading ? '加载中...' : '暂无用户'}</div>
                        )}
                    </div>
                </div>
                <div className="col-span-9 border border-slate-200 rounded-xl p-3 flex flex-col min-h-0">
                    {!selectedArchive || !primaryManager ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">请选择用户</div>
                    ) : (
                        <>
                            <div className="pb-2 border-b border-slate-100">
                                <div className="font-bold text-slate-800">{selectedArchive.name}</div>
                                <div className="text-xs text-slate-500">
                                    医院总台：{primaryManager.title} · {selectedArchive.phone || '无电话'}
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto py-3 space-y-2">
                                {messages.map((m) => {
                                    const isMine = m.senderId === primaryManager.id;
                                    return (
                                        <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[72%] rounded-xl p-3 text-sm ${isMine ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                                {m.messageType === 'image' && m.mediaUrl ? (
                                                    <div className="space-y-2">
                                                        <img src={m.mediaUrl} alt="chat" className="max-h-56 rounded-lg border border-slate-200" />
                                                        <div>{m.content}</div>
                                                    </div>
                                                ) : m.messageType === 'card_recommend' ? (
                                                    <div>
                                                        <div className="font-bold mb-1">{m.metadata?.title || '推荐资源'}</div>
                                                        <div className="text-xs opacity-90">{m.metadata?.description || m.content}</div>
                                                    </div>
                                                ) : (
                                                    m.content
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="border-t border-slate-100 pt-3 space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="发送文字消息..."
                                    />
                                    <button onClick={sendText} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold">发送</button>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        value={imageUrl}
                                        onChange={(e) => setImageUrl(e.target.value)}
                                        placeholder="图片 URL（https://...）"
                                    />
                                    <button onClick={sendImage} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold">发图</button>
                                </div>
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        value={selectedResourceId}
                                        onChange={(e) => setSelectedResourceId(e.target.value)}
                                    >
                                        <option value="">选择推荐医生/资源</option>
                                        {resources.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                [{r.type}] {r.title}
                                            </option>
                                        ))}
                                    </select>
                                    <button onClick={sendRecommendation} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold">
                                        发送推荐
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
};

