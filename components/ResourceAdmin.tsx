import React, { useState, useEffect } from 'react';
import { 
    ContentItem, InteractionItem, 
    fetchContent, saveContent, deleteContent, 
    fetchInteractions, updateInteractionStatus 
} from '../services/contentService';

interface Props {
    onLogout: () => void;
}

export const ResourceAdmin: React.FC<Props> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState<'recipe' | 'exercise' | 'event' | 'service' | 'drug' | 'doctor'>('event');
    const [items, setItems] = useState<ContentItem[]>([]);
    const [interactions, setInteractions] = useState<InteractionItem[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Content Edit State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<Partial<ContentItem>>({});

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        let contentType = '';
        switch(activeTab) {
            case 'recipe': contentType = 'meal'; break;
            case 'exercise': contentType = 'exercise'; break;
            case 'event': contentType = 'event'; break;
            case 'service': contentType = 'service'; break;
            case 'drug': contentType = 'drug'; break;
            case 'doctor': contentType = 'doctor'; break;
        }

        // Fetch Content
        const content = await fetchContent(contentType);
        setItems(content);

        // Fetch interactions only for relevant types
        if (['event', 'service', 'drug', 'doctor'].includes(activeTab)) {
            let interactionType = '';
            switch(activeTab) {
                case 'event': interactionType = 'event_signup'; break;
                case 'service': interactionType = 'booking'; break;
                case 'drug': interactionType = 'drug_order'; break;
                case 'doctor': interactionType = 'signing'; break;
            }
            const inters = await fetchInteractions(interactionType);
            setInteractions(inters);
        } else {
            setInteractions([]);
        }
        setLoading(false);
    };

    const getBookings = (tab: string) => {
        // interactions state is already filtered by loadData for the current tab type
        return interactions;
    };

    const handleInteractionStatus = async (id: string, status: InteractionItem['status']) => {
        await updateInteractionStatus(id, status);
        loadData();
    };

    const handleDeleteContent = async (id: string) => {
        if(confirm('确定删除此资源吗?')) {
            await deleteContent(id);
            loadData();
        }
    };

    const handleSaveContent = async () => {
        if (!editItem.title || !editItem.type) return;
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
            if (activeTab === 'event') type = 'event';
            if (activeTab === 'service') type = 'service';
            if (activeTab === 'drug') type = 'drug';
            if (activeTab === 'doctor') type = 'doctor';
            
            setEditItem({
                id: Date.now().toString(),
                type,
                title: '',
                status: 'active',
                tags: [],
                details: {}
            });
        }
        setIsModalOpen(true);
    };

    const renderInteractionTable = (data: InteractionItem[]) => {
        if (data.length === 0) return <div className="text-slate-400 text-center py-4">暂无记录</div>;
        return (
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500">
                    <tr>
                        <th className="p-3">用户</th>
                        <th className="p-3">目标对象</th>
                        <th className="p-3">状态</th>
                        <th className="p-3">日期</th>
                        <th className="p-3 text-right">操作</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map(item => (
                        <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="p-3 font-bold">{item.userName}</td>
                            <td className="p-3">{item.targetName}</td>
                            <td className="p-3">
                                <span className={`px-2 py-1 rounded text-xs ${
                                    item.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                    item.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                }`}>
                                    {item.status === 'confirmed' ? '已确认' : item.status === 'cancelled' ? '已拒绝' : '待审核'}
                                </span>
                            </td>
                            <td className="p-3 text-xs text-slate-400">{item.date}</td>
                            <td className="p-3 text-right">
                                {item.status === 'pending' && (
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => handleInteractionStatus(item.id, 'confirmed')} className="text-green-600 hover:underline">通过</button>
                                        <button onClick={() => handleInteractionStatus(item.id, 'cancelled')} className="text-red-600 hover:underline">拒绝</button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">
             <header className="bg-teal-700 text-white px-6 py-4 flex justify-between items-center shadow-md">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold">R</div>
                    <div>
                        <h1 className="text-lg font-bold">资源运营工作台</h1>
                        <p className="text-xs text-teal-200">Resource Operations</p>
                    </div>
                </div>
                <button onClick={onLogout} className="bg-teal-800 hover:bg-teal-900 px-4 py-1.5 rounded text-xs font-bold transition-colors">退出</button>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
                    <nav className="p-4 space-y-2">
                        <NavButton id="event" icon="✨" label="活动管理" active={activeTab} onClick={setActiveTab} />
                        <NavButton id="service" icon="🏥" label="服务预约" active={activeTab} onClick={setActiveTab} />
                        <NavButton id="doctor" icon="👨‍⚕️" label="医生签约" active={activeTab} onClick={setActiveTab} />
                        <NavButton id="drug" icon="💊" label="药品订单" active={activeTab} onClick={setActiveTab} />
                        <div className="h-px bg-slate-200 my-2"></div>
                        <NavButton id="recipe" icon="🥗" label="膳食库" active={activeTab} onClick={setActiveTab} />
                        <NavButton id="exercise" icon="🏃" label="运动库" active={activeTab} onClick={setActiveTab} />
                    </nav>
                </aside>

                <main className="flex-1 p-8 overflow-y-auto">
                    {/* Interaction Table Section */}
                    {['event', 'service', 'drug', 'doctor'].includes(activeTab) && (
                        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                            <h3 className="text-lg font-bold text-slate-700 mb-4 border-l-4 border-teal-500 pl-3">
                                {activeTab === 'event' ? '活动报名记录' : 
                                 activeTab === 'service' ? '预约记录' : 
                                 activeTab === 'drug' ? '购药与配送订单' : '签约申请'}
                            </h3>
                            {renderInteractionTable(getBookings(activeTab))}
                        </section>
                    )}

                    {/* Content List Section */}
                    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-700">
                                {activeTab === 'recipe' ? '膳食资源列表' : 
                                 activeTab === 'exercise' ? '运动资源列表' : 
                                 '相关资源配置'}
                            </h3>
                            <button onClick={() => openEdit()} className="bg-teal-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-teal-700">
                                + 新增资源
                            </button>
                        </div>
                        
                        {loading ? <div className="text-center py-10">加载中...</div> : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th className="p-3">名称</th>
                                        <th className="p-3">标签</th>
                                        <th className="p-3">状态</th>
                                        <th className="p-3 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(item => (
                                        <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                                            <td className="p-3 font-bold flex items-center gap-2">
                                                <span className="text-xl">{item.image}</span>
                                                {item.title}
                                            </td>
                                            <td className="p-3">
                                                {item.tags.map(t => <span key={t} className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-xs mr-1">{t}</span>)}
                                            </td>
                                            <td className="p-3">
                                                <span className={`w-2 h-2 rounded-full inline-block mr-2 ${item.status === 'active' ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                                                {item.status === 'active' ? '已上架' : '草稿/下架'}
                                            </td>
                                            <td className="p-3 text-right space-x-2">
                                                <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline">编辑</button>
                                                <button onClick={() => handleDeleteContent(item.id)} className="text-red-600 hover:underline">删除</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {items.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">暂无资源</td></tr>}
                                </tbody>
                            </table>
                        )}
                    </section>
                </main>
            </div>

            {/* Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-2xl animate-scaleIn">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-lg text-slate-800">编辑/新增资源</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 font-bold text-xl">×</button>
                        </div>
                        <div className="space-y-4">
                            <div><label className="block text-xs text-slate-500 mb-1">标题</label><input className="border w-full p-2 rounded text-sm" value={editItem.title || ''} onChange={e=>setEditItem({...editItem, title:e.target.value})} /></div>
                            <div><label className="block text-xs text-slate-500 mb-1">描述</label><textarea className="border w-full p-2 rounded text-sm h-24" value={editItem.description || ''} onChange={e=>setEditItem({...editItem, description:e.target.value})} /></div>
                            <div><label className="block text-xs text-slate-500 mb-1">Emoji图标</label><input className="border w-full p-2 rounded text-sm" value={editItem.image || ''} onChange={e=>setEditItem({...editItem, image:e.target.value})} /></div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">标签 (逗号分隔)</label>
                                <input className="border w-full p-2 rounded text-sm" value={editItem.tags?.join(',') || ''} onChange={e=>setEditItem({...editItem, tags:e.target.value.split(',')})} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">状态</label>
                                <select className="border w-full p-2 rounded text-sm bg-white" value={editItem.status} onChange={e=>setEditItem({...editItem, status:e.target.value as any})}>
                                    <option value="active">上架</option>
                                    <option value="pending">草稿</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6 border-t pt-4">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm">取消</button>
                            <button onClick={handleSaveContent} className="px-4 py-2 bg-teal-600 text-white rounded font-bold hover:bg-teal-700 text-sm">保存</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const NavButton = ({ id, icon, label, active, onClick }: any) => (
    <button 
        onClick={() => onClick(id)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-bold ${
            active === id ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'
        }`}
    >
        <span className="text-lg">{icon}</span>
        {label}
    </button>
);
