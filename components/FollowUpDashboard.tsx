
import React, { useState, useEffect } from 'react';
import { FollowUpRecord, RiskLevel, HealthAssessment, ScheduledFollowUp, HealthRecord, CriticalTrackRecord } from '../types';
import { HealthArchive, updateCriticalTrack } from '../services/dataService'; 
import { analyzeFollowUpRecord, generateFollowUpSMS } from '../services/geminiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
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
  const [activeChart, setActiveChart] = useState<'bp' | 'metabolic' | 'lipids'>('bp');
  const [criticalModalArchive, setCriticalModalArchive] = useState<HealthArchive | null>(null);

  // 核心逻辑：负责人视角的任务扫描
  const pendingCriticalTasks = allArchives.filter(arch => {
      const track = arch.critical_track;
      if (!track || track.status === 'archived') return false;

      // 1. 待初次通知：永远显示
      if (track.status === 'pending_initial') return true;

      // 2. 待二次回访：仅在计划日期一周内或已逾期时显示
      if (track.status === 'pending_secondary' && track.secondary_due_date) {
          const today = new Date();
          today.setHours(0,0,0,0);
          const due = new Date(track.secondary_due_date);
          const diffTime = due.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          return diffDays <= 7; // 关键：提前一周开始提醒
      }
      return false;
  }).sort((a, b) => {
      const getPriority = (arch: HealthArchive) => {
          const t = arch.critical_track!;
          if (t.status === 'pending_initial') return 100;
          const due = new Date(t.secondary_due_date).getTime();
          const now = Date.now();
          return now > due ? 50 : 10; // 逾期优先级高于普通提醒
      };
      return getPriority(b) - getPriority(a);
  });

  const maskName = (name: string) => {
      if (isAuthenticated) return name;
      return name ? name.charAt(0) + (name.length > 2 ? '**' : '*') : '***';
  };

  return (
    <div className="animate-fadeIn pb-10">
      {/* 负责人驾驶舱：高优先级任务预警区 */}
      {pendingCriticalTasks.length > 0 && (
          <div className="mb-8 p-6 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700">
              <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                          <span className="text-white text-xl">🚨</span>
                      </div>
                      <div>
                          <h2 className="text-xl font-bold text-white">健康追踪预警中心</h2>
                          <p className="text-slate-400 text-xs mt-1">系统已自动识别需立即介入或一周内需回访的重点人群</p>
                      </div>
                  </div>
                  <span className="bg-red-600 text-white px-4 py-1 rounded-full text-sm font-black">
                      {pendingCriticalTasks.length} 项待办
                  </span>
              </div>
              
              <div className="flex overflow-x-auto pb-2 gap-4 scrollbar-thin scrollbar-thumb-slate-700">
                  {pendingCriticalTasks.map((arch) => {
                      const track = arch.critical_track!;
                      const isInitial = track.status === 'pending_initial';
                      
                      const due = new Date(track.secondary_due_date);
                      const today = new Date();
                      today.setHours(0,0,0,0);
                      const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                      let statusLabel = '';
                      let statusColor = '';
                      if (isInitial) {
                          statusLabel = '待初次通知';
                          statusColor = 'bg-red-600';
                      } else if (diffDays < 0) {
                          statusLabel = `已逾期 ${Math.abs(diffDays)} 天`;
                          statusColor = 'bg-rose-700 animate-pulse';
                      } else if (diffDays === 0) {
                          statusLabel = '今日需回访';
                          statusColor = 'bg-orange-600';
                      } else {
                          statusLabel = `剩 ${diffDays} 天回访`;
                          statusColor = 'bg-blue-600';
                      }

                      return (
                          <div 
                              key={arch.id}
                              onClick={() => setCriticalModalArchive(arch)}
                              className="bg-slate-800 border border-slate-700 p-4 rounded-xl min-w-[300px] hover:border-teal-500 transition-all cursor-pointer group"
                          >
                              <div className="flex justify-between items-start mb-3">
                                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${statusColor}`}>
                                      {statusLabel}
                                  </div>
                                  <span className="text-slate-500 text-[10px] font-mono">#{arch.checkup_id}</span>
                              </div>
                              <div className="flex items-center gap-3 mb-4">
                                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">
                                      {arch.gender === '女' ? '👩' : '👨'}
                                  </div>
                                  <div>
                                      <div className="font-bold text-slate-100">{maskName(arch.name)}</div>
                                      <div className="text-xs text-slate-500">{arch.department}</div>
                                  </div>
                              </div>
                              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 mb-3">
                                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">异常点追踪</div>
                                  <div className="text-xs text-red-400 font-bold line-clamp-1">{track.critical_item}</div>
                              </div>
                              <div className="flex justify-between items-center">
                                  <div className="text-[10px] text-slate-500">
                                      {isInitial ? '发现日期: ' + track.initial_notify_time.split(' ')[0] : '计划日期: ' + track.secondary_due_date}
                                  </div>
                                  <button className="text-xs bg-teal-600 text-white px-3 py-1 rounded font-bold group-hover:bg-teal-500 transition-colors">
                                      立即处理
                                  </button>
                              </div>
                          </div>
                      )
                  })}
              </div>
          </div>
      )}

      {/* 现有的趋势图表与录入区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="flex justify-between items-center mb-6">
                 <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span>📈</span> 指标趋势监测
                 </h2>
                 <div className="flex bg-slate-100 rounded-lg p-1">
                     {[{id: 'bp', label: '血压'}, {id: 'metabolic', label: '血糖/体重'}].map(tab => (
                         <button key={tab.id} onClick={() => setActiveChart(tab.id as any)} className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${activeChart === tab.id ? 'bg-white shadow text-teal-700' : 'text-slate-500'}`}>{tab.label}</button>
                     ))}
                 </div>
             </div>
             <div className="h-[300px] w-full">
                <ResponsiveContainer>
                    <LineChart data={records.map(r => ({ date: r.date, sbp: r.indicators.sbp, dbp: r.indicators.dbp, glucose: r.indicators.glucose }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" fontSize={10} />
                        <YAxis fontSize={10} />
                        <Tooltip />
                        {activeChart === 'bp' ? (
                            <>
                                <Line type="monotone" dataKey="sbp" name="收缩压" stroke="#ef4444" strokeWidth={3} dot={{r:4}} />
                                <Line type="monotone" dataKey="dbp" name="舒张压" stroke="#f97316" strokeWidth={3} dot={{r:4}} />
                            </>
                        ) : (
                            <Line type="monotone" dataKey="glucose" name="血糖" stroke="#0ea5e9" strokeWidth={3} dot={{r:4}} />
                        )}
                    </LineChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <h2 className="text-lg font-bold text-slate-800 mb-4">📅 随访任务清单</h2>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {schedule.filter(s => s.status === 'pending').map(s => (
                    <div key={s.id} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="text-xs text-blue-600 font-bold mb-1">{s.date}</div>
                        <div className="text-sm font-bold text-slate-800">常规随访</div>
                        <div className="text-[10px] text-slate-500 mt-1">{s.focusItems.join(', ')}</div>
                    </div>
                ))}
                {schedule.filter(s => s.status === 'pending').length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-sm">暂无待办任务</div>
                )}
            </div>
            <button 
                onClick={() => setIsEntryExpanded(!isEntryExpanded)}
                className="mt-4 w-full py-2 bg-teal-600 text-white rounded-lg font-bold shadow-md hover:bg-teal-700 transition-colors"
            >
                {isEntryExpanded ? '收起录入表单' : '录入本次记录'}
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
