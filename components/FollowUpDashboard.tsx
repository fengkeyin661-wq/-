
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
    records, 
    assessment, 
    schedule, 
    onAddRecord, 
    allArchives = [], 
    onPatientChange, 
    currentPatientId,
    onUpdateData,
    isAuthenticated = false,
    healthRecord,
    onRefresh
}) => {
  const [isEntryExpanded, setIsEntryExpanded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<FollowUpRecord | null>(null);
  const [showUrgentOnly, setShowUrgentOnly] = useState(true); 
  const [activeChart, setActiveChart] = useState<'bp' | 'metabolic' | 'lipids'>('bp');
  const [criticalModalArchive, setCriticalModalArchive] = useState<HealthArchive | null>(null);

  const [guideEditData, setGuideEditData] = useState<{
      plan: string; issues: string; goals: string; message: string; suggestedDate: string; 
  }>({ plan: '', issues: '', goals: '', message: '', suggestedDate: '' });

  const sortedRecords = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latestRecord = sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1] : null;
  const currentArchive = allArchives.find(a => a.checkup_id === currentPatientId);
  const currentPatientName = currentArchive?.name || '受检者';

  const isAssessmentNewer = React.useMemo(() => {
      if (!currentArchive || !assessment) return false;
      if (!latestRecord) return true; 
      const recordTime = Number(latestRecord.id); 
      const archiveTime = new Date(currentArchive.updated_at || currentArchive.created_at).getTime();
      return archiveTime > (recordTime + 2000);
  }, [currentArchive, latestRecord, assessment]);

  const activeRiskLevel = isAssessmentNewer && assessment ? assessment.riskLevel : (latestRecord?.assessment.riskLevel || assessment?.riskLevel || RiskLevel.GREEN);
  const activePlanText = (isAssessmentNewer && assessment ? assessment.followUpPlan.nextCheckItems.join('、') : (latestRecord?.assessment.nextCheckPlan || assessment?.followUpPlan?.nextCheckItems?.join('、') || '')) || '';
  const activeIssues = (isAssessmentNewer && assessment ? (assessment.isCritical ? assessment.criticalWarning : assessment.summary) : (latestRecord?.assessment.majorIssues || assessment?.summary || '')) || '';
  const activeGoals = isAssessmentNewer && assessment ? assessment.managementPlan.dietary.concat(assessment.managementPlan.exercise).slice(0, 5) : (latestRecord?.assessment.lifestyleGoals || []);
  const activeMessage = isAssessmentNewer && assessment ? "新的一年评估已完成，请遵照新的管理方案执行。" : (latestRecord?.assessment.doctorMessage || latestRecord?.assessment.riskJustification || '');
  const nextScheduled = schedule.find(s => s.status === 'pending');

  useEffect(() => {
      setGuideEditData({
          plan: activePlanText || '',
          issues: activeIssues || '',
          goals: Array.isArray(activeGoals) ? activeGoals.join('\n') : (typeof activeGoals === 'string' ? activeGoals : ''),
          message: activeMessage || '',
          suggestedDate: nextScheduled ? nextScheduled.date : ''
      });
  }, [activePlanText, activeIssues, activeGoals, activeMessage, nextScheduled]);

  const pendingCriticalTasks = allArchives.filter(arch => {
      const track = arch.critical_track;
      if (!track || track.status === 'archived') return false;

      // 1. 初次随访 (24小时内): 始终显示 (最高优先级)
      if (track.status === 'pending_initial') return true;

      // 2. 二次随访 (1个月回访): 根据开关决定是否隐藏 7 天外的
      if (track.status === 'pending_secondary' && track.secondary_due_date) {
          const today = new Date(); today.setHours(0,0,0,0);
          const due = new Date(track.secondary_due_date);
          const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (showUrgentOnly) {
              return diffDays <= 7; // 仅显示已逾期、今日、或7天内到期的
          }
          return true; 
      }
      return false;
  }).sort((a, b) => {
      const getPriorityScore = (arch: HealthArchive) => {
           const t = arch.critical_track!;
           if (t.status === 'pending_initial') return 1000;
           const due = new Date(t.secondary_due_date).getTime();
           const now = Date.now();
           if (now > due) return 500; // 逾期
           return 100 - ((due - now) / (1000 * 60 * 60 * 24)); 
      };
      return getPriorityScore(b) - getPriorityScore(a);
  });
  
  const maskName = (name: string) => {
      if (isAuthenticated) return name;
      if (!name) return '***';
      return name.charAt(0) + (name.length > 2 ? '**' : '*');
  };

  const initialFormState: Omit<FollowUpRecord, 'id'> = {
    date: new Date().toISOString().split('T')[0],
    method: '电话',
    indicators: { sbp: 0, dbp: 0, heartRate: 0, glucose: 0, weight: 0 },
    organRisks: { carotidPlaque: '无', carotidStatus: '无', thyroidNodule: '无', thyroidStatus: '无', lungNodule: '无', lungStatus: '无', otherFindings: '无', otherStatus: '无' },
    medication: { currentDrugs: '', compliance: '规律服药', adverseReactions: '无' },
    lifestyle: { diet: '合理', exercise: '偶尔', smokingAmount: 0, drinkingAmount: 0, sleepHours: 7, sleepQuality: '好', psychology: '平稳', stress: '低' },
    assessment: { riskLevel: RiskLevel.GREEN, riskJustification: '', majorIssues: '', referral: false, nextCheckPlan: '', lifestyleGoals: [], doctorMessage: '' }
  };

  const [formData, setFormData] = useState<Omit<FollowUpRecord, 'id'>>(initialFormState);

  const handleSubmit = async () => {
    setIsAnalyzing(true);
    try {
        const result = await analyzeFollowUpRecord(formData, assessment, latestRecord);
        const finalData = {
            ...formData,
            assessment: { ...formData.assessment, ...result }
        };
        onAddRecord(finalData);
        alert('随访记录已保存');
    } catch (e) {
        alert('自动分析失败');
    } finally {
        setIsAnalyzing(false);
    }
  };

  return (
    <div className="animate-fadeIn pb-10">
      {/* 危急值待处理看板 */}
      <div className="mb-8 animate-fadeIn">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
              <div className="flex items-center gap-2">
                  <span className="text-2xl animate-pulse">🚨</span>
                  <h2 className="text-xl font-bold text-red-700">
                      危急值随访 
                      <span className="text-sm font-normal text-white bg-red-600 px-2 py-1 rounded-full ml-2 shadow-sm">
                          {pendingCriticalTasks.length} 人
                      </span>
                  </h2>
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors select-none">
                  <input 
                      type="checkbox" 
                      className="w-4 h-4 text-red-600 rounded focus:ring-red-500" 
                      checked={showUrgentOnly} 
                      onChange={() => setShowUrgentOnly(!showUrgentOnly)} 
                  />
                  <span className="text-xs font-bold text-slate-600">隐藏 7 天外非紧急随访</span>
              </label>
          </div>
          
          {pendingCriticalTasks.length > 0 ? (
              <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-thin scrollbar-thumb-red-200 scrollbar-track-red-50">
                  {pendingCriticalTasks.map((arch) => {
                      const track = arch.critical_track!;
                      const isInitial = track.status === 'pending_initial';
                      
                      let statusBadge = { text: '24h内初次通知', color: 'bg-red-600' };
                      let cardBorder = "border-l-4 border-l-red-600 bg-red-50/50 border-t border-r border-b border-red-200";

                      if (!isInitial) {
                          cardBorder = "border-l-4 border-l-orange-500 bg-white border-t border-r border-b border-slate-200";
                          const today = new Date(); today.setHours(0,0,0,0);
                          const due = new Date(track.secondary_due_date);
                          const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                          
                          if (diffDays < 0) statusBadge = { text: `逾期 ${Math.abs(diffDays)} 天`, color: 'bg-red-900 animate-pulse' };
                          else if (diffDays === 0) statusBadge = { text: '今日到期', color: 'bg-orange-600' };
                          else statusBadge = { text: `${diffDays} 天后回访`, color: 'bg-blue-500' };
                      }

                      return (
                          <div 
                              key={arch.id}
                              onClick={() => setCriticalModalArchive(arch)}
                              className={`relative p-4 rounded-xl transition-all cursor-pointer hover:shadow-lg hover:-translate-y-1 min-w-[280px] w-[280px] flex-shrink-0 group ${cardBorder}`}
                          >
                              <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl rounded-tr-lg text-[10px] font-bold text-white ${statusBadge.color}`}>
                                  {statusBadge.text}
                              </div>
                              
                              <div className="flex items-center gap-3 mb-3 mt-1">
                                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl shadow-sm border border-slate-100">
                                      {arch.gender === '女' ? '👩' : '👨'}
                                  </div>
                                  <div>
                                      <div className="font-bold text-slate-800 text-lg leading-tight">{maskName(arch.name)}</div>
                                      <div className="text-xs text-slate-500">{arch.age}岁 · {arch.department}</div>
                                  </div>
                              </div>

                              <div className="bg-white p-2.5 rounded-lg border border-slate-100 mb-2 shadow-inner h-[50px] overflow-hidden">
                                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 flex justify-between">
                                      <span>异常详情</span>
                                      <span className={track.critical_level?.includes('A') ? "text-red-600" : "text-orange-500"}>
                                          {track.critical_level}
                                      </span>
                                  </div>
                                  <div className="text-xs text-red-700 font-bold line-clamp-2">{track.critical_item}: {track.critical_desc}</div>
                              </div>

                              <div className="flex justify-between items-center text-xs mt-2">
                                  <span className="text-slate-500 font-medium">
                                      {isInitial ? '需立即处置' : `预计回访: ${track.secondary_due_date}`}
                                  </span>
                                  <span className={`text-white px-2 py-1 rounded font-bold shadow-sm ${isInitial ? 'bg-red-600' : 'bg-orange-500'}`}>
                                      {isInitial ? '去处理' : '录入复查'}
                                  </span>
                              </div>
                          </div>
                      )
                  })}
              </div>
          ) : (
              <div className="bg-white rounded-xl p-8 text-center border border-dashed border-slate-200">
                  <div className="text-4xl mb-2 grayscale opacity-30">🛡️</div>
                  <p className="text-slate-400 text-sm font-medium">当前无紧急危急值任务</p>
                  {showUrgentOnly && <button onClick={() => setShowUrgentOnly(false)} className="text-xs text-blue-600 mt-2 hover:underline">查看所有追踪中的档案</button>}
              </div>
          )}
      </div>

      {/* 剩余图表与随访录入部分保持不变 */}
      {/* ... (Existing FollowUpDashboard rest of code) ... */}
      
      {criticalModalArchive && (
          <CriticalHandleModal 
              archive={criticalModalArchive} 
              onClose={() => setCriticalModalArchive(null)} 
              onSave={handleCriticalSave} 
          />
      )}
    </div>
  );
};
