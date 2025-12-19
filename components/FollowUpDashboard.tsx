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
  
  // State for viewing history details
  const [viewingRecord, setViewingRecord] = useState<FollowUpRecord | null>(null);
  
  // State for editing the bottom Guide
  const [isEditingGuide, setIsEditingGuide] = useState(false);
  const [guideEditData, setGuideEditData] = useState<{
      plan: string;
      issues: string;
      goals: string;
      message: string; 
      suggestedDate: string; 
  }>({ plan: '', issues: '', goals: '', message: '', suggestedDate: '' });

  // State for SMS Modal
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsContent, setSmsContent] = useState('');
  const [isGeneratingSms, setIsGeneratingSms] = useState(false);

  // State for Chart View
  const [activeChart, setActiveChart] = useState<'bp' | 'metabolic' | 'lipids'>('bp');

  // State for Critical Value Modal
  const [criticalModalArchive, setCriticalModalArchive] = useState<HealthArchive | null>(null);

  // Sort records by date
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

  // Derived Active Data
  const activeRiskLevel = isAssessmentNewer && assessment ? assessment.riskLevel : (latestRecord?.assessment.riskLevel || assessment?.riskLevel || RiskLevel.GREEN);
  
  const activePlanText = (isAssessmentNewer && assessment 
      ? assessment.followUpPlan.nextCheckItems.join('、')
      : (latestRecord?.assessment.nextCheckPlan || assessment?.followUpPlan?.nextCheckItems?.join('、') || '')) || '';

  const activeIssues = (isAssessmentNewer && assessment 
      ? (assessment.isCritical ? assessment.criticalWarning : assessment.summary)
      : (latestRecord?.assessment.majorIssues || assessment?.summary || '')) || '';

  const activeGoals = isAssessmentNewer && assessment
      ? assessment.managementPlan.dietary.concat(assessment.managementPlan.exercise).slice(0, 5)
      : (latestRecord?.assessment.lifestyleGoals || []);

  const activeMessage = isAssessmentNewer && assessment
      ? "新的一年评估已完成，请遵照新的管理方案执行。" 
      : (latestRecord?.assessment.doctorMessage || latestRecord?.assessment.riskJustification || '');

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

  // Upcoming Tasks Logic
  const getGlobalUpcomingTasks = () => {
      const today = new Date();
      today.setHours(0,0,0,0);
      const list: { archive: HealthArchive, date: string, daysLeft: number, focus: string }[] = [];
      allArchives.forEach(arch => {
          if (arch.follow_up_schedule) {
              arch.follow_up_schedule.forEach(task => {
                  if (task.status === 'pending') {
                      const taskDate = new Date(task.date);
                      const diffTime = taskDate.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      if (diffDays <= 7) {
                          list.push({
                              archive: arch,
                              date: task.date,
                              daysLeft: diffDays,
                              focus: task.focusItems.join(', ')
                          });
                      }
                  }
              });
          }
      });
      return list.sort((a, b) => a.daysLeft - b.daysLeft);
  };
  
  const upcomingGlobalTasks = getGlobalUpcomingTasks();

  // Pending Critical Tasks Logic
  const pendingCriticalTasks = allArchives.filter(arch => {
      const track = arch.critical_track;
      if (!track || track.status === 'archived') return false;

      // 1. Pending Initial Notification (待初次通知): ALWAYS SHOW
      if (track.status === 'pending_initial') return true;

      // 2. Pending Secondary Follow-up (待二次回访): Show only if within 7 days or overdue
      if (track.status === 'pending_secondary' && track.secondary_due_date) {
          const today = new Date();
          today.setHours(0,0,0,0);
          const due = new Date(track.secondary_due_date);
          const diffTime = due.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          // Show if overdue (diffDays < 0) or upcoming within 7 days
          return diffDays <= 7;
      }

      return false;
  }).sort((a, b) => {
      const getScore = (arch: HealthArchive) => {
           const t = arch.critical_track!;
           let score = 0;
           // Priority 1: Initial Notification is most urgent
           if (t.status === 'pending_initial') score += 1000;
           else {
               // Priority 2: Overdue Secondary
               const due = new Date(t.secondary_due_date).getTime();
               const now = Date.now();
               if (now > due) score += 500; // Overdue
               score += (now - due) / (1000 * 60 * 60 * 24); 
           }
           // Priority 3: A Level > B Level
           if (t.critical_level?.includes('A')) score += 200;
           return score;
      };
      return getScore(b) - getScore(a);
  });
  
  const maskName = (name: string) => {
      if (isAuthenticated) return name;
      if (!name) return '***';
      return name.charAt(0) + (name.length > 2 ? '**' : '*');
  };

  const initialFormState: Omit<FollowUpRecord, 'id'> = {
    date: new Date().toISOString().split('T')[0],
    method: '电话',
    mainComplaint: '无',
    indicators: {
      sbp: 0, dbp: 0, heartRate: 0, glucose: 0, glucoseType: '空腹', weight: 0,
      tc: 0, tg: 0, ldl: 0, hdl: 0
    },
    organRisks: {
      carotidPlaque: '无', carotidStatus: '无',
      thyroidNodule: '无', thyroidStatus: '无',
      lungNodule: '无', lungStatus: '无',
      otherFindings: '无', otherStatus: '无'
    },
    medicalCompliance: [], 
    medication: {
      currentDrugs: '', compliance: '规律服药', adverseReactions: '无'
    },
    lifestyle: {
      diet: '合理', exercise: '偶尔',
      smokingAmount: 0, drinkingAmount: 0,
      sleepHours: 7, sleepQuality: '好',
      psychology: '平稳', stress: '低'
    },
    taskCompliance: [],
    otherInfo: '',
    assessment: {
      riskLevel: RiskLevel.GREEN,
      riskJustification: '',
      majorIssues: '',
      referral: false,
      nextCheckPlan: '',
      lifestyleGoals: [],
      doctorMessage: '' 
    }
  };

  const [formData, setFormData] = useState<Omit<FollowUpRecord, 'id'>>(initialFormState);

  const extractCheckItems = (text: string): string[] => {
      if (!text) return [];
      return text.split(/[，,、;；\n]/)
                 .map(s => s.trim())
                 .map(s => s.replace(/建议|定期|复查|监测|检查|评估|关注|前往|专科|就诊|完善/g, ''))
                 .map(s => s.trim())
                 .filter(s => s.length > 1);
  };

  const autoFillForm = () => {
    const baseState = { ...initialFormState };
    if (latestRecord) {
        baseState.medication.currentDrugs = latestRecord.medication.currentDrugs || '';
        baseState.organRisks.carotidPlaque = latestRecord.organRisks.carotidPlaque || '无';
        baseState.organRisks.thyroidNodule = latestRecord.organRisks.thyroidNodule || '无';
        baseState.organRisks.carotidStatus = '稳定';
        baseState.organRisks.thyroidStatus = '稳定';
    }
    const itemsToCheck = extractCheckItems(activePlanText || '');
    if (itemsToCheck.length > 0) {
        baseState.medicalCompliance = itemsToCheck.map(item => ({
            item: item,
            status: 'not_checked', 
            result: ''
        }));
    } else {
        baseState.medicalCompliance = [{ item: '常规复查项目', status: 'not_checked', result: '' }];
    }
    if (assessment?.structuredTasks) {
        baseState.taskCompliance = assessment.structuredTasks.map(task => ({
            taskId: task.id,
            description: task.description,
            status: 'achieved', 
            note: task.targetValue ? `目标: ${task.targetValue}` : ''
        }));
    }
    if (isAssessmentNewer && assessment) {
        baseState.assessment.riskJustification = `基于最新评估：${assessment.summary.slice(0, 50)}...`;
        baseState.assessment.majorIssues = activeIssues || '';
        baseState.assessment.lifestyleGoals = Array.isArray(activeGoals) ? activeGoals : [];
        baseState.assessment.nextCheckPlan = activePlanText || '';
    }
    setFormData(baseState);
  };

  useEffect(() => {
      autoFillForm();
  }, [currentPatientId, activePlanText]);

  const updateForm = (section: keyof FollowUpRecord, field: string, value: any) => {
    if (section === 'indicators' || section === 'organRisks' || section === 'medication' || section === 'lifestyle' || section === 'assessment') {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...(prev[section] as any),
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [section]: value }));
    }
  };

  const updateMedicalCompliance = (index: number, field: string, value: any) => {
      if (!formData.medicalCompliance) return;
      const newList = [...formData.medicalCompliance];
      newList[index] = { ...newList[index], [field]: value };
      setFormData(prev => ({ ...prev, medicalCompliance: newList }));
  };

  const removeMedicalComplianceItem = (index: number) => {
      if (!formData.medicalCompliance) return;
      const newList = [...formData.medicalCompliance];
      newList.splice(index, 1);
      setFormData(prev => ({ ...prev, medicalCompliance: newList }));
  };

  const updateTaskCompliance = (index: number, status: 'achieved' | 'partial' | 'failed') => {
      if (!formData.taskCompliance) return;
      const newTasks = [...formData.taskCompliance];
      newTasks[index].status = status;
      setFormData(prev => ({ ...prev, taskCompliance: newTasks }));
  };
  
  const removeTaskComplianceItem = (index: number) => {
      if (!formData.taskCompliance) return;
      const newList = [...formData.taskCompliance];
      newList.splice(index, 1);
      setFormData(prev => ({ ...prev, taskCompliance: newList }));
  };

  const handleSubmit = async () => {
    setIsAnalyzing(true);
    try {
        const result = await analyzeFollowUpRecord(formData, assessment, latestRecord);
        const finalData = {
            ...formData,
            assessment: {
                ...formData.assessment,
                riskLevel: result.riskLevel,
                riskJustification: result.riskJustification,
                doctorMessage: result.doctorMessage, 
                majorIssues: result.majorIssues,
                nextCheckPlan: result.nextCheckPlan,
                lifestyleGoals: result.lifestyleGoals
            }
        };
        onAddRecord(finalData);
        autoFillForm();
        alert('随访记录已保存');
    } catch (e) {
        alert(`自动分析失败: ${e instanceof Error ? e.message : '未知错误'}。`);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleSaveGuideEdit = () => {
      if (!onUpdateData) return;
      if (!latestRecord) {
          alert("请先录入一次随访记录，才能保存修订的执行单。");
          return;
      }
      const updatedRecord: FollowUpRecord = {
          ...latestRecord,
          assessment: {
              ...latestRecord.assessment,
              nextCheckPlan: guideEditData.plan,
              majorIssues: guideEditData.issues,
              lifestyleGoals: guideEditData.goals.split('\n').filter(s => s.trim() !== ''),
              doctorMessage: guideEditData.message
          }
      };
      
      let updatedSchedule = [...schedule];
      const pendingIndex = updatedSchedule.findIndex(s => s.status === 'pending');
      
      if (pendingIndex !== -1 && guideEditData.suggestedDate) {
          updatedSchedule[pendingIndex] = {
              ...updatedSchedule[pendingIndex],
              date: guideEditData.suggestedDate
          };
      } 
      
      onUpdateData(updatedRecord, updatedSchedule);
      setIsEditingGuide(false);
  };

  const handlePrintGuide = () => {
      alert("打印功能已就绪");
  };

  const handleGenerateSms = async () => {
    setIsGeneratingSms(true);
    setShowSmsModal(true);
    try {
        const res = await generateFollowUpSMS(currentPatientName);
        setSmsContent(res.smsContent);
    } catch (e) {
        setSmsContent("生成短信失败。");
    } finally {
        setIsGeneratingSms(false);
    }
  };

  const handleSendAndDelay = () => {
      if (!onUpdateData || !nextScheduled) return;
      const currentDate = new Date(nextScheduled.date);
      currentDate.setMonth(currentDate.getMonth() + 1);
      const newDateStr = currentDate.toISOString().split('T')[0];
      const updatedSchedule = schedule.map(s => s.id === nextScheduled.id ? { ...s, date: newDateStr } : s);
      if (latestRecord) {
          onUpdateData(latestRecord, updatedSchedule);
      }
      setShowSmsModal(false);
  };

  const handleCriticalSave = async (record: CriticalTrackRecord) => {
      if (!criticalModalArchive) return;
      const res = await updateCriticalTrack(criticalModalArchive.checkup_id, record);
      if (res.success) {
          alert("危急值处理记录已更新");
          setCriticalModalArchive(null);
          if (onRefresh) onRefresh();
      } else {
          alert("保存失败: " + res.message);
      }
  };

  let chartData: any[] = sortedRecords.map(r => ({
      date: r.date,
      sbp: r.indicators.sbp || undefined,
      dbp: r.indicators.dbp || undefined,
      heartRate: r.indicators.heartRate || undefined,
      glucose: r.indicators.glucose || undefined,
      weight: r.indicators.weight || undefined,
      tc: r.indicators.tc || undefined,
      tg: r.indicators.tg || undefined,
      ldl: r.indicators.ldl || undefined,
      type: 'followup'
  }));

  if (healthRecord && healthRecord.checkup) {
      const b = healthRecord.checkup.basics;
      const l = healthRecord.checkup.labBasic;
      if (b.sbp || b.weight || l.glucose?.fasting) {
           const baselinePoint = {
              date: healthRecord.profile.checkupDate || currentArchive?.created_at?.split('T')[0] || '建档基线',
              sbp: b.sbp || undefined,
              dbp: b.dbp || undefined,
              heartRate: undefined,
              glucose: l.glucose?.fasting ? parseFloat(l.glucose.fasting) : undefined,
              weight: b.weight || undefined,
              tc: l.lipids?.tc ? parseFloat(l.lipids.tc) : undefined,
              tg: l.lipids?.tg ? parseFloat(l.lipids.tg) : undefined,
              ldl: l.lipids?.ldl ? parseFloat(l.lipids.ldl) : undefined,
              type: 'baseline'
          };
          chartData = [baselinePoint, ...chartData].sort((a, b) => {
              if (a.date === '建档基线') return -1;
              if (b.date === '建档基线') return 1;
              return new Date(a.date).getTime() - new Date(b.date).getTime();
          });
      }
  }

  const summaryChartData = assessment ? [
    { name: 'High', value: Math.max(assessment.risks.red.length, 0.5), color: '#ef4444' },
    { name: 'Medium', value: Math.max(assessment.risks.yellow.length, 0.5), color: '#eab308' },
    { name: 'Low', value: Math.max(5 - assessment.risks.red.length - assessment.risks.yellow.length, 1), color: '#22c55e' },
  ] : [];

  return (
    <div className="animate-fadeIn pb-10">

      {/* Critical Value Alert Section (Updated) */}
      {pendingCriticalTasks.length > 0 && (
          <div className="mb-8 animate-fadeIn">
              <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl animate-pulse">🚨</span>
                  <h2 className="text-xl font-bold text-red-700">
                      危急值待处理 
                      <span className="text-sm font-normal text-white bg-red-600 px-2 py-1 rounded-full ml-2 shadow-sm">
                          {pendingCriticalTasks.length} 人
                      </span>
                  </h2>
              </div>
              
              <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-thin scrollbar-thumb-red-200 scrollbar-track-red-50">
                  {pendingCriticalTasks.map((arch) => {
                      const track = arch.critical_track!;
                      const isA = track.critical_level?.includes('A');
                      const isInitial = track.status === 'pending_initial';
                      
                      // Status Logic & Styling
                      let statusBadge = { text: '待初次通知', color: 'bg-red-600' };
                      let cardBorder = "border-l-4 border-l-red-600 bg-red-50/50 border-t border-r border-b border-red-200"; // Default Initial Style

                      if (!isInitial) {
                          // Secondary Style
                          cardBorder = "border-l-4 border-l-orange-500 bg-white border-t border-r border-b border-slate-200";
                          
                          const today = new Date();
                          today.setHours(0,0,0,0);
                          const due = new Date(track.secondary_due_date);
                          const diffTime = due.getTime() - today.getTime();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          
                          if (diffDays < 0) {
                              statusBadge = { text: `逾期 ${Math.abs(diffDays)} 天`, color: 'bg-red-800 animate-pulse' };
                          } else if (diffDays === 0) {
                              statusBadge = { text: '今日需回访', color: 'bg-orange-600' };
                          } else {
                              statusBadge = { text: `剩 ${diffDays} 天回访`, color: 'bg-blue-500' };
                          }
                      }

                      return (
                          <div 
                              key={arch.id}
                              onClick={() => setCriticalModalArchive(arch)}
                              className={`relative p-4 rounded-xl transition-all cursor-pointer hover:shadow-lg hover:-translate-y-1 min-w-[280px] w-[280px] flex-shrink-0 group ${cardBorder}`}
                          >
                              <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl rounded-tr-lg text-xs font-bold text-white ${statusBadge.color}`}>
                                  {statusBadge.text}
                              </div>
                              
                              <div className="flex items-center gap-3 mb-3 mt-1">
                                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl shadow-sm border border-slate-100">
                                      {arch.gender === '女' ? '👩' : '👨'}
                                  </div>
                                  <div>
                                      <div className="font-bold text-slate-800 text-lg leading-tight">
                                          {maskName(arch.name)}
                                      </div>
                                      <div className="text-xs text-slate-500">
                                          {arch.age}岁 · {arch.department}
                                      </div>
                                  </div>
                              </div>

                              <div className="bg-white p-2.5 rounded-lg border border-slate-100 mb-2 shadow-inner h-[50px] overflow-hidden">
                                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 flex justify-between">
                                      <span>异常描述</span>
                                      <span className={isA ? "text-red-600 font-black" : "text-orange-500 font-bold"}>
                                          {isA ? 'A类危急' : 'B类重大'}
                                      </span>
                                  </div>
                                  <div className="text-xs text-red-700 font-bold line-clamp-2" title={track.critical_desc}>
                                      {track.critical_item}: {track.critical_desc}
                                  </div>
                              </div>

                              <div className="flex justify-between items-center text-xs mt-2">
                                  <span className="text-slate-500 font-medium">
                                      {isInitial ? '需立即联系' : `计划: ${track.secondary_due_date}`}
                                  </span>
                                  <span className={`text-white px-2 py-1 rounded font-bold shadow-sm transition-colors ${
                                      isInitial ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600'
                                  }`}>
                                      {isInitial ? '立即处置' : '录入追踪'}
                                  </span>
                              </div>
                          </div>
                      )
                  })}
              </div>
          </div>
      )}

      {/* Global Reminder Section */}
      {upcomingGlobalTasks.length > 0 && (
          <div className="mb-8 animate-fadeIn">
              <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🔔</span>
                  <h2 className="text-xl font-bold text-slate-800">
                      近期随访提醒 
                      <span className="text-sm font-normal text-slate-500 ml-2 bg-slate-100 px-2 py-1 rounded-full">
                          {upcomingGlobalTasks.length} 人待处理
                      </span>
                  </h2>
              </div>
              
              <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                  {upcomingGlobalTasks.map((task, idx) => {
                      const isOverdue = task.daysLeft < 0;
                      const isToday = task.daysLeft === 0;
                      const badgeColor = isOverdue ? 'bg-red-100 text-red-700' : isToday ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700';
                      const statusText = isOverdue ? `逾期 ${Math.abs(task.daysLeft)} 天` : isToday ? '今天' : `${task.daysLeft} 天后`;

                      return (
                          <div 
                              key={idx}
                              onClick={() => isAuthenticated && onPatientChange && onPatientChange(task.archive)}
                              className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md hover:-translate-y-1 bg-white min-w-[280px] w-[280px] flex-shrink-0 ${
                                  task.archive.checkup_id === currentPatientId ? 'ring-2 ring-teal-500' : 'border-slate-100'
                              }`}
                          >
                              <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl rounded-tr-lg text-xs font-bold ${badgeColor}`}>
                                  {statusText}
                              </div>
                              <div className="flex items-center gap-3 mb-3 mt-1">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                                      task.archive.gender === '女' ? 'bg-pink-50 text-pink-500' : 'bg-blue-50 text-blue-500'
                                  }`}>
                                      {task.archive.gender === '女' ? '👩' : '👨'}
                                  </div>
                                  <div>
                                      <div className="font-bold text-slate-800 text-lg leading-tight">
                                          {maskName(task.archive.name)}
                                      </div>
                                      <div className="text-xs text-slate-400">
                                          {task.archive.age}岁 · {task.archive.department}
                                      </div>
                                  </div>
                              </div>
                              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mb-2 h-[50px] overflow-hidden">
                                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">重点复查</div>
                                  <div className="text-xs text-slate-600 font-medium line-clamp-2" title={task.focus}>
                                      {task.focus || '常规复查'}
                                  </div>
                              </div>
                              <div className="flex justify-between items-center text-xs mt-2">
                                  <span className="text-slate-400">计划日期: {task.date}</span>
                                  <span className="text-teal-600 font-bold hover:underline">处理 &rarr;</span>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* Charts and Timeline Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Left Column: Charts + Profile Summary */}
          <div className="lg:col-span-2 space-y-6">
              {/* Charts Card */}
              <div className="bg-white p-6 rounded-xl shadow border border-slate-100 flex flex-col h-[400px]">
                 <div className="flex justify-between items-center mb-4">
                     <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span>📈</span> 核心指标监测
                     </h2>
                     <div className="flex bg-slate-100 rounded-lg p-1">
                         {[{id: 'bp', label: '血压/心率'}, {id: 'metabolic', label: '血糖/体重'}, {id: 'lipids', label: '血脂趋势'}].map(tab => (
                             <button 
                                 key={tab.id}
                                 onClick={() => setActiveChart(tab.id as any)}
                                 className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeChart === tab.id ? 'bg-white shadow text-teal-700' : 'text-slate-500 hover:text-slate-700'}`}
                             >
                                 {tab.label}
                             </button>
                         ))}
                     </div>
                 </div>
                 
                 <div className="flex-1 w-full min-h-0">
                     {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="date" fontSize={12} stroke="#9ca3af" tickMargin={10} />
                                <YAxis fontSize={12} stroke="#9ca3af" domain={['auto', 'auto']} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                
                                {activeChart === 'bp' && (
                                    <>
                                        <ReferenceLine y={140} stroke="red" strokeDasharray="3 3" label={{ value: 'SBP上限 140', fill: 'red', fontSize: 10, position: 'right' }} />
                                        <ReferenceLine y={90} stroke="orange" strokeDasharray="3 3" label={{ value: 'DBP上限 90', fill: 'orange', fontSize: 10, position: 'right' }} />
                                        <Line type="monotone" dataKey="sbp" name="收缩压" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                                        <Line type="monotone" dataKey="dbp" name="舒张压" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                                        <Line type="monotone" dataKey="heartRate" name="心率" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls />
                                    </>
                                )}
                                {activeChart === 'metabolic' && (
                                    <>
                                        <ReferenceLine y={6.1} stroke="#0ea5e9" strokeDasharray="3 3" label={{ value: '空腹血糖上限 6.1', fill: '#0ea5e9', fontSize: 10, position: 'insideTopRight' }} />
                                        <Line type="monotone" dataKey="glucose" name="空腹血糖" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                                        <Line type="monotone" dataKey="weight" name="体重(kg)" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                                    </>
                                )}
                                {activeChart === 'lipids' && (
                                    <>
                                        <ReferenceLine y={5.2} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'TC上限 5.2', fill: '#f59e0b', fontSize: 10 }} />
                                        <ReferenceLine y={1.7} stroke="#84cc16" strokeDasharray="3 3" label={{ value: 'TG上限 1.7', fill: '#84cc16', fontSize: 10 }} />
                                        <Line type="monotone" dataKey="tc" name="总胆固醇" stroke="#f59e0b" strokeWidth={2} connectNulls />
                                        <Line type="monotone" dataKey="tg" name="甘油三酯" stroke="#84cc16" strokeWidth={2} connectNulls />
                                        <Line type="monotone" dataKey="ldl" name="LDL-C" stroke="#dc2626" strokeWidth={2} connectNulls />
                                    </>
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                     ) : (
                         <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg">
                             暂无监测数据
                         </div>
                     )}
                 </div>
              </div>

              {/* Patient Basic Info & Assessment Card (New) */}
              {healthRecord && (
                  <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden animate-fadeIn">
                      <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                          <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                              <span>📋</span> 档案基本信息与评估结果
                          </h3>
                          {assessment && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                                  assessment.riskLevel === 'RED' ? 'bg-red-50 text-red-600 border-red-200' :
                                  assessment.riskLevel === 'YELLOW' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                  'bg-green-50 text-green-600 border-green-200'
                              }`}>
                                  {assessment.riskLevel === 'RED' ? '高风险' : assessment.riskLevel === 'YELLOW' ? '中风险' : '低风险'}
                              </span>
                          )}
                      </div>
                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Profile Table-like list */}
                          <div className="grid grid-cols-2 gap-y-3 text-sm">
                              <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">姓名</span>
                                  <span className="font-black text-slate-800">{healthRecord.profile.name}</span>
                              </div>
                              <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">体检编号</span>
                                  <span className="font-mono text-slate-600">{healthRecord.profile.checkupId}</span>
                              </div>
                              <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">性别 / 年龄</span>
                                  <span className="text-slate-700">{healthRecord.profile.gender} / {healthRecord.profile.age}岁</span>
                              </div>
                              <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">部门 / 单位</span>
                                  <span className="text-slate-700 truncate" title={healthRecord.profile.department}>{healthRecord.profile.department}</span>
                              </div>
                              <div className="flex flex-col col-span-2">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">联系电话</span>
                                  <span className="font-mono text-slate-700">{healthRecord.profile.phone || '未记录'}</span>
                              </div>
                          </div>

                          {/* Assessment Summary Box */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col h-full">
                              <span className="text-[10px] text-slate-400 font-bold uppercase mb-2">综合评估综述</span>
                              <div className="text-xs text-slate-600 leading-relaxed overflow-y-auto max-h-[80px] scrollbar-thin">
                                  {assessment?.summary || '暂无历史评估综述'}
                              </div>
                              {assessment?.isCritical && (
                                  <div className="mt-2 text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded font-bold flex items-center gap-1">
                                      <span>🚨</span> 危急值警示：{assessment.criticalWarning}
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              )}
          </div>

          {/* Right Column: Timeline */}
          <div className="bg-white p-6 rounded-xl shadow border border-slate-100 flex flex-col h-full min-h-[400px]">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                    <span>📅</span> 随访路径
                </div>
                {assessment && nextScheduled && (
                    <button onClick={handleGenerateSms} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100 font-bold">
                        延期/催办
                    </button>
                )}
            </h2>
            
            <div className="flex-1 overflow-y-auto pr-2 relative">
                {!assessment ? (
                    <div className="text-center py-10 text-slate-400">请选择人员</div>
                ) : (
                    <div className="space-y-6 pl-4 border-l-2 border-slate-100 ml-2">
                         {healthRecord?.checkup?.basics.sbp && (
                             <div className="relative">
                                <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full border-2 border-white ring-2 ring-slate-400 bg-slate-400"></div>
                                <div className="text-xs text-slate-400 mb-1">{healthRecord.profile.checkupDate || '建档日'}</div>
                                <div className="text-sm font-bold text-slate-600">健康建档(基线)</div>
                             </div>
                         )}

                         {sortedRecords.map((rec) => (
                            <div 
                                key={rec.id} 
                                className="relative cursor-pointer hover:bg-slate-50 p-2 -ml-2 rounded-lg transition-all group"
                                onClick={() => setViewingRecord(rec)}
                            >
                                <div className="absolute -left-[23px] top-3 w-4 h-4 rounded-full border-2 border-white ring-2 ring-teal-500 bg-teal-500 group-hover:ring-teal-600"></div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-xs text-slate-400 mb-1">{rec.date}</div>
                                        <div className="text-sm font-bold text-slate-700 group-hover:text-teal-700">已完成随访</div>
                                        <div className="text-xs text-slate-500 mt-1">方式: {rec.method}</div>
                                    </div>
                                    <span className="text-[10px] text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity bg-teal-50 px-2 py-1 rounded">查看详情</span>
                                </div>
                            </div>
                         ))}
                         {nextScheduled && (
                            <div className="relative animate-pulse">
                                <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full border-2 border-white ring-2 ring-blue-500 bg-blue-500"></div>
                                <div className="text-xs text-blue-600 font-bold mb-1">{nextScheduled.date}</div>
                                <div className="text-sm font-bold text-slate-800">计划中</div>
                                <div className="text-xs text-slate-500 mt-1 max-w-[150px] truncate">{nextScheduled.focusItems.join(', ')}</div>
                            </div>
                         )}
                    </div>
                )}
            </div>
            
            {assessment && (
                <div className="mt-4 pt-2 border-t border-slate-100">
                    <button 
                        onClick={() => setIsEntryExpanded(!isEntryExpanded)}
                        className={`w-full py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${isEntryExpanded ? 'bg-slate-100 text-slate-600' : 'bg-teal-600 text-white shadow-lg'}`}
                    >
                        {isEntryExpanded ? '🔼 收起录入表单' : '📝 录入本次随访'}
                    </button>
                </div>
            )}
          </div>
      </div>

      {/* Entry Form, Guide, etc (same as previous) */}
      {isEntryExpanded && assessment && (
          <div className="bg-white rounded-xl shadow-lg border-2 border-teal-500 mb-8 overflow-hidden animate-slideUp">
              {/* ... Entry Form Content ... */}
              <div className="bg-teal-50 px-6 py-4 border-b border-teal-100 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-teal-800 flex items-center gap-2">
                      <span>📝</span> 本次随访记录录入
                  </h3>
                  <div className="text-xs text-teal-600">
                      AI 已根据上次方案自动生成草稿
                  </div>
              </div>
              
              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* ... same logic ... */}
                  <div className="lg:col-span-1 space-y-6">
                      <section className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 h-full">
                           <h4 className="font-bold text-yellow-800 mb-3 flex justify-between items-center">
                               <span>1. 上期复查重点核对</span>
                               <span className="text-xs font-normal opacity-70">请核实执行情况</span>
                           </h4>
                           {formData.medicalCompliance && formData.medicalCompliance.length > 0 ? (
                               <div className="space-y-3">
                                   {formData.medicalCompliance.map((item, idx) => (
                                       <div key={idx} className="bg-white p-3 rounded border border-yellow-100 shadow-sm relative">
                                           <button onClick={() => removeMedicalComplianceItem(idx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 font-bold">×</button>
                                           <div className="font-bold text-slate-800 mb-2 text-sm">{item.item}</div>
                                           <div className="flex gap-2 text-xs flex-wrap">
                                               {[
                                                   { val: 'improved', label: '改善', color: 'text-green-600' },
                                                   { val: 'not_improved', label: '未改善', color: 'text-red-600' },
                                                   { val: 'not_checked', label: '未查', color: 'text-slate-500' }
                                               ].map(opt => (
                                                   <label key={opt.val} className="flex items-center gap-1 cursor-pointer bg-slate-50 px-2 py-1 rounded hover:bg-slate-100">
                                                       <input 
                                                            type="radio" 
                                                            name={`med_${idx}`} 
                                                            checked={item.status === opt.val}
                                                            onChange={() => updateMedicalCompliance(idx, 'status', opt.val)} 
                                                       />
                                                       <span className={opt.color}>{opt.label}</span>
                                                   </label>
                                               ))}
                                           </div>
                                           {item.status === 'not_improved' && (
                                               <input type="text" placeholder="请输入异常数值或情况..." 
                                                   className="mt-2 text-xs border border-red-200 rounded p-1 w-full bg-red-50 focus:outline-none focus:border-red-400"
                                                   value={item.result}
                                                   onChange={(e) => updateMedicalCompliance(idx, 'result', e.target.value)} />
                                           )}
                                       </div>
                                   ))}
                               </div>
                           ) : <p className="text-xs text-slate-400">无特定复查要求</p>}
                      </section>
                  </div>

                  <div className="lg:col-span-2 space-y-6 flex flex-col">
                      <section className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                           <h4 className="font-bold text-slate-800 mb-4 flex items-end gap-2">
                               2. 核心指标录入
                               <span className="text-[10px] text-slate-400 font-normal bg-white px-2 py-0.5 rounded border">参考范围仅供参考</span>
                           </h4>
                           {/* ... indicator inputs ... */}
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-4">
                               <div>
                                   <label className="text-xs text-slate-500 block mb-1 font-medium">
                                       血压 (mmHg) <span className="text-slate-400 font-normal ml-1 text-[10px]">Ref: &lt;140/90</span>
                                   </label>
                                   <div className="flex gap-2">
                                       <div className="relative w-full">
                                            <input type="number" placeholder="收缩压" className="w-full border rounded p-2 text-sm focus:ring-1 focus:ring-teal-500" value={formData.indicators.sbp || ''} onChange={e => updateForm('indicators', 'sbp', Number(e.target.value))} />
                                       </div>
                                       <div className="relative w-full">
                                            <input type="number" placeholder="舒张压" className="w-full border rounded p-2 text-sm focus:ring-1 focus:ring-teal-500" value={formData.indicators.dbp || ''} onChange={e => updateForm('indicators', 'dbp', Number(e.target.value))} />
                                       </div>
                                   </div>
                               </div>
                               <div>
                                   <label className="text-xs text-slate-500 block mb-1 font-medium">
                                       空腹血糖 (mmol/L) <span className="text-slate-400 font-normal ml-1 text-[10px]">Ref: 3.9-6.1</span>
                                   </label>
                                   <input type="number" step="0.1" className="w-full border rounded p-2 text-sm focus:ring-1 focus:ring-teal-500" value={formData.indicators.glucose || ''} onChange={e => updateForm('indicators', 'glucose', Number(e.target.value))} />
                               </div>
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-2">
                               <div>
                                   <label className="text-xs text-slate-500 block mb-1 font-medium">体重 (kg)</label>
                                   <input type="number" className="w-full border rounded p-2 text-sm focus:ring-1 focus:ring-teal-500" value={formData.indicators.weight || ''} onChange={e => updateForm('indicators', 'weight', Number(e.target.value))} />
                               </div>
                           </div>
                           <div className="mt-3 bg-white p-3 rounded border border-slate-100 shadow-sm">
                                <label className="text-xs text-slate-600 block mb-2 font-bold">
                                    血脂四项 (mmol/L)
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div>
                                        <span className="text-[10px] text-slate-400 block mb-1">总胆固醇 (TC) &lt;5.2</span>
                                        <input type="number" step="0.01" className="w-full border rounded p-1.5 text-sm focus:ring-1 focus:ring-teal-500" value={formData.indicators.tc || ''} onChange={e => updateForm('indicators', 'tc', Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 block mb-1">甘油三酯 (TG) &lt;1.7</span>
                                        <input type="number" step="0.01" className="w-full border rounded p-1.5 text-sm focus:ring-1 focus:ring-teal-500" value={formData.indicators.tg || ''} onChange={e => updateForm('indicators', 'tg', Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 block mb-1">低密度 (LDL-C) &lt;3.4</span>
                                        <input type="number" step="0.01" className="w-full border rounded p-1.5 text-sm focus:ring-1 focus:ring-teal-500" value={formData.indicators.ldl || ''} onChange={e => updateForm('indicators', 'ldl', Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 block mb-1">高密度 (HDL-C) &gt;1.0</span>
                                        <input type="number" step="0.01" className="w-full border rounded p-1.5 text-sm focus:ring-1 focus:ring-teal-500" value={formData.indicators.hdl || ''} onChange={e => updateForm('indicators', 'hdl', Number(e.target.value))} />
                                    </div>
                                </div>
                           </div>
                      </section>

                      <section className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                          <h4 className="font-bold text-indigo-800 mb-3">3. 生活方式与备注</h4>
                          <div className="mb-4">
                              <label className="text-xs text-indigo-600 block mb-1 font-bold">生活方式核对</label>
                              {formData.taskCompliance && formData.taskCompliance.length > 0 ? (
                                  <div className="space-y-2">
                                      {formData.taskCompliance.map((task, idx) => (
                                          <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-indigo-100 text-xs">
                                              <span className="truncate max-w-[60%]">{task.description}</span>
                                              <div className="flex gap-1">
                                                  {['achieved', 'partial', 'failed'].map((st:any) => (
                                                      <button key={st} onClick={()=>updateTaskCompliance(idx, st)} 
                                                          className={`px-2 py-0.5 rounded border ${task.status===st ? (st==='achieved'?'bg-green-500 text-white':'bg-slate-400 text-white') : 'bg-white text-slate-400'}`}>
                                                          {st==='achieved'?'达标':st==='partial'?'部分':'未做'}
                                                      </button>
                                                  ))}
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              ) : <div className="text-xs text-slate-400">无具体任务</div>}
                          </div>
                          <div>
                              <label className="text-xs text-indigo-600 block mb-1 font-bold">其他情况备注</label>
                              <textarea 
                                  className="w-full border border-indigo-200 rounded p-2 text-sm h-24 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  placeholder="请输入患者主诉或其他补充信息..."
                                  value={formData.otherInfo || ''}
                                  onChange={e => updateForm('otherInfo', '', e.target.value)}
                              />
                          </div>
                      </section>

                      <button 
                          onClick={handleSubmit} 
                          disabled={isAnalyzing}
                          className="w-full py-3 bg-teal-600 text-white font-bold rounded-lg shadow-lg hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                          {isAnalyzing ? '🤖 AI 正在分析并存档...' : '✅ 提交并生成评估'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Guide Section (Same as previous) */}
      {(latestRecord || assessment) && (
          <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-teal-600">
              {/* ... Guide content ... */}
              <div className="flex justify-between items-start mb-6">
                  <div>
                      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                         <span>📋</span> 下阶段健康管理执行单
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">请受检者保存，用于指导日常生活与下次复查</p>
                  </div>
                  <div className="flex gap-3">
                      {isEditingGuide ? (
                           <>
                             <button onClick={() => setIsEditingGuide(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-sm font-medium">取消</button>
                             <button onClick={handleSaveGuideEdit} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 shadow-sm text-sm font-bold">💾 保存修订</button>
                           </>
                      ) : (
                           <>
                             {latestRecord && !isAssessmentNewer && (
                                <button onClick={() => setIsEditingGuide(true)} className="bg-white border border-teal-200 text-teal-700 px-4 py-2 rounded-lg hover:bg-teal-50 flex items-center gap-2 font-bold shadow-sm text-sm">
                                    ✏️ 修订内容
                                </button>
                             )}
                             <button onClick={handlePrintGuide} className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-bold shadow-sm">
                                🖨️ 打印执行单
                             </button>
                           </>
                      )}
                  </div>
              </div>

              {isEditingGuide && (
                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-4 text-sm text-yellow-800 flex items-center gap-2 animate-pulse">
                      <span>⚠️ 您正在修订执行单内容，修改将同步更新至系统记录。</span>
                  </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                      <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                          <h3 className="font-bold text-blue-800 mb-4 border-b border-blue-200 pb-2">📅 下次复查计划</h3>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                  <span className="text-xs text-slate-500 block uppercase">建议时间</span>
                                  {isEditingGuide ? (
                                      <input 
                                          type="date"
                                          className="text-lg font-bold text-slate-800 bg-white border border-blue-300 rounded px-2 py-1 w-full"
                                          value={guideEditData.suggestedDate}
                                          onChange={e => setGuideEditData({...guideEditData, suggestedDate: e.target.value})}
                                      />
                                  ) : (
                                      <span className="text-xl font-bold text-slate-800">{nextScheduled?.date || "待定"}</span>
                                  )}
                              </div>
                              <div>
                                  <span className="text-xs text-slate-500 block uppercase">当前风险</span>
                                  <span className={`font-bold ${
                                      activeRiskLevel === 'RED' ? 'text-red-600' : 
                                      activeRiskLevel === 'YELLOW' ? 'text-yellow-600' : 'text-green-600'
                                  }`}>
                                      {activeRiskLevel === 'RED' ? '高风险' : 
                                       activeRiskLevel === 'YELLOW' ? '中风险' : '低风险'}
                                  </span>
                              </div>
                          </div>
                          <div>
                              <span className="text-xs text-slate-500 block uppercase mb-1">具体复查项目</span>
                              {isEditingGuide ? (
                                  <textarea 
                                      className="w-full text-sm border border-blue-300 rounded p-2 focus:ring-1 focus:ring-blue-500 h-24"
                                      value={guideEditData.plan}
                                      onChange={e => setGuideEditData({...guideEditData, plan: e.target.value})}
                                  />
                              ) : (
                                  <p className="text-slate-800 font-medium leading-relaxed bg-white p-3 rounded border border-blue-100 whitespace-pre-line">
                                      {activePlanText || "暂无具体项目，请遵医嘱。"}
                                  </p>
                              )}
                          </div>
                      </div>

                      <div className="bg-red-50 p-6 rounded-lg border border-red-100">
                          <h3 className="font-bold text-red-800 mb-4 border-b border-red-200 pb-2">⚠️ 风险警示与问题</h3>
                          {isEditingGuide ? (
                              <textarea 
                                  className="w-full text-sm border border-red-300 rounded p-2 focus:ring-1 focus:ring-red-500 h-24 bg-white"
                                  value={guideEditData.issues}
                                  onChange={e => setGuideEditData({...guideEditData, issues: e.target.value})}
                              />
                          ) : (
                              <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                                  {activeIssues || "本次随访未发现重大新问题，请继续保持。"}
                              </p>
                          )}
                      </div>
                  </div>

                  <div className="bg-green-50 p-6 rounded-lg border border-green-100 h-full">
                      <h3 className="font-bold text-green-800 mb-4 border-b border-green-200 pb-2">🏃 生活方式干预目标</h3>
                      {isEditingGuide ? (
                          <textarea 
                               className="w-full text-sm border border-green-300 rounded p-2 focus:ring-1 focus:ring-green-500 h-48 bg-white"
                               value={guideEditData.goals}
                               onChange={e => setGuideEditData({...guideEditData, goals: e.target.value})}
                               placeholder="每行输入一个目标"
                          />
                      ) : (
                          Array.isArray(activeGoals) && activeGoals.length > 0 ? (
                              <ul className="space-y-3">
                                  {activeGoals.map((goal, i) => (
                                      <li key={i} className="flex items-start gap-2 text-slate-700">
                                          <span className="text-green-600 font-bold mt-0.5">✓</span>
                                          <span>{goal}</span>
                                      </li>
                                  ))}
                              </ul>
                          ) : (
                              <p className="text-slate-500 italic">暂无具体调整建议，请维持健康生活方式。</p>
                          )
                      )}
                      
                      <div className="mt-8 pt-6 border-t border-green-200">
                          <h4 className="font-bold text-sm text-slate-700 mb-2">医生寄语</h4>
                          {isEditingGuide ? (
                              <textarea 
                                  className="w-full text-sm border border-green-300 rounded p-2 focus:ring-1 focus:ring-green-500 h-20 bg-white"
                                  value={guideEditData.message}
                                  onChange={e => setGuideEditData({...guideEditData, message: e.target.value})}
                                  placeholder="请输入给患者的寄语"
                              />
                          ) : (
                              <p className="text-sm text-slate-600 italic">
                                  "{activeMessage || '健康是长期的积累，请坚持执行管理方案。'}"
                              </p>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* SMS Modal */}
      {showSmsModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-scaleIn">
                <h3 className="text-lg font-bold text-slate-800 mb-2">📩 随访提醒短信生成</h3>
                <p className="text-xs text-slate-500 mb-4">场景：患者未接电话或需延期随访。发送后系统将自动延期1个月。</p>
                {isGeneratingSms ? (
                    <div className="py-8 text-center text-teal-600 font-bold animate-pulse">AI 正在撰写短信内容...</div>
                ) : (
                    <textarea 
                        className="w-full h-32 border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-teal-500 mb-4"
                        value={smsContent}
                        onChange={e => setSmsContent(e.target.value)}
                        placeholder="短信内容..."
                    />
                )}
                <div className="flex justify-end gap-3">
                    <button onClick={() => setShowSmsModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">取消</button>
                    <button 
                        onClick={handleSendAndDelay}
                        disabled={isGeneratingSms || !smsContent}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 shadow-lg text-sm disabled:opacity-50"
                    >
                        📤 发送并延期 1 个月
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* History Detail Modal (New Feature) */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-center justify-center backdrop-blur-sm animate-fadeIn" onClick={() => setViewingRecord(null)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 animate-scaleIn m-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">随访记录详情</h3>
                        <div className="text-sm text-slate-500 mt-1">
                            {viewingRecord.date} · {viewingRecord.method}随访
                        </div>
                    </div>
                    <button onClick={() => setViewingRecord(null)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
                </div>

                <div className="space-y-6">
                    {/* Indicators */}
                    <section className="bg-slate-50 p-4 rounded-lg">
                        <h4 className="font-bold text-slate-700 mb-3 text-sm border-l-4 border-blue-500 pl-2">核心指标</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <div><span className="text-slate-400 text-xs block">血压</span><span className="font-bold">{viewingRecord.indicators.sbp}/{viewingRecord.indicators.dbp}</span></div>
                            <div><span className="text-slate-400 text-xs block">血糖</span><span className="font-bold">{viewingRecord.indicators.glucose}</span></div>
                            <div><span className="text-slate-400 text-xs block">体重</span><span className="font-bold">{viewingRecord.indicators.weight}</span></div>
                            <div><span className="text-slate-400 text-xs block">心率</span><span className="font-bold">{viewingRecord.indicators.heartRate || '-'}</span></div>
                        </div>
                        {(viewingRecord.indicators.tc || viewingRecord.indicators.ldl) && (
                            <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-4 gap-4 text-sm">
                                <div><span className="text-slate-400 text-xs block">TC</span>{viewingRecord.indicators.tc || '-'}</div>
                                <div><span className="text-slate-400 text-xs block">TG</span>{viewingRecord.indicators.tg || '-'}</div>
                                <div><span className="text-slate-400 text-xs block">LDL-C</span>{viewingRecord.indicators.ldl || '-'}</div>
                                <div><span className="text-slate-400 text-xs block">HDL-C</span>{viewingRecord.indicators.hdl || '-'}</div>
                            </div>
                        )}
                    </section>

                    {/* Compliance */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <section>
                            <h4 className="font-bold text-slate-700 mb-3 text-sm border-l-4 border-yellow-500 pl-2">医疗依从性</h4>
                            <div className="text-sm space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">服药情况:</span>
                                    <span className="font-medium">{viewingRecord.medication.compliance}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">目前用药:</span>
                                    <span className="font-medium text-right max-w-[150px] truncate" title={viewingRecord.medication.currentDrugs}>{viewingRecord.medication.currentDrugs || '无'}</span>
                                </div>
                                {viewingRecord.medicalCompliance && viewingRecord.medicalCompliance.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-slate-100">
                                        <div className="text-xs text-slate-400 mb-1">复查项目执行:</div>
                                        <ul className="list-disc pl-4 text-xs text-slate-600">
                                            {viewingRecord.medicalCompliance.map((item, i) => (
                                                <li key={i}>
                                                    {item.item}: <span className={item.status==='improved'?'text-green-600':item.status==='not_improved'?'text-red-600':'text-slate-400'}>
                                                        {item.status==='improved'?'改善':item.status==='not_improved'?'未改善':'未查'}
                                                    </span>
                                                    {item.result && ` (${item.result})`}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section>
                            <h4 className="font-bold text-slate-700 mb-3 text-sm border-l-4 border-green-500 pl-2">生活方式</h4>
                            <div className="text-sm grid grid-cols-2 gap-2">
                                <div><span className="text-slate-400 text-xs">饮食:</span> {viewingRecord.lifestyle.diet}</div>
                                <div><span className="text-slate-400 text-xs">运动:</span> {viewingRecord.lifestyle.exercise}</div>
                                <div><span className="text-slate-400 text-xs">睡眠:</span> {viewingRecord.lifestyle.sleepHours}h</div>
                                <div><span className="text-slate-400 text-xs">吸烟:</span> {viewingRecord.lifestyle.smokingAmount}支</div>
                            </div>
                            {viewingRecord.taskCompliance && viewingRecord.taskCompliance.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-100">
                                    <div className="text-xs text-slate-400 mb-1">目标达成:</div>
                                    <div className="flex flex-wrap gap-1">
                                        {viewingRecord.taskCompliance.map((t, i) => (
                                            <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${t.status==='achieved'?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}`}>
                                                {t.description.slice(0, 4)}...
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Assessment */}
                    <section className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h4 className="font-bold text-slate-700 mb-2 text-sm border-l-4 border-purple-500 pl-2 flex justify-between">
                            <span>评估结论</span>
                            <span className={`px-2 py-0.5 rounded text-xs text-white ${viewingRecord.assessment.riskLevel==='RED'?'bg-red-500':viewingRecord.assessment.riskLevel==='YELLOW'?'bg-yellow-500':'bg-green-500'}`}>
                                {viewingRecord.assessment.riskLevel === 'RED' ? '高风险' : viewingRecord.assessment.riskLevel === 'YELLOW' ? '中风险' : '低风险'}
                            </span>
                        </h4>
                        <div className="text-sm text-slate-600 mb-2">
                            <span className="font-bold">主要问题:</span> {viewingRecord.assessment.majorIssues}
                        </div>
                        <div className="text-sm text-slate-600 italic bg-white p-2 rounded border border-slate-100">
                            " {viewingRecord.assessment.doctorMessage} "
                        </div>
                    </section>
                </div>
                
                <div className="mt-6 text-right">
                    <button onClick={() => setViewingRecord(null)} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700">关闭</button>
                </div>
            </div>
        </div>
      )}

      {/* Critical Handle Modal */}
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