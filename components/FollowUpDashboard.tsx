
// ... existing imports
import React, { useState, useEffect } from 'react';
import { FollowUpRecord, RiskLevel, HealthAssessment, ScheduledFollowUp, HealthRecord } from '../types';
import { HealthArchive } from '../services/dataService'; 
import { analyzeFollowUpRecord, generateFollowUpSMS, generateAnnualReportSummary } from '../services/geminiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine, ReferenceArea } from 'recharts';

interface Props {
// ... existing props
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
    healthRecord
}) => {
  const [isEntryExpanded, setIsEntryExpanded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // State for History Modal
  const [viewingRecord, setViewingRecord] = useState<FollowUpRecord | null>(null);

  // ... existing state definitions (isEditingGuide, guideEditData, showSmsModal, etc.)
  const [isEditingGuide, setIsEditingGuide] = useState(false);
  const [guideEditData, setGuideEditData] = useState<{
      plan: string;
      issues: string;
      goals: string;
      message: string; 
      suggestedDate: string; 
  }>({ plan: '', issues: '', goals: '', message: '', suggestedDate: '' });

  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsContent, setSmsContent] = useState('');
  const [isGeneratingSms, setIsGeneratingSms] = useState(false);

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeChart, setActiveChart] = useState<'bp' | 'metabolic' | 'lipids'>('bp');

  // ... existing sort logic and memos ...
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

  // ... existing active data derivation ...
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

  // ... existing effects and helper functions ...
  const isEligibleForAnnualReport = sortedRecords.length >= 2 && (() => {
      const start = new Date(sortedRecords[0].date);
      const end = new Date(sortedRecords[sortedRecords.length - 1].date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 365;
  })();

  useEffect(() => {
      setGuideEditData({
          plan: activePlanText || '',
          issues: activeIssues || '',
          goals: Array.isArray(activeGoals) ? activeGoals.join('\n') : (typeof activeGoals === 'string' ? activeGoals : ''),
          message: activeMessage || '',
          suggestedDate: nextScheduled ? nextScheduled.date : ''
      });
  }, [activePlanText, activeIssues, activeGoals, activeMessage, nextScheduled]);

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
  
  const maskName = (name: string) => {
      if (isAuthenticated) return name;
      if (!name) return '***';
      return name.charAt(0) + (name.length > 2 ? '**' : '*');
  };

  const maskPhone = (phone?: string) => {
      if (!phone) return '未留电话';
      if (isAuthenticated) return phone;
      if (phone.length < 7) return '****';
      return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
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

  // ... existing updateForm, updateMedicalCompliance, etc. handlers ...
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

  const handleGenerateAnnualReport = async () => {
      if (sortedRecords.length < 2) return;
      setIsGeneratingReport(true);
      const baseline = sortedRecords[0];
      const current = sortedRecords[sortedRecords.length - 1];
      try {
          const aiResult = await generateAnnualReportSummary(baseline, current);
          const aiSummary = aiResult.summary || "分析服务暂不可用。";
          const printWindow = window.open('', '_blank', 'height=900,width=800');
          if (!printWindow) { alert("请允许弹窗"); return; }
          printWindow.document.write(`<html><body><h1>年度报告</h1><p>${aiSummary}</p></body></html>`);
          printWindow.document.close();
      } catch (e) {
          alert("生成失败");
      } finally {
          setIsGeneratingReport(false);
      }
  };

  const handlePrintGuide = () => {
      alert("打印功能已就绪 (逻辑省略)");
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

  // Chart Data Preparation ...
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

      {/* --- Global Reminder Alert Section (Redesigned) --- */}
      {upcomingGlobalTasks.length > 0 && (
          <div className="mb-8 animate-fadeIn">
              {/* ... existing code ... */}
              <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🔔</span>
                  <h2 className="text-xl font-bold text-slate-800">
                      近期随访提醒 
                      <span className="text-sm font-normal text-slate-500 ml-2 bg-slate-100 px-2 py-1 rounded-full">
                          {upcomingGlobalTasks.length} 人待处理
                      </span>
                  </h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {upcomingGlobalTasks.map((task, idx) => {
                      const isOverdue = task.daysLeft < 0;
                      const isToday = task.daysLeft === 0;
                      const badgeColor = isOverdue ? 'bg-red-100 text-red-700' : isToday ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700';
                      const statusText = isOverdue ? `逾期 ${Math.abs(task.daysLeft)} 天` : isToday ? '今天' : `${task.daysLeft} 天后`;

                      return (
                          <div 
                              key={idx}
                              onClick={() => isAuthenticated && onPatientChange && onPatientChange(task.archive)}
                              className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md hover:-translate-y-1 bg-white ${
                                  task.archive.checkup_id === currentPatientId ? 'ring-2 ring-teal-500' : 'border-slate-100'
                              }`}
                          >
                              {/* ... existing card content ... */}
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

                              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mb-2">
