
import React, { useState, useEffect } from 'react';
import { processBatchUpload, fetchArchives, deleteArchive, HealthArchive } from '../services/dataService';
import { isSupabaseConfigured } from '../services/supabaseClient';

interface Props {
    onSelectPatient: (archive: HealthArchive, mode?: 'view' | 'edit' | 'followup') => void;
    onDataUpdate?: () => void;
    isAuthenticated: boolean; // Receive auth state from parent
}

export const AdminConsole: React.FC<Props> = ({ onSelectPatient, onDataUpdate, isAuthenticated }) => {
    // --- Admin Console Logic ---
    const [archives, setArchives] = useState<HealthArchive[]>([]);
    const [rawText, setRawText] = useState('');
    const [logs, setLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSqlHelp, setShowSqlHelp] = useState(false);

    const configured = isSupabaseConfigured();

    // --- Effects ---
    useEffect(() => {
        if (isAuthenticated) {
            loadData();
        }
    }, [isAuthenticated]);

    const loadData = async () => {
        if (!configured) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setFetchError(null);
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

    // --- Data Processing Handlers ---

    const handleBatchProcess = async () => {
        if (!rawText.trim()) return;
        setIsProcessing(true);
        setLogs(['🚀 开始处理...']);
        setProgress(0);

        await processBatchUpload(rawText, (log, prog) => {
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString().split(' ')[0]}] ${log}`]);
            setProgress(prog);
        });

        setIsProcessing(false);
        loadData(); 
        if (onDataUpdate) onDataUpdate();
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

    const upcomingTasks = getUpcomingTasks();
    const filteredArchives = archives.filter(archive => {
        const term = searchTerm.toLowerCase();
        return (
            (archive.name || '').toLowerCase().includes(term) ||
            (archive.checkup_id || '').toLowerCase().includes(term) ||
            (archive.phone || '').toLowerCase().includes(term)
        );
    });

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

    // --- Access Denied State ---
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

    // --- Render Console (Only if Logged In) ---
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
                            <h3 className="text-white font-bold text-lg">🛠️ 数据库初始化脚本</h3>
                            <p className="text-sm text-slate-400">请复制以下 SQL 代码，在 Supabase Dashboard 的 SQL Editor 中运行以创建必要的表结构。</p>
                        </div>
                        <button onClick={() => setShowSqlHelp(false)} className="text-slate-400 hover:text-white">✕</button>
                    </div>
                    <pre className="bg-black/50 p-4 rounded overflow-x-auto text-xs font-mono text-green-400 border border-slate-700">
{`-- 1. 启用 UUID 扩展
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
  history_versions jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. 创建索引加速查询
create index if not exists health_archives_checkup_id_idx on public.health_archives (checkup_id);`}
                    </pre>
                </div>
            )}

            {/* Upcoming Follow-ups Alert Section (Next 7 Days) */}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Panel: Batch Operations */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">📝 智能数据录入</h3>
                            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded border border-teal-200">AI Powered</span>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-xs text-slate-500 leading-relaxed">
                                粘贴体检报告或健康问卷文本（支持批量粘贴，以 "体检编号" 分隔）。
                                系统将自动解析、评估并存入数据库。如果编号已存在，将自动更新并归档旧数据。
                            </p>
                            <textarea
                                className="w-full h-40 p-3 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none resize-none bg-slate-50"
                                placeholder="在此处粘贴文本..."
                                value={rawText}
                                onChange={e => setRawText(e.target.value)}
                            ></textarea>
                            
                            {isProcessing && (
                                <div className="space-y-2 bg-slate-900 rounded-lg p-3">
                                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                                        <span>正在处理</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-teal-400 h-1.5 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                    </div>
                                    <div className="h-20 overflow-y-auto font-mono text-xs text-green-400 space-y-1 scrollbar-thin">
                                        {logs.map((log, i) => <div key={i}>&gt; {log}</div>)}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleBatchProcess}
                                disabled={isProcessing || !rawText}
                                className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {isProcessing ? <span className="animate-spin">⏳</span> : '⚡'} 
                                {isProcessing ? 'AI 处理中...' : '开始解析并存入数据库'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Data Grid */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[600px]">
                        {/* Toolbar */}
                        <div className="px-5 py-4 border-b border-slate-100 flex gap-4 items-center">
                             <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                                <input 
                                    type="text" 
                                    placeholder="搜索姓名、电话、编号..." 
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 transition-colors"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                             </div>
                             <div className="text-xs text-slate-400">
                                共 {filteredArchives.length} 条
                             </div>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 sticky top-0 z-10 text-slate-500 font-medium">
                                    <tr>
                                        <th className="px-5 py-3 border-b border-slate-200">基本信息</th>
                                        <th className="px-5 py-3 border-b border-slate-200">风险等级</th>
                                        <th className="px-5 py-3 border-b border-slate-200">部门/电话</th>
                                        <th className="px-5 py-3 border-b border-slate-200 text-right">管理操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        <tr><td colSpan={4} className="p-10 text-center text-slate-400">正在从 Supabase 加载数据...</td></tr>
                                    ) : filteredArchives.length === 0 ? (
                                        <tr><td colSpan={4} className="p-10 text-center text-slate-400">暂无数据，请在左侧录入</td></tr>
                                    ) : (
                                        filteredArchives.map(arch => (
                                            <tr key={arch.id} className="hover:bg-teal-50/30 group transition-colors">
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
                                                <td className="px-5 py-3 text-right">
                                                    <div className="flex justify-end gap-2 opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => onSelectPatient(arch, 'view')}
                                                            className="px-2 py-1 text-xs font-bold text-teal-600 hover:bg-teal-50 rounded border border-transparent hover:border-teal-100 transition-colors"
                                                            title="查看评估报告与随访"
                                                        >
                                                            查看
                                                        </button>
                                                        <button 
                                                            onClick={() => onSelectPatient(arch, 'edit')}
                                                            className="px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 transition-colors"
                                                            title="修改档案数据"
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
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
