
import React, { useState, useEffect, useRef } from 'react';
import { 
    ContentItem, InteractionItem, 
    fetchContent, saveContent, deleteContent, 
    fetchInteractions, updateInteractionStatus,
    checkDbConnection 
} from '../services/contentService';
import { calculateNutritionFromIngredients } from '../services/geminiService';
// @ts-ignore
import * as XLSX from 'xlsx';

interface Props {
    onLogout: () => void;
}

// --- Constants & Options ---
const PRESETS = {
    activityTypes: ['义诊', '健康讲座', '亲子活动', '急救培训', '慢病小组', '户外运动'],
    targetAudience: ['老年人', '孕产妇', '儿童', '高血压患者', '糖尿病患者', '全人群'],
    enrollMethod: ['线上预约', '电话报名', '现场空降'],
    depts: ['全科', '中医科', '内科', '外科', '妇科', '儿科', '口腔科', '康复科', '预防保健科'],
    docTitles: ['主任医师', '副主任医师', '主治医师', '医师', '康复师', '营养师'],
    docStatus: ['出诊中', '停诊', '休假'],
    drugRx: ['RX (处方药)', 'OTC (甲类)', 'OTC (乙类)'],
    drugInsurance: ['甲类', '乙类', '自费'],
    drugStock: ['充足', '紧张', '缺货'],
    dietDifficulty: ['⭐', '⭐⭐', '⭐⭐⭐'],
    exerciseIntensity: ['低强度', '中强度', '高强度'],
    dietTags: ['低GI', '高纤维', '低脂', '高蛋白', '适合糖友', '护心'],
    exerciseTypes: ['有氧', '力量', '柔韧性', '康复训练', '体态矫正']
};

