import React, { useState, useEffect } from 'react';
import { processBatchUpload, fetchArchives, HealthArchive } from '../services/dataService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

    const loadData = async () => {
        setLoading(true);
        const data = await fetchArchives();
        setArchives(data);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
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
  risk_level text,
  survey_data jsonb,
  assessment_data jsonb,
  follow_up_schedule jsonb,
  created_at timestamptz default now()
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Batch Processing */}
                <div className="lg:col-span-1 space-y-6">
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

                    <div className="bg-white rounded-xl shadow border border-slate-100 p-4">
                        <h3 className="font-bold text-slate-700 mb-4">部门健康概览</h3>
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={deptStats} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10}} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#64748b" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Right Column: Data Table */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden min-h-[500px] flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">🗂️ 健康档案库</h3>
                            <div className="flex gap-2">
                                <input type="text" placeholder="搜索姓名/编号..." className="border border-slate-300 rounded px-3 py-1 text-sm outline-none focus:border-teal-500" />
                                <button onClick={loadData} className="text-slate-500 hover:text-teal-600">
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
                                    ) : archives.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-10 text-slate-400">暂无档案数据</td></tr>
                                    ) : (
                                        archives.map(archive => (
                                            <tr key={archive.id} className="hover:bg-slate-50 group transition-colors">
                                                <td className="px-6 py-3">
                                                    <div className="font-bold text-slate-800">{archive.name}</div>
                                                    <div className="text-xs text-slate-400">{archive.checkup_id}</div>
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
                                                <td className="px-6 py-3">
                                                    <button 
                                                        onClick={() => onSelectPatient(archive)}
                                                        className="text-teal-600 hover:text-teal-800 font-medium hover:underline"
                                                    >
                                                        查看详情
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex justify-between">
                             <span>显示最近 {archives.length} 条记录</span>
                             <span>数据来源: Supabase Cloud</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};