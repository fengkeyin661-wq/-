
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchArchives, deleteArchive, updateArchiveProfile, updateCriticalTrack, saveArchive, updateHealthRecordOnly, HealthArchive } from '../services/dataService';
import { parseHealthDataFromText, generateHealthAssessment, generateFollowUpSchedule } from '../services/geminiService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { HealthProfile, CriticalTrackRecord, HealthRecord, HealthAssessment, RiskLevel, RiskAnalysisData } from '../types';
import { CriticalHandleModal } from './CriticalHandleModal';
import { generateSystemPortraits, evaluateRiskModels } from '../services/riskModelService';
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
    // --- Admin Console Logic ---
    const [archives, setArchives] = useState<HealthArchive[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // --- Enhanced List State (Sorting, Filtering, Selection) ---
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'updated_at', direction: 'desc' });
    const [filterRisk, setFilterRisk] = useState<string>('ALL'); // ALL, RED, YELLOW, GREEN, CRITICAL
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Edit Modal State
    const [editingArchive, setEditingArchive] = useState<HealthArchive | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<HealthProfile | null>(null);

    // Critical Modal State
    const [criticalModalArchive, setCriticalModalArchive] = useState<HealthArchive | null>(null);

    // Batch Import Modal State
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Smart Batch Import Modal State (PDF/Word + AI)
    const [isSmartBatchModalOpen, setIsSmartBatchModalOpen] = useState(false);
    const [smartBatchFiles, setSmartBatchFiles] = useState<File[]>([]);
    const [smartBatchLogs, setSmartBatchLogs] = useState<string[]>([]);
    const [isSmartBatchProcessing, setIsSmartBatchProcessing] = useState(false);

    const configured = isSupabaseConfigured();

    // --- Effects ---
    useEffect(() => {
        if (isAuthenticated) {
            loadData();
        }
    }, [isAuthenticated]);

    // Setup PDF Worker globally for Admin Console as well
    useEffect(() => {
        const setupPdfWorker = async () => {
            const workerUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
            
            // @ts-ignore
            const lib = pdfjsLib.default || pdfjsLib;

            if (!lib.GlobalWorkerOptions) {
                console.warn("PDFJS GlobalWorkerOptions not found");
                return;
            }

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
        if (!configured) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setFetchError(null);
        setSelectedIds(new Set()); // Reset selection on reload
        try {
            const data = await fetchArchives();
            setArchives(data);
        } catch (error: any) {
            console.error("Load Data Error:", error);
            setFetchError(error.message || String(error));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`确定要删除 ${name} 的健康档案吗？此操作不可恢复。`)) {
            const success = await deleteArchive(id);
            if (success) {
                loadData();
                if (onDataUpdate) onDataUpdate();
            } else {
                alert('删除失败，请重试');
            }
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        if (confirm(`⚠️ 危险操作：确定要批量删除选中的 ${selectedIds.size} 份健康档案吗？\n此操作不可恢复！`)) {
            setLoading(true);
            let successCount = 0;
            // Execute deletion
            for (const id of Array.from(selectedIds)) {
                const success = await deleteArchive(id as string);
                if (success) successCount++;
            }
            alert(`批量删除完成，成功删除 ${successCount} 条。`);
            loadData();
            if (onDataUpdate) onDataUpdate();
            setLoading(false);
        }
    };

    // --- Batch Fix BMI Logic ---
    const handleBatchFixBMI = async () => {
        const candidates = archives.filter(a => {
            const b = a.health_record.checkup?.basics;
            if (!b) return false;
            // Check if height & weight exist (>0) BUT bmi is missing/zero
            const h = Number(b.height);
            const w = Number(b.weight);
            const bmi = Number(b.bmi);
            return h > 0 && w > 0 && (!bmi || bmi === 0);
        });

        if (candidates.length === 0) {
            alert("扫描完成：未发现有身高体重但缺失BMI的档案，数据完整。");
            return;
        }

        if (!confirm(`扫描发现 ${candidates.length} 份档案有身高体重但缺失BMI，是否立即自动计算并补全？`)) return;

        setLoading(true);
        let successCount = 0;
        let failCount = 0;

        for (const arch of candidates) {
            try {
                const b = arch.health_record.checkup.basics;
                const h_cm = Number(b.height);
                const w_kg = Number(b.weight);
                const h_m = h_cm / 100;
                
                const newBmi = parseFloat((w_kg / (h_m * h_m)).toFixed(1));
                
                // Create updated health record
                const updatedRecord = {
                    ...arch.health_record,
                    checkup: {
                        ...arch.health_record.checkup,
                        basics: {
                            ...b,
                            bmi: newBmi
                        }
                    }
                };

                // Use dedicated lightweight update function to avoid overwriting follow-ups/schedule
                const success = await updateHealthRecordOnly(arch.checkup_id, updatedRecord);
                if (success) successCount++;
                else failCount++;
            } catch (e) {
                failCount++;
            }
        }

        setLoading(false);
        alert(`批量修复完成！\n成功补全: ${successCount} 条\n失败: ${failCount} 条`);
        loadData(); // Refresh list to show updated timestamps potentially
        if (onDataUpdate) onDataUpdate();
    };


    // --- Sorting & Filtering Logic ---
    const filteredArchives = useMemo(() => {
        let result = archives.filter(archive => {
            const term = searchTerm.toLowerCase();
            const matchSearch = (
                (archive.name || '').toLowerCase().includes(term) ||
                (archive.checkup_id || '').toLowerCase().includes(term) ||
                (archive.phone || '').toLowerCase().includes(term)
            );
            
            let matchRisk = false;
            if (filterRisk === 'ALL') {
                matchRisk = true;
            } else if (filterRisk === 'CRITICAL') {
                // Filter for critical active status
                matchRisk = (archive.assessment_data?.isCritical === true || (archive.assessment_data?.criticalWarning && archive.assessment_data.criticalWarning.includes('类'))) && archive.critical_track?.status !== 'archived';
            } else {
                matchRisk = archive.risk_level === filterRisk;
            }

            return matchSearch && matchRisk;
        });

        if (sortConfig) {
            result.sort((a, b) => {
                let aVal: any = '';
                let bVal: any = '';

                switch (sortConfig.key) {
                    case 'name':
                        aVal = a.name || ''; bVal = b.name || '';
                        break;
                    case 'department':
                        aVal = a.department || ''; bVal = b.department || '';
                        break;
                    case 'risk_level':
                         // Custom sort for risk: RED > YELLOW > GREEN
                         const riskOrder = { 'RED': 3, 'YELLOW': 2, 'GREEN': 1, 'UNKNOWN': 0 };
                         aVal = riskOrder[a.risk_level as keyof typeof riskOrder] || 0;
                         bVal = riskOrder[b.risk_level as keyof typeof riskOrder] || 0;
                         break;
                    case 'updated_at':
                         aVal = new Date(a.updated_at || a.created_at).getTime();
                         bVal = new Date(b.updated_at || b.created_at).getTime();
                         break;
                    default:
                        aVal = (a as any)[sortConfig.key];
                        bVal = (b as any)[sortConfig.key];
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [archives, searchTerm, filterRisk, sortConfig]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(filteredArchives.map(a => a.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    // --- Edit Handlers ---
    const handleEditClick = (archive: HealthArchive) => {
        setEditingArchive(archive);
        setEditForm(archive.health_record.profile);
        setIsEditModalOpen(true);
    };

    const handleSaveProfile = async () => {
        if (!editingArchive || !editForm) return;
        const result = await updateArchiveProfile(editingArchive.id, editForm);
        if (result.success) {
            alert('基本信息更新成功');
            setIsEditModalOpen(false);
            setEditingArchive(null);
            loadData();
            if (onDataUpdate) onDataUpdate();
        } else {
            alert(`更新失败: ${result.message}`);
        }
    };

    // --- Critical Track Handlers ---
    const handleCriticalSave = async (record: CriticalTrackRecord) => {
        if (!criticalModalArchive) return;
        
        const res = await updateCriticalTrack(criticalModalArchive.checkup_id, record);
        if (res.success) {
            if (record.status === 'archived') {
                alert("危急值记录已归档！");
            } else {
                alert("记录已保存，已自动列入二次回访计划。");
            }
            setCriticalModalArchive(null);
            loadData();
            if (onDataUpdate) onDataUpdate();
        } else {
            alert("保存失败：" + res.message);
        }
    };

    // --- Smart Batch Import Logic (PDF/Word + AI) ---
    const handleSmartBatchFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSmartBatchFiles(Array.from(e.target.files));
            setSmartBatchLogs([]);
        }
    };

    const extractTextFromFile = async (file: File): Promise<string> => {
        const fileType = file.name.split('.').pop()?.toLowerCase();
        
        if (fileType === 'txt') return await file.text();
        if (fileType === 'docx' || fileType === 'doc') {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        }
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
            return fullText;
        }
        return '';
    };

    const runSmartBatchImport = async () => {
        if (smartBatchFiles.length === 0) return;
        setIsSmartBatchProcessing(true);
        setSmartBatchLogs(['🚀 开始批量处理...']);

        for (let i = 0; i < smartBatchFiles.length; i++) {
            const file = smartBatchFiles[i];
            setSmartBatchLogs(prev => [...prev, `[${i+1}/${smartBatchFiles.length}] 正在读取: ${file.name}`]);
            
            try {
                // 1. Extract Text
                const text = await extractTextFromFile(file);
                if (!text || text.length < 50) {
                     throw new Error("文件内容为空或无法识别");
                }
                
                // 2. AI Parse
                setSmartBatchLogs(prev => [...prev, `   ↳ AI 正在解析健康数据...`]);
                const record = await parseHealthDataFromText(text);
                
                // 3. AI Assess
                setSmartBatchLogs(prev => [...prev, `   ↳ 正在进行风险评估...`]);
                const assessment = await generateHealthAssessment(record);
                const schedule = generateFollowUpSchedule(assessment);
                
                // 4. Generate Risk Analysis
                const riskAnalysis: RiskAnalysisData = {
                    portraits: generateSystemPortraits(record),
                    models: evaluateRiskModels(record)
                };

                // 5. Save to DB
                setSmartBatchLogs(prev => [...prev, `   ↳ 保存档案到数据库...`]);
                const res = await saveArchive(record, assessment, schedule, [], riskAnalysis);
                
                if (res.success) {
                    setSmartBatchLogs(prev => [...prev, `✅ 成功建档: ${record.profile.name} (${record.profile.checkupId})`]);
                } else {
                    throw new Error(res.message);
                }

            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                setSmartBatchLogs(prev => [...prev, `❌ 处理失败: ${file.name} - ${msg}`]);
            }
        }
        
        setSmartBatchLogs(prev => [...prev, `🎉 所有文件处理完毕！`]);
        setIsSmartBatchProcessing(false);
        loadData();
        if (onDataUpdate) onDataUpdate();
    };


    // --- Excel Batch Import Logic ---
    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

                if (data.length === 0) {
                    alert("Excel 文件为空或格式不正确");
                    return;
                }

                if (!confirm(`解析到 ${data.length} 条数据，确定要导入吗？\n注意：这将覆盖已存在的相同体检编号档案。`)) return;
                
                setLoading(true);
                let successCount = 0;
                let failCount = 0;

                for (const row of data as any[]) {
                    try {
                        // Map Excel columns to HealthRecord structure (Simplified)
                        const record: HealthRecord = {
                            profile: {
                                checkupId: String(row['体检编号'] || row['编号'] || `IMP_${Date.now()}`),
                                name: row['姓名'] || '未命名',
                                gender: row['性别'] || '未知',
                                age: Number(row['年龄']) || 0,
                                phone: String(row['联系电话'] || ''),
                                department: row['部门'] || row['单位'] || '',
                                checkupDate: row['体检日期'] || undefined
                            },
                            checkup: {
                                basics: {
                                    sbp: Number(row['收缩压']),
                                    dbp: Number(row['舒张压']),
                                    bmi: Number(row['BMI']),
                                    weight: Number(row['体重']),
                                    height: Number(row['身高'])
                                },
                                labBasic: {
                                    glucose: { fasting: String(row['空腹血糖'] || '') },
                                    lipids: { tc: String(row['总胆固醇'] || ''), tg: String(row['甘油三酯'] || '') }
                                },
                                imagingBasic: { ultrasound: {} },
                                optional: {},
                                abnormalities: []
                            },
                            questionnaire: {
                                history: { diseases: [], details: {} },
                                femaleHealth: {},
                                familyHistory: {},
                                medication: { isRegular: '否', details: {} },
                                diet: { habits: [] },
                                hydration: {},
                                exercise: {},
                                sleep: {},
                                respiratory: {},
                                substances: { smoking: {}, alcohol: {} },
                                mental: {},
                                mentalScales: {},
                                needs: {}
                            }
                        };
                        
                        // Parse simple issues from Excel '异常项' column
                        if (row['异常项']) {
                            const issues = String(row['异常项']).split(/[,;，；]/);
                            record.checkup.abnormalities = issues.map(i => ({ item: i.trim(), result: '异常', category: '导入', clinicalSig: '' }));
                        }

                        // Generate Assessment
                        const assessment = await generateHealthAssessment(record);
                        const schedule = generateFollowUpSchedule(assessment);
                        
                        // Generate Risk Analysis
                        const riskAnalysis: RiskAnalysisData = {
                            portraits: generateSystemPortraits(record),
                            models: evaluateRiskModels(record)
                        };

                        const res = await saveArchive(record, assessment, schedule, [], riskAnalysis);
                        if (res.success) successCount++;
                        else failCount++;

                    } catch (e) {
                        console.error(e);
                        failCount++;
                    }
                }

                alert(`导入完成！\n成功: ${successCount}\n失败: ${failCount}`);
                setIsBatchModalOpen(false);
                loadData();
                if (onDataUpdate) onDataUpdate();

            } catch (e) {
                console.error(e);
                alert("文件读取失败");
            } finally {
                setLoading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const downloadTemplate = () => {
        const headers = [['体检编号', '姓名', '性别', '年龄', '部门', '联系电话', '体检日期', '收缩压', '舒张压', '空腹血糖', '总胆固醇', '异常项']];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "导入模板");
        XLSX.writeFile(wb, "健康档案导入模板.xlsx");
    };

    // --- Export Handler (General) ---
    const handleExportData = () => {
        if (filteredArchives.length === 0) {
            alert("当前列表无数据可导出");
            return;
        }

        const headers = ['姓名', '体检编号', '性别', '年龄', '部门', '联系电话', '体检日期', '风险等级', '下次随访时间', '最新评估时间'];
        
        const rows = filteredArchives.map(arch => {
            const nextPending = arch.follow_up_schedule?.find(s => s.status === 'pending');
            const nextDate = nextPending ? nextPending.date : '无计划';
            const riskLabel = arch.risk_level === 'RED' ? '高危' : arch.risk_level === 'YELLOW' ? '中危' : '低危';

            return [
                arch.name,
                arch.checkup_id,
                arch.gender || '-',
                arch.age || '-',
                arch.department || '-',
                arch.phone ? `"${arch.phone}"` : '-', 
                arch.health_record?.profile?.checkupDate || '-', // Updated to retrieve date safely
                riskLabel,
                nextDate,
                new Date(arch.updated_at || arch.created_at).toLocaleString()
            ].join(',');
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        downloadCsv(csvContent, `健康档案导出_${new Date().toISOString().split('T')[0]}.csv`);
    };

    // --- Export Handler (Critical Values) ---
    const handleExportCritical = () => {
        if (activeCriticalPatients.length === 0) {
            alert("当前无活跃的危急值数据");
            return;
        }

        const headers = ['姓名', '体检编号', '联系电话', '危急等级', '异常描述', '通知时间', '当前状态'];
        const rows = activeCriticalPatients.map(arch => {
            const track = arch.critical_track;
            const warning = arch.assessment_data.criticalWarning || '未知异常';
            const statusLabel = track?.status === 'pending_secondary' ? '待二次回访' : '待初次处理';
            
            return [
                arch.name,
                arch.checkup_id,
                arch.phone ? `"${arch.phone}"` : '-',
                track?.critical_level || (arch.risk_level === 'RED' ? 'A类' : 'B类'),
                `"${(track?.critical_desc || warning).replace(/"/g, '""')}"`,
                track?.initial_notify_time || '未通知',
                statusLabel
            ].join(',');
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        downloadCsv(csvContent, `危急值专项报告_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const downloadCsv = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // --- Logic: Upcoming Tasks ---
    const getUpcomingTasks = () => {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const list: { archive: HealthArchive, date: string, daysLeft: number, focus: string }[] = [];

        archives.forEach(arch => {
            if (arch.follow_up_schedule) {
                arch.follow_up_schedule.forEach(task => {
                    if (task.status === 'pending') {
                        const taskDate = new Date(task.date);
                        const diffTime = taskDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays <= 7) {
                            list.push({
                                archive: arch,
                                date: task.date,
                                daysLeft: diffDays,
                                focus: task.focusItems.join(', ')
                            });
                        }
                    }
                });
            }
        });
        return list.sort((a, b) => a.daysLeft - b.daysLeft);
    };

    // --- Logic: Critical Patients ---
    const getActiveCriticalPatients = () => {
        return archives.filter(arch => 
            (arch.assessment_data?.isCritical === true || (arch.assessment_data?.criticalWarning && arch.assessment_data.criticalWarning.includes('类'))) && 
            arch.critical_track?.status !== 'archived'
        );
    };

    const upcomingTasks = getUpcomingTasks();
    const activeCriticalPatients = getActiveCriticalPatients();

    const StatsCard = ({ label, value, color, icon, bg, onClick }: any) => (
        <div 
            onClick={onClick}
            className={`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all cursor-pointer hover:border-${color.split('-')[1]}-200 active:scale-95 group relative overflow-hidden`}
        >
            <div className="relative z-10">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
                <p className="text-3xl font-black text-slate-800 tracking-tight group-hover:text-slate-900">{value}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${bg} ${color} relative z-10`}>
                {icon}
            </div>
            {/* Hover overlay effect */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity ${bg}`}></div>
        </div>
    );

    const SortIcon = ({ colKey }: { colKey: string }) => {
        if (sortConfig?.key !== colKey) return <span className="text-slate-300 ml-1 text-[10px]">▼</span>;
        return <span className="text-teal-600 ml-1 font-bold text-xs">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
    };

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center h-[500px] animate-fadeIn text-slate-500">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-4xl">🔒</div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">访问受限</h3>
                <p className="mb-6">您需要登录管理员账号才能访问控制台。</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn pb-10">
            {/* Top Bar: Connection Status & Actions */}
            <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold text-slate-800 tracking-tight">管理控制台</h2>
                 <div className="flex gap-3">
                     <button 
                        onClick={handleBatchFixBMI}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-teal-600 hover:border-teal-300 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95"
                        title="扫描并自动计算缺失BMI的档案"
                     >
                        <span>🛠️</span> 数据清洗: 补全BMI
                     </button>
                     <button 
                        onClick={() => setIsSmartBatchModalOpen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-bold text-white flex items-center gap-2 transition-all shadow-sm active:scale-95"
                     >
                        <span>✨</span> 批量智能建档 (PDF)
                     </button>
                     <button 
                        onClick={() => setIsBatchModalOpen(true)}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-sm font-bold text-white flex items-center gap-2 transition-all shadow-sm active:scale-95"
                     >
                        <span>📂</span> 批量导入 (Excel)
                     </button>
                     <button onClick={loadData} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-bold text-slate-600 flex items-center gap-2 transition-colors shadow-sm">
                        <span>🔄</span> 刷新
                     </button>
                </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
                 <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${configured ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    <div className={`w-2 h-2 rounded-full ${configured ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    {configured ? '云端数据库已连接' : '未连接数据库 (请检查 .env 配置)'}
                </div>
            </div>

            {fetchError && (
                <div className="bg-red-50 text-red-800 p-4 rounded-lg border border-red-200 flex justify-between items-center">
                    <span>⚠️ {fetchError}</span>
                    <button onClick={loadData} className="text-sm underline hover:text-red-900">重试</button>
                </div>
            )}

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard 
                    label="总档案数" 
                    value={archives.length} 
                    color="text-slate-600" bg="bg-slate-100" icon="📂" 
                    onClick={() => setFilterRisk('ALL')}
                />
                <StatsCard 
                    label="高风险人群" 
                    value={archives.filter(a => a.risk_level === RiskLevel.RED).length} 
                    color="text-red-600" bg="bg-red-50" icon="🚨" 
                    onClick={() => setFilterRisk('RED')}
                />
                <StatsCard 
                    label="近期随访任务" 
                    value={upcomingTasks.length} 
                    color="text-orange-600" bg="bg-orange-50" icon="📅" 
                    onClick={() => onTabChange && onTabChange('followup')}
                />
                <StatsCard 
                    label="待处理危急值" 
                    value={activeCriticalPatients.length} 
                    color="text-purple-600" bg="bg-purple-50" icon="⚡" 
                    onClick={() => setFilterRisk('CRITICAL')}
                />
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div className="flex gap-4 items-center">
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                            <input 
                                type="text" 
                                placeholder="搜索姓名、编号、电话..." 
                                className="pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none w-64"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select 
                            className="py-2 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                            value={filterRisk}
                            onChange={e => setFilterRisk(e.target.value)}
                        >
                            <option value="ALL">全部风险等级</option>
                            <option value="RED">🔴 高风险</option>
                            <option value="YELLOW">🟡 中风险</option>
                            <option value="GREEN">🟢 低风险</option>
                            <option value="CRITICAL">⚠️ 待处理危急值</option>
                        </select>
                    </div>
                    
                    <div className="flex gap-2">
                         {selectedIds.size > 0 && (
                             <button 
                                onClick={handleBatchDelete}
                                className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100"
                             >
                                 批量删除 ({selectedIds.size})
                             </button>
                         )}
                         <button onClick={handleExportData} className="text-slate-500 hover:text-teal-600 text-sm font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                            <span>📥</span> 导出数据
                         </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-xs">
                            <tr>
                                <th className="p-4 w-10">
                                    <input type="checkbox" onChange={handleSelectAll} checked={selectedIds.size > 0 && selectedIds.size === filteredArchives.length} />
                                </th>
                                <th className="p-4 cursor-pointer hover:text-teal-600 transition-colors" onClick={() => handleSort('name')}>姓名 <SortIcon colKey="name" /></th>
                                <th className="p-4">编号</th>
                                <th className="p-4 cursor-pointer hover:text-teal-600 transition-colors" onClick={() => handleSort('department')}>部门 <SortIcon colKey="department" /></th>
                                <th className="p-4 cursor-pointer hover:text-teal-600 transition-colors" onClick={() => handleSort('risk_level')}>风险等级 <SortIcon colKey="risk_level" /></th>
                                <th className="p-4">危急值状态</th>
                                <th className="p-4 cursor-pointer hover:text-teal-600 transition-colors" onClick={() => handleSort('updated_at')}>更新时间 <SortIcon colKey="updated_at" /></th>
                                <th className="p-4 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredArchives.length > 0 ? filteredArchives.map(archive => {
                                const isCriticalActive = (archive.assessment_data.isCritical || (archive.assessment_data.criticalWarning && archive.assessment_data.criticalWarning.includes('类'))) && archive.critical_track?.status !== 'archived';

                                return (
                                <tr 
                                    key={archive.id} 
                                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedIds.has(archive.id) ? 'bg-blue-50/30' : ''}`}
                                    onDoubleClick={() => onSelectPatient(archive, 'assessment')}
                                >
                                    <td className="p-4">
                                        <input type="checkbox" checked={selectedIds.has(archive.id)} onChange={() => handleSelectRow(archive.id)} />
                                    </td>
                                    <td className="p-4 font-bold text-slate-800">
                                        <div className="flex flex-col">
                                            <span>{archive.name}</span>
                                            <span className="text-[10px] font-normal text-slate-400">{archive.gender} · {archive.age}岁</span>
                                        </div>
                                    </td>
                                    <td className="p-4 font-mono">{archive.checkup_id}</td>
                                    <td className="p-4">{archive.department || '-'}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                            archive.risk_level === 'RED' ? 'bg-red-50 text-red-600 border-red-200' :
                                            archive.risk_level === 'YELLOW' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                            'bg-green-50 text-green-600 border-green-200'
                                        }`}>
                                            {archive.risk_level === 'RED' ? '高风险' : archive.risk_level === 'YELLOW' ? '中风险' : '低风险'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {isCriticalActive ? (
                                            <button 
                                                onClick={() => setCriticalModalArchive(archive)}
                                                className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded border border-red-200 text-xs font-bold animate-pulse hover:bg-red-200"
                                            >
                                                <span>⚡</span>
                                                {archive.critical_track?.status === 'pending_secondary' ? '待二次回访' : '待处理'}
                                            </button>
                                        ) : (
                                            <span className="text-slate-400 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-xs text-slate-500">
                                        {new Date(archive.updated_at || archive.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 flex justify-center gap-2">
                                        <button onClick={() => onSelectPatient(archive, 'view')} className="text-slate-400 hover:text-teal-600 transition-colors" title="查看档案">👁️</button>
                                        <button onClick={() => handleEditClick(archive)} className="text-slate-400 hover:text-blue-600 transition-colors" title="编辑信息">✏️</button>
                                        <button onClick={() => handleDelete(archive.id, archive.name)} className="text-slate-400 hover:text-red-600 transition-colors" title="删除">🗑️</button>
                                    </td>
                                </tr>
                            )}) : (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-400">
                                        {loading ? '加载中...' : '未找到匹配的健康档案'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Smart Batch Import Modal */}
            {isSmartBatchModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-2xl animate-scaleIn">
                        <div className="flex justify-between items-start mb-6 border-b pb-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <span>✨</span> 批量智能建档 (PDF/Word/Txt)
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">支持一次性上传多个体检报告文件，AI 将自动提取、评估并建档。</p>
                            </div>
                            <button onClick={() => !isSmartBatchProcessing && setIsSmartBatchModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
                        </div>
                        
                        <div className="mb-6">
                             <div className="border-2 border-dashed border-indigo-200 bg-indigo-50 rounded-xl p-8 text-center transition-colors hover:border-indigo-400 relative">
                                 <input 
                                    type="file" 
                                    multiple 
                                    accept=".pdf,.docx,.doc,.txt" 
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={handleSmartBatchFiles}
                                    disabled={isSmartBatchProcessing}
                                 />
                                 <div className="text-4xl mb-3">📂</div>
                                 <p className="font-bold text-indigo-700">点击或拖拽上传多个文件</p>
                                 <p className="text-xs text-indigo-400 mt-2">支持 PDF, Word (.docx), Txt 格式</p>
                                 {smartBatchFiles.length > 0 && (
                                     <div className="mt-4 bg-white rounded-lg p-2 text-sm font-bold text-indigo-600 shadow-sm inline-block">
                                         已选择 {smartBatchFiles.length} 个文件
                                     </div>
                                 )}
                             </div>
                        </div>

                        {/* Logs Area */}
                        <div className="bg-slate-900 text-green-400 font-mono text-xs p-4 rounded-lg h-48 overflow-y-auto mb-6 shadow-inner">
                            {smartBatchLogs.length === 0 ? (
                                <span className="opacity-50">// 等待任务开始...</span>
                            ) : (
                                smartBatchLogs.map((log, i) => <div key={i}>{log}</div>)
                            )}
                            {isSmartBatchProcessing && <div className="animate-pulse mt-2">_ 处理中...</div>}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setIsSmartBatchModalOpen(false)} 
                                disabled={isSmartBatchProcessing}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-bold"
                            >
                                关闭
                            </button>
                            <button 
                                onClick={runSmartBatchImport}
                                disabled={isSmartBatchProcessing || smartBatchFiles.length === 0}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-lg disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSmartBatchProcessing ? '🤖 AI 正在处理...' : '🚀 开始批量建档'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Existing Excel Import Modal */}
            {isBatchModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md animate-scaleIn text-center">
                        <h3 className="text-xl font-bold text-slate-800 mb-2">批量导入健康档案 (Excel)</h3>
                        <p className="text-xs text-slate-500 mb-6">请使用标准模板导入数据。系统将自动生成评估方案。</p>
                        
                        <div className="space-y-4">
                            <button onClick={downloadTemplate} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:border-teal-500 hover:text-teal-600 transition-all flex items-center justify-center gap-2">
                                <span>⬇️</span> 下载 Excel 模板
                            </button>
                            
                            <div className="relative">
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    accept=".xlsx, .xls"
                                    className="hidden"
                                    onChange={handleExcelUpload}
                                />
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <span>📤</span> 上传并导入数据
                                </button>
                            </div>
                        </div>
                        
                        <button onClick={() => setIsBatchModalOpen(false)} className="mt-6 text-sm text-slate-400 hover:text-slate-600">取消操作</button>
                    </div>
                </div>
            )}

            {/* Critical Handle Modal */}
            {criticalModalArchive && (
                <CriticalHandleModal 
                    archive={criticalModalArchive} 
                    onClose={() => setCriticalModalArchive(null)} 
                    onSave={handleCriticalSave} 
                />
            )}

            {/* Profile Edit Modal */}
            {isEditModalOpen && editingArchive && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-scaleIn">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">编辑基本信息</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">姓名</label>
                                <input className="w-full border rounded p-2" value={editForm?.name || ''} onChange={e => setEditForm(prev => ({...prev!, name: e.target.value}))} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">性别</label>
                                    <select className="w-full border rounded p-2 bg-white" value={editForm?.gender || ''} onChange={e => setEditForm(prev => ({...prev!, gender: e.target.value}))}>
                                        <option value="男">男</option>
                                        <option value="女">女</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">年龄</label>
                                    <input type="number" className="w-full border rounded p-2" value={editForm?.age || ''} onChange={e => setEditForm(prev => ({...prev!, age: Number(e.target.value)}))} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">部门</label>
                                <input className="w-full border rounded p-2" value={editForm?.department || ''} onChange={e => setEditForm(prev => ({...prev!, department: e.target.value}))} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">联系电话</label>
                                <input className="w-full border rounded p-2" value={editForm?.phone || ''} onChange={e => setEditForm(prev => ({...prev!, phone: e.target.value}))} />
                            </div>
                             <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">体检编号 (唯一ID)</label>
                                <input className="w-full border rounded p-2 bg-slate-50" value={editForm?.checkupId || ''} onChange={e => setEditForm(prev => ({...prev!, checkupId: e.target.value}))} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">取消</button>
                            <button onClick={handleSaveProfile} className="px-4 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 shadow-lg text-sm">保存修改</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
