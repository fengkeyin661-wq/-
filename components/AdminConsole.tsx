import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchArchives, deleteArchive, updateArchiveProfile, updateCriticalTrack, saveArchive, HealthArchive } from '../services/dataService';
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
}

export const AdminConsole: React.FC<Props> = ({ onSelectPatient, onDataUpdate, isAuthenticated }) => {
    // --- Admin Console Logic ---
    const [archives, setArchives] = useState<HealthArchive[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSqlHelp, setShowSqlHelp] = useState(false);

    // --- Enhanced List State (Sorting, Filtering, Selection) ---
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'updated_at', direction: 'desc' });
    const [filterRisk, setFilterRisk] = useState<string>('ALL'); // ALL, RED, YELLOW, GREEN
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
            const errorMessage = error instanceof Error ? error.message : String(error);
            setFetchError((errorMessage as string) || "无法加载数据，请检查网络或数据库配置。");
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
                const success = await deleteArchive(id);
                if (success) successCount++;
            }
            alert(`批量删除完成，成功删除 ${successCount} 条。`);
            loadData();
            if (onDataUpdate) onDataUpdate();
            setLoading(false);
        }
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
            const matchRisk = filterRisk === 'ALL' || archive.risk_level === filterRisk;
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

            } catch (err: any) {
                setSmartBatchLogs(prev => [...prev, `❌ 处理失败: ${file.name} - ${err.message}`]);
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
                arch.checkup_date || '-',
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

    const StatsCard = ({ label, value, color, icon, bg }: any) => (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
                <p className="text-3xl font-black text-slate-800 tracking-tight">{value}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${bg} ${color}`}>
                {icon}
            </div>
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
                 <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${configured && !fetchError ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    <div className={`w-2 h-2 rounded-full ${configured && !fetchError ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    {configured ? (fetchError ? '数据库异常' : 'Database Connected') : 'Env Not Configured'}
                </div>
                {fetchError && (
                    <button onClick={() => setShowSqlHelp(!showSqlHelp)} className="text-xs text-blue-600 underline">
                        SQL修复指南
                    </button>
                )}
            </div>

            {/* SQL Help Area */}
            {showSqlHelp && (
                <div className="bg-slate-800 text-slate-200 p-6 rounded-lg font-mono text-sm overflow-x-auto border border-slate-700 shadow-2xl relative mb-6">
                    <button onClick={() => setShowSqlHelp(false)} className="absolute top-2 right-2 text-slate-400 hover:text-white">×</button>
                    <p className="mb-2 text-yellow-400 font-bold"># 请在 Supabase SQL Editor 中运行以下代码以创建必要的表结构:</p>
                    <pre className="whitespace-pre-wrap">{`
-- 启用必要的扩展
create extension if not exists "uuid-ossp";

-- 创建健康档案主表
create table if not exists health_archives (
  id uuid default uuid_generate_v4() primary key,
  checkup_id text unique not null,
  name text,
  phone text,
  department text,
  gender text,
  age int,
  risk_level text,
  checkup_date text, 
  
  health_record jsonb,
  assessment_data jsonb,
  follow_up_schedule jsonb,
  follow_ups jsonb,
  history_versions jsonb,
  critical_track jsonb,
  risk_analysis jsonb,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 开启行级安全策略 (根据需求可选)
alter table health_archives enable row level security;
create policy "Allow all access" on health_archives for all using (true);
                    `}</pre>
                </div>
            )}

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard label="总建档案" value={archives.length} color="text-slate-600" bg="bg-slate-100" icon="📂" />
                <StatsCard label="高风险 (红)" value={archives.filter(a => a.risk_level === 'RED').length} color="text-red-600" bg="bg-red-100" icon="🔴" />
                <StatsCard label="中风险 (黄)" value={archives.filter(a => a.risk_level === 'YELLOW').length} color="text-yellow-600" bg="bg-yellow-100" icon="🟡" />
                <StatsCard label="今日更新" value={archives.filter(a => new Date(a.updated_at || a.created_at).toDateString() === new Date().toDateString()).length} color="text-teal-600" bg="bg-teal-100" icon="⚡" />
            </div>

            {/* Critical Values Panel */}
            {activeCriticalPatients.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl animate-pulse">🚨</span>
                            <h3 className="text-xl font-bold text-red-800">危急值(A类) / 重大异常(B类) 预警名单</h3>
                            <span className="bg-red-200 text-red-800 text-xs px-2 py-0.5 rounded-full font-bold">{activeCriticalPatients.length}</span>
                        </div>
                        <button 
                            onClick={handleExportCritical}
                            className="text-xs bg-white text-red-700 border border-red-200 px-3 py-1.5 rounded hover:bg-red-50 font-bold flex items-center gap-1"
                        >
                            <span>📥</span> 导出名单
                        </button>
                    </div>
                    <div className="overflow-x-auto bg-white rounded-lg border border-red-100">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-red-100/50 text-red-900 font-bold">
                                <tr>
                                    <th className="px-4 py-3">编号/姓名</th>
                                    <th className="px-4 py-3">分类</th>
                                    <th className="px-4 py-3">异常描述</th>
                                    <th className="px-4 py-3">通知时间</th>
                                    <th className="px-4 py-3">状态</th>
                                    <th className="px-4 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-red-50">
                                {activeCriticalPatients.map(arch => {
                                    const warningText = arch.assessment_data.criticalWarning || '';
                                    // 识别分类 A类/B类
                                    const isTypeA = warningText.includes('A类') || arch.assessment_data.riskLevel === 'RED';
                                    const typeLabel = warningText.includes('A类') ? 'A类危急值' : warningText.includes('B类') ? 'B类重大异常' : (isTypeA ? 'A类危急值' : '未知');
                                    
                                    return (
                                        <tr key={arch.id} className="hover:bg-red-50/50">
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-700">{arch.name}</div>
                                                <div className="text-xs text-slate-400 font-mono">{arch.checkup_id}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                 <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                                                     isTypeA ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'
                                                 }`}>
                                                     {typeLabel}
                                                 </span>
                                            </td>
                                            <td className="px-4 py-3 max-w-xs truncate text-red-700 font-medium">
                                                {arch.critical_track?.critical_desc || arch.assessment_data.criticalWarning}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">
                                                {arch.critical_track?.initial_notify_time || '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                                    arch.critical_track?.status === 'pending_secondary' 
                                                    ? 'bg-yellow-100 text-yellow-700' 
                                                    : 'bg-red-600 text-white animate-pulse'
                                                }`}>
                                                    {arch.critical_track?.status === 'pending_secondary' ? '待二次回访' : '待初次处理'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button 
                                                    onClick={() => setCriticalModalArchive(arch)}
                                                    className={`text-xs px-3 py-1.5 rounded font-bold shadow-sm text-white ${
                                                        isTypeA ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600'
                                                    }`}
                                                >
                                                    ⚡ 处置
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Main Data Table */}
            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col h-[600px]">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 justify-between bg-slate-50 items-center">
                    <div className="flex gap-3 items-center flex-1">
                        <select 
                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                            value={filterRisk}
                            onChange={(e) => setFilterRisk(e.target.value)}
                        >
                            <option value="ALL">全部风险等级</option>
                            <option value="RED">🔴 高风险</option>
                            <option value="YELLOW">🟡 中风险</option>
                            <option value="GREEN">🟢 低风险</option>
                        </select>
                        <div className="relative flex-1 max-w-md">
                            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                            <input 
                                type="text" 
                                placeholder="搜索姓名、体检编号、部门或电话..." 
                                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="text-xs text-slate-500">
                            共 {filteredArchives.length} 条记录
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {selectedIds.size > 0 && (
                            <button 
                                onClick={handleBatchDelete}
                                className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-100"
                            >
                                🗑️ 删除选中 ({selectedIds.size})
                            </button>
                        )}
                        <button 
                            onClick={handleExportData}
                            className="bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-700 flex items-center gap-1 shadow-sm"
                        >
                            <span>📤</span> 导出数据
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-auto flex-1 relative">
                    {loading ? (
                         <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                            <div className="flex flex-col items-center">
                                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                <span className="text-slate-500 text-sm font-bold">加载中...</span>
                            </div>
                         </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-4 w-10">
                                        <input type="checkbox" onChange={handleSelectAll} checked={selectedIds.size > 0 && selectedIds.size === filteredArchives.length} />
                                    </th>
                                    <th className="p-4 cursor-pointer hover:text-teal-600" onClick={() => handleSort('checkup_id')}>
                                        体检编号 <SortIcon colKey="checkup_id" />
                                    </th>
                                    <th className="p-4 cursor-pointer hover:text-teal-600" onClick={() => handleSort('name')}>
                                        姓名 <SortIcon colKey="name" />
                                    </th>
                                    <th className="p-4">年龄</th>
                                    <th className="p-4 cursor-pointer hover:text-teal-600" onClick={() => handleSort('department')}>
                                        部门/单位 <SortIcon colKey="department" />
                                    </th>
                                    <th className="p-4">联系电话</th>
                                    <th className="p-4 cursor-pointer hover:text-teal-600" onClick={() => handleSort('risk_level')}>
                                        风险评估 <SortIcon colKey="risk_level" />
                                    </th>
                                    <th className="p-4">下次随访</th>
                                    <th className="p-4 cursor-pointer hover:text-teal-600" onClick={() => handleSort('updated_at')}>
                                        更新时间 <SortIcon colKey="updated_at" />
                                    </th>
                                    <th className="p-4 text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {filteredArchives.map(arch => {
                                    const nextPending = arch.follow_up_schedule?.find(s => s.status === 'pending');
                                    return (
                                        <tr key={arch.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(arch.id) ? 'bg-blue-50/30' : ''}`}>
                                            <td className="p-4">
                                                <input type="checkbox" checked={selectedIds.has(arch.id)} onChange={() => handleSelectRow(arch.id)} />
                                            </td>
                                            <td className="p-4 font-mono text-slate-600">{arch.checkup_id}</td>
                                            <td className="p-4 font-bold text-slate-800">{arch.name}</td>
                                            <td className="p-4 text-slate-600">{arch.age || '-'}</td>
                                            <td className="p-4 text-slate-600 max-w-[150px] truncate" title={arch.department}>{arch.department || '-'}</td>
                                            <td className="p-4 font-mono text-slate-500">{arch.phone || '-'}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                                                    arch.risk_level === 'RED' ? 'bg-red-50 text-red-600 border-red-200' :
                                                    arch.risk_level === 'YELLOW' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                                    'bg-green-50 text-green-600 border-green-200'
                                                }`}>
                                                    {arch.risk_level === 'RED' ? '高风险' : arch.risk_level === 'YELLOW' ? '中风险' : '低风险'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {nextPending ? (
                                                    <span className="text-xs font-mono bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                                                        {nextPending.date}
                                                    </span>
                                                ) : <span className="text-slate-300 text-xs">无计划</span>}
                                            </td>
                                            <td className="p-4 text-xs text-slate-400">
                                                {new Date(arch.updated_at || arch.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 flex justify-center gap-2">
                                                <button onClick={() => onSelectPatient(arch, 'view')} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 text-slate-600" title="查看档案">
                                                    👁️
                                                </button>
                                                <button onClick={() => onSelectPatient(arch, 'followup')} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 text-blue-600" title="随访管理">
                                                    📅
                                                </button>
                                                <button onClick={() => handleEditClick(arch)} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 text-orange-600" title="编辑信息">
                                                    ✏️
                                                </button>
                                                <button onClick={() => handleDelete(arch.id, arch.name)} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded hover:bg-red-50 text-red-600" title="删除">
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredArchives.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={10} className="p-10 text-center">
                                            <div className="flex flex-col items-center text-slate-400">
                                                <span className="text-4xl mb-2">📭</span>
                                                <p>暂无符合条件的档案</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && editingArchive && editForm && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg animate-scaleIn">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">编辑基本信息</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">姓名</label>
                                    <input className="w-full border rounded p-2 text-sm" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">体检编号</label>
                                    <input className="w-full border rounded p-2 text-sm" value={editForm.checkupId} onChange={e => setEditForm({...editForm, checkupId: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">性别</label>
                                    <select className="w-full border rounded p-2 text-sm" value={editForm.gender} onChange={e => setEditForm({...editForm, gender: e.target.value})}>
                                        <option value="男">男</option>
                                        <option value="女">女</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">年龄</label>
                                    <input type="number" className="w-full border rounded p-2 text-sm" value={editForm.age} onChange={e => setEditForm({...editForm, age: Number(e.target.value)})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">部门/单位</label>
                                <input className="w-full border rounded p-2 text-sm" value={editForm.department} onChange={e => setEditForm({...editForm, department: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">联系电话</label>
                                <input className="w-full border rounded p-2 text-sm" value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm">取消</button>
                            <button onClick={handleSaveProfile} className="px-4 py-2 bg-teal-600 text-white font-bold rounded hover:bg-teal-700 shadow text-sm">保存修改</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Critical Handling Modal */}
            {criticalModalArchive && (
                <CriticalHandleModal 
                    archive={criticalModalArchive} 
                    onClose={() => setCriticalModalArchive(null)} 
                    onSave={handleCriticalSave} 
                />
            )}

            {/* Smart Batch Import Modal (PDF/Word + AI) */}
            {isSmartBatchModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl animate-scaleIn h-[500px] flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b pb-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <span>✨</span> 批量智能建档 (PDF/Word)
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">支持批量上传体检报告文件，AI 自动解析并建立健康档案。</p>
                            </div>
                            <button onClick={() => !isSmartBatchProcessing && setIsSmartBatchModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 font-mono text-xs">
                             {smartBatchLogs.length === 0 ? (
                                 <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                     <div className="text-4xl mb-2">📂</div>
                                     <p>请选择文件开始上传处理</p>
                                     <p className="text-[10px] mt-1">支持 .pdf, .docx, .doc, .txt</p>
                                 </div>
                             ) : (
                                 smartBatchLogs.map((log, i) => (
                                     <div key={i} className="mb-1">{log}</div>
                                 ))
                             )}
                             {/* Auto scroll anchor */}
                             <div style={{ float:"left", clear: "both" }}></div>
                        </div>

                        <div className="flex justify-between items-center">
                            <input 
                                type="file" 
                                multiple 
                                accept=".pdf,.docx,.doc,.txt"
                                onChange={handleSmartBatchFiles}
                                className="text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                disabled={isSmartBatchProcessing}
                            />
                            
                            <button 
                                onClick={runSmartBatchImport}
                                disabled={isSmartBatchProcessing || smartBatchFiles.length === 0}
                                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-all"
                            >
                                {isSmartBatchProcessing ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        处理中...
                                    </>
                                ) : '🚀 开始批量解析'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Excel Batch Import Modal */}
            {isBatchModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg animate-scaleIn">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">批量导入健康档案 (Excel)</h3>
                        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                            请下载标准模板，按格式填入数据后上传。<br/>
                            <span className="text-orange-500 text-xs">注意：导入将根据“体检编号”自动覆盖已存在的档案。</span>
                        </p>
                        
                        <div className="flex flex-col gap-4">
                            <button 
                                onClick={downloadTemplate}
                                className="w-full py-3 border-2 border-dashed border-teal-200 text-teal-700 rounded-xl hover:bg-teal-50 font-bold flex items-center justify-center gap-2"
                            >
                                <span>📥</span> 下载 Excel 模板
                            </button>
                            
                            <div className="relative">
                                <input 
                                    type="file" 
                                    accept=".xlsx, .xls"
                                    onChange={handleExcelUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="w-full py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 font-bold flex items-center justify-center gap-2 shadow-lg">
                                    <span>📂</span> 选择 Excel 文件并导入
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 text-center">
                            <button onClick={() => setIsBatchModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-sm">关闭窗口</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};