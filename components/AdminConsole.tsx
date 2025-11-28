
import React, { useState, useEffect } from 'react';
import { processBatchUpload, fetchArchives, deleteArchive, HealthArchive } from '../services/dataService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Props {
    onSelectPatient: (archive: HealthArchive) => void;
}

export const AdminConsole: React.FC<Props> = ({ onSelectPatient }) => {
    const [archives, setArchives] = useState<HealthArchive[]>([]);
    const [rawText, setRawText] = useState('');
    const [logs, setLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const loadData = async () => {
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

    useEffect(() => {
        if (isSupabaseConfigured()) {
            loadData();
        } else {
            setLoading(false);
        }
    }, []);

    const handleBatchProcess = async () => {
        if (!rawText.trim()) return;
        setIsProcessing(true);
        setLogs(['🚀 开始批量处理任务...']);
        setProgress(0);

        await processBatchUpload(rawText, (log, prog) => {
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
            setProgress(prog);
        });

        setIsProcessing(false);
        loadData(); // Refresh list
    };
    
    const handleDelete = async (id: string, name: string) => {
        if (confirm(`确定要删除 ${name} 的健康档案吗？此操作不可恢复。`)) {
            const success = await deleteArchive(id);
            if (success) {
                loadData();
            } else {
                alert('删除失败，请重试');
            }
        }
    };

    // Filter Logic
    const filteredArchives = archives.filter(archive => {
        const term = searchTerm.toLowerCase();
        return (
            (archive.name || '').toLowerCase().includes(term) ||
            (archive.checkup_id || '').toLowerCase().includes(term)
        );
    });

    // Stats Calculation
    const riskStats = [
        { name: '高危 (红)', value: archives.filter(a => a.risk_level === 'RED').length, color: '#ef4444' },
        { name: '中危 (黄)', value: archives.filter(a => a.risk_level === 'YELLOW').length, color: '#eab308' },
        { name: '低危 (绿)', value: archives.filter(a => a.risk_level === 'GREEN').length, color: '#22c55e' },
    ];

    const deptStatsMap = archives.reduce((acc, curr) => {
        const dept = curr.department || '未知部门';
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    const deptStats = Object.keys(deptStatsMap).map(k => ({ name: k, count: deptStatsMap[k] }));

    // Follow-up Reminders Logic
    const getReminders = () => {
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);

        const tasks: { archive: HealthArchive, date: string, daysDiff: number }[] = [];

        archives.forEach(arch => {
            if (arch.follow_up_schedule) {
                arch.follow_up_schedule.forEach(sch => {
                    if (sch.status === 'pending') {
                        const dueDate = new Date(sch.date);
                        const diffTime = dueDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                        
                        // Show overdue or upcoming within 7 days
                        if (diffDays <= 7) {
                            tasks.push({ archive: arch, date: sch.date, daysDiff: diffDays });
                        }
                    }
                });
            }
        });

        // Sort by urgency
        return tasks.sort((a, b) => a.daysDiff - b.daysDiff);
    };

    const reminders = getReminders();

    if (!isSupabaseConfigured()) {
        return (
            <div className="bg-red-50 border border-red-200 p-8 rounded-xl text-center">
                <h2 className="text-xl font-bold text-red-700 mb-2">Supabase 未配置</h2>
                <p className="text-red-600 mb-4">
                    健康管理控制台需要连接 Supabase 数据库才能工作。请在 index.html 中配置 SUPABASE_URL 和 SUPABASE_KEY。
                </p>
                <code className="bg-white p-2 rounded block text-left text-xs text-slate-500 overflow-auto">
                    {`// SQL 建表语句
create table public.health_archives (
  id uuid default gen_random_uuid() primary key,
  checkup_id text not null unique,
  name text,
  department text,
  gender text,
  age int,
  risk_level text,
  survey_data jsonb,
  assessment_data jsonb,
  follow_up_schedule jsonb,
  follow_ups jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);`}
                </code>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <p className="text-slate-500 text-sm">总建档人数</p>
                    <p className="text-3xl font-bold text-slate-800">{archives.length}</p>
                 </div>
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <p className="text-slate-500 text-sm">高危人群占比</p>
                    <p className="text-3xl font-bold text-red-500">
                        {archives.length ? ((riskStats[0].value / archives.length) * 100).toFixed(1) : 0}%
                    </p>
                 </div>
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 col-span-2">
                    <p className="text-slate-500 text-sm mb-2">风险分布</p>
                    <div className="h-10 flex rounded-full overflow-hidden">
                        {riskStats.map(stat => (
                            <div key={stat.name} style={{ width: `${(stat.value / (archives.length || 1)) * 100}%`, backgroundColor: stat.color }} title={stat.name}></div>
                        ))}
                    </div>
                 </div>
            </div>

            {fetchError && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                        <h3 className="font-bold text-red-800">数据库连接错误</h3>
                        <p className="text-sm text-red-600 mb-2">{fetchError}</p>
                        <p className="text-xs text-slate-500">提示: 请确保您已在 Supabase SQL Editor 中运行了建表语句，并且 "health_archives" 表存在。</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Batch Processing */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Reminder Widget */}
                    <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
                        <div className="bg-indigo-600 text-white px-4 py-3 flex justify-between items-center">
                            <h3 className="font-bold">📅 随访日程提醒</h3>
                            <span className="text-xs bg-indigo-500 px-2 py-1 rounded">未来7天</span>
                        </div>
                        <div className="p-0">
                            {reminders.length === 0 ? (
                                <div className="p-6 text-center text-slate-400 text-sm">暂无近期需要随访的任务</div>
                            ) : (
                                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                                    {reminders.map((item, idx) => (
                                        <div key={idx} className="p-3 hover:bg-slate-50 flex justify-between items-center cursor-pointer" onClick={() => onSelectPatient(item.archive)}>
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm">{item.archive.name}</div>
                                                <div className="text-xs text-slate-500">{item.archive.checkup_id}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-xs font-bold ${item.daysDiff < 0 ? 'text-red-500' : 'text-orange-500'}`}>
                                                    {item.daysDiff < 0 ? `逾期 ${Math.abs(item.daysDiff)} 天` : item.daysDiff === 0 ? '今天' : `${item.daysDiff} 天后`}
                                                </div>
                                                <div className="text-xs text-slate-400">{item.date}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
                        <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
                            <h3 className="font-bold">📤 批量数据处理</h3>
                            <span className="text-xs bg-slate-700 px-2 py-1 rounded">AI 驱动</span>
                        </div>
                        <div className="p-4 space-y-4">
                            <p className="text-xs text-slate-500">请粘贴多份体检报告文本。系统将自动分割、解析、评估并存入数据库。</p>
                            <textarea
                                className="w-full h-48 p-3 text-xs font-mono border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
                                placeholder="粘贴格式：
体检编号 1001 ... (报告内容)
体检编号 1002 ... (报告内容)"
                                value={rawText}
                                onChange={e => setRawText(e.target.value)}
                            ></textarea>
                            
                            {isProcessing && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span>处理进度</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div className="bg-teal-500 h-2 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                    </div>
                                    <div className="h-24 overflow-y-auto bg-slate-900 text-green-400 p-2 text-xs font-mono rounded">
                                        {logs.map((log, i) => <div key={i}>{log}</div>)}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleBatchProcess}
                                disabled={isProcessing || !rawText}
                                className="w-full bg-teal-600 text-white py-2 rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-lg shadow-teal-100"
                            >
                                {isProcessing ? '正在处理流水线...' : '开始批量建档与评估'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Data Table */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden min-h-[500px] flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                            <h3 className="font-bold text-lg text-slate-800">🗂️ 健康档案库</h3>
                            <div className="flex gap-2 w-full md:w-auto">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">🔍</span>
                                    <input 
                                        type="text" 
                                        placeholder="搜索姓名或体检编号..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 border border-slate-300 rounded px-3 py-1 text-sm outline-none focus:border-teal-500 w-full" 
                                    />
                                </div>
                                <button onClick={loadData} className="text-slate-500 hover:text-teal-600 bg-slate-100 px-3 py-1 rounded text-sm">
                                    🔄 刷新
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3">姓名/编号</th>
                                        <th className="px-6 py-3">部门</th>
                                        <th className="px-6 py-3">风险等级</th>
                                        <th className="px-6 py-3">建档日期</th>
                                        <th className="px-6 py-3">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr><td colSpan={5} className="text-center py-10 text-slate-400">加载数据中...</td></tr>
                                    ) : filteredArchives.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-10 text-slate-400">{searchTerm ? '未找到匹配的档案' : (fetchError ? '数据加载失败' : '暂无档案数据')}</td></tr>
                                    ) : (
                                        filteredArchives.map(archive => (
                                            <tr key={archive.id} className="hover:bg-slate-50 group transition-colors">
                                                <td className="px-6 py-3">
                                                    <div className="font-bold text-slate-800">{archive.name}</div>
                                                    <div className="text-xs text-slate-400 highlight">{archive.checkup_id}</div>
                                                </td>
                                                <td className="px-6 py-3 text-slate-600">{archive.department}</td>
                                                <td className="px-6 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                                                        archive.risk_level === 'RED' ? 'bg-red-100 text-red-700' :
                                                        archive.risk_level === 'YELLOW' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-green-100 text-green-700'
                                                    }`}>
                                                        <span className={`w-2 h-2 rounded-full ${
                                                            archive.risk_level === 'RED' ? 'bg-red-500' :
                                                            archive.risk_level === 'YELLOW' ? 'bg-yellow-500' :
                                                            'bg-green-500'
                                                        }`}></span>
                                                        {archive.risk_level === 'RED' ? '高危' : archive.risk_level === 'YELLOW' ? '中危' : '低危'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-slate-500 text-xs">
                                                    {new Date(archive.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-3 flex gap-2">
                                                    <button 
                                                        onClick={() => onSelectPatient(archive)}
                                                        className="text-white bg-teal-600 hover:bg-teal-700 px-3 py-1 rounded shadow-sm transition-colors text-xs"
                                                    >
                                                        查看详情
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(archive.id, archive.name)}
                                                        className="text-red-400 hover:text-red-600 px-2 text-xs"
                                                    >
                                                        删除
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex justify-between">
                             <span>显示 {filteredArchives.length} / {archives.length} 条记录</span>
                             <span>数据来源: Supabase Cloud</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
