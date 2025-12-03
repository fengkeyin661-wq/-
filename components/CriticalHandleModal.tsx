

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
    const levelMatch = criticalWarning.match(/\[([AB]类)\]/);
    const level = levelMatch ? levelMatch[1] : (archive.assessment_data.riskLevel === 'RED' ? 'A类' : 'B类');
    const desc = criticalWarning.replace(/\[[AB]类\]\s*/, '') || '存在危急指标';

    const [form, setForm] = useState<CriticalTrackRecord>({
        id: existingTrack?.id || `crit_${Date.now()}`,
        status: existingTrack?.status || 'pending_initial',
        
        critical_item: existingTrack?.critical_item || '危急值筛查',
        critical_desc: existingTrack?.critical_desc || desc,
        critical_level: existingTrack?.critical_level || level,

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

    const toggleLevel = (lvl: string) => {
        if (isSecondary) return;
        const current = form.critical_level || '';
        let parts = current.split(/[,，/ ]+/).filter(Boolean);
        if (parts.includes(lvl)) {
            parts = parts.filter(p => p !== lvl);
        } else {
            parts.push(lvl);
        }
        setForm({ ...form, critical_level: parts.sort().join(',') });
    };

    const isChecked = (lvl: string) => {
        return (form.critical_level || '').split(/[,，/ ]+/).includes(lvl);
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

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-center justify-center backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-8 animate-scaleIn border-t-8 border-red-600">
                <div className="flex justify-between items-start mb-6 border-b pb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-red-700 flex items-center gap-2">
                            <span>🚨</span> 重要异常结果记录表
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">独立危急值管理闭环</p>
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
                        <div className="p-3 font