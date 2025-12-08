
import React, { useState, useEffect, useRef } from 'react';
import { ContentItem, InteractionItem, fetchAllContent, fetchInteractions, saveContent, deleteContent, updateInteractionStatus, seedInitialData } from '../services/contentService';
import { calculateNutritionFromIngredients } from '../services/geminiService';
// @ts-ignore
import * as XLSX from 'xlsx';

interface Props {
    onLogout: () => void;
}

// Define Excel Templates Headers
const TEMPLATE_HEADERS: Record<string, string[]> = {
    'recipe': ['名称', '图标(Emoji)', '标签(逗号分隔)', '配料及用量', '制作步骤', '制作时长', '难度', '营养成分(可选-AI生成)', '热量(可选-AI生成)'],
    'exercise': ['名称', '图标(Emoji)', '标签', '运动类型', '频率(每周)', '强度', '持续时间(每次)', '消耗热量', '准备工作', '注意事项/内容'],
    'event': ['名称', '类别', '图标(Emoji)', '标签', '活动时间(YYYY-MM-DD HH:mm)', '报名截止时间(YYYY-MM-DD HH:mm)', '地点', '人数上限', '组织者', '联系方式'],
    'service': ['名称', '类别', '图标(Emoji)', '标签', '所属科室', '单价', '检查意义', '适用人群', '检查前准备'],
    'drug': ['药品名称', '图标(Emoji)', '标签', '用途/适应症', '用法用量', '给药途径', '服用时间与注意事项', '副作用', '禁忌症', '药物相互作用', '储存与有效期', '漏服处理', '库存', '规格'],
    'doctor': ['姓名', '图标(Emoji)', '标签', '科室', '职称', '擅长领域', '门诊时间', '所在医院']
};

