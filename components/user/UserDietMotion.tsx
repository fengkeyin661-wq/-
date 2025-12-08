
import React, { useState, useEffect } from 'react';
import { fetchContent, saveContent, ContentItem } from '../../services/contentService';
import { HealthAssessment } from '../../types';

interface Props {
    assessment?: HealthAssessment;
}

export const UserDietMotion: React.FC<Props> = ({ assessment }) => {
    const [activeTab, setActiveTab] = useState<'meal' | 'exercise'>('meal');
    const [items, setItems] = useState<ContentItem[]>([]);
    const [showUpload, setShowUpload] = useState(false);
    
    // Upload Form State
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newTags, setNewTags] = useState('');

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        const data = await fetchContent(activeTab);
        setItems(data);
    };

    // Smart Recommendation Logic
    const getRecommendedItems = () => {
        if (!assessment) return [];
        // Combine all risk keywords
        const risks = [...assessment.risks.red, ...assessment.risks.yellow].join(' ');
        
        return items.filter(item => {
            // Check if item tags match user risks
            return item.tags.some(tag => risks.includes(tag));
        });
    };

    const recommended = getRecommendedItems();
    const otherItems = items.filter(i => !recommended.includes(i));

    const handleUpload = async () => {
        if (!newTitle) return;
        const newItem: ContentItem = {
            id: Date.now().toString(),
            type: activeTab,
            title: newTitle,
            description: newDesc,
            tags: newTags.split(/[,， ]+/).filter(Boolean),
            image: activeTab === 'meal' ? '🍲' : '🏃‍♂️',
            author: '我',
            isUserUpload: true,
            status: 'active',
            updatedAt: new Date().toISOString(),
            details: {} // Simplified for demo
        };
        await saveContent(newItem);
        setShowUpload(false);
        setNewTitle(''); setNewDesc(''); setNewTags('');
        loadData();
        alert("发布成功！");
    };

    return (
        <div className="bg-slate-50 min-h-full">
            {/* Header */}
            <div className="bg-white sticky top-0 z-20 px-4 py-3 shadow-sm flex justify-between items-center">
                <div className="flex bg-slate-100 rounded-full p-1">
                    <button 
                        onClick={() => setActiveTab('meal')}
                        className={`px-6 py-1.5 rounded-full text-sm font-bold transition-all ${activeTab === 'meal' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}
                    >
                        健康饮食
                    </button>
                    <button 
                        onClick={() => setActiveTab('exercise')}
                        className={`px-6 py-1.5 rounded-full text-sm font-bold transition-all ${activeTab === 'exercise' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}
                    >
                        科学运动
                    </button>
                </div>
                <button onClick={() => setShowUpload(true)} className="text-xl bg-slate-100 w-9 h-9 rounded-full flex items-center justify-center text-slate-600 font-bold hover:bg-slate-200">
                    +
                </button>
            </div>

            <div className="p-4 space-y-6">
                {/* 1. Smart Recommendation Banner */}
                {recommended.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">✨</span>
                            <h2 className="font-bold text-slate-800">
                                专属推荐
                                <span className="text-xs font-normal text-slate-500 ml-2 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100">
                                    基于您的健康画像
                                </span>
                            </h2>
                        </div>
                        <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide snap-x">
                            {recommended.map(item => (
                                <Card key={item.id} item={item} isRec={true} />
                            ))}
                        </div>
                    </section>
                )}

                {/* 2. Main Feed */}
                <section>
                    <h2 className="font-bold text-slate-800 mb-3">
                        {activeTab === 'meal' ? '精选食谱 & 晒餐' : '运动方案 & 打卡'}
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                        {otherItems.map(item => (
                            <Card key={item.id} item={item} />
                        ))}
                    </div>
                </section>
                
                {/* Fallback if empty */}
                {items.length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                        暂无内容，快来点击右上角发布第一条吧！
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            {showUpload && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scaleIn">
                        <h3 className="text-lg font-bold mb-4">发布{activeTab === 'meal' ? '食谱' : '运动心得'}</h3>
                        <div className="space-y-3">
                            <input 
                                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                placeholder="标题 (如: 减脂早餐)"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                            />
                            <textarea 
                                className="w-full border border-slate-200 rounded-lg p-3 text-sm h-24 focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                                placeholder="描述 (配料、步骤、心得...)"
                                value={newDesc}
                                onChange={e => setNewDesc(e.target.value)}
                            />
                            <input 
                                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                placeholder="标签 (如: 减重, 低脂)"
                                value={newTags}
                                onChange={e => setNewTags(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowUpload(false)} className="flex-1 py-2 text-slate-500 hover:bg-slate-50 rounded-lg">取消</button>
                            <button onClick={handleUpload} className="flex-1 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700">发布</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Card: React.FC<{item: ContentItem, isRec?: boolean}> = ({ item, isRec }) => (
    <div className={`bg-white rounded-xl overflow-hidden shadow-sm border ${isRec ? 'border-orange-200 min-w-[240px] snap-center' : 'border-slate-100'} flex flex-col group active:scale-95 transition-transform`}>
        <div className={`h-24 ${isRec ? 'bg-gradient-to-br from-orange-50 to-orange-100' : 'bg-slate-50'} flex items-center justify-center text-5xl relative`}>
            {item.image}
            {item.isUserUpload && <span className="absolute top-2 right-2 text-[10px] bg-white/80 px-1.5 rounded text-slate-500 border border-slate-200">用户</span>}
        </div>
        <div className="p-3 flex-1 flex flex-col">
            <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{item.title}</h3>
            <div className="flex gap-1 mt-1 flex-wrap">
                {item.tags.slice(0, 2).map((t, i) => (
                    <span key={i} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded">{t}</span>
                ))}
            </div>
            {item.details && (
                <div className="mt-auto pt-2 text-[10px] text-slate-400 border-t border-slate-50 flex justify-between">
                    {item.details.calories && <span>{item.details.calories}</span>}
                    {item.details.difficulty && <span>难度: {item.details.difficulty}</span>}
                    {item.details.nutrition && <span className="truncate">{item.details.nutrition.split(',')[0]}</span>}
                </div>
            )}
        </div>
    </div>
);
