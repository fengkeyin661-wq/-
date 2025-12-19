
import React, { useState, useEffect } from 'react';
import { HealthRecord, HealthAssessment, RiskLevel } from '../../types';
import { DailyHealthPlan, HealthArchive } from '../../services/dataService';
import { fetchInteractions, InteractionItem, updateInteractionStatus, fetchContent, ContentItem } from '../../services/contentService';

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
    const [interactions, setInteractions] = useState<InteractionItem[]>([]);
    const [recommendations, setRecommendations] = useState<{item: ContentItem, reason: string}[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        height: record.checkup.basics?.height || 0,
        weight: record.checkup.basics?.weight || 0,
        sbp: record.checkup.basics?.sbp || 0,
        dbp: record.checkup.basics?.dbp || 0,
        glucose: record.checkup.labBasic?.glucose?.fasting || '0'
    });

    useEffect(() => { loadInteractions(); loadRecommendations(); }, [userId, assessment]);

    const loadInteractions = async () => { const all = await fetchInteractions(); setInteractions(all.filter(i => i.userId === userId)); };

    const loadRecommendations = async () => {
        if (!assessment) return;
        const risks = [...(assessment.risks?.red || []), ...(assessment.risks?.yellow || [])];
        const keywords = ['高血压', '糖尿病', '血脂', '尿酸', '痛风', '结节', '肥胖', '心', '肝', '胃', '睡眠', '颈椎'];
        const matchedKeys = keywords.filter(key => risks.some(r => r.includes(key)) || assessment.summary.includes(key));
        if (matchedKeys.length === 0) matchedKeys.push('健康');

        const allResources = await fetchContent();
        const matches: {item: ContentItem, reason: string}[] = [];
        allResources.forEach(res => {
            const resText = (res.title + (res.description || '')).toLowerCase();
            const foundKey = matchedKeys.find(key => resText.includes(key.toLowerCase()));
            if (foundKey && matches.length < 5) {
                matches.push({ item: res, reason: `针对您的[${foundKey}]风险推荐` });
            }
        });
        setRecommendations(matches);
    };

    const handleSaveRecord = () => { onUpdateRecord(editForm); setIsEditing(false); };
    
    const handleCancelInteraction = async (id: string, type: string) => { 
        const label = type === 'doctor_signing' ? '签约' : '预约';
        if (confirm(`确定要取消此${label}吗？`)) {
            await updateInteractionStatus(id, 'cancelled');
            loadInteractions();
        }
    };

    const renderRecordView = () => (
        <div className="p-4 space-y-6 animate-slideInRight pb-20">
            {/* 1. 针对性干预推荐 - 纵向排列版本 */}
            {recommendations.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">智能干预建议</h3>
                    {recommendations.map((rec, idx) => (
                        <div key={idx} 
                            onClick={() => {
                                if (rec.item.type === 'doctor') onNavigate('medical');
                                else if (rec.item.type === 'meal') onNavigate('diet_motion');
                                else onNavigate('community');
                            }}
                            className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer"
                        >
                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl shrink-0">
                                {rec.item.image && rec.item.image.length < 5 ? rec.item.image : (rec.item.type === 'doctor' ? '👨‍⚕️' : '🥗')}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[9px] font-black text-teal-600 uppercase mb-0.5">{rec.reason}</div>
                                <h4 className="font-bold text-slate-800 text-sm truncate">{rec.item.title}</h4>
                                <p className="text-[10px] text-slate-400 truncate mt-0.5">{rec.item.description || '点击查看详情'}</p>
                            </div>
                            <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                                →
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 2. 风险评定状态 */}
            <div className={`rounded-[2.5rem] p-6 text-white shadow-xl ${
                assessment?.riskLevel === 'RED' ? 'bg-gradient-to-br from-red-500 to-rose-600' :
                assessment?.riskLevel === 'YELLOW' ? 'bg-gradient-to-br from-orange-400 to-amber-500' :
                'bg-gradient-to-br from-teal-500 to-emerald-600'
            }`}>
                <div className="flex justify-between items-start">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">AI 健康等级</div>
                        <div className="text-4xl font-black mb-3">
                            {assessment?.riskLevel === 'RED' ? '高风险' : assessment?.riskLevel === 'YELLOW' ? '中风险' : '低风险'}
                        </div>
                        <div className="bg-black/10 rounded-2xl p-3 backdrop-blur-sm border border-white/10">
                            <p className="text-xs leading-relaxed opacity-90 line-clamp-3 italic">
                                {assessment?.summary || '档案正在同步中...'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. 基础指标 */}
            <div className="bg-white rounded-[2.5rem] shadow-sm p-6 border border-slate-100">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="font-bold text-slate-800">核心指标</h3>
                    <button onClick={() => setIsEditing(!isEditing)} className="text-[10px] font-black text-teal-600 bg-teal-50 px-3 py-1.5 rounded-full uppercase tracking-widest">
                        {isEditing ? '取消' : '手动修正'}
                    </button>
                </div>
                
                {isEditing ? (
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase">体重(kg)</label><input className="w-full border-none bg-slate-50 rounded-xl p-3 mt-1" type="number" value={editForm.weight} onChange={e => setEditForm({...editForm, weight: Number(e.target.value)})} /></div>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase">收缩压</label><input className="w-full border-none bg-slate-50 rounded-xl p-3 mt-1" type="number" value={editForm.sbp} onChange={e => setEditForm({...editForm, sbp: Number(e.target.value)})} /></div>
                        <div className="col-span-2"><button onClick={handleSaveRecord} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-transform">保存数据</button></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3">
                        <StatBox label="BMI" value={record.checkup.basics?.bmi || '--'} />
                        <StatBox label="血压" value={`${record.checkup.basics?.sbp || '--'}/${record.checkup.basics?.dbp || '--'}`} />
                        <StatBox label="血糖" value={record.checkup.labBasic?.glucose?.fasting || '--'} />
                    </div>
                )}
            </div>

            {/* 4. 管理方案 */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 font-black text-slate-400 text-[10px] uppercase tracking-widest">
                    重点干预方案
                </div>
                <div className="divide-y divide-slate-50">
                    <PlanItem icon="🥗" title="饮食建议" items={assessment?.managementPlan?.dietary} />
                    <PlanItem icon="🏃" title="运动建议" items={assessment?.managementPlan?.exercise} />
                </div>
            </div>
        </div>
    );

    const renderFollowupView = () => (
        <div className="p-4 space-y-6 animate-slideInRight pb-20">
            <div className="bg-white rounded-[2.5rem] shadow-lg border-t-4 border-blue-500 overflow-hidden p-6">
                <h3 className="font-black text-slate-800 flex items-center gap-2 mb-4">📋 下阶段执行单</h3>
                <div className="bg-blue-50 p-4 rounded-2xl mb-4">
                    <div className="text-[10px] text-blue-400 font-black uppercase mb-1">重点复查项目</div>
                    <div className="text-blue-800 font-bold">{assessment?.followUpPlan?.nextCheckItems?.join('、') || '常规复查'}</div>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>建议频率: {assessment?.followUpPlan?.frequency || '暂无'}</span>
                </div>
            </div>
        </div>
    );

    const renderPlanView = () => (
        <div className="p-4 space-y-4 animate-slideInRight">
            <div className="bg-white rounded-[2.5rem] shadow-sm p-6 border border-teal-100">
                <h3 className="font-black text-teal-800 mb-4">今日 AI 定制方案</h3>
                {dailyPlan ? (
                    <div className="bg-slate-50 p-5 rounded-2xl text-sm space-y-3">
                        <div className="flex gap-3"><span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">早</span> <span className="font-bold">{dailyPlan.diet.breakfast}</span></div>
                        <div className="flex gap-3"><span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">午</span> <span className="font-bold">{dailyPlan.diet.lunch}</span></div>
                        <div className="flex gap-3"><span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">晚</span> <span className="font-bold">{dailyPlan.diet.dinner}</span></div>
                        <div className="pt-3 border-t border-slate-200 text-xs text-slate-400">💡 {dailyPlan.tips}</div>
                    </div>
                ) : (
                    <div className="text-center text-slate-400 py-10">暂未生成今日方案，请前往“记录”板块</div>
                )}
            </div>
        </div>
    );

    return (
        <div className="bg-[#F8FAFC] min-h-full">
            <div className="bg-teal-700 text-white p-8 pb-14 relative shadow-2xl">
                <div className="flex items-center gap-5">
                    <div className="w-20 h-20 bg-white/20 rounded-[2rem] flex items-center justify-center text-4xl border-2 border-white/30 backdrop-blur-md shadow-inner">
                        {record.profile.gender === '女' ? '👩‍🏫' : '👨‍🏫'}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">{record.profile.name}</h1>
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mt-2 flex items-center gap-3">
                            <span className="bg-white/20 px-2 py-1 rounded backdrop-blur-sm">{record.profile.department}</span>
                            <span>{record.profile.age}岁</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="-mt-8 bg-[#F8FAFC] rounded-t-[3rem] min-h-[calc(100vh-180px)] flex flex-col relative z-10">
                {subView !== 'menu' && (
                    <div className="px-6 pt-6">
                        <button onClick={() => setSubView('menu')} className="text-slate-400 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                            <span>←</span> 返回菜单
                        </button>
                    </div>
                )}

                {subView === 'menu' && (
                    <div className="p-6 space-y-4 flex-1">
                        <MenuButton icon="📄" label="体检报告解读" desc="核心指标、风险画像与干预建议" onClick={() => setSubView('record')} />
                        <MenuButton icon="📅" label="随访执行单" desc="查看医生下发的复查计划" onClick={() => setSubView('followup')} />
                        <MenuButton icon="🥗" label="今日饮食方案" desc="查看AI生成的膳食与运动指南" onClick={() => setSubView('plan')} />
                        <MenuButton icon="📝" label="我的申请进度" desc="咨询、预约与签约记录" onClick={() => setSubView('apps')} />
                        
                        <div className="pt-10">
                            <button onClick={onLogout} className="w-full bg-white text-rose-500 py-4 rounded-2xl font-black text-sm border border-rose-50 shadow-sm active:scale-95 transition-all">退出系统</button>
                        </div>
                    </div>
                )}

                {subView === 'record' && renderRecordView()}
                {subView === 'followup' && renderFollowupView()}
                {subView === 'plan' && renderPlanView()}
                {subView === 'apps' && (
                    <div className="p-4 space-y-4 animate-slideInRight">
                        {interactions.length === 0 ? <div className="text-center py-20 text-slate-300">暂无申请记录</div> : interactions.map(app => (
                            <div key={app.id} className="bg-white p-5 rounded-[2rem] border border-slate-50 shadow-sm flex justify-between items-center">
                                <div>
                                    <div className="text-[9px] font-black text-slate-300 uppercase mb-1">{app.type}</div>
                                    <div className="font-bold text-slate-800">{app.targetName}</div>
                                    <div className="text-[10px] text-slate-400 mt-1">{app.date}</div>
                                </div>
                                <span className={`text-[10px] px-2 py-1 rounded-full font-black uppercase ${
                                    app.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                    {app.status === 'confirmed' ? '已完成' : '审核中'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const MenuButton: React.FC<{icon: string, label: string, desc: string, onClick: () => void}> = ({ icon, label, desc, onClick }) => (
    <button 
        onClick={onClick}
        className="w-full bg-white p-5 rounded-[2.5rem] border border-slate-50 shadow-sm flex items-center gap-5 hover:shadow-md transition-all active:scale-95 text-left group"
    >
        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl group-hover:bg-teal-50 transition-colors">
            {icon}
        </div>
        <div className="flex-1">
            <div className="font-bold text-slate-800 text-base">{label}</div>
            <div className="text-[10px] text-slate-400 mt-1 uppercase font-medium">{desc}</div>
        </div>
        <span className="text-slate-200 font-black text-xl">›</span>
    </button>
);

const PlanItem: React.FC<{ icon: string, title: string, items?: string[] }> = ({ icon, title, items }) => (
    <div className="p-6 flex gap-5">
        <div className="text-2xl pt-1">{icon}</div>
        <div className="flex-1">
            <div className="font-black text-slate-800 text-sm mb-2">{title}</div>
            {items && items.length > 0 ? (
                <ul className="space-y-2">
                    {items.map((item, i) => (
                        <li key={i} className="text-xs text-slate-500 flex items-start gap-2">
                            <span className="w-1 h-1 rounded-full bg-teal-500 mt-1.5 shrink-0"></span>
                            {item}
                        </li>
                    ))}
                </ul>
            ) : <div className="text-xs text-slate-300 italic">暂无具体建议</div>}
        </div>
    </div>
);

const StatBox: React.FC<{ label: string, value: any }> = ({ label, value }) => (
    <div className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-100">
        <div className="text-[9px] text-slate-400 mb-1 font-black uppercase tracking-widest">{label}</div>
        <div className="text-lg font-black text-slate-700">{value}</div>
    </div>
);
