
import React, { useState, useEffect, useRef } from 'react';
import { 
    ContentItem, InteractionItem, 
    fetchContent, saveContent, deleteContent, 
    fetchInteractions, updateInteractionStatus 
} from '../services/contentService';
import { calculateNutritionFromIngredients } from '../services/geminiService';
// @ts-ignore
import * as XLSX from 'xlsx';

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
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Batch Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        setSelectedIds(new Set()); // Reset selection on tab change
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

    // --- Batch Delete Logic ---
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
                // Execute deletions in parallel
                await Promise.all(Array.from(selectedIds).map(id => deleteContent(id as string)));
                setSelectedIds(new Set());
                await loadData();
                alert('批量删除成功');
            } catch (e) {
                console.error(e);
                alert('批量删除过程中发生错误');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSaveContent = async () => {
        if (!editItem.title || !editItem.type) return;
        await saveContent(editItem as ContentItem);
        setIsModalOpen(false);
        loadData();
    };

    const updateDetail = (key: string, val: any) => {
        setEditItem(prev => ({
            ...prev,
            details: { ...prev.details, [key]: val }
        }));
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
            
            // The API returns a map keyed by recipe name
            const data = result.nutritionData[editItem.title];
            
            if (data) {
                setEditItem(prev => ({
                    ...prev,
                    details: {
                        ...prev.details,
                        nutrition: data.nutrition,
                        cal: data.cal
                    }
                }));
                // alert("AI 分析完成！已自动填充营养成分和热量估算。");
            } else {
                alert("AI 未能返回有效数据，请检查配料描述是否清晰。");
            }
        } catch (e) {
            console.error(e);
            alert("AI 分析服务暂时不可用，请稍后重试");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // --- Excel Logic ---

    const downloadTemplate = () => {
        let headers: string[] = ['图标', '名称', '描述', '标签']; // Common
        let sample: any[] = [];

        if (activeTab === 'recipe') {
            headers.push('配料及用量', '制作步骤', '制作时长', '难度', '营养成分(AI估算)', '热量');
            sample = [['🍱', '减脂鸡胸肉', '低脂健康', '减脂,高蛋白', '鸡胸肉200g,西兰花100g', '1.煮熟;2.调味', '20分钟', '易', '蛋白质:30g, 脂肪:5g', '300kcal']];
        } else if (activeTab === 'exercise') {
            headers.push('运动类型', '频率', '强度', '持续时间', '消耗热量', '准备工作', '注意事项');
            sample = [['🏃', '慢跑', '有氧运动', '有氧', '每周3次', '中等', '30分钟', '200kcal', '热身5分钟', '膝盖痛停止']];
        } else if (activeTab === 'event') {
            headers.push('类别', '时间(YYYY-MM-DD HH:MM)', '地点', '人数上限', '组织者', '联系方式', '报名截止日期');
            sample = [['🎉', '春季运动会', '全员参与', '体育', '体育比赛', '2024-05-01 09:00', '体育场', '100', '工会', '13800000000', '2024-04-28']];
        } else if (activeTab === 'service') {
            headers.push('类别', '所属科室', '单价', '检查意义', '适用人群', '检查须知');
            sample = [['🩻', '胸部CT', '影像检查', '检查', '放射科', '200', '筛查肺部病变', '吸烟人群', '去除金属饰品']];
        } else if (activeTab === 'drug') {
            headers.push('规格', '用途/适应症', '用法用量', '给药途径', '服用时间与注意事项', '副作用', '禁忌症', '药物相互作用', '储存有效期', '漏服处理');
            sample = [['💊', '阿司匹林', '抗血栓', '心血管', '100mg*30', '抗血小板聚合', '每日1次1片', '口服', '餐前服用', '胃肠不适', '溃疡禁用', '避免同服布洛芬', '密封保存', '立即补服']];
        } else if (activeTab === 'doctor') {
            headers.push('所属科室', '职称', '擅长领域', '门诊时间', '医院', '登录账号', '密码');
            sample = [['👨‍⚕️', '张三', '全科专家', '全科', '全科医学科', '主任医师', '高血压糖尿病', '周一上午', '郑大医院', 'doc_zhang', '123456']];
        }

        const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, `${activeTab}_template.xlsx`);
    };

    // Helper to safely get value from row handling trimming
    const getVal = (row: any, key: string) => {
        // Exact match
        if (row[key] !== undefined) return row[key];
        // Trimmed match
        const cleanKey = key.trim();
        const foundKey = Object.keys(row).find(k => k.trim() === cleanKey);
        return foundKey ? row[foundKey] : undefined;
    };

    const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                
                if (data.length === 0) return alert('文件为空');
                if (!confirm(`解析到 ${data.length} 条数据，确定导入到当前 [${activeTab}] 分类吗？`)) return;

                setLoading(true);
                let count = 0;
                
                for (const row of data) {
                    let type: any = 'meal';
                    let details: any = {};
                    const r = row as any;
                    
                    if (activeTab === 'recipe') {
                        type = 'meal';
                        details = {
                            ingredients: getVal(r, '配料及用量'), 
                            steps: getVal(r, '制作步骤'), 
                            cookingTime: getVal(r, '制作时长'),
                            difficulty: getVal(r, '难度'), 
                            nutrition: getVal(r, '营养成分(AI估算)'), 
                            cal: getVal(r, '热量')
                        };
                    } else if (activeTab === 'exercise') {
                        type = 'exercise';
                        details = {
                            exerciseType: getVal(r, '运动类型'), frequency: getVal(r, '频率'), intensity: getVal(r, '强度'),
                            duration: getVal(r, '持续时间'), calories: getVal(r, '消耗热量'), prepWork: getVal(r, '准备工作'), contraindications: getVal(r, '注意事项')
                        };
                    } else if (activeTab === 'event') {
                        type = 'event';
                        details = {
                            eventCategory: getVal(r, '类别'), date: getVal(r, '时间(YYYY-MM-DD HH:MM)'), loc: getVal(r, '地点'),
                            max: getVal(r, '人数上限'), organizer: getVal(r, '组织者'), contact: getVal(r, '联系方式'), deadline: getVal(r, '报名截止日期')
                        };
                    } else if (activeTab === 'service') {
                        type = 'service';
                        details = {
                            serviceCategory: getVal(r, '类别'), dept: getVal(r, '所属科室'), price: getVal(r, '单价'),
                            clinicalSignificance: getVal(r, '检查意义'), targetAudience: getVal(r, '适用人群'), preCheckPrep: getVal(r, '检查须知')
                        };
                    } else if (activeTab === 'drug') {
                        type = 'drug';
                        details = {
                            spec: getVal(r, '规格'), usage: getVal(r, '用途/适应症'), dosage: getVal(r, '用法用量'), adminRoute: getVal(r, '给药途径'),
                            timingNotes: getVal(r, '服用时间与注意事项'), sideEffects: getVal(r, '副作用'), drugContraindications: getVal(r, '禁忌症'),
                            interactions: getVal(r, '药物相互作用'), storage: getVal(r, '储存有效期'), missedDose: getVal(r, '漏服处理')
                        };
                    } else if (activeTab === 'doctor') {
                        type = 'doctor';
                        details = {
                            dept: getVal(r, '所属科室'), title: getVal(r, '职称'), specialty: getVal(r, '擅长领域'), schedule: getVal(r, '门诊时间'),
                            hospital: getVal(r, '医院'), username: getVal(r, '登录账号'), password: getVal(r, '密码')
                        };
                    }

                    const titleVal = getVal(r, '名称') || '未命名';

                    const item: ContentItem = {
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                        type,
                        title: titleVal,
                        description: getVal(r, '描述') || '',
                        tags: (getVal(r, '标签') || '').split(/[,， ]+/).filter(Boolean),
                        image: getVal(r, '图标') || (type === 'meal' ? '🍱' : '📦'),
                        author: '管理员导入',
                        isUserUpload: false,
                        status: 'active',
                        updatedAt: new Date().toISOString(),
                        details
                    };
                    
                    // Only save if we found a valid title (strict check)
                    if (item.title && item.title !== '未命名') {
                        await saveContent(item);
                        count++;
                    }
                }
                
                if (count > 0) {
                    alert(`成功导入 ${count} 条数据`);
                } else {
                    alert(`⚠️ 导入了 0 条数据！\n可能原因：Excel 表头不匹配。\n请确保第一行包含【名称】、【图标】等列，建议先【下载模板】对照。`);
                }
                
                // Force reload
                await loadData();
            } catch (error) {
                console.error(error);
                alert('导入失败，请检查文件格式。建议先下载模板。');
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
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

    // Helper for table summary
    const renderSummary = (item: ContentItem) => {
        const d = item.details || {};
        if (item.type === 'meal') return `热量:${d.cal || '-'}, 难度:${d.difficulty || '-'}`;
        if (item.type === 'exercise') return `${d.exerciseType || ''} ${d.frequency || ''} ${d.duration || ''}`;
        if (item.type === 'event') return `时间:${d.date || '-'}, 地点:${d.loc || '-'}`;
        if (item.type === 'service') return `科室:${d.dept || '-'}, 价格:${d.price || '-'}`;
        if (item.type === 'drug') return `规格:${d.spec || '-'}, 用途:${d.usage || '-'}`;
        if (item.type === 'doctor') return `${d.dept || '-'} ${d.title || '-'} ${d.hospital || '-'}`;
        return item.description;
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
                        <NavButton id="event" icon="✨" label="社区活动" active={activeTab} onClick={setActiveTab} />
                        <NavButton id="service" icon="🏥" label="医院服务" active={activeTab} onClick={setActiveTab} />
                        <NavButton id="doctor" icon="👨‍⚕️" label="医生管理" active={activeTab} onClick={setActiveTab} />
                        <NavButton id="drug" icon="💊" label="药品库" active={activeTab} onClick={setActiveTab} />
                        <div className="h-px bg-slate-200 my-2"></div>
                        <NavButton id="recipe" icon="🥗" label="膳食库" active={activeTab} onClick={setActiveTab} />
                        <NavButton id="exercise" icon="🏃" label="运动方案" active={activeTab} onClick={setActiveTab} />
                    </nav>
                </aside>

                <main className="flex-1 p-8 overflow-y-auto">
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

                    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-700">
                                {activeTab === 'recipe' ? '膳食资源库' : 
                                 activeTab === 'exercise' ? '运动方案库' : 
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
                                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleBatchUpload} />
                                <button onClick={downloadTemplate} className="bg-white text-slate-600 border border-slate-300 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-50 flex items-center gap-1">📥 下载模板</button>
                                <button onClick={() => fileInputRef.current?.click()} className="bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1.5 rounded text-xs font-bold hover:bg-teal-100 flex items-center gap-1">📤 导入Excel</button>
                                <button onClick={() => openEdit()} className="bg-teal-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-teal-700 shadow-sm flex items-center gap-1"><span>+</span> 新增资源</button>
                            </div>
                        </div>
                        
                        {loading ? <div className="text-center py-10">加载中...</div> : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th className="p-3 w-10">
                                            <input 
                                                type="checkbox" 
                                                onChange={handleSelectAll} 
                                                checked={items.length > 0 && selectedIds.size === items.length}
                                                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                            />
                                        </th>
                                        <th className="p-3">名称</th>
                                        <th className="p-3">关键信息</th>
                                        <th className="p-3">标签</th>
                                        <th className="p-3 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(item => (
                                        <tr key={item.id} className={`border-t border-slate-100 hover:bg-slate-50 ${selectedIds.has(item.id) ? 'bg-blue-50/30' : ''}`}>
                                            <td className="p-3">
                                                <input 
                                                    type="checkbox" 
                                                    onChange={() => handleSelectRow(item.id)}
                                                    checked={selectedIds.has(item.id)}
                                                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                                />
                                            </td>
                                            <td className="p-3 font-bold flex items-center gap-2">
                                                <span className="text-xl">{item.image}</span>
                                                {item.title}
                                            </td>
                                            <td className="p-3 text-xs text-slate-500 max-w-xs truncate" title={renderSummary(item)}>
                                                {renderSummary(item)}
                                            </td>
                                            <td className="p-3">
                                                {item.tags.map(t => <span key={t} className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-xs mr-1">{t}</span>)}
                                            </td>
                                            <td className="p-3 text-right space-x-2">
                                                <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline">编辑</button>
                                                <button onClick={() => handleDeleteContent(item.id)} className="text-red-600 hover:underline">删除</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {items.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">暂无资源</td></tr>}
                                </tbody>
                            </table>
                        )}
                    </section>
                </main>
            </div>

            {/* Detailed Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-xl w-full max-w-2xl shadow-2xl animate-scaleIn max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-lg text-slate-800">
                                {editItem.id?.includes('.') ? '新增' : '编辑'} 
                                {activeTab === 'recipe' && ' 膳食'}
                                {activeTab === 'exercise' && ' 运动方案'}
                                {activeTab === 'event' && ' 社区活动'}
                                {activeTab === 'service' && ' 医院服务'}
                                {activeTab === 'drug' && ' 药品'}
                                {activeTab === 'doctor' && ' 医生'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 font-bold text-xl">×</button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs text-slate-500 mb-1">名称</label>
                                <input className="border w-full p-2 rounded text-sm" value={editItem.title || ''} onChange={e=>setEditItem({...editItem, title:e.target.value})} />
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs text-slate-500 mb-1">图标 (Emoji)</label>
                                <input className="border w-full p-2 rounded text-sm" value={editItem.image || ''} onChange={e=>setEditItem({...editItem, image:e.target.value})} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs text-slate-500 mb-1">描述/备注</label>
                                <textarea className="border w-full p-2 rounded text-sm h-16" value={editItem.description || ''} onChange={e=>setEditItem({...editItem, description:e.target.value})} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs text-slate-500 mb-1">标签 (逗号分隔)</label>
                                <input className="border w-full p-2 rounded text-sm" value={editItem.tags?.join(',') || ''} onChange={e=>setEditItem({...editItem, tags:e.target.value.split(/[,， ]+/).filter(Boolean)})} />
                            </div>

                            {/* Dynamic Fields */}
                            {activeTab === 'recipe' && (
                                <>
                                    <div className="col-span-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-xs text-slate-500">配料及用量</label>
                                            <button 
                                                onClick={handleAiAnalysis}
                                                disabled={isAnalyzing}
                                                className="text-xs bg-teal-50 text-teal-600 px-2 py-0.5 rounded hover:bg-teal-100 disabled:opacity-50 flex items-center gap-1 border border-teal-200 transition-colors"
                                                title="自动根据名称和配料分析营养"
                                            >
                                                {isAnalyzing ? '⏳ 分析中...' : '✨ AI 营养分析'}
                                            </button>
                                        </div>
                                        <textarea 
                                            className="border w-full p-2 rounded text-sm h-16" 
                                            value={editItem.details?.ingredients||''} 
                                            onChange={e=>updateDetail('ingredients',e.target.value)} 
                                            placeholder="例如: 鸡胸肉 200g, 西兰花 100g, 杂粮饭 150g"
                                        />
                                    </div>
                                    <div className="col-span-2"><label className="block text-xs text-slate-500">制作步骤</label><textarea className="border w-full p-2 rounded text-sm h-24" value={editItem.details?.steps||''} onChange={e=>updateDetail('steps',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">制作时长</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.cookingTime||''} onChange={e=>updateDetail('cookingTime',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">难度</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.difficulty||''} onChange={e=>updateDetail('difficulty',e.target.value)} /></div>
                                    <div className="col-span-2"><label className="block text-xs text-slate-500">营养成分(AI估算)</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.nutrition||''} onChange={e=>updateDetail('nutrition',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">热量 (kcal)</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.cal||''} onChange={e=>updateDetail('cal',e.target.value)} /></div>
                                </>
                            )}

                            {activeTab === 'exercise' && (
                                <>
                                    <div><label className="block text-xs text-slate-500">运动类型</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.exerciseType||''} onChange={e=>updateDetail('exerciseType',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">频率 (每周几次)</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.frequency||''} onChange={e=>updateDetail('frequency',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">强度</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.intensity||''} onChange={e=>updateDetail('intensity',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">持续时间</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.duration||''} onChange={e=>updateDetail('duration',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">消耗热量</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.calories||''} onChange={e=>updateDetail('calories',e.target.value)} /></div>
                                    <div className="col-span-2"><label className="block text-xs text-slate-500">准备工作</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.prepWork||''} onChange={e=>updateDetail('prepWork',e.target.value)} /></div>
                                    <div className="col-span-2"><label className="block text-xs text-slate-500">注意事项</label><textarea className="border w-full p-2 rounded text-sm h-16" value={editItem.details?.contraindications||''} onChange={e=>updateDetail('contraindications',e.target.value)} /></div>
                                </>
                            )}

                            {activeTab === 'event' && (
                                <>
                                    <div><label className="block text-xs text-slate-500">活动类别</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.eventCategory||''} onChange={e=>updateDetail('eventCategory',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">时间 (YYYY-MM-DD HH:MM)</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.date||''} onChange={e=>updateDetail('date',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">地点</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.loc||''} onChange={e=>updateDetail('loc',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">人数上限</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.max||''} onChange={e=>updateDetail('max',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">组织者</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.organizer||''} onChange={e=>updateDetail('organizer',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">联系方式</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.contact||''} onChange={e=>updateDetail('contact',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">报名截止日期</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.deadline||''} onChange={e=>updateDetail('deadline',e.target.value)} /></div>
                                </>
                            )}

                            {activeTab === 'service' && (
                                <>
                                    <div><label className="block text-xs text-slate-500">服务类别</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.serviceCategory||''} onChange={e=>updateDetail('serviceCategory',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">所属科室</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.dept||''} onChange={e=>updateDetail('dept',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">单价</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.price||''} onChange={e=>updateDetail('price',e.target.value)} /></div>
                                    <div className="col-span-2"><label className="block text-xs text-slate-500">检查意义</label><textarea className="border w-full p-2 rounded text-sm h-16" value={editItem.details?.clinicalSignificance||''} onChange={e=>updateDetail('clinicalSignificance',e.target.value)} /></div>
                                    <div className="col-span-2"><label className="block text-xs text-slate-500">适用人群</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.targetAudience||''} onChange={e=>updateDetail('targetAudience',e.target.value)} /></div>
                                    <div className="col-span-2"><label className="block text-xs text-slate-500">检查须知</label><textarea className="border w-full p-2 rounded text-sm h-16" value={editItem.details?.preCheckPrep||''} onChange={e=>updateDetail('preCheckPrep',e.target.value)} /></div>
                                </>
                            )}

                            {activeTab === 'drug' && (
                                <>
                                    <div><label className="block text-xs text-slate-500">规格</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.spec||''} onChange={e=>updateDetail('spec',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">用途/适应症</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.usage||''} onChange={e=>updateDetail('usage',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">用法用量</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.dosage||''} onChange={e=>updateDetail('dosage',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">给药途径</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.adminRoute||''} onChange={e=>updateDetail('adminRoute',e.target.value)} /></div>
                                    <div className="col-span-2"><label className="block text-xs text-slate-500">服用时间与注意事项</label><textarea className="border w-full p-2 rounded text-sm h-16" value={editItem.details?.timingNotes||''} onChange={e=>updateDetail('timingNotes',e.target.value)} /></div>
                                    <div className="col-span-2"><label className="block text-xs text-slate-500">副作用</label><textarea className="border w-full p-2 rounded text-sm h-16" value={editItem.details?.sideEffects||''} onChange={e=>updateDetail('sideEffects',e.target.value)} /></div>
                                    <div className="col-span-2"><label className="block text-xs text-slate-500">禁忌症</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.drugContraindications||''} onChange={e=>updateDetail('drugContraindications',e.target.value)} /></div>
                                    <div className="col-span-2"><label className="block text-xs text-slate-500">药物相互作用</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.interactions||''} onChange={e=>updateDetail('interactions',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">储存与有效期</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.storage||''} onChange={e=>updateDetail('storage',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">漏服处理</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.missedDose||''} onChange={e=>updateDetail('missedDose',e.target.value)} /></div>
                                </>
                            )}

                            {activeTab === 'doctor' && (
                                <>
                                    <div><label className="block text-xs text-slate-500">所属科室</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.dept||''} onChange={e=>updateDetail('dept',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">职称</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.title||''} onChange={e=>updateDetail('title',e.target.value)} /></div>
                                    <div className="col-span-2"><label className="block text-xs text-slate-500">擅长领域</label><textarea className="border w-full p-2 rounded text-sm h-16" value={editItem.details?.specialty||''} onChange={e=>updateDetail('specialty',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">门诊时间</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.schedule||''} onChange={e=>updateDetail('schedule',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">医院</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.hospital||''} onChange={e=>updateDetail('hospital',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">签约平台账号</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.username||''} onChange={e=>updateDetail('username',e.target.value)} /></div>
                                    <div><label className="block text-xs text-slate-500">密码</label><input className="border w-full p-2 rounded text-sm" value={editItem.details?.password||''} onChange={e=>updateDetail('password',e.target.value)} /></div>
                                </>
                            )}
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
