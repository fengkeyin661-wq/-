
import React, { useState, useEffect, useMemo } from 'react';
import { fetchContent, ContentItem, fetchInteractions, saveInteraction, InteractionItem, updateInteractionStatus, saveContent } from '../../services/contentService';
import { HealthAssessment } from '../../types';

interface Props {
    userId?: string;
    userName?: string;
    assessment?: HealthAssessment; 
}

interface EventWithStatus extends ContentItem {
    currentSignups: number;
    isSignedUp: boolean;
    signupStatus: 'open' | 'full' | 'joined' | 'pending' | 'ended';
}

const getCommunityIcon = (title: string, type: 'event' | 'circle'): string => {
    const t = title.toLowerCase();
    if (type === 'event') {
        if (t.includes('讲座') || t.includes('课') || t.includes('培训')) return '🎤';
        if (t.includes('义诊')) return '🩺';
        if (t.includes('运动') || t.includes('比赛')) return '🏆';
        return '✨';
    } else {
        if (t.includes('减重') || t.includes('瘦')) return '⚖️';
        if (t.includes('糖') || t.includes('慢病')) return '🩸';
        if (t.includes('运动') || t.includes('走')) return '👟';
        return '⭕';
    }
};

export const UserCommunity: React.FC<Props> = ({ userId, userName, assessment }) => {
    const [allEvents, setAllEvents] = useState<EventWithStatus[]>([]);
    const [allCircles, setAllCircles] = useState<ContentItem[]>([]);
    const [myJoinRequests, setMyJoinRequests] = useState<InteractionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');

    // Circle Creation Form State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCircle, setNewCircle] = useState({ title: '', description: '', tags: '互助', image: '⭕' });

    // Circle Management State
    const [managingCircleId, setManagingCircleId] = useState<string | null>(null);
    const [allPendingJoins, setAllPendingJoins] = useState<InteractionItem[]>([]);

    useEffect(() => {
        loadData();
    }, [userId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [eventsData, circlesData, inters] = await Promise.all([
                fetchContent('event', 'active'),
                fetchContent('circle'),
                fetchInteractions()
            ]);

            setAllPendingJoins(inters.filter(i => i.type === 'circle_join' && i.status === 'pending'));
            setMyJoinRequests(inters.filter(i => i.userId === userId));

            const processedEvents = eventsData.map(evt => {
                const evtSignups = inters.filter(i => i.type === 'event_signup' && i.targetId === evt.id && i.status !== 'cancelled');
                const mySign = userId ? evtSignups.find(i => i.userId === userId) : null;
                return {
                    ...evt,
                    currentSignups: evtSignups.length,
                    isSignedUp: !!mySign,
                    signupStatus: mySign?.status === 'confirmed' ? 'joined' : mySign?.status === 'pending' ? 'pending' : 'open'
                } as EventWithStatus;
            });

            setAllEvents(processedEvents);
            setAllCircles(circlesData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCircle = async () => {
        if (!newCircle.title || !newCircle.description) return alert("请填写完整内容");
        if (!userId) return;

        const res = await saveContent({
            id: `circle_${Date.now()}`,
            type: 'circle',
            title: newCircle.title,
            description: newCircle.description,
            tags: newCircle.tags.split(/[，,]/),
            image: newCircle.image,
            status: 'pending', // 初始待审核
            updatedAt: new Date().toISOString(),
            details: {
                creatorId: userId,
                creatorName: userName,
                creatorRole: 'user',
                memberCount: 1
            }
        });

        if (res.success) {
            alert("发起成功！请等待健康中心管理员审核上架。");
            setShowCreateModal(false);
            loadData();
        }
    };

    const handleJoinCircle = async (circle: ContentItem) => {
        if (!userId || !userName) return alert("请先登录");
        const alreadyApplied = myJoinRequests.some(r => r.targetId === circle.id && r.status !== 'cancelled');
        if (alreadyApplied) return alert("您已提交过申请");

        const success = await saveInteraction({
            id: `join_${Date.now()}`,
            type: 'circle_join',
            userId, userName,
            targetId: circle.id,
            targetName: circle.title,
            status: 'pending',
            date: new Date().toISOString().split('T')[0],
            details: `申请加入圈子: ${circle.title}`
        });

        if (success) {
            alert("申请已发送，请等待圈主确认。");
            loadData();
        }
    };

    const handleAuditJoin = async (reqId: string, pass: boolean) => {
        await updateInteractionStatus(reqId, pass ? 'confirmed' : 'cancelled');
        loadData();
    };

    const myInitiatedCircles = allCircles.filter(c => c.details?.creatorId === userId);
    const activeCircles = allCircles.filter(c => c.status === 'active');

    return (
        <div className="min-h-full bg-slate-50 pb-24 animate-fadeIn">
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h1 className="text-xl font-black text-slate-800">健康社区</h1>
                    <div className="flex gap-4 mt-2">
                        <button onClick={() => setActiveTab('all')} className={`text-xs font-bold transition-all ${activeTab==='all'?'text-teal-600 border-b-2 border-teal-500':'text-slate-400'}`}>全部圈子</button>
                        <button onClick={() => setActiveTab('my')} className={`text-xs font-bold transition-all ${activeTab==='my'?'text-teal-600 border-b-2 border-teal-500':'text-slate-400'}`}>
                            我管理的 {myInitiatedCircles.length > 0 && <span className="bg-red-500 text-white px-1 rounded-full text-[8px]">{myInitiatedCircles.length}</span>}
                        </button>
                    </div>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg active:scale-95 transition-transform flex items-center gap-1">
                    <span>➕</span> 发起圈子
                </button>
            </div>

            <div className="p-4 space-y-6">
                {activeTab === 'all' ? (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            {activeCircles.map(c => (
                                <div key={c.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
                                    <div className="text-4xl mb-2">{c.image || '⭕'}</div>
                                    <div className="font-bold text-slate-800 text-sm mb-1">{c.title}</div>
                                    <div className="text-[10px] text-slate-400 mb-3 line-clamp-1">{c.description}</div>
                                    <button 
                                        onClick={() => handleJoinCircle(c)}
                                        className="w-full py-1.5 bg-teal-50 text-teal-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-teal-100 transition-colors"
                                    >
                                        申请加入
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="space-y-4">
                        {myInitiatedCircles.length === 0 ? (
                            <div className="text-center py-20 text-slate-400">您还没有发起的圈子</div>
                        ) : (
                            myInitiatedCircles.map(c => {
                                const pendingMembers = allPendingJoins.filter(p => p.targetId === c.id);
                                return (
                                    <div key={c.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="text-3xl">{c.image}</div>
                                                <div>
                                                    <div className="font-bold text-slate-800">{c.title}</div>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {c.status === 'active' ? '已上架' : '审核中'}
                                                    </span>
                                                </div>
                                            </div>
                                            <button onClick={() => setManagingCircleId(managingCircleId === c.id ? null : c.id)} className="text-teal-600 text-xs font-bold">
                                                管理成员 ({pendingMembers.length})
                                            </button>
                                        </div>
                                        
                                        {managingCircleId === c.id && (
                                            <div className="mt-4 pt-4 border-t border-slate-50 space-y-3 animate-slideUp">
                                                <div className="text-[10px] text-slate-400 font-bold uppercase mb-2">待审批入圈申请</div>
                                                {pendingMembers.length === 0 ? (
                                                    <div className="text-center py-4 text-xs text-slate-300">暂无申请</div>
                                                ) : pendingMembers.map(m => (
                                                    <div key={m.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-700">{m.userName}</div>
                                                            <div className="text-[10px] text-slate-400">{m.date} 申请</div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleAuditJoin(m.id, false)} className="px-3 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg text-xs font-bold">拒绝</button>
                                                            <button onClick={() => handleAuditJoin(m.id, true)} className="px-3 py-1 bg-teal-600 text-white rounded-lg text-xs font-bold">通过</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-scaleIn">
                        <h3 className="text-xl font-black text-slate-800 mb-6 text-center">发起新圈子</h3>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">圈子名称</label>
                                <input className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none" placeholder="如：高血压病友交流" value={newCircle.title} onChange={e => setNewCircle({...newCircle, title: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">圈子宗旨 / 简介</label>
                                <textarea className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none h-24" placeholder="描述这个圈子的目的，鼓励大家加入..." value={newCircle.description} onChange={e => setNewCircle({...newCircle, description: e.target.value})} />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">图标 (Emoji)</label>
                                    <input className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm text-center" value={newCircle.image} onChange={e => setNewCircle({...newCircle, image: e.target.value})} />
                                </div>
                                <div className="flex-[2]">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">核心标签</label>
                                    <input className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm" placeholder="如：慢病, 运动" value={newCircle.tags} onChange={e => setNewCircle({...newCircle, tags: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setShowCreateModal(false)} className="flex-1 py-4 text-slate-400 font-bold">取消</button>
                            <button onClick={handleCreateCircle} className="flex-[2] bg-teal-600 text-white py-4 rounded-3xl font-black text-sm shadow-xl shadow-teal-100 active:scale-95 transition-all">提交审核</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
