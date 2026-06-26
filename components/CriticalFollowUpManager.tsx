
import React, { useState, useMemo } from 'react';
import { HealthArchive, updateCriticalTrack } from '../services/dataService';
import { CriticalTrackRecord } from '../types';
import { CriticalHandleModal, formatCriticalRecorder } from './CriticalHandleModal';
import {
    isSmsConfigured,
    resolveArchivePhone,
    sendCriticalSms,
} from '../services/smsService';
// @ts-ignore
import * as XLSX from 'xlsx';

interface Props {
    archives: HealthArchive[];
    onRefresh: () => void;
}

type SortKey = 'name' | 'critical_item' | 'secondary_due_date' | 'status' | 'updated_at';

const PENDING_DEFAULT_SORT: { key: SortKey; direction: 'asc' | 'desc' } = { key: 'status', direction: 'asc' };
const ARCHIVED_DEFAULT_SORT: { key: SortKey; direction: 'asc' | 'desc' } = { key: 'updated_at', direction: 'desc' };

const getStatusOrder = (arch: HealthArchive): number => {
    const status = arch.critical_track?.status;
    if (status === 'pending_initial') return 0;
    if (!arch.critical_track && arch.assessment_data?.isCritical) return 0;
    if (status === 'pending_secondary') return 1;
    if (status === 'archived') return 2;
    return 3;
};

const getSecondaryDueTime = (arch: HealthArchive): number => {
    const date = arch.critical_track?.secondary_due_date;
    return date ? new Date(date).getTime() : Number.MAX_SAFE_INTEGER;
};

const renderRecorderCell = (track?: CriticalTrackRecord) => {
    if (!track?.initial_recorder_name && !track?.secondary_recorder_name) {
        return <span className="text-xs text-slate-400">-</span>;
    }
    return (
        <div className="space-y-1 text-xs text-slate-600">
            {track.initial_recorder_name && (
                <div>
                    <span className="text-slate-400">初次：</span>
                    {formatCriticalRecorder(track.initial_recorder_name, track.initial_recorder_role)}
                </div>
            )}
            {track.secondary_recorder_name && (
                <div>
                    <span className="text-slate-400">二次：</span>
                    {formatCriticalRecorder(track.secondary_recorder_name, track.secondary_recorder_role)}
                </div>
            )}
        </div>
    );
};

const compareArchives = (
    a: HealthArchive,
    b: HealthArchive,
    sortConfig: { key: SortKey; direction: 'asc' | 'desc' }
): number => {
    let aVal: string | number = '';
    let bVal: string | number = '';
    switch (sortConfig.key) {
        case 'name':
            aVal = a.name || '';
            bVal = b.name || '';
            break;
        case 'critical_item':
            aVal = a.critical_track?.critical_item || a.assessment_data?.criticalWarning || '';
            bVal = b.critical_track?.critical_item || b.assessment_data?.criticalWarning || '';
            break;
        case 'secondary_due_date':
            aVal = getSecondaryDueTime(a);
            bVal = getSecondaryDueTime(b);
            break;
        case 'status':
            aVal = getStatusOrder(a);
            bVal = getStatusOrder(b);
            break;
        case 'updated_at':
            aVal = new Date(a.updated_at || a.created_at).getTime();
            bVal = new Date(b.updated_at || b.created_at).getTime();
            break;
    }
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
};

