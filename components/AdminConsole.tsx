
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchArchives, deleteArchive, updateArchiveProfile, updateCriticalTrack, saveArchive, updateHealthRecordOnly, HealthArchive, findArchiveByCheckupId, updateArchiveMeta, normalizePhone } from '../services/dataService';
import {
    formatArchiveListCacheTime,
    isArchiveListCacheFresh,
    readArchiveListCache,
} from '../services/archiveListCacheService';
import { parseHealthDataFromText, generateHealthAssessment, generateFollowUpSchedule } from '../services/geminiService';
import { generateSystemPortraits, evaluateRiskModels } from '../services/riskModelService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { HealthProfile, CriticalTrackRecord, HealthRecord, HealthAssessment, RiskLevel, RiskAnalysisData, QuestionnaireData } from '../types';
import { fetchContent, fetchInteractions, saveInteraction } from '../services/contentService'; // Interconnection
import { CriticalHandleModal } from './CriticalHandleModal';
import { StaffWorkloadPanel } from './StaffWorkloadPanel';
import { HighGlucoseTag } from './HighGlucoseTag';
import { HighBloodPressureTag } from './HighBloodPressureTag';
import { HighLipidTag } from './HighLipidTag';
import { extractTextFromFile } from '../services/fileParseService';
import { importCheckupReportsBatch, sortArchivesByExamDate } from '../services/checkupImportService';
import { isDiabetesCohort } from '../services/diabetesAssessmentService';
import { detectHighGlucoseTag } from '../services/glucoseTagService';
import { detectHighBloodPressureTag, isHypertensionCohort } from '../services/bloodPressureTagService';
import { detectDyslipidemiaTag, isLipidCohort } from '../services/lipidTagService';
import {
    isSmsConfigured,
    resolveArchivePhone,
    sendCriticalSms,
    sendNoticeSmsBatch,
} from '../services/smsService';
// @ts-ignore
import * as XLSX from 'xlsx';
// @ts-ignore
import * as mammoth from 'mammoth';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

interface Props {
  onSelectPatient: (archive: HealthArchive, mode?: 'view' | 'edit' | 'followup' | 'assessment' | 'diabetes' | 'hypertension' | 'lipid') => void;
    onDataUpdate?: () => void;
    isAuthenticated: boolean;
    onTabChange?: (tab: string) => void;
    userRole?: 'admin' | 'health_manager';
}

