
import React, { useState, useEffect, useRef } from 'react';
import { ContentItem, InteractionItem, fetchContent, saveContent, deleteContent, fetchInteractions, updateInteractionStatus, checkDbConnection } from '../services/contentService';
import { calculateNutritionFromIngredients } from '../services/geminiService';
// @ts-ignore
import * as XLSX from 'xlsx';

interface Props {
    onLogout: () => void;
}

const PRESETS = {
    circleTags: ['运动', '饮食', '慢病', '养生', '心理', '减重', '科普'],
    activityTypes: ['义诊', '健康讲座', '亲子活动', '急救培训', '慢病小组', '户外运动'],
    depts: ['全科', '中医科', '内科', '外科', '妇科', '儿科', '口腔科', '康复科', '预防保健科'],
};

export const ResourceAdmin: React.FC<Props> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState<'event' | 'service' | 'doctor' | 'drug' | 'recipe' | 'exercise' | 'audit'>('event');
    const [eventSubTab, setEventSubTab] = useState<'list' | 'circle' | 'user_recipe'>('list');
    
    const [items, setItems] = useState<ContentItem[]>([]);
    const [interactions, setInteractions] = useState<InteractionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<Partial<ContentItem>>({});

    useEffect(() => {
        loadData();
    }, [activeTab, eventSubTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            let contentType: string | string[] = '';
            switch(activeTab) {
                case 'recipe': contentType = 'meal'; break;
                case 'exercise': contentType = 'exercise'; break;
                case 'event': contentType = ['event', 'circle']; break;
                case 'service': contentType = 'service'; break;
                case 'drug': contentType = 'drug'; break;
                case 'doctor': contentType = 'doctor'; break;
            }

            if (contentType) {
                let content = await fetchContent(contentType);
                if (activeTab === 'recipe') {
                    // 在食谱标签页下，区分官方和用户
                    setItems(eventSubTab === 'user_recipe' ? content.filter(c => c.isUserUpload) : content.filter(c => !c.isUserUpload));
                } else if (activeTab === 'event') {
                    setItems(eventSubTab === 'circle' ? content.filter(c => c.type === 'circle') : content.filter(c => c.type === 'event'));
                } else {
                    setItems(content);
                }
            }

            if (activeTab === 'audit') {
                const inters = await fetchInteractions();
                setInteractions(inters.filter(i => ['event_signup', 'circle_join', 'service_booking'].includes(i.type)));
            }
        } finally { setLoading(false); }
    };

    const handleAuditPass = async (item: ContentItem) => {
        const nextStatus = 'active';
        await saveContent({ ...item, status: nextStatus, updatedAt: new Date().toISOString() });
        alert("审核通过！该食谱已正式加入资源库。");
        loadData();
    };

    const handleSaveContent = async () => {
        if (!editItem.title || !editItem.type) return alert("必填项缺失");
        await saveContent(editItem as ContentItem);
        setIsModalOpen(false);
        loadData();
    };

    const openEdit = (item?: ContentItem) => {
        if (item) {
            setEditItem({...item});
        } else {
            setEditItem({ id: `item_${Date.now()}`, type: activeTab === 'recipe' ? 'meal' : 'event', status: 'active', tags: [], image: '✨', details: {} });
        }
        setIsModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
             <header className="bg-teal-700 text-white px-6 py-4 flex justify-between items-center shadow-md">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold">R</div>
                    <h1 className="text-lg font-bold">郑州大学医院健康管理后台</h1>
                </div>
                <button onClick={onLogout} className="bg-teal-800 hover:bg-teal-900 px-4 py-1.5 rounded text-xs font-bold transition-colors">退出</button>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-60 bg-white border-r border-slate-200 p-4 space-y-2">
                    <NavButton id="audit" icon="🛡️" label="审批中心" active={activeTab} onClick={setActiveTab} />
                    <div className="h-px bg-slate-200 my-2"></div>
                    <NavButton id="recipe" icon="🥗" label="膳食方案库" active={activeTab} onClick={setActiveTab} />
                    <NavButton id="doctor" icon="👨‍⚕️" label="医疗团队管理" active={activeTab} onClick={setActiveTab} />
                    <NavButton id="event" icon="✨" label="社区与圈子" active={activeTab} onClick={setActiveTab} />
                    <NavButton id="service" icon="🏥" label="服务管理" active={activeTab} onClick={setActiveTab} />
                </aside>

                <main className="flex-1 p-8 overflow-y-auto">
                    {activeTab === 'audit' ? (
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <h3 className="text-lg font-bold mb-6">入会及预约申请审核</h3>
                            {/* ... 现有审核列表 ... */}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-lg font-bold">全量健康资源管理</h3>
                                    {activeTab === 'recipe' && (
                                        <div className="flex bg-slate-100 p-1 rounded-lg">
                                            <button onClick={() => setEventSubTab('list')} className={`px-4 py-1 rounded-md text-xs font-bold ${eventSubTab === 'list' ? 'bg-white shadow text-teal-600' : 'text-slate-500'}`}>官方推荐</button>
                                            <button onClick={() => setEventSubTab('user_recipe')} className={`px-4 py-1 rounded-md text-xs font-bold ${eventSubTab === 'user_recipe' ? 'bg-white shadow text-teal-600' : 'text-slate-500'}`}>用户分享</button>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => openEdit()} className="bg-teal-600 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-lg">+ 新增资源</button>
                            </div>
                            
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold"><tr><th className="p-4">图标 & 名称</th><th className="p-4">来源/类型</th><th className="p-4">营养摘要 (AI生成)</th><th className="p-4">状态</th><th className="p-4 text-right">管理操作</th></tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 flex items-center gap-4">
                                                <span className="text-3xl bg-slate-50 w-12 h-12 flex items-center justify-center rounded-xl">{item.image}</span>
                                                <span className="font-bold text-slate-700">{item.title}</span>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-[10px] font-black uppercase text-slate-400">{item.isUserUpload ? '职工上传' : '中心内置'}</div>
                                                <div className="text-[10px] text-slate-500">{item.details?.creatorId || 'System'}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex gap-2">
                                                    <span className="bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded