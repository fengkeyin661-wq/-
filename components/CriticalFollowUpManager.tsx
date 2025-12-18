
import React, { useState, useMemo } from 'react';
import { HealthArchive, updateCriticalTrack } from '../services/dataService';
import { CriticalTrackRecord } from '../types';
import { CriticalHandleModal } from './CriticalHandleModal';
// @ts-ignore
import * as XLSX from 'xlsx';

interface Props {
    archives: HealthArchive[];
    onRefresh: () => void;
}

export const CriticalFollowUpManager: React.FC<Props> = ({ archives, onRefresh }) => {
    const [subTab, setSubTab] = useState<'pending' | 'archived'>('pending');
    const [selectedPatient, setSelectedPatient] = useState<HealthArchive | null>(null);

    // 逻辑分层：过滤出有危急值记录的人员
    const criticalGroups = useMemo(() => {
        const pending: HealthArchive[] = [];
        const archived: HealthArchive[] = [];

        archives.forEach(arch => {
            const track = arch.critical_track;
            // 只要 assessment 标记为 critical 或者已有 track 记录
            if (track) {
                if (track.status === 'archived') {
                    archived.push(arch);
                } else {
                    pending.push(arch);
                }
            } else if (arch.assessment_data?.isCritical) {
                // 有标记但还没创建追踪记录，归入待处理
                pending.push(arch);
            }
        });

        // 排序：待随访按日期紧急程度，已随访按更新时间
        pending.sort((a, b) => {
            const getPriority = (x: HealthArchive) => {
                if (x.critical_track?.status === 'pending_initial') return 1000;
                if (!x.critical_track?.secondary_due_date) return 0;
                return new Date(x.critical_track.secondary_due_date).getTime();
            };
            return getPriority(a) - getPriority(b);
        });

        archived.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());

        return { pending, archived };
    }, [archives]);

    const handleExport = (type: 'pending' | 'archived') => {
        const data = type === 'pending' ? criticalGroups.pending : criticalGroups.archived;
        if (data.length === 0) return alert("名单为空，无法导出");

        const rows = data.map(arch => {
            const track = arch.critical_track;
            return {
                "体检编号": arch.checkup_id,
                "姓名": arch.name,
                "性别": arch.gender,
                "年龄": arch.age,
                "单位/部门": arch.department,
                "联系电话": arch.phone || '-',
                "危急项目": track?.critical_item || "待定",
                "异常描述": track?.critical_desc || arch.assessment_data?.criticalWarning || "-",
                "当前状态": track?.status === 'pending_initial' ? '待初次通知' : track?.status === 'pending_secondary' ? '待二次追踪' : '已归档结案',
                "计划回访日期": track?.secondary_due_date || "-",
                "处置记录": track?.initial_feedback || "-",
                "最后更新": new Date(arch.updated_at || arch.created_at).toLocaleString()
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "危急值随访名单");
        XLSX.writeFile(wb, `危急值随访_${type === 'pending' ? '待处理' : '已结案'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const activeList = subTab === 'pending' ? criticalGroups.pending : criticalGroups.archived;

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fadeIn min-h-[600px] flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-6">
                    <h2 className="text-xl font-black text-slate-800">危急值随访管理中心</h2>
                    <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                        <button 
                            onClick={() => setSubTab('pending')}
                            className={`px-6 py-1.5 rounded-md text-sm font-bold transition-all ${subTab === 'pending' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            待随访追踪 ({criticalGroups.pending.length})
                        </button>
                        <button 
                            onClick={() => setSubTab('archived')}
                            className={`px-6 py-1.5 rounded-md text-sm font-bold transition-all ${subTab === 'archived' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            已归档结案 ({criticalGroups.archived.length})
                        </button>
                    </div>
                </div>
                <button 
                    onClick={() => handleExport(subTab)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-lg active:scale-95 transition-all"
                >
                    <span>📥</span> 导出当前名单
                </button>
            </div>

            <div className="flex-1 overflow-auto">
                {activeList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                        <div className="text-6xl mb-4">{subTab === 'pending' ? '✅' : '📁'}</div>
                        <p className="font-bold">{subTab === 'pending' ? '目前没有待处理的危急值' : '暂无已归档的历史记录'}</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-600 font-black sticky top-0 z-10 uppercase tracking-wider">
                            <tr>
                                <th className="p-4">受检人员</th>
                                <th className="p-4">危急项目与描述</th>
                                <th className="p-4">回访计划</th>
                                <th className="p-4">处置状态</th>
                                <th className="p-4 text-center">管理操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {activeList.map(arch => {
                                const track = arch.critical_track;
                                const isUrgent = track?.status === 'pending_initial';
                                
                                let countdownText = '';
                                let countdownStyle = 'text-slate-400';
                                
                                if (track?.secondary_due_date && track.status === 'pending_secondary') {
                                    const due = new Date(track.secondary_due_date);
                                    const diff = Math.ceil((due.getTime() - new Date().setHours(0,0,0,0)) / (1000*60*60*24));
                                    if (diff < 0) { countdownText = `已逾期 ${Math.abs(diff)} 天`; countdownStyle = 'text-red-600 font-bold animate-pulse'; }
                                    else if (diff === 0) { countdownText = '今日需回访'; countdownStyle = 'text-orange-600 font-bold'; }
                                    else { countdownText = `剩 ${diff} 天回访`; countdownStyle = 'text-blue-600'; }
                                }

                                return (
                                    <tr key={arch.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800 text-base">{arch.name}</div>
                                            <div className="text-xs text-slate-500 mt-1">{arch.gender} · {arch.age}岁 · {arch.department}</div>
                                        </td>
                                        <td className="p-4 max-w-xs">
                                            <div className="font-bold text-red-700">{track?.critical_item || "重点关注项"}</div>
                                            <div className="text-xs text-slate-500 line-clamp-2 mt-1" title={track?.critical_desc || arch.assessment_data.criticalWarning}>
                                                {track?.critical_desc || arch.assessment_data.criticalWarning}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {track?.status === 'pending_secondary' ? (
                                                <>
                                                    <div className="text-sm font-mono font-bold text-slate-700">{track.secondary_due_date}</div>
                                                    <div className={`text-[10px] mt-1 ${countdownStyle}`}>{countdownText}</div>
                                                </>
                                            ) : (
                                                <span className="text-xs text-slate-400">---</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                                                isUrgent ? 'bg-red-100 text-red-600 border border-red-200 animate-pulse' :
                                                track?.status === 'pending_secondary' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                'bg-green-50 text-green-600 border border-green-100'
                                            }`}>
                                                {isUrgent ? '🔥 待初次通知' : 
                                                 track?.status === 'pending_secondary' ? '🕒 待二次回访' : '✅ 已归档结案'}
                                            </span>
                                            <div className="text-[9px] text-slate-400 mt-1">{new Date(arch.updated_at || arch.created_at).toLocaleDateString()} 更新</div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button 
                                                onClick={() => setSelectedPatient(arch)}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                                                    subTab === 'pending' ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {subTab === 'pending' ? (isUrgent ? '立即处置' : '回访登记') : '查看详情'}
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {selectedPatient && (
                <CriticalHandleModal 
                    archive={selectedPatient} 
                    onClose={() => setSelectedPatient(null)} 
                    onSave={async (record) => {
                        await updateCriticalTrack(selectedPatient.checkup_id, record);
                        setSelectedPatient(null);
                        onRefresh();
                    }} 
                />
            )}
        </div>
    );
};
