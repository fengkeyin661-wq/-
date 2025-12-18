
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
    const isSecondaryPhase = existingTrack?.status === 'pending_secondary';
    
    // 初始化逻辑：如果是新记录，从评估数据中提取
    const criticalWarning = archive.assessment_data.criticalWarning || '';
    const desc = criticalWarning.replace(/\[[AB]类\]\s*/, '') || '体检发现重大异常';

    const [form, setForm] = useState<CriticalTrackRecord>({
        id: existingTrack?.id || `crit_${Date.now()}`,
        status: existingTrack?.status || 'pending_initial',
        critical_item: existingTrack?.critical_item || '重点追踪项',
        critical_desc: existingTrack?.critical_desc || desc,
        critical_level: existingTrack?.critical_level || (archive.assessment_data.riskLevel === 'RED' ? 'A类' : 'B类'),
        initial_notify_time: existingTrack?.initial_notify_time || new Date().toLocaleString(),
        initial_feedback: existingTrack?.initial_feedback || '',
        secondary_due_date: existingTrack?.secondary_due_date || '',
        secondary_notify_time: existingTrack?.secondary_notify_time || '',
        secondary_feedback: existingTrack?.secondary_feedback || '',
    });

    useEffect(() => {
        // 自动计算回访日期：通知后1个月
        if (!form.secondary_due_date) {
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            setForm(prev => ({ ...prev, secondary_due_date: d.toISOString().split('T')[0] }));
        }
    }, []);

    const handleSubmit = () => {
        if (isSecondaryPhase) {
            // 二次追踪完成，结案归档
            if (!form.secondary_feedback?.trim()) return alert("请录入追踪反馈结果");
            onSave({ ...form, status: 'archived', secondary_notify_time: new Date().toLocaleString() });
        } else {
            // 初次处置完成，转入待追踪状态
            if (!form.initial_feedback.trim()) return alert("请录入初次通知反馈");
            onSave({ ...form, status: 'pending_secondary' });
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 z-[70] flex items-center justify-center backdrop-blur-md animate-fadeIn p-4">
            <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border-t-8 ${isSecondaryPhase ? 'border-orange-500' : 'border-red-600'} animate-scaleIn`}>
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            {isSecondaryPhase ? '📝 二次回访追踪记录' : '🚨 危急值初次处置'}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">受检者：{archive.name} ({archive.gender}/{archive.age}岁) · 编号：{archive.checkup_id}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
                </div>

                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* 基础异常信息（只读） */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">异常项目</div>
                            <div className="text-sm font-bold text-slate-700">{form.critical_item}</div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">危急等级</div>
                            <div className={`text-sm font-bold ${form.critical_level.includes('A') ? 'text-red-600' : 'text-orange-600'}`}>
                                {form.critical_level}
                            </div>
                        </div>
                        <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">指标详情</div>
                            <div className="text-xs text-slate-600 leading-relaxed">{form.critical_desc}</div>
                        </div>
                    </div>

                    <div className="h-px bg-slate-100"></div>

                    {/* 阶段一：记录（如果已完成则展示） */}
                    <div className={`p-4 rounded-2xl border-l-4 ${isSecondaryPhase ? 'bg-slate-50 border-slate-300 opacity-60' : 'bg-red-50 border-red-500'}`}>
                        <h4 className="text-sm font-bold text-slate-800 mb-3 flex justify-between">
                            <span>步骤1：初次通知与建议</span>
                            <span className="text-[10px] font-normal text-slate-500">{form.initial_notify_time}</span>
                        </h4>
                        <textarea 
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm h-24 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                            placeholder="请记录通知对象、通话内容及受检者反馈（如：已告知家属，建议去心内科急诊）..."
                            value={form.initial_feedback}
                            onChange={e => !isSecondaryPhase && setForm({...form, initial_feedback: e.target.value})}
                            disabled={isSecondaryPhase}
                        />
                    </div>

                    {/* 阶段二：追踪（仅在阶段二显示） */}
                    {isSecondaryPhase && (
                        <div className="p-4 rounded-2xl border-l-4 bg-orange-50 border-orange-500 animate-slideUp">
                            <h4 className="text-sm font-bold text-slate-800 mb-3 flex justify-between">
                                <span>步骤2：疗效追踪与反馈</span>
                                <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded">回访期限：{form.secondary_due_date}</span>
                            </h4>
                            <textarea 
                                className="w-full border border-orange-200 rounded-xl p-3 text-sm h-32 focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-inner"
                                placeholder="请重点追踪受检者的复查结果、治疗进展或用药情况（如：已复查，血压控制平稳，医生建议继续目前方案）..."
                                value={form.secondary_feedback}
                                onChange={e => setForm({...form, secondary_feedback: e.target.value})}
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-200 transition-colors">取消</button>
                    <button 
                        onClick={handleSubmit}
                        className={`px-8 py-2 rounded-xl text-white font-bold shadow-lg transition-transform active:scale-95 ${
                            isSecondaryPhase ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'
                        }`}
                    >
                        {isSecondaryPhase ? '✅ 确认反馈并结案' : '💾 保存并列入追踪计划'}
                    </button>
                </div>
            </div>
        </div>
    );
};
