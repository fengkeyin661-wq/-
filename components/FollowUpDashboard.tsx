import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FollowUpRecord, RiskLevel, HealthAssessment, ScheduledFollowUp, HealthRecord, CriticalTrackRecord } from '../types';
import { HealthArchive, updateCriticalTrack } from '../services/dataService';
import { analyzeFollowUpRecord, generateFollowUpSMS, generateAnnualReportSummary } from '../services/geminiService';
import {
  buildFollowUpContext,
  buildFollowUpChainSummary,
  buildMergedTimeline,
  buildTaskComplianceFromPrior,
  computeIndicatorDelta,
  getIndicatorValuesFromRecord,
  mergeFocusItems,
} from '../services/followUpLinkageService';
import { FollowUpWorklistPanel } from './FollowUpWorklistPanel';
import {
  isSmsConfigured,
  resolveArchivePhone,
  sendFollowUpSms,
  sendCriticalSms,
  type SmsSentRole,
} from '../services/smsService';
import { CriticalHandleModal } from './CriticalHandleModal';
import { HealthTrendCharts } from './HealthTrendCharts';
import { HighGlucoseTag } from './HighGlucoseTag';
import { HighBloodPressureTag } from './HighBloodPressureTag';
import { HighLipidTag } from './HighLipidTag';
import { FollowUpTalkScriptReminder } from './FollowUpTalkScriptReminder';

interface Props {
  records: FollowUpRecord[];
  assessment: HealthAssessment | null;
  schedule: ScheduledFollowUp[];
  onAddRecord: (record: Omit<FollowUpRecord, 'id'>) => Promise<{ success: boolean; message?: string }>;
  allArchives?: HealthArchive[]; 
  onPatientChange?: (archive: HealthArchive) => void;
  currentPatientId?: string;
  onUpdateData?: (record: FollowUpRecord | null, schedule: ScheduledFollowUp[]) => void;
  isAuthenticated?: boolean;
  healthRecord?: HealthRecord | null;
  onRefresh?: () => void;
  onNavigateDiabetes?: (archive: HealthArchive) => void;
  onNavigateHypertension?: (archive: HealthArchive) => void;
  onNavigateLipid?: (archive: HealthArchive) => void;
  /** 从 App 等外部入口定位危急值工作队列 */
  criticalFocus?: { checkupId: string | null; openModal: boolean; token: number };
  userRole?: SmsSentRole;
}

const DEFAULT_LIFESTYLE_TASKS: NonNullable<FollowUpRecord['taskCompliance']> = [
  { taskId: 'lifestyle_diet', description: '饮食：低盐低脂、均衡膳食', status: 'achieved' },
  { taskId: 'lifestyle_exercise', description: '运动：每周中等强度有氧运动', status: 'achieved' },
  { taskId: 'lifestyle_sleep', description: '睡眠：规律作息，保证充足睡眠', status: 'achieved' },
  { taskId: 'lifestyle_smoke', description: '吸烟：无吸烟或已戒烟', status: 'achieved' },
];

