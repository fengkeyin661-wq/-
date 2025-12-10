
import React, { useState, useEffect } from 'react';
import { HealthRecord, HealthAssessment, FollowUpRecord, RiskLevel } from '../../types';
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

    // Derive Latest Execution Data (Sync with Admin FollowUpDashboard logic)
    const sortedRecords = [...archive.follow_ups].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latestRecord = sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1] : null;
    
    // Construct the "Active Plan" (Execution Sheet)
    // If there is a recent follow-up, use its instructions; otherwise use the initial assessment
    const executionSheet = {
        dateLabel: latestRecord ? "下次复查建议" : "建议随访频率",
        dateValue: latestRecord ? "请遵医嘱定期复查" : assessment?.followUpPlan.frequency,
        items: latestRecord ? latestRecord.assessment.nextCheckPlan : assessment?.followUpPlan.nextCheckItems.join('、'),
        goals: latestRecord 
            ? latestRecord.assessment.lifestyleGoals 
            : [...(assessment?.managementPlan.dietary.slice(0,2) || []), ...(assessment?.managementPlan.exercise.slice(0,2) || [])],
        message: latestRecord ? latestRecord.assessment.doctorMessage : "健康是长期的积累，请坚持执行管理方案。",
        issues: latestRecord ? latestRecord.assessment.majorIssues : assessment?.summary
    };

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
            {/* 1. Execution Sheet Card (The most important thing for patient) */}
            <div className="bg-white rounded-xl shadow-lg border-t-4 border-blue-500 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        📋 下阶段执行单
                    </h3>
                    <span className="text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                        遵医嘱执行
                    </span>
                </div>
                <div className="p-5 space-y-5">
                    {/* Next Checkup Info */}
                    <div className="flex gap-4 items-start">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-xl shrink-0">📅</div>
                        <div>
                            <div className="text-xs text-slate-400 font-bold uppercase">{executionSheet.dateLabel}</div>
                            <div className="font-bold text-slate-800 text-lg mb-1">{executionSheet.dateValue}</div>
                            <div className="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                                <span className="font-bold text-xs text-slate-400 block mb-1">重点复查:</span>
                                {executionSheet.items || '常规复查'}
                            </div>
                        </div>
                    </div>

                    {/* Goals */}
                    <div className="flex gap-4 items-start">
                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center text-xl shrink-0">🎯</div>
                        <div className="flex-1">
                            <div className="text-xs text-slate-400 font-bold uppercase mb-1">生活方式目标</div>
                            {executionSheet.goals && executionSheet.goals.length > 0 ? (
                                <ul className="space-y-1">
                                    {(typeof executionSheet.goals === 'string' ? [executionSheet.goals] : executionSheet.goals).map((g,i) => (
                                        <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                                            <span className="text-green-500 font-bold">✓</span> {g}
                                        </li>
                                    ))}
                                </ul>
                            ) : <div className="text-sm text-slate-400">暂无具体目标</div>}
                        </div>
                    </div>

                    {/* Doctor Message */}
                    <div className="bg-slate-800 text-white p-4 rounded-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 text-6xl opacity-10 -mr-2 -mt-2">💬</div>
                        <div className="text-xs text-slate-400 font-bold uppercase mb-1">医生寄语</div>
                        <div className="text-sm font-medium italic">"{executionSheet.message}"</div>
                    </div>
                </div>
            </div>

            {/* 2. History List */}
            <div>
                <h3 className="font-bold text-slate-800 mb-3 px-1">历史随访记录</h3>
                {archive.follow_ups.length === 0 ? (
                    <div className="text-center text-slate-400 py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        暂无历史记录
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sortedRecords.reverse().map((fu, idx) => (
                            <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="font-bold text-slate-700 text-lg">{fu.date}</span>
                                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">{fu.method}随访</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 mb-3">
                                    <div className="bg-slate-50 p-2 rounded">
                                        <span className="block text-slate-400 scale-90 origin-left">血压</span>
                                        <span className="font-bold text-slate-700 text-sm">{fu.indicators.sbp}/{fu.indicators.dbp}</span>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded">
                                        <span className="block text-slate-400 scale-90 origin-left">依从性</span>
                                        <span className="font-bold text-slate-700 text-sm">{fu.medication.compliance}</span>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-600 border-t border-slate-100 pt-2 mt-2">
                                    <span className="font-bold text-slate-400 mr-1">评估结论:</span>
                                    {fu.assessment.majorIssues || '情况稳定'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    const renderPlanView = () => (
        <div className="p-4 space-y-4 animate-slideInRight">
            {dailyPlan ? (
                <>
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

                    {/* Added Logs Section */}
                    {(dailyPlan.dietLogs && dailyPlan.dietLogs.length > 0 || dailyPlan.exerciseLogs && dailyPlan.exerciseLogs.length > 0) && (
                        <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-4">今日打卡记录</h3>
                            <div className="space-y-3">
                                {dailyPlan.dietLogs?.map((log, i) => (
                                    <div key={`d-${i}`} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">🥗</span>
                                            <div>
                                                <div className="font-bold text-slate-700">{log.name}</div>
                                                <div className="text-[10px] text-slate-400">
                                                    {log.type === 'breakfast' ? '早餐' : log.type === 'lunch' ? '午餐' : log.type === 'dinner' ? '晚餐' : '加餐'}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="font-bold text-teal-600">+{log.calories} kcal</span>
                                    </div>
                                ))}
                                {dailyPlan.exerciseLogs?.map((log, i) => (
                                    <div key={`e-${i}`} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">🏃</span>
                                            <div>
                                                <div className="font-bold text-slate-700">{log.name}</div>
                                                <div className="text-[10px] text-slate-400">{log.duration} 分钟</div>
                                            </div>
                                        </div>
                                        <span className="font-bold text-orange-500">-{log.calories} kcal</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
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
        const myApps = interactions.filter(i => i.type !== 'event_signup'); // Signing, Booking, Drug, Circle, Service
        return (
            <div className="p-4 space-y-3 animate-slideInRight">
                {myApps.length === 0 ? <div className="text-center text-slate-400 mt-10">暂无申请记录</div> : myApps.map(app => (
                    <div key={app.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
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
                            <div className="text-[10px] text-slate-400 mt-1">{app.date}</div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="bg-slate-50 min-h-full">
            {/* Header / ID Card */}
            <div className="bg-teal-700 text-white p-6 pb-12 relative shadow-md">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl border-2 border-white/30 backdrop-blur-sm shadow-inner">
                        {record.profile.gender === '女' ? '👩' : '👨'}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">{record.profile.name}</h1>
                        <div className="text-xs opacity-80 mt-1 flex items-center gap-2">
                            <span className="bg-white/20 px-2 py-0.5 rounded backdrop-blur-sm">{record.profile.department}</span>
                            <span>{record.profile.age}岁</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="-mt-6 bg-slate-50 rounded-t-3xl min-h-[calc(100vh-180px)] flex flex-col">
                
                {/* Back Button for Sub Views */}
                {subView !== 'menu' && (
                    <div className="px-4 pt-4">
                        <button onClick={() => setSubView('menu')} className="flex items-center gap-1 text-slate-500 font-bold text-sm hover:text-teal-600 transition-colors">
                            <span>←</span> 返回菜单
                        </button>
                    </div>
                )}

                {subView === 'menu' && (
                    <div className="p-4 space-y-3 flex-1">
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
                    <div className="p-6 mt-auto">
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
        className="w-full bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all active:scale-95 text-left group"
    >
        <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-xl group-hover:bg-teal-50 transition-colors">
            {icon}
        </div>
        <div className="flex-1">
            <div className="font-bold text-slate-800 text-sm">{label}</div>
            <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
        </div>
        <span className="text-slate-300">›</span>
    </button>
);

const PlanItem: React.FC<{ icon: string, title: string, items?: string[] }> = ({ icon, title, items }) => (
    <div className="p-4 flex gap-4">
        <div className="text-xl pt-0.5">{icon}</div>
        <div className="flex-1">
            <div className="font-bold text-slate-800 text-sm mb-1">{title}</div>
            {items && items.length > 0 ? (
                <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
                    {items.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
            ) : <div className="text-xs text-slate-400">暂无具体建议</div>}
        </div>
    </div>
);

const StatBox: React.FC<{ label: string, value: any, unit: string }> = ({ label, value, unit }) => (
    <div className="bg-slate-50 p-3 rounded-2xl text-center">
        <div className="text-xs text-slate-400 mb-1 font-bold">{label}</div>
        <div className="text-lg font-black text-slate-700">{value}</div>
        {unit && <div className="text-[10px] text-slate-400">{unit}</div>}
    </div>
);
