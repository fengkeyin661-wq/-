
import React, { useState, useEffect } from 'react';
import { HealthArchive, fetchArchives, deleteArchive, updateArchiveProfile, updateCriticalTrack } from '../services/dataService';
import { CriticalTrackRecord, HealthProfile } from '../types';
import { CriticalHandleModal } from './CriticalHandleModal';

interface Props {
    isAuthenticated: boolean;
    onSelectPatient: (archive: HealthArchive, mode: 'view' | 'edit' | 'followup' | 'assessment') => void;
    onDataUpdate: () => void;
}

export const AdminConsole: React.FC<Props> = ({ isAuthenticated, onSelectPatient, onDataUpdate }) => {
    const [archives, setArchives] = useState<HealthArchive[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [riskFilter, setRiskFilter] = useState<'ALL' | 'RED' | 'YELLOW' | 'GREEN'>('ALL');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // Modals
    const [criticalModalArchive, setCriticalModalArchive] = useState<HealthArchive | null>(null);
    const [editingArchive, setEditingArchive] = useState<HealthArchive | null>(null);
    const [editForm, setEditForm] = useState<Partial<HealthProfile>>({});

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchArchives();
            setArchives(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!isAuthenticated) return alert("无权操作");
        if (window.confirm(`确定要删除档案 [${name}] 吗？此操作不可恢复。`)) {
            await deleteArchive(id);
            await loadData();
            onDataUpdate();
        }
    };

    const handleSelectRow = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleCriticalSave = async (record: CriticalTrackRecord) => {
        if (criticalModalArchive) {
            await updateCriticalTrack(criticalModalArchive.checkup_id, record);
            setCriticalModalArchive(null);
            await loadData();
            onDataUpdate();
        }
    };

    const handleEditClick = (archive: HealthArchive) => {
        setEditingArchive(archive);
        setEditForm({
            name: archive.name,
            gender: archive.gender,
            age: archive.age,
            phone: archive.phone,
            department: archive.department,
            checkupId: archive.checkup_id
        });
    };

    const handleEditSave = async () => {
        if (!editingArchive || !editForm.checkupId) return;
        const res = await updateArchiveProfile(editingArchive.id, editForm as HealthProfile);
        if (res.success) {
            setEditingArchive(null);
            await loadData();
            onDataUpdate();
        } else {
            alert("更新失败: " + res.message);
        }
    };

    const filteredArchives = archives.filter(a => {
        const matchSearch = (a.name?.includes(searchTerm) || a.checkup_id?.includes(searchTerm) || a.phone?.includes(searchTerm));
        const matchRisk = riskFilter === 'ALL' || a.risk_level === riskFilter;
        return matchSearch && matchRisk;
    });

    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden min-h-[600px] flex flex-col animate-fadeIn">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 justify-between items-center">
                <div className="flex items-center gap-4">
                    <h2 className="font-bold text-slate-800 text-lg">📁 档案管理控制台</h2>
                    <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">{archives.length}</span>
                </div>
                
                <div className="flex gap-3">
                    <select 
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                        value={riskFilter}
                        onChange={e => setRiskFilter(e.target.value as any)}
                    >
                        <option value="ALL">全部风险等级</option>
                        <option value="RED">🔴 高风险</option>
                        <option value="YELLOW">🟡 中风险</option>
                        <option value="GREEN">🟢 低风险</option>
                    </select>
                    <input 
                        type="text" 
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-64"
                        placeholder="搜索姓名/编号/手机号..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <button onClick={loadData} className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg" title="刷新">🔄</button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-100 text-slate-500 font-bold sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-4 w-10"><input type="checkbox" /></th>
                            <th className="p-4">受检者</th>
                            <th className="p-4">体检编号</th>
                            <th className="p-4">部门</th>
                            <th className="p-4">风险等级</th>
                            <th className="p-4">危急值状态</th>
                            <th className="p-4">更新时间</th>
                            <th className="p-4 text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={8} className="p-10 text-center text-slate-400">加载中...</td></tr>
                        ) : filteredArchives.length === 0 ? (
                            <tr><td colSpan={8} className="p-10 text-center text-slate-400">无匹配数据</td></tr>
                        ) : (
                            filteredArchives.map(archive => {
                                const isCriticalActive = archive.assessment_data.isCritical || archive.critical_track;
                                return (
                                <tr 
                                    key={archive.id} 
                                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedIds.has(archive.id) ? 'bg-blue-50/30' : ''}`}
                                    onDoubleClick={() => onSelectPatient(archive, 'assessment')}
                                    title="双击查看详情"
                                >
                                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
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
                                                onClick={(e) => { e.stopPropagation(); setCriticalModalArchive(archive); }}
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
                                    <td className="p-4 flex justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => onSelectPatient(archive, 'view')} className="text-slate-400 hover:text-teal-600 transition-colors" title="查看档案">👁️</button>
                                        <button onClick={() => handleEditClick(archive)} className="text-slate-400 hover:text-blue-600 transition-colors" title="编辑信息">✏️</button>
                                        <button onClick={() => handleDelete(archive.id, archive.name)} className="text-slate-400 hover:text-red-600 transition-colors" title="删除">🗑️</button>
                                    </td>
                                </tr>
                            )})
                        )}
                    </tbody>
                </table>
            </div>

            {/* Critical Handle Modal */}
            {criticalModalArchive && (
                <CriticalHandleModal 
                    archive={criticalModalArchive} 
                    onClose={() => setCriticalModalArchive(null)} 
                    onSave={handleCriticalSave} 
                />
            )}

            {/* Edit Profile Modal */}
            {editingArchive && (
                <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-center justify-center backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-scaleIn">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">编辑基础信息</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1">姓名</label>
                                    <input className="w-full border rounded p-2 text-sm" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1">体检编号</label>
                                    <input className="w-full border rounded p-2 text-sm bg-slate-50" value={editForm.checkupId || ''} onChange={e => setEditForm({...editForm, checkupId: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1">性别</label>
                                    <select className="w-full border rounded p-2 text-sm" value={editForm.gender || ''} onChange={e => setEditForm({...editForm, gender: e.target.value})}>
                                        <option value="男">男</option>
                                        <option value="女">女</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1">年龄</label>
                                    <input type="number" className="w-full border rounded p-2 text-sm" value={editForm.age || 0} onChange={e => setEditForm({...editForm, age: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1">部门</label>
                                    <input className="w-full border rounded p-2 text-sm" value={editForm.department || ''} onChange={e => setEditForm({...editForm, department: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1">电话</label>
                                    <input className="w-full border rounded p-2 text-sm" value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setEditingArchive(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm">取消</button>
                            <button onClick={handleEditSave} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 text-sm">保存更改</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
