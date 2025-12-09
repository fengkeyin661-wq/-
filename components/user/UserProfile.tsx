
import React, { useState, useEffect } from 'react';
import { HealthRecord, HealthAssessment, FollowUpRecord } from '../../types';
import { DailyHealthPlan, HealthArchive } from '../../services/dataService';
import { fetchInteractions, InteractionItem } from '../../services/contentService';

interface Props {
  record: HealthRecord;
  assessment?: HealthAssessment;
  dailyPlan?: DailyHealthPlan;
  userId: string;
  archive: HealthArchive;
  onUpdateRecord: (updatedData: any) => void;
  onLogout: () => void;
}

export const UserProfile: React.FC<Props> = ({ record, assessment, dailyPlan, userId, archive, onUpdateRecord, onLogout }) => {
    const [subView, setSubView] = useState<'menu' | 'record' | 'followup' | 'plan' | 'events' | 'apps'>('menu');
    const [interactions, setInteractions] = useState<InteractionItem[]>([]);
    
    // Edit Record State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        height: record.checkup.basics.height || 0,
        weight: record.checkup.basics.weight || 0,
        sbp: record.checkup.basics.sbp || 0,
        dbp: record.checkup.basics.dbp || 0,
        glucose: record.checkup.labBasic.glucose?.fasting || '0'
    });

    useEffect(() => {
        const load = async () => {
            const all = await fetchInteractions();
            setInteractions(all.filter(i => i.userId === userId));
        };
        load();
    }, [userId]);

    const handleSaveRecord = () => {
        const bmi = editForm.height && editForm.weight 
            ? parseFloat((editForm.weight / ((editForm.height/100) * (editForm.height/100))).toFixed(1)) 
            : 0;

        onUpdateRecord({
            basics: {
                height: Number(editForm.height),
                weight: Number(editForm.weight),
                bmi: bmi,
                sbp: Number(editForm.sbp),
                dbp: Number(editForm.dbp)
            },
            labBasic: {
                glucose: { fasting: String(editForm.glucose) }
            }
        });
        setIsEditing(false);
    };

    // --- Sub Views ---

    const renderRecordView = () => (
        <div className="p-4 space-y-4 animate-slideInRight">
            <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800">基础身体指标</h3>
                    <button onClick={() => setIsEditing(!isEditing)} className="text-xs text-teal-600 font-bold bg-teal-50 px-3 py-1.5 rounded">
                        {isEditing ? '取消' : '修改数据'}
                    </button>
                </div>
                
                {isEditing ? (
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div><label className="text-xs text-slate-400">身高(cm)</label><input className="w-full border p-2 rounded mt-1" type="number" value={editForm.height} onChange={e => setEditForm({...editForm, height: Number(e.target.value)})} /></div>
                        <div><label className="text-xs text-slate-400">体重(kg)</label><input className="w-full border p-2 rounded mt-1" type="number" value={editForm.weight} onChange={e => setEditForm({...editForm, weight: Number(e.target.value)})} /></div>
                        <div><label className="text-xs text-slate-400">收缩压</label><input className="w-full border p-2 rounded mt-1" type="number" value={editForm.sbp} onChange={e => setEditForm({...editForm, sbp: Number(e.target.value)})} /></div>
                        <div><label className="text-xs text-slate-400">舒张压</label><input className="w-full border p-2 rounded mt-1" type="number" value={editForm.dbp} onChange={e => setEditForm({...editForm, dbp: Number(e.target.value)})} /></div>
                        <div className="col-span-2"><button onClick={handleSaveRecord} className="w-full bg-teal-600 text-white py-2 rounded font-bold">保存修改</button></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-400 mb-1">BMI</div>
                            <div className="font-bold text-lg text-slate-700">{record.checkup.basics.bmi || '-'}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-400 mb-1">血压</div>
                            <div className="font-bold text-lg text-slate-700">{record.checkup.basics.sbp}/{record.checkup.basics.dbp}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-400 mb-1">血糖</div>
                            <div className="font-bold text-lg text-slate-700">{record.checkup.labBasic.glucose?.fasting || '-'}</div>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-3">综合风险评估</h3>
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg">
                    {assessment?.summary || '暂无评估数据'}
                </p>
                <div className="mt-4 flex gap-2 flex-wrap">
                    {assessment?.risks.red.map((r,i) => <span key={i} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100">{r}</span>)}
                    {assessment?.risks.yellow.map((r,i) => <span key={i} className="text-xs bg-yellow-50 text-yellow-600 px-2 py-1 rounded border border-yellow-100">{r}</span>)}
                </div>
            </div>
        </div>
    );

    const renderFollowupView = () => (
        <div className="p-4 space-y-4 animate-slideInRight">
            {archive.follow_ups.length === 0 ? (
                <div className="text-center text-slate-400 mt-10">暂无随访记录</div>
            ) : (
                archive.follow_ups.map((fu, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-slate-700">{fu.date}</span>
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{fu.method}</span>
                        </div>
                        <div className="text-xs text-slate-500 space-y-1">
                            <div>血压: {fu.indicators.sbp}/{fu.indicators.dbp} mmHg</div>
                            <div>依从性: {fu.medication.compliance}</div>
                            <div className="bg-slate-50 p-2 rounded mt-2 text-slate-600">医生留言: {fu.assessment.doctorMessage}</div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    const renderPlanView = () => (
        <div className="p-4 space-y-4 animate-slideInRight">
            {dailyPlan ? (
                <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800">今日健康方案</h3>
                        <span className="text-xs text-slate-400">{new Date(dailyPlan.generatedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <div className="text-xs font-bold text-teal-600 uppercase mb-2">饮食</div>
                            <div className="bg-teal-50 p-3 rounded text-sm text-teal-900 space-y-1">
                                <div>🥞 早: {dailyPlan.diet.breakfast}</div>
                                <div>🍱 午: {dailyPlan.diet.lunch}</div>
                                <div>🥗 晚: {dailyPlan.diet.dinner}</div>
                                <div>🍎 加餐: {dailyPlan.diet.snack}</div>
                            </div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-indigo-600 uppercase mb-2">运动</div>
                            <div className="bg-indigo-50 p-3 rounded text-sm text-indigo-900 space-y-1">
                                <div>🌅 晨间: {dailyPlan.exercise.morning}</div>
                                <div>🌇 午后: {dailyPlan.exercise.afternoon}</div>
                                <div>🌙 晚间: {dailyPlan.exercise.evening}</div>
                            </div>
                        </div>
                        <div className="text-xs text-slate-500 italic text-center mt-4">
                            💡 {dailyPlan.tips}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center text-slate-400 mt-10">
                    <p>暂无今日方案</p>
                    <p className="text-xs mt-2">请前往“饮食与运动”页面一键生成</p>
                </div>
            )}
        </div>
    );

    const renderEventsView = () => {
        const myEvents = interactions.filter(i => i.type === 'event_signup');
        return (
            <div className="p-4 space-y-3 animate-slideInRight">
                {myEvents.length === 0 ? <div className="text-center text-slate-400 mt-10">暂无报名的活动</div> : myEvents.map(ev => (
                    <div key={ev.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <div className="font-bold text-slate-800">{ev.targetName}</div>
                        <div className="flex justify-between items-end mt-2">
                            <span className="text-xs text-slate-500">{ev.date} 报名</span>
                            <span className={`text-xs px-2 py-1 rounded font-bold ${
                                ev.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                ev.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                            }`}>
                                {ev.status === 'confirmed' ? '报名成功' : ev.status === 'pending' ? '审核中' : '已拒绝'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderAppsView = () => {
        const myApps = interactions.filter(i => i.type !== 'event_signup'); // Signing, Booking, Drug
        return (
            <div className="p-4 space-y-3 animate-slideInRight">
                {myApps.length === 0 ? <div className="text-center text-slate-400 mt-10">暂无申请记录</div> : myApps.map(app => (
                    <div key={app.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                        <div>
                            <div className="text-xs text-slate-400 mb-1 uppercase font-bold">
                                {app.type==='signing'?'签约':app.type==='booking'?'预约':'开药'}
                            </div>
                            <div className="font-bold text-slate-800">{app.targetName}</div>
                            <div className="text-[10px] text-slate-500 mt-1">{app.details}</div>
                        </div>
                        <div className="text-right">
                            <span className={`text-xs px-2 py-1 rounded font-bold ${
                                app.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                app.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                            }`}>
                                {app.status === 'confirmed' ? '通过' : app.status === 'pending' ? '审核中' : '驳回'}
                            </span>
                            <div className="text-[10