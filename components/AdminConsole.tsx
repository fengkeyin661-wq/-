
import React, { useState, useEffect, useMemo } from 'react';
import { fetchArchives, deleteArchive, updateArchiveProfile, updateCriticalTrack, saveArchive, HealthArchive } from '../services/dataService';
import { parseHealthDataFromText, generateHealthAssessment, generateFollowUpSchedule } from '../services/geminiService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { HealthProfile, CriticalTrackRecord, HealthRecord, HealthAssessment, RiskLevel } from '../types';
import { CriticalHandleModal } from './CriticalHandleModal';
// @ts-ignore
import * as XLSX from 'xlsx';
// @ts-ignore
import * as mammoth from 'mammoth';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

interface Props {
    onSelectPatient: (archive: HealthArchive, mode?: 'view' | 'edit' | 'followup') => void;
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

    // Critical Modal State
    const [criticalModalArchive, setCriticalModalArchive] = useState<HealthArchive | null>(null);

    // Batch Import Modal State
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    
    // Smart Batch Import Modal State (PDF/Word + AI)
    const [isSmartBatchModalOpen, setIsSmartBatchModalOpen] = useState(false);

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
        } catch (err: any) {
            console.error("Load Data Error:", err);
            setFetchError(err.message || "无法加载数据，请检查网络或数据库配置。");
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
        setIsEditModalOpen(true);
    };

    const handleSaveProfile = async (updatedProfile: HealthProfile) => {
        if (!editingArchive) return;
        const result = await updateArchiveProfile(editingArchive.id, updatedProfile);
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

    // --- Export Handler (General) ---
    const handleExportData = () => {
        if (filteredArchives.length === 0) {
            alert("当前列表无数据可导出");
            return;
        }

        const headers = ['姓名', '体检编号', '性别', '年龄', '部门', '联系电话', '风险等级', '下次随访时间', '最新评估时间'];
        
        const rows = filteredArchives.map(arch => {
            // Find next pending date
            const nextPending = arch.follow_up_schedule?.find(s => s.status === 'pending');
            const nextDate = nextPending ? nextPending.date : '无计划';
            const riskLabel = arch.risk_level === 'RED' ? '高危' : arch.risk_level === 'YELLOW' ? '中危' : '低危';

            return [
                arch.name,
                arch.checkup_id,
                arch.gender || '-',
                arch.age || '-',
                arch.department || '-',
                arch.phone ? `"${arch.phone}"` : '-', // 防止Excel将数字变为科学计数法
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
                `"${(track?.critical_desc || warning).replace(/"/g, '""')}"`, // Escape quotes
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

    // --- Logic: Upcoming Tasks (Standard Follow-ups) ---
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

    // --- Logic: Critical Patients (Active only) ---
    const getActiveCriticalPatients = () => {
        return archives.filter(arch => 
            arch.assessment_data?.isCritical === true && 
            arch.critical_track?.status !== 'archived'
        );
    };

    const upcomingTasks = getUpcomingTasks();
    const activeCriticalPatients = getActiveCriticalPatients();

    const StatsCard = ({ label, value, color, icon }: any) => (
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${color}`}>
                {icon}
            </div>
            <div>
                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider">{label}</p>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
            </div>
        </div>
    );

    // Helper for Sort Icons
    const SortIcon = ({ colKey }: { colKey: string }) => {
        if (sortConfig?.key !== colKey) return <span className="text-slate-300 ml-1">⇅</span>;
        return <span className="text-teal-600 ml-1 font-bold">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center h-[500px] animate-fadeIn text-slate-500">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-4xl">🔒</div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">访问受限</h3>
                <p className="mb-6">您需要登录管理员账号才能访问控制台。</p>
                <p className="text-sm bg-blue-50 text-blue-700 px-4 py-2 rounded">
                    请点击页面右上角的 <strong>管理员登录</strong> 按钮进行验证
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn pb-10">
            {/* Top Bar: Connection Status */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${configured && !fetchError ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        <div className={`w-2 h-2 rounded-full ${configured && !fetchError ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        {configured ? (fetchError ? '数据库连接异常' : 'Supabase 已连接') : '环境变量未配置'}
                    </div>
                    {fetchError && (
                        <button onClick={() => setShowSqlHelp(!showSqlHelp)} className="text-xs text-blue-600 underline">
                            查看修复指南 (SQL)
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                     <button 
                        onClick={() => setIsSmartBatchModalOpen(true)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-xs font-bold text-white flex items-center gap-1 transition-colors shadow-sm"
                     >
                        ✨ 批量智能建档 (PDF)
                     </button>
                     <button 
                        onClick={() => setIsBatchModalOpen(true)}
                        className="px-3 py-1 bg-teal-600 hover:bg-teal-700 rounded text-xs font-bold text-white flex items-center gap-1 transition-colors shadow-sm"
                     >
                        📂 批量导入 (Excel)
                     </button>
                     <button onClick={loadData} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold text-slate-600 flex items-center gap-1 transition-colors">
                        🔄 刷新数据
                     </button>
                </div>
            </div>

            {/* SQL Help Area */}
            {showSqlHelp && (
                <div className="bg-slate-800 text-slate-200 p-6 rounded-xl shadow-lg animate-slideDown">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-white font-bold text-lg">🛠️ 数据库维护脚本</h3>
                            <p className="text-sm text-slate-400">请复制以下 SQL 代码，在 Supabase Dashboard 的 SQL Editor 中运行。</p>
                        </div>
                        <button onClick={() => setShowSqlHelp(false)} className="text-slate-400 hover:text-white">✕</button>
                    </div>
                    <pre className="bg-black/50 p-4 rounded overflow-x-auto text-xs font-mono text-green-400 border border-slate-700">
{`-- [修复] 如果出现 "Could not find critical_track column" 错误，请运行：
ALTER TABLE public.health_archives ADD COLUMN IF NOT EXISTS critical_track jsonb;
ALTER TABLE public.health_archives ADD COLUMN IF NOT EXISTS risk_analysis jsonb;

-- 1. 启用 UUID 扩展
create extension if not exists "pgcrypto";

-- 2. 创建核心档案表
create table if not exists public.health_archives (
  id uuid default gen_random_uuid() primary key,
  checkup_id text not null unique,
  name text,
  phone text,
  department text,
  gender text,
  age int,
  risk_level text,
  health_record jsonb,
  assessment_data jsonb,
  follow_up_schedule jsonb,
  follow_ups jsonb default '[]'::jsonb,
  critical_track jsonb, -- 新增字段
  risk_analysis jsonb, -- 新增字段 (风险画像)
  history_versions jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. 创建索引加速查询
create index if not exists health_archives_checkup_id_idx on public.health_archives (checkup_id);`}
                    </pre>
                </div>
            )}

            {/* Critical Value Warning List */}
            {activeCriticalPatients.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-xl shadow-sm p-5 animate-pulse-slow">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-red-800 font-bold flex items-center gap-2 text-lg">
                            🚨 危急值预警名单 (独立闭环管理)
                        </h3>
                        <div className="flex items-center gap-3">
                            <span className="text-xs bg-red-200 text-red-900 px-2 py-1 rounded-full font-bold">
                                {activeCriticalPatients.length} 人待处理
                            </span>
                            <button 
                                onClick={handleExportCritical}
                                className="bg-white border border-red-300 text-red-700 px-3 py-1 rounded text-xs font-bold hover:bg-red-100 flex items-center gap-1 shadow-sm"
                            >
                                📤 导出危急值报告
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeCriticalPatients.map((arch) => {
                            const isPendingSecondary = arch.critical_track?.status === 'pending_secondary';
                            
                            return (
                                <div key={arch.id} className="bg-white border border-red-200 rounded-lg p-3 flex justify-between items-center shadow-sm">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800">{arch.name}</span>
                                            <span className="text-xs text-red-500 font-bold border border-red-200 px-1 rounded bg-red-50">危急</span>
                                        </div>
                                        <div className="text-xs text-red-700 mt-1 max-w-[200px] truncate" title={arch.assessment_data.criticalWarning || '危急值筛查异常'}>
                                            ⚠️ {arch.assessment_data.criticalWarning || '存在危急指标'}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">📞 {arch.phone || '无电话'}</div>
                                    </div>
                                    
                                    <button 
                                        onClick={() => setCriticalModalArchive(arch)}
                                        className={`text-white text-xs px-3 py-1.5 rounded font-bold shadow-sm transition-transform hover:scale-105 ${
                                            isPendingSecondary 
                                            ? 'bg-yellow-600 hover:bg-yellow-700' 
                                            : 'bg-red-600 hover:bg-red-700 animate-pulse'
                                        }`}
                                    >
                                        {isPendingSecondary ? '🕒 二次回访' : '⚡ 立即处理'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Standard Follow-ups Section */}
            <div className={`rounded-xl border shadow-sm overflow-hidden ${upcomingTasks.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
                <div className={`px-5 py-3 border-b flex justify-between items-center ${upcomingTasks.length > 0 ? 'bg-orange-100/50 border-orange-200' : 'bg-slate-50 border-slate-100'}`}>
                    <h3 className={`font-bold flex items-center gap-2 ${upcomingTasks.length > 0 ? 'text-orange-800' : 'text-slate-700'}`}>
                        {upcomingTasks.length > 0 ? '🔔 近七日需随访提醒' : '✅ 近期无随访任务'}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${upcomingTasks.length > 0 ? 'bg-orange-200 text-orange-800 border-orange-300' : 'bg-slate-200 text-slate-600'}`}>
                        {upcomingTasks.length} 人待访
                    </span>
                </div>
                
                {upcomingTasks.length > 0 && (
                    <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-orange-800/70 bg-orange-50/50 text-left sticky top-0">
                                <tr>
                                    <th className="px-5 py-2">计划日期</th>
                                    <th className="px-5 py-2">剩余天数</th>
                                    <th className="px-5 py-2">姓名/部门</th>
                                    <th className="px-5 py-2">风险等级</th>
                                    <th className="px-5 py-2">重点监测</th>
                                    <th className="px-5 py-2 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-orange-100">
                                {upcomingTasks.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-orange-100/40 transition-colors">
                                        <td className="px-5 py-3 font-mono text-slate-700">{item.date}</td>
                                        <td className="px-5 py-3">
                                            {item.daysLeft < 0 ? (
                                                <span className="text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded text-xs">逾期 {-item.daysLeft} 天</span>
                                            ) : item.daysLeft === 0 ? (
                                                <span className="text-teal-600 font-bold bg-teal-100 px-2 py-0.5 rounded text-xs">今天</span>
                                            ) : (
                                                <span className="text-orange-600 font-medium">{item.daysLeft} 天后</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="font-bold text-slate-800">{item.archive.name}</div>
                                            <div className="text-xs text-slate-500">{item.archive.department}</div>
                                            <div className="text-xs text-slate-600 font-mono mt-0.5">📞 {item.archive.phone || '-'}</div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                                                item.archive.risk_level === 'RED' ? 'bg-red-50 text-red-700 border-red-200' :
                                                item.archive.risk_level === 'YELLOW' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-green-50 text-green-700 border-green-200'
                                            }`}>
                                                {item.archive.risk_level === 'RED' ? '高危' : item.archive.risk_level === 'YELLOW' ? '中危' : '低危'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-slate-600 max-w-xs truncate" title={item.focus}>
                                            {item.focus}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <button 
                                                onClick={() => onSelectPatient(item.archive, 'followup')}
                                                className="bg-white border border-orange-300 text-orange-700 hover:bg-orange-600 hover:text-white hover:border-orange-600 px-3 py-1 rounded-full text-xs font-bold shadow-sm transition-all"
                                            >
                                                ⚡ 立即随访
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatsCard label="总建档量" value={archives.length} color="bg-blue-100 text-blue-600" icon="📂" />
                <StatsCard label="高风险 (红)" value={archives.filter(a => a.risk_level === 'RED').length} color="bg-red-100 text-red-600" icon="🔴" />
                <StatsCard label="中风险 (黄)" value={archives.filter(a => a.risk_level === 'YELLOW').length} color="bg-yellow-100 text-yellow-600" icon="🟡" />
                <StatsCard label="今日更新" value={archives.filter(a => new Date(a.created_at).toDateString() === new Date().toDateString()).length} color="bg-teal-100 text-teal-600" icon="⚡" />
            </div>

            {/* Main Data Grid (Full Width) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[700px]">
                {/* Toolbar */}
                <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-3 items-center flex-1">
                        {/* Risk Filter */}
                        <select 
                            className="border border-slate-200 rounded-lg py-2 px-3 text-sm bg-slate-50 focus:outline-none focus:border-teal-500"
                            value={filterRisk}
                            onChange={e => setFilterRisk(e.target.value)}
                        >
                            <option value="ALL">全部风险等级</option>
                            <option value="RED">高风险 (红)</option>
                            <option value="YELLOW">中风险 (黄)</option>
                            <option value="GREEN">低风险 (绿)</option>
                        </select>

                        {/* Search Bar */}
                        <div className="relative flex-1 max-w-sm">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                            <input 
                                type="text" 
                                placeholder="搜索姓名、电话、编号..." 
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 transition-colors"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="text-xs text-slate-400 whitespace-nowrap">
                             显示 {filteredArchives.length} 条
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {/* Batch Delete Button */}
                        {selectedIds.size > 0 && (
                            <button 
                                onClick={handleBatchDelete}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 shadow-sm transition-all animate-scaleIn"
                            >
                                <span>🗑️</span> 批量删除 ({selectedIds.size})
                            </button>
                        )}
                        
                        <button 
                            onClick={handleExportData}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 shadow-sm transition-colors"
                        >
                            <span>📤</span> 导出数据
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-slate-500 font-medium select-none">
                            <tr>
                                <th className="px-5 py-3 border-b border-slate-200 w-12 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="cursor-pointer"
                                        checked={filteredArchives.length > 0 && selectedIds.size === filteredArchives.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th 
                                    className="px-5 py-3 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('name')}
                                >
                                    基本信息 <SortIcon colKey="name" />
                                </th>
                                <th 
                                    className="px-5 py-3 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('risk_level')}
                                >
                                    风险等级 <SortIcon colKey="risk_level" />
                                </th>
                                <th 
                                    className="px-5 py-3 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('department')}
                                >
                                    部门/电话 <SortIcon colKey="department" />
                                </th>
                                <th className="px-5 py-3 border-b border-slate-200">下次随访时间</th>
                                <th 
                                    className="px-5 py-3 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('updated_at')}
                                >
                                    最新评估时间 <SortIcon colKey="updated_at" />
                                </th>
                                <th className="px-5 py-3 border-b border-slate-200 text-right">管理操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={7} className="p-10 text-center text-slate-400">正在从 Supabase 加载数据...</td></tr>
                            ) : filteredArchives.length === 0 ? (
                                <tr><td colSpan={7} className="p-10 text-center text-slate-400">暂无数据</td></tr>
                            ) : (
                                filteredArchives.map(arch => {
                                    // Calculate Next Follow Up Date for Table
                                    const nextFollowUp = arch.follow_up_schedule?.find(s => s.status === 'pending');
                                    const nextDateStr = nextFollowUp ? nextFollowUp.date : '-';
                                    const isSelected = selectedIds.has(arch.id);

                                    return (
                                        <tr 
                                            key={arch.id} 
                                            className={`hover:bg-teal-50/30 group transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''}`}
                                            onDoubleClick={() => onSelectPatient(arch, 'view')}
                                            title="双击查看评估方案"
                                            onClick={() => handleSelectRow(arch.id)}
                                        >
                                            <td className="px-5 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox" 
                                                    className="cursor-pointer"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectRow(arch.id)}
                                                />
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="font-bold text-slate-800">{arch.name}</div>
                                                <div className="text-xs text-slate-400 font-mono">{arch.checkup_id}</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                                    arch.risk_level === 'RED' ? 'bg-red-50 text-red-700 border-red-100' :
                                                    arch.risk_level === 'YELLOW' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                                                    'bg-green-50 text-green-700 border-green-100'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                        arch.risk_level === 'RED' ? 'bg-red-500' :
                                                        arch.risk_level === 'YELLOW' ? 'bg-yellow-500' :
                                                        'bg-green-500'
                                                    }`}></span>
                                                    {arch.risk_level === 'RED' ? '高危' : arch.risk_level === 'YELLOW' ? '中危' : '低危'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-slate-600 text-xs">
                                                <div>{arch.department || '-'}</div>
                                                <div className="font-mono text-slate-400">{arch.phone || '-'}</div>
                                            </td>
                                            <td className="px-5 py-3 text-slate-600 text-xs font-mono">
                                                 {nextDateStr !== '-' ? (
                                                     <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">
                                                         {nextDateStr}
                                                     </span>
                                                 ) : (
                                                     <span className="text-slate-300">-</span>
                                                 )}
                                            </td>
                                            <td className="px-5 py-3 text-slate-500 text-xs font-mono">
                                                 {new Date(arch.updated_at || arch.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex justify-end gap-2 opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => onSelectPatient(arch, 'view')}
                                                        className="px-2 py-1 text-xs font-bold text-teal-600 hover:bg-teal-50 rounded border border-transparent hover:border-teal-100 transition-colors"
                                                        title="查看评估报告"
                                                    >
                                                        查看
                                                    </button>
                                                    <button 
                                                        onClick={() => handleEditClick(arch)}
                                                        className="px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 transition-colors"
                                                        title="修改基本信息"
                                                    >
                                                        修改
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(arch.id, arch.name)}
                                                        className="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="删除档案"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Profile Modal */}
            {isEditModalOpen && editingArchive && (
                <EditProfileModal 
                    archive={editingArchive}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSaveProfile}
                />
            )}

            {/* Critical Handle Modal */}
            {criticalModalArchive && (
                <CriticalHandleModal 
                    archive={criticalModalArchive}
                    onClose={() => setCriticalModalArchive(null)}
                    onSave={handleCriticalSave}
                />
            )}

            {/* Batch Import Modal (CSV/Excel) */}
            {isBatchModalOpen && (
                <BatchImportModal 
                    onClose={() => setIsBatchModalOpen(false)}
                    onComplete={() => {
                        setIsBatchModalOpen(false);
                        loadData();
                        if(onDataUpdate) onDataUpdate();
                    }}
                />
            )}
            
            {/* Smart Batch Import Modal (PDF/Word/AI) */}
            {isSmartBatchModalOpen && (
                <SmartBatchImportModal 
                    onClose={() => setIsSmartBatchModalOpen(false)}
                    onComplete={() => {
                        setIsSmartBatchModalOpen(false);
                        loadData();
                        if(onDataUpdate) onDataUpdate();
                    }}
                />
            )}
        </div>
    );
};

// --- Sub Components ---

interface EditModalProps {
    archive: HealthArchive;
    onClose: () => void;
    onSave: (data: HealthProfile) => void;
}

const EditProfileModal: React.FC<EditModalProps> = ({ archive, onClose, onSave }) => {
    const [form, setForm] = useState<HealthProfile>({
        checkupId: archive.checkup_id,
        name: archive.name,
        gender: archive.gender || '男',
        department: archive.department,
        phone: archive.phone || '',
        age: archive.age,
        dob: archive.health_record.profile.dob
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(form);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-scaleIn">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h3 className="text-lg font-bold text-slate-800">✏️ 修改基本信息</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">姓名</label>
                        <input 
                            type="text" required
                            className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                            value={form.name}
                            onChange={e => setForm({...form, name: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">体检编号</label>
                            <input 
                                type="text" required
                                className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                value={form.checkupId}
                                onChange={e => setForm({...form, checkupId: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">联系电话</label>
                            <input 
                                type="text"
                                className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                value={form.phone || ''}
                                onChange={e => setForm({...form, phone: e.target.value})}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">部门/单位</label>
                        <input 
                            type="text"
                            className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                            value={form.department}
                            onChange={e => setForm({...form, department: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">性别</label>
                            <select 
                                className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
                                value={form.gender}
                                onChange={e => setForm({...form, gender: e.target.value})}
                            >
                                <option value="男">男</option>
                                <option value="女">女</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">年龄</label>
                            <input 
                                type="number"
                                className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                value={form.age || ''}
                                onChange={e => setForm({...form, age: Number(e.target.value)})}
                            />
                        </div>
                    </div>
                    
                    <div className="pt-4 flex gap-3 justify-end">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded text-slate-600 hover:bg-slate-100 text-sm">取消</button>
                        <button type="submit" className="px-6 py-2 bg-teal-600 text-white rounded font-bold hover:bg-teal-700 shadow-sm text-sm">保存修改</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Smart Batch Import Modal (PDF/Word/AI) ---
const SmartBatchImportModal = ({ onClose, onComplete }: { onClose: () => void, onComplete: () => void }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [processing, setProcessing] = useState(false);
    // Track status of each file: 'pending', 'extracting', 'parsing', 'assessing', 'saving', 'success', 'error'
    const [fileStatuses, setFileStatuses] = useState<{name: string, status: string, detail?: string}[]>([]);
    const [successCount, setSuccessCount] = useState(0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);
            setFileStatuses(prev => [
                ...prev,
                ...newFiles.map(f => ({ name: f.name, status: 'pending', detail: '等待处理...' }))
            ]);
        }
    };

    const extractText = async (file: File): Promise<string> => {
        const fileType = file.name.split('.').pop()?.toLowerCase();
        
        if (fileType === 'txt') {
            return await file.text();
        } 
        else if (fileType === 'docx') {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        }
        else if (fileType === 'pdf') {
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
        else {
            throw new Error("不支持的文件格式 (仅支持 PDF, Word, TXT)");
        }
    };

    const updateStatus = (index: number, status: string, detail: string) => {
        setFileStatuses(prev => {
            const next = [...prev];
            next[index] = { ...next[index], status, detail };
            return next;
        });
    };

    const startProcessing = async () => {
        setProcessing(true);
        let sCount = 0;

        for (let i = 0; i < files.length; i++) {
            // Check if already processed
            if (fileStatuses[i].status === 'success' || fileStatuses[i].status === 'error') continue;

            const file = files[i];
            
            try {
                // 1. Extract Text
                updateStatus(i, 'extracting', '📄 正在提取文本...');
                const rawText = await extractText(file);
                
                if (!rawText || rawText.length < 50) {
                     throw new Error("提取的文本内容过少或为空");
                }

                // 2. AI Parsing (Structure Data)
                updateStatus(i, 'parsing', '🤖 AI正在解析数据结构...');
                const healthRecord = await parseHealthDataFromText(rawText);
                
                if (!healthRecord.profile.name || !healthRecord.profile.checkupId) {
                    throw new Error("解析失败：未能提取到姓名或体检编号");
                }

                // 3. AI Assessment (Risk Analysis)
                updateStatus(i, 'assessing', '🩺 AI正在生成风险评估方案...');
                const assessment = await generateHealthAssessment(healthRecord);
                const schedule = generateFollowUpSchedule(assessment);

                // 4. Save to DB
                updateStatus(i, 'saving', '💾 正在存档...');
                const saveResult = await saveArchive(healthRecord, assessment, schedule);
                
                if (saveResult.success) {
                    updateStatus(i, 'success', '✅ 建档成功');
                    sCount++;
                } else {
                    throw new Error(saveResult.message || "数据库保存失败");
                }

            } catch (error: unknown) {
                const err = error instanceof Error ? error : new Error(String(error));
                console.error(`Error processing ${file.name}:`, err);
                updateStatus(i, 'error', `❌ 失败: ${err.message}`);
            }
            
            // Wait a bit to avoid rate limits
            await new Promise(r => setTimeout(r, 1000));
        }

        setSuccessCount(prev => prev + sCount);
        setProcessing(false);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[90] backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 h-[80vh] flex flex-col animate-scaleIn">
                <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-indigo-700 flex items-center gap-2">
                            <span>✨</span> 批量智能建档 (AI Parsing)
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">支持 PDF / Word / TXT 体检报告，AI 自动提取数据、评估并建档</p>
                    </div>
                    {!processing && <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>}
                </div>

                {/* File Upload Area */}
                <div className="mb-4 shrink-0">
                    <div className="border-2 border-dashed border-indigo-200 rounded-xl p-6 text-center hover:bg-indigo-50 transition-colors relative">
                        <input 
                            type="file" 
                            multiple
                            accept=".pdf, .docx, .doc, .txt" 
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={processing}
                        />
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-3xl">📄</span>
                            <span className="font-bold text-indigo-700">点击选择或拖入多个文件</span>
                            <span className="text-xs text-slate-500">支持 PDF, Word, TXT 格式</span>
                        </div>
                    </div>
                </div>

                {/* File List & Status */}
                <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50 p-2 mb-4">
                    {fileStatuses.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                            等待添加文件...
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {fileStatuses.map((f, idx) => (
                                <div key={idx} className="bg-white p-3 rounded border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                                            f.status === 'pending' ? 'bg-slate-300' :
                                            f.status === 'extracting' ? 'bg-blue-400 animate-pulse' :
                                            f.status === 'parsing' ? 'bg-indigo-500 animate-pulse' :
                                            f.status === 'assessing' ? 'bg-purple-500 animate-pulse' :
                                            f.status === 'saving' ? 'bg-orange-400 animate-pulse' :
                                            f.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                                        }`}>
                                            {idx + 1}
                                        </div>
                                        <div className="truncate">
                                            <div className="font-bold text-sm text-slate-700 truncate max-w-[200px]">{f.name}</div>
                                            <div className={`text-xs ${
                                                f.status === 'error' ? 'text-red-500' : 
                                                f.status === 'success' ? 'text-green-600' : 'text-indigo-600'
                                            }`}>
                                                {f.detail}
                                            </div>
                                        </div>
                                    </div>
                                    {f.status === 'pending' && !processing && (
                                        <button 
                                            onClick={() => {
                                                const newFiles = [...files];
                                                newFiles.splice(idx, 1);
                                                setFiles(newFiles);
                                                const newStatuses = [...fileStatuses];
                                                newStatuses.splice(idx, 1);
                                                setFileStatuses(newStatuses);
                                            }}
                                            className="text-slate-400 hover:text-red-500 text-lg px-2"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-100 shrink-0">
                    <div className="text-sm text-slate-500">
                        已添加: <strong>{files.length}</strong> 个文件 
                        {successCount > 0 && <span className="ml-2 text-green-600">(成功: {successCount})</span>}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} disabled={processing} className="px-4 py-2 rounded text-slate-600 hover:bg-slate-100 text-sm font-medium">关闭</button>
                        <button 
                            onClick={startProcessing}
                            disabled={files.length === 0 || processing}
                            className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {processing ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    正在智能处理中...
                                </>
                            ) : '🚀 开始批量解析与建档'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Batch Import Modal (CSV/Excel) ---
const BatchImportModal = ({ onClose, onComplete }: { onClose: () => void, onComplete: () => void }) => {
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);
    
    // Sample Template Generator
    const downloadTemplate = () => {
        // Changed to: 部门、体检编号、姓名、性别、年龄、联系电话、体检结果
        const headers = [['部门', '体检编号', '姓名', '性别', '年龄', '联系电话', '体检结果']];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, "健康档案导入模板.xlsx");
    };

    const handleImport = async () => {
        if (!file) return;
        setImporting(true);
        setLogs(['🚀 开始解析文件...']);
        setProgress(0);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet);
            
            if (jsonData.length === 0) {
                setLogs(prev => [...prev, '❌ 文件为空或格式不正确']);
                setImporting(false);
                return;
            }

            setLogs(prev => [...prev, `📋 解析成功，共发现 ${jsonData.length} 条记录，开始导入...`]);

            let successCount = 0;
            let failCount = 0;

            // Sequential processing to allow UI updates and prevent DB rate limits
            for (let i = 0; i < jsonData.length; i++) {
                const row: any = jsonData[i];
                // Map based on template: 部门、体检编号、姓名、性别、年龄、联系电话、体检结果
                const name = row['姓名'];
                const id = row['体检编号'];
                const resultText = row['体检结果'];

                if (!name || !id) {
                    setLogs(prev => [...prev, `⚠️ 第 ${i+1} 行跳过：缺少姓名或体检编号`]);
                    failCount++;
                    continue;
                }

                try {
                    setLogs(prev => [...prev, `🔄 正在处理: ${name}...`]);

                    // 1. Construct Base Profile from Excel (Source of Truth)
                    const excelProfile = {
                        checkupId: String(id),
                        name: String(name),
                        gender: row['性别'] || '男',
                        age: Number(row['年龄']) || 0,
                        department: row['部门'] || '待定',
                        phone: row['联系电话'] ? String(row['联系电话']) : '',
                        checkupDate: new Date().toISOString().split('T')[0]
                    };

                    let record: HealthRecord;
                    let assessment: HealthAssessment;
                    let schedule: any[];

                    // 2. AI Analysis if '体检结果' exists
                    if (resultText && String(resultText).trim().length > 5) {
                         setLogs(prev => [...prev, `   ↳ 🤖 AI正在分析体检结果...`]);
                         
                         // Parse structure
                         const parsed = await parseHealthDataFromText(String(resultText));
                         
                         // Merge: Excel profile overrides parsed profile
                         record = {
                             ...parsed,
                             profile: {
                                 ...parsed.profile, // Keep parsed fields like dob if exists
                                 ...excelProfile    // Overwrite with Excel constants
                             }
                         };
                         
                         // Generate AI Assessment
                         assessment = await generateHealthAssessment(record);
                         schedule = generateFollowUpSchedule(assessment);
                    } else {
                        // 3. Fallback: Skeleton Record (No Result Text)
                        setLogs(prev => [...prev, `   ↳ ℹ️ 无详细体检结果，仅创建基础档案`]);
                        
                        record = {
                            profile: excelProfile,
                            checkup: {
                                basics: {},
                                labBasic: { liver: {}, lipids: {}, renal: {}, bloodRoutine: {}, glucose: {}, urineRoutine: {}, thyroidFunction: {} },
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
                                mentalScales: {},
                                mental: {},
                                needs: {}
                            }
                        };
                        
                        assessment = {
                            riskLevel: RiskLevel.GREEN,
                            isCritical: false,
                            criticalWarning: null,
                            summary: '批量导入档案 (基础信息)，待完善详细体检数据。',
                            risks: { red: [], yellow: [], green: [] },
                            managementPlan: { dietary: [], exercise: [], medication: [], monitoring: [] },
                            followUpPlan: { frequency: '6个月', nextCheckItems: ['常规健康复查'] }
                        };

                        schedule = [{
                            id: `sch_${Date.now()}_${i}`,
                            date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +6 months
                            status: 'pending' as const,
                            riskLevelAtSchedule: RiskLevel.GREEN,
                            focusItems: ['常规复查']
                        }];
                    }

                    // 4. Save to DB
                    const res = await saveArchive(record, assessment, schedule);
                    
                    if (res.success) {
                        successCount++;
                        setLogs(prev => [...prev, `   ✅ 建档成功`]);
                    } else {
                        setLogs(prev => [...prev, `   ❌ 失败: ${res.message}`]);
                        failCount++;
                    }
                } catch (e: any) {
                    setLogs(prev => [...prev, `❌ 处理行 ${i+1} 异常: ${e.message}`]);
                    failCount++;
                }
                
                // Update Progress & Delay slightly
                setProgress(Math.round(((i + 1) / jsonData.length) * 100));
                await new Promise(r => setTimeout(r, 100));
            }

            setLogs(prev => [...prev, `🏁 导入完成！成功: ${successCount}, 失败: ${failCount}`]);
            setTimeout(() => {
                if (successCount > 0) onComplete();
            }, 1500);

        } catch (e: any) {
            setLogs(prev => [...prev, `❌ 文件解析致命错误: ${e.message}`]);
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[80] backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-scaleIn">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">📂 批量建档 (Excel/CSV)</h3>
                        <p className="text-xs text-slate-500 mt-1">支持上传 .xlsx, .xls 文件快速创建档案</p>
                    </div>
                    {!importing && <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>}
                </div>

                <div className="space-y-4">
                    {/* Step 1: Download Template */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex justify-between items-center">
                        <div className="text-sm text-blue-800">
                            <strong>第一步：</strong> 下载标准Excel模板
                            <p className="text-xs text-blue-600 mt-1">请严格按照模板格式填写，勿修改表头</p>
                        </div>
                        <button 
                            onClick={downloadTemplate}
                            className="bg-white border border-blue-300 text-blue-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-100 shadow-sm"
                        >
                            ⬇️ 下载模板
                        </button>
                    </div>

                    {/* Step 2: Upload */}
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
                        <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv" 
                            onChange={e => setFile(e.target.files?.[0] || null)}
                            className="hidden" 
                            id="batch-upload-input"
                            disabled={importing}
                        />
                        <label htmlFor="batch-upload-input" className="cursor-pointer flex flex-col items-center">
                            <span className="text-4xl mb-2">📄</span>
                            {file ? (
                                <span className="font-bold text-teal-700">{file.name}</span>
                            ) : (
                                <span className="text-slate-500 text-sm">点击选择 Excel 文件上传</span>
                            )}
                        </label>
                    </div>

                    {/* Progress & Logs */}
                    {(importing || logs.length > 0) && (
                        <div className="bg-slate-900 rounded-lg p-4 text-xs font-mono text-green-400 h-40 overflow-y-auto shadow-inner">
                            {logs.map((log, i) => <div key={i}>{log}</div>)}
                            <div ref={el => el?.scrollIntoView({ behavior: 'smooth' })}></div>
                        </div>
                    )}
                    
                    {importing && (
                         <div className="w-full bg-slate-200 rounded-full h-2.5">
                            <div className="bg-teal-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                         </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                    <button onClick={onClose} disabled={importing} className="px-4 py-2 rounded text-slate-600 hover:bg-slate-100 text-sm font-medium">关闭</button>
                    <button 
                        onClick={handleImport}
                        disabled={!file || importing}
                        className="px-6 py-2 bg-teal-600 text-white font-bold rounded-lg shadow-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {importing ? `正在导入 ${progress}%` : '🚀 开始批量导入'}
                    </button>
                </div>
            </div>
        </div>
    );
};
