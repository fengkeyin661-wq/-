
import React, { useState, useEffect } from 'react';
import { HealthArchive } from '../services/dataService';
import { CriticalTrackRecord } from '../types';
import { formatArchiveCheckupDate, addLocalDaysYmd } from '../services/followUpLinkageService';
import { FollowUpTalkScriptReminder } from './FollowUpTalkScriptReminder';

export const formatCriticalRecorder = (name?: string, role?: string) => {
    if (!name) return '';
    if (role === 'doctor') return `${name} 医生`;
    if (role === 'health_manager') return `${name} 健康管理师`;
    if (role === 'admin') return `${name} 管理员`;
    return name;
};

interface Props {
    archive: HealthArchive;
    onClose: () => void;
    onSave: (
        record: CriticalTrackRecord,
        options?: { sendSms?: boolean; convertToFollowUp?: boolean; delayContactWeek?: boolean },
    ) => void;
    showSmsOption?: boolean;
    onConvertToFollowUp?: (archive: HealthArchive) => void;
}

export const CriticalHandleModal: React.FC<Props> = ({ archive, onClose, onSave, showSmsOption = true, onConvertToFollowUp }) => {
    const existingTrack = archive.critical_track;
    const isArchived = existingTrack?.status === 'archived';
    const isSecondary = existingTrack?.status === 'pending_secondary';
    const isReadOnly = isArchived || isSecondary;
    const showSecondarySection = isSecondary || isArchived;
    
    // Auto-extract info if fresh, or load existing
    const criticalWarning = archive.assessment_data.criticalWarning || '';
    // 兼容 [A类]/[B类] 与历史数据中的 [A1类][B2类] 等，统一理解为 A类 / B类
    const levelMatch = criticalWarning.match(/\[\s*([AB])\s*[12１２]?\s*类\s*\]/);
    const defaultLevel = levelMatch ? `${levelMatch[1]}类` : (archive.assessment_data.riskLevel === 'RED' ? 'A类' : 'B类');
    const desc = criticalWarning.replace(/\[[AB]类\]\s*/, '') || '存在危急指标';

    const [form, setForm] = useState<CriticalTrackRecord>({
        id: existingTrack?.id || `crit_${Date.now()}`,
        status: existingTrack?.status || 'pending_initial',
        
        critical_item: existingTrack?.critical_item || '危急值筛查',
        critical_desc: existingTrack?.critical_desc || desc,
        critical_level: existingTrack?.critical_level || defaultLevel,

        initial_notify_time: existingTrack?.initial_notify_time || '',
        initial_feedback: existingTrack?.initial_feedback || '',
        initial_recorder_name: existingTrack?.initial_recorder_name,
        initial_recorder_role: existingTrack?.initial_recorder_role,

        secondary_due_date: existingTrack?.secondary_due_date || '',
        secondary_notify_time: existingTrack?.secondary_notify_time || '',
        secondary_feedback: existingTrack?.secondary_feedback || '',
        secondary_recorder_name: existingTrack?.secondary_recorder_name,
        secondary_recorder_role: existingTrack?.secondary_recorder_role,
        contact_retry_due: existingTrack?.contact_retry_due,
        contact_unreachable_at: existingTrack?.contact_unreachable_at,
        contact_unreachable_count: existingTrack?.contact_unreachable_count,
    });
    const [sendSmsOnSave, setSendSmsOnSave] = useState(false);
    const [convertToFollowUp, setConvertToFollowUp] = useState(false);

    // Determine target date for secondary follow-up (Current + 1 Month) if not set
    useEffect(() => {
        if (!form.secondary_due_date) {
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            setForm(prev => ({ ...prev, secondary_due_date: d.toISOString().split('T')[0] }));
        }
    }, []);

    // Toggle Multi-Level Selection
    const toggleLevel = (lvl: string) => {
        if (isReadOnly) return;
        const currentLevels = (form.critical_level || '').split(/[,，、/ ]+/).filter(Boolean);
        let newLevels = [];
        if (currentLevels.includes(lvl)) {
            newLevels = currentLevels.filter(l => l !== lvl);
        } else {
            newLevels = [...currentLevels, lvl];
        }
        // Sort to keep "A类,B类" consistent
        setForm({ ...form, critical_level: newLevels.sort().join(',') });
    };

    const isChecked = (lvl: string) => {
        return (form.critical_level || '').split(/[,，、/ ]+/).includes(lvl);
    };

    const handleSubmit = () => {
        if (isArchived) return;
        const now = new Date().toLocaleString();
        if (isSecondary) {
            if (!form.secondary_feedback?.trim()) {
                alert("请填写二次反馈结果");
                return;
            }
            const cleared = { ...form };
            delete cleared.contact_retry_due;
            delete cleared.contact_unreachable_at;
            onSave(
                { ...cleared, status: 'archived', secondary_notify_time: now },
                { sendSms: sendSmsOnSave, convertToFollowUp }
            );
        } else {
            if (!form.initial_feedback.trim()) {
                alert("请填写反馈结果");
                return;
            }
            const cleared = { ...form };
            delete cleared.contact_retry_due;
            delete cleared.contact_unreachable_at;
            onSave(
                { ...cleared, status: 'pending_secondary', initial_notify_time: now },
                { sendSms: sendSmsOnSave }
            );
        }
    };

    /** 电话联系不上：保持当前阶段，自今天起延期 7 天后再提醒 */
    const handleDelayContactOneWeek = () => {
        if (isArchived) return;
        const retryDue = addLocalDaysYmd(7);
        const note = `电话无人接听/联系不上，已延期至 ${retryDue} 再联系。`;
        if (
            !confirm(
                `确认因电话联系不上，将再联系时间延期一周？\n\n下次提醒日：${retryDue}\n（不会进入下一阶段，到期后会弹窗提醒）`,
            )
        ) {
            return;
        }
        const now = new Date().toLocaleString();
        const count = (form.contact_unreachable_count || 0) + 1;
        if (isSecondary) {
            onSave(
                {
                    ...form,
                    status: 'pending_secondary',
                    contact_retry_due: retryDue,
                    contact_unreachable_at: now,
                    contact_unreachable_count: count,
                    secondary_feedback: form.secondary_feedback?.trim()
                        ? `${form.secondary_feedback.trim()}\n${note}`
                        : note,
                },
                { delayContactWeek: true },
            );
        } else {
            onSave(
                {
                    ...form,
                    status: 'pending_initial',
                    contact_retry_due: retryDue,
                    contact_unreachable_at: now,
                    contact_unreachable_count: count,
                    initial_feedback: form.initial_feedback?.trim()
                        ? `${form.initial_feedback.trim()}\n${note}`
                        : note,
                },
                { delayContactWeek: true },
            );
        }
    };

    const stageTitle = isArchived
        ? "已归档结案详情"
        : isSecondary
            ? "阶段二：疗效追踪与归档"
            : "阶段一：初次通知与处置";
    const headerColor = isArchived ? "border-teal-600" : isSecondary ? "border-orange-500" : "border-red-600";
    const titleColor = isArchived ? "text-teal-700" : isSecondary ? "text-orange-700" : "text-red-700";
    const hasDeferredRetry = !!form.contact_retry_due;

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-center justify-center backdrop-blur-sm animate-fadeIn">
            <div className={`bg-white rounded-xl shadow-2xl w-full max-w-3xl p-8 animate-scaleIn border-t-8 ${headerColor} max-h-[90vh] overflow-y-auto`}>
                <div className="flex justify-between items-start mb-6 border-b pb-4">
                    <div>
                        <h2 className={`text-2xl font-bold ${titleColor} flex items-center gap-2`}>
                            <span>{isArchived ? '📁' : isSecondary ? '📝' : '🚨'}</span> 危急值管理 - {stageTitle}
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">
                            {isArchived ? '查看完整处置与二次回访记录' : isSecondary ? '请确认复查结果并完成闭环管理' : '请立即通知受检者并记录反馈'}
                        </p>
                        {hasDeferredRetry && (
                            <p className="text-xs font-bold text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-block">
                                已登记联系不上 · 计划再联系：{form.contact_retry_due}
                                {(form.contact_unreachable_count || 0) > 1
                                    ? `（第 ${form.contact_unreachable_count} 次延期）`
                                    : ''}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
                </div>

                <FollowUpTalkScriptReminder
                    scenario={isSecondary || isArchived ? 'critical_secondary' : 'critical_initial'}
                    className="mb-6"
                />

                <div className="border border-slate-300 rounded-lg overflow-hidden mb-6">
                    {/* Header Info */}
                    <div className="grid grid-cols-4 border-b border-slate-300 bg-slate-50 text-sm">
                        <div className="p-3 border-r border-slate-300 font-bold text-slate-700">受检者姓名</div>
                        <div className="p-3 border-r border-slate-300">{archive.name}</div>
                        <div className="p-3 border-r border-slate-300 font-bold text-slate-700">性别 / 年龄</div>
                        <div className="p-3">{archive.gender || '-'} / {archive.age || '-'}岁</div>
                    </div>
                    <div className="grid grid-cols-4 border-b border-slate-300 bg-slate-50 text-sm">
                        <div className="p-3 border-r border-slate-300 font-bold text-slate-700">体检编号</div>
                        <div className="p-3 border-r border-slate-300 font-mono">{archive.checkup_id}</div>
                        <div className="p-3 border-r border-slate-300 font-bold text-slate-700">体检日期</div>
                        <div className="p-3 font-mono font-bold text-slate-800">{formatArchiveCheckupDate(archive)}</div>
                    </div>
                    <div className="grid grid-cols-4 bg-slate-50 text-sm">
                        <div className="p-3 border-r border-slate-300 font-bold text-slate-700">联系电话</div>
                        <div className="p-3 border-r border-slate-300 font-mono">{archive.phone || '-'}</div>
                        <div className="p-3 border-r border-slate-300 font-bold text-slate-700">单位/部门</div>
                        <div className="p-3 truncate" title={archive.department || ''}>{archive.department || '-'}</div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">危急等级 (可多选)</label>
                            <div className={`flex gap-4 p-3 rounded border border-slate-200 ${isReadOnly ? 'bg-slate-100 opacity-80' : 'bg-slate-50'}`}>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 accent-red-600"
                                        checked={isChecked('A类')}
                                        onChange={() => toggleLevel('A类')}
                                        disabled={isReadOnly}
                                    />
                                    <span className={`font-bold ${isChecked('A类') ? 'text-red-700' : 'text-slate-500'}`}>A类 (危急值)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 accent-orange-500"
                                        checked={isChecked('B类')}
                                        onChange={() => toggleLevel('B类')}
                                        disabled={isReadOnly}
                                    />
                                    <span className={`font-bold ${isChecked('B类') ? 'text-orange-700' : 'text-slate-500'}`}>B类 (重大异常)</span>
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">危急项目名称</label>
                            <input 
                                type="text" 
                                className={`w-full border border-slate-300 rounded p-2.5 text-sm ${isReadOnly ? 'bg-slate-100' : ''}`}
                                value={form.critical_item}
                                onChange={e => !isReadOnly && setForm({...form, critical_item: e.target.value})}
                                disabled={isReadOnly}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">异常描述</label>
                        <textarea 
                            className={`w-full border border-slate-300 rounded p-2 text-sm h-20 ${isReadOnly ? 'bg-slate-100 text-slate-600' : 'bg-slate-50'}`}
                            value={form.critical_desc}
                            onChange={e => !isReadOnly && setForm({...form, critical_desc: e.target.value})}
                            disabled={isReadOnly}
                        />
                    </div>

                    <div className={`p-4 rounded-lg border-l-4 transition-all ${isReadOnly ? 'bg-slate-50 border-slate-300 opacity-70' : 'bg-red-50 border-red-500'}`}>
                        <h4 className="font-bold text-slate-800 mb-3 flex flex-wrap justify-between items-center gap-2">
                            <span className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${isReadOnly ? 'bg-slate-400' : 'bg-red-500'}`}>1</span>
                                初次通知与处理记录
                            </span>
                            <span className="flex flex-wrap items-center gap-2 text-xs font-normal">
                                {form.initial_recorder_name && (
                                    <span className="text-slate-600 bg-white px-2 py-1 rounded border">
                                        记录人: {formatCriticalRecorder(form.initial_recorder_name, form.initial_recorder_role)}
                                    </span>
                                )}
                                <span className="text-slate-500 bg-white px-2 py-1 rounded border">
                                    通知时间: {form.initial_notify_time || (isReadOnly ? '—' : '保存时自动记录')}
                                </span>
                            </span>
                        </h4>
                        <textarea 
                            className={`w-full border rounded p-2 text-sm h-24 ${isReadOnly ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-white border-red-200 focus:ring-2 focus:ring-red-500'}`}
                            placeholder="请记录通知对象（本人/家属/单位）、通话情况及处置建议..."
                            value={form.initial_feedback}
                            onChange={e => !isReadOnly && setForm({...form, initial_feedback: e.target.value})}
                            disabled={isReadOnly}
                        />
                    </div>

                    {showSecondarySection && (
                        <div className={`p-4 rounded-lg border-l-4 animate-slideUp ${isArchived ? 'bg-slate-50 border-teal-500 opacity-90' : 'bg-orange-50 border-orange-500'}`}>
                            <h4 className="font-bold text-slate-800 mb-3 flex flex-wrap justify-between items-center gap-2">
                                <span className="flex items-center gap-2">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${isArchived ? 'bg-teal-500' : 'bg-orange-500'}`}>2</span>
                                    二次回访追踪记录
                                </span>
                                <span className="flex flex-wrap items-center gap-2 text-xs font-normal">
                                    {form.secondary_recorder_name && (
                                        <span className={`px-2 py-1 rounded ${isArchived ? 'text-teal-700 bg-teal-100' : 'text-orange-700 bg-orange-100'}`}>
                                            记录人: {formatCriticalRecorder(form.secondary_recorder_name, form.secondary_recorder_role)}
                                        </span>
                                    )}
                                    <span className={`px-2 py-1 rounded ${isArchived ? 'text-teal-700 bg-teal-100' : 'text-orange-700 bg-orange-100'}`}>
                                        计划回访: {form.secondary_due_date || '—'}
                                    </span>
                                    <span className={`px-2 py-1 rounded ${isArchived ? 'text-teal-700 bg-teal-100' : 'text-orange-700 bg-orange-100'}`}>
                                        回访时间: {form.secondary_notify_time || (isArchived ? '—' : '保存归档时自动记录')}
                                    </span>
                                </span>
                            </h4>
                            <textarea 
                                className={`w-full border rounded p-2 text-sm h-24 ${isArchived ? 'bg-slate-100 border-slate-300 text-slate-600' : 'border-orange-300 focus:ring-2 focus:ring-orange-500 bg-white'}`}
                                placeholder={isArchived ? '暂无二次回访记录' : '请记录复查结果、治疗进展及干预效果...'}
                                value={form.secondary_feedback}
                                onChange={e => !isArchived && setForm({...form, secondary_feedback: e.target.value})}
                                disabled={isArchived}
                                autoFocus={isSecondary}
                            />
                        </div>
                    )}
                </div>

                {isSecondary && !isArchived && onConvertToFollowUp && (
                    <label className="flex items-center gap-2 mt-6 p-3 rounded-lg border border-teal-200 bg-teal-50 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={convertToFollowUp}
                            onChange={(e) => setConvertToFollowUp(e.target.checked)}
                            className="w-4 h-4 accent-teal-600"
                        />
                        <span className="text-sm text-teal-800 font-medium">
                            归档后进入随访监测，同步创建常规随访记录
                        </span>
                    </label>
                )}

                {showSmsOption && !isArchived && (
                    <label className="flex items-center gap-2 mt-6 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={sendSmsOnSave}
                            onChange={(e) => setSendSmsOnSave(e.target.checked)}
                            className="w-4 h-4 accent-teal-600"
                        />
                        <span className="text-sm text-slate-700">
                            保存时通过外网短信通知职工
                            <span className="text-xs text-slate-400 ml-1">（{archive.phone || '无手机号'}）</span>
                        </span>
                    </label>
                )}

                <div className="flex flex-wrap justify-between gap-3 mt-8 pt-4 border-t border-slate-100">
                    <div>
                        {!isArchived && (
                            <button
                                type="button"
                                onClick={handleDelayContactOneWeek}
                                className="px-4 py-2 rounded-lg text-sm font-bold border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                            >
                                电话联系不上，延期一周
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold">
                            {isArchived ? '关闭' : '取消'}
                        </button>
                        {!isArchived && (
                            <button 
                                onClick={handleSubmit}
                                className={`px-6 py-2 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-transform active:scale-95 ${
                                    isSecondary ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {isSecondary ? '✅ 完成归档 (Archive)' : '💾 确认通知并列入回访'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
