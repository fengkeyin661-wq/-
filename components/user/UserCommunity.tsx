
import React, { useState, useEffect, useMemo } from 'react';
import { fetchContent, ContentItem, fetchInteractions, saveInteraction, InteractionItem, updateInteractionStatus, saveContent } from '../../services/contentService';
import { HealthAssessment } from '../../types';

interface Props {
    userId?: string;
    userName?: string;
    assessment?: HealthAssessment; 
}

export const UserCommunity: React.FC<Props> = ({ userId, userName, assessment }) => {
    const [allEvents, setAllEvents] = useState<ContentItem[]>([]);
    const [allCircles, setAllCircles] = useState<ContentItem[]>([]);
    const [myInteractions, setMyInteractions] = useState<InteractionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'events' | 'circles' | 'manage'>('events');

    // 发起圈子表单
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCircle, setNewCircle] = useState({ title: '', description: '', tags: '互助', image: '⭕' });

    useEffect(() => {
        loadData();
    }, [userId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [eventsData, circlesData, inters] = await Promise.all([
                fetchContent('event', 'active'), // 只获取已上架的活动
                fetchContent('circle'),          // 获取圈子（包含审核中和已上架）
                fetchInteractions()
            ]);

            setMyInteractions(inters.filter(i => i.userId === userId));
            setAllEvents(eventsData);
            setAllCircles(circlesData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // 智能排序：匹配用户风险关键词的活动排在前面
    const recommendedEvents = useMemo(() => {
        if (!assessment) return allEvents;
        const risks = [...assessment.risks.red, ...assessment.risks.yellow].join('');
        return [...allEvents].sort((a, b) => {
            const aMatch = risks.includes(a.title) || a.tags.some(t => risks.includes(t));
            const bMatch = risks.includes(b.title) || b.tags.some(t => risks.includes(t));
            return (aMatch === bMatch) ? 0 : aMatch ? -1 : 1;
        });
    }, [allEvents, assessment]);

    const handleCreateCircle = async () => {
        if (!newCircle.title || !newCircle.description) return alert("请填写完整内容");
        if (!userId) return;

        await saveContent({
            id: `circle_${Date.now()}`,
            type: 'circle',
            title: newCircle.title,
            description: newCircle.description,
            tags: newCircle.tags.split(/[，,]/),
            image: newCircle.image,
            status: 'pending',
            updatedAt: new Date().toISOString(),
            details: { creatorId: userId, creatorName: userName, creatorRole: 'user' }
        });

        alert("发起成功！请等待健康中心审核上架。");
        setShowCreateModal(false);
        loadData();
    };

    const handleApply = async (item: ContentItem) => {
        const type = item.type === 'event' ? 'event_signup' : 'circle_join';
        const label = item.type === 'event' ? '活动报名' : '申请加入';
        
        if (myInteractions.some(i => i.targetId === item.id && i.status !== 'cancelled')) {
            return alert(`您已提交过${label}，请勿重复操作。`);
        }

        await saveInteraction({
            id: `${type}_${Date.now()}`,
            type: type,
            userId: userId!,
            userName: userName!,
            targetId: item.id,
            targetName: item.title,
            status: 'pending',
            date: new Date().toISOString().split('T')[0],
            details: `${label}: ${item.title}`
        });
        alert(`${label}已提交。`);
        loadData();
    };

    const myManagedCircles = allCircles.filter(c => c.details?.creatorId === userId);

    return (
        <div className="min-h-full bg-slate-50 pb-28 animate-fadeIn">
            {/* 顶部切换导航 */}
            <div className="bg-white px-6 pt-4 border-b border-slate-100 sticky top-0 z-20">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-black text-slate-800">健康社区</h1>
                    <button onClick={() => setShowCreateModal(true)} className="bg-teal-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-teal-100 active:scale-95 transition-transform">
                        ➕ 发起圈子
                    </button>
                </div>
                <div className="flex gap-6">
                    {[
                        { id: 'events', label: '健康活动', icon: '✨' },
                        { id: 'circles', label: '兴趣圈子', icon: '⭕' },
                        { id: 'manage', label: '我的管理', icon: '👤', count: myManagedCircles.length }
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`pb-3 text-sm font-bold flex items-center gap-1 transition-all relative ${activeTab === tab.id ? 'text-teal-600' : 'text-slate-400'}`}
                        >
                            <span>{tab.icon}</span> {tab.label}
                            {tab.count ? <span className="bg-red-500 text-white text-[8px] px-1 rounded-full">{tab.count}</span> : null}
                            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-500 rounded-t-full"></div>}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 space-y-4">
                {activeTab === 'events' && (
                    <div className="space-y-4">
                        {recommendedEvents.map(ev => (
                            <div key={ev.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex gap-4 hover:border-teal-200 transition-colors">
                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-4xl shrink-0">
                                    {ev.image || '📅'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-slate-800 truncate">{ev.title}</h3>
                                        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase">官方活动</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{ev.description}</p>
                                    <div className="flex justify-between items-center mt-3">
                                        <div className="flex gap-1">
                                            {ev.tags.slice(0,2).map(t => <span key={t} className="text-[9px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded">#{t}</span>)}
                                        </div>
                                        <button 
                                            onClick={() => handleApply(ev)}
                                            className="bg-slate-900 text-white text-[10px] font-black px-4 py-1.5 rounded-lg active:scale-95 transition-transform"
                                        >
                                            立即报名
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'circles' && (
                    <div className="grid grid-cols-2 gap-3">
                        {allCircles.filter(c => c.status === 'active').map(c => (
                            <div key={c.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center text-center group active:scale-95 transition-transform">
                                <div className="text-5xl mb-3 group-hover:rotate-12 transition-transform">{c.image || '⭕'}</div>
                                <h3 className="font-bold text-slate-800 text-sm mb-1">{c.title}</h3>
                                <p className="text-[10px] text-slate-400 mb-4 line-clamp-1">{c.description}</p>
                                <button 
                                    onClick={() => handleApply(c)}
                                    className="w-full py-2 bg-teal-50 text-teal-600 rounded-xl text-[11px] font-black hover:bg-teal-100 transition-colors"
                                >
                                    申请加入
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'manage' && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 p-4 rounded-2xl text-blue-800 text-xs leading-relaxed border border-blue-100">
                             💡 您作为圈主发起的圈子在这里展示。审核通过后将正式公开展示给全校职工。
                        </div>
                        {myManagedCircles.map(c => (
                            <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="text-3xl">{c.image}</div>
                                        <div>
                                            <div className="font-bold text-slate-800">{c.title}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{c.description}</div>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] px-2 py-1 rounded font-black ${
                                        c.status === 'active' ? 'bg-green-100 text-green-700' : 
                                        c.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {c.status === 'active' ? '已上架' : c.status === 'pending' ? '审核中' : '已下架'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 发起圈子弹窗 */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 animate-scaleIn">
                        <h3 className="text-xl font-black text-slate-800 mb-6 text-center">发起健康互助圈</h3>
                        <div className="space-y-5">
                            <input className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm outline-none" placeholder="圈子名称..." value={newCircle.title} onChange={e => setNewCircle({...newCircle, title: e.target.value})} />
                            <textarea className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm h-24 outline-none" placeholder="圈子目标/简介..." value={newCircle.description} onChange={e => setNewCircle({...newCircle, description: e.target.value})} />
                            <div className="flex gap-4">
                                <div className="flex-1"><label className="text-[10px] font-bold text-slate-400 block mb-1">图标</label><input className="w-full bg-slate-50 rounded-xl p-3 text-center" value={newCircle.image} onChange={e => setNewCircle({...newCircle, image: e.target.value})} /></div>
                                <div className="flex-[2]"><label className="text-[10px] font-bold text-slate-400 block mb-1">标签</label><input className="w-full bg-slate-50 rounded-xl p-3" value={newCircle.tags} onChange={e => setNewCircle({...newCircle, tags: e.target.value})} /></div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setShowCreateModal(false)} className="flex-1 py-4 text-slate-400 font-bold">取消</button>
                            <button onClick={handleCreateCircle} className="flex-[2] bg-teal-600 text-white py-4 rounded-3xl font-black shadow-lg">提交申请</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
