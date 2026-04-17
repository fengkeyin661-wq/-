
import React, { useState, useEffect, useMemo } from 'react';
import { HealthAssessment, HealthRecord } from '../../types';
import { fetchContent, ContentItem, fetchInteractions, saveInteraction, InteractionItem } from '../../services/contentService';
import { ResourceCover } from './ResourceCover';

interface Props {
    assessment?: HealthAssessment;
    userCheckupId?: string;
    userName?: string;
    record?: HealthRecord;
}

type ResourceCategory = 'all' | 'meal' | 'exercise' | 'service' | 'event';

const CATEGORY_CONFIG: { id: ResourceCategory; label: string; icon: string; color: string }[] = [
    { id: 'all', label: '全部推荐', icon: '✨', color: 'bg-slate-800' },
    { id: 'meal', label: '饮食方案', icon: '🥗', color: 'bg-orange-500' },
    { id: 'exercise', label: '运动推荐', icon: '🏃', color: 'bg-green-500' },
    { id: 'service', label: '医疗服务', icon: '🏥', color: 'bg-blue-500' },
    { id: 'event', label: '健康活动', icon: '🎉', color: 'bg-purple-500' },
];

const getSmartIcon = (item: ContentItem): string => {
    const t = item.title.toLowerCase();
    if (item.type === 'meal') {
        if (t.includes('鸡') || t.includes('肉')) return '🥩';
        if (t.includes('鱼') || t.includes('海鲜')) return '🐟';
        if (t.includes('面') || t.includes('饭') || t.includes('粥')) return '🍜';
        if (t.includes('沙拉') || t.includes('蔬')) return '🥗';
        if (t.includes('果')) return '🍎';
        return '🍱';
    }
    if (item.type === 'exercise') {
        if (t.includes('跑') || t.includes('走')) return '🏃';
        if (t.includes('瑜伽')) return '🧘';
        if (t.includes('泳')) return '🏊';
        if (t.includes('球')) return '🏀';
        return '💪';
    }
    if (item.type === 'service') return '🏥';
    if (item.type === 'event') return '🎉';
    if (item.type === 'doctor') return '👨‍⚕️';
    if (item.type === 'drug') return '💊';
    return '✨';
};

// AI 评分逻辑：根据用户风险匹配资源
const scoreResource = (item: ContentItem, assessment?: HealthAssessment): { score: number; reason: string } => {
    if (!assessment) return { score: Math.random(), reason: '通用推荐' };
    
    const risks = [...(assessment.risks.red || []), ...(assessment.risks.yellow || [])];
    const summary = assessment.summary || '';
    const text = (item.title + (item.description || '') + (item.tags?.join(' ') || '')).toLowerCase();
    
    let score = 0;
    let matchedKey = '';
    
    const keywords: { key: string; weight: number }[] = [
        { key: '高血压', weight: 3 },
        { key: '血压', weight: 2 },
        { key: '糖尿病', weight: 3 },
        { key: '血糖', weight: 2 },
        { key: '血脂', weight: 2 },
        { key: '胆固醇', weight: 2 },
        { key: '尿酸', weight: 2 },
        { key: '痛风', weight: 2 },
        { key: '肥胖', weight: 2 },
        { key: '超重', weight: 2 },
        { key: '结节', weight: 1.5 },
        { key: '脂肪肝', weight: 2 },
        { key: '心脏', weight: 2 },
        { key: '肝', weight: 1.5 },
        { key: '胃', weight: 1.5 },
        { key: '睡眠', weight: 1.5 },
        { key: '颈椎', weight: 1.5 },
        { key: '减重', weight: 2 },
        { key: '低脂', weight: 1.5 },
        { key: '低糖', weight: 1.5 },
        { key: '有氧', weight: 1.5 },
    ];
    
    keywords.forEach(({ key, weight }) => {
        const inRisk = risks.some(r => r.includes(key)) || summary.includes(key);
        const inResource = text.includes(key);
        if (inRisk && inResource) {
            score += weight;
            if (!matchedKey) matchedKey = key;
        }
    });
    
    // 基础随机因子，避免完全相同
    score += Math.random() * 0.5;
    
    const reason = matchedKey ? `针对您的「${matchedKey}」风险推荐` : '通用健康推荐';
    return { score, reason };
};

