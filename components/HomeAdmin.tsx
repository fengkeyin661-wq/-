
import React, { useState, useEffect } from 'react';
import { ContentItem, fetchContent, saveContent, deleteContent, seedInitialData } from '../services/contentService';

interface Props {
    onLogout: () => void;
}

export const HomeAdmin: React.FC<Props> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState<'diet' | 'exercise' | 'community' | 'medical' | 'users'>('diet');
    const [items, setItems] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Edit Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<Partial<ContentItem>>({});

    useEffect(() => {
        seedInitialData();
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        // Map tabs to content types
        let typeMap: any = {
            'diet': ['meal', 'article'],
            'exercise': ['exercise', 'article'], 
            'community': ['event'],
            'medical': ['drug', 'doctor', 'article']
        };
        // For simplicity in this demo, just fetching everything and filtering locally or fetching specific types
        // Actually, let's fetch strictly based on primary type for the tab
        let type = '';
        if (activeTab === 'diet') type = 'meal';
        if (activeTab === 'exercise') type = 'exercise';
        if (activeTab === 'community') type = 'event';
        if (activeTab === 'medical') type = 'drug'; // Default for medical tab

        // Helper to fetch multiple types if needed, but for simplicity let's stick to main type
        // Or fetch all and filter in render
        const all = await fetchContent();
        
        if (activeTab === 'diet') setItems(all.filter(i => i.type === 'meal' || (i.type === 'article' && i.tags?.includes('饮食'))));
        else if (activeTab === 'exercise') setItems(all.filter(i => i.type === 'exercise' || (i.type === 'article' && i.tags?.includes('运动'))));
        else if (activeTab === 'community') setItems(all.filter(i => i.type === 'event'));
        else if (activeTab === 'medical') setItems(all.filter(i => i.type === 'drug' || i.type === 'doctor' || (i.type === 'article' && i.tags?.includes('医疗'))));
        else setItems([]); // Users handled separately

        setLoading(false);
    };

    const handleAddNew = (type: ContentItem['type']) => {
        setEditItem({
            id: Date.now().toString(),
            type: type,
            title: '',
            status: 'active',
            tags: [],
            details: {}
        });
        setIsModalOpen(true);
    };

    const handleEdit = (item: ContentItem) => {
        setEditItem({ ...item });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('确定要删除这条内容吗？')) {
            await deleteContent(id);
            loadData();
        }
    };

    const handleSave = async () => {
        if (!editItem.title || !editItem.type) return alert('标题和类型必填');
        await saveContent(editItem as ContentItem);
        setIsModalOpen(false);
        loadData();
    };

    const updateDetail = (key: string, val: string) => {
        setEditItem(prev => ({
            ...prev,
            details: { ...prev.details, [key]: val }
        }));
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">
            {/* Top Bar */}
            <header className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center shadow-md">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center font-bold">H</div>
                    <div>
                        <h1 className="text-lg font-bold">健康社区管理后台</h1>
                        <p className="text-xs text-slate-400">Content Management System</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm">管理员: home</span>
                    <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded text-xs font-bold transition-colors">退出</button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
                    <nav className="p-4 space-y-2">
                        <NavButton id="diet" icon="🥗" label="健康饮食维护" active={activeTab} onClick={setActiveTab} />
                        <NavButton id="exercise" icon="🏃" label="运动课程维护" active={activeTab} onClick={setActiveTab} />
                        <NavButton id="community" icon="✨" label="社区活动发布" active={activeTab} onClick={setActiveTab} />
                        <NavButton id="medical" icon="🏥" label="医疗服务维护" active={activeTab} onClick={setActiveTab} />
                        <div className="h-px bg-slate-200 my-2"></div>
                        <NavButton id="users" icon="👥" label="用户数据管理" active={activeTab} onClick={setActiveTab} />
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-8 overflow-y-auto">
                    {activeTab !== 'users' ? (
                        <>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-slate-800">
                                    {activeTab === 'diet' ? '膳食与科普管理' : 
                                     activeTab === 'exercise' ? '运动资源管理' : 
                                     activeTab === 'community' ? '社区活动管理' : '医疗信息管理'}
                                </h2>
                                <div className="flex gap-2">
                                    {activeTab === 'diet' && <AddBtn label="新增餐品" onClick={() => handleAddNew('meal')} />}
                                    {activeTab === 'diet' && <AddBtn label="新增文章" onClick={() => handleAddNew('article')} color="blue" />}
                                    
                                    {activeTab === 'exercise' && <AddBtn label="新增课程" onClick={() => handleAddNew('exercise')} />}
                                    {activeTab === 'exercise' && <AddBtn label="新增文章" onClick={() => handleAddNew('article')} color="blue" />}

                                    {activeTab === 'community' && <AddBtn label="发起活动" onClick={() => handleAddNew('event')} />}
                                    
                                    {activeTab === 'medical' && <AddBtn label="录入药品" onClick={() => handleAddNew('drug')} />}
                                    {activeTab === 'medical' && <AddBtn label="新增医生" onClick={() => handleAddNew('doctor')} color="blue" />}
                                </div>
                            </div>

                            {loading ? (
                                <div className="text-center py-20 text-slate-400">加载中...</div>
                            ) : (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                            <tr>
                                                <th className="p-4">类型</th>
                                                <th className="p-4">名称/标题</th>
                                                <th className="p-4">详情摘要</th>
                                                <th className="p-4">状态</th>
                                                <th className="p-4">更新时间</th>
                                                <th className="p-4 text-right">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {items.map(item => (
                                                <tr key={item.id} className="hover:bg-slate-50">
                                                    <td className="p-4">
                                                        <span className={`text-xs px-2 py-1 rounded border ${
                                                            item.type === 'meal' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                                                            item.type === 'event' ? 'bg-purple-50 border-purple-200 text-purple-700' :
                                                            'bg-slate-50 border-slate-200'
                                                        }`}>
                                                            {item.type === 'meal' ? '餐品' : item.type === 'article' ? '文章' : item.type === 'event' ? '活动' : item.type === 'drug' ? '药品' : item.type === 'doctor' ? '医生' : '课程'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-bold text-slate-700 flex items-center gap-2">
                                                        <span className="text-xl">{item.image}</span>
                                                        {item.title}
                                                    </td>
                                                    <td className="p-4 text-slate-500 max-w-xs truncate">
                                                        {item.type === 'meal' ? `卡路里: ${item.details?.cal}` : 
                                                         item.type === 'event' ? `时间: ${item.details?.date}` :
                                                         item.type === 'drug' ? `库存: ${item.details?.stock}` :
                                                         item.description}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`w-2 h-2 rounded-full inline-block mr-2 ${item.status === 'active' ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                                                        {item.status === 'active' ? '已上架' : '草稿'}
                                                    </td>
                                                    <td className="p-4 text-xs text-slate-400">
                                                        {new Date(item.updatedAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-4 text-right space-x-2">
                                                        <button onClick={() => handleEdit(item)} className="text-blue-600 hover:underline">编辑</button>
                                                        <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:underline">删除</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {items.length === 0 && (
                                                <tr><td colSpan={6} className="p-8 text-center text-slate-400">暂无内容，请点击右上角新增</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    ) : (
                        // User Management Placeholder
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-6">用户数据管理</h2>
                            <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl text-yellow-800">
                                <h3 className="font-bold mb-2">🚧 功能开发中</h3>
                                <p>用户数据同步接口正在调试中。未来此模块将支持：</p>
                                <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                                    <li>查看注册用户列表</li>
                                    <li>管理用户积分与兑换记录</li>
                                    <li>导出用户活跃度报表</li>
                                    <li>处理用户反馈与举报</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-scaleIn">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-lg font-bold text-slate-800">
                                {editItem.id ? '编辑内容' : '新增内容'} - {editItem.type?.toUpperCase()}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
                        </div>
                        
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">标题 / 名称</label>
                                <input className="w-full border rounded p-2" value={editItem.title} onChange={e => setEditItem({...editItem, title: e.target.value})} />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">封面图标 (Emoji)</label>
                                <input className="w-full border rounded p-2" value={editItem.image} onChange={e => setEditItem({...editItem, image: e.target.value})} placeholder="例如: 🍱" />
                            </div>

                            {editItem.type === 'meal' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">热量 (kcal)</label>
                                        <input className="w-full border rounded p-2" value={editItem.details?.cal || ''} onChange={e => updateDetail('cal', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">价格</label>
                                        <input className="w-full border rounded p-2" value={editItem.details?.price || ''} onChange={e => updateDetail('price', e.target.value)} />
                                    </div>
                                </div>
                            )}

                            {editItem.type === 'event' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">活动时间</label>
                                        <input className="w-full border rounded p-2" value={editItem.details?.date || ''} onChange={e => updateDetail('date', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">地点</label>
                                        <input className="w-full border rounded p-2" value={editItem.details?.loc || ''} onChange={e => updateDetail('loc', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">人数上限</label>
                                        <input className="w-full border rounded p-2" value={editItem.details?.max || ''} onChange={e => updateDetail('max', e.target.value)} />
                                    </div>
                                </div>
                            )}

                            {editItem.type === 'drug' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">规格</label>
                                        <input className="w-full border rounded p-2" value={editItem.details?.spec || ''} onChange={e => updateDetail('spec', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">库存状态</label>
                                        <select className="w-full border rounded p-2 bg-white" value={editItem.details?.stock || ''} onChange={e => updateDetail('stock', e.target.value)}>
                                            <option value="充足">充足</option>
                                            <option value="少量">少量</option>
                                            <option value="缺货">缺货</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">详细描述 / 配料表 / 简介</label>
                                <textarea className="w-full border rounded p-2 h-24" value={editItem.description || ''} onChange={e => setEditItem({...editItem, description: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">标签 (逗号分隔)</label>
                                <input className="w-full border rounded p-2" value={editItem.tags?.join(',') || ''} onChange={e => setEditItem({...editItem, tags: e.target.value.split(',')})} />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">状态</label>
                                <select className="w-full border rounded p-2 bg-white" value={editItem.status} onChange={e => setEditItem({...editItem, status: e.target.value as any})}>
                                    <option value="active">上架发布</option>
                                    <option value="draft">存为草稿</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">取消</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-slate-800 text-white rounded font-bold hover:bg-slate-700">保存内容</button>
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

const AddBtn = ({ label, onClick, color='teal' }: any) => (
    <button 
        onClick={onClick}
        className={`bg-${color}-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-${color}-700 shadow-sm flex items-center gap-1 transition-transform active:scale-95`}
    >
        <span>+</span> {label}
    </button>
);