export const ResourceAdmin: React.FC<Props> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState<'event' | 'service' | 'doctor' | 'drug' | 'recipe' | 'exercise'>('event');
    const [items, setItems] = useState<ContentItem[]>([]);
    const [interactions, setInteractions] = useState<InteractionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('加载中...');
    
    // DB Diagnostics
    const [dbStatus, setDbStatus] = useState<{status: string, message: string, details?: string} | null>(null);
    const [showSqlModal, setShowSqlModal] = useState(false);

    // Content Edit State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<Partial<ContentItem>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Batch Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    useEffect(() => {
        runDiagnostics();
    }, []);

    const runDiagnostics = async () => {
        const result = await checkDbConnection();
        setDbStatus(result);
    };

    const loadData = async () => {
        setLoading(true);
        setLoadingText('加载数据中...');
        setSelectedIds(new Set()); 
        let contentType = '';
        switch(activeTab) {
            case 'recipe': contentType = 'meal'; break;
            case 'exercise': contentType = 'exercise'; break;
            case 'event': contentType = 'event'; break;
            case 'service': contentType = 'service'; break;
            case 'drug': contentType = 'drug'; break;
            case 'doctor': contentType = 'doctor'; break;
        }

        const content = await fetchContent(contentType);
        setItems(content);

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

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(items.map(i => i.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        if (confirm(`⚠️ 确定要批量删除选中的 ${selectedIds.size} 项资源吗？此操作不可恢复。`)) {
            setLoading(true);
            try {
                await Promise.all(Array.from(selectedIds).map(id => deleteContent(id as string)));
                setSelectedIds(new Set());
                await loadData();
            } catch (e) {
                console.error(e);
                alert('批量删除过程中发生错误');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSaveContent = async () => {
        if (!editItem.title || !editItem.type) {
            alert("标题和类型为必填项");
            return;
        }

        setLoading(true);
        setLoadingText('正在保存...');
        
        const result = await saveContent(editItem as ContentItem);
        
        setLoading(false);
        setIsModalOpen(false);
        loadData();

        if (result.mode === 'local' && result.error) {
            alert(`⚠️ 保存成功，但云端同步失败。\n原因: ${result.error}\n\n数据已暂存至本地。`);
        }
    };

    const updateDetail = (key: string, val: any) => {
        setEditItem(prev => ({
            ...prev,
            details: { ...prev.details, [key]: val }
        }));
    };

    const toggleTag = (tag: string) => {
        const currentTags = editItem.tags || [];
        if (currentTags.includes(tag)) {
            setEditItem({ ...editItem, tags: currentTags.filter(t => t !== tag) });
        } else {
            setEditItem({ ...editItem, tags: [...currentTags, tag] });
        }
    };

    const handleAiAnalysis = async () => {
        if (!editItem.title || !editItem.details?.ingredients) {
            alert("请先填写【名称】和【配料及用量】以进行准确分析");
            return;
        }
        
        setIsAnalyzing(true);
        try {
            const result = await calculateNutritionFromIngredients([{
                name: editItem.title,
                ingredients: editItem.details.ingredients
            }]);
            
            const data = result.nutritionData[editItem.title];
            if (data) {
                setEditItem(prev => ({
                    ...prev,
                    details: { ...prev.details, nutrition: data.nutrition, cal: data.cal }
                }));
            }
        } catch (e) {
            alert("AI 分析服务暂时不可用");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const openEdit = (item?: ContentItem) => {
        setIsAnalyzing(false);
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
                image: type === 'meal' ? '🍲' : type === 'exercise' ? '🏃' : type === 'event' ? '🎉' : type === 'service' ? '🏥' : type === 'drug' ? '💊' : '👨‍⚕️',
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
                <div className="flex items-center gap-4">
                    {dbStatus && (
                        <span className={`text-[10px] px-2 py-1 rounded border ${
                            dbStatus.status === 'connected' ? 'bg-green-600 border-green-400 text-white' : 'bg-slate-600 border-slate-500 text-slate-300'
                        }`}>
                            {dbStatus.status === 'connected' ? '🟢 云端已连接' : '⚪️ 本地模式'}
                        </span>
                    )}
                    <button onClick={onLogout} className="bg-teal-800 hover:bg-teal-900 px-4 py-1.5 rounded text-xs font-bold transition-colors">退出</button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
                    <nav className="p-4 space-y-2">
                        <NavButton id="event" icon="✨" label="社区活动" active={activeTab} onClick={setActiveTab} />
                        <NavButton id="service" icon="🏥" label="医院服务" active={activeTab} onClick={setActiveTab} />
                        <NavButton id="doctor" icon="👨‍⚕️" label="医生管理" active={activeTab} onClick={setActiveTab} />
                        <NavButton id="drug" icon="💊" label="药品库" active={activeTab} onClick={setActiveTab} />
                        <div className="h-px bg-slate-200 my-2"></div>
                        <NavButton id="recipe" icon="🥗" label="膳食库" active={activeTab} onClick={setActiveTab} />
                        <NavButton id="exercise" icon="🏃" label="运动/康复" active={activeTab} onClick={setActiveTab} />
                    </nav>
                </aside>

                <main className="flex-1 p-8 overflow-y-auto">
                    {/* Interaction Tables (Top) */}
                    {['event', 'service', 'drug', 'doctor'].includes(activeTab) && (
                        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                            <h3 className="text-lg font-bold text-slate-700 mb-4 border-l-4 border-teal-500 pl-3">
                                {activeTab === 'event' ? '活动报名审核' : 
                                 activeTab === 'service' ? '服务预约记录' : 
                                 activeTab === 'drug' ? '药品订单' : '签约申请'}
                            </h3>
                            {renderInteractionTable(getBookings(activeTab))}
                        </section>
                    )}

                    {/* Resource List (Bottom) */}
                    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-700">
                                {activeTab === 'recipe' ? '膳食资源库' : 
                                 activeTab === 'exercise' ? '运动康复库' : 
                                 activeTab === 'event' ? '社区活动列表' :
                                 activeTab === 'service' ? '医院服务项目' :
                                 activeTab === 'drug' ? '医院药品目录' : '医生信息库'}
                            </h3>
                            <div className="flex gap-2">
                                {selectedIds.size > 0 && (
                                    <button 
                                        onClick={handleBatchDelete}
                                        className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-100 flex items-center gap-1 animate-fadeIn"
                                    >
                                        🗑️ 批量删除 ({selectedIds.size})
                                    </button>
                                )}
                                <button onClick={() => openEdit()} className="bg-teal-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-teal-700 shadow-sm flex items-center gap-2">
                                    <span>+</span> 新增
                                </button>
                            </div>
                        </div>
                        
                        {loading ? (
                            <div className="text-center py-20 flex flex-col items-center">
                                <div className="text-4xl animate-spin mb-4">⏳</div>
                                <p className="text-slate-500 font-bold">{loadingText}</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th className="p-3 w-10">
                                            <input type="checkbox" onChange={handleSelectAll} checked={items.length > 0 && selectedIds.size === items.length} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                                        </th>
                                        <th className="p-3">名称</th>
                                        <th className="p-3">核心信息</th>
                                        <th className="p-3">状态/标签</th>
                                        <th className="p-3 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map(item => (
                                        <tr key={item.id} className={`hover:bg-slate-50 ${selectedIds.has(item.id) ? 'bg-blue-50/30' : ''}`}>
                                            <td className="p-3">
                                                <input type="checkbox" onChange={() => handleSelectRow(item.id)} checked={selectedIds.has(item.id)} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                                            </td>
                                            <td className="p-3 font-bold flex items-center gap-2">
                                                <span className="text-xl bg-slate-100 w-8 h-8 rounded flex items-center justify-center">{item.image}</span>
                                                {item.title}
                                            </td>
                                            <td className="p-3 text-xs text-slate-500">
                                                {item.type === 'meal' && `难度:${item.details?.difficulty} • ${item.details?.cal}`}
                                                {item.type === 'event' && `📅 ${item.details?.date?.replace('T',' ')} • 📍${item.details?.loc}`}
                                                {item.type === 'doctor' && `${item.details?.dept} • ${item.details?.title}`}
                                                {item.type === 'drug' && `${item.details?.stock} • ${item.details?.spec}`}
                                                {item.type === 'service' && `¥${item.details?.price} • ${item.details?.insurance ? '医保' : '自费'}`}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {item.status === 'active' 
                                                        ? <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs">已发布</span> 
                                                        : <span className="bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded text-xs">草稿</span>}
                                                    {item.tags?.slice(0,2).map(t => <span key={t} className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-xs">{t}</span>)}
                                                </div>
                                            </td>
                                            <td className="p-3 text-right space-x-2">
                                                <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline">编辑</button>
                                                <button onClick={() => handleDeleteContent(item.id)} className="text-red-600 hover:underline">删除</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {items.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-slate-400">暂无数据</td></tr>}
                                </tbody>
                            </table>
                        )}
                    </section>
                </main>
            </div>

            {/* Smart Dynamic Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <span>{editItem.id?.includes('.') ? '✏️ 编辑' : '➕ 新增'}</span>
                                {activeTab === 'event' && '社区活动'}
                                {activeTab === 'service' && '医院服务'}
                                {activeTab === 'doctor' && '医生信息'}
                                {activeTab === 'drug' && '药品条目'}
                                {activeTab === 'recipe' && '膳食食谱'}
                                {activeTab === 'exercise' && '运动方案'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 bg-white space-y-6">
                            {/* --- Common Fields --- */}
                            <FormSection title="基础信息">
                                <InputField label="标题 / 名称" placeholder="请输入名称" value={editItem.title} onChange={(v:any) => setEditItem({...editItem, title: v})} />
                                <div className="grid grid-cols-4 gap-2 items-end">
                                    <div className="col-span-3">
                                        <label className="block text-xs font-bold text-slate-700 mb-1">封面图标 / 头像</label>
                                        <input className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={editItem.image || ''} onChange={e => setEditItem({...editItem, image: e.target.value})} placeholder="输入 Emoji 或 图片URL" />
                                    </div>
                                    <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-xl border border-slate-200">
                                        {editItem.image || '?'}
                                    </div>
                                </div>
                                <SelectField label="状态" value={editItem.status} onChange={(v:any) => setEditItem({...editItem, status: v})} options={['active', 'draft']} />
                            </FormSection>

                            {/* --- Specific Fields --- */}
                            
                            {/* 1. COMMUNITY EVENT */}
                            {activeTab === 'event' && (
                                <>
                                    <FormSection title="时间与地点">
                                        <InputField label="开始时间" type="datetime-local" value={editItem.details?.date} onChange={(v:any) => updateDetail('date', v)} />
                                        <InputField label="举办地点" placeholder="具体位置，如：社区中心2楼" value={editItem.details?.loc} onChange={(v:any) => updateDetail('loc', v)} />
                                    </FormSection>
                                    <FormSection title="活动详情">
                                        <InputField label="主讲人/嘉宾" value={editItem.details?.speaker} onChange={(v:any) => updateDetail('speaker', v)} />
                                        <SelectField label="报名方式" value={editItem.details?.method} onChange={(v:any) => updateDetail('method', v)} options={PRESETS.enrollMethod} />
                                        <InputField label="名额限制 (人)" type="number" value={editItem.details?.limit} onChange={(v:any) => updateDetail('limit', v)} />
                                        <InputField label="费用 (元)" placeholder="免费请填 0" value={editItem.details?.cost} onChange={(v:any) => updateDetail('cost', v)} />
                                    </FormSection>
                                    <FormSection title="分类标签">
                                        <TagSelector label="活动类型" tags={PRESETS.activityTypes} selected={editItem.tags} onToggle={toggleTag} />
                                        <TagSelector label="面向人群" tags={PRESETS.targetAudience} selected={editItem.tags} onToggle={toggleTag} />
                                    </FormSection>
                                </>
                            )}

                            {/* 2. HOSPITAL SERVICE */}
                            {activeTab === 'service' && (
                                <>
                                    <FormSection title="服务详情">
                                        <SelectField label="所属科室" value={editItem.details?.dept} onChange={(v:any) => updateDetail('dept', v)} options={PRESETS.depts} />
                                        <InputField label="服务价格 (元)" value={editItem.details?.price} onChange={(v:any) => updateDetail('price', v)} />
                                        <InputField label="服务时间" placeholder="如：工作日 8:00-11:30" value={editItem.details?.time} onChange={(v:any) => updateDetail('time', v)} />
                                        <ToggleField label="医保报销" value={editItem.details?.insurance} onChange={(v:any) => updateDetail('insurance', v)} />
                                    </FormSection>
                                    <FormSection title="操作指引">
                                        <TextAreaField label="服务介绍" placeholder="简述内容和流程..." value={editItem.description} onChange={(v:any) => setEditItem({...editItem, description: v})} />
                                        <InputField label="准备事项" placeholder="如：需空腹、带社保卡" full value={editItem.details?.prep} onChange={(v:any) => updateDetail('prep', v)} />
                                    </FormSection>
                                </>
                            )}

                            {/* 3. DOCTOR */}
                            {activeTab === 'doctor' && (
                                <>
                                    <FormSection title="职业信息">
                                        <SelectField label="所属科室" value={editItem.details?.dept} onChange={(v:any) => updateDetail('dept', v)} options={PRESETS.depts} />
                                        <SelectField label="职称" value={editItem.details?.title} onChange={(v:any) => updateDetail('title', v)} options={PRESETS.docTitles} />
                                        <SelectField label="当前状态" value={editItem.details?.docStatus} onChange={(v:any) => updateDetail('docStatus', v)} options={PRESETS.docStatus} />
                                        <InputField label="挂号费 (元)" value={editItem.details?.fee} onChange={(v:any) => updateDetail('fee', v)} />
                                    </FormSection>
                                    
                                    <FormSection title="签约医生登录账号">
                                        <InputField label="登录用户名" placeholder="用于医生端登录" value={editItem.details?.username} onChange={(v:any) => updateDetail('username', v)} />
                                        <InputField label="登录密码" placeholder="设置初始密码" type="text" value={editItem.details?.password} onChange={(v:any) => updateDetail('password', v)} />
                                    </FormSection>

                                    <FormSection title="专业能力">
                                        <TextAreaField label="擅长领域 (标签请逗号分隔)" value={editItem.tags?.join(',')} onChange={(v:string) => setEditItem({...editItem, tags: v.split(/[,，]/)})} placeholder="如：高血压, 糖尿病, 小儿推拿" />
                                        <TextAreaField label="个人简介" placeholder="毕业院校、从业年限、学术成就..." value={editItem.description} onChange={(v:any) => setEditItem({...editItem, description: v})} />
                                        <InputField label="出诊时间表" full placeholder="如：周一上午、周三下午" value={editItem.details?.schedule} onChange={(v:any) => updateDetail('schedule', v)} />
                                    </FormSection>
                                </>
                            )}

                            {/* 4. DRUG */}
                            {activeTab === 'drug' && (
                                <>
                                    <FormSection title="药品属性">
                                        <SelectField label="处方类型" value={editItem.details?.rxType} onChange={(v:any) => updateDetail('rxType', v)} options={PRESETS.drugRx} />
                                        <SelectField label="医保类型" value={editItem.details?.insuranceType} onChange={(v:any) => updateDetail('insuranceType', v)} options={PRESETS.drugInsurance} />
                                        <SelectField label="库存状态" value={editItem.details?.stock} onChange={(v:any) => updateDetail('stock', v)} options={PRESETS.drugStock} />
                                        <InputField label="规格" placeholder="如：0.5g*20片/盒" value={editItem.details?.spec} onChange={(v:any) => updateDetail('spec', v)} />
                                    </FormSection>
                                    <FormSection title="用药指导">
                                        <InputField label="生产厂家" full value={editItem.details?.manufacturer} onChange={(v:any) => updateDetail('manufacturer', v)} />
                                        <TextAreaField label="用法用量" placeholder="标准用法..." value={editItem.details?.usage} onChange={(v:any) => updateDetail('usage', v)} />
                                        <TextAreaField label="主要禁忌" placeholder="副作用或禁忌提醒..." value={editItem.details?.contraindications} onChange={(v:any) => updateDetail('contraindications', v)} />
                                    </FormSection>
                                </>
                            )}

                            {/* 5. DIET */}
                            {activeTab === 'recipe' && (
                                <>
                                    <FormSection title="制作详情">
                                        <SelectField label="制作难度" value={editItem.details?.difficulty} onChange={(v:any) => updateDetail('difficulty', v)} options={PRESETS.dietDifficulty} />
                                        <TextAreaField label="所需食材 (支持AI分析)" placeholder="如：干木耳10g，黄瓜一根" value={editItem.details?.ingredients} onChange={(v:any) => updateDetail('ingredients', v)} />
                                        <button onClick={handleAiAnalysis} disabled={isAnalyzing} className="col-span-2 text-xs bg-teal-50 text-teal-600 border border-teal-200 py-2 rounded flex justify-center items-center gap-2 hover:bg-teal-100">
                                            {isAnalyzing ? '⏳ 正在分析营养成分...' : '✨ 点击进行 AI 营养分析'}
                                        </button>
                                    </FormSection>
                                    <FormSection title="营养价值">
                                        <InputField label="热量 (kcal)" value={editItem.details?.cal} onChange={(v:any) => updateDetail('cal', v)} />
                                        <InputField label="主要营养素" value={editItem.details?.nutrition} onChange={(v:any) => updateDetail('nutrition', v)} />
                                    </FormSection>
                                    <FormSection title="健康建议">
                                        <TagSelector label="健康标签" tags={PRESETS.dietTags} selected={editItem.tags} onToggle={toggleTag} />
                                        <TextAreaField label="制作步骤" value={editItem.details?.steps} onChange={(v:any) => updateDetail('steps', v)} />
                                    </FormSection>
                                </>
                            )}

                            {/* 6. EXERCISE */}
                            {activeTab === 'exercise' && (
                                <>
                                    <FormSection title="训练参数">
                                        <SelectField label="强度等级" value={editItem.details?.intensity} onChange={(v:any) => updateDetail('intensity', v)} options={PRESETS.exerciseIntensity} />
                                        <InputField label="推荐时长/组数" value={editItem.details?.duration} onChange={(v:any) => updateDetail('duration', v)} />
                                        <InputField label="消耗热量 (估算)" value={editItem.details?.cal} onChange={(v:any) => updateDetail('cal', v)} />
                                    </FormSection>
                                    <FormSection title="专业指导">
                                        <TagSelector label="运动类型" tags={PRESETS.exerciseTypes} selected={editItem.tags} onToggle={toggleTag} />
                                        <InputField label="演示视频/GIF链接" full value={editItem.details?.videoUrl} onChange={(v:any) => updateDetail('videoUrl', v)} />
                                        <InputField label="适宜人群" full value={editItem.details?.audience} onChange={(v:any) => updateDetail('audience', v)} />
                                        <TextAreaField label="禁忌/风险提示" value={editItem.details?.risks} onChange={(v:any) => updateDetail('risks', v)} />
                                    </FormSection>
                                </>
                            )}

                        </div>

                        <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-200 transition-colors">取消</button>
                            <button onClick={handleSaveContent} className="px-8 py-2 rounded-lg font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-lg transition-transform active:scale-95">保存信息</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Helper Components (Moved Outside) ---

const NavButton = ({ id, icon, label, active, onClick }: any) => (
    <button onClick={() => onClick(id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-bold ${active === id ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'}`}>
        <span className="text-lg">{icon}</span>
        {label}
    </button>
);

const FormSection = ({ title, children }: { title: string, children?: React.ReactNode }) => (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-wider">{title}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
);

const InputField = ({ label, value, onChange, placeholder, full = false, type = "text" }: any) => (
    <div className={full ? "col-span-2" : ""}>
        <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
        <input 
            type={type}
            className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
        />
    </div>
);

const SelectField = ({ label, value, onChange, options, full = false }: any) => (
    <div className={full ? "col-span-2" : ""}>
        <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
        <select 
            className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
        >
            <option value="">请选择...</option>
            {options.map((opt: string) => (
                <option key={opt} value={opt}>{opt}</option>
            ))}
        </select>
    </div>
);

const ToggleField = ({ label, value, onChange }: any) => (
    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
        <span className="text-xs font-bold text-slate-700">{label}</span>
        <button 
            onClick={() => onChange(!value)}
            className={`w-10 h-5 rounded-full relative transition-colors ${value ? 'bg-teal-500' : 'bg-slate-300'}`}
        >
            <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${value ? 'left-6' : 'left-1'}`}></div>
        </button>
    </div>
);

const TagSelector = ({ label, tags, selected, onToggle }: any) => (
    <div className="col-span-2">
        <label className="block text-xs font-bold text-slate-700 mb-2">{label}</label>
        <div className="flex flex-wrap gap-2">
            {tags.map((tag: string) => (
                <button 
                    key={tag}
                    onClick={() => onToggle(tag)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${selected?.includes(tag) ? 'bg-teal-100 text-teal-700 border-teal-300 font-bold' : 'bg-white text-slate-500 border-slate-200 hover:border-teal-300'}`}
                >
                    {tag}
                </button>
            ))}
        </div>
    </div>
);

const TextAreaField = ({ label, value, onChange, placeholder }: any) => (
    <div className="col-span-2">
        <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
        <textarea 
            className="w-full border border-slate-300 rounded-lg p-2 text-sm h-24 focus:ring-2 focus:ring-teal-500 outline-none resize-none"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
        />
    </div>
);
