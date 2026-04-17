
import React, { useState, useEffect } from 'react';
import { HealthRecord, HealthAssessment, FollowUpRecord, RiskLevel } from '../../types';
import { DailyHealthPlan, HealthArchive } from '../../services/dataService';
import { fetchInteractions, InteractionItem, updateInteractionStatus } from '../../services/contentService';

interface Props {
  record: HealthRecord;
  assessment?: HealthAssessment;
  dailyPlan?: DailyHealthPlan;
  userId: string;
  archive: HealthArchive;
  onUpdateRecord: (updatedData: any) => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void; 
}

export const UserProfile: React.FC<Props> = ({ record, assessment, dailyPlan, userId, archive, onUpdateRecord, onLogout, onNavigate }) => {
    const [subView, setSubView] = useState<'menu' | 'record' | 'followup' | 'plan' | 'events' | 'apps'>('menu');
    // ... (keep existing state/effects) ...
    const [interactions, setInteractions] = useState<InteractionItem[]>([]);
    
    // ... (keep existing methods: loadInteractions, handleSaveRecord, handleCancelInteraction) ...
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        height: record.checkup.basics.height || 0,
        weight: record.checkup.basics.weight || 0,
        sbp: record.checkup.basics.sbp || 0,
        dbp: record.checkup.basics.dbp || 0,
        glucose: record.checkup.labBasic.glucose?.fasting || '0'
    });

    useEffect(() => { loadInteractions(); }, [userId]);
    const loadInteractions = async () => { const all = await fetchInteractions(); setInteractions(all.filter(i => i.userId === userId)); };
    const handleSaveRecord = () => { onUpdateRecord(editForm); setIsEditing(false); };
    const handleCancelInteraction = async (id: string, type: string) => { 
        const label = type === 'doctor_signing' ? '签约' : '预约';
        if (confirm(`确定要取消此${label}吗？`)) {
            await updateInteractionStatus(id, 'cancelled');
            loadInteractions();
        }
    };

    // ... (keep renderRecordView, renderFollowupView) ...
    const renderRecordView = () => (
        <div className="p-4 space-y-6 animate-slideInRight pb-20">
            {/* 1. Risk Status Banner (Synced with Admin Report) */}
            <div className={`rounded-2xl p-5 text-white shadow-lg ${
                assessment?.riskLevel === 'RED' ? 'bg-gradient-to-r from-red-500 to-rose-600' :
                assessment?.riskLevel === 'YELLOW' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                'bg-gradient-to-r from-teal-500 to-emerald-600'
            }`}>
                <div className="flex justify-between items-start">
                    <div>
                        <div className="text-xs opacity-80 font-bold uppercase tracking-wider mb-1">综合风险评估</div>
                        <div className="text-3xl font-black mb-2">
                            {assessment?.riskLevel === 'RED' ? '高风险' : assessment?.riskLevel === 'YELLOW' ? '中风险' : '低风险'}
                        </div>
                        {assessment?.isCritical && (
                            <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded text-xs font-bold inline-block">
                                ⚠️ 存在危急/重大异常
                            </div>
                        )}
                    </div>
                    <div className="text-4xl opacity-30">
                        {assessment?.riskLevel === 'RED' ? '🚨' : assessment?.riskLevel === 'YELLOW' ? '⚠️' : '🛡️'}
                    </div>
                </div>
            </div>

            {/* 2. Basic Indicators (Editable) */}
            <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800">基础身体指标</h3>
                    <button onClick={() => setIsEditing(!isEditing)} className="text-xs text-teal-600 font-bold bg-teal-50 px-3 py-1.5 rounded">
                        {isEditing ? '取消' : '更新数据'}
                    </button>
                </div>
                
                {isEditing ? (
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div><label className="text-xs text-slate-400">身高(cm)</label><input className="w-full border p-2 rounded mt-1 bg-slate-50" type="number" value={editForm.height} onChange={e => setEditForm({...editForm, height: Number(e.target.value)})} /></div>
                        <div><label className="text-xs text-slate-400">体重(kg)</label><input className="w-full border p-2 rounded mt-1 bg-slate-50" type="number" value={editForm.weight} onChange={e => setEditForm({...editForm, weight: Number(e.target.value)})} /></div>
                        <div><label className="text-xs text-slate-400">收缩压</label><input className="w-full border p-2 rounded mt-1 bg-slate-50" type="number" value={editForm.sbp} onChange={e => setEditForm({...editForm, sbp: Number(e.target.value)})} /></div>
                        <div><label className="text-xs text-slate-400">舒张压</label><input className="w-full border p-2 rounded mt-1 bg-slate-50" type="number" value={editForm.dbp} onChange={e => setEditForm({...editForm, dbp: Number(e.target.value)})} /></div>
                        <div className="col-span-2"><button onClick={handleSaveRecord} className="w-full bg-teal-600 text-white py-3 rounded-lg font-bold shadow-md">保存修改</button></div>
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
            
            {/* 3. Detailed Risk Factors (Synced) */}
            <div className="space-y-4">
                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                    <h3 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span> 高危因素
                    </h3>
                    {assessment?.risks.red.length ? (
                        <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                            {assessment.risks.red.map((r,i) => <li key={i}>{r}</li>)}
                        </ul>
                    ) : <span className="text-xs text-slate-400 pl-4">无</span>}
                </div>
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                    <h3 className="font-bold text-yellow-800 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span> 中危因素
                    </h3>
                    {assessment?.risks.yellow.length ? (
                        <ul className="list-disc pl-5 text-sm text-yellow-800 space-y-1">
                            {assessment.risks.yellow.map((r,i) => <li key={i}>{r}</li>)}
                        </ul>
                    ) : <span className="text-xs text-slate-400 pl-4">无</span>}
                </div>
            </div>

            {/* 4. Full Management Plan (Synced) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 font-bold text-slate-700">
                    专属健康管理方案
                </div>
                <div className="divide-y divide-slate-100">
                    <PlanItem icon="🥗" title="饮食干预" items={assessment?.managementPlan.dietary} />
                    <PlanItem icon="🏃" title="运动方案" items={assessment?.managementPlan.exercise} />
                    <PlanItem icon="💊" title="医疗建议" items={assessment?.managementPlan.medication} />
                    <PlanItem icon="🔍" title="监测随访" items={assessment?.managementPlan.monitoring} />
                </div>
            </div>
        </div>
    );

    const renderFollowupView = () => (
        <div className="p-4 space-y-6 animate-slideInRight pb-20">
            {/* ... Execution Sheet ... */}
            <div className="bg-white rounded-xl shadow-lg border-t-4 border-blue-500 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        📋 下阶段执行单
                    </h3>
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                        遵医嘱执行
                    </span>
                </div>
                {/* ... existing details ... */}
            </div>
            
            {/* ... History List ... */}
        </div>
    );

    const renderPlanView = () => (
        <div className="p-4 space-y-4 animate-slideInRight">
            {dailyPlan ? (
                <>
                    <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800">今日 AI 方案</h3>
                            <span className="text-xs text-slate-400">{new Date(dailyPlan.generatedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="space-y-4">
                            {/* Text Plan */}
                            <div className="bg-slate-50 p-4 rounded-lg text-sm space-y-2">
                                <div className="flex gap-2"><span className="font-bold text-teal-600">早</span> {dailyPlan.diet.breakfast}</div>
                                <div className="flex gap-2"><span className="font-bold text-teal-600">午</span> {dailyPlan.diet.lunch}</div>
                                <div className="flex gap-2"><span className="font-bold text-teal-600">晚</span> {dailyPlan.diet.dinner}</div>
                                <div className="pt-2 border-t border-slate-200 text-xs opacity-70">💡 {dailyPlan.tips}</div>
                            </div>
                        </div>
                    </div>

                    {/* Recommendations Display */}
                    {(dailyPlan.recommendations?.meals?.length || dailyPlan.recommendations?.exercises?.length) ? (
                        <div className="bg-white rounded-xl shadow-sm p-5 border border-teal-100">
                            <h3 className="font-bold text-teal-800 mb-4 flex items-center gap-2">
                                <span>✨</span> 推荐执行项目
                            </h3>
                            <div className="space-y-3">
                                {dailyPlan.recommendations.meals.map((item, i) => (
                                    <div key={`rm-${i}`} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                        <div>
                                            <span className="mr-2">🥗</span>
                                            <span className="font-bold text-slate-700">{item.name}</span>
                                        </div>
                                        <div className="text-slate-500 font-mono text-xs">{item.calories} kcal</div>
                                    </div>
                                ))}
                                {dailyPlan.recommendations.exercises.map((item, i) => (
                                    <div key={`re-${i}`} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                        <div>
                                            <span className="mr-2">🏃</span>
                                            <span className="font-bold text-slate-700">{item.name}</span>
                                            <span className="text-xs text-slate-400 ml-2">({item.duration}min)</span>
                                        </div>
                                        <div className="text-slate-500 font-mono text-xs">{item.calories} kcal</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {/* Structured Logs Display */}
                    {(dailyPlan.dietLogs?.length || dailyPlan.exerciseLogs?.length) ? (
                        <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-4">执行记录详情</h3>
                            <div className="space-y-3">
                                {dailyPlan.dietLogs?.map((log, i) => (
                                    <div key={`d-${i}`} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                        <div>
                                            <span className="mr-2">🥗</span>
                                            <span className="font-bold text-slate-700">{log.name}</span>
                                        </div>
                                        <div className="text-teal-600 font-mono">+{log.calories} kcal</div>
                                    </div>
                                ))}
                                {dailyPlan.exerciseLogs?.map((log, i) => (
                                    <div key={`e-${i}`} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                        <div>
                                            <span className="mr-2">🏃</span>
                                            <span className="font-bold text-slate-700">{log.name}</span>
                                            <span className="text-xs text-slate-400 ml-2">({log.duration}min)</span>
                                        </div>
                                        <div className="text-orange-500 font-mono">-{log.calories} kcal</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-slate-400 text-sm py-4">暂无打卡记录</div>
                    )}
                </>
            ) : (
                <div className="text-center text-slate-400 mt-10">
                    <p>暂无今日方案</p>
                    <button onClick={() => onNavigate('diet_motion')} className="text-teal-600 font-bold mt-2">去生成</button>
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
                        {ev.status === 'pending' && (
                            <div className="text-right mt-2">
                                <button onClick={() => handleCancelInteraction(ev.id, 'event_signup')} className="text-xs text-slate-400 hover:text-red-500 underline">取消报名</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const renderAppsView = () => {
        // Categorize interactions
        const signedDoctors = interactions.filter(i => i.type === 'doctor_signing' && i.status === 'confirmed');
        const activeAppointments = interactions.filter(i => 
            (i.type === 'doctor_booking' || i.type === 'drug_order' || i.type === 'service_booking') && 
            i.status === 'confirmed'
        );
        const historyApps = interactions.filter(i => 
            i.type !== 'event_signup' && // Exclude events
            !(i.type === 'doctor_signing' && i.status === 'confirmed') && // Exclude active doctor
            !(i.status === 'confirmed' && (i.type === 'doctor_booking' || i.type === 'drug_order' || i.type === 'service_booking')) // Exclude active apps
        );

        return (
            <div className="p-4 space-y-6 animate-slideInRight pb-20">
                {/* 1. Signed Doctor Section */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                         <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <span className="text-xl">🩺</span> 我的签约医生
                        </h3>
                    </div>
                    
                    {signedDoctors.length > 0 ? (
                        signedDoctors.map(doc => (
                            <div key={doc.id} className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 shadow-lg text-white relative overflow-hidden">
                                {/* Decorative circle */}
                                <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                                
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl backdrop-blur-sm border border-white/30">
                                            👨‍⚕️
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold">{doc.targetName}</div>
                                            <div className="text-xs opacity-80 bg-white/20 px-2 py-0.5 rounded inline-block mt-1">家庭医生服务</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className="bg-green-400/20 text-green-100 border border-green-400/30 px-2 py-0.5 rounded text-xs font-bold">
                                            已签约
                                        </span>
                                        <button 
                                            onClick={() => handleCancelInteraction(doc.id, 'doctor_signing')}
                                            className="text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 px-2 py-0.5 rounded transition-colors"
                                        >
                                            解约
                                        </button>
                                    </div>
                                </div>
                                <div className="relative z-10 mt-2">
                                    <button 
                                        onClick={() => onNavigate('interaction')}
                                        className="w-full bg-white text-blue-700 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span className="text-lg">💬</span> 
                                        <span>去咨询</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-6 bg-white rounded-xl border border-dashed border-slate-200">
                            <div className="text-4xl opacity-30 mb-2">👨‍⚕️</div>
                            <p className="opacity-60 text-sm mb-3">您尚未签约家庭医生</p>
                            <button 
                                onClick={() => onNavigate('medical')}
                                className="bg-teal-600 text-white hover:bg-teal-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
                            >
                                前往签约
                            </button>
                        </div>
                    )}
                </div>

                {/* 2. Active Appointments */}
                <div>
                    <h3 className="font-bold text-slate-800 mb-3 px-1 border-l-4 border-teal-500 pl-2">我的预约服务</h3>
                    {activeAppointments.length === 0 ? (
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center text-slate-400 text-sm">
                            暂无生效中的预约
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activeAppointments.map(app => (
                                <div key={app.id} className="bg-white p-4 rounded-xl shadow-sm border border-teal-100 flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                                                app.type === 'doctor_booking' ? 'bg-blue-100 text-blue-700' :
                                                app.type === 'drug_order' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
                                            }`}>
                                                {app.type === 'doctor_booking' ? '门诊预约' : app.type === 'drug_order' ? '购药预约' : '服务预约'}
                                            </span>
                                            <span className="font-bold text-slate-800">{app.targetName}</span>
                                        </div>
                                        <div className="text-xs text-slate-500">{app.details}</div>
                                        <div className="text-xs text-slate-400 mt-1">预约日期: {app.date}</div>
                                    </div>
                                    <button 
                                        onClick={() => handleCancelInteraction(app.id, app.type)}
                                        className="text-xs bg-slate-50 text-slate-500 border border-slate-200 px-3 py-1.5 rounded hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                                    >
                                        取消预约
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. History List */}
                <div>
                    <h3 className="font-bold text-slate-800 mb-3 px-1 border-l-4 border-slate-300 pl-2">申请历史</h3>
                    {historyApps.length === 0 ? (
                        <div className="text-center text-slate-400 py-6 text-sm">无历史记录</div>
                    ) : (
                        <div className="space-y-3">
                            {historyApps.map(app => (
                                <div key={app.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center opacity-80">
                                    <div>
                                        <div className="text-xs text-slate-400 mb-1 uppercase font-bold">
                                            {
                                                app.type === 'doctor_signing' ? '签约申请' :
                                                app.type === 'doctor_booking' ? '挂号预约' :
                                                app.type === 'service_booking' ? '服务预约' :
                                                app.type === 'drug_order' ? '药品预约' :
                                                app.type === 'circle_join' ? '圈子申请' : '申请'
                                            }
                                        </div>
                                        <div className="font-bold text-slate-700">{app.targetName}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-xs px-2 py-1 rounded font-bold ${
                                            app.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                            app.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                            {app.status === 'confirmed' ? '已完成' : app.status === 'pending' ? '审核中' : '已取消/拒绝'}
                                        </span>
                                        <div className="text-xs text-slate-400 mt-1">{app.date}</div>
                                        {app.status === 'pending' && (
                                            <button onClick={() => handleCancelInteraction(app.id, app.type)} className="text-xs text-red-500 hover:underline mt-1 block w-full text-right">撤销申请</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-slate-50 min-h-full">
            {/* Header / ID Card */}
            <div className="relative bg-teal-700 px-5 pb-11 pt-6 text-white shadow-md">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl border-2 border-white/30 backdrop-blur-sm shadow-inner">
                        {record.profile.gender === '女' ? '👩' : '👨'}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">{record.profile.name}</h1>
                        <div className="mt-1 flex items-center gap-2 text-sm opacity-90">
                            <span className="bg-white/20 px-2 py-0.5 rounded backdrop-blur-sm">{record.profile.department}</span>
                            <span>{record.profile.age}岁</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="relative z-10 -mt-6 flex min-h-[calc(100dvh-180px)] flex-col rounded-t-3xl bg-slate-50">
                
                {/* Back Button for Sub Views */}
                {subView !== 'menu' && (
                    <div className="px-4 pt-6">
                        <button onClick={() => setSubView('menu')} className="flex items-center gap-1 text-slate-500 font-bold text-sm hover:text-teal-600 transition-colors">
                            <span>←</span> 返回菜单
                        </button>
                    </div>
                )}

                {subView === 'menu' && (
                    <div className="flex-1 space-y-3 p-4">
                        <MenuButton icon="📄" label="我的健康档案" desc="查看体检指标与风险评估" onClick={() => setSubView('record')} />
                        <MenuButton icon="📅" label="我的随访记录" desc="执行单与历史随访" onClick={() => setSubView('followup')} />
                        <MenuButton icon="🥗" label="我的饮食与运动方案" desc="查看今日AI定制计划" onClick={() => setSubView('plan')} />
                        <MenuButton icon="🎉" label="我的社区活动" desc="已报名的活动状态" onClick={() => setSubView('events')} />
                        <MenuButton icon="📝" label="我的申请记录" desc="签约、预约与开药历史" onClick={() => setSubView('apps')} />
                    </div>
                )}

                {subView === 'record' && renderRecordView()}
                {subView === 'followup' && renderFollowupView()}
                {subView === 'plan' && renderPlanView()}
                {subView === 'events' && renderEventsView()}
                {subView === 'apps' && renderAppsView()}

                {/* Logout Button (Only on Menu) */}
                {subView === 'menu' && (
                    <div className="mt-auto p-6 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                        <button 
                            onClick={onLogout}
                            className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-bold border border-red-100 hover:bg-red-100 hover:shadow-md transition-all active:scale-95"
                        >
                            退出登录
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const MenuButton: React.FC<{icon: string, label: string, desc: string, onClick: () => void}> = ({ icon, label, desc, onClick }) => (
    <button 
        onClick={onClick}
        className="group flex w-full items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md active:scale-95"
    >
        <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-xl group-hover:bg-teal-50 transition-colors">
            {icon}
        </div>
        <div className="flex-1">
            <div className="text-base font-bold text-slate-800">{label}</div>
            <div className="mt-0.5 text-sm text-slate-500">{desc}</div>
        </div>
        <span className="text-slate-300">›</span>
    </button>
);

const PlanItem: React.FC<{ icon: string, title: string, items?: string[] }> = ({ icon, title, items }) => (
    <div className="p-4 flex gap-4">
        <div className="text-xl pt-0.5">{icon}</div>
        <div className="flex-1">
            <div className="mb-1 text-base font-bold text-slate-800">{title}</div>
            {items && items.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4 text-sm text-slate-600">
                    {items.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
            ) : <div className="text-sm text-slate-400">暂无具体建议</div>}
        </div>
    </div>
);

const StatBox: React.FC<{ label: string, value: any, unit: string }> = ({ label, value, unit }) => (
    <div className="bg-slate-50 p-3 rounded-2xl text-center">
        <div className="mb-1 text-sm font-bold text-slate-400">{label}</div>
        <div className="text-lg font-black text-slate-700">{value}</div>
        {unit && <div className="text-xs text-slate-400">{unit}</div>}
    </div>
);
