
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
    targetAudience: ['老年人', '孕产妇', '儿童', '高血压患者', '糖尿病患者', '全人群'],
    enrollMethod: ['线上预约', '电话报名', '现场空降'],
    depts: ['全科', '中医科', '内科', '外科', '妇科', '儿科', '口腔科', '康复科', '预防保健科'],
    docTitles: ['主任医师', '副主任医师', '主治医师', '医师', '康复师', '营养师'],
    docStatus: ['出诊中', '停诊', '休假'],
    drugRx: ['RX (处方药)', 'OTC (甲类)', 'OTC (乙类)'],
    drugInsurance: ['甲类', '乙类', '自费'],
    drugStock: ['充足', '紧张', '缺货'],
    dietDifficulty: ['初级', '中等', '较难'],
    exerciseIntensity: ['低强度', '中强度', '高强度'],
    dietTags: ['低GI', '高纤维', '低脂', '高蛋白', '适合糖友', '护心'],
    exerciseTypes: ['有氧', '力量', '柔韧性', '康复训练', '体态矫正'],
    serviceInsurance: ['甲类', '乙类', '自费'],
    bookingTypes: ['需预约', '无需预约'],
};

export const ResourceAdmin: React.FC<Props> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState<'event' | 'service' | 'doctor' | 'drug' | 'recipe' | 'exercise' | 'audit'>('event');
    const [eventSubTab, setEventSubTab] = useState<'list' | 'circle'>('list');
    
    const [items, setItems] = useState<ContentItem[]>([]);
    const [interactions, setInteractions] = useState<InteractionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('加载中...');
    
    const [dbStatus, setDbStatus] = useState<{status: string, message: string, details?: string} | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<Partial<ContentItem>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const batchImportRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, [activeTab, eventSubTab]);

    useEffect(() => {
        runDiagnostics();
    }, []);

    const runDiagnostics = async () => {
        const result = await checkDbConnection();
        setDbStatus(result);
    };

    const loadData = async () => {
        try {
            setLoading(true);
            setLoadingText('加载数据中...');
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

    const handleInteractionStatus = async (id: string, status: InteractionItem['status']) => {
        await updateInteractionStatus(id, status);
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
                <div className="flex items-center gap-4">
                    <button onClick={onLogout} className="bg-teal-800 hover:bg-teal-900 px-4 py-1.5 rounded text-xs font-bold transition-colors">退出</button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-64 bg-white border-r border-slate-200 flex flex-col p-4 space-y-2">
                    <NavButton id="audit" icon="🛡️" label="审核中心" active={activeTab} onClick={setActiveTab} />
                    <div className="h-px bg-slate-200 my-2"></div>
                    <NavButton id="event" icon="✨" label="社区活动" active={activeTab} onClick={setActiveTab} />
                    <NavButton id="service" icon="🏥" label="医院服务" active={activeTab} onClick={setActiveTab} />
                    <NavButton id="doctor" icon="👨‍⚕️" label="医生管理" active={activeTab} onClick={setActiveTab} />
                    <NavButton id="drug" icon="💊" label="药品库" active={activeTab} onClick={setActiveTab} />
                    <NavButton id="recipe" icon="🥗" label="膳食库" active={activeTab} onClick={setActiveTab} />
                    <NavButton id="exercise" icon="🏃" label="运动/康复" active={activeTab} onClick={setActiveTab} />
                </aside>

                <main className="flex-1 p-8 overflow-y-auto">
                    {activeTab === 'audit' ? (
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <h3 className="text-lg font-bold mb-4">入群/活动报名审核</h3>
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">类型</th><th className="p-3">申请人</th><th className="p-3">目标对象</th><th className="p-3">日期</th><th className="p-3 text-right">操作</th></tr></thead>
                                <tbody>
                                    {interactions.map(i => (
                                        <tr key={i.id} className="border-t border-slate-50">
                                            <td className="p-3"><span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">{i.type === 'circle_join' ? '入圈申请' : '活动报名'}</span></td>
                                            <td className="p-3 font-bold">{i.userName}</td>
                                            <td className="p-3 text-slate-500">{i.targetName}</td>
                                            <td className="p-3 text-slate-400 text-xs">{i.date}</td>
                                            <td className="p-3 text-right">
                                                {i.status === 'pending' ? (
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={() => handleInteractionStatus(i.id, 'confirmed')} className="text-green-600 font-bold">同意</button>
                                                        <button onClick={() => handleInteractionStatus(i.id, 'cancelled')} className="text-red-500">忽略</button>
                                                    </div>
                                                ) : <span className="text-slate-300">已处理</span>}
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
                                    <h3 className="text-lg font-bold">资源列表</h3>
                                    {activeTab === 'event' && (
                                        <div className="flex bg-slate-100 p-1 rounded-lg">
                                            <button onClick={() => setEventSubTab('list')} className={`px-4 py-1 rounded-md text-xs font-bold ${eventSubTab === 'list' ? 'bg-white shadow text-teal-600' : 'text-slate-500'}`}>活动</button>
                                            <button onClick={() => setEventSubTab('circle')} className={`px-4 py-1 rounded-md text-xs font-bold ${eventSubTab === 'circle' ? 'bg-white shadow text-teal-600' : 'text-slate-500'}`}>圈子</button>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => openEdit()} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-bold">+ 新增内容</button>
                            </div>
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">名称</th><th className="p-3">详情/状态</th><th className="p-3">发起者</th><th className="p-3 text-right">操作</th></tr></thead>
                                <tbody className="divide-y divide-slate-50">
                                    {items.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                            <td className="p-3 flex items-center gap-3">
                                                <span className="text-2xl bg-slate-100 p-1 rounded-lg">{item.image}</span>
                                                <span className="font-bold text-slate-700">{item.title}</span>
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${item.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                                                    {item.status === 'active' ? '已上架' : '待审核申请'}
                                                </span>
                                                <div className="text-[10px] text-slate-400 mt-1 truncate max-w-[200px]">{item.description}</div>
                                            </td>
                                            <td className="p-3 text-xs text-slate-500">
                                                {item.details?.creatorName ? (
                                                    <div className="flex flex-col">
                                                        <span>{item.details.creatorName}</span>
                                                        <span className="text-[9px] opacity-60">({item.details.creatorRole === 'doctor' ? '医生' : '职工'})</span>
                                                    </div>
                                                ) : <span className="opacity-40">系统内置</span>}
                                            </td>
                                            <td className="p-3 text-right">
                                                <button onClick={() => openEdit(item)} className="text-blue-600 mr-3">查看/编辑</button>
                                                <button onClick={() => deleteContent(item.id).then(loadData)} className="text-red-500">删除</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </main>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4">
                        <h3 className="text-lg font-bold">资源属性设置</h3>
                        <div className="space-y-3">
                            <InputField label="标题/名称" value={editItem.title} onChange={(v:any)=>setEditItem({...editItem, title:v})} />
                            <TextAreaField label="简介内容" value={editItem.description} onChange={(v:any)=>setEditItem({...editItem, description:v})} />
                            <SelectField label="展示状态" value={editItem.status} options={['active', 'pending', 'rejected']} onChange={(v:any)=>setEditItem({...editItem, status:v})} />
                            {editItem.type === 'circle' && <TagSelector label="圈子分类" tags={PRESETS.circleTags} selected={editItem.tags} onToggle={(t:string)=>{
                                const cur = editItem.tags || [];
                                setEditItem({...editItem, tags: cur.includes(t) ? cur.filter(x=>x!==t) : [...cur, t]});
                            }} />}
                        </div>
                        <div className="flex gap-2 justify-end pt-4 border-t">
                            <button onClick={()=>setIsModalOpen(false)} className="px-4 py-2 text-slate-500">取消</button>
                            <button onClick={handleSaveContent} className="px-6 py-2 bg-teal-600 text-white rounded-lg font-bold">保存更改</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const NavButton = ({ id, icon, label, active, onClick }: any) => (
    <button onClick={() => onClick(id)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${active === id ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-50'}`}>
        <span className="text-lg">{icon}</span>{label}
    </button>
);

const InputField = ({ label, value, onChange }: any) => (
    <div><label className="text-[10px] font-bold text-slate-400 block mb-1">{label}</label><input className="w-full border p-2.5 rounded-xl text-sm" value={value || ''} onChange={e=>onChange(e.target.value)} /></div>
);

const TextAreaField = ({ label, value, onChange }: any) => (
    <div><label className="text-[10px] font-bold text-slate-400 block mb-1">{label}</label><textarea className="w-full border p-2.5 rounded-xl text-sm h-24" value={value || ''} onChange={e=>onChange(e.target.value)} /></div>
);

const SelectField = ({ label, value, options, onChange }: any) => (
    <div><label className="text-[10px] font-bold text-slate-400 block mb-1">{label}</label><select className="w-full border p-2.5 rounded-xl text-sm bg-white" value={value || ''} onChange={e=>onChange(e.target.value)}>{options.map((o:any)=><option key={o} value={o}>{o}</option>)}</select></div>
);

const TagSelector = ({ label, tags, selected, onToggle }: any) => (
    <div>
        <label className="text-[10px] font-bold text-slate-400 block mb-2">{label}</label>
        <div className="flex flex-wrap gap-2">{tags.map((t:string)=><button key={t} onClick={()=>onToggle(t)} className={`px-3 py-1 rounded-full text-xs border ${selected?.includes(t)?'bg-teal-600 text-white border-teal-600':'text-slate-500 border-slate-200'}`}>{t}</button>)}</div>
    </div>
);
