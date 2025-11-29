
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
        critical_level: (existingTrack?.critical_level || level) as 'A类' | 'B类',

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

    const handleSubmit = () => {
        if (isSecondary) {
            // Completing Secondary -> Archive
            if (!form.secondary_feedback.trim()) {
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
                        <div className="p-3 font-mono">{archive.phone || '无'}</div>
                    </div>

                    {/* Critical Info */}
                    <div className="grid grid-cols-4 border-b border-slate-300 text-sm">
                        <div className="p-3 border-r border-slate-300 font-bold text-slate-700 flex items-center">重要结果项目</div>
                        <div className="p-3 border-r border-slate-300 col-span-2">
                            <input 
                                className="w-full bg-transparent outline-none font-bold text-slate-800"
                                value={form.critical_item}
                                onChange={e => setForm({...form, critical_item: e.target.value})}
                                disabled={isSecondary}
                            />
                        </div>
                        <div className="p-3 flex items-center gap-4 bg-red-50 text-red-700 font-bold">
                            <span>等级:</span>
                            <div className="flex gap-2">
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" checked={form.critical_level === 'A类'} 
                                        onChange={() => setForm({...form, critical_level: 'A类'})} disabled={isSecondary} /> A类
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" checked={form.critical_level === 'B类'}
                                        onChange={() => setForm({...form, critical_level: 'B类'})} disabled={isSecondary} /> B类
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div className="border-b border-slate-300 p-3 bg-red-50/30">
                        <div className="text-sm font-bold text-slate-700 mb-2">重要结果描述:</div>
                        <textarea 
                            className="w-full bg-transparent outline-none text-slate-800 text-sm resize-none h-16 border border-dashed border-slate-300 p-2 rounded"
                            value={form.critical_desc}
                            onChange={e => setForm({...form, critical_desc: e.target.value})}
                            disabled={isSecondary}
                        />
                    </div>

                    {/* Initial Feedback */}
                    <div className="grid grid-cols-4 border-b border-slate-300 text-sm">
                        <div className="p-3 border-r border-slate-300 font-bold text-slate-700 flex items-center bg-blue-50">通知时间</div>
                        <div className="p-3 border-r border-slate-300 col-span-3 bg-blue-50">
                            <input 
                                className="w-full bg-transparent outline-none"
                                value={form.initial_notify_time}
                                onChange={e => setForm({...form, initial_notify_time: e.target.value})}
                                disabled={isSecondary}
                            />
                        </div>
                    </div>
                    <div className="border-b border-slate-300 p-3 bg-blue-50/30">
                        <div className="text-sm font-bold text-blue-800 mb-2">反馈结果 (首次):</div>
                        <textarea 
                            className="w-full outline-none text-slate-800 text-sm resize-none h-24 border border-blue-200 rounded p-2 focus:ring-1 focus:ring-blue-500 bg-white"
                            placeholder="医生电话通知结果、患者知晓情况、采取的措施..."
                            value={form.initial_feedback}
                            onChange={e => setForm({...form, initial_feedback: e.target.value})}
                            disabled={isSecondary}
                        />
                    </div>

                    {/* Secondary Follow-up (Only show in Secondary mode or if we are planning it) */}
                    <div className="grid grid-cols-4 border-b border-slate-300 text-sm bg-yellow-50">
                        <div className="p-3 border-r border-slate-300 font-bold text-slate-700 flex items-center">二次随访时间</div>
                        <div className="p-3 border-r border-slate-300 col-span-3 font-mono font-bold text-yellow-800">
                             {form.secondary_due_date} (通知时间: {form.secondary_notify_time})
                        </div>
                    </div>
                    
                    {isSecondary ? (
                        <div className="p-3 bg-yellow-50/30">
                            <div className="text-sm font-bold text-yellow-800 mb-2">二次回访结果 (归档):</div>
                            <textarea 
                                className="w-full outline-none text-slate-800 text-sm resize-none h-24 border border-yellow-200 rounded p-2 focus:ring-1 focus:ring-yellow-500 bg-white"
                                placeholder="一个月后复查情况确认..."
                                value={form.secondary_feedback}
                                onChange={e => setForm({...form, secondary_feedback: e.target.value})}
                            />
                        </div>
                    ) : (
                        <div className="p-3 bg-slate-50 text-xs text-slate-400 text-center italic">
                            保存后，系统将自动设置 1 个月后的二次回访提醒。
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className="px-6 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium">取消</button>
                    <button 
                        onClick={handleSubmit}
                        className={`px-8 py-2 text-white font-bold rounded-lg shadow-lg transition-transform hover:scale-105 ${
                            isSecondary ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-red-600 hover:bg-red-700'
                        }`}
                    >
                        {isSecondary ? '✅ 确认归档' : '💾 保存并设为待二次回访'}
                    </button>
                </div>
            </div>
        </div>
    );
};
