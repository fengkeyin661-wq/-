import React, { useEffect, useMemo, useState } from 'react';
import {
    ContentItem,
    ChatMessage,
    fetchContent,
    fetchMessages,
    isHealthManagerContent,
    saveInteraction,
    sendMessage,
} from '../services/contentService';
import { fetchArchives, HealthArchive, updateArchiveMeta } from '../services/dataService';

export const HealthManagerWorkspace: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [managers, setManagers] = useState<ContentItem[]>([]);
    const [resources, setResources] = useState<ContentItem[]>([]);
    const [archives, setArchives] = useState<HealthArchive[]>([]);
    const [selectedManagerId, setSelectedManagerId] = useState('');
    const [selectedArchiveId, setSelectedArchiveId] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [selectedResourceId, setSelectedResourceId] = useState('');
    const [savingAssignId, setSavingAssignId] = useState<string | null>(null);

    const selectedArchive = useMemo(
        () => archives.find((a) => a.checkup_id === selectedArchiveId) || null,
        [archives, selectedArchiveId]
    );
    const selectedManager = useMemo(
        () => managers.find((m) => m.id === selectedManagerId) || null,
        [managers, selectedManagerId]
    );
    const selectedResource = useMemo(
        () => resources.find((r) => r.id === selectedResourceId) || null,
        [resources, selectedResourceId]
    );
    const isConversationAligned = useMemo(() => {
        if (!selectedArchive || !selectedManager) return false;
        return selectedArchive.health_manager_content_id === selectedManager.id;
    }, [selectedArchive, selectedManager]);

    const filteredArchives = useMemo(() => {
        if (!selectedManagerId) return archives;
        return archives.filter((a) => a.health_manager_content_id === selectedManagerId || !a.health_manager_content_id);
    }, [archives, selectedManagerId]);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [docs, allArchives, svc, drug] = await Promise.all([
                fetchContent('doctor', 'active'),
                fetchArchives(),
                fetchContent('service', 'active'),
                fetchContent('drug', 'active'),
            ]);
            const managerRows = docs.filter(isHealthManagerContent);
            setManagers(managerRows);
            if (!selectedManagerId && managerRows[0]) setSelectedManagerId(managerRows[0].id);
            setArchives(allArchives);
            setResources([
                ...docs.filter((d) => d.type === 'doctor'),
                ...svc,
                ...drug,
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, []);

    useEffect(() => {
        const loadMsgs = async () => {
            if (!selectedArchive || !selectedManager) {
                setMessages([]);
                return;
            }
            const rows = await fetchMessages(selectedArchive.checkup_id, selectedManager.id);
            setMessages(rows);
        };
        loadMsgs();
    }, [selectedArchive?.checkup_id, selectedManager?.id]);

    const assignManager = async (archive: HealthArchive, managerId: string) => {
        setSavingAssignId(archive.checkup_id);
        try {
            const res = await updateArchiveMeta(archive.checkup_id, { health_manager_content_id: managerId || null });
            if (!res.success) {
                alert(res.message || '分配失败');
                return;
            }
            await loadAll();
        } finally {
            setSavingAssignId(null);
        }
    };

    const sendText = async () => {
        if (!selectedArchive || !selectedManager || !chatInput.trim()) return;
        if (!isConversationAligned) {
            alert('当前发送身份与该用户绑定的健康管家不一致，请先切换到已绑定管家或先改派后再发送。');
            return;
        }
        await sendMessage({
            senderId: selectedManager.id,
            senderRole: 'manager',
            receiverId: selectedArchive.checkup_id,
            content: chatInput.trim(),
            messageType: 'text',
        });
        setChatInput('');
        const rows = await fetchMessages(selectedArchive.checkup_id, selectedManager.id);
        setMessages(rows);
    };

    const sendImage = async () => {
        if (!selectedArchive || !selectedManager || !imageUrl.trim()) return;
        if (!isConversationAligned) {
            alert('当前发送身份与该用户绑定的健康管家不一致，请先切换到已绑定管家或先改派后再发送。');
            return;
        }
        await sendMessage({
            senderId: selectedManager.id,
            senderRole: 'manager',
            receiverId: selectedArchive.checkup_id,
            content: '图片消息',
            messageType: 'image',
            mediaUrl: imageUrl.trim(),
        });
        setImageUrl('');
        const rows = await fetchMessages(selectedArchive.checkup_id, selectedManager.id);
        setMessages(rows);
    };

    const sendRecommendation = async () => {
        if (!selectedArchive || !selectedManager || !selectedResource) return;
        if (!isConversationAligned) {
            alert('当前发送身份与该用户绑定的健康管家不一致，请先切换到已绑定管家或先改派后再发送。');
            return;
        }
        const isDoctor = selectedResource.type === 'doctor';
        await sendMessage({
            senderId: selectedManager.id,
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
            details: `健康管家 ${selectedManager.title} 推荐`,
        });
        setSelectedResourceId('');
        const rows = await fetchMessages(selectedArchive.checkup_id, selectedManager.id);
        setMessages(rows);
    };

    return (
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-[calc(100vh-210px)] min-h-[560px]">
            <h3 className="text-lg font-bold text-slate-800 mb-3">健康管家工作台</h3>
            <div className="grid grid-cols-12 gap-4 h-[calc(100%-36px)]">
                <div className="col-span-3 border border-slate-200 rounded-xl p-3 flex flex-col min-h-0">
                    <label className="text-xs font-bold text-slate-600 mb-1">健康管家</label>
                    <select
                        className="border border-slate-300 rounded-lg p-2 text-sm mb-3"
                        value={selectedManagerId}
                        onChange={(e) => setSelectedManagerId(e.target.value)}
                    >
                        <option value="">请选择</option>
                        {managers.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.title}
                            </option>
                        ))}
                    </select>
                    <div className="text-xs text-slate-500 mb-2">用户池（可直接改派）</div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {filteredArchives.map((a) => (
                            <div
                                key={a.checkup_id}
                                className={`rounded-lg border p-2 cursor-pointer ${
                                    selectedArchiveId === a.checkup_id ? 'border-teal-400 bg-teal-50' : 'border-slate-200'
                                }`}
                                onClick={() => {
                                    setSelectedArchiveId(a.checkup_id);
                                    if (a.health_manager_content_id) {
                                        setSelectedManagerId(a.health_manager_content_id);
                                    }
                                }}
                            >
                                <div className="text-sm font-bold text-slate-800">{a.name}</div>
                                <div className="text-[11px] text-slate-500">{a.department} · {a.risk_level}</div>
                                <div className="mt-1">
                                    <select
                                        className="w-full border border-slate-200 rounded p-1 text-[11px]"
                                        value={a.health_manager_content_id || ''}
                                        onChange={(e) => assignManager(a, e.target.value)}
                                        disabled={savingAssignId === a.checkup_id}
                                    >
                                        <option value="">未分配</option>
                                        {managers.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))}
                        {!filteredArchives.length && (
                            <div className="text-center text-xs text-slate-400 py-8">{loading ? '加载中...' : '暂无用户'}</div>
                        )}
                    </div>
                </div>
                <div className="col-span-9 border border-slate-200 rounded-xl p-3 flex flex-col min-h-0">
                    {!selectedArchive || !selectedManager ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">请选择管家和用户</div>
                    ) : (
                        <>
                            <div className="pb-2 border-b border-slate-100">
                                <div className="font-bold text-slate-800">{selectedArchive.name}</div>
                                <div className="text-xs text-slate-500">
                                    健康管家：{selectedManager.title} · {selectedArchive.phone || '无电话'}
                                </div>
                                {!isConversationAligned && (
                                    <div className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                                        当前身份与用户已绑定管家不一致，发送后用户端可能不可见。请切换到已绑定管家或先改派。
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto py-3 space-y-2">
                                {messages.map((m) => {
                                    const isMine = m.senderId === selectedManager.id;
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

