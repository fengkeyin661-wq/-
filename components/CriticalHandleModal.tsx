
import React, { useState, useEffect } from 'react';
import { HealthArchive } from '../services/dataService';
import { CriticalTrackRecord } from '../types';

interface Props {
    archive: HealthArchive;
    onClose: () => void;
    onSave: (record: CriticalTrackRecord) => void;
}

export const CriticalHandleModal: React.FC<Props> = ({ archive, onClose, onSave }) => {
    const existingTrack = archive.critical_track;
    const isSecondary = existingTrack?.status === 'pending_secondary';
    
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

        initial_notify_time: existingTrack?.initial_notify_time || new Date().toLocaleString(),
        initial_feedback: existingTrack?.initial_feedback || '',

        secondary_due_date: existingTrack?.secondary_due_date || '',
        secondary_notify_time: existingTrack?.secondary_notify_time || new Date().toLocaleString(),
        secondary_feedback: existingTrack?.secondary_feedback || '',
    });

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
        if (isSecondary) return; // Cannot change level during secondary phase
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
        if (isSecondary) {
            // Completing Secondary -> Archive
            if (!form.secondary_feedback?.trim()) {
                alert("请填写二次反馈结果");
                return;
            }
            onSave({ ...form, status: 'archived' });
        } else {
            // Completing Initial -> Pending Secondary
            if (!form.initial_feedback.trim()) {
                alert("请填写反馈结果");
                return;
            }
            onSave({ ...form, status: 'pending_secondary' });
        }
    };

    const stageTitle = isSecondary ? "阶段二：疗效追踪与归档" : "阶段一：初次通知与处置";
    const headerColor = isSecondary ? "border-orange-500" : "border-red-600";
    const titleColor = isSecondary ? "text-orange-700" : "text-red-700";

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-center justify-center backdrop-blur-sm animate-fadeIn">
            <div className={`bg-white rounded-xl shadow-2xl w-full max-w-3xl p-8 animate-scaleIn border-t-8 ${headerColor} max-h-[90vh] overflow-y-auto`}>
                <div className="flex justify-between items-start mb-6 border-b pb-4">
                    <div>
                        <h2 className={`text-2xl font-bold ${titleColor} flex items-center gap-2`}>
                            <span>{isSecondary ? '📝' : '🚨'}</span> 危急值管理 - {stageTitle}
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">
                            {isSecondary ? '请确认复查结果并完成闭环管理' : '请立即通知受检者并记录反馈'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
                </div>

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
                        <div className="p-3 border-r border-slate-300">{archive.checkup_id}</div>
                        <div className="p-3 border-r border-slate-300 font-bold text-slate-700">联系电话</div>
                        <div className="p-3 font-mono">{archive.phone || '-'}</div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">危急等级 (可多选)</label>
                            <div className={`flex gap-4 p-3 rounded border border-slate-200 ${isSecondary ? 'bg-slate-100 opacity-80' : 'bg-slate-50'}`}>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 accent-red-600"
                                        checked={isChecked('A类')}
                                        onChange={() => toggleLevel('A类')}
                                        disabled={isSecondary}
                                    />
                                    <span className={`font-bold ${isChecked('A类') ? 'text-red-700' : 'text-slate-500'}`}>A类 (危急值)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 accent-orange-500"
                                        checked={isChecked('B类')}
                                        onChange={() => toggleLevel('B类')}
                                        disabled={isSecondary}
                                    />
                                    <span className={`font-bold ${isChecked('B类') ? 'text-orange-700' : 'text-slate-500'}`}>B类 (重大异常)</span>
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">危急项目名称</label>
                            <input 
                                type="text" 
                                className={`w-full border border-slate-300 rounded p-2.5 text-sm ${isSecondary ? 'bg-slate-100' : ''}`}
                                value={form.critical_item}
                                onChange={e => !isSecondary && setForm({...form, critical_item: e.target.value})}
                                disabled={isSecondary}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">异常描述</label>
                        <textarea 
                            className={`w-full border border-slate-300 rounded p-2 text-sm h-20 ${isSecondary ? 'bg-slate-100 text-slate-600' : 'bg-slate-50'}`}
                            value={form.critical_desc}
                            onChange={e => !isSecondary && setForm({...form, critical_desc: e.target.value})}
                            disabled={isSecondary}
                        />
                    </div>

                    <div className={`p-4 rounded-lg border-l-4 transition-all ${isSecondary ? 'bg-slate-50 border-slate-300 opacity-70' : 'bg-red-50 border-red-500'}`}>
                        <h4 className="font-bold text-slate-800 mb-3 flex justify-between items-center">
                            <span className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${isSecondary ? 'bg-slate-400' : 'bg-red-500'}`}>1</span>
                                初次通知与处理记录
                            </span>
                            <span className="text-xs font-normal text-slate-500 bg-white px-2 py-1 rounded border">通知时间: {form.initial_notify_time}</span>
                        </h4>
                        <textarea 
                            className={`w-full border rounded p-2 text-sm h-24 ${isSecondary ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-white border-red-200 focus:ring-2 focus:ring-red-500'}`}
                            placeholder="请记录通知对象（本人/家属/单位）、通话情况及处置建议..."
                            value={form.initial_feedback}
                            onChange={e => !isSecondary && setForm({...form, initial_feedback: e.target.value})}
                            disabled={isSecondary}
                        />
                    </div>

                    {isSecondary && (
                        <div className="p-4 rounded-lg border-l-4 bg-orange-50 border-orange-500 animate-slideUp">
                            <h4 className="font-bold text-slate-800 mb-3 flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white bg-orange-500">2</span>
                                    二次回访追踪记录
                                </span>
                                <span className="text-xs font-normal text-orange-700 bg-orange-100 px-2 py-1 rounded">计划日期: {form.secondary_due_date}</span>
                            </h4>
                            <textarea 
                                className="w-full border border-orange-300 rounded p-2 text-sm h-24 focus:ring-2 focus:ring-orange-500 bg-white"
                                placeholder="请记录复查结果、治疗进展及干预效果..."
                                value={form.secondary_feedback}
                                onChange={e => setForm({...form, secondary_feedback: e.target.value})}
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                    <button onClick={onClose} className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold">取消</button>
                    <button 
                        onClick={handleSubmit}
                        className={`px-6 py-2 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-transform active:scale-95 ${
                            isSecondary ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'
                        }`}
                    >
                        {isSecondary ? '✅ 完成归档 (Archive)' : '💾 确认通知并列入回访'}
                    </button>
                </div>
            </div>
        </div>
    );
};