const buildLifestyleTaskCompliance = (
  assessment: HealthAssessment | null | undefined,
  latestRecord: FollowUpRecord | null,
  isAssessmentNewer: boolean,
): NonNullable<FollowUpRecord['taskCompliance']> => {
  if (assessment?.structuredTasks?.length) {
    return assessment.structuredTasks.map((task) => ({
      taskId: task.id,
      description: [task.description, task.targetValue ? `目标 ${task.targetValue}` : ''].filter(Boolean).join(' · '),
      status: 'achieved' as const,
      note: task.frequency || undefined,
    }));
  }

  const items: string[] = [];
  const appendPlan = (plan?: HealthAssessment['managementPlan']) => {
    if (!plan) return;
    for (const d of plan.dietary || []) items.push(`饮食：${d}`);
    for (const e of plan.exercise || []) items.push(`运动：${e}`);
    for (const m of plan.monitoring || []) items.push(`监测：${m}`);
  };

  if (isAssessmentNewer && assessment) {
    appendPlan(assessment.managementPlan);
  } else if (latestRecord?.assessment?.lifestyleGoals?.length) {
    items.push(...latestRecord.assessment.lifestyleGoals);
  } else {
    appendPlan(assessment?.managementPlan);
  }

  if (items.length === 0) return DEFAULT_LIFESTYLE_TASKS;

  return items.slice(0, 10).map((desc, idx) => ({
    taskId: `lifestyle_${idx}`,
    description: desc,
    status: 'achieved' as const,
  }));
};

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
    onRefresh,
    onNavigateDiabetes,
    onNavigateHypertension,
    onNavigateLipid,
    criticalFocus,
    userRole = 'admin',
}) => {
  const detailAnchorRef = useRef<HTMLDivElement>(null);
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
  const [isSendingSms, setIsSendingSms] = useState(false);

  // State for Critical Value Modal
  const [criticalModalArchive, setCriticalModalArchive] = useState<HealthArchive | null>(null);

  const handleWorklistSelectPatient = useCallback(
    (archive: HealthArchive, options?: { scrollToDetail?: boolean }) => {
      onPatientChange?.(archive);
      setIsEntryExpanded(true);
      if (options?.scrollToDetail) {
        requestAnimationFrame(() => {
          detailAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    },
    [onPatientChange],
  );

  // Sort records by date
  const sortedRecords = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latestRecord = sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1] : null;
  
  const currentArchive = allArchives.find(a => a.checkup_id === currentPatientId);
  const currentPatientName = currentArchive?.name || '受检者';
  const currentPatientPhone = currentArchive ? resolveArchivePhone(currentArchive) : '';

  /**
   * 是否优先展示「建档/年度」综合评估而非随访 AI 结论。
   * 注意：保存随访会刷新档案 updated_at，若用 updated_at 与随访 id 比较会长期误判为「评估更新」，
   * 导致执行单、医生寄语等仍显示旧评估，覆盖最新随访 AI 输出。
   */
  const isAssessmentNewer = React.useMemo(() => {
      if (!assessment) return false;
      if (!latestRecord) return true;
      return false;
  }, [latestRecord, assessment]);

  // Derived Active Data
  const activeRiskLevel = isAssessmentNewer && assessment ? assessment.riskLevel : (latestRecord?.assessment?.riskLevel || assessment?.riskLevel || RiskLevel.GREEN);
  
  const activePlanText = (isAssessmentNewer && assessment 
      ? (assessment.followUpPlan?.nextCheckItems || []).join('、')
      : (latestRecord?.assessment?.nextCheckPlan || assessment?.followUpPlan?.nextCheckItems?.join('、') || '')) || '';

  const activeIssues = (isAssessmentNewer && assessment 
      ? (assessment.isCritical ? assessment.criticalWarning : assessment.summary)
      : (latestRecord?.assessment?.majorIssues || assessment?.summary || '')) || '';

  const activeGoals = isAssessmentNewer && assessment
      ? [
          ...(assessment.managementPlan?.dietary || []),
          ...(assessment.managementPlan?.exercise || []),
        ].slice(0, 5)
      : (latestRecord?.assessment?.lifestyleGoals || []);

  const activeMessage = isAssessmentNewer && assessment
      ? "新的一年评估已完成，请遵照新的管理方案执行。" 
      : (latestRecord?.assessment?.doctorMessage || latestRecord?.assessment?.riskJustification || '');

  const nextScheduled = schedule.find(s => s.status === 'pending');

  const patientArchive = useMemo((): HealthArchive | null => {
      if (!currentArchive) return null;
      return {
          ...currentArchive,
          follow_ups: records,
          follow_up_schedule: schedule,
          assessment_data: assessment || currentArchive.assessment_data,
          health_record: healthRecord || currentArchive.health_record,
      };
  }, [currentArchive, records, schedule, assessment, healthRecord]);

  const followUpContext = useMemo(
      () => (patientArchive ? buildFollowUpContext(patientArchive) : null),
      [patientArchive]
  );

  const mergedTimeline = useMemo(
      () => (patientArchive ? buildMergedTimeline(patientArchive) : []),
      [patientArchive]
  );

  useEffect(() => {
      setGuideEditData({
          plan: activePlanText || '',
          issues: activeIssues || '',
          goals: Array.isArray(activeGoals) ? activeGoals.join('\n') : (typeof activeGoals === 'string' ? activeGoals : ''),
          message: activeMessage || '',
          suggestedDate: nextScheduled ? nextScheduled.date : ''
      });
  }, [activePlanText, activeIssues, activeGoals, activeMessage, nextScheduled]);

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

  const indicatorPreviewDelta = useMemo(() => {
      if (!latestRecord) return followUpContext?.indicatorDeltas || {};
      return computeIndicatorDelta(latestRecord.indicators, formData.indicators);
  }, [latestRecord, formData.indicators, followUpContext?.indicatorDeltas]);

  const autoFillForm = () => {
    const baseState = { ...initialFormState };
    const indicatorDefaults = getIndicatorValuesFromRecord(healthRecord, latestRecord);
    baseState.indicators = {
      ...baseState.indicators,
      sbp: Number(indicatorDefaults.sbp || 0),
      dbp: Number(indicatorDefaults.dbp || 0),
      glucose: Number(indicatorDefaults.glucose || 0),
      weight: Number(indicatorDefaults.weight || 0),
      tc: indicatorDefaults.tc != null ? Number(indicatorDefaults.tc) : 0,
      tg: indicatorDefaults.tg != null ? Number(indicatorDefaults.tg) : 0,
      ldl: indicatorDefaults.ldl != null ? Number(indicatorDefaults.ldl) : 0,
      hdl: indicatorDefaults.hdl != null ? Number(indicatorDefaults.hdl) : 0,
    };

    if (latestRecord) {
        baseState.medication.currentDrugs = latestRecord.medication.currentDrugs || '';
        baseState.organRisks.carotidPlaque = latestRecord.organRisks.carotidPlaque || '无';
        baseState.organRisks.thyroidNodule = latestRecord.organRisks.thyroidNodule || '无';
        baseState.organRisks.carotidStatus = '稳定';
        baseState.organRisks.thyroidStatus = '稳定';
        if (latestRecord.lifestyle) {
            baseState.lifestyle = { ...baseState.lifestyle, ...latestRecord.lifestyle };
        }
    }

    // 单一合并入口：followUpContext 已含排期/上次计划，再并入当前方案文案；
    // mergeFocusItems 会规范化并去重，避免「血压」与「血压复查」并存。
    const itemsToCheck = mergeFocusItems(
      followUpContext?.focusItems,
      nextScheduled?.focusItems,
      activePlanText || '',
    );
    if (itemsToCheck.length > 0) {
        baseState.medicalCompliance = itemsToCheck.map(item => ({
            item,
            status: 'not_checked' as const,
            result: ''
        }));
    } else {
        baseState.medicalCompliance = [{ item: '常规复查项目', status: 'not_checked', result: '' }];
    }

    baseState.taskCompliance = buildTaskComplianceFromPrior(latestRecord, assessment, isAssessmentNewer);
    baseState.priorFollowUpId = latestRecord?.id;
    baseState.sourceScheduleId = nextScheduled?.id;
    baseState.focusSnapshot = itemsToCheck;
    baseState.followUpType =
      followUpContext?.sourceLabel === '危急值二次回访' ? 'critical_secondary' : 'routine';
    baseState.linkedCriticalTrackId = followUpContext?.criticalTrack?.id;

    if (isAssessmentNewer && assessment) {
        baseState.assessment.riskJustification = `基于最新评估：${(assessment.summary || '').slice(0, 50)}...`;
        baseState.assessment.majorIssues = activeIssues || '';
        baseState.assessment.lifestyleGoals = Array.isArray(activeGoals) ? activeGoals : [];
        baseState.assessment.nextCheckPlan = activePlanText || '';
    }
    setFormData(baseState);
  };

  useEffect(() => {
      autoFillForm();
  }, [currentPatientId, activePlanText, latestRecord?.id, isAssessmentNewer, assessment?.summary, nextScheduled?.id, followUpContext?.sourceLabel]);

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
        const chainSummary = patientArchive
            ? buildFollowUpChainSummary([...(patientArchive.follow_ups || []), { ...formData, id: 'draft' } as FollowUpRecord], 3)
            : '';
        const result = await analyzeFollowUpRecord(formData, assessment, latestRecord, {
            chainSummary,
            context: followUpContext
                ? {
                      sourceLabel: followUpContext.sourceLabel,
                      focusItems: followUpContext.focusItems,
                      failedTasks: followUpContext.failedTasks,
                  }
                : undefined,
        });
        const finalData = {
            ...formData,
            indicatorDelta: indicatorPreviewDelta,
            assessment: {
                ...formData.assessment,
                riskLevel: result.riskLevel,
                riskJustification: result.riskJustification,
                doctorMessage: result.doctorMessage,
                majorIssues: result.majorIssues,
                nextCheckPlan: result.nextCheckPlan,
                lifestyleGoals: result.lifestyleGoals,
                continuitySummary: result.continuitySummary,
                adjustedFocusItems: result.adjustedFocusItems,
                taskReviewSummary: result.taskReviewSummary,
                criticalStatusNote: result.criticalStatusNote,
            }
        };
        const saveRes = await onAddRecord(finalData);
        if (!saveRes?.success) {
            alert(saveRes?.message || '随访记录保存失败，请检查网络或权限后重试。');
            return;
        }
        autoFillForm();
        const cloudHint = saveRes?.message ? `\n\n${saveRes.message}` : '';
        if (result?.analysisSource === 'ai') {
            alert('随访记录已保存，并已生成AI分析执行单。' + cloudHint);
        } else {
            alert(
                `随访记录已保存，但AI分析未成功，当前为回退建议。原因：${result?.analysisError || '未获取到模型返回'}${cloudHint}`
            );
        }
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

  /** 本地日历日 YYYY-MM-DD（避免 toISOString 时区偏移） */
  const formatLocalDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
  };

  /** 无人接听等场景：自今天起将下次随访计划延期 1 个月（暂不依赖短信） */
  const handleDelayOneMonth = () => {
      if (!onUpdateData || !nextScheduled) return;
      const base = new Date();
      base.setHours(12, 0, 0, 0);
      base.setMonth(base.getMonth() + 1);
      const newDateStr = formatLocalDate(base);
      if (
          !confirm(
              `电话无人接听或需改期时，可将下次随访自今天起延期 1 个月。\n\n原定：${nextScheduled.date}\n延期至：${newDateStr}\n\n确认延期？`,
          )
      ) {
          return;
      }
      const updatedSchedule = schedule.map((s) =>
          s.id === nextScheduled.id ? { ...s, date: newDateStr } : s,
      );
      onUpdateData(latestRecord ?? null, updatedSchedule);
      alert(`已延期至 ${newDateStr}`);
  };

  const handleSendAndDelay = async () => {
      if (!onUpdateData || !nextScheduled) return;
      if (!currentPatientPhone || !/^1[3-9]\d{9}$/.test(currentPatientPhone)) {
          alert('该职工未登记有效手机号，无法发送短信');
          return;
      }
      if (!isSmsConfigured()) {
          alert('短信服务未配置：请部署 send-sms Edge Function 并设置 VITE_SMS_INVOKE_SECRET');
          return;
      }

      setIsSendingSms(true);
      try {
          const smsRes = await sendFollowUpSms({
              checkupId: currentPatientId,
              phone: currentPatientPhone,
              name: currentPatientName,
              content: smsContent,
              followUpDate: nextScheduled.date,
              sentRole: userRole,
          });
          if (!smsRes.success || smsRes.failCount > 0) {
              alert(`短信发送失败：${smsRes.results[0]?.error || smsRes.message}`);
              return;
          }

          const base = new Date();
          base.setHours(12, 0, 0, 0);
          base.setMonth(base.getMonth() + 1);
          const newDateStr = formatLocalDate(base);
          const updatedSchedule = schedule.map(s => s.id === nextScheduled.id ? { ...s, date: newDateStr } : s);
          onUpdateData(latestRecord ?? null, updatedSchedule);
          alert('短信已发送，随访已自今天起延期 1 个月');
          setShowSmsModal(false);
      } finally {
          setIsSendingSms(false);
      }
  };

  const handleCriticalSave = async (
      record: CriticalTrackRecord,
      options?: { sendSms?: boolean; convertToFollowUp?: boolean; delayContactWeek?: boolean },
  ) => {
      if (!criticalModalArchive) return;
      let recordToSave = { ...record };

      if (options?.delayContactWeek) {
          const res = await updateCriticalTrack(criticalModalArchive.checkup_id, recordToSave);
          if (res.success) {
              alert(`已登记电话联系不上，延期至 ${record.contact_retry_due} 再提醒`);
              setCriticalModalArchive(null);
              if (onRefresh) onRefresh();
          } else {
              alert('保存失败: ' + res.message);
          }
          return;
      }

      if (options?.sendSms) {
          const phone = resolveArchivePhone(criticalModalArchive);
          if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
              alert('该职工未登记有效手机号，无法发送短信');
              return;
          }
          if (!isSmsConfigured()) {
              alert('短信服务未配置：请部署 send-sms Edge Function 并设置 VITE_SMS_INVOKE_SECRET');
              return;
          }
          const summary = criticalModalArchive.assessment_data?.criticalWarning || record.critical_desc;
          const smsRes = await sendCriticalSms({
              checkupId: criticalModalArchive.checkup_id,
              phone,
              name: criticalModalArchive.name,
              summary,
              sentRole: userRole,
          });
          if (!smsRes.success || smsRes.failCount > 0) {
              alert(`短信发送失败：${smsRes.results[0]?.error || smsRes.message}`);
              return;
          }
          const now = new Date().toLocaleString();
          recordToSave = record.status === 'pending_secondary' || record.status === 'archived'
              ? { ...recordToSave, secondary_notify_time: now }
              : { ...recordToSave, initial_notify_time: now };
      }

      const res = await updateCriticalTrack(criticalModalArchive.checkup_id, recordToSave);
      if (res.success) {
          alert(options?.sendSms ? '危急值记录已保存，短信已发送' : '危急值处理记录已更新');
          setCriticalModalArchive(null);
          if (onRefresh) onRefresh();
          if (options?.convertToFollowUp && criticalModalArchive && onPatientChange) {
              onPatientChange(criticalModalArchive);
              setIsEntryExpanded(true);
          }
      } else {
          alert('保存失败: ' + res.message);
      }
  };

  const summaryChartData = assessment ? [
    { name: 'High', value: Math.max(assessment.risks?.red?.length || 0, 0.5), color: '#ef4444' },
    { name: 'Medium', value: Math.max(assessment.risks?.yellow?.length || 0, 0.5), color: '#eab308' },
    { name: 'Low', value: Math.max(5 - (assessment.risks?.red?.length || 0) - (assessment.risks?.yellow?.length || 0), 1), color: '#22c55e' },
  ] : [];

  return (
    <div className="animate-fadeIn pb-10">
      <FollowUpWorklistPanel
        archives={allArchives}
        currentPatientId={currentPatientId}
        onSelectPatient={handleWorklistSelectPatient}
        onRefresh={() => onRefresh?.()}
        criticalFocus={criticalFocus}
        userRole={userRole}
      />

      <div id="followup-detail-anchor" ref={detailAnchorRef} className="scroll-mt-4 pt-2">
        <h2 className="text-base font-black text-slate-700 mb-4 border-l-4 border-teal-500 pl-3">个体随访工作区</h2>
      </div>

      {/* Charts and Timeline Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Left Column: 风险评估与方案（含近年指标趋势） */}
          <div className="lg:col-span-2 space-y-6">
              {currentPatientId ? (
                  <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden animate-fadeIn">
                      <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                          <div>
                              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                                  <span>📋</span> 风险评估与方案
                              </h3>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                  综合评估结论与历年体检/随访指标趋势同一视图查看
                              </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {healthRecord && onNavigateDiabetes && currentArchive && (
                              <HighGlucoseTag
                                record={healthRecord}
                                onClick={() => onNavigateDiabetes(currentArchive)}
                              />
                            )}
                            {healthRecord && onNavigateHypertension && currentArchive && (
                              <HighBloodPressureTag
                                record={healthRecord}
                                onClick={() => onNavigateHypertension(currentArchive)}
                              />
                            )}
                            {healthRecord && onNavigateLipid && currentArchive && (
                              <HighLipidTag
                                record={healthRecord}
                                onClick={() => onNavigateLipid(currentArchive)}
                              />
                            )}
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
                      </div>

                      {healthRecord ? (
                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-100">
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
                              <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">空腹血糖 / HbA1c</span>
                                  <span className="text-slate-700">
                                    {healthRecord.checkup?.labBasic?.glucose?.fasting || '-'}
                                    {' / '}
                                    {healthRecord.checkup?.labBasic?.hba1c ?? healthRecord.checkup?.optional?.hba1c ?? '-'}
                                  </span>
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
                      ) : (
                          <div className="px-5 py-4 text-sm text-slate-500 border-b border-slate-100">
                              档案详情加载中或未选中，下方仍可查看该职工历年指标趋势。
                          </div>
                      )}

                      {assessment && (assessment.followUpPlan?.nextCheckItems?.length || assessment.managementPlan) ? (
                          <div className="px-5 py-4 border-b border-slate-100 bg-teal-50/40">
                              <h4 className="text-xs font-black uppercase text-teal-800 mb-2">管理方案要点</h4>
                              {assessment.followUpPlan?.nextCheckItems?.length ? (
                                  <p className="text-xs text-slate-700 mb-2">
                                      <span className="font-bold text-slate-800">复查重点：</span>
                                      {assessment.followUpPlan.nextCheckItems.join('、')}
                                  </p>
                              ) : null}
                              {assessment.managementPlan?.monitoring?.length ? (
                                  <p className="text-xs text-slate-600">
                                      <span className="font-bold text-slate-700">监测建议：</span>
                                      {assessment.managementPlan.monitoring.slice(0, 4).join('；')}
                                  </p>
                              ) : null}
                          </div>
                      ) : null}

                      <div className="p-5">
                          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
                              <span>📈</span> 近年核心指标变化趋势
                          </h4>
                          <p className="text-xs text-slate-500 mb-4">
                              汇总历年体检与随访录入的血压、体重、血糖、血脂等观测值，便于对照评估与干预效果
                          </p>
                          <HealthTrendCharts checkupId={currentPatientId} variant="admin" />
                      </div>
                  </div>
              ) : (
                  <div className="bg-white p-8 rounded-xl shadow border border-slate-100 text-center text-sm text-slate-400">
                      请从上方随访工作列表选择受检者，查看风险评估与指标趋势
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
                    <button
                        type="button"
                        onClick={handleDelayOneMonth}
                        title="电话无人接听时可延期一个月"
                        className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-100 font-bold"
                    >
                        延期1个月
                    </button>
                )}
            </h2>
            
            <div className="flex-1 overflow-y-auto pr-2 relative">
                {!assessment ? (
                    <div className="text-center py-10 text-slate-400">请选择人员</div>
                ) : (
                    <div className="space-y-6 pl-4 border-l-2 border-slate-100 ml-2">
                         {healthRecord?.checkup?.basics?.sbp && (
                             <div className="relative">
                                <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full border-2 border-white ring-2 ring-slate-400 bg-slate-400"></div>
                                <div className="text-xs text-slate-400 mb-1">{healthRecord.profile?.checkupDate || '建档日'}</div>
                                <div className="text-sm font-bold text-slate-600">健康建档(基线)</div>
                             </div>
                         )}

                         {mergedTimeline.map((node) => {
                            const isFollowUp = node.type === 'follow_up';
                            const dotColor =
                              node.type.startsWith('critical')
                                ? 'ring-red-500 bg-red-500'
                                : node.riskLevel === 'RED'
                                ? 'ring-red-500 bg-red-500'
                                : node.riskLevel === 'YELLOW'
                                ? 'ring-yellow-500 bg-yellow-500'
                                : 'ring-teal-500 bg-teal-500';
                            return (
                            <div
                                key={node.id}
                                className={`relative ${isFollowUp ? 'cursor-pointer hover:bg-slate-50 p-2 -ml-2 rounded-lg transition-all group' : 'p-2 -ml-2'}`}
                                onClick={() => {
                                  if (isFollowUp) {
                                    const rec = sortedRecords.find((r) => r.id === node.id);
                                    if (rec) setViewingRecord(rec);
                                  }
                                }}
                            >
                                <div className={`absolute -left-[23px] top-3 w-4 h-4 rounded-full border-2 border-white ring-2 ${dotColor}`}></div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-xs text-slate-400 mb-1">{node.date}</div>
                                        <div className="text-sm font-bold text-slate-700 group-hover:text-teal-700">{node.title}</div>
                                        {node.summary && (
                                          <div className="text-xs text-slate-500 mt-1 line-clamp-2">{node.summary}</div>
                                        )}
                                        {node.linkedCritical && (
                                          <span className="text-[10px] text-red-600 bg-red-50 px-1 rounded mt-1 inline-block">关联危急值</span>
                                        )}
                                    </div>
                                    {isFollowUp && (
                                      <span className="text-[10px] text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity bg-teal-50 px-2 py-1 rounded">查看详情</span>
                                    )}
                                </div>
                            </div>
                            );
                         })}
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
          <>
          {followUpContext && (
              <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl border border-teal-200 p-5 mb-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div>
                          <h3 className="text-lg font-bold text-teal-900 flex items-center gap-2">
                              <span>🎯</span> 本次随访要点
                          </h3>
                          <span className="text-xs bg-teal-600 text-white px-2 py-0.5 rounded-full mt-1 inline-block">
                              {followUpContext.sourceLabel}
                          </span>
                      </div>
                      {followUpContext.criticalTrack && (
                          <button
                              type="button"
                              onClick={() => currentArchive && setCriticalModalArchive(currentArchive)}
                              className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-700"
                          >
                              危急值：{followUpContext.criticalTrack.status === 'pending_initial' ? '待初次通知' : '待二次回访'} →
                          </button>
                      )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="bg-white/80 p-3 rounded-lg border border-teal-100">
                          <div className="text-xs font-bold text-teal-700 mb-2">本期核对清单</div>
                          <ul className="space-y-1 text-slate-700">
                              {(followUpContext.focusItems.length ? followUpContext.focusItems : ['常规复查']).map((item, i) => (
                                  <li key={i} className="flex gap-1"><span className="text-teal-500">•</span>{item}</li>
                              ))}
                          </ul>
                      </div>
                      <div className="bg-white/80 p-3 rounded-lg border border-teal-100">
                          <div className="text-xs font-bold text-teal-700 mb-2">与上次指标对比</div>
                          {Object.keys(indicatorPreviewDelta).length === 0 ? (
                              <p className="text-slate-500 text-xs">录入后将显示与上次随访的变化</p>
                          ) : (
                              <ul className="space-y-1">
                                  {Object.entries(indicatorPreviewDelta).map(([key, d]) => (
                                      <li key={key} className="flex justify-between text-xs">
                                          <span>{key}</span>
                                          <span className={d.curr < d.prev ? 'text-green-600' : d.curr > d.prev ? 'text-red-600' : ''}>
                                              {d.prev} → {d.curr} {d.unit}
                                          </span>
                                      </li>
                                  ))}
                              </ul>
                          )}
                      </div>
                      <div className="bg-white/80 p-3 rounded-lg border border-teal-100">
                          <div className="text-xs font-bold text-teal-700 mb-2">上期未达标任务</div>
                          {followUpContext.failedTasks.length + followUpContext.partialTasks.length === 0 ? (
                              <p className="text-slate-500 text-xs">上期任务均已达标或无记录</p>
                          ) : (
                              <ul className="space-y-1 text-xs text-slate-700">
                                  {[...followUpContext.failedTasks, ...followUpContext.partialTasks].map((t, i) => (
                                      <li key={i} className="text-red-700">⚠ {t.description}</li>
                                  ))}
                              </ul>
                          )}
                      </div>
                  </div>
              </div>
          )}
          <FollowUpTalkScriptReminder
              sourceLabel={followUpContext?.sourceLabel}
              className="mb-6"
          />
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
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                              <div>
                                  <label className="text-xs text-indigo-600 block mb-1 font-bold">饮食情况</label>
                                  <input
                                      type="text"
                                      className="w-full border border-indigo-200 rounded p-2 text-sm bg-white"
                                      value={formData.lifestyle.diet}
                                      onChange={(e) => updateForm('lifestyle', 'diet', e.target.value)}
                                  />
                              </div>
                              <div>
                                  <label className="text-xs text-indigo-600 block mb-1 font-bold">运动情况</label>
                                  <input
                                      type="text"
                                      className="w-full border border-indigo-200 rounded p-2 text-sm bg-white"
                                      value={formData.lifestyle.exercise}
                                      onChange={(e) => updateForm('lifestyle', 'exercise', e.target.value)}
                                  />
                              </div>
                              <div>
                                  <label className="text-xs text-indigo-600 block mb-1 font-bold">睡眠 (小时)</label>
                                  <input
                                      type="number"
                                      step="0.5"
                                      className="w-full border border-indigo-200 rounded p-2 text-sm bg-white"
                                      value={formData.lifestyle.sleepHours || ''}
                                      onChange={(e) => updateForm('lifestyle', 'sleepHours', Number(e.target.value))}
                                  />
                              </div>
                              <div>
                                  <label className="text-xs text-indigo-600 block mb-1 font-bold">吸烟 (支/日)</label>
                                  <input
                                      type="number"
                                      className="w-full border border-indigo-200 rounded p-2 text-sm bg-white"
                                      value={formData.lifestyle.smokingAmount ?? ''}
                                      onChange={(e) => updateForm('lifestyle', 'smokingAmount', Number(e.target.value))}
                                  />
                              </div>
                          </div>
                          <div className="mb-4">
                              <label className="text-xs text-indigo-600 block mb-1 font-bold">生活方式核对</label>
                              {formData.taskCompliance && formData.taskCompliance.length > 0 ? (
                                  <div className="space-y-2">
                                      {formData.taskCompliance.map((task, idx) => (
                                          <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-indigo-100 text-xs">
                                              <span className="truncate max-w-[60%]" title={task.description}>{task.description}</span>
                                              <div className="flex gap-1">
                                                  {(['achieved', 'partial', 'failed'] as const).map((st) => (
                                                      <button key={st} onClick={()=>updateTaskCompliance(idx, st)} 
                                                          className={`px-2 py-0.5 rounded border ${task.status===st ? (st==='achieved'?'bg-green-500 text-white':st==='partial'?'bg-amber-500 text-white':'bg-red-500 text-white') : 'bg-white text-slate-400'}`}>
                                                          {st==='achieved'?'达标':st==='partial'?'部分':'未做'}
                                                      </button>
                                                  ))}
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              ) : (
                                  <div className="text-xs text-slate-400">暂无核对项，请根据健康管理方案手动补充备注</div>
                              )}
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
          </>
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
                <p className="text-xs text-slate-500 mb-2">场景：患者未接电话或需延期随访。发送成功后系统将自动延期 1 个月。</p>
                <p className="text-xs text-slate-600 mb-4">
                    发送至：<span className="font-mono font-bold">{currentPatientPhone || '未登记手机号'}</span>
                    {!isSmsConfigured() && (
                        <span className="block text-amber-600 mt-1">短信网关未配置，发送按钮不可用</span>
                    )}
                </p>
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
                        disabled={isGeneratingSms || isSendingSms || !smsContent || !currentPatientPhone || !isSmsConfigured()}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 shadow-lg text-sm disabled:opacity-50"
                    >
                        {isSendingSms ? '发送中…' : '📤 发送并延期 1 个月'}
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
                                <div><span className="text-slate-400 text-xs">饮食:</span> {viewingRecord.lifestyle.diet || '-'}</div>
                                <div><span className="text-slate-400 text-xs">运动:</span> {viewingRecord.lifestyle.exercise || '-'}</div>
                                <div><span className="text-slate-400 text-xs">睡眠:</span> {viewingRecord.lifestyle.sleepHours ? `${viewingRecord.lifestyle.sleepHours}h` : '-'}</div>
                                <div><span className="text-slate-400 text-xs">吸烟:</span> {viewingRecord.lifestyle.smokingAmount != null ? `${viewingRecord.lifestyle.smokingAmount}支/日` : '-'}</div>
                            </div>
                            {viewingRecord.taskCompliance && viewingRecord.taskCompliance.length > 0 ? (
                                <div className="mt-2 pt-2 border-t border-slate-100">
                                    <div className="text-xs text-slate-400 mb-1">生活方式核对:</div>
                                    <ul className="space-y-1">
                                        {viewingRecord.taskCompliance.map((t, i) => (
                                            <li key={i} className="text-xs text-slate-600 flex justify-between gap-2">
                                                <span className="flex-1">{t.description}</span>
                                                <span className={`shrink-0 px-1.5 py-0.5 rounded ${
                                                    t.status === 'achieved' ? 'bg-green-100 text-green-700' :
                                                    t.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                    {t.status === 'achieved' ? '达标' : t.status === 'partial' ? '部分' : '未做'}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-400">生活方式核对：无具体记录</div>
                            )}
                        </section>
                    </div>

                    {/* Assessment */}
                    <section className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h4 className="font-bold text-slate-700 mb-2 text-sm border-l-4 border-purple-500 pl-2 flex justify-between">
                            <span>评估结论</span>
                            <span className={`px-2 py-0.5 rounded text-xs text-white ${viewingRecord.assessment?.riskLevel==='RED'?'bg-red-500':viewingRecord.assessment?.riskLevel==='YELLOW'?'bg-yellow-500':'bg-green-500'}`}>
                                {viewingRecord.assessment?.riskLevel === 'RED' ? '高风险' : viewingRecord.assessment?.riskLevel === 'YELLOW' ? '中风险' : '低风险'}
                            </span>
                        </h4>
                        {viewingRecord.assessment?.continuitySummary && (
                            <div className="text-sm text-teal-700 mb-2 bg-teal-50 p-2 rounded">
                                <span className="font-bold">进展摘要:</span> {viewingRecord.assessment.continuitySummary}
                            </div>
                        )}
                        <div className="text-sm text-slate-600 mb-2">
                            <span className="font-bold">主要问题:</span> {viewingRecord.assessment?.majorIssues || '—'}
                        </div>
                        <div className="text-sm text-slate-600 italic bg-white p-2 rounded border border-slate-100">
                            " {viewingRecord.assessment?.doctorMessage || '暂无寄语'} "
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
              onConvertToFollowUp={onPatientChange ? () => onPatientChange(criticalModalArchive) : undefined}
          />
      )}

    </div>
  );
};