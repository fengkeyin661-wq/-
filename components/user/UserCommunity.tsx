
import React, { useState, useEffect, useMemo } from 'react';
import { fetchContent, ContentItem, fetchInteractions, saveInteraction, InteractionItem } from '../../services/contentService';
import { HealthAssessment } from '../../types';

interface Props {
    userId?: string;
    userName?: string;
    assessment?: HealthAssessment; // Added
}

interface EventWithStatus extends ContentItem {
    currentSignups: number;
    isSignedUp: boolean;
    signupStatus: 'open' | 'full' | 'joined' | 'ended';
}

// Score Logic
const scoreEvent = (item: ContentItem, risks: string[]) => {
    let score = 0;
    const text = (item.title + (item.tags?.join(' ') || '') + (item.description || '')).toLowerCase();
    
    // Simple Keywords
    const keywords = ['运动', '饮食', '慢病', '心理', '减重', '讲座'];
    
    risks.forEach(r => {
        if (text.includes(r.replace('风险',''))) score += 2;
    });
    
    // Promote new items slightly
    if (new Date().getTime() - new Date(item.updatedAt).getTime() < 7 * 24 * 3600 * 1000) score += 0.5;

    return score + Math.random();
};

export const UserCommunity: React.FC<Props> = ({ userId, userName, assessment }) => {
    const [allEvents, setAllEvents] = useState<EventWithStatus[]>([]);
    const [allCircles, setAllCircles] = useState<ContentItem[]>([]);
    
    const [displayedEvents, setDisplayedEvents] = useState<EventWithStatus[]>([]);
    
    const [activeTab, setActiveTab] = useState<'all' | 'lecture' | 'activity'>('all');
    const [loading, setLoading] = useState(true);
    
    // Search & Expand State
    const [searchTerm, setSearchTerm] = useState('');
    const [showAllEvents, setShowAllEvents] = useState(false);

    // Modal State
    const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

    useEffect(() => {
        loadData();
    }, [userId]);

    useEffect(() => {
        if (allEvents.length > 0) refreshRecommendations();
    }, [allEvents, assessment]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Resources
            const [eventsData, circlesData] = await Promise.all([
                fetchContent('event', 'active'),
                fetchContent('circle', 'active')
            ]);

            // 2. Fetch Interactions (Signups)
            const interactions = await fetchInteractions('event_signup');

            // 3. Process Events with Status
            const processedEvents = eventsData.map(evt => {
                const evtSignups = interactions.filter(i => i.targetId === evt.id && i.status !== 'cancelled');
                const count = evtSignups.length;
                const limit = Number(evt.details?.limit) || 100;
                const isSigned = userId ? evtSignups.some(i => i.userId === userId) : false;
                
                // Determine Status
                let status: 'open' | 'full' | 'joined' | 'ended' = 'open';
                if (isSigned) status = 'joined';
                else if (count >= limit) status = 'full';
                else if (evt.details?.businessStatus === '已结束' || evt.details?.businessStatus === '已截止') status = 'ended';

                return {
                    ...evt,
                    currentSignups: count,
                    isSignedUp: isSigned,
                    signupStatus: status
                };
            });

            setAllEvents(processedEvents);
            setAllCircles(circlesData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const refreshRecommendations = () => {
        const risks = assessment ? [...assessment.risks.red, ...assessment.risks.yellow] : [];
        const sorted = [...allEvents].sort((a, b) => scoreEvent(b, risks) - scoreEvent(a, risks));
        
        // Pick top 10 pool, randomly select 4
        const topPool = sorted.slice(0, Math.min(sorted.length, 10));
        const shuffled = topPool.sort(() => 0.5 - Math.random()).slice(0, 4);
        setDisplayedEvents(shuffled);
    };

    const handleSignup = async (evt: ContentItem) => {
        if (!userId || !userName) return alert("请先登录");
        
        // Cast to check status
        const evtStatus = allEvents.find(e => e.id === evt.id)?.signupStatus;
        if (evtStatus === 'joined') {
            return alert("您已报名参加此活动");
        }

        if (confirm(`确定报名参加【${evt.title}】吗？`)) {
            const success = await saveInteraction({
                id: `signup_${Date.now()}`,
                type: 'event_signup',
                userId,
                userName,
                targetId: evt.id,
                targetName: evt.title,
                status: 'confirmed', // Auto confirm for demo
                date: new Date().toISOString().split('T')[0],
                details: `活动时间: ${evt.details?.date}`
            });

            if (success) {
                alert("报名成功！");
                setSelectedItem(null);
                loadData(); // Refresh UI
            }
        }
    };

    const handleJoinCircle = async (circle: ContentItem) => {
        if (!userId) return alert("请先登录");
        alert(`恭喜！您已成功加入【${circle.title}】圈子。`);
        setSelectedItem(null);
    };

    // Filter Logic
    const contentToRender = useMemo(() => {
        let list = allEvents;
        if (activeTab !== 'all') {
            list = list.filter(e => e.tags.some(t => t.includes(activeTab === 'lecture' ? '讲座' : '活动') || t.includes(activeTab === 'lecture' ? '培训' : '运动')));
        }
        
        if (searchTerm) {
            return list.filter(e => e.title.includes(searchTerm));
        }
        
        if (showAllEvents) return list;
        return displayedEvents;
    }, [allEvents, displayedEvents, activeTab, searchTerm, showAllEvents]);

    const filteredCircles = useMemo(() => {
        if (searchTerm) {
            return allCircles.filter(c => c.title.includes(searchTerm));
        }
        return allCircles;
    }, [allCircles, searchTerm]);

    const featuredEvent = allEvents.find(e => e.tags.includes('推荐') || e.tags.includes('置顶')) || allEvents[0];

    return (
        <div className="min-h-full bg-[#F8FAFC] pb-24">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-100">
                <div className="px-6 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">社区生活</h1>
                        <p className="text-xs text-slate-500 font-medium">发现身边的健康伙伴</p>
                    </div>
                    <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-xl">🎉</div>
                </div>
                {/* Search Bar */}
                <div className="px-6 pb-3">
                    <div className="relative">
                        <input 
                            className="w-full bg-slate-100 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            placeholder="搜索活动、圈子..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-8">
                
                {/* 1. Hero / Featured Event (Hide if searching) */}
                {!searchTerm && featuredEvent && (
                    <section className="animate-fadeIn">
                        <div 
                            onClick={() => setSelectedItem(featuredEvent)}
                            className="w-full bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200 relative overflow-hidden group cursor-pointer transition-transform active:scale-[0.98]"
                        >
                            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start">
                                    <span className="bg-indigo-500/80 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm shadow-sm">
                                        {featuredEvent.tags[0] || '热门活动'}
                                    </span>
                                    {featuredEvent.details?.businessStatus === '报名中' && (
                                        <span className="flex h-2 w-2 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                    )}
                                </div>
                                
                                <h2 className="text-xl font-bold mt-3 mb-2 leading-tight pr-4">{featuredEvent.title}</h2>
                                <p className="text-slate-300 text-xs mb-4 line-clamp-2">{featuredEvent.description}</p>
                                
                                <div className="flex items-center gap-4 text-xs text-slate-300 mb-4">
                                    <div className="flex items-center gap-1">
                                        <span>📅</span>
                                        <span>{featuredEvent.details?.date ? new Date(featuredEvent.details.date).toLocaleDateString() : '待定'}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span>📍</span>
                                        <span>{featuredEvent.details?.loc || '线上'}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-end">
                                    <div className="flex -space-x-2">
                                        {[1,2,3].map(i => <div key={i} className="w-7 h-7 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-[10px]">👤</div>)}
                                        <div className="w-7 h-7 rounded-full bg-indigo-600 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold">
                                            +{featuredEvent.currentSignups}
                                        </div>
                                    </div>
                                    <button className="bg-white text-slate-900 px-5 py-2 rounded-full text-xs font-bold hover:bg-slate-200 transition-colors shadow-lg">
                                        {featuredEvent.signupStatus === 'joined' ? '已报名' : '立即报名'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* 2. Circles (Horizontal Scroll) */}
                <section>
                    <div className="flex justify-between items-center mb-4 px-1">
                        <h2 className="text-lg font-bold text-slate-800">加入圈子</h2>
                        <span className="text-xs text-slate-400 font-bold">
                            {filteredCircles.length} 个结果
                        </span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide snap-x">
                        {filteredCircles.map((g, i) => (
                            <div key={g.id} onClick={() => setSelectedItem(g)} className="snap-center flex-shrink-0 flex flex-col items-center justify-center w-28 h-32 bg-white border border-slate-100 shadow-[0_4px_12px_rgb(0,0,0,0.02)] rounded-2xl cursor-pointer active:scale-95 transition-transform relative group">
                                <span className="absolute top-2 right-2 text-[10px] text-slate-300 font-mono">#{i+1}</span>
                                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">{g.image}</div>
                                <span className="text-sm font-bold text-slate-700 mb-1">{g.title}</span>
                                <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                                    {g.details?.memberCount || 0} 成员
                                </span>
                            </div>
                        ))}
                        {filteredCircles.length === 0 && <div className="text-sm text-slate-400 w-full text-center py-4">无匹配圈子</div>}
                    </div>
                </section>

                {/* 3. Events List */}
                <section>
                    <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-1">
                        <div className="flex gap-4">
                            {[{ id: 'all', label: '全部' }, { id: 'lecture', label: '讲座' }, { id: 'activity', label: '运动' }].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`pb-2 text-sm font-bold transition-all relative ${
                                        activeTab === tab.id ? 'text-slate-800' : 'text-slate-400'
                                    }`}
                                >
                                    {tab.label}
                                    {activeTab === tab.id && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-1 bg-indigo-600 rounded-full"></span>}
                                </button>
                            ))}
                        </div>
                        {!searchTerm && !showAllEvents && (
                            <button onClick={() => refreshRecommendations()} className="text-xs text-slate-500 font-bold flex items-center gap-1 active:scale-95 transition-transform">
                                🔄 换一换
                            </button>
                        )}
                    </div>

                    <div className="space-y-5">
                        {loading ? (
                            <div className="text-center py-10 text-slate-400 text-sm">加载中...</div>
                        ) : contentToRender.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                暂无相关活动
                            </div>
                        ) : (
                            contentToRender.map(evt => {
                                const limit = Number(evt.details?.limit) || 100;
                                const progress = Math.min((evt.currentSignups / limit) * 100, 100);
                                
                                return (
                                    <div key={evt.id} onClick={() => setSelectedItem(evt)} className="bg-white rounded-2xl p-5 shadow-[0_2px_15px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col gap-4 animate-slideUp cursor-pointer hover:shadow-md transition-shadow">
                                        {/* Header */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-3">
                                                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-2xl shrink-0">
                                                    {evt.image}
                                                </div>
                                                <div>
                                                    <div className="flex gap-2 items-center mb-1">
                                                        <h3 className="font-bold text-slate-800 text-base line-clamp-1">{evt.title}</h3>
                                                        {evt.tags[0] && <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold">{evt.tags[0]}</span>}
                                                    </div>
                                                    <p className="text-xs text-slate-500 line-clamp-1">{evt.description}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className={`text-[10px] px-2 py-1 rounded font-bold ${
                                                    evt.signupStatus === 'joined' ? 'bg-green-100 text-green-700' :
                                                    evt.signupStatus === 'full' ? 'bg-slate-100 text-slate-500' :
                                                    evt.signupStatus === 'ended' ? 'bg-slate-100 text-slate-400' :
                                                    'bg-blue-50 text-blue-600'
                                                }`}>
                                                    {evt.signupStatus === 'joined' ? '已报名' : 
                                                     evt.signupStatus === 'full' ? '名额已满' :
                                                     evt.signupStatus === 'ended' ? '已结束' : '报名中'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {/* Info Grid */}
                                        <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-2 gap-y-2 gap-x-4">
                                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                                <span className="text-slate-400">🕒</span>
                                                <span className="truncate">{evt.details?.date ? evt.details.date.replace('T', ' ') : '时间待定'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                                <span className="text-slate-400">📍</span>
                                                <span className="truncate">{evt.details?.loc || '线上'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-600 col-span-2 border-t border-slate-200 pt-2 mt-1">
                                                <span className="text-slate-400">👨‍🏫</span>
                                                <span>主讲人: <span className="font-bold text-slate-800">{evt.details?.speaker || '特邀专家'}</span></span>
                                            </div>
                                        </div>

                                        {/* Action Bar */}
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1">
                                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                                    <span>已报名 {evt.currentSignups}</span>
                                                    <span>剩余 {Math.max(0, limit - evt.currentSignups)}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                            progress >= 100 ? 'bg-red-400' : 'bg-indigo-500'
                                                        }`} 
                                                        style={{ width: `${progress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                            <button 
                                                disabled={evt.signupStatus !== 'open'}
                                                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0 ${
                                                    evt.signupStatus === 'open' 
                                                    ? 'bg-slate-900 text-white hover:bg-slate-800' 
                                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                                }`}
                                            >
                                                {evt.signupStatus === 'joined' ? '查看详情' : '立即报名'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        
                        {!searchTerm && (
                            <button 
                                onClick={() => setShowAllEvents(!showAllEvents)}
                                className="w-full text-xs text-slate-500 font-bold bg-white border border-slate-200 py-3 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm"
                            >
                                {showAllEvents ? '收起列表 ⬆️' : `查看全部活动 ⬇️`}
                            </button>
                        )}
                    </div>
                </section>
            </div>

            {/* Detail Modal */}
            {selectedItem && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-end justify-center backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedItem(null)}>
                    <div className="bg-white w-full max-w-md rounded-t-3xl p-0 animate-slideUp overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        
                        {/* Modal Header */}
                        <div className="bg-slate-50 p-6 pb-8 text-center relative border-b border-slate-100">
                            <button 
                                onClick={() => setSelectedItem(null)}
                                className="absolute top-4 right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-400 font-bold shadow-sm z-10"
                            >
                                ×
                            </button>
                            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-5xl shadow-sm mx-auto mb-4">
                                {selectedItem.image}
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-1">{selectedItem.title}</h3>
                            <div className="flex items-center justify-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${selectedItem.type === 'event' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {selectedItem.type === 'event' ? '社区活动' : '兴趣圈子'}
                                </span>
                                {selectedItem.details?.memberCount && (
                                    <span className="text-xs text-slate-500">{selectedItem.details.memberCount} 成员</span>
                                )}
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            {/* Tags */}
                            <div className="flex flex-wrap gap-2 justify-center">
                                {selectedItem.tags.map(t => <span key={t} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs">{t}</span>)}
                            </div>

                            {/* Info */}
                            {selectedItem.type === 'event' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-3 rounded-xl">
                                        <div className="text-xs text-slate-400 mb-1">时间</div>
                                        <div className="font-bold text-slate-800 text-sm">
                                            {selectedItem.details?.date ? new Date(selectedItem.details.date).toLocaleString([], {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}) : '待定'}
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl">
                                        <div className="text-xs text-slate-400 mb-1">地点</div>
                                        <div className="font-bold text-slate-800 text-sm line-clamp-2">
                                            {selectedItem.details?.loc || '线上'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <h4 className="font-bold text-slate-800 text-sm mb-2">{selectedItem.type === 'circle' ? '圈子介绍' : '活动详情'}</h4>
                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl whitespace-pre-line">
                                    {selectedItem.description || selectedItem.details?.content || '暂无详细介绍'}
                                </p>
                            </div>

                            {selectedItem.type === 'event' && selectedItem.details?.speaker && (
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm mb-2">主讲/负责人</h4>
                                    <div className="flex items-center gap-3 bg-white border border-slate-100 p-3 rounded-xl shadow-sm">
                                        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">👤</div>
                                        <span className="font-bold text-slate-700">{selectedItem.details.speaker}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Action */}
                        <div className="p-4 border-t border-slate-100 bg-white">
                            {selectedItem.type === 'event' ? (
                                <button 
                                    onClick={() => handleSignup(selectedItem)}
                                    className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <span>✍️</span> 立即报名
                                </button>
                            ) : (
                                <button 
                                    onClick={() => handleJoinCircle(selectedItem)}
                                    className="w-full bg-orange-500 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-orange-200 hover:bg-orange-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <span>➕</span> 加入圈子
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