export const CriticalFollowUpManager: React.FC<Props> = ({ archives, onRefresh }) => {
    const [subTab, setSubTab] = useState<'pending' | 'archived'>('pending');
    const [selectedPatient, setSelectedPatient] = useState<HealthArchive | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>(PENDING_DEFAULT_SORT);

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

        return { pending, archived };
    }, [archives]);

    const baseList = subTab === 'pending' ? criticalGroups.pending : criticalGroups.archived;

    const activeList = useMemo(() => {
        const result = [...baseList];
        result.sort((a, b) => compareArchives(a, b, sortConfig));
        return result;
    }, [baseList, sortConfig]);

    const sortIndicator = (key: SortKey) =>
        sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : '';

    const handleSort = (key: SortKey) => {
        setSortConfig({
            key,
            direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
        });
    };

    const handleSubTabChange = (tab: 'pending' | 'archived') => {
        setSubTab(tab);
        setSortConfig(tab === 'pending' ? PENDING_DEFAULT_SORT : ARCHIVED_DEFAULT_SORT);
    };

    const handleExport = (type: 'pending' | 'archived') => {
        const data = type === 'pending' ? criticalGroups.pending : criticalGroups.archived;
        if (data.length === 0) return alert("名单为空，无法导出");

        const exportSort = type === subTab ? sortConfig : (type === 'pending' ? PENDING_DEFAULT_SORT : ARCHIVED_DEFAULT_SORT);
        const sortedData = [...data].sort((a, b) => compareArchives(a, b, exportSort));
        const rows = sortedData.map(arch => {
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
                "初次记录人": track?.initial_recorder_name
                    ? formatCriticalRecorder(track.initial_recorder_name, track.initial_recorder_role)
                    : "-",
                "二次记录人": track?.secondary_recorder_name
                    ? formatCriticalRecorder(track.secondary_recorder_name, track.secondary_recorder_role)
                    : "-",
                "处置记录": track?.initial_feedback || "-",
                "最后更新": new Date(arch.updated_at || arch.created_at).toLocaleString()
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "危急值随访名单");
        XLSX.writeFile(wb, `危急值随访_${type === 'pending' ? '待处理' : '已结案'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fadeIn min-h-[600px] flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-6">
                    <h2 className="text-xl font-black text-slate-800">危急值随访管理中心</h2>
                    <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                        <button 
                            onClick={() => handleSubTabChange('pending')}
                            className={`px-6 py-1.5 rounded-md text-sm font-bold transition-all ${subTab === 'pending' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            待随访追踪 ({criticalGroups.pending.length})
                        </button>
                        <button 
                            onClick={() => handleSubTabChange('archived')}
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
                                <th className="p-4 cursor-pointer hover:text-teal-600 select-none" onClick={() => handleSort('name')}>
                                    受检人员{sortIndicator('name')}
                                </th>
                                <th className="p-4 cursor-pointer hover:text-teal-600 select-none" onClick={() => handleSort('critical_item')}>
                                    危急项目与描述{sortIndicator('critical_item')}
                                </th>
                                <th className="p-4 cursor-pointer hover:text-teal-600 select-none" onClick={() => handleSort('secondary_due_date')}>
                                    回访计划{sortIndicator('secondary_due_date')}
                                </th>
                                <th className="p-4 cursor-pointer hover:text-teal-600 select-none" onClick={() => handleSort(subTab === 'archived' ? 'updated_at' : 'status')}>
                                    {subTab === 'archived' ? '归档时间' : '处置状态'}{sortIndicator(subTab === 'archived' ? 'updated_at' : 'status')}
                                </th>
                                <th className="p-4">记录人</th>
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
                                        <td className="p-4">{renderRecorderCell(track)}</td>
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
                    onSave={async (record, options) => {
                        let recordToSave = { ...record };
                        if (options?.sendSms) {
                            const phone = resolveArchivePhone(selectedPatient);
                            if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
                                alert('该职工未登记有效手机号，无法发送短信');
                                return;
                            }
                            if (!isSmsConfigured()) {
                                alert('短信服务未配置：请部署 send-sms Edge Function 并设置 VITE_SMS_INVOKE_SECRET');
                                return;
                            }
                            const summary = selectedPatient.assessment_data?.criticalWarning || record.critical_desc;
                            const smsRes = await sendCriticalSms({
                                checkupId: selectedPatient.checkup_id,
                                phone,
                                name: selectedPatient.name,
                                summary,
                                sentRole: 'admin',
                            });
                            if (!smsRes.success || smsRes.failCount > 0) {
                                alert(`短信发送失败：${smsRes.results[0]?.error || smsRes.message}`);
                                return;
                            }
                            const now = new Date().toLocaleString();
                            recordToSave = record.status === 'pending_secondary' || record.status === 'archived'
                                ? { ...recordToSave, secondary_notify_time: now }
                                : { ...recordToSave, initial_notify_time: now };
                        }
                        await updateCriticalTrack(selectedPatient.checkup_id, recordToSave);
                        setSelectedPatient(null);
                        onRefresh();
                    }} 
                />
            )}
        </div>
    );
};
