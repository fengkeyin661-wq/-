
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
    exerciseTypes: ['有氧', '力量', '柔韧性', '康复训练', '体态矫正'],
    // New Service Presets
    serviceInsurance: ['甲类', '乙类', '自费'],
    bookingTypes: ['需预约', '无需预约'],
    // Circle Presets
    circleTags: ['运动', '饮食', '慢病', '养生', '心理']
};

export const ResourceAdmin: React.FC<Props> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState<'event' | 'service' | 'doctor' | 'drug' | 'recipe' | 'exercise'>('event');
    // Sub-tab for Event (Community) section
    const [eventSubTab, setEventSubTab] = useState<'list' | 'circle'>('list');
    
    const [items, setItems] = useState<ContentItem[]>([]);
    const [interactions, setInteractions] = useState<InteractionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('加载中...');
    
    // DB Diagnostics
    const [dbStatus, setDbStatus] = useState<{status: string, message: string, details?: string} | null>(null);

    // Content Edit State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<Partial<ContentItem>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Batch Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const fileInputRef = useRef<HTMLInputElement>(null);
    // Generic ref for Excel Import
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
        setLoading(true);
        setLoadingText('加载数据中...');
        setSelectedIds(new Set()); 
        let contentType: string | string[] = '';
        switch(activeTab) {
            case 'recipe': contentType = 'meal'; break;
            case 'exercise': contentType = 'exercise'; break;
            case 'event': 
                // Load both events and circles for this tab context, filter later
                contentType = ['event', 'circle']; 
                break;
            case 'service': contentType = 'service'; break;
            case 'drug': contentType = 'drug'; break;
            case 'doctor': contentType = 'doctor'; break;
        }

        const content = await fetchContent(contentType);
        
        // Filter based on subTab if activeTab is event
        if (activeTab === 'event') {
            if (eventSubTab === 'circle') {
                setItems(content.filter(c => c.type === 'circle'));
            } else {
                setItems(content.filter(c => c.type === 'event'));
            }
        } else {
            setItems(content);
        }

        if (activeTab === 'event' && eventSubTab === 'list') {
            const inters = await fetchInteractions('event_signup');
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

    // --- Circle Presets Logic ---
    const handleInitCircles = async () => {
        if (!confirm("确定要一键开通以下热门圈子吗？\n1. 减重打卡\n2. 控糖互助\n3. 每日万步\n4. 中医养生\n\n如果已存在同名圈子将不会重复创建。")) return;
        
        setLoading(true);
        const defaults = [
            { title: '减重打卡', image: '⚖️', description: '管住嘴迈开腿，一起瘦！科学减重经验分享。', tags: ['运动','饮食'] },
            { title: '控糖互助', image: '🥗', description: '分享控糖食谱和心得，糖尿病友及高危人群互助。', tags: ['慢病','饮食'] },
            { title: '每日万步', image: '👟', description: '晒微信步数，赢健康积分，走出健康好身材。', tags: ['运动'] },
            { title: '中医养生', image: '🌿', description: '四季养生，穴位按摩，中医药膳交流。', tags: ['养生'] }
        ];

        // Fetch existing to avoid dupe
        const existing = await fetchContent('circle');
        const existingTitles = existing.map(e => e.title);

        let addedCount = 0;
        for (const def of defaults) {
            if (!existingTitles.includes(def.title)) {
                await saveContent({
                    id: `circle_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
                    type: 'circle',
                    title: def.title,
                    image: def.image,
                    description: def.description,
                    tags: def.tags,
                    status: 'active',
                    isUserUpload: false,
                    updatedAt: new Date().toISOString(),
                    details: { memberCount: Math.floor(Math.random() * 50) + 10 } // Fake initial members
                });
                addedCount++;
            }
        }
        
        setLoading(false);
        alert(`操作完成！新开通 ${addedCount} 个圈子。`);
        loadData();
    };

    // --- Generic Excel Handling Logic ---
    const getTemplateConfig = () => {
        switch(activeTab) {
            case 'event':
                // Community Event
                return {
                    name: '社区活动导入模板',
                    data: [{
                        "活动ID（系统生成）": "",
                        "活动名称": "秋季教职工颈椎健康讲座",
                        "活动类型": "健康讲座",
                        "主办科室/部门": "康复医学科",
                        "主讲/负责人": "王主任",
                        "活动时间": "2023-10-15 14:00",
                        "活动地点": "校医院三楼报告厅",
                        "封面图URL": "",
                        "活动简介（列表页）": "特邀康复科主任讲解颈椎病预防...",
                        "活动详情": "1.颈椎病成因\n2.预防手段\n3.现场体验",
                        "适宜人群": "长期伏案工作者",
                        "报名方式": "小程序在线报名",
                        "报名开始时间": "2023-10-01 08:00",
                        "报名截止时间": "2023-10-14 18:00",
                        "活动人数上限": 50,
                        "状态": "报名中",
                        "排序值": 10,
                        "关联服务项目": ""
                    }]
                };
            case 'doctor':
                return {
                    name: '医生信息库导入模板',
                    data: [{
                        "医生ID（系统生成）": "",
                        "医生工号": "YS1001",
                        "医生姓名": "张伟",
                        "所属科室编码": "REHAB001",
                        "职称": "主任医师",
                        "专长/简介": "擅长颈椎病、腰椎间盘突出...",
                        "详细履历": "医学博士，毕业于...",
                        "头像URL": "",
                        "出诊安排": "周一上午专家门诊",
                        "是否可在线咨询": "是",
                        "咨询费用（元）": 20,
                        "状态": "在职",
                        "排序值": 1
                    }]
                };
            case 'drug':
                return {
                    name: '药品信息库导入模板',
                    data: [{
                        "药品ID（系统生成）": "",
                        "药品通用名": "阿司匹林肠溶片",
                        "商品名": "拜阿司匹灵",
                        "规格": "100mg*30片",
                        "剂型": "片剂",
                        "生产厂家": "拜耳医药保健有限公司",
                        "药品分类": "心血管系统用药",
                        "医保类型": "甲类",
                        "参考单价（元）": 15.80,
                        "库存单位": "盒",
                        "用法用量": "口服，一次1片，一日1次",
                        "主要功效": "抗血小板聚集",
                        "重要注意事项": "活动性溃疡禁用",
                        "说明书URL": "",
                        "是否处方药": "是",
                        "状态": "在售"
                    }]
                };
            case 'exercise':
                return {
                    name: '运动方案库导入模板',
                    data: [{
                        "方案ID（系统生成）": "",
                        "运动方案名称": "办公室颈椎保健操",
                        "运动类型": "综合保健操",
                        "适用人群/场景": "久坐办公族",
                        "禁忌人群": "急性损伤期",
                        "单次时长": "10分钟",
                        "建议频率": "每日1-2次",
                        "核心动作与流程": "热身→米字操→肩部绕环→放松",
                        "强度提示": "低强度",
                        "所需器材": "无",
                        "教学视频/图解URL": "",
                        "注意事项": "动作宜慢不宜快",
                        "关联疾病/标签": "颈椎病,亚健康",
                        "状态": "启用"
                    }]
                };
            case 'service':
                return {
                    name: '医院服务项目',
                    data: [{
                        "项目ID（系统生成）": "", "项目名称": "示例：无痛胃镜", "归属科室编码": "DIGEST001", "一级分类": "检查", "二级分类": "内镜", "标签": "消化,无痛", "项目简介（列表页摘要）": "简述...", "项目详情/流程": "1.预约...", "适宜人群": "...", "禁忌与注意事项": "...", "临床意义": "...", "预约类型": "需预约", "预约规则模板": "常规", "就诊地点详情": "门诊3楼", "预计耗时": "30分钟", "报告出具时间": "即时", "标准价格(元)": 800, "医保类型": "乙类", "自费金额估算(元)": 160, "医保报销说明": "...", "排序值": 10, "初始状态": "上架"
                    }]
                };
            case 'recipe':
                return {
                    name: '膳食食谱库',
                    data: [{
                        "食谱名称": "清蒸鲈鱼", "制作难度": "⭐⭐", "所需食材": "鲈鱼1条, 姜葱适量", "制作步骤": "1.洗净... 2.蒸...", "热量(kcal)": 120, "主要营养素": "蛋白质, 优质脂肪", "健康标签": "高蛋白, 低脂"
                    }]
                };
            default:
                return null;
        }
    };

    const handleDownloadTemplate = () => {
        const config = getTemplateConfig();
        if (!config) return;

        const ws = XLSX.utils.json_to_sheet(config.data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, config.name);
        XLSX.writeFile(wb, `${config.name}.xlsx`);
    };

    const handleBatchImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setLoadingText('正在解析 Excel...');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) throw new Error("文件内容为空");

            let successCount = 0;
            const newItems: ContentItem[] = [];

            for (const row of jsonData) {
                // Common ID and timestamp
                const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                const now = new Date().toISOString();
                let item: ContentItem | null = null;

                // Mapper based on activeTab
                switch(activeTab) {
                    case 'event':
                        if (!row['活动名称']) continue;
                        item = {
                            id, 
                            type: 'event', 
                            title: row['活动名称'], 
                            tags: row['活动类型'] ? [row['活动类型']] : [], 
                            description: row['活动简介（列表页）'] || '', 
                            image: row['封面图URL'] || '🎉', 
                            author: row['主办科室/部门'],
                            status: ['报名中', '已截止', '已结束'].includes(row['状态']) ? 'active' : 'pending', 
                            isUserUpload: false, 
                            updatedAt: now,
                            details: {
                                speaker: row['主讲/负责人'],
                                date: row['活动时间'],
                                loc: row['活动地点'],
                                content: row['活动详情'],
                                targetAudience: row['适宜人群'],
                                method: row['报名方式'],
                                signupStart: row['报名开始时间'],
                                signupEnd: row['报名截止时间'],
                                limit: row['活动人数上限'],
                                businessStatus: row['状态'],
                                sortOrder: row['排序值'],
                                relatedServiceIds: row['关联服务项目']
                            }
                        };
                        break;
                    case 'doctor':
                        if (!row['医生姓名']) continue;
                        item = {
                            id, 
                            type: 'doctor', 
                            title: row['医生姓名'], 
                            tags: row['所属科室编码'] ? [row['所属科室编码']] : [], 
                            description: row['专长/简介'] || '', 
                            image: row['头像URL'] || '👨‍⚕️', 
                            status: ['在职', '出诊中'].includes(row['状态']) ? 'active' : 'pending', 
                            isUserUpload: false, 
                            updatedAt: now,
                            details: {
                                employeeId: row['医生工号'],
                                deptCode: row['所属科室编码'],
                                title: row['职称'],
                                resume: row['详细履历'],
                                schedule: row['出诊安排'],
                                onlineConsult: row['是否可在线咨询'] === '是',
                                fee: row['咨询费用（元）'],
                                docStatus: row['状态'],
                                sortOrder: row['排序值']
                            }
                        };
                        break;
                    case 'drug':
                        if (!row['药品通用名']) continue;
                        item = {
                            id, 
                            type: 'drug', 
                            title: row['药品通用名'], 
                            tags: row['药品分类'] ? [row['药品分类']] : [], 
                            description: row['主要功效'] || '', 
                            image: '💊', 
                            status: ['在售', '正常'].includes(row['状态']) ? 'active' : 'pending', 
                            isUserUpload: false, 
                            updatedAt: now,
                            details: {
                                tradeName: row['商品名'],
                                spec: row['规格'],
                                dosageForm: row['剂型'],
                                manufacturer: row['生产厂家'],
                                insuranceType: row['医保类型'],
                                price: row['参考单价（元）'],
                                unit: row['库存单位'],
                                usage: row['用法用量'],
                                contraindications: row['重要注意事项'],
                                manualUrl: row['说明书URL'],
                                isRx: row['是否处方药'] === '是',
                                stock: row['状态'] === '在售' ? '充足' : '缺货' // Rough mapping
                            }
                        };
                        break;
                    case 'exercise':
                        if (!row['运动方案名称']) continue;
                        item = {
                            id, 
                            type: 'exercise', 
                            title: row['运动方案名称'], 
                            tags: row['运动类型'] ? [row['运动类型']] : [], 
                            description: row['核心动作与流程'] || '', 
                            image: '🏃', 
                            status: row['状态'] === '启用' ? 'active' : 'pending', 
                            isUserUpload: false, 
                            updatedAt: now,
                            details: {
                                audience: row['适用人群/场景'],
                                contraindications: row['禁忌人群'],
                                duration: row['单次时长'],
                                frequency: row['建议频率'],
                                steps: row['核心动作与流程'],
                                intensity: row['强度提示'],
                                equipment: row['所需器材'],
                                videoUrl: row['教学视频/图解URL'],
                                risks: row['注意事项'],
                                relatedTags: row['关联疾病/标签']
                            }
                        };
                        // Append related tags to main tags
                        if (row['关联疾病/标签']) {
                            item.tags.push(...row['关联疾病/标签'].split(/[,，]/));
                        }
                        break;
                    case 'service':
                        if (!row['项目名称']) continue;
                        item = {
                            id, type: 'service', title: row['项目名称'], tags: row['标签']?.split(/[,，]/) || [],
                            description: row['项目简介（列表页摘要）'] || '', image: '🏥', status: row['初始状态'] === '上架' ? 'active' : 'pending',
                            isUserUpload: false, updatedAt: now,
                            details: {
                                deptCode: row['归属科室编码'], categoryL1: row['一级分类'], categoryL2: row['二级分类'],
                                workflow: row['项目详情/流程'], audience: row['适宜人群'], contraindications: row['禁忌与注意事项'],
                                clinicalSignificance: row['临床意义'], bookingType: row['预约类型'], bookingTemplate: row['预约规则模板'],
                                location: row['就诊地点详情'], duration: row['预计耗时'], reportTime: row['报告出具时间'],
                                price: row['标准价格(元)'], insuranceType: row['医保类型'], selfPayEst: row['自费金额估算(元)'],
                                reimbursementNote: row['医保报销说明'], sortOrder: row['排序值'] || 999
                            }
                        };
                        break;
                    case 'recipe':
                        if (!row['食谱名称']) continue;
                        item = {
                            id, type: 'meal', title: row['食谱名称'], tags: row['健康标签']?.split(/[,，]/) || [],
                            description: '', image: '🍲', status: 'active', isUserUpload: false, updatedAt: now,
                            details: {
                                difficulty: row['制作难度'], ingredients: row['所需食材'], steps: row['制作步骤'],
                                cal: row['热量(kcal)'], nutrition: row['主要营养素']
                            }
                        };
                        break;
                }

                if (item) newItems.push(item);
            }

            setLoadingText(`正在导入 ${newItems.length} 条数据...`);
            
            // Batch Save
            for (const item of newItems) {
                await saveContent(item);
                successCount++;
            }

            alert(`导入完成！成功: ${successCount} 条`);
            loadData();

        } catch (error: any) {
            console.error("Import Error", error);
            alert(`导入失败: ${error.message}`);
        } finally {
            setLoading(false);
            if (batchImportRef.current) batchImportRef.current.value = '';
        }
    };

    // --- Helper for other features ---
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
            if (activeTab === 'event') {
                type = eventSubTab === 'circle' ? 'circle' : 'event';
            }
            if (activeTab === 'service') type = 'service';
            if (activeTab === 'drug') type = 'drug';
            if (activeTab === 'doctor') type = 'doctor';
            
            setEditItem({
                id: Date.now().toString(),
                type,
                title: '',
                status: 'active',
                tags: [],
                image: type === 'meal' ? '🍲' : type === 'exercise' ? '🏃' : type === 'event' ? '🎉' : type === 'service' ? '🏥' : type === 'drug' ? '💊' : type === 'circle' ? '⭕' : '👨‍⚕️',
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
                    {/* Interaction Tables (Top) - Only for Events now */}
                    {activeTab === 'event' && eventSubTab === 'list' && (
                        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                            <h3 className="text-lg font-bold text-slate-700 mb-4 border-l-4 border-teal-500 pl-3">
                                活动报名审核
                            </h3>
                            {renderInteractionTable(getBookings(activeTab))}
                        </section>
                    )}

                    {/* Resource List (Bottom) */}
                    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex flex-col gap-4 mb-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-slate-700">
                                    {activeTab === 'recipe' ? '膳食资源库' : 
                                     activeTab === 'exercise' ? '运动康复库' : 
                                     activeTab === 'event' ? '社区活动与圈子' :
                                     activeTab === 'service' ? '医院服务项目' :
                                     activeTab === 'drug' ? '医院药品目录' : '医生信息库'}
                                </h3>
                                <div className="flex gap-2">
                                    {/* Generic Batch Import for All Tabs except Circle Sub-tab */}
                                    {!(activeTab === 'event' && eventSubTab === 'circle') && (
                                        <>
                                            <button 
                                                onClick={handleDownloadTemplate}
                                                className="bg-white text-slate-600 border border-slate-300 px-3 py-2 rounded text-xs font-bold hover:bg-slate-50 flex items-center gap-2"
                                            >
                                                📥 下载模板
                                            </button>
                                            <input 
                                                type="file" 
                                                ref={batchImportRef} 
                                                className="hidden" 
                                                accept=".xlsx, .xls"
                                                onChange={handleBatchImport}
                                            />
                                            <button 
                                                onClick={() => batchImportRef.current?.click()}
                                                className="bg-indigo-600 text-white px-3 py-2 rounded text-xs font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-sm"
                                            >
                                                📂 批量导入
                                            </button>
                                            <div className="w-px h-8 bg-slate-200 mx-1"></div>
                                        </>
                                    )}

                                    {activeTab === 'event' && eventSubTab === 'circle' && (
                                        <button 
                                            onClick={handleInitCircles}
                                            className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-100 flex items-center gap-1 animate-fadeIn"
                                        >
                                            🚀 一键开通热门圈子
                                        </button>
                                    )}

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

                            {/* Event Sub-Tabs */}
                            {activeTab === 'event' && (
                                <div className="flex border-b border-slate-100">
                                    <button 
                                        onClick={() => setEventSubTab('list')}
                                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${eventSubTab === 'list' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500'}`}
                                    >
                                        📅 社区活动列表
                                    </button>
                                    <button 
                                        onClick={() => setEventSubTab('circle')}
                                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${eventSubTab === 'circle' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500'}`}
                                    >
                                        ⭕️ 热门圈子管理
                                    </button>
                                </div>
                            )}
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
                                                {item.type === 'circle' && `👥 成员: ${item.details?.memberCount || 0}人`}
                                                {item.type === 'doctor' && `${item.details?.deptCode} • ${item.details?.title}`}
                                                {item.type === 'drug' && `${item.details?.stock} • ${item.details?.spec}`}
                                                {item.type === 'service' && `¥${item.details?.price} • ${item.details?.insuranceType || (item.details?.insurance ? '医保' : '自费')}`}
                                                {item.type === 'exercise' && `强度:${item.details?.intensity} • ${item.details?.duration}`}
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
                                {activeTab === 'event' && eventSubTab === 'circle' ? '兴趣圈子' : 
                                 activeTab === 'event' ? '社区活动' :
                                 activeTab === 'service' ? '医院服务' :
                                 activeTab === 'doctor' ? '医生信息' :
                                 activeTab === 'drug' ? '药品条目' :
                                 activeTab === 'recipe' ? '膳食食谱' : '运动方案'}
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
                            {activeTab === 'event' && editItem.type === 'event' && (
                                <>
                                    <FormSection title="时间与地点">
                                        <InputField label="开始时间" type="datetime-local" value={editItem.details?.date} onChange={(v:any) => updateDetail('date', v)} />
                                        <InputField label="举办地点" placeholder="具体位置，如：社区中心2楼" value={editItem.details?.loc} onChange={(v:any) => updateDetail('loc', v)} />
                                    </FormSection>
                                    <FormSection title="活动详情">
                                        <InputField label="主讲人/负责人" value={editItem.details?.speaker} onChange={(v:any) => updateDetail('speaker', v)} />
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

                            {/* 1.1 CIRCLE (NEW) */}
                            {activeTab === 'event' && editItem.type === 'circle' && (
                                <>
                                    <FormSection title="圈子详情">
                                        <TextAreaField label="圈子简介 / Slogan" placeholder="一句话描述圈子宗旨" value={editItem.description} onChange={(v:any) => setEditItem({...editItem, description: v})} />
                                        <InputField label="初始成员数 (虚拟)" type="number" value={editItem.details?.memberCount} onChange={(v:any) => updateDetail('memberCount', v)} />
                                    </FormSection>
                                    <FormSection title="分类标签">
                                        <TagSelector label="圈子类型" tags={PRESETS.circleTags} selected={editItem.tags} onToggle={toggleTag} />
                                    </FormSection>
                                </>
                            )}

                            {/* 2. HOSPITAL SERVICE (Updated) */}
                            {activeTab === 'service' && (
                                <>
                                    <FormSection title="基础分类与标识">
                                        <SelectField label="归属科室" value={editItem.details?.dept} onChange={(v:any) => updateDetail('dept', v)} options={PRESETS.depts} />
                                        <InputField label="科室编码" placeholder="如：DEPT001" value={editItem.details?.deptCode} onChange={(v:any) => updateDetail('deptCode', v)} />
                                        <InputField label="一级分类" value={editItem.details?.categoryL1} onChange={(v:any) => updateDetail('categoryL1', v)} />
                                        <InputField label="二级分类" value={editItem.details?.categoryL2} onChange={(v:any) => updateDetail('categoryL2', v)} />
                                        <InputField label="排序值" type="number" value={editItem.details?.sortOrder} onChange={(v:any) => updateDetail('sortOrder', v)} />
                                    </FormSection>
                                    <FormSection title="服务内容">
                                        <TextAreaField label="项目简介 (列表摘要)" placeholder="80字内最佳" value={editItem.description} onChange={(v:any) => setEditItem({...editItem, description: v})} />
                                        <TextAreaField label="项目详情/流程" placeholder="支持换行" value={editItem.details?.workflow} onChange={(v:any) => updateDetail('workflow', v)} />
                                        <InputField label="适宜人群" full value={editItem.details?.audience} onChange={(v:any) => updateDetail('audience', v)} />
                                        <InputField label="禁忌与注意事项" full value={editItem.details?.contraindications} onChange={(v:any) => updateDetail('contraindications', v)} />
                                        <InputField label="临床意义" full value={editItem.details?.clinicalSignificance} onChange={(v:any) => updateDetail('clinicalSignificance', v)} />
                                    </FormSection>
                                    <FormSection title="预约与执行">
                                        <SelectField label="预约类型" value={editItem.details?.bookingType} onChange={(v:any) => updateDetail('bookingType', v)} options={PRESETS.bookingTypes} />
                                        <InputField label="预约规则模板" placeholder="如：常规检查预约" value={editItem.details?.bookingTemplate} onChange={(v:any) => updateDetail('bookingTemplate', v)} />
                                        <InputField label="就诊地点详情" value={editItem.details?.location} onChange={(v:any) => updateDetail('location', v)} />
                                        <InputField label="预计耗时" value={editItem.details?.duration} onChange={(v:any) => updateDetail('duration', v)} />
                                        <InputField label="报告出具时间" value={editItem.details?.reportTime} onChange={(v:any) => updateDetail('reportTime', v)} />
                                    </FormSection>
                                    <FormSection title="费用与医保">
                                        <InputField label="标准价格 (元)" type="number" value={editItem.details?.price} onChange={(v:any) => updateDetail('price', v)} />
                                        <SelectField label="医保类型" value={editItem.details?.insuranceType} onChange={(v:any) => updateDetail('insuranceType', v)} options={PRESETS.serviceInsurance} />
                                        <InputField label="自费估算 (元)" type="number" value={editItem.details?.selfPayEst} onChange={(v:any) => updateDetail('selfPayEst', v)} />
                                        <InputField label="医保报销说明" full value={editItem.details?.reimbursementNote} onChange={(v:any) => updateDetail('reimbursementNote', v)} />
                                    </FormSection>
                                    <FormSection title="标签">
                                        <InputField label="标签 (逗号分隔)" full value={editItem.tags?.join(',')} onChange={(v:any) => setEditItem({...editItem, tags: v.split(/[,，]/)})} />
                                    </FormSection>
                                </>
                            )}

                            {/* 3. DOCTOR */}
                            {activeTab === 'doctor' && (
                                <>
                                    <FormSection title="职业信息">
                                        <SelectField label="所属科室" value={editItem.details?.dept} onChange={(v:any) => updateDetail('dept', v)} options={PRESETS.depts} />
                                        <InputField label="科室编码" value={editItem.details?.deptCode} onChange={(v:any) => updateDetail('deptCode', v)} />
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