export const AdminConsole: React.FC<Props> = ({ onSelectPatient, onDataUpdate, isAuthenticated, onTabChange, userRole = 'admin' }) => {
    const isSuperAdmin = userRole === 'admin';
    const initialCache = readArchiveListCache();
    const [archives, setArchives] = useState<HealthArchive[]>(() =>
        initialCache.archives.length ? sortArchivesByExamDate(initialCache.archives) : []
    );
    
    // Operations Stats
    const [opsStats, setOpsStats] = useState({
        totalResources: 0,
        activeDoctors: 0,
        pendingSignings: 0,
        eventSignups: 0
    });
    
    const [loading, setLoading] = useState(() => initialCache.archives.length === 0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [cacheHint, setCacheHint] = useState<string | null>(() =>
        initialCache.meta
            ? `本地缓存 · ${formatArchiveListCacheTime(initialCache.meta.fetchedAt)} · ${initialCache.meta.count} 人`
            : null
    );
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'updated_at', direction: 'desc' });
    const [filterRisk, setFilterRisk] = useState<string>('ALL');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [pageSize, setPageSize] = useState<number>(20);
    const [currentPage, setCurrentPage] = useState<number>(1);

    const FILTER_LABELS: Record<string, string> = {
        ALL: '全部人员',
        RED: '高风险',
        YELLOW: '中风险',
        GREEN: '低风险',
        CRITICAL: '待处理危急值',
        DIABETES: '高血糖_糖代谢异常',
        HYPERTENSION: '血压偏高_高血压',
        DIABETES_REPORT: '已有糖尿病评估',
        HYPERTENSION_REPORT: '已有高血压评估',
        LIPID: '血脂异常',
        LIPID_REPORT: '已有血脂评估',
    };

    // Import Options
    const [skipFilled, setSkipFilled] = useState(true); // Default to skip existing questionnaires

    // Edit Modal State
    const [editingArchive, setEditingArchive] = useState<HealthArchive | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<HealthProfile | null>(null);
    const [editProfileComplete, setEditProfileComplete] = useState(true);

    // Critical Modal State
    const [criticalModalArchive, setCriticalModalArchive] = useState<HealthArchive | null>(null);

    // Smart Batch Import (Full Parse & Questionnaire Excel)
    const [isSmartBatchModalOpen, setIsSmartBatchModalOpen] = useState(false);
    const [smartBatchFiles, setSmartBatchFiles] = useState<File[]>([]);
    const [smartBatchLogs, setSmartBatchLogs] = useState<string[]>([]);
    const [isSmartBatchProcessing, setIsSmartBatchProcessing] = useState(false);

    // Questionnaire Update Import (Excel Only)
    const questionnaireImportRef = useRef<HTMLInputElement>(null);
    const checkUploadRef = useRef<HTMLInputElement>(null);
    const [isCheckUploadModalOpen, setIsCheckUploadModalOpen] = useState(false);
    const [checkUploadLogs, setCheckUploadLogs] = useState<string[]>([]);
    const [isCheckUploadProcessing, setIsCheckUploadProcessing] = useState(false);

    // SMS batch / manual
    const [showSmsModal, setShowSmsModal] = useState(false);
    const [smsContent, setSmsContent] = useState('');
    const [smsTargetScope, setSmsTargetScope] = useState<'filtered' | 'selected'>('filtered');
    const [isSendingSms, setIsSendingSms] = useState(false);
    const [smsSendSummary, setSmsSendSummary] = useState<string | null>(null);
    const [adminMainTab, setAdminMainTab] = useState<'personnel' | 'workload'>('personnel');

    useEffect(() => {
        if (!isSuperAdmin && adminMainTab === 'workload') {
            setAdminMainTab('personnel');
        }
    }, [isSuperAdmin, adminMainTab]);

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

    const loadData = async (options?: { force?: boolean }) => {
        if (!configured) { setLoading(false); return; }

        const cached = readArchiveListCache();
        const hasCache = cached.archives.length > 0;

        if (hasCache) {
            setArchives(sortArchivesByExamDate(cached.archives));
            setLoading(false);
            setCacheHint(
                cached.meta
                    ? `本地缓存 · ${formatArchiveListCacheTime(cached.meta.fetchedAt)} · ${cached.meta.count} 人`
                    : null
            );
            if (!options?.force && isArchiveListCacheFresh(cached.meta)) {
                return;
            }
        } else {
            setLoading(true);
        }

        setIsRefreshing(true);
        setFetchError(null);
        if (!hasCache) setSelectedIds(new Set());

        try {
            const data = await fetchArchives();
            setArchives(sortArchivesByExamDate(data));
            setCacheHint(`已同步 · ${new Date().toLocaleTimeString()} · ${data.length} 人`);
        } catch (error: unknown) {
            setFetchError(String(error));
            if (!hasCache) setArchives([]);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
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
            if (success) { loadData({ force: true }); if (onDataUpdate) onDataUpdate(); }
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        if (confirm(`⚠️ 危险操作：确定要批量删除选中的 ${selectedIds.size} 份健康档案吗？`)) {
            setLoading(true);
            for (const id of Array.from(selectedIds)) await deleteArchive(id as string);
            loadData({ force: true }); if (onDataUpdate) onDataUpdate();
            setLoading(false);
        }
    };

    const resolveSelectedArchive = (): HealthArchive | undefined => {
        if (selectedIds.size !== 1) return undefined;
        const onlyId = Array.from(selectedIds)[0];
        return archives.find((a) => a.id === onlyId || a.checkup_id === onlyId);
    };

    const handleManagerUploadClick = () => {
        if (!checkUploadRef.current) {
            alert('上传组件未就绪，请刷新页面后重试');
            return;
        }
        checkUploadRef.current.click();
    };

    const handleManagerUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList?.length) return;
        const files = Array.from(fileList);
        e.currentTarget.value = '';

        const selected = resolveSelectedArchive();
        const selectedCheckupId = selected?.checkup_id;

        setIsCheckUploadModalOpen(true);
        setCheckUploadLogs([
            `共 ${files.length} 个文件，支持多人混传`,
            selectedCheckupId
                ? `已勾选 ${selected?.name}（${selectedCheckupId}）作为编号识别失败时的兜底`
                : '未勾选档案：将完全依赖报告中的 6 位体检编号自动匹配现有档案',
            '流程：依次 AI 解析 → 按编号匹配/建档 → 按检查日期入库 → 每人统一评估',
        ]);
        setIsCheckUploadProcessing(true);

        try {
            const items: { fileName: string; text: string }[] = [];
            for (const file of files) {
                setCheckUploadLogs((prev) => [...prev, `📄 读取: ${file.name}`]);
                try {
                    const text = await extractTextFromFile(file);
                    if (!text?.trim()) {
                        setCheckUploadLogs((prev) => [...prev, `❌ ${file.name}：未能提取文字（扫描件请换 OCR 版 PDF）`]);
                        continue;
                    }
                    items.push({ fileName: file.name, text });
                } catch (readErr: unknown) {
                    const msg = readErr instanceof Error ? readErr.message : String(readErr);
                    setCheckUploadLogs((prev) => [...prev, `❌ ${file.name}：${msg}`]);
                }
            }

            if (!items.length) {
                setCheckUploadLogs((prev) => [...prev, '❌ 没有可解析的文件，请检查格式（推荐 PDF/Word）']);
                return;
            }

            const res = await importCheckupReportsBatch(items, {
                selectedCheckupId,
                onProgress: (line) => setCheckUploadLogs((prev) => [...prev, line]),
            });

            if (!res.success) {
                setCheckUploadLogs((prev) => [...prev, `❌ ${res.message || '导入失败'}`]);
            } else {
                setCheckUploadLogs((prev) => [...prev, `✅ ${res.message}`]);
                alert(res.message || '导入完成');
            }
            loadData({ force: true });
            if (onDataUpdate) onDataUpdate();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setCheckUploadLogs((prev) => [...prev, `❌ 异常: ${msg}`]);
            alert(`导入异常：${msg}`);
        } finally {
            setIsCheckUploadProcessing(false);
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
        loadData({ force: true });
    };

    const handleExportList = () => {
        if (filteredArchives.length === 0) {
            alert("当前列表为空，无可导出数据");
            return;
        }

        const riskLabel = (level: string) =>
            level === 'RED' ? '高风险' : level === 'YELLOW' ? '中风险' : level === 'GREEN' ? '低风险' : level;

        const exportData = filteredArchives.map((arch, index) => ({
            "序号": index + 1,
            "体检编号": arch.checkup_id,
            "姓名": arch.name,
            "性别": arch.gender,
            "年龄": arch.age,
            "单位/部门": arch.department,
            "联系电话": arch.phone || '-',
            "风险等级": riskLabel(arch.risk_level),
            "筛选类别": FILTER_LABELS[filterRisk] || filterRisk,
            "健康状况摘要": arch.assessment_data?.summary || '-',
            "危急值警示": arch.assessment_data?.isCritical ? (arch.assessment_data.criticalWarning || '是') : '无',
            "最后更新": new Date(arch.updated_at || arch.created_at).toLocaleString()
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "人员名单");
        const filterTag = FILTER_LABELS[filterRisk] || '全部人员';
        const dateTag = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `人员列表_${filterTag}_${dateTag}.xlsx`);
    };

    const mergeQuestionnaire = (target: any, source: any): any => {
        const result = { ...target };
        for (const key in source) {
            if (source[key] !== null && source[key] !== undefined && source[key] !== '') {
                if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = mergeQuestionnaire(result[key] || {}, source[key]);
                } else if (Array.isArray(source[key])) {
                    if (source[key].length > 0) result[key] = source[key];
                } else {
                    result[key] = source[key];
                }
            }
        }
        return result;
    };

    const hasValidQuestionnaireData = (q: QuestionnaireData): boolean => {
        if (!q) return false;
        const hasDiet = Array.isArray(q.diet?.habits) && q.diet.habits.length > 0;
        const hasSmoke = !!q.substances?.smoking?.status;
        const hasExercise = !!q.exercise?.frequency;
        const hasHistory = Array.isArray(q.history?.diseases) && q.history.diseases.length > 0 && !q.history.diseases.includes('无');
        return hasDiet || hasSmoke || hasExercise || hasHistory;
    };

    const handleBatchQuestionnaireImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const confirmMsg = skipFilled 
            ? "⚠️ [智能模式: 跳过已完善档案]\n系统将识别 Excel 数据并更新问卷。\n\n• 若档案已存在且问卷已填：自动跳过 (保留原数据)\n• 若档案已存在但问卷为空：更新问卷并重评\n• 若未建档：自动跳过\n\n确定开始吗？"
            : "⚠️ [覆盖模式]\n系统将识别 Excel 数据，强制覆盖所有匹配档案的问卷信息，并重新生成风险评估。\n\n确定开始吗？";

        if (!confirm(confirmMsg)) {
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

            setSmartBatchLogs(prev => [...prev, `📊 发现 ${jsonData.length} 条记录，开始 AI 智能识别处理...`]);

            let successCount = 0;
            let skipCount = 0;
            let alreadyFilledCount = 0;

            for (const row of jsonData as any[]) {
                const rawId = row['体检编号'] || row['checkupId'] || row['ID'] || row['编号'] || row['id'];
                if (!rawId) {
                    setSmartBatchLogs(prev => [...prev, `⚠️ 跳过: 数据行缺少体检编号`]);
                    skipCount++;
                    continue;
                }
                const checkupId = String(rawId).trim().replace(/\s+/g, '');
                let existingArchive = archives.find(a => String(a.checkup_id).trim() === checkupId);
                if (!existingArchive) {
                    existingArchive = (await findArchiveByCheckupId(checkupId)) || undefined;
                }
                if (!existingArchive) {
                    setSmartBatchLogs(prev => [...prev, `⏭️ 跳过: 未找到编号 [${checkupId}] 的建档记录`]);
                    skipCount++;
                    continue;
                }
                if (skipFilled && hasValidQuestionnaireData(existingArchive.health_record.questionnaire)) {
                    setSmartBatchLogs(prev => [...prev, `⏩ 跳过: [${checkupId}] 问卷已完善，无需更新`]);
                    alreadyFilledCount++;
                    continue;
                }
                try {
                    setSmartBatchLogs(prev => [...prev, `🔍 识别中: ${existingArchive.name} (${checkupId})...`]);
                    const rowText = Object.entries(row).map(([k, v]) => `${k}: ${v}`).join('\n');
                    const parsedRecord = await parseHealthDataFromText(rowText);
                    const newQuestionnaire = parsedRecord.questionnaire;
                    const updatedQuestionnaire = mergeQuestionnaire(existingArchive.health_record.questionnaire, newQuestionnaire);
                    const updatedRecord: HealthRecord = {
                        ...existingArchive.health_record,
                        questionnaire: updatedQuestionnaire,
                        profile: existingArchive.health_record.profile
                    };
                    const newAssessment = await generateHealthAssessment(updatedRecord);
                    const newSchedule = generateFollowUpSchedule(newAssessment);
                    const portraits = generateSystemPortraits(updatedRecord);
                    const models = evaluateRiskModels(updatedRecord);
                    await saveArchive(updatedRecord, newAssessment, newSchedule, existingArchive.follow_ups, { portraits, models }, { completeProfileOnSave: true });
                    setSmartBatchLogs(prev => [...prev, `✅ 更新成功: ${existingArchive.name} (风险:${newAssessment.riskLevel})`]);
                    successCount++;
                } catch (err: any) {
                    setSmartBatchLogs(prev => [...prev, `❌ 处理失败 ${checkupId}: ${err.message}`]);
                }
            }
            setSmartBatchLogs(prev => [...prev, `🎉 全部完成! 成功: ${successCount}, 已完善跳过: ${alreadyFilledCount}, 未建档/异常: ${skipCount}`]);
            loadData({ force: true });
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
            else if (filterRisk === 'DIABETES') matchRisk = detectHighGlucoseTag(archive.health_record).show || isDiabetesCohort(archive.health_record);
            else if (filterRisk === 'HYPERTENSION') matchRisk = detectHighBloodPressureTag(archive.health_record).show || isHypertensionCohort(archive.health_record);
            else if (filterRisk === 'DIABETES_REPORT') matchRisk = !!archive.assessment_data?.diabetesReport;
            else if (filterRisk === 'HYPERTENSION_REPORT') matchRisk = !!archive.assessment_data?.hypertensionReport;
            else if (filterRisk === 'LIPID') matchRisk = detectDyslipidemiaTag(archive.health_record).show || isLipidCohort(archive.health_record);
            else if (filterRisk === 'LIPID_REPORT') matchRisk = !!archive.assessment_data?.lipidReport;
            else matchRisk = archive.risk_level === filterRisk;
            return matchSearch && matchRisk;
        });
        if (sortConfig) {
            result.sort((a, b) => {
                let aVal: any = '', bVal: any = '';
                switch (sortConfig.key) {
                    case 'name': aVal = a.name; bVal = b.name; break;
                    case 'age':
                        aVal = Number(a.age) || 0;
                        bVal = Number(b.age) || 0;
                        break;
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

    const totalPages = Math.max(1, Math.ceil(filteredArchives.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);

    const paginatedArchives = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filteredArchives.slice(start, start + pageSize);
    }, [filteredArchives, safePage, pageSize]);

    const smsTargetArchives = useMemo(() => {
        const pool = smsTargetScope === 'selected'
            ? archives.filter((a) => selectedIds.has(a.id))
            : filteredArchives;
        return pool.filter((a) => /^1[3-9]\d{9}$/.test(resolveArchivePhone(a)));
    }, [smsTargetScope, archives, selectedIds, filteredArchives]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterRisk, sortConfig, pageSize]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const sortIndicator = (key: string) =>
        sortConfig?.key === key ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : '';

    const handleSort = (key: string) => {
        setSortConfig({ key, direction: sortConfig?.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' });
    };
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) =>
        setSelectedIds(e.target.checked ? new Set(paginatedArchives.map(a => a.id)) : new Set());
    const handleSelectRow = (id: string) => { const newSet = new Set(selectedIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedIds(newSet); };
    const handleEditClick = (archive: HealthArchive) => {
        setEditingArchive(archive);
        setEditForm(archive.health_record.profile);
        setEditProfileComplete(archive.profile_complete !== false);
        setIsEditModalOpen(true);
    };
    const handleSaveProfile = async () => {
        if (!editingArchive || !editForm) return;
        const profileToSave = { ...editForm, phone: editForm.phone ? normalizePhone(editForm.phone) : editForm.phone };
        const result = await updateArchiveProfile(editingArchive.id, profileToSave);
        if (result.success) {
            const meta = await updateArchiveMeta(profileToSave.checkupId || editingArchive.checkup_id, {
                profile_complete: editProfileComplete,
            });
            if (!meta.success) console.warn(meta.message);
            setIsEditModalOpen(false);
            setEditingArchive(null);
            loadData({ force: true });
            if (onDataUpdate) onDataUpdate();
        } else alert(result.message);
    };
    const handleCriticalSave = async (
        record: CriticalTrackRecord,
        options?: { sendSms?: boolean; delayContactWeek?: boolean },
    ) => {
        if (!criticalModalArchive) return;
        let recordToSave = { ...record };

        if (options?.delayContactWeek) {
            const res = await updateCriticalTrack(criticalModalArchive.checkup_id, recordToSave);
            if (res.success) {
                setCriticalModalArchive(null);
                loadData({ force: true });
                if (onDataUpdate) onDataUpdate();
                alert(`已登记电话联系不上，延期至 ${record.contact_retry_due} 再提醒`);
            } else {
                alert('保存失败: ' + res.message);
            }
            return;
        }

        if (options?.sendSms) {
            const phone = resolveArchivePhone(criticalModalArchive);
            if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
                alert('该职工未登记有效手机号，无法发送短信');
                return;
            }
            if (!isSmsConfigured()) {
                alert('短信服务未配置：请部署 send-sms Edge Function 并设置 VITE_SMS_INVOKE_SECRET');
                return;
            }
            const summary = criticalModalArchive.assessment_data?.criticalWarning || record.critical_desc;
            const smsRes = await sendCriticalSms({
                checkupId: criticalModalArchive.checkup_id,
                phone,
                name: criticalModalArchive.name,
                summary,
                sentRole: userRole === 'health_manager' ? 'health_manager' : 'admin',
            });
            if (!smsRes.success || smsRes.failCount > 0) {
                alert(`短信发送失败：${smsRes.results[0]?.error || smsRes.message}`);
                return;
            }
            const now = new Date().toLocaleString();
            recordToSave = record.status === 'pending_secondary' || record.status === 'archived'
                ? { ...recordToSave, secondary_notify_time: now }
                : { ...recordToSave, initial_notify_time: now };
        }

        const res = await updateCriticalTrack(criticalModalArchive.checkup_id, recordToSave);
        if (res.success) {
            setCriticalModalArchive(null);
            loadData({ force: true });
            if (onDataUpdate) onDataUpdate();
            if (options?.sendSms) alert('危急值记录已保存，短信已发送');
        } else {
            alert('保存失败: ' + res.message);
        }
    };

    const handleOpenSmsModal = () => {
        setSmsSendSummary(null);
        setSmsContent('');
        if (selectedIds.size > 0) setSmsTargetScope('selected');
        else setSmsTargetScope('filtered');
        setShowSmsModal(true);
    };

    const handleSendBatchSms = async () => {
        if (!smsContent.trim()) {
            alert('请输入短信内容');
            return;
        }
        if (smsTargetArchives.length === 0) {
            alert('目标范围内没有有效手机号的职工');
            return;
        }
        if (!isSmsConfigured()) {
            alert('短信服务未配置：请部署 send-sms Edge Function 并设置 VITE_SMS_INVOKE_SECRET');
            return;
        }
        const scopeLabel = smsTargetScope === 'selected' ? `选中的 ${selectedIds.size} 人` : `当前筛选 ${filteredArchives.length} 人`;
        if (!confirm(`确定向 ${smsTargetArchives.length} 位有手机号的职工发送短信吗？\n范围：${scopeLabel}`)) return;

        setIsSendingSms(true);
        setSmsSendSummary(null);
        try {
            const res = await sendNoticeSmsBatch(
                smsTargetArchives.map((a) => ({
                    checkupId: a.checkup_id,
                    phone: resolveArchivePhone(a),
                    name: a.name,
                    content: smsContent,
                })),
                { sentRole: userRole === 'health_manager' ? 'health_manager' : 'admin', content: smsContent },
            );
            const failedLines = res.results
                .filter((r) => !r.success)
                .slice(0, 8)
                .map((r) => `${r.phone}: ${r.error}`)
                .join('\n');
            setSmsSendSummary(
                `${res.message}${failedLines ? `\n失败示例：\n${failedLines}` : ''}`,
            );
            if (res.successCount > 0 && res.failCount === 0) {
                setShowSmsModal(false);
            }
        } finally {
            setIsSendingSms(false);
        }
    };
    
    const handleSmartBatchFiles = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) { setSmartBatchFiles(Array.from(e.target.files)); setSmartBatchLogs([]); } };
    const extractTextForSmartBatch = async (file: File): Promise<string> => {
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
            if (!fullText.trim()) throw new Error("PDF内容为空或为纯图片，无法识别文字");
            return fullText;
        }
        throw new Error("Unsupported format");
    };
    const handleSmartBatchProcess = async () => {
        if (smartBatchFiles.length === 0) return;
        setIsSmartBatchProcessing(true);
        setSmartBatchLogs(["🚀 任务启动..."]);
        for (const file of smartBatchFiles) {
            setSmartBatchLogs(prev => [...prev, `📄 读取: ${file.name}`]);
            try {
                const text = await extractTextForSmartBatch(file);
                setSmartBatchLogs(prev => [...prev, `🤖 AI 解析中...`]);
                const parsedRecord = await parseHealthDataFromText(text);
                if (parsedRecord.profile.name && parsedRecord.profile.name.includes('解析失败')) throw new Error(parsedRecord.profile.name);
                const assessment = await generateHealthAssessment(parsedRecord);
                const schedule = generateFollowUpSchedule(assessment);
                const portraits = generateSystemPortraits(parsedRecord);
                const models = evaluateRiskModels(parsedRecord);
                const saveRes = await saveArchive(parsedRecord, assessment, schedule, [], { portraits, models }, { completeProfileOnSave: true });
                if (saveRes.success) setSmartBatchLogs(prev => [...prev, `✅ 成功: ${parsedRecord.profile.name}`]);
                else setSmartBatchLogs(prev => [...prev, `❌ 失败: ${saveRes.message}`]);
            } catch (e: any) {
                setSmartBatchLogs(prev => [...prev, `❌ 异常: ${e.message}`]);
            }
        }
        setIsSmartBatchProcessing(false);
        loadData({ force: true });
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 h-full flex flex-col overflow-hidden animate-fadeIn">
            <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
                <button
                    type="button"
                    onClick={() => setAdminMainTab('personnel')}
                    className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
                        adminMainTab === 'personnel'
                            ? 'border-teal-600 text-teal-700 bg-white'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    人员管理
                </button>
                {isSuperAdmin && (
                <button
                    type="button"
                    onClick={() => setAdminMainTab('workload')}
                    className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
                        adminMainTab === 'workload'
                            ? 'border-teal-600 text-teal-700 bg-white'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    团队工作量
                </button>
                )}
            </div>

            {adminMainTab === 'workload' && isSuperAdmin ? (
                <div className="flex-1 overflow-auto">
                    <StaffWorkloadPanel title="团队工作量" showTeamExport />
                </div>
            ) : (
            <>
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
                        <option value="DIABETES">🩸 高血糖 / 糖代谢异常</option>
                        <option value="HYPERTENSION">🫀 血压偏高 / 高血压</option>
                        <option value="DIABETES_REPORT">📋 已有糖尿病评估</option>
                        <option value="HYPERTENSION_REPORT">📋 已有高血压评估</option>
                        <option value="LIPID">🧪 血脂异常</option>
                        <option value="LIPID_REPORT">📋 已有血脂评估</option>
                    </select>
                    <select
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none bg-white"
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        title="每页显示人数"
                    >
                        <option value={10}>每页 10 人</option>
                        <option value={20}>每页 20 人</option>
                        <option value={50}>每页 50 人</option>
                    </select>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                        共 {filteredArchives.length} 人
                        {filterRisk !== 'ALL' ? `（${FILTER_LABELS[filterRisk]}）` : ''}
                    </span>
                    {cacheHint && (
                        <span className="text-xs text-slate-400 whitespace-nowrap" title="30 分钟内再次打开将直接使用本地缓存">
                            {isRefreshing ? '同步中…' : cacheHint}
                        </span>
                    )}
                </div>
                <div className="flex gap-2 items-center">
                    <label className="flex items-center gap-2 cursor-pointer mr-2 select-none" title="若档案中问卷已有内容，则跳过不更新">
                        <input type="checkbox" checked={skipFilled} onChange={(e) => setSkipFilled(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                        <span className="text-xs font-bold text-slate-600">跳过已完善问卷</span>
                    </label>

                    <input type="file" ref={questionnaireImportRef} className="hidden" accept=".xlsx, .xls" onChange={handleBatchQuestionnaireImport} />
                    <input
                        type="file"
                        ref={checkUploadRef}
                        className="hidden"
                        multiple
                        accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                        onChange={handleManagerUploadFiles}
                    />
                    
                    <button onClick={handleExportList} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-100 flex items-center gap-1 shadow-sm" title="导出当前筛选结果（含序号）">
                        <span>📥</span> 导出当前列表
                    </button>

                    <button onClick={() => questionnaireImportRef.current?.click()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-1" title="批量AI识别问卷并更新">
                        📝 导入问卷更新
                    </button>
                    <button onClick={handleManagerUploadClick} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-purple-700 shadow-sm flex items-center gap-1" title="支持一次选择多人历年 PDF/Word，AI 识别体检编号后自动匹配档案">
                        🧾 批量上传历年体检报告
                    </button>

                    {selectedIds.size > 0 && <button onClick={handleBatchDelete} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-200">🗑️ 删除选中</button>}
                    <button onClick={handleBatchFixBMI} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-200">⚖️ BMI修复</button>
                    <button onClick={() => setIsSmartBatchModalOpen(true)} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-teal-700 shadow-sm">📂 智能建档</button>
                    <button
                        onClick={handleOpenSmsModal}
                        disabled={!isSmsConfigured()}
                        title={isSmsConfigured() ? '向筛选或选中人员发送短信' : '需配置 Supabase 与 VITE_SMS_INVOKE_SECRET'}
                        className="bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2 rounded-lg text-xs font-bold hover:bg-amber-100 disabled:opacity-50"
                    >
                        📩 发送短信
                    </button>
                    <button
                        onClick={() => loadData({ force: true })}
                        disabled={isRefreshing}
                        className="bg-white border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-50"
                        title="强制从云端重新加载"
                    >
                        {isRefreshing ? '⏳' : '🔄'}
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {fetchError && <div className="bg-red-50 text-red-600 p-3 text-center text-sm font-bold border-b border-red-100">数据加载失败: {fetchError}</div>}

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-4 w-10"><input type="checkbox" onChange={handleSelectAll} checked={paginatedArchives.length > 0 && paginatedArchives.every(a => selectedIds.has(a.id))} /></th>
                            <th className="p-4 w-14 text-center">序号</th>
                            <th className="p-4 cursor-pointer hover:text-teal-600" onClick={() => handleSort('checkup_id')}>编号{sortIndicator('checkup_id')}</th>
                            <th className="p-4 cursor-pointer hover:text-teal-600" onClick={() => handleSort('name')}>姓名{sortIndicator('name')}</th>
                            <th className="p-4 cursor-pointer hover:text-teal-600" onClick={() => handleSort('age')}>性别 / 年龄{sortIndicator('age')}</th>
                            <th className="p-4 cursor-pointer hover:text-teal-600" onClick={() => handleSort('department')}>部门{sortIndicator('department')}</th>
                            <th className="p-4 cursor-pointer hover:text-teal-600" onClick={() => handleSort('risk_level')}>风险{sortIndicator('risk_level')}</th>
                            <th className="p-4 cursor-pointer hover:text-teal-600" onClick={() => handleSort('updated_at')}>更新时间{sortIndicator('updated_at')}</th>
                            <th className="p-4 text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {loading ? <tr><td colSpan={9} className="p-10 text-center text-slate-400">加载中...</td></tr> : filteredArchives.length === 0 ? <tr><td colSpan={9} className="p-10 text-center text-slate-400">暂无数据</td></tr> : paginatedArchives.map((archive, rowIndex) => {
                            const isCritical = archive.assessment_data?.isCritical || (archive.assessment_data?.criticalWarning && archive.assessment_data.criticalWarning.includes('类'));
                            const serialNo = (safePage - 1) * pageSize + rowIndex + 1;
                            return (
                                <tr
                                    key={archive.id}
                                    className={`hover:bg-blue-50/30 transition-colors group cursor-pointer ${selectedIds.has(archive.id) ? 'bg-purple-50/80 ring-1 ring-inset ring-purple-200' : ''}`}
                                    onClick={() => handleSelectRow(archive.id)}
                                    onDoubleClick={() => onSelectPatient(archive, 'assessment')}
                                >
                                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                        <input type="checkbox" checked={selectedIds.has(archive.id)} onChange={() => handleSelectRow(archive.id)} />
                                    </td>
                                    <td className="p-4 text-center text-slate-500 font-mono">{serialNo}</td>
                                    <td className="p-4 font-mono text-slate-600">{archive.checkup_id}</td>
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800">{archive.name}</div>
                                        <div className="mt-1 flex flex-wrap items-center gap-1">
                                          <HighGlucoseTag
                                            record={archive.health_record}
                                            onClick={() => onSelectPatient(archive, 'diabetes')}
                                          />
                                          <HighBloodPressureTag
                                            record={archive.health_record}
                                            onClick={() => onSelectPatient(archive, 'hypertension')}
                                          />
                                          <HighLipidTag
                                            record={archive.health_record}
                                            onClick={() => onSelectPatient(archive, 'lipid')}
                                          />
                                          {isCritical && (
                                            <div
                                              className={`text-[10px] px-1.5 py-0.5 rounded inline-block cursor-pointer ${archive.critical_track?.status === 'archived' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600 animate-pulse'}`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setCriticalModalArchive(archive);
                                              }}
                                            >
                                              {archive.critical_track?.status === 'archived' ? '危急值已归档' : '🚨 待处理'}
                                            </div>
                                          )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-600">{archive.gender} / {archive.age}</td>
                                    <td className="p-4 text-slate-600">{archive.department}</td>
                                    <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold border ${archive.risk_level === 'RED' ? 'bg-red-50 text-red-600 border-red-200' : archive.risk_level === 'YELLOW' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 'bg-green-50 text-green-600 border-green-200'}`}>{archive.risk_level === 'RED' ? '高风险' : archive.risk_level === 'YELLOW' ? '中风险' : '低风险'}</span></td>
                                    <td className="p-4 text-xs text-slate-400 font-mono">{new Date(archive.updated_at || archive.created_at).toLocaleDateString()}</td>
                                    <td className="p-4 flex justify-center gap-2 opacity-80 group-hover:opacity-100">
                                        <button onClick={(e) => { e.stopPropagation(); onSelectPatient(archive, 'assessment'); }} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded hover:bg-indigo-100 font-bold">查看</button>
                                        <button onClick={(e) => { e.stopPropagation(); onSelectPatient(archive, 'diabetes'); }} className="text-xs bg-teal-50 text-teal-700 px-3 py-1.5 rounded hover:bg-teal-100 font-bold">专项筛查</button>
                                        <button onClick={(e) => { e.stopPropagation(); handleEditClick(archive); }} className="text-xs bg-slate-50 text-slate-600 px-3 py-1.5 rounded hover:bg-slate-100">编辑</button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(archive.id, archive.name); }} className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100">删除</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {!loading && filteredArchives.length > 0 && (
                <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-600">
                        第 {safePage} / {totalPages} 页，本页 {paginatedArchives.length} 人，合计 {filteredArchives.length} 人
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={safePage <= 1}
                            onClick={() => setCurrentPage(1)}
                            className="px-3 py-1.5 text-xs rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100"
                        >
                            首页
                        </button>
                        <button
                            type="button"
                            disabled={safePage <= 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="px-3 py-1.5 text-xs rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100"
                        >
                            上一页
                        </button>
                        <button
                            type="button"
                            disabled={safePage >= totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className="px-3 py-1.5 text-xs rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100"
                        >
                            下一页
                        </button>
                        <button
                            type="button"
                            disabled={safePage >= totalPages}
                            onClick={() => setCurrentPage(totalPages)}
                            className="px-3 py-1.5 text-xs rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100"
                        >
                            末页
                        </button>
                    </div>
                </div>
            )}
            
            {/* Edit Modal */}
            {isEditModalOpen && editForm && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-scaleIn">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">编辑档案信息</h3>
                        <div className="space-y-4">
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">体检编号</label><input className="w-full border p-2 rounded bg-slate-50" value={editForm.checkupId || ''} onChange={e => setEditForm({...editForm!, checkupId: e.target.value})} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">姓名</label><input className="w-full border p-2 rounded" value={editForm.name} onChange={e => setEditForm({...editForm!, name: e.target.value})} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">性别</label><select className="w-full border p-2 rounded bg-white" value={editForm.gender} onChange={e => setEditForm({...editForm!, gender: e.target.value})}><option value="男">男</option><option value="女">女</option></select></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">年龄</label><input type="number" className="w-full border p-2 rounded" value={editForm.age} onChange={e => setEditForm({...editForm!, age: Number(e.target.value)})} /></div>
                            </div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">部门</label><input className="w-full border p-2 rounded" value={editForm.department} onChange={e => setEditForm({...editForm!, department: e.target.value})} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">电话</label><input className="w-full border p-2 rounded" value={editForm.phone || ''} onChange={e => setEditForm({...editForm!, phone: e.target.value})} /></div>
                            <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                                <input type="checkbox" className="mt-1" checked={editProfileComplete} onChange={(e) => setEditProfileComplete(e.target.checked)} />
                                <span>健康档案已完善（取消勾选后，用户登录端将提示联系健康管家完成建档）</span>
                            </label>
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

            {/* SMS Batch Modal */}
            {showSmsModal && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg animate-scaleIn">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">发送职工短信</h3>
                        <p className="text-xs text-slate-500 mb-4">
                            内容将填入已备案的「通用通知」模板变量。仅向有效手机号发送。
                        </p>
                        <div className="flex gap-4 mb-4">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="radio"
                                    checked={smsTargetScope === 'filtered'}
                                    onChange={() => setSmsTargetScope('filtered')}
                                />
                                当前筛选（{filteredArchives.length} 人，有效手机 {filteredArchives.filter((a) => /^1[3-9]\d{9}$/.test(resolveArchivePhone(a))).length}）
                            </label>
                            <label className={`flex items-center gap-2 text-sm cursor-pointer ${selectedIds.size === 0 ? 'opacity-50' : ''}`}>
                                <input
                                    type="radio"
                                    checked={smsTargetScope === 'selected'}
                                    onChange={() => setSmsTargetScope('selected')}
                                    disabled={selectedIds.size === 0}
                                />
                                仅选中（{selectedIds.size} 人）
                            </label>
                        </div>
                        <textarea
                            className="w-full h-32 border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-teal-500 mb-3"
                            value={smsContent}
                            onChange={(e) => setSmsContent(e.target.value)}
                            placeholder="请输入通知内容（100字以内，发送前请确认符合已备案模板）"
                            maxLength={100}
                        />
                        <p className="text-xs text-slate-400 mb-4">
                            即将发送给 <strong>{smsTargetArchives.length}</strong> 位职工
                        </p>
                        {smsSendSummary && (
                            <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-3 mb-4 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                {smsSendSummary}
                            </pre>
                        )}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowSmsModal(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSendBatchSms}
                                disabled={isSendingSms || !smsContent.trim() || smsTargetArchives.length === 0}
                                className="px-4 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 text-sm disabled:opacity-50"
                            >
                                {isSendingSms ? '发送中…' : `确认发送 (${smsTargetArchives.length})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Smart Batch Modal */}
            {isCheckUploadModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white w-full max-w-3xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn">
                        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">批量历年体检报告导入</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    支持多人混传：AI 识别 6 位体检编号后自动匹配档案库，按检查日期依次入库，每人完成后自动评估
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!isCheckUploadProcessing) {
                                        setIsCheckUploadModalOpen(false);
                                        setCheckUploadLogs([]);
                                    }
                                }}
                                className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 p-6 overflow-hidden flex flex-col">
                            <div className="flex-1 bg-black rounded-xl p-4 font-mono text-xs text-green-400 overflow-y-auto">
                                {checkUploadLogs.map((log, i) => (
                                    <div key={i} className="mb-1">
                                        {log}
                                    </div>
                                ))}
                                {isCheckUploadProcessing && <div className="animate-pulse">_</div>}
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-200 bg-white flex justify-end">
                            <button
                                type="button"
                                disabled={isCheckUploadProcessing}
                                onClick={() => {
                                    setIsCheckUploadModalOpen(false);
                                    setCheckUploadLogs([]);
                                }}
                                className="px-6 py-2 rounded-lg bg-purple-600 text-white font-bold hover:bg-purple-700 disabled:opacity-50"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isSmartBatchModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white w-full max-w-3xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn">
                        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                            <div><h3 className="text-xl font-bold text-slate-800">📂 批量处理任务</h3><p className="text-xs text-slate-500 mt-1">支持 智能建档 / 问卷更新</p></div>
                            <button onClick={() => { setIsSmartBatchModalOpen(false); setSmartBatchLogs([]); setSmartBatchFiles([]); }} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
                        </div>
                        <div className="flex-1 p-6 overflow-hidden flex flex-col">
                            {!isSmartBatchProcessing && smartBatchLogs.length === 0 ? (
                                <div className="flex-1 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center p-10 relative">
                                    <input type="file" multiple accept=".pdf,.docx,.doc,.txt" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleSmartBatchFiles} />
                                    <div className="text-5xl mb-4 opacity-50">📤</div><p className="text-lg font-bold text-slate-600">拖拽上传文件 (仅限智能建档)</p>
                                </div>
                            ) : (
                                <div className="flex-1 bg-black rounded-xl p-4 font-mono text-xs text-green-400 overflow-y-auto">
                                    {smartBatchLogs.map((log, i) => <div key={i} className="mb-1">{log}</div>)}
                                    {isSmartBatchProcessing && <div className="animate-pulse">_</div>}
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-slate-200 bg-white flex justify-between items-center">
                            <div className="text-sm text-slate-500">{smartBatchFiles.length > 0 ? `已选择 ${smartBatchFiles.length} 个文件` : ''}</div>
                            <div className="flex gap-3">
                                <button onClick={() => { setSmartBatchFiles([]); setSmartBatchLogs([]); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded font-bold" disabled={isSmartBatchProcessing}>重置</button>
                                {smartBatchFiles.length > 0 && <button onClick={handleSmartBatchProcess} disabled={isSmartBatchProcessing} className="bg-teal-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-teal-700 shadow-lg disabled:opacity-50">{isSmartBatchProcessing ? '🚀 处理中...' : '开始导入'}</button>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </>
            )}
        </div>
    );
};
