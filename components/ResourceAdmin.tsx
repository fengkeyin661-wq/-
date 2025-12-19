
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
    const [eventSubTab, setEventSubTab] = useState<'list' | 'circle'>('list');
    
    const [items, setItems] = useState<ContentItem[]>([]);
    const [interactions, setInteractions] = useState<InteractionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<Partial<ContentItem>>({});

    useEffect(() => {
        loadData();
    }, [activeTab, eventSubTab]);

    const loadData = async () => {
        try {
            setLoading(true);
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
                const content = await fetchContent(contentType);
                if (activeTab === 'event') {
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

    // 核心操作：上下架/审核切换
    const toggleItemStatus = async (item: ContentItem) => {
        const nextStatus = item.status === 'active' ? 'offline' : 'active';
        await saveContent({ ...item, status: nextStatus as any, updatedAt: new Date().toISOString() });
        loadData();
    };

    const handleAuditPass = async (item: ContentItem) => {
        if (!confirm(`确认审核通过并上架圈子【${item.title}】吗？`)) return;
        await saveContent({ ...item, status: 'active', updatedAt: new Date().toISOString() });
        loadData();
    };

    const handleSaveContent = async () => {
        if (!editItem.title || !editItem.type) return alert("标题和类型为必填项");
        await saveContent(editItem as ContentItem);
        setIsModalOpen(false);
        loadData();
    };

    const openEdit = (item?: ContentItem) => {
        if (item) {
            setEditItem({...item});
        } else {
            let type: any = 'meal';
            if (activeTab === 'exercise') type = 'exercise';
            if (activeTab === 'event') type = eventSubTab === 'circle' ? 'circle' : 'event';
            if (activeTab === 'service') type = 'service';
            if (activeTab === 'drug') type = 'drug';
            if (activeTab === 'doctor') type = 'doctor';
            setEditItem({ id: `item_${Date.now()}`, type, title: '', status: 'active', tags: [], image: '✨', details: {} });
        }
        setIsModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
             <header className="bg-teal-700 text-white px-6 py-4 flex justify-between items-center shadow-md">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold">R</div>
                    <h1 className="text-lg font-bold">资源运营工作台</h1>
                </div>
                <button onClick={onLogout} className="bg-teal-800 hover:bg-teal-900 px-4 py-1.5 rounded text-xs font-bold transition-colors">退出</button>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-60 bg-white border-r border-slate-200 p-4 space-y-2">
                    <NavButton id="audit" icon="🛡️" label="审核中心" active={activeTab} onClick={setActiveTab} />
                    <div className="h-px bg-slate-200 my-2"></div>
                    <NavButton id="event" icon="✨" label="社区与活动" active={activeTab} onClick={setActiveTab} />
                    <NavButton id="doctor" icon="👨‍⚕️" label="医疗团队" active={activeTab} onClick={setActiveTab} />
                    <NavButton id="drug" icon="💊" label="药品/器械" active={activeTab} onClick={setActiveTab} />
                    <NavButton id="recipe" icon="🥗" label="膳食方案" active={activeTab} onClick={setActiveTab} />
                    <NavButton id="service" icon="🏥" label="健康服务" active={activeTab} onClick={setActiveTab} />
                </aside>

                <main className="flex-1 p-8 overflow-y-auto">
                    {activeTab === 'audit' ? (
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <h3 className="text-lg font-bold mb-6">入圈申请与活动报名</h3>
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold"><tr><th className="p-4">类型</th><th className="p-4">申请人</th><th className="p-4">目标对象</th><th className="p-4">状态</th><th className="p-4 text-right">操作</th></tr></thead>
                                <tbody>
                                    {interactions.map(i => (
                                        <tr key={i.id} className="border-t border-slate-50">
                                            <td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${i.type === 'circle_join' ? 'bg-indigo-50 text-indigo-700' : 'bg-teal-50 text-teal-700'}`}>{i.type === 'circle_join' ? '申请入圈' : '活动报名'}</span></td>
                                            <td className="p-4 font-bold">{i.userName}</td>
                                            <td className="p-4 text-slate-500">{i.targetName}</td>
                                            <td className="p-4"><span className={`text-[10px] font-bold ${i.status === 'pending' ? 'text-orange-500' : 'text-green-500'}`}>{i.status === 'pending' ? '⏳ 待审批' : '✅ 已通过'}</span></td>
                                            <td className="p-4 text-right">
                                                {i.status === 'pending' && (
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={() => updateInteractionStatus(i.id, 'confirmed').then(loadData)} className="text-green-600 font-bold">同意</button>
                                                        <button onClick={() => updateInteractionStatus(i.id, 'cancelled').then(loadData)} className="text-red-500">拒绝</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-lg font-bold">全量健康资源管理</h3>
                                    {activeTab === 'event' && (
                                        <div className="flex bg-slate-100 p-1 rounded-lg">
                                            <button onClick={() => setEventSubTab('list')} className={`px-4 py-1 rounded-md text-xs font-bold ${eventSubTab === 'list' ? 'bg-white shadow text-teal-600' : 'text-slate-500'}`}>官方活动</button>
                                            <button onClick={() => setEventSubTab('circle')} className={`px-4 py-1 rounded-md text-xs font-bold ${eventSubTab === 'circle' ? 'bg-white shadow text-teal-600' : 'text-slate-500'}`}>职工圈子</button>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => openEdit()} className="bg-teal-600 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-lg shadow-teal-100">+ 发布新内容</button>
                            </div>
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500"><tr><th className="p-4">资源图标 & 名称</th><th className="p-4">分类/发起人</th><th className="p-4">状态</th><th className="p-4 text-right">管理操作</th></tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 flex items-center gap-4">
                                                <span className="text-3xl bg-slate-50 w-12 h-12 flex items-center justify-center rounded-xl">{item.image}</span>
                                                <span className="font-bold text-slate-700">{item.title}</span>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-xs font-bold text-slate-400 uppercase">{item.type}</div>
                                                <div className="text-[10px] text-slate-500 mt-1">{item.details?.creatorName ? `👤 ${item.details.creatorName}` : '院内系统发布'}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                                                    item.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 
                                                    item.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-slate-50 text-slate-400 border-slate-200'
                                                }`}>
                                                    {item.status === 'active' ? '● 已上架' : item.status === 'pending' ? '○ 待审核' : '● 已下架'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right space-x-3">
                                                {item.status === 'pending' && (
                                                    <button onClick={() => handleAuditPass(item)} className="text-teal-600 font-black">审核通过并上架</button>
                                                )}
                                                <button onClick={() => toggleItemStatus(item)} className={`${item.status === 'active' ? 'text-orange-500' : 'text-blue-600'} font-bold`}>
                                                    {item.status === 'active' ? '点击下架' : '重新上架'}
                                                </button>
                                                <button onClick={() => openEdit(item)} className="text-slate-400">编辑</button>
                                                <button onClick={() => deleteContent(item.id).then(loadData)} className="text-red-400">删除</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </main>
            </div>

            {/* 编辑弹窗 */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg p-8 space-y-5 animate-scaleIn">
                        <h3 className="text-xl font-bold border-b pb-4">编辑资源详情</h3>
                        <div className="space-y-4">
                            <InputField label="资源标题" value={editItem.title} onChange={(v:any)=>setEditItem({...editItem, title:v})} />
                            <TextAreaField label="资源简介/详情" value={editItem.description} onChange={(v:any)=>setEditItem({...editItem, description:v})} />
                            <div className="grid grid-cols-2 gap-4">
                                <SelectField label="当前状态" value={editItem.status} options={['active', 'pending', 'offline']} onChange={(v:any)=>setEditItem({...editItem, status:v})} />
                                <InputField label="图标 (Emoji)" value={editItem.image} onChange={(v:any)=>setEditItem({...editItem, image:v})} />
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end pt-6">
                            <button onClick={()=>setIsModalOpen(false)} className="px-6 py-2 text-slate-500 font-bold">取消</button>
                            <button onClick={handleSaveContent} className="px-10 py-2 bg-teal-600 text-white rounded-xl font-bold shadow-lg shadow-teal-100">保存设置</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const NavButton = ({ id, icon, label, active, onClick }: any) => (
    <button onClick={() => onClick(id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${active === id ? 'bg-teal-50 text-teal-700 shadow-sm border border-teal-100' : 'text-slate-500 hover:bg-slate-50'}`}>
        <span className="text-xl">{icon}</span>{label}
    </button>
);

const InputField = ({ label, value, onChange }: any) => (
    <div><label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-widest">{label}</label><input className="w-full border p-3 rounded-xl text-sm bg-slate-50 border-none outline-none focus:bg-white focus:ring-2 focus:ring-teal-500" value={value || ''} onChange={e=>onChange(e.target.value)} /></div>
);

const TextAreaField = ({ label, value, onChange }: any) => (
    <div><label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-widest">{label}</label><textarea className="w-full border p-3 rounded-xl text-sm h-24 bg-slate-50 border-none outline-none focus:bg-white focus:ring-2 focus:ring-teal-500" value={value || ''} onChange={e=>onChange(e.target.value)} /></div>
);

const SelectField = ({ label, value, options, onChange }: any) => (
    <div><label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-widest">{label}</label><select className="w-full border p-3 rounded-xl text-sm bg-slate-50 border-none outline-none focus:bg-white focus:ring-2 focus:ring-teal-500" value={value || ''} onChange={e=>onChange(e.target.value)}>{options.map((o:any)=><option key={o} value={o}>{o === 'active' ? '✅ 已上架' : o === 'pending' ? '⏳ 待审核' : '🌑 已下架'}</option>)}</select></div>
);
