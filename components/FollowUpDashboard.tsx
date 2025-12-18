
import React, { useState, useEffect } from 'react';
import { FollowUpRecord, RiskLevel, HealthAssessment, ScheduledFollowUp, HealthRecord, CriticalTrackRecord } from '../types';
import { HealthArchive, updateCriticalTrack } from '../services/dataService'; 
import { analyzeFollowUpRecord, generateFollowUpSMS, generateAnnualReportSummary } from '../services/geminiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine } from 'recharts';
import { CriticalHandleModal } from './CriticalHandleModal';

interface Props {
  records: FollowUpRecord[];
  assessment: HealthAssessment | null;
  schedule: ScheduledFollowUp[];
  onAddRecord: (record: Omit<FollowUpRecord, 'id'>) => void;
  allArchives?: HealthArchive[]; 
  onPatientChange?: (archive: HealthArchive) => void;
  currentPatientId?: string;
  onUpdateData?: (record: FollowUpRecord | null, schedule: ScheduledFollowUp[]) => void;
  isAuthenticated?: boolean;
  healthRecord?: HealthRecord | null;
  onRefresh?: () => void;
}

export const FollowUpDashboard: React.FC<Props> = ({ 
    records, assessment, schedule, onAddRecord, allArchives = [], 
    onPatientChange, currentPatientId, onUpdateData, isAuthenticated = false,
    healthRecord, onRefresh
}) => {
  const [isEntryExpanded, setIsEntryExpanded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<FollowUpRecord | null>(null);
  const [isEditingGuide, setIsEditingGuide] = useState(false);
  const [guideEditData, setGuideEditData] = useState({ plan: '', issues: '', goals: '', message: '', suggestedDate: '' });
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsContent, setSmsContent] = useState('');
  const [isGeneratingSms, setIsGeneratingSms] = useState(false);
  const [activeChart, setActiveChart] = useState<'bp' | 'metabolic' | 'lipids'>('bp');
  const [criticalModalArchive, setCriticalModalArchive] = useState<HealthArchive | null>(null);

  const pendingCriticalTasks = allArchives.filter(arch => {
      const track = arch.critical_track;
      if (!track || track.status === 'archived') return false;
      if (track.status === 'pending_initial') return true;
      if (track.status === 'pending_secondary' && track.secondary_due_date) {
          const today = new Date(); today.setHours(0,0,0,0);
          const due = new Date(track.secondary_due_date);
          const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 7; // 仅显示一周内需关注的
      }
      return false;
  }).sort((a, b) => {
      const tA = a.critical_track!;
      const tB = b.critical_track!;
      if (tA.status === 'pending_initial' && tB.status !== 'pending_initial') return -1;
      const dateA = tA.secondary_due_date ? new Date(tA.secondary_due_date).getTime() : 0;
      const dateB = tB.secondary_due_date ? new Date(tB.secondary_due_date).getTime() : 0;
      return dateA - dateB;
  });

  const maskName = (name: string) => {
      if (isAuthenticated) return name;
      return name ? name.charAt(0) + (name.length > 2 ? '**' : '*') : '***';
  };

  return (
    <div className="animate-fadeIn pb-10">
      {/* 核心预警中心：负责人视角 */}
      {pendingCriticalTasks.length > 0 && (
          <div className="mb-8 p-6 bg-slate-900 rounded-3xl shadow-2xl border border-slate-700 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(220,38,38,0.4)] animate-pulse">🚨</div>
                      <div>
                          <h2 className="text-xl font-black text-white tracking-tight">危急值追踪舱</h2>
                          <p className="text-slate-400 text-xs mt-1">系统已锁定 {pendingCriticalTasks.length} 位近七天需执行干预的人员</p>
                      </div>
                  </div>
                  <div className="bg-red-950/50 border border-red-900 px-4 py-1.5 rounded-full text-[10px] font-bold text-red-400 uppercase tracking-widest">High Priority</div>
              </div>
              
              <div className="flex overflow-x-auto pb-2 gap-5 scrollbar-thin scrollbar-thumb-slate-700">
                  {pendingCriticalTasks.map((arch) => {
                      const track = arch.critical_track!;
                      const isInitial = track.status === 'pending_initial';
                      const due = new Date(track.secondary_due_date);
                      const today = new Date(); today.setHours(0,0,0,0);
                      const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                      let statusBadge = { text: '待初次通知', style: 'bg-red-600 text-white' };
                      if (!isInitial) {
                          if (diffDays < 0) statusBadge = { text: `逾期 ${Math.abs(diffDays)} 天`, style: 'bg-rose-700 text-white animate-pulse' };
                          else if (diffDays === 0) statusBadge = { text: '今日需回访', style: 'bg-orange-500 text-white' };
                          else statusBadge = { text: `剩 ${diffDays} 天回访`, style: 'bg-blue-600 text-white' };
                      }

                      return (
                          <div key={arch.id} onClick={() => setCriticalModalArchive(arch)} className="bg-slate-800 border border-slate-700 p-5 rounded-2xl min-w-[320px] hover:border-teal-500 transition-all cursor-pointer group shadow-lg">
                              <div className="flex justify-between items-start mb-4">
                                  <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-tight ${statusBadge.style}`}>
                                      {statusBadge.text}
                                  </span>
                                  <span className="text-slate-500 text-[10px] font-mono">ID: {arch.checkup_id}</span>
                              </div>
                              <div className="flex items-center gap-4 mb-4">
                                  <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-2xl border-2 border-slate-600 shadow-inner">
                                      {arch.gender === '女' ? '👩' : '👨'}
                                  </div>
                                  <div>
                                      <div className="font-bold text-slate-100 text-lg leading-none">{maskName(arch.name)}</div>
                                      <div className="text-xs text-slate-500 mt-1.5">{arch.age}岁 · {arch.department}</div>
                                  </div>
                              </div>
                              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700 mb-4 h-16 overflow-hidden">
                                  <div className="text-[10px] text-slate-500 font-bold mb-1">追踪项：{track.critical_item}</div>
                                  <div className="text-xs text-red-400 font-medium line-clamp-2">{track.critical_desc}</div>
                              </div>
                              <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-slate-500">{isInitial ? '发现日期: ' + track.initial_notify_time.split(' ')[0] : '计划回访: ' + track.secondary_due_date}</span>
                                  <button className="text-xs bg-teal-600 text-white px-4 py-1.5 rounded-lg font-bold group-hover:bg-teal-500 transition-colors shadow-lg shadow-teal-900/20">立即处置</button>
                              </div>
                          </div>
                      )
                  })}
              </div>
          </div>
      )}

      {/* 现有布局：核心指标、任务清单等 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
             <div className="flex justify-between items-center mb-6">
                 <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><span>📈</span> 关键指标趋势</h2>
                 <div className="flex bg-slate-100 rounded-lg p-1">
                     {[{id: 'bp', label: '血压'}, {id: 'metabolic', label: '血糖/体重'}].map(tab => (
                         <button key={tab.id} onClick={() => setActiveChart(tab.id as any)} className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${activeChart === tab.id ? 'bg-white shadow text-teal-700' : 'text-slate-500'}`}>{tab.label}</button>
                     ))}
                 </div>
             </div>
             <div className="h-[300px] w-full">
                <ResponsiveContainer>
                    <LineChart data={records.map(r => ({ date: r.date, sbp: r.indicators.sbp, dbp: r.indicators.dbp, glucose: r.indicators.glucose }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                        {activeChart === 'bp' ? (
                            <>
                                <Line type="monotone" dataKey="sbp" name="收缩压" stroke="#ef4444" strokeWidth={3} dot={{r:4, fill:'#ef4444'}} />
                                <Line type="monotone" dataKey="dbp" name="舒张压" stroke="#f97316" strokeWidth={3} dot={{r:4, fill:'#f97316'}} />
                            </>
                        ) : (
                            <Line type="monotone" dataKey="glucose" name="血糖" stroke="#0ea5e9" strokeWidth={3} dot={{r:4, fill:'#0ea5e9'}} />
                        )}
                    </LineChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
            <h2 className="text-lg font-bold text-slate-800 mb-4">📅 待执行随访</h2>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {schedule.filter(s => s.status === 'pending').map(s => (
                    <div key={s.id} className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 group hover:bg-blue-50 transition-colors">
                        <div className="text-[10px] text-blue-600 font-black mb-1">{s.date}</div>
                        <div className="text-sm font-bold text-slate-800">例行健康回访</div>
                        <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">{s.focusItems.join('、')}</div>
                    </div>
                ))}
            </div>
            <button onClick={() => setIsEntryExpanded(!isEntryExpanded)} className="mt-4 w-full py-2.5 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all active:scale-95 shadow-lg shadow-teal-100">
                {isEntryExpanded ? '收起表单' : '录入本次结果'}
            </button>
          </div>
      </div>

      {criticalModalArchive && (
          <CriticalHandleModal 
              archive={criticalModalArchive} 
              onClose={() => setCriticalModalArchive(null)} 
              onSave={async (record) => {
                  await updateCriticalTrack(criticalModalArchive.checkup_id, record);
                  setCriticalModalArchive(null);
                  if (onRefresh) onRefresh();
              }} 
          />
      )}
    </div>
  );
};