export const UserHealthResources: React.FC<Props> = ({ assessment, userCheckupId, userName, record }) => {
    const [allResources, setAllResources] = useState<ContentItem[]>([]);
    const [allInteractions, setAllInteractions] = useState<InteractionItem[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [activeCategory, setActiveCategory] = useState<ResourceCategory>('all');
    const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

    useEffect(() => {
        loadResources();
    }, []);

    const loadResources = async () => {
        setLoading(true);
        try {
            const [meals, exercises, services, events, interactions] = await Promise.all([
                fetchContent('meal', 'active'),
                fetchContent('exercise', 'active'),
                fetchContent('service', 'active'),
                fetchContent('event', 'active'),
                fetchInteractions()
            ]);
            setAllResources([...meals, ...exercises, ...services, ...events]);
            setAllInteractions(interactions);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // AI 推荐排序
    const recommendedResources = useMemo(() => {
        let list = [...allResources];
        
        // 按类别筛选
        if (activeCategory !== 'all') {
            list = list.filter(item => item.type === activeCategory);
        }
        
        // AI 评分排序
        const scored = list.map(item => ({
            item,
            ...scoreResource(item, assessment)
        }));
        
        scored.sort((a, b) => b.score - a.score);
        
        return scored.slice(0, 20);
    }, [allResources, activeCategory, assessment]);

    // 按类别分组显示的热门推荐
    const topByCategory = useMemo(() => {
        const result: Record<string, { item: ContentItem; reason: string }[]> = {};
        
        ['meal', 'exercise', 'service', 'event'].forEach(cat => {
            const items = allResources.filter(r => r.type === cat);
            const scored = items.map(item => ({ item, ...scoreResource(item, assessment) }));
            scored.sort((a, b) => b.score - a.score);
            result[cat] = scored.slice(0, 3).map(s => ({ item: s.item, reason: s.reason }));
        });
        
        return result;
    }, [allResources, assessment]);

    const handleInteract = async (type: string, target: ContentItem) => {
        if (!userCheckupId || !userName) {
            return alert('请先在底部「我的」登录后再报名/预约/收藏');
        }
        
        let interactionType: InteractionItem['type'] = 'service_booking';
        let confirmMsg = '';
        let details = '';

        if (target.type === 'event') {
            interactionType = 'event_signup';
            confirmMsg = `确定报名参加【${target.title}】吗？`;
            details = `活动报名`;
        } else if (target.type === 'service') {
            interactionType = 'service_booking';
            confirmMsg = `确定预约服务【${target.title}】吗？`;
            details = `服务预约，价格: ${target.details?.price || '免费'}`;
        } else {
            // meal / exercise 收藏
            confirmMsg = `将【${target.title}】加入您的健康计划？`;
            interactionType = 'service_booking';
            details = `收藏资源: ${target.type}`;
        }

        if (confirm(confirmMsg)) {
            await saveInteraction({
                id: `${interactionType}_${Date.now()}`,
                type: interactionType,
                userId: userCheckupId,
                userName: userName,
                targetId: target.id,
                targetName: target.title,
                status: 'pending',
                date: new Date().toISOString().split('T')[0],
                details
            });
            alert("已提交！");
            setSelectedItem(null);
            fetchInteractions().then(setAllInteractions);
        }
    };

    return (
        <div className="bg-slate-50 min-h-full pb-28">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">健康资源推荐</h1>
                        <p className="mt-1 text-sm text-slate-500">AI根据您的健康档案智能匹配</p>
                    </div>
                    <div className="bg-teal-50 px-3 py-1.5 rounded-full flex items-center gap-1">
                        <span className="text-lg">✨</span>
                        <span className="text-sm font-bold text-teal-600">AI精选</span>
                    </div>
                </div>
                
                {/* Risk Summary */}
                {assessment && (
                    <div className="mt-4 bg-slate-50 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${
                                assessment.riskLevel === 'RED' ? 'bg-red-500' :
                                assessment.riskLevel === 'YELLOW' ? 'bg-yellow-500' : 'bg-green-500'
                            }`}></span>
                            <span className="text-sm font-bold text-slate-600">您的健康画像</span>
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{assessment.summary}</p>
                    </div>
                )}
            </div>

            {/* Category Tabs */}
            <div className="px-4 py-4 flex gap-2 overflow-x-auto scrollbar-hide sticky top-[140px] bg-slate-50 z-10">
                {CATEGORY_CONFIG.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                            activeCategory === cat.id
                                ? `${cat.color} text-white shadow-lg`
                                : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                    >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="px-4 space-y-6">
                {loading ? (
                    <div className="text-center py-16 text-slate-400">
                        <div className="animate-spin text-4xl mb-4">✨</div>
                        <p className="text-sm">AI正在分析您的健康数据...</p>
                    </div>
                ) : activeCategory === 'all' ? (
                    // 全部推荐：分类展示
                    <>
                        {['meal', 'exercise', 'service', 'event'].map(cat => {
                            const items = topByCategory[cat] || [];
                            if (items.length === 0) return null;
                            const config = CATEGORY_CONFIG.find(c => c.id === cat)!;
                            
                            return (
                                <section key={cat}>
                                    <div className="flex justify-between items-center mb-3">
                                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                            <span>{config.icon}</span>
                                            <span>{config.label}</span>
                                        </h2>
                                        <button 
                                            onClick={() => setActiveCategory(cat as ResourceCategory)}
                                            className="text-xs text-teal-600 font-bold"
                                        >
                                            查看更多 →
                                        </button>
                                    </div>
                                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                                        {items.map(({ item, reason }) => (
                                            <div
                                                key={item.id}
                                                onClick={() => setSelectedItem(item)}
                                                className="flex-shrink-0 w-[200px] bg-white rounded-2xl p-4 shadow-sm border border-slate-100 cursor-pointer active:scale-95 transition-transform"
                                            >
                                                <ResourceCover
                                                    item={item}
                                                    fallback={<span className="text-3xl">{getSmartIcon(item)}</span>}
                                                    className="mb-3 h-16 w-full rounded-xl bg-slate-50 text-3xl"
                                                    imgClassName="h-full w-full object-cover"
                                                />
                                                <h3 className="font-bold text-slate-800 text-sm mb-1 line-clamp-1">{item.title}</h3>
                                                <p className="mb-2 line-clamp-1 text-xs font-medium text-teal-600">{reason}</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {item.tags.slice(0, 2).map(t => (
                                                        <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{t}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </>
                ) : (
                    // 单类别列表
                    <div className="space-y-3">
                        {recommendedResources.length === 0 ? (
                            <div className="text-center py-16 text-slate-400">
                                <div className="text-4xl mb-4 opacity-50">📭</div>
                                <p className="text-sm">暂无该类别资源</p>
                            </div>
                        ) : (
                            recommendedResources.map(({ item, reason }) => (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedItem(item)}
                                    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-4 cursor-pointer active:scale-[0.98] transition-transform"
                                >
                                    <ResourceCover
                                        item={item}
                                        fallback={<span className="text-3xl">{getSmartIcon(item)}</span>}
                                        className="w-14 h-14 shrink-0 rounded-xl bg-slate-50 text-3xl"
                                        imgClassName="h-full w-full object-cover rounded-xl"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-bold text-slate-800 line-clamp-1">{item.title}</h3>
                                            {item.details?.cal && (
                                                <span className="text-xs text-orange-600 font-bold shrink-0">{item.details.cal} kcal</span>
                                            )}
                                        </div>
                                        <p className="mb-2 text-xs font-medium text-teal-600">{reason}</p>
                                        <p className="text-xs text-slate-500 line-clamp-2">{item.description || '暂无简介'}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedItem && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-end justify-center backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedItem(null)}>
                    <div className="bg-white w-full max-w-md rounded-t-3xl p-0 animate-slideUp overflow-hidden max-h-[85dvh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-50 p-6 pb-8 text-center relative border-b border-slate-100">
                            <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 font-bold shadow-sm">×</button>
                            <div className="mx-auto mb-4 h-20 w-20">
                                <ResourceCover
                                    item={selectedItem}
                                    fallback={<span className="text-5xl">{getSmartIcon(selectedItem)}</span>}
                                    className="h-full w-full rounded-2xl bg-white text-5xl shadow-sm"
                                    imgClassName="h-full w-full rounded-2xl object-cover shadow-sm"
                                />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-1">{selectedItem.title}</h3>
                            <div className="flex items-center justify-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    selectedItem.type === 'meal' ? 'bg-orange-100 text-orange-700' :
                                    selectedItem.type === 'exercise' ? 'bg-green-100 text-green-700' :
                                    selectedItem.type === 'service' ? 'bg-blue-100 text-blue-700' :
                                    'bg-purple-100 text-purple-700'
                                }`}>
                                    {selectedItem.type === 'meal' ? '饮食方案' :
                                     selectedItem.type === 'exercise' ? '运动推荐' :
                                     selectedItem.type === 'service' ? '医疗服务' : '健康活动'}
                                </span>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            <div className="flex flex-wrap gap-2 justify-center">
                                {selectedItem.tags.map(t => <span key={t} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs">{t}</span>)}
                            </div>

                            {/* Nutrition Info for Meals */}
                            {selectedItem.type === 'meal' && selectedItem.details?.macros && (
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="bg-orange-50 p-2 rounded-xl text-center">
                                        <div className="text-xs text-orange-400">热量</div>
                                        <div className="font-bold text-orange-700">{selectedItem.details.cal}</div>
                                    </div>
                                    <div className="bg-blue-50 p-2 rounded-xl text-center">
                                        <div className="text-xs text-blue-400">蛋白</div>
                                        <div className="font-bold text-blue-700">{selectedItem.details.macros.protein}g</div>
                                    </div>
                                    <div className="bg-yellow-50 p-2 rounded-xl text-center">
                                        <div className="text-xs text-yellow-600">脂肪</div>
                                        <div className="font-bold text-yellow-700">{selectedItem.details.macros.fat}g</div>
                                    </div>
                                    <div className="bg-green-50 p-2 rounded-xl text-center">
                                        <div className="text-xs text-green-400">碳水</div>
                                        <div className="font-bold text-green-700">{selectedItem.details.macros.carbs}g</div>
                                    </div>
                                </div>
                            )}

                            {/* Exercise Info */}
                            {selectedItem.type === 'exercise' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-green-50 p-3 rounded-xl text-center">
                                        <div className="text-xs text-green-400">建议时长</div>
                                        <div className="font-bold text-green-700">{selectedItem.details?.duration || 30} 分钟</div>
                                    </div>
                                    <div className="bg-orange-50 p-3 rounded-xl text-center">
                                        <div className="text-xs text-orange-400">预计消耗</div>
                                        <div className="font-bold text-orange-700">{selectedItem.details?.cal || 200} kcal</div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <h4 className="font-bold text-slate-800 text-sm mb-2">详细介绍</h4>
                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl whitespace-pre-line">
                                    {selectedItem.description || selectedItem.details?.ingredients || '暂无详细介绍'}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-white">
                            {(selectedItem.type === 'event' || selectedItem.type === 'service') ? (
                                <button 
                                    onClick={() => handleInteract('apply', selectedItem)}
                                    className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all ${
                                        selectedItem.type === 'event' 
                                            ? 'bg-purple-600 text-white' 
                                            : 'bg-blue-600 text-white'
                                    }`}
                                >
                                    {selectedItem.type === 'event' ? '📝 立即报名' : '📅 预约服务'}
                                </button>
                            ) : (
                                <button 
                                    onClick={() => handleInteract('save', selectedItem)}
                                    className="w-full bg-teal-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
                                >
                                    ⭐ 加入我的健康计划
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
