
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchArchives, deleteArchive, updateArchiveProfile, updateCriticalTrack, saveArchive, updateHealthRecordOnly, HealthArchive, findArchiveByCheckupId } from '../services/dataService';
import { parseHealthDataFromText, generateHealthAssessment, generateFollowUpSchedule } from '../services/geminiService';
import { generateSystemPortraits, evaluateRiskModels } from '../services/riskModelService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { HealthProfile, CriticalTrackRecord, HealthRecord, HealthAssessment, RiskLevel, RiskAnalysisData, QuestionnaireData } from '../types';
import { fetchContent, fetchInteractions } from '../services/contentService'; // Interconnection
import { CriticalHandleModal } from './CriticalHandleModal';
// @ts-ignore
import * as XLSX from 'xlsx';
// @ts-ignore
import * as mammoth from 'mammoth';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

interface Props {
    onSelectPatient: (archive: HealthArchive, mode?: 'view' | 'edit' | 'followup' | 'assessment') => void;
    onDataUpdate?: () => void;
    isAuthenticated: boolean;
    onTabChange?: (tab: string) => void;
}

export const AdminConsole: React.FC<Props> = ({ onSelectPatient, onDataUpdate, isAuthenticated, onTabChange }) => {
    const [archives, setArchives] = useState<HealthArchive[]>([]);
    
    // Operations Stats
    const [opsStats, setOpsStats] = useState({
        totalResources: 0,
        activeDoctors: 0,
        pendingSignings: 0,
        eventSignups: 0
    });
    
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'updated_at', direction: 'desc' });
    const [filterRisk, setFilterRisk] = useState<string>('ALL');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Edit Modal State
    const [editingArchive, setEditingArchive] = useState<HealthArchive | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<HealthProfile | null>(null);

    // Critical Modal State
    const [criticalModalArchive, setCriticalModalArchive] = useState<HealthArchive | null>(null);

    // Smart Batch Import (Full Parse & Questionnaire Excel)
    const [isSmartBatchModalOpen, setIsSmartBatchModalOpen] = useState(false);
    const [smartBatchFiles, setSmartBatchFiles] = useState<File[]>([]);
    const [smartBatchQuestionnaireFile, setSmartBatchQuestionnaireFile] = useState<File | null>(null); // New: Questionnaire File
    const [smartBatchLogs, setSmartBatchLogs] = useState<string[]>([]);
    const [isSmartBatchProcessing, setIsSmartBatchProcessing] = useState(false);

    // Questionnaire Update Import (Excel Only)
    const questionnaireImportRef = useRef<HTMLInputElement>(null);

    const configured = isSupabaseConfigured();

    useEffect(() => {
        if (isAuthenticated) {
            loadData();
            loadOperationsData(); // Load Cross-Platform Data
        }
    }, [isAuthenticated]);

    // Setup PDF Worker
    useEffect(() => {
        const setupPdfWorker = async () => {
            const workerUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
            // @ts-ignore
            const lib = pdfjsLib.default || pdfjsLib;
            if (!lib.GlobalWorkerOptions) return;
            try {
                const response = await fetch(workerUrl);
                if (!response.ok) throw new Error("Failed to fetch worker script");
                const workerScript = await response.text();
                const blob = new Blob([workerScript], { type: "text/javascript" });
                const blobUrl = URL.createObjectURL(blob);
                lib.GlobalWorkerOptions.workerSrc = blobUrl;
            } catch (error) {
                lib.GlobalWorkerOptions.workerSrc = workerUrl;
            }
        };
        setupPdfWorker();
    }, []);

    const loadData = async () => {
        if (!configured) { setLoading(false); return; }
        setLoading(true);
        setFetchError(null);
        setSelectedIds(new Set());
        try {
            const data = await fetchArchives();
            setArchives(data);
        } catch (error: unknown) {
            setFetchError(String(error));
        } finally {
            setLoading(false);
        }
    };

    const loadOperationsData = async () => {
        try {
            const contents = await fetchContent();
            const interactions = await fetchInteractions();
            
            setOpsStats({
                totalResources: contents.length,
                activeDoctors: contents.filter(c => c.type === 'doctor' && c.status === 'active').length,
                pendingSignings: interactions.filter(i => i.type === 'doctor_signing' && i.status === 'pending').length,
                eventSignups: interactions.filter(i => i.type === 'event_signup').length
            });
        } catch (e) {
            console.error("Ops Stats Load Failed", e);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`确定要删除 ${name} 的健康档案吗？此操作不可恢复。`)) {
            const success = await deleteArchive(id);
            if (success) { loadData(); if (onDataUpdate) onDataUpdate(); }
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        if (confirm(`⚠️ 危险操作：确定要批量删除选中的 ${selectedIds.size} 份健康档案吗？`)) {
            setLoading(true);
            for (const id of Array.from(selectedIds)) await deleteArchive(id as string);
            loadData(); if (onDataUpdate) onDataUpdate();
            setLoading(false);
        }
    };

    const handleBatchFixBMI = async () => {
        const candidates = archives.filter(a => {
            const b = a.health_record.checkup?.basics;
            if (!b) return false;
            const h = Number(b.height);
            const w = Number(b.weight);
            const bmi = Number(b.bmi);
            return h > 0 && w > 0 && (!bmi || bmi === 0);
        });
        if (candidates.length === 0) return alert("未发现缺失BMI的档案。");
        if (!confirm(`发现 ${candidates.length} 份档案缺失BMI，是否自动修复？`)) return;
        setLoading(true);
        for (const arch of candidates) {
            const b = arch.health_record.checkup.basics;
            const h_m = Number(b.height) / 100;
            const newBmi = parseFloat((Number(b.weight) / (h_m * h_m)).toFixed(1));
            await updateHealthRecordOnly(arch.checkup_id, {
                ...arch.health_record,
                checkup: { ...arch.health_record.checkup, basics: { ...b, bmi: newBmi } }
            });
        }
        setLoading(false);
        loadData();
    };

    // --- NEW: Batch Update Questionnaire Logic ---
    const mapExcelRowToQuestionnaire = (row: any): QuestionnaireData => {
        // Helper to get string safely
        const get = (key: string) => row[key] ? String(row[key]).trim() : '';
        const has = (key: string, val: string) => get(key).includes(val);
        const split = (key: string) => get(key).split(/[,，、;；]/).map(s => s.trim()).filter(s => s);

        return {
            history: {
                diseases: split('既往病史'),
                details: {
                    hypertensionYear: get('高血压确诊年份'),
                    diabetesYear: get('糖尿病确诊年份'),
                    // Add more mappings as needed from Excel columns
                },
                surgeries: get('手术史')
            },
            femaleHealth: {
                menopauseStatus: get('绝经状态') // 已绝经/未绝经
            },
            familyHistory: {
                diabetes: has('家族史', '糖尿病'),
                hypertension: has('家族史', '高血压'),
                stroke: has('家族史', '脑卒中') || has('家族史', '中风'),
                lungCancer: has('家族史', '肺癌'),
                colonCancer: has('家族史', '肠癌'),
                parentHipFracture: has('家族史', '骨折'),
                breastCancer: has('家族史', '乳腺癌')
            },
            medication: {
                isRegular: has('是否服药', '是') || has('服药情况', '规律') ? '是' : '否',
                list: get('服药详情'),
                details: {
                    antihypertensive: has('服药详情', '降压'),
                    hypoglycemic: has('服药详情', '降糖') || has('服药详情', '胰岛素'),
                    lipidLowering: has('服药详情', '降脂') || has('服药详情', '他汀')
                }
            },
            diet: {
                habits: split('饮食习惯') // e.g. 偏咸, 偏油
            },
            hydration: {},
            exercise: {
                frequency: get('运动频率') // e.g. 每周3-5次
            },
            sleep: {
                hours: get('睡眠时长'),
                snore: get('打鼾情况')
            },
            respiratory: {
                chronicCough: has('呼吸症状', '咳'),
                shortBreath: has('呼吸症状', '气短')
            },
            substances: {
                smoking: {
                    status: get('吸烟情况'), // 从不/已戒烟/目前吸烟
                    dailyAmount: parseFloat(get('日吸烟量')) || undefined,
                    years: parseFloat(get('吸烟年限')) || undefined
                },
                alcohol: {
                    status: get('饮酒情况')
                }
            },
            mentalScales: {
                // Allows direct import of scores if calculated outside
                phq9Score: parseInt(get('PHQ9评分')) || undefined,
                gad7Score: parseInt(get('GAD7评分')) || undefined
            },
            mental: {
                stressLevel: get('压力状况')
            },
            needs: {
                desiredSupport: split('健康需求')
            }
        };
    };

    const handleBatchQuestionnaireImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm("⚠️ 此操作将通过【体检编号】匹配现有档案，并覆盖用户的【健康问卷】部分，同时保留原有【体检数据】并重新触发AI评估。\n\n请确保Excel包含列：体检编号, 既往病史, 吸烟情况, 运动频率等。")) {
            e.target.value = '';
            return;
        }

        setIsSmartBatchModalOpen(true);
        setIsSmartBatchProcessing(true);
        setSmartBatchLogs(["🔄 正在读取Excel文件..."]);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) throw new Error("Excel文件内容为空");

            setSmartBatchLogs(prev => [...prev, `📊 发现 ${jsonData.length} 条记录，开始处理...`]);

            let successCount = 0;
            let skipCount = 0;

            for (const row of jsonData as any[]) {
                const checkupId = row['体检编号'];
                if (!checkupId) {
                    setSmartBatchLogs(prev => [...prev, `⚠️ 跳过: 缺少体检编号`]);
                    skipCount++;
                    continue;
                }

                // 1. Find Existing
                const existingArchive = await findArchiveByCheckupId(String(checkupId));
                if (!existingArchive) {
                    setSmartBatchLogs(prev => [...prev, `⏭️ 跳过: 未找到档案 ${checkupId}`]);
                    skipCount++;
                    continue;
                }

                try {
                    // 2. Map Questionnaire
                    const newQuestionnaire = mapExcelRowToQuestionnaire(row);
                    
                    // 3. Merge with Existing Record (Keep Checkup Data!)
                    const updatedRecord: HealthRecord = {
                        ...existingArchive.health_record,
                        questionnaire: newQuestionnaire,
                        // Ensure profile data isn't lost if partial
                        profile: existingArchive.health_record.profile
                    };

                    setSmartBatchLogs(prev => [...prev, `🤖 AI 重新评估: ${existingArchive.name}`]);

                    // 4. Re-run AI Assessment
                    const newAssessment = await generateHealthAssessment(updatedRecord);
                    const newSchedule = generateFollowUpSchedule(newAssessment);
                    const portraits = generateSystemPortraits(updatedRecord);
                    const models = evaluateRiskModels(updatedRecord);

                    // 5. Save
                    await saveArchive(
                        updatedRecord, 
                        newAssessment, 
                        newSchedule, 
                        existingArchive.follow_ups, // Keep history
                        { portraits, models }
                    );

                    successCount++;
                    // Optional: Scroll log
                } catch (err: any) {
                    setSmartBatchLogs(prev => [...prev, `❌ 失败 ${checkupId}: ${err.message}`]);
                }
            }

            setSmartBatchLogs(prev => [...prev, `✅ 完成! 成功更新: ${successCount}, 跳过: ${skipCount}`]);
            loadData(); // Refresh list

        } catch (error: any) {
            setSmartBatchLogs(prev => [...prev, `❌ 文件处理错误: ${error.message}`]);
        } finally {
            setIsSmartBatchProcessing(false);
            if (questionnaireImportRef.current) questionnaireImportRef.current.value = '';
        }
    };

    const filteredArchives = useMemo(() => {
        let result = archives.filter(archive => {
            const term = searchTerm.toLowerCase();
            const matchSearch = ((archive.name || '').toLowerCase().includes(term) || (archive.checkup_id || '').toLowerCase().includes(term) || (archive.phone || '').toLowerCase().includes(term));
            let matchRisk = false;
            if (filterRisk === 'ALL') matchRisk = true;
            else if (filterRisk === 'CRITICAL') matchRisk = !!((archive.assessment_data?.isCritical === true || (archive.assessment_data?.criticalWarning && archive.assessment_data.criticalWarning.includes('类'))) && archive.critical_track?.status !== 'archived');
            else matchRisk = archive.risk_level === filterRisk;
            return matchSearch && matchRisk;
        });
        if (sortConfig) {
            result.sort((a, b) => {
                let aVal: any = '', bVal: any = '';
                switch (sortConfig.key) {
                    case 'name': aVal = a.name; bVal = b.name; break;
                    case 'department': aVal = a.department; bVal = b.department; break;
                    case 'risk_level': 
                         const riskOrder = { 'RED': 3, 'YELLOW': 2, 'GREEN': 1, 'UNKNOWN': 0 };
                         aVal = riskOrder[a.risk_level as keyof typeof riskOrder] || 0;
                         bVal = riskOrder[b.risk_level as keyof typeof riskOrder] || 0;
                         break;
                    case 'updated_at': aVal = new Date(a.updated_at || a.created_at).getTime(); bVal = new Date(b.updated_at || b.created_at).getTime(); break;
                    default: aVal = (a as any)[sortConfig.key]; bVal = (b as any)[sortConfig.key];
                }
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [archives, searchTerm, filterRisk, sortConfig]);

    const handleSort = (key: string) => {
        setSortConfig({ key, direction: sortConfig?.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' });
    };
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => setSelectedIds(e.target.checked ? new Set(filteredArchives.map(a => a.id)) : new Set());
    const handleSelectRow = (id: string) => { const newSet = new Set(selectedIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedIds(newSet); };
    const handleEditClick = (archive: HealthArchive) => { setEditingArchive(archive); setEditForm(archive.health_record.profile); setIsEditModalOpen(true); };
    const handleSaveProfile = async () => { if (!editingArchive || !editForm) return; const result = await updateArchiveProfile(editingArchive.id, editForm); if (result.success) { setIsEditModalOpen(false); setEditingArchive(null); loadData(); if (onDataUpdate) onDataUpdate(); } else alert(result.message); };
    const handleCriticalSave = async (record: CriticalTrackRecord) => { if (!criticalModalArchive) return; const res = await updateCriticalTrack(criticalModalArchive.checkup_id, record); if (res.success) { setCriticalModalArchive(null); loadData(); if (onDataUpdate) onDataUpdate(); } };
    
    const handleSmartBatchFiles = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) { setSmartBatchFiles(Array.from(e.target.files)); setSmartBatchLogs([]); } };
    const handleSmartBatchQuestionnaire = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) setSmartBatchQuestionnaireFile(e.target.files[0]); };

    const extractTextFromFile = async (file: File): Promise<string> => {
        const fileType = file.name.split('.').pop()?.toLowerCase();
        if (fileType === 'txt') return await file.text();
        if (fileType === 'docx' || fileType === 'doc') { const arrayBuffer = await file.arrayBuffer(); const result = await mammoth.extractRawText({ arrayBuffer }); return result.value; }
        if (fileType === 'pdf') {
            const arrayBuffer = await file.arrayBuffer();
            // @ts-ignore
            const lib = pdfjsLib.default || pdfjsLib;
            const loadingTask = lib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) { 
                const page = await pdf.getPage(i); 
                const textContent = await page.getTextContent(); 
                const pageText = textContent.items.map((item: any) => item.str).join(' '); 
                fullText += `--- Page ${i} ---\n${pageText}\n\n`; 
            }
            if (!fullText.trim()) {
                throw new Error("PDF内容为空或为纯图片，无法识别文字");
            }
            return fullText;
        }
        throw new Error("Unsupported format");
    };

    // Helper: Read Questionnaire Excel into Map
    const readQuestionnaireFile = async (file: File): Promise<Map<string, QuestionnaireData>> => {
        const qMap = new Map<string, QuestionnaireData>();
        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
            
            jsonData.forEach(row => {
                const id = row['体检编号'] ? String(row['体检编号']).trim() : '';
                if (id) {
                    qMap.set(id, mapExcelRowToQuestionnaire(row));
                }
            });
        } catch (e) {
            console.error("Failed to parse questionnaire file", e);
            throw new Error("问卷文件解析失败，请检查格式");
        }
        return qMap;
    };

    const handleSmartBatchProcess = async () => {
        if (smartBatchFiles.length === 0) return;
        setIsSmartBatchProcessing(true);
        setSmartBatchLogs(["🚀 任务启动..."]);

        // 1. Pre-process Questionnaire Excel if provided
        let questionnaireMap = new Map<string, QuestionnaireData>();
        if (smartBatchQuestionnaireFile) {
            setSmartBatchLogs(prev => [...prev, `📂 正在预处理问卷文件: ${smartBatchQuestionnaireFile.name}...`]);
            try {
                questionnaireMap = await readQuestionnaireFile(smartBatchQuestionnaireFile);
                setSmartBatchLogs(prev => [...prev, `✅ 问卷数据加载完成，共 ${questionnaireMap.size} 条记录待匹配`]);
            } catch (e: any) {
                setSmartBatchLogs(prev => [...prev, `❌ 问卷读取失败: ${e.message}`]);
                setIsSmartBatchProcessing(false);
                return;
            }
        }

        // 2. Process PDFs
        for (const file of smartBatchFiles) {
            setSmartBatchLogs(prev => [...prev, `📄 读取体检报告: ${file.name}`]);
            try {
                const text = await extractTextFromFile(file);
                setSmartBatchLogs(prev => [...prev, `🤖 AI 解析体检数据中...`]);
                const parsedRecord = await parseHealthDataFromText(text);
                
                if (parsedRecord.profile.name && parsedRecord.profile.name.includes('解析失败')) {
                    throw new Error(parsedRecord.profile.name);
                }

                const checkupId = parsedRecord.profile.checkupId;
                
                // 3. Match and Merge Questionnaire
                if (checkupId && questionnaireMap.has(checkupId)) {
                    setSmartBatchLogs(prev => [...prev, `🔗 成功匹配问卷数据 (编号: ${checkupId})`]);
                    parsedRecord.questionnaire = questionnaireMap.get(checkupId)!;
                } else if (smartBatchQuestionnaireFile) {
                    setSmartBatchLogs(prev => [...prev, `⚠️ 未找到匹配的问卷数据 (编号: ${checkupId || '未知'})`]);
                }

                // 4. Generate Comprehensive Assessment
                setSmartBatchLogs(prev => [...prev, `🧠 生成综合健康画像与评估...`]);
                const assessment = await generateHealthAssessment(parsedRecord);
                const schedule = generateFollowUpSchedule(assessment);
                const portraits = generateSystemPortraits(parsedRecord);
                const models = evaluateRiskModels(parsedRecord);
                
                // 5. Save
                const saveRes = await saveArchive(parsedRecord, assessment, schedule, [], { portraits, models });
                if (saveRes.success) setSmartBatchLogs(prev => [...prev, `✅ 建档完成: ${parsedRecord.profile.name}`]);
                else setSmartBatchLogs(prev => [...prev, `❌ 保存失败: ${saveRes.message}`]);
            } catch (e: any) {
                setSmartBatchLogs(prev => [...prev, `❌ 异常: ${e.message}`]);
            }
        }
        setIsSmartBatchProcessing(false);
        loadData();
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 h-full flex flex-col overflow-hidden animate-fadeIn">
            {/* Operations Dashboard */}
            <div className="bg-slate-800 text-white p-4 grid grid-cols-4 gap-4 shrink-0">
                <div className="flex flex-col items-center border-r border-slate-700">
                    <span className="text-2xl font-bold">{archives.length}</span>
                    <span className="text-xs text-slate-400">总健康档案</span>
                </div>
                <div className="flex flex-col items-center border-r border-slate-700">
                    <span className="text-2xl font-bold">{opsStats.activeDoctors}</span>
                    <span className="text-xs text-slate-400">在线医生</span>
                </div>
                <div className="flex flex-col items-center border-r border-slate-700">
                    <span className="text-2xl font-bold text-yellow-400">{opsStats.pendingSignings}</span>
                    <span className="text-xs text-slate-400">待审核签约</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-2xl font-bold">{opsStats.eventSignups}</span>
                    <span className="text-xs text-slate-400">活动报名人次</span>
                </div>
            </div>

            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 gap-4 shrink-0 flex-wrap">
                <div className="flex items-center gap-4 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <input type="text" placeholder="搜索姓名、编号、电话..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                    </div>
                    <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none bg-white" value={filterRisk} onChange={e => setFilterRisk(e.target.value)}>
                        <option value="ALL">全部风险等级</option>
                        <option value="RED">🔴 高风险</option>
                        <option value="YELLOW">🟡 中风险</option>
                        <option value="GREEN">🟢 低风险</option>
                        <option value="CRITICAL">🚨 待处理危急值</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    {/* Questionnaire Update Input */}
                    <input 
                        type="file" 
                        ref={questionnaireImportRef} 
                        className="hidden" 
                        accept=".xlsx, .xls"
                        onChange={handleBatchQuestionnaireImport} 
                    />
                    <button 
                        onClick={() => questionnaireImportRef.current?.click()}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-1"
                        title="基于Excel体检编号，批量导入问卷并更新风险评估"
                    >
                        📝 导入问卷更新档案
                    </button>

                    {selectedIds.size > 0 && <button onClick={handleBatchDelete} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-200">🗑️ 删除选中</button>}
                    <button onClick={handleBatchFixBMI} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-200">⚖️ 修正BMI</button>
                    <button onClick={() => setIsSmartBatchModalOpen(true)} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-teal-700 shadow-sm">📂 智能建档导入</button>
                    <button onClick={loadData} className="bg-white border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-600">🔄</button>
                </div>
            </div>

            {/* Error Message */}
            {fetchError && <div className="bg-red-50 text-red-600 p-3 text-center text-sm font-bold border-b border-red-100">数据加载失败: {fetchError}</div>}

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-4 w-10"><input type="checkbox" onChange={handleSelectAll} checked={filteredArchives.length > 0 && selectedIds.size === filteredArchives.length} /></th>
                            <th className="p-4 cursor-pointer" onClick={() => handleSort('checkup_id')}>编号 {sortConfig?.key === 'checkup_id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                            <th className="p-4 cursor-pointer" onClick={() => handleSort('name')}>姓名</th>
                            <th className="p-4">性别 / 年龄</th>
                            <th className="p-4 cursor-pointer" onClick={() => handleSort('department')}>部门</th>
                            <th className="p-4 cursor-pointer" onClick={() => handleSort('risk_level')}>风险</th>
                            <th className="p-4 cursor-pointer" onClick={() => handleSort('updated_at')}>更新时间</th>
                            <th className="p-4 text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {loading ? <tr><td colSpan={8} className="p-10 text-center text-slate-400">加载中...</td></tr> : filteredArchives.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-slate-400">暂无数据</td></tr> : filteredArchives.map((archive) => {
                            const isCritical = archive.assessment_data?.isCritical || (archive.assessment_data?.criticalWarning && archive.assessment_data.criticalWarning.includes('类'));
                            return (
                                <tr 
                                    key={archive.id} 
                                    className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                                    onDoubleClick={() => onSelectPatient(archive, 'assessment')}
                                >
                                    <td className="p-4"><input type="checkbox" checked={selectedIds.has(archive.id)} onChange={() => handleSelectRow(archive.id)} onClick={(e) => e.stopPropagation()} /></td>
                                    <td className="p-4 font-mono text-slate-600">{archive.checkup_id}</td>
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800">{archive.name}</div>
                                        {isCritical && <div className={`text-[10px] px-1.5 py-0.5 rounded inline-block mt-1 cursor-pointer ${archive.critical_track?.status === 'archived' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600 animate-pulse'}`} onClick={(e) => { e.stopPropagation(); setCriticalModalArchive(archive); }}>{archive.critical_track?.status === 'archived' ? '危急值已归档' : '🚨 危急值待处理'}</div>}
                                    </td>
                                    <td className="p-4 text-slate-600">{archive.gender} / {archive.age}</td>
                                    <td className="p-4 text-slate-600">{archive.department}</td>
                                    <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold border ${archive.risk_level === 'RED' ? 'bg-red-50 text-red-600 border-red-200' : archive.risk_level === 'YELLOW' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 'bg-green-50 text-green-600 border-green-200'}`}>{archive.risk_level === 'RED' ? '高风险' : archive.risk_level === 'YELLOW' ? '中风险' : '低风险'}</span></td>
                                    <td className="p-4 text-xs text-slate-400 font-mono">{new Date(archive.updated_at || archive.created_at).toLocaleDateString()}</td>
                                    <td className="p-4 flex justify-center gap-2 opacity-80 group-hover:opacity-100">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onSelectPatient(archive, 'assessment'); }} 
                                            className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded hover:bg-indigo-100 font-bold"
                                        >
                                            查看
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleEditClick(archive); }} className="text-xs bg-slate-50 text-slate-600 px-3 py-1.5 rounded hover:bg-slate-100">编辑</button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(archive.id, archive.name); }} className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100">删除</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            {/* Edit Modal */}
            {isEditModalOpen && editForm && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-scaleIn">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">编辑档案信息</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">体检编号</label>
                                <input 
                                    className="w-full border p-2 rounded bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none transition-colors" 
                                    value={editForm.checkupId || ''} 
                                    onChange={e => setEditForm({...editForm!, checkupId: e.target.value})} 
                                    placeholder="请输入唯一体检编号"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">姓名</label>
                                <input 
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-teal-500 outline-none" 
                                    value={editForm.name} 
                                    onChange={e => setEditForm({...editForm!, name: e.target.value})} 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">性别</label><select className="w-full border p-2 rounded bg-white" value={editForm.gender} onChange={e => setEditForm({...editForm!, gender: e.target.value})}><option value="男">男</option><option value="女">女</option></select></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">年龄</label><input type="number" className="w-full border p-2 rounded" value={editForm.age} onChange={e => setEditForm({...editForm!, age: Number(e.target.value)})} /></div>
                            </div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">部门</label><input className="w-full border p-2 rounded" value={editForm.department} onChange={e => setEditForm({...editForm!, department: e.target.value})} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">电话</label><input className="w-full border p-2 rounded" value={editForm.phone || ''} onChange={e => setEditForm({...editForm!, phone: e.target.value})} /></div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">取消</button>
                            <button onClick={handleSaveProfile} className="px-4 py-2 bg-teal-600 text-white font-bold rounded hover:bg-teal-700">保存</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Critical Modal */}
            {criticalModalArchive && <CriticalHandleModal archive={criticalModalArchive} onClose={() => setCriticalModalArchive(null)} onSave={handleCriticalSave} />}
            
            {/* Smart Batch Modal (Updated) */}
            {isSmartBatchModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white w-full max-w-3xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn">
                        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                            <div><h3 className="text-xl font-bold text-slate-800">📂 智能批量建档</h3><p className="text-xs text-slate-500 mt-1">支持：体检报告(PDF/Docx) + 问卷数据(Excel) 自动合并建档</p></div>
                            <button onClick={() => { setIsSmartBatchModalOpen(false); setSmartBatchLogs([]); setSmartBatchFiles([]); setSmartBatchQuestionnaireFile(null); }} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
                        </div>
                        <div className="flex-1 p-6 overflow-hidden flex flex-col bg-white">
                            {!isSmartBatchProcessing && smartBatchLogs.length === 0 ? (
                                <div className="flex flex-col gap-6 h-full">
                                    {/* Upload Area for PDF Reports */}
                                    <div className="flex-1 border-2 border-dashed border-teal-200 rounded-xl bg-teal-50/30 flex flex-col items-center justify-center p-6 relative group hover:bg-teal-50 transition-colors">
                                        <input type="file" multiple accept=".pdf,.docx,.doc,.txt" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleSmartBatchFiles} />
                                        <div className="text-4xl mb-2 opacity-50 group-hover:scale-110 transition-transform">📄</div>
                                        <p className="text-lg font-bold text-teal-800">步骤 1: 上传体检报告 (PDF/Word)</p>
                                        <p className="text-xs text-teal-600 mt-1">支持批量选择多个文件</p>
                                        {smartBatchFiles.length > 0 && <div className="mt-2 bg-white px-3 py-1 rounded text-sm text-teal-700 shadow-sm">已选择 {smartBatchFiles.length} 个文件</div>}
                                    </div>

                                    {/* Upload Area for Questionnaire Excel */}
                                    <div className="flex-1 border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50/30 flex flex-col items-center justify-center p-6 relative group hover:bg-indigo-50 transition-colors">
                                        <input type="file" accept=".xlsx, .xls" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleSmartBatchQuestionnaire} />
                                        <div className="text-4xl mb-2 opacity-50 group-hover:scale-110 transition-transform">📊</div>
                                        <p className="text-lg font-bold text-indigo-800">步骤 2: 上传问卷数据表 (Excel) [可选]</p>
                                        <p className="text-xs text-indigo-600 mt-1">若上传，系统将根据【体检编号】自动匹配合并</p>
                                        {smartBatchQuestionnaireFile && <div className="mt-2 bg-white px-3 py-1 rounded text-sm text-indigo-700 shadow-sm">已选择: {smartBatchQuestionnaireFile.name}</div>}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 bg-black rounded-xl p-4 font-mono text-xs text-green-400 overflow-y-auto shadow-inner">
                                    {smartBatchLogs.map((log, i) => <div key={i} className="mb-1 border-b border-white/5 pb-0.5">{log}</div>)}
                                    {isSmartBatchProcessing && <div className="animate-pulse">_</div>}
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-slate-200 bg-white flex justify-between items-center">
                            <div className="text-sm text-slate-500">
                                {smartBatchFiles.length > 0 ? `就绪: ${smartBatchFiles.length} 份报告` : '请先上传文件'}
                                {smartBatchQuestionnaireFile ? ` + 问卷数据` : ''}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => { setSmartBatchFiles([]); setSmartBatchLogs([]); setSmartBatchQuestionnaireFile(null); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded font-bold" disabled={isSmartBatchProcessing}>重置</button>
                                <button onClick={handleSmartBatchProcess} disabled={isSmartBatchProcessing || smartBatchFiles.length === 0} className="bg-teal-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-teal-700 shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center gap-2">
                                    {isSmartBatchProcessing ? '🚀 全速处理中...' : '✨ 开始智能建档'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
