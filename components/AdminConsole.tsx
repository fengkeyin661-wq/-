
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
    const [opsStats, setOpsStats] = useState({ totalResources: 0, activeDoctors: 0, pendingSignings: 0, eventSignups: 0 });
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'updated_at', direction: 'desc' });
    const [filterRisk, setFilterRisk] = useState<string>('ALL');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [skipFilled, setSkipFilled] = useState(true); 

    const [editingArchive, setEditingArchive] = useState<HealthArchive | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<HealthProfile | null>(null);
    const [criticalModalArchive, setCriticalModalArchive] = useState<HealthArchive | null>(null);
    const [isSmartBatchModalOpen, setIsSmartBatchModalOpen] = useState(false);
    const [smartBatchFiles, setSmartBatchFiles] = useState<File[]>([]);
    const [smartBatchLogs, setSmartBatchLogs] = useState<string[]>([]);
    const [isSmartBatchProcessing, setIsSmartBatchProcessing] = useState(false);
    const questionnaireImportRef = useRef<HTMLInputElement>(null);

    const configured = isSupabaseConfigured();

    useEffect(() => {
        if (isAuthenticated) { loadData(); loadOperationsData(); }
    }, [isAuthenticated]);

    const loadData = async () => {
        if (!configured) { setLoading(false); return; }
        setLoading(true); setFetchError(null); setSelectedIds(new Set());
        try { const data = await fetchArchives(); setArchives(data); }
        catch (error: unknown) { setFetchError(String(error)); }
        finally { setLoading(false); }
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
        } catch (e) { console.error("Ops Stats Failed", e); }
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`确定要删除 ${name} 的健康档案吗？此操作不可恢复。`)) {
            const success = await deleteArchive(id);
            if (success) { loadData(); if (onDataUpdate) onDataUpdate(); }
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        if (confirm(`确定要批量删除选中的 ${selectedIds.size} 份健康档案吗？`)) {
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

    const filteredArchives = useMemo(() => {
        let result = archives.filter(archive => {
            const term = searchTerm.toLowerCase();
            const matchSearch = ((archive.name || '').toLowerCase().includes(term) || (archive.checkup_id || '').toLowerCase().includes(term) || (archive.phone || '').toLowerCase().includes(term));
            
            let matchRisk = false;
            if (filterRisk === 'ALL') matchRisk = true;
            else if (filterRisk === 'CRITICAL') {
                const track = archive.critical_track;
                if (!track || track.status === 'archived') return false;
                
                // BUSINESS RULE: Center head view prioritizes:
                // 1. Initial follow-up (within 24h deadline)
                // 2. Secondary follow-up (within 7-day proximity or overdue)
                if (track.status === 'pending_initial') return true;
                if (track.status === 'pending_secondary' && track.secondary_due_date) {
                    const today = new Date(); today.setHours(0,0,0,0);
                    const due = new Date(track.secondary_due_date);
                    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return diffDays <= 7;
                }
                return false;
            }
            else matchRisk = archive.risk_level === filterRisk;
            
            return matchSearch && matchRisk;
        });
        
        if (sortConfig) {
            result.sort((a, b) => {
                let aVal: any = '', bVal: any = '';
                switch (sortConfig.key) {
                    case 'updated_at': aVal = new Date(a.updated_at || a.created_at).getTime(); bVal = new Date(b.updated_at || b.created_at).getTime(); break;
                    case 'name': aVal = a.name; bVal = b.name; break;
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

    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 h-full flex flex-col overflow-hidden animate-fadeIn">
            {/* Dashboard Stats */}
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
                    <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none bg-white font-bold" value={filterRisk} onChange={e => setFilterRisk(e.target.value)}>
                        <option value="ALL">全部档案</option>
                        <option value="CRITICAL">🚨 紧急危急值(24h/7d)</option>
                        <option value="RED">🔴 高风险</option>
                        <option value="YELLOW">🟡 中风险</option>
                        <option value="GREEN">🟢 低风险</option>
                    </select>
                </div>
                <div className="flex gap-2 items-center">
                    <label className="flex items-center gap-2 cursor-pointer mr-2 select-none" title="若档案中问卷已有内容，则跳过不更新">
                        <input type="checkbox" checked={skipFilled} onChange={(e) => setSkipFilled(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
                        <span className="text-xs font-bold text-slate-600">跳过已完善问卷</span>
                    </label>
                    <button onClick={() => questionnaireImportRef.current?.click()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-1">📝 导入问卷更新</button>
                    <button onClick={() => setIsSmartBatchModalOpen(true)} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-teal-700 shadow-sm flex items-center gap-1">📂 智能建档导入</button>
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
                            <th className="p-4 cursor-pointer" onClick={() => handleSort('checkup_id')}>编号</th>
                            <th className="p-4 cursor-pointer" onClick={() => handleSort('name')}>姓名</th>
                            <th className="p-4">性别 / 年龄</th>
                            <th className="p-4">部门</th>
                            <th className="p-4 cursor-pointer" onClick={() => handleSort('risk_level')}>风险</th>
                            <th className="p-4 cursor-pointer" onClick={() => handleSort('updated_at')}>更新时间</th>
                            <th className="p-4 text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {loading ? <tr><td colSpan={8} className="p-10 text-center text-slate-400">加载中...</td></tr> : filteredArchives.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-slate-400">暂无符合条件的记录</td></tr> : filteredArchives.map((archive) => {
                            const isCritical = archive.assessment_data?.isCritical || (archive.assessment_data?.criticalWarning && archive.assessment_data.criticalWarning.includes('类'));
                            const track = archive.critical_track;
                            const isInitialPending = track?.status === 'pending_initial';
                            
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
                                        {isCritical && (
                                            <div 
                                                className={`text-[10px] px-1.5 py-0.5 rounded inline-block mt-1 cursor-pointer font-bold ${
                                                    track?.status === 'archived' ? 'bg-green-100 text-green-700' : 
                                                    isInitialPending ? 'bg-red-600 text-white animate-pulse' : 
                                                    'bg-orange-100 text-orange-700'
                                                }`} 
                                                onClick={(e) => { e.stopPropagation(); setCriticalModalArchive(archive); }}
                                            >
                                                {track?.status === 'archived' ? '已闭环' : isInitialPending ? '🚨 24h待初诊' : '📅 待二次回访'}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-slate-600">{archive.gender} / {archive.age}</td>
                                    <td className="p-4 text-slate-600">{archive.department}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                            archive.risk_level === 'RED' ? 'bg-red-50 text-red-600 border-red-200' : 
                                            archive.risk_level === 'YELLOW' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 
                                            'bg-green-50 text-green-600 border-green-200'
                                        }`}>
                                            {archive.risk_level === 'RED' ? '高风险' : archive.risk_level === 'YELLOW' ? '中风险' : '低风险'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-xs text-slate-400 font-mono">{new Date(archive.updated_at || archive.created_at).toLocaleDateString()}</td>
                                    <td className="p-4 flex justify-center gap-2 opacity-80 group-hover:opacity-100">
                                        <button onClick={(e) => { e.stopPropagation(); onSelectPatient(archive, 'assessment'); }} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded hover:bg-indigo-100 font-bold">查看</button>
                                        <button onClick={(e) => { e.stopPropagation(); handleEditClick(archive); }} className="text-xs bg-slate-50 text-slate-600 px-3 py-1.5 rounded hover:bg-slate-100">编辑</button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(archive.id, archive.name); }} className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100">删除</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            {/* Modals */}
            {isEditModalOpen && editForm && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-scaleIn">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">编辑档案信息</h3>
                        <div className="space-y-4">
                            <InputField label="体检编号" value={editForm.checkupId} onChange={(v:any) => setEditForm({...editForm!, checkupId: v})} />
                            <InputField label="姓名" value={editForm.name} onChange={(v:any) => setEditForm({...editForm!, name: v})} />
                            <div className="grid grid-cols-2 gap-4">
                                <SelectField label="性别" options={['男', '女']} value={editForm.gender} onChange={(v:any) => setEditForm({...editForm!, gender: v})} />
                                <InputField label="年龄" type="number" value={editForm.age} onChange={(v:any) => setEditForm({...editForm!, age: Number(v)})} />
                            </div>
                            <InputField label="部门" value={editForm.department} onChange={(v:any) => setEditForm({...editForm!, department: v})} />
                            <InputField label="电话" value={editForm.phone} onChange={(v:any) => setEditForm({...editForm!, phone: v})} />
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm">取消</button>
                            <button onClick={handleSaveProfile} className="px-6 py-2 bg-teal-600 text-white font-bold rounded hover:bg-teal-700 text-sm shadow">保存修改</button>
                        </div>
                    </div>
                </div>
            )}
            
            {criticalModalArchive && <CriticalHandleModal archive={criticalModalArchive} onClose={() => setCriticalModalArchive(null)} onSave={handleCriticalSave} />}
        </div>
    );
};

const InputField = ({ label, value, onChange, type = "text" }: any) => (
    <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
        <input className="w-full border p-2 rounded bg-slate-50 focus:bg-white transition-colors outline-none text-sm" type={type} value={value || ''} onChange={e => onChange(e.target.value)} />
    </div>
);

const SelectField = ({ label, value, onChange, options }: any) => (
    <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
        <select className="w-full border p-2 rounded bg-slate-50 text-sm" value={value || ''} onChange={e => onChange(e.target.value)}>
            {options.map((o:string) => <option key={o} value={o}>{o}</option>)}
        </select>
    </div>
);