export const ResourceAdmin: React.FC<Props> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState<'recipe' | 'exercise' | 'event' | 'service' | 'drug' | 'doctor'>('recipe');
    const [contentList, setContentList] = useState<ContentItem[]>([]);
    const [interactionList, setInteractionList] = useState<InteractionItem[]>([]);
    
    // Edit Modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<ContentItem>>({});

    // Batch Upload Modal
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [batchData, setBatchData] = useState<any[]>([]);
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        seedInitialData();
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        const allContent = await fetchAllContent();
        const allInteractions = await fetchInteractions();
        setContentList(allContent);
        setInteractionList(allInteractions);
    };

    // Filter Helpers
    const getItems = (type: string) => contentList.filter(i => i.type === type && i.status === 'active');
    const getPendingUploads = (type: string) => contentList.filter(i => i.type === type && i.status === 'pending');
    
    const getBookings = (type: string) => interactionList.filter(i => {
        if (type === 'service') return i.type === 'booking';
        if (type === 'drug') return i.type === 'drug_order';
        if (type === 'doctor') return i.type === 'signing';
        if (type === 'event') return i.type === 'event_signup';
        return false;
    });

    // Actions
    const handleAddNew = () => {
        let type: ContentItem['type'] = 'meal';
        if (activeTab === 'recipe') type = 'meal';
        if (activeTab === 'exercise') type = 'exercise';
        if (activeTab === 'event') type = 'event';
        if (activeTab === 'service') type = 'service';
        if (activeTab === 'drug') type = 'drug';
        if (activeTab === 'doctor') type = 'doctor';

        setCurrentItem({ id: Date.now().toString(), type, status: 'active', tags: [], details: {}, title: '' });
        setIsEditModalOpen(true);
    };

    const handleEdit = (item: ContentItem) => {
        setCurrentItem({ ...item });
        setIsEditModalOpen(true);
    };

    const handleSave = async () => {
        if (!currentItem.title) return alert("名称必填");
        await saveContent(currentItem as ContentItem);
        setIsEditModalOpen(false);
        loadData();
    };

    const handleDelete = async (id: string) => {
        if (confirm("确定删除吗？")) {
            await deleteContent(id);
            loadData();
        }
    };

    const handleAudit = async (item: ContentItem, pass: boolean) => {
        await saveContent({ ...item, status: pass ? 'active' : 'rejected' });
        loadData();
        alert(pass ? "已审核通过" : "已驳回");
    };

    const handleInteractionStatus = async (id: string, status: InteractionItem['status']) => {
        await updateInteractionStatus(id, status);
        loadData();
    };

    // --- Batch Upload Logic ---

    const handleDownloadTemplate = () => {
        const headers = TEMPLATE_HEADERS[activeTab];
        if (!headers) return;
        
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, `${activeTab}_template.xlsx`);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            setBatchData(data);
        };
        reader.readAsBinaryString(file);
    };

    const handleBatchSave = async () => {
        if (batchData.length === 0) return;
        setIsBatchProcessing(true);

        try {
            // Pre-process for AI (only for Recipes missing nutrition info)
            let nutritionMap: Record<string, any> = {};
            if (activeTab === 'recipe') {
                const needsAi = batchData.filter((row: any) => 
                    row['名称'] && row['配料及用量'] && (!row['营养成分(可选-AI生成)'] || !row['热量(可选-AI生成)'])
                ).map((row: any) => ({ name: row['名称'], ingredients: row['配料及用量'] }));

                if (needsAi.length > 0) {
                    try {
                        // Batch request to AI
                        const aiRes = await calculateNutritionFromIngredients(needsAi);
                        nutritionMap = aiRes.nutritionData || {};
                    } catch (e) {
                        console.error("AI Calc Failed", e);
                        alert("部分食谱营养AI计算失败，将使用空白数据保存。");
                    }
                }
            }

            // Convert and Save
            for (const row of batchData) {
                const item: ContentItem = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    type: activeTab === 'recipe' ? 'meal' : activeTab as any,
                    title: row['名称'] || row['药品名称'] || row['姓名'] || '未命名',
                    image: row['图标(Emoji)'] || '📦',
                    tags: (row['标签'] || row['标签(逗号分隔)'] || '').split(/[,，]/).map((s: string) => s.trim()).filter(Boolean),
                    author: '批量导入',
                    isUserUpload: false,
                    status: 'active',
                    updatedAt: new Date().toISOString(),
                    details: {}
                };

                const d = item.details || {};

                if (activeTab === 'recipe') {
                    d.ingredients = row['配料及用量'];
                    d.steps = row['制作步骤'];
                    d.cookingTime = row['制作时长'];
                    d.difficulty = row['难度'];
                    
                    const aiInfo = nutritionMap[item.title];
                    d.nutrition = row['营养成分(可选-AI生成)'] || aiInfo?.nutrition || '';
                    d.cal = row['热量(可选-AI生成)'] || aiInfo?.cal || '';
                } else if (activeTab === 'exercise') {
                    d.exerciseType = row['运动类型'];
                    d.frequency = row['频率(每周)'];
                    d.intensity = row['强度'];
                    d.duration = row['持续时间(每次)'];
                    d.calories = row['消耗热量'];
                    d.prepWork = row['准确工作/注意事项'] || row['准备工作'];
                    d.content = row['具体内容'] || row['注意事项/内容'];
                } else if (activeTab === 'event') {
                    d.eventCategory = row['类别'];
                    d.date = row['活动时间(YYYY-MM-DD HH:mm)'] || row['时间'];
                    d.deadline = row['报名截止时间(YYYY-MM-DD HH:mm)'];
                    d.loc = row['地点'];
                    d.max = Number(row['人数上限']) || 0;
                    d.organizer = row['组织者'];
                    d.contact = row['联系方式'];
                } else if (activeTab === 'service') {
                    d.serviceCategory = row['类别'];
                    d.dept = row['所属科室'];
                    d.price = row['单价'];
                    d.clinicalSignificance = row['检查意义'];
                    d.targetAudience = row['适用人群'];
                    d.preCheckPrep = row['检查前准备'];
                } else if (activeTab === 'drug') {
                    d.usage = row['用途/适应症'];
                    d.dosage = row['用法用量'];
                    d.adminRoute = row['给药途径'];
                    d.timingNotes = row['服用时间与注意事项'];
                    d.sideEffects = row['副作用'];
                    d.drugContraindications = row['禁忌症'];
                    d.interactions = row['药物相互作用'];
                    d.storage = row['储存与有效期'];
                    d.missedDose = row['漏服处理'];
                    d.stock = row['库存'];
                    d.spec = row['规格'];
                } else if (activeTab === 'doctor') {
                    d.dept = row['科室'];
                    d.title = row['职称'];
                    d.specialty = row['擅长领域'];
                    d.schedule = row['门诊时间'];
                    d.hospital = row['所在医院'];
                }

                item.details = d;
                await saveContent(item);
            }

            alert(`成功导入 ${batchData.length} 条数据！`);
            setBatchData([]);
            setIsBatchModalOpen(false);
            loadData();
        } catch (e) {
            console.error(e);
            alert("导入失败，请检查文件格式");
        } finally {
            setIsBatchProcessing(false);
        }
    };

    // Render Logic
    const renderContentTable = (items: ContentItem[], isAudit = false) => {
        // Helper to get nested details safely or special fields
        const getVal = (item: ContentItem, key: string) => {
            if (key.startsWith('details.')) {
                const k = key.split('.')[1];
                return (item.details as any)?.[k] || '-';
            }
            if (key === 'image') return <span className="text-xl">{item.image}</span>;
            if (key === 'tags') return item.tags && item.tags.length > 0 ? <span className="text-xs bg-slate-100 px-1 rounded">{item.tags.join(', ')}</span> : '-';
            return (item as any)[key] || '-';
        };

        // Define Columns based on active tab matching Excel Template
        let columns: { header: string, key: string, width?: string }[] = [];

        switch(activeTab) {
            case 'recipe':
                columns = [
                    { header: '图标', key: 'image', width: '60px' },
                    { header: '名称', key: 'title', width: '120px' },
                    { header: '标签', key: 'tags', width: '120px' },
                    { header: '配料及用量', key: 'details.ingredients', width: '200px' },
                    { header: '详细制作步骤', key: 'details.steps', width: '250px' },
                    { header: '制作时长', key: 'details.cookingTime', width: '80px' },
                    { header: '难度', key: 'details.difficulty', width: '60px' },
                    { header: '营养成分估算', key: 'details.nutrition', width: '180px' },
                    { header: '热量', key: 'details.cal', width: '80px' },
                ];
                break;
            case 'exercise':
                columns = [
                    { header: '图标', key: 'image', width: '60px' },
                    { header: '名称', key: 'title', width: '120px' },
                    { header: '标签', key: 'tags', width: '120px' },
                    { header: '运动类型', key: 'details.exerciseType', width: '100px' },
                    { header: '频率', key: 'details.frequency', width: '100px' },
                    { header: '强度', key: 'details.intensity', width: '80px' },
                    { header: '持续时间', key: 'details.duration', width: '100px' },
                    { header: '消耗热量', key: 'details.calories', width: '100px' },
                    { header: '准确工作/准备', key: 'details.prepWork', width: '150px' },
                    { header: '注意事项', key: 'details.content', width: '200px' },
                ];
                break;
            case 'event':
                columns = [
                    { header: '类别', key: 'details.eventCategory', width: '100px' },
                    { header: '名称', key: 'title', width: '150px' },
                    { header: '图标', key: 'image', width: '60px' },
                    { header: '标签', key: 'tags', width: '120px' },
                    { header: '活动时间', key: 'details.date', width: '160px' },
                    { header: '报名截止', key: 'details.deadline', width: '160px' },
                    { header: '地点', key: 'details.loc', width: '150px' },
                    { header: '报名人数/上限', key: 'details.max', width: '100px' },
                    { header: '组织者', key: 'details.organizer', width: '120px' },
                    { header: '联系方式', key: 'details.contact', width: '150px' },
                ];
                break;
            case 'service':
                columns = [
                    { header: '类别', key: 'details.serviceCategory', width: '80px' },
                    { header: '图标', key: 'image', width: '60px' },
                    { header: '名称', key: 'title', width: '150px' },
                    { header: '标签', key: 'tags', width: '120px' },
                    { header: '所属科室', key: 'details.dept', width: '120px' },
                    { header: '单价', key: 'details.price', width: '80px' },
                    { header: '检查意义', key: 'details.clinicalSignificance', width: '200px' },
                    { header: '适用人群', key: 'details.targetAudience', width: '150px' },
                    { header: '检查前准备', key: 'details.preCheckPrep', width: '200px' },
                ];
                break;
            case 'drug':
                columns = [
                    { header: '图标', key: 'image', width: '60px' },
                    { header: '药品名称', key: 'title', width: '150px' },
                    { header: '标签', key: 'tags', width: '120px' },
                    { header: '用途/适应症', key: 'details.usage', width: '200px' },
                    { header: '用法用量', key: 'details.dosage', width: '150px' },
                    { header: '给药途径', key: 'details.adminRoute', width: '100px' },
                    { header: '服用时间与注意事项', key: 'details.timingNotes', width: '200px' },
                    { header: '副作用', key: 'details.sideEffects', width: '150px' },
                    { header: '禁忌症', key: 'details.drugContraindications', width: '150px' },
                    { header: '药物相互作用', key: 'details.interactions', width: '150px' },
                    { header: '储存与有效期', key: 'details.storage', width: '150px' },
                    { header: '漏服处理', key: 'details.missedDose', width: '150px' },
                    // { header: '库存', key: 'details.stock', width: '80px' },
                    // { header: '规格', key: 'details.spec', width: '100px' },
                ];
                break;
            case 'doctor':
                columns = [
                    { header: '姓名', key: 'title', width: '100px' },
                    { header: '图标', key: 'image', width: '60px' },
                    { header: '标签', key: 'tags', width: '120px' },
                    { header: '科室', key: 'details.dept', width: '120px' },
                    { header: '职称', key: 'details.title', width: '100px' },
                    { header: '擅长领域', key: 'details.specialty', width: '250px' },
                    { header: '门诊时间', key: 'details.schedule', width: '150px' },
                    // { header: '所在医院', key: 'details.hospital', width: '150px' },
                ];
                break;
        }

        return (
            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
                <table className="w-full text-xs text-left whitespace-nowrap bg-white">
                    <thead className="bg-slate-50 text-slate-700 font-bold">
                        <tr>
                            {columns.map((col, idx) => (
                                <th key={idx} className="p-3 border-b border-slate-200" style={{ width: col.width, minWidth: col.width }}>{col.header}</th>
                            ))}
                            <th className="p-3 border-b border-slate-200 sticky right-0 bg-slate-50 shadow-sm z-10 w-[100px] text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {items.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                {columns.map((col, idx) => {
                                    const val = getVal(item, col.key);
                                    // Truncate long text
                                    // const displayVal = typeof val === 'string' && val.length > 30 ? 
                                    //     <span title={val}>{val.slice(0, 30)}...</span> : val;
                                    return (
                                        <td key={idx} className="p-3 border-b border-slate-50 max-w-[300px] overflow-hidden text-ellipsis whitespace-normal text-slate-600">
                                            {val}
                                        </td>
                                    );
                                })}
                                <td className="p-3 flex gap-2 justify-center sticky right-0 bg-white group-hover:bg-slate-50 shadow-sm border-b border-slate-50 z-10">
                                    {isAudit ? (
                                        <>
                                            <button onClick={() => handleAudit(item, true)} className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold hover:bg-green-100 border border-green-200">通过</button>
                                            <button onClick={() => handleAudit(item, false)} className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold hover:bg-red-100 border border-red-200">驳回</button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800 font-medium">编辑</button>
                                            <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800 font-medium">删除</button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={columns.length + 1} className="p-10 text-center text-slate-400 bg-slate-50">
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="text-3xl">📭</span>
                                        <span>暂无数据，请点击右上角新增或导入</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderInteractionTable = (items: InteractionItem[]) => (
        <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
            <table className="w-full text-sm text-left bg-white whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-700 font-bold">
                    <tr>
                        <th className="p-3">日期</th>
                        <th className="p-3">用户</th>
                        <th className="p-3">目标项目</th>
                        <th className="p-3">详情备注</th>
                        <th className="p-3">当前状态</th>
                        <th className="p-3 text-center">操作</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {items.map(i => (
                        <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3">{i.date}</td>
                            <td className="p-3 font-bold text-slate-700">{i.userName}</td>
                            <td className="p-3">{i.targetName}</td>
                            <td className="p-3 text-xs text-slate-500 max-w-[200px] truncate" title={i.details}>{i.details}</td>
                            <td className="p-3">
                                <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                    i.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                    i.status === 'confirmed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    i.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}>
                                    {i.status === 'pending' ? '待处理' : i.status === 'confirmed' ? '已确认' : i.status === 'completed' ? '已完成' : '已取消'}
                                </span>
                            </td>
                            <td className="p-3 flex gap-2 justify-center">
                                {i.status === 'pending' && (
                                    <button onClick={() => handleInteractionStatus(i.id, 'confirmed')} className="text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded text-xs font-bold hover:bg-blue-100">确认</button>
                                )}
                                {i.status === 'confirmed' && (
                                    <button onClick={() => handleInteractionStatus(i.id, 'completed')} className="text-green-600 bg-green-50 border border-green-100 px-2 py-1 rounded text-xs font-bold hover:bg-green-100">完成</button>
                                )}
                                {i.status !== 'cancelled' && i.status !== 'completed' && (
                                    <button onClick={() => handleInteractionStatus(i.id, 'cancelled')} className="text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded text-xs font-bold hover:bg-red-100">取消</button>
                                )}
                            </td>
                        </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-slate-400 bg-slate-50">暂无预约/订单记录</td></tr>}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">
            {/* Header */}
            <header className="bg-teal-800 text-white px-6 py-4 flex justify-between items-center shadow-md z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold">R</div>
                    <div>
                        <h1 className="text-lg font-bold">健康资源管理后台</h1>
                        <p className="text-xs text-teal-200">Resource & Operations Management</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm bg-teal-900 px-3 py-1 rounded">运营员: zzdx</span>
                    <button onClick={onLogout} className="bg-red-600/80 hover:bg-red-600 px-4 py-1.5 rounded text-xs font-bold transition-colors">退出</button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside className="w-56 bg-white border-r border-slate-200 flex flex-col py-4 z-10 shadow-sm">
                    {[
                        {id: 'recipe', icon: '🥗', label: '健康食谱管理'},
                        {id: 'exercise', icon: '🏃', label: '运动方案管理'},
                        {id: 'event', icon: '🎉', label: '社区活动管理'},
                        {id: 'service', icon: '🏥', label: '医院服务项目'},
                        {id: 'drug', icon: '💊', label: '医院药品库'},
                        {id: 'doctor', icon: '👨‍⚕️', label: '医生签约管理'},
                    ].map(nav => (
                        <button 
                            key={nav.id}
                            onClick={() => setActiveTab(nav.id as any)}
                            className={`flex items-center gap-3 px-6 py-3 text-sm font-bold border-l-4 transition-all ${
                                activeTab === nav.id 
                                ? 'border-teal-600 bg-teal-50 text-teal-700' 
                                : 'border-transparent text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <span className="text-lg">{nav.icon}</span>
                            {nav.label}
                        </button>
                    ))}
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-8 overflow-y-auto bg-slate-50">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            {activeTab === 'recipe' && <span>🥗 膳食资源与审核</span>}
                            {activeTab === 'exercise' && <span>🏃 运动资源与审核</span>}
                            {activeTab === 'event' && <span>🎉 社区活动发布与报名</span>}
                            {activeTab === 'service' && <span>🏥 医疗资源与预约</span>}
                            {activeTab === 'drug' && <span>💊 药品库存与配送</span>}
                            {activeTab === 'doctor' && <span>👨‍⚕️ 医生信息与家庭医生签约</span>}
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={() => setIsBatchModalOpen(true)} className="bg-white border border-teal-600 text-teal-600 px-4 py-2 rounded-lg font-bold hover:bg-teal-50 shadow-sm flex items-center gap-2 transition-all active:scale-95">
                                <span>📂</span> Excel批量导入
                            </button>
                            <button onClick={handleAddNew} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-teal-700 shadow-sm flex items-center gap-2 transition-all active:scale-95">
                                <span>+</span> 新增资源
                            </button>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {/* Section 1: Resource Library */}
                        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-bold text-slate-700 mb-4 border-l-4 border-teal-500 pl-3">
                                {activeTab === 'recipe' || activeTab === 'exercise' ? '资源库' : 
                                 activeTab === 'event' ? '活动列表' : 
                                 activeTab === 'service' ? '服务项目库' : 
                                 activeTab === 'drug' ? '药品库存' : '专家名录'}
                            </h3>
                            {renderContentTable(getItems(activeTab === 'recipe' ? 'meal' : activeTab))}
                        </section>

                        {/* Section 2: Interactions / Audits */}
                        {(activeTab === 'recipe' || activeTab === 'exercise') && (
                            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <h3 className="text-lg font-bold text-slate-700 mb-4 border-l-4 border-orange-500 pl-3 flex items-center gap-2">
                                    用户上传审核
                                    {getPendingUploads(activeTab === 'recipe' ? 'meal' : 'exercise').length > 0 && (
                                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full animate-pulse">待处理: {getPendingUploads(activeTab === 'recipe' ? 'meal' : 'exercise').length}</span>
                                    )}
                                </h3>
                                {renderContentTable(getPendingUploads(activeTab === 'recipe' ? 'meal' : 'exercise'), true)}
                            </section>
                        )}

                        {(activeTab !== 'recipe' && activeTab !== 'exercise') && (
                            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <h3 className="text-lg font-bold text-slate-700 mb-4 border-l-4 border-blue-500 pl-3">
                                    {activeTab === 'event' ? '活动报名记录' : 
                                     activeTab === 'service' ? '预约记录' : 
                                     activeTab === 'drug' ? '购药与配送订单' : '签约申请'}
                                </h3>
                                {renderInteractionTable(getBookings(activeTab))}
                            </section>
                        )}
                    </div>
                </main>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-scaleIn">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">
                            {currentItem.id ? '编辑/新增资源' : '新增资源'}
                        </h3>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">名称 / 标题</label>
                                <input className="w-full border p-2 rounded" value={currentItem.title} onChange={e => setCurrentItem({...currentItem, title: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">图标 (Emoji)</label>
                                <input className="w-full border p-2 rounded" value={currentItem.image} onChange={e => setCurrentItem({...currentItem, image: e.target.value})} />
                            </div>
                            
                            {/* Dynamic Fields based on Type */}
                            {currentItem.type === 'meal' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-bold text-slate-500">配料</label><input className="w-full border p-2 rounded" value={currentItem.details?.ingredients||''} onChange={e=>setCurrentItem({...currentItem, details:{...currentItem.details, ingredients:e.target.value}})} /></div>
                                    <div><label className="block text-xs font-bold text-slate-500">制作时长</label><input className="w-full border p-2 rounded" value={currentItem.details?.cookingTime||''} onChange={e=>setCurrentItem({...currentItem, details:{...currentItem.details, cookingTime:e.target.value}})} /></div>
                                    <div className="col-span-2"><label className="block text-xs font-bold text-slate-500">制作步骤</label><textarea className="w-full border p-2 rounded h-20" value={currentItem.details?.steps||''} onChange={e=>setCurrentItem({...currentItem, details:{...currentItem.details, steps:e.target.value}})} /></div>
                                </div>
                            )}
                            {currentItem.type === 'drug' && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-xs font-bold text-slate-500">库存</label><input className="w-full border p-2 rounded" value={currentItem.details?.stock||''} onChange={e=>setCurrentItem({...currentItem, details:{...currentItem.details, stock:e.target.value}})} /></div>
                                        <div><label className="block text-xs font-bold text-slate-500">规格</label><input className="w-full border p-2 rounded" value={currentItem.details?.spec||''} onChange={e=>setCurrentItem({...currentItem, details:{...currentItem.details, spec:e.target.value}})} /></div>
                                    </div>
                                    <div><label className="block text-xs font-bold text-slate-500">适应症</label><input className="w-full border p-2 rounded" value={currentItem.details?.usage||''} onChange={e=>setCurrentItem({...currentItem, details:{...currentItem.details, usage:e.target.value}})} /></div>
                                </div>
                            )}
                            {currentItem.type === 'doctor' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-bold text-slate-500">科室</label><input className="w-full border p-2 rounded" value={currentItem.details?.dept||''} onChange={e=>setCurrentItem({...currentItem, details:{...currentItem.details, dept:e.target.value}})} /></div>
                                    <div><label className="block text-xs font-bold text-slate-500">职称</label><input className="w-full border p-2 rounded" value={currentItem.details?.title||''} onChange={e=>setCurrentItem({...currentItem, details:{...currentItem.details, title:e.target.value}})} /></div>
                                </div>
                            )}
                            {currentItem.type === 'event' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-bold text-slate-500">类别</label><input className="w-full border p-2 rounded" value={currentItem.details?.eventCategory||''} onChange={e=>setCurrentItem({...currentItem, details:{...currentItem.details, eventCategory:e.target.value}})} /></div>
                                    <div><label className="block text-xs font-bold text-slate-500">人数上限</label><input className="w-full border p-2 rounded" type="number" value={currentItem.details?.max||''} onChange={e=>setCurrentItem({...currentItem, details:{...currentItem.details, max:Number(e.target.value)}})} /></div>
                                    
                                    <div><label className="block text-xs font-bold text-slate-500">活动时间</label><input type="datetime-local" className="w-full border p-2 rounded" value={currentItem.details?.date||''} onChange={e=>setCurrentItem({...currentItem, details:{...currentItem.details, date:e.target.value}})} /></div>
                                    <div><label className="block text-xs font-bold text-slate-500">报名截止</label><input type="datetime-local" className="w-full border p-2 rounded" value={currentItem.details?.deadline||''} onChange={e=>setCurrentItem({...currentItem, details:{...currentItem.details, deadline:e.target.value}})} /></div>
                                    
                                    <div><label className="block text-xs font-bold text-slate-500">地点</label><input className="w-full border p-2 rounded" value={currentItem.details?.loc||''} onChange={e=>setCurrentItem({...currentItem, details:{...currentItem.details, loc:e.target.value}})} /></div>
                                    <div><label className="block text-xs font-bold text-slate-500">组织者</label><input className="w-full border p-2 rounded" value={currentItem.details?.organizer||''} onChange={e=>setCurrentItem({...currentItem, details:{...currentItem.details, organizer:e.target.value}})} /></div>
                                    <div className="col-span-2"><label className="block text-xs font-bold text-slate-500">联系方式</label><input className="w-full border p-2 rounded" value={currentItem.details?.contact||''} onChange={e=>setCurrentItem({...currentItem, details:{...currentItem.details, contact:e.target.value}})} /></div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">标签 (逗号分隔)</label>
                                <input className="w-full border p-2 rounded" value={currentItem.tags?.join(',')} onChange={e => setCurrentItem({...currentItem, tags: e.target.value.split(',')})} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">取消</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-teal-600 text-white rounded font-bold hover:bg-teal-700">保存</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Upload Modal */}
            {isBatchModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 animate-scaleIn flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">批量导入 - {activeTab === 'recipe' ? '健康食谱' : activeTab === 'drug' ? '药品库' : activeTab === 'exercise' ? '运动方案' : '资源'}</h3>
                                <p className="text-xs text-slate-500 mt-1">请使用对应模板，AI 将自动处理部分缺失数据（如营养成分）</p>
                            </div>
                            <button onClick={() => setIsBatchModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-6">
                            {/* Step 1: Template */}
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-blue-800 text-sm">步骤 1: 获取模板</div>
                                    <div className="text-xs text-blue-600 mt-1">下载预设好的 Excel 模板，按格式填入数据</div>
                                </div>
                                <button onClick={handleDownloadTemplate} className="bg-white text-blue-600 border border-blue-200 px-3 py-1.5 rounded text-sm font-bold hover:bg-blue-100 shadow-sm transition-colors">
                                    ⬇️ 下载模板
                                </button>
                            </div>

                            {/* Step 2: Upload */}
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors relative cursor-pointer group">
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    onChange={handleFileUpload} 
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    accept=".xlsx, .xls"
                                />
                                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">📤</div>
                                <p className="font-bold text-slate-600">点击或拖拽上传 Excel 文件</p>
                                {batchData.length > 0 && (
                                    <div className="mt-4 bg-green-100 text-green-700 px-4 py-2 rounded-full text-xs font-bold animate-bounce">
                                        已解析 {batchData.length} 条数据
                                    </div>
                                )}
                            </div>

                            {/* Preview (First 3 rows) */}
                            {batchData.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-xs text-slate-500 mb-2 uppercase">数据预览 (前3条)</h4>
                                    <div className="border rounded-lg overflow-hidden text-xs shadow-sm">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 font-bold text-slate-700 border-b">
                                                <tr>
                                                    {Object.keys(batchData[0]).slice(0, 4).map(k => <th key={k} className="p-2">{k}</th>)}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {batchData.slice(0, 3).map((row, i) => (
                                                    <tr key={i}>
                                                        {Object.values(row).slice(0, 4).map((v: any, j) => <td key={j} className="p-2 text-slate-600">{v}</td>)}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                            <button onClick={() => setIsBatchModalOpen(false)} className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold">取消</button>
                            <button 
                                onClick={handleBatchSave}
                                disabled={isBatchProcessing || batchData.length === 0}
                                className="bg-teal-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-teal-700 shadow-lg disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95"
                            >
                                {isBatchProcessing ? 'AI 处理中...' : '开始导入并保存'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
