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

// --- Types ---
interface AdminConsoleProps {
  isAuthenticated: boolean;
  onSelectPatient: (archive: HealthArchive, mode: 'view' | 'edit' | 'followup') => void;
  onDataUpdate: () => void;
}

// --- Edit Profile Modal ---
const EditProfileModal = ({ archive, onClose, onSave }: { archive: HealthArchive, onClose: () => void, onSave: (p: HealthProfile) => void }) => {
    const [form, setForm] = useState<HealthProfile>({ ...archive.health_record.profile });

    return (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[60] backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
                <h3 className="text-xl font-bold mb-4">编辑人员信息</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">姓名</label>
                        <input className="w-full border rounded p-2" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">体检编号</label>
                            <input className="w-full border rounded p-2" value={form.checkupId} onChange={e => setForm({...form, checkupId: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">联系电话</label>
                            <input className="w-full border rounded p-2" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">部门</label>
                            <input className="w-full border rounded p-2" value={form.department} onChange={e => setForm({...form, department: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">年龄</label>
                            <input type="number" className="w-full border rounded p-2" value={form.age || ''} onChange={e => setForm({...form, age: Number(e.target.value)})} />
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded bg-slate-100 text-slate-600">取消</button>
                    <button onClick={() => onSave(form)} className="px-4 py-2 rounded bg-teal-600 text-white font-bold">保存</button>
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
        // Updated headers: 部门、体检编号、姓名、性别、年龄、联系电话、体检结果
        const headers = [['部门', '体检编号', '姓名', '性别', '年龄', '联系电话', '体检结果']];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, "健康档案批量导入模板.xlsx");
    };

    const handleImport = async () => {
        if (!file) return;
        setImporting(true);
        setLogs(['🚀 开始读取并解析文件...']);
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

            setLogs(prev => [...prev, `📋 读取成功，共发现 ${jsonData.length} 条记录，准备进行处理...`]);

            let successCount = 0;
            let failCount = 0;

            // Sequential processing to allow UI updates and prevent DB rate limits
            for (let i = 0; i < jsonData.length; i++) {
                const row: any = jsonData[i];
                
                // Map based on new headers: 部门、体检编号、姓名、性别、年龄、联系电话、体检结果
                const dept = row['部门'];
                const id = row['体检编号'];
                const name = row['姓名'];
                const gender = row['性别'];
                const age = row['年龄'];
                const phone = row['联系电话'];
                const resultText = row['体检结果'];

                if (!name || !id) {
                    setLogs(prev => [...prev, `⚠️ 第 ${i+1} 行跳过：缺少姓名或体检编号`]);
                    failCount++;
                    continue;
                }

                try {
                    let recordToSave: HealthRecord;
                    let assessmentToSave: HealthAssessment;

                    // Decision: AI Analysis vs Fast Import
                    if (resultText && String(resultText).length > 5) {
                        setLogs(prev => [...prev, `🤖 [${name}] 正在进行 AI 深度分析体检结果...`]);
                        
                        // Construct context for AI
                        const context = `
                        部门: ${dept || ''}
                        体检编号: ${id}
                        姓名: ${name}
                        性别: ${gender || ''}
                        年龄: ${age || ''}
                        电话: ${phone || ''}
                        
                        体检结果/医学结论:
                        ${resultText}
                        `;

                        // 1. AI Parse Structure
                        recordToSave = await parseHealthDataFromText(context);
                        
                        // 2. Override Profile with Excel Data (Source of Truth)
                        recordToSave.profile.checkupId = String(id);
                        recordToSave.profile.name = String(name);
                        if (dept) recordToSave.profile.department = String(dept);
                        if (phone) recordToSave.profile.phone = String(phone);
                        if (gender) recordToSave.profile.gender = String(gender);
                        if (age) recordToSave.profile.age = Number(age);
                        if (!recordToSave.profile.checkupDate) recordToSave.profile.checkupDate = new Date().toISOString().split('T')[0];

                        // 3. AI Generate Assessment
                        assessmentToSave = await generateHealthAssessment(recordToSave);

                    } else {
                        setLogs(prev => [...prev, `⚡ [${name}] 快速导入 (无详细结果)...`]);
                        
                        // Default Manual Creation
                        recordToSave = {
                            profile: {
                                checkupId: String(id),
                                name: String(name),
                                gender: gender || '男',
                                age: Number(age) || 0,
                                department: dept || '待定',
                                phone: phone ? String(phone) : '',
                                checkupDate: new Date().toISOString().split('T')[0]
                            },
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

                        assessmentToSave = {
                            riskLevel: RiskLevel.GREEN,
                            isCritical: false,
                            criticalWarning: null,
                            summary: '批量导入档案，等待完善详细体检数据与问卷。',
                            risks: { red: [], yellow: [], green: [] },
                            managementPlan: { dietary: [], exercise: [], medication: [], monitoring: [] },
                            followUpPlan: { frequency: '6个月', nextCheckItems: ['常规健康复查'] }
                        };
                    }

                    // 4. Generate Schedule
                    const schedule = generateFollowUpSchedule(assessmentToSave);

                    // 5. Save to DB
                    const res = await saveArchive(recordToSave, assessmentToSave, schedule);
                    
                    if (res.success) {
                        successCount++;
                    } else {
                        setLogs(prev => [...prev, `❌ 导入 [${name}] 失败: ${res.message}`]);
                        failCount++;
                    }
                } catch (e: any) {
                    setLogs(prev => [...prev, `❌ 处理 [${name}] 异常: ${e.message}`]);
                    failCount++;
                }
                
                // Update Progress
                setProgress(Math.round(((i + 1) / jsonData.length) * 100));
                // Small delay to allow UI render
                await new Promise(r => setTimeout(r, 50));
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

// --- Main Admin Console ---
export const AdminConsole: React.FC<AdminConsoleProps> = ({ isAuthenticated, onSelectPatient, onDataUpdate }) => {
    const [archives, setArchives] = useState<HealthArchive[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Modal States
    const [editingArchive, setEditingArchive] = useState<HealthArchive | null>(null);
    const [criticalArchive, setCriticalArchive] = useState<HealthArchive | null>(null);
    const [showBatchImport, setShowBatchImport] = useState(false);

    useEffect(() => {
        loadData();
    }, [isAuthenticated]);

    const loadData = async () => {
        setLoading(true);
        const data = await fetchArchives();
        setArchives(data);
        setLoading(false);
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`确定要永久删除 ${name} 的健康档案吗？`)) {
            const success = await deleteArchive(id);
            if (success) {
                alert('删除成功');
                loadData();
                onDataUpdate();
            } else {
                alert('删除失败');
            }
        }
    };

    const handleSaveProfile = async (profile: HealthProfile) => {
        if (!editingArchive) return;
        const res = await updateArchiveProfile(editingArchive.id, profile);
        if (res.success) {
            setEditingArchive(null);
            loadData();
            onDataUpdate();
        } else {
            alert('更新失败: ' + res.message);
        }
    };

    const handleSaveCritical = async (record: CriticalTrackRecord) => {
        if (!criticalArchive) return;
        const res = await updateCriticalTrack(criticalArchive.checkup_id, record);
        if (res.success) {
            setCriticalArchive(null);
            loadData();
            onDataUpdate();
        } else {
            alert('更新失败: ' + res.message);
        }
    };

    const handleBatchComplete = () => {
        setShowBatchImport(false);
        loadData();
        onDataUpdate();
    };

    // Filters
    const filteredArchives = archives.filter(a => 
        (a.name?.includes(search) || a.checkup_id?.includes(search) || a.department?.includes(search))
    );

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <div className="text-6xl mb-4">🔒</div>
                <h2 className="text-xl font-bold">需要管理员权限</h2>
                <p>请点击右上角登录后访问管理控制台</p>
            </div>
        );
    }

    if (!isSupabaseConfigured()) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-red-400">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold">数据库未配置</h2>
                <p>请检查 .env 环境变量 VITE_SUPABASE_URL 和 VITE_SUPABASE_KEY</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 h-full flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">档案管理控制台</h2>
                    <p className="text-sm text-slate-500">共 {archives.length} 份档案，{archives.filter(a => a.risk_level === 'RED').length} 高危</p>
                </div>
                <div className="flex gap-4">
                    <input 
                        type="text" 
                        placeholder="🔍 搜索姓名、编号、部门" 
                        className="border border-slate-300 rounded-lg px-4 py-2 w-64 focus:ring-2 focus:ring-teal-500 outline-none"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <button 
                        onClick={() => setShowBatchImport(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-sm"
                    >
                        📂 批量导入
                    </button>
                    <button 
                        onClick={loadData} 
                        className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg font-bold hover:bg-slate-50"
                    >
                        🔄 刷新
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                {loading ? (
                    <div className="text-center py-20 text-slate-400">加载中...</div>
                ) : (
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                            <tr>
                                <th className="p-3 border-b">状态</th>
                                <th className="p-3 border-b">体检编号</th>
                                <th className="p-3 border-b">姓名</th>
                                <th className="p-3 border-b">部门</th>
                                <th className="p-3 border-b">联系方式</th>
                                <th className="p-3 border-b">更新时间</th>
                                <th className="p-3 border-b text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredArchives.map(archive => {
                                const isCriticalActive = archive.critical_track && archive.critical_track.status !== 'archived';
                                return (
                                    <tr key={archive.id} className="hover:bg-slate-50 group border-b border-slate-100 last:border-0">
                                        <td className="p-3">
                                            <div className="flex gap-2">
                                                <span className={`px-2 py-0.5 rounded text-xs border font-bold ${
                                                    archive.risk_level === 'RED' ? 'bg-red-50 text-red-600 border-red-100' : 
                                                    archive.risk_level === 'YELLOW' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 
                                                    'bg-green-50 text-green-600 border-green-100'
                                                }`}>
                                                    {archive.risk_level === 'RED' ? '高危' : archive.risk_level === 'YELLOW' ? '中危' : '低危'}
                                                </span>
                                                {archive.assessment_data.isCritical && (
                                                    <button 
                                                        onClick={() => setCriticalArchive(archive)}
                                                        className={`px-2 py-0.5 rounded text-xs border font-bold flex items-center gap-1 ${
                                                            isCriticalActive ? 'bg-red-600 text-white border-red-600 animate-pulse' : 'bg-red-50 text-red-600 border-red-200'
                                                        }`}
                                                    >
                                                        {isCriticalActive ? '🚨 处置中' : '⚠️ 危急值'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 font-mono text-slate-600">{archive.checkup_id}</td>
                                        <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                                            {archive.name}
                                            {archive.gender === '女' && <span className="text-pink-400 text-xs">♀</span>}
                                        </td>
                                        <td className="p-3 text-slate-600">{archive.department}</td>
                                        <td className="p-3 font-mono text-slate-500">{archive.phone || '-'}</td>
                                        <td className="p-3 text-slate-400 text-xs">
                                            {new Date(archive.updated_at || archive.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => onSelectPatient(archive, 'view')} className="text-teal-600 hover:bg-teal-50 px-2 py-1 rounded">查看</button>
                                                <button onClick={() => onSelectPatient(archive, 'followup')} className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded">随访</button>
                                                <button onClick={() => setEditingArchive(archive)} className="text-slate-600 hover:bg-slate-100 px-2 py-1 rounded">编辑</button>
                                                <button onClick={() => handleDelete(archive.id, archive.name)} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded">删除</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredArchives.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-10 text-center text-slate-400">未找到匹配的档案</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modals */}
            {editingArchive && (
                <EditProfileModal 
                    archive={editingArchive} 
                    onClose={() => setEditingArchive(null)} 
                    onSave={handleSaveProfile} 
                />
            )}

            {criticalArchive && (
                <CriticalHandleModal 
                    archive={criticalArchive} 
                    onClose={() => setCriticalArchive(null)} 
                    onSave={handleSaveCritical} 
                />
            )}

            {showBatchImport && (
                <BatchImportModal 
                    onClose={() => setShowBatchImport(false)} 
                    onComplete={handleBatchComplete} 
                />
            )}
        </div>
    );
};