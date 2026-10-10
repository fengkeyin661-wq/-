import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FollowUpRecord, RiskLevel, HealthAssessment, ScheduledFollowUp, HealthRecord, CriticalTrackRecord } from '../types';
import { HealthArchive, updateCriticalTrack } from '../services/dataService';
import { analyzeFollowUpRecord, generateFollowUpSMS, generateAnnualReportSummary } from '../services/geminiService';
import {
  buildFollowUpContext,
  buildFollowUpChainSummary,
  buildMergedTimeline,
  computeIndicatorDelta,
  getIndicatorValuesFromRecord,
  filterPriorityFocusItems,
} from '../services/followUpLinkageService';
import { buildFollowUpGuidance } from '../services/followUpGuidance';
import {
  buildSupervisionBrief,
  PLAN_ADHERENCE_LABELS,
  formatPlanAdherenceGrade,
  type AbnormalityFollowUpStatus,
  type PlanAdherenceGrade,
  type SupervisionMetricKey,
} from '../services/followUpSupervisionService';
import { FollowUpWorklistPanel } from './FollowUpWorklistPanel';
import {
  isSmsConfigured,
  resolveArchivePhone,
  sendFollowUpSms,
  sendCriticalSms,
  type SmsSentRole,
} from '../services/smsService';
import { CriticalHandleModal } from './CriticalHandleModal';
import { FollowUpTalkScriptReminder } from './FollowUpTalkScriptReminder';
import { PatientClinicalHeader } from './clinical/PatientClinicalHeader';

export type FollowUpWorkspaceTab = 'timeline' | 'entry' | 'guide';

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
  layout?: 'full' | 'embedded';
  onOpenAssessment?: () => void;
  /** 递增时滚到个体工作区并展开录入（如从档案入口进入随访 Tab） */
  scrollToDetailToken?: number;
  /** 递增时仅展开录入区（评估页内「继续随访」） */
  expandEntryToken?: number;
  /** 评估页嵌入时不重复顶栏（由 App 统一展示） */
  hideClinicalHeader?: boolean;
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
    onRefresh,
    onNavigateDiabetes,
    onNavigateHypertension,
    onNavigateLipid,
    criticalFocus,
    userRole = 'admin',
    layout = 'full',
    onOpenAssessment,
    scrollToDetailToken = 0,
    expandEntryToken = 0,
    hideClinicalHeader = false,
}) => {
  const detailAnchorRef = useRef<HTMLDivElement>(null);
  const [workspaceTab, setWorkspaceTab] = useState<FollowUpWorkspaceTab>(
    layout === 'embedded' ? 'entry' : 'timeline',
  );
  const [worklistCollapsed, setWorklistCollapsed] = useState(false);
  const [contextPanelExpanded, setContextPanelExpanded] = useState(false);
  const [extraMetricsOpen, setExtraMetricsOpen] = useState(false);
  const [metricSkipped, setMetricSkipped] = useState<Partial<Record<SupervisionMetricKey, boolean>>>({});
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
      setWorkspaceTab('entry');
      if (layout === 'full') setWorklistCollapsed(true);
      if (options?.scrollToDetail) {
        requestAnimationFrame(() => {
          detailAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    },
    [onPatientChange, layout],
  );

  useEffect(() => {
    if (layout !== 'embedded') return;
    if (assessment && currentPatientId) setWorkspaceTab('entry');
  }, [layout, assessment, currentPatientId]);

  useEffect(() => {
    if (!scrollToDetailToken) return;
    requestAnimationFrame(() => {
      detailAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setWorkspaceTab('entry');
    });
  }, [scrollToDetailToken]);

  useEffect(() => {
    if (!expandEntryToken) return;
    setWorkspaceTab('entry');
    requestAnimationFrame(() => {
      detailAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [expandEntryToken]);

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

  const supervisionBrief = useMemo(
      () => (patientArchive ? buildSupervisionBrief(patientArchive) : null),
      [patientArchive]
  );

  const priorityFocusItems = useMemo(
      () => supervisionBrief?.riskFocusLines || [],
      [supervisionBrief]
  );

  const followUpGuidance = useMemo(
      () => (patientArchive ? buildFollowUpGuidance(patientArchive) : null),
      [patientArchive]
  );

  const primaryMetricKeys = useMemo(
      () => new Set(supervisionBrief?.metricSlots.map((s) => s.key) || []),
      [supervisionBrief]
  );

  const managementPlanRef = useMemo(() => {
      const plan = assessment?.managementPlan;
      return {
          dietary: plan?.dietary || [],
          exercise: plan?.exercise || [],
      };
  }, [assessment?.managementPlan]);

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

    const brief = patientArchive ? buildSupervisionBrief(patientArchive) : null;
    baseState.medicalCompliance = [];
    baseState.taskCompliance = [];
    baseState.abnormalityFollowUps = (brief?.abnormalityTracks || []).map((row) => ({ ...row }));
    baseState.planAdherenceGrade = undefined;
    baseState.planAdherenceNote = '';
    baseState.priorFollowUpId = latestRecord?.id;
    baseState.sourceScheduleId = nextScheduled?.id;
    baseState.focusSnapshot = brief?.riskFocusLines || [];
    baseState.supervisionSnapshot = brief?.riskFocusLines || [];
    setMetricSkipped({});
    setExtraMetricsOpen(false);
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

  const updateAbnormalityRow = (
    index: number,
    field: 'status' | 'note',
    value: AbnormalityFollowUpStatus | string
  ) => {
    const rows = formData.abnormalityFollowUps || [];
    const next = [...rows];
    if (!next[index]) return;
    next[index] = { ...next[index], [field]: value };
    setFormData((prev) => ({ ...prev, abnormalityFollowUps: next }));
  };

  const ABNORMALITY_STATUS_OPTIONS: { val: AbnormalityFollowUpStatus; label: string }[] = [
    { val: 'pending', label: '待跟进' },
    { val: 'retest_done', label: '已复测' },
    { val: 'further_exam_done', label: '已进一步检查' },
    { val: 'referred', label: '已就医/转诊' },
    { val: 'declined', label: '拒绝/未做' },
  ];

  const handleSubmit = async () => {
    if (!formData.planAdherenceGrade) {
      alert('请选择「健康管理方案落实总评」后再提交。');
      return;
    }
    setIsAnalyzing(true);
    try {
        const skippedNote = Object.entries(metricSkipped)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join('、');
        const gradeSummary = formatPlanAdherenceGrade(formData.planAdherenceGrade);
        const abnSummary = (formData.abnormalityFollowUps || [])
          .map((a) => `${a.item}:${a.status}${a.note ? `(${a.note})` : ''}`)
          .join('；');
        const submitPayload = {
          ...formData,
          otherInfo: [formData.otherInfo, skippedNote ? `本次未测指标：${skippedNote}` : '']
            .filter(Boolean)
            .join('\n'),
          assessment: {
            ...formData.assessment,
            taskReviewSummary: [gradeSummary, formData.planAdherenceNote].filter(Boolean).join(' · '),
          },
        };
        const chainSummary = patientArchive
            ? buildFollowUpChainSummary([...(patientArchive.follow_ups || []), { ...submitPayload, id: 'draft' } as FollowUpRecord], 3)
            : '';
        const result = await analyzeFollowUpRecord(submitPayload, assessment, latestRecord, {
            chainSummary,
            context: followUpContext
                ? {
                      sourceLabel: followUpContext.sourceLabel,
                      focusItems: priorityFocusItems,
                      failedTasks: followUpContext.failedTasks,
                      supervisionNote: `方案总评 ${formData.planAdherenceGrade}/5；异常跟踪：${abnSummary || '无'}`,
                  }
                : undefined,
        });
        const finalData = {
            ...submitPayload,
            supervisionSnapshot: priorityFocusItems,
            indicatorDelta: indicatorPreviewDelta,
            assessment: {
                ...submitPayload.assessment,
                riskLevel: result.riskLevel,
                riskJustification: result.riskJustification,
                doctorMessage: result.doctorMessage,
                majorIssues: result.majorIssues,
                nextCheckPlan: result.nextCheckPlan,
                lifestyleGoals: result.lifestyleGoals,
                continuitySummary: result.continuitySummary,
                adjustedFocusItems: result.adjustedFocusItems,
                taskReviewSummary: result.taskReviewSummary || submitPayload.assessment.taskReviewSummary,
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
        setWorkspaceTab('guide');
        requestAnimationFrame(() => {
          detailAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
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
              setWorkspaceTab('entry');
          }
      } else {
          alert('保存失败: ' + res.message);
      }
  };

  const workspaceTabs: { id: FollowUpWorkspaceTab; label: string }[] = [
    { id: 'timeline', label: '随访路径' },
    { id: 'entry', label: '本次录入' },
    { id: 'guide', label: '执行单' },
  ];

  return (
    <div className="animate-fadeIn pb-10">
      {layout === 'full' && !worklistCollapsed && (
        <FollowUpWorklistPanel
          archives={allArchives}
          currentPatientId={currentPatientId}
          onSelectPatient={handleWorklistSelectPatient}
          onRefresh={() => onRefresh?.()}
          criticalFocus={criticalFocus}
          userRole={userRole}
        />
      )}

      {layout === 'full' && worklistCollapsed && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-xs text-slate-600">
            当前：{healthRecord?.profile.name || currentPatientName || '未选择'}
          </span>
          <button
            type="button"
            onClick={() => setWorklistCollapsed(false)}
            className="text-xs font-bold text-teal-700 hover:underline"
          >
            展开待办队列 · 切换职工
          </button>
        </div>
      )}

      <div id="followup-detail-anchor" ref={detailAnchorRef} className="scroll-mt-4 pt-2">
        {!hideClinicalHeader && healthRecord && currentPatientId ? (
          <PatientClinicalHeader
            healthRecord={healthRecord}
            assessment={assessment}
            subtitle={layout === 'embedded' ? '随访监测工作区' : '个体随访工作区'}
            onOpenAssessment={onOpenAssessment}
            onDelayPlan={handleDelayOneMonth}
            onFollowUpSms={handleGenerateSms}
            showDelayPlan={Boolean(assessment && nextScheduled)}
            showFollowUpSms={Boolean(assessment && nextScheduled)}
            onNavigateDiabetes={onNavigateDiabetes}
            onNavigateHypertension={onNavigateHypertension}
            onNavigateLipid={onNavigateLipid}
            currentArchive={currentArchive ?? undefined}
          />
        ) : layout === 'embedded' ? (
          <h2 className="text-base font-black text-slate-700 mb-4 border-l-4 border-teal-500 pl-3">
            随访监测工作区
          </h2>
        ) : null}

        {currentPatientId && assessment ? (
          <div className="sticky top-0 z-20 mb-4 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {workspaceTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setWorkspaceTab(tab.id)}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-bold transition-colors ${
                  workspaceTab === tab.id
                    ? tab.id === 'entry'
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : layout === 'full' && !currentPatientId ? (
          <div className="rounded-xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
            请从待办队列选择受检者后开始随访
          </div>
        ) : null}
      </div>

      {currentPatientId && assessment && workspaceTab === 'timeline' && (
          <div className="bg-white p-6 rounded-xl shadow border border-slate-100 flex flex-col min-h-[320px] mb-8">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>📅</span> 随访路径
              </h2>
              <button
                type="button"
                onClick={() => setWorkspaceTab('entry')}
                className="text-xs font-bold text-teal-700 hover:underline"
              >
                去录入 →
              </button>
            </div>
            
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
                                <div className="text-xs text-slate-600 mt-1 max-w-[200px]">
                                  {priorityFocusItems.length
                                    ? priorityFocusItems.slice(0, 3).map((f, i) => (
                                        <span key={f} className="block truncate">
                                          {i + 1}. {f}
                                        </span>
                                      ))
                                    : filterPriorityFocusItems(nextScheduled.focusItems || []).slice(0, 2).join(' · ') || '待维护要点'}
                                </div>
                            </div>
                         )}
                    </div>
                )}
            </div>
          </div>
      )}

      {workspaceTab === 'entry' && assessment && currentPatientId && (
          <>
          {followUpContext && (
              <div className="mb-6 space-y-3">
              <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-amber-800">本期监督重点</div>
                    <div className="mt-0.5 text-sm font-bold text-slate-800">{followUpContext.sourceLabel}</div>
                    <p className="mt-1 text-[11px] text-amber-900/85">
                      对照方案整体监督，不必逐项盘问所有指标；中高危与异常复测优先。
                    </p>
                  </div>
                  {followUpContext.criticalTrack ? (
                    <button
                      type="button"
                      onClick={() => currentArchive && setCriticalModalArchive(currentArchive)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                    >
                      危急值待办 →
                    </button>
                  ) : null}
                </div>
                {priorityFocusItems.length > 0 ? (
                  <ol className="mt-3 space-y-2">
                    {priorityFocusItems.map((item, i) => (
                      <li key={item} className="flex gap-2 text-sm text-slate-800">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-black text-white">
                          {i + 1}
                        </span>
                        <span className="font-medium leading-snug pt-0.5">{item}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-amber-900/80">
                    暂无中高危提示：请完成方案总评，并更新异常指标跟踪。
                  </p>
                )}
                {followUpContext.failedTasks.length + followUpContext.partialTasks.length > 0 ? (
                  <div className="mt-3 border-t border-amber-200/80 pt-2">
                    <div className="text-[11px] font-bold text-red-700">上期需跟进</div>
                    <ul className="mt-1 space-y-0.5 text-xs text-red-800">
                      {[...followUpContext.failedTasks, ...followUpContext.partialTasks].map((t) => (
                        <li key={t.taskId || t.description}>· {t.description}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-blue-50 shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setContextPanelExpanded((v) => !v)}
                    className="w-full flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-left hover:bg-teal-100/40"
                  >
                    <span className="text-sm font-bold text-teal-900">辅助信息（指标对比 / 更多上下文）</span>
                    <span className="text-xs text-teal-700">{contextPanelExpanded ? '收起 ▲' : '展开 ▼'}</span>
                  </button>
                  {contextPanelExpanded ? (
                  <div className="px-5 pb-5 border-t border-teal-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm pt-3">
                      <div className="bg-white/80 p-3 rounded-lg border border-teal-100 md:col-span-2">
                          <div className="text-xs font-bold text-teal-700 mb-2">完整核对清单（含合并项）</div>
                          <ul className="flex flex-wrap gap-2 text-slate-700">
                              {(followUpContext.focusItems.length ? followUpContext.focusItems : ['暂无专项']).map((item, i) => (
                                  <li key={i} className="rounded-full bg-teal-50 px-2 py-0.5 text-xs border border-teal-100">{item}</li>
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
                  </div>
                  </div>
                  ) : null}
              </div>
              </div>
          )}
          <FollowUpTalkScriptReminder
              sourceLabel={followUpContext?.sourceLabel}
              className="mb-6"
              defaultExpanded={false}
          />
          <div className="bg-white rounded-xl shadow border border-slate-200 mb-8 overflow-hidden animate-slideUp">
              {/* ... Entry Form Content ... */}
              <div className="bg-teal-50 px-6 py-4 border-b border-teal-100 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-teal-800 flex items-center gap-2">
                      <span>📝</span> 本次随访记录录入
                  </h3>
                  <div className="text-xs text-teal-600">
                      AI 已根据上次方案自动生成草稿
                  </div>
              </div>
              
              <div className="p-6 space-y-8">
                      <section className="bg-yellow-50 p-4 rounded-lg border-2 border-amber-300">
                           <h4 className="font-bold text-amber-900 mb-2">1. 异常指标跟踪</h4>
                           <p className="text-[11px] text-amber-800/90 mb-3">记录复测或进一步检查进展，无需逐项盘问所有化验。</p>
                           {formData.abnormalityFollowUps && formData.abnormalityFollowUps.length > 0 ? (
                               <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                   {formData.abnormalityFollowUps.map((row, idx) => (
                                       <div key={row.key} className="bg-white p-3 rounded border border-amber-100 text-xs space-y-2">
                                           <div className="font-bold text-slate-800">{row.item}</div>
                                           {row.lastResult ? (
                                             <p className="text-slate-500">上次：{row.lastResult}</p>
                                           ) : null}
                                           <select
                                             className="w-full border rounded p-1.5 text-xs bg-slate-50"
                                             value={row.status}
                                             onChange={(e) => updateAbnormalityRow(idx, 'status', e.target.value as AbnormalityFollowUpStatus)}
                                           >
                                             {ABNORMALITY_STATUS_OPTIONS.map((o) => (
                                               <option key={o.val} value={o.val}>{o.label}</option>
                                             ))}
                                           </select>
                                           <input
                                             type="text"
                                             placeholder="结果或安排简述…"
                                             className="w-full border rounded p-1.5 text-xs"
                                             value={row.note || ''}
                                             onChange={(e) => updateAbnormalityRow(idx, 'note', e.target.value)}
                                           />
                                       </div>
                                   ))}
                               </div>
                           ) : (
                             <p className="text-xs text-slate-500">暂无体检异常项；可在备注中记录其他检查安排。</p>
                           )}
                      </section>

                      <section className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                           <h4 className="font-bold text-slate-800 mb-3">2. 风险相关指标（按需）</h4>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             {(supervisionBrief?.metricSlots || []).map((slot) => {
                               const skipped = metricSkipped[slot.key];
                               return (
                                 <div key={slot.key} className="bg-white rounded border border-slate-100 p-3">
                                   <div className="flex justify-between items-start gap-2 mb-1">
                                     <label className="text-xs font-bold text-slate-700">
                                       {slot.label} ({slot.unit})
                                       {slot.refHint ? <span className="font-normal text-slate-400 ml-1">{slot.refHint}</span> : null}
                                     </label>
                                     <label className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0">
                                       <input
                                         type="checkbox"
                                         checked={!!skipped}
                                         onChange={(e) => setMetricSkipped((prev) => ({ ...prev, [slot.key]: e.target.checked }))}
                                       />
                                       本次未测
                                     </label>
                                   </div>
                                   <input
                                     type="number"
                                     step={slot.key === 'glucose' ? 0.1 : slot.key === 'weight' ? 0.1 : 1}
                                     disabled={skipped}
                                     className="w-full border rounded p-2 text-sm disabled:bg-slate-100"
                                     value={formData.indicators[slot.key] ?? ''}
                                     onChange={(e) => updateForm('indicators', slot.key, Number(e.target.value))}
                                   />
                                 </div>
                               );
                             })}
                           </div>
                           <button
                             type="button"
                             onClick={() => setExtraMetricsOpen((v) => !v)}
                             className="mt-3 text-xs font-bold text-teal-700 hover:underline"
                           >
                             {extraMetricsOpen ? '收起更多指标 ▲' : '展开更多指标 ▼'}
                           </button>
                           {extraMetricsOpen ? (
                             <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded border border-slate-100">
                               {(['tc', 'tg', 'ldl', 'hdl'] as const)
                                 .filter((k) => !primaryMetricKeys.has(k))
                                 .map((k) => (
                                   <div key={k}>
                                     <span className="text-[10px] text-slate-400 block mb-1 uppercase">{k}</span>
                                     <input
                                       type="number"
                                       step="0.01"
                                       className="w-full border rounded p-1.5 text-sm"
                                       value={formData.indicators[k] || ''}
                                       onChange={(e) => updateForm('indicators', k, Number(e.target.value))}
                                     />
                                   </div>
                                 ))}
                               {!primaryMetricKeys.has('sbp') ? (
                                 <>
                                   <div>
                                     <span className="text-[10px] text-slate-400 block mb-1">收缩压</span>
                                     <input type="number" className="w-full border rounded p-1.5 text-sm" value={formData.indicators.sbp || ''} onChange={(e) => updateForm('indicators', 'sbp', Number(e.target.value))} />
                                   </div>
                                   <div>
                                     <span className="text-[10px] text-slate-400 block mb-1">舒张压</span>
                                     <input type="number" className="w-full border rounded p-1.5 text-sm" value={formData.indicators.dbp || ''} onChange={(e) => updateForm('indicators', 'dbp', Number(e.target.value))} />
                                   </div>
                                 </>
                               ) : null}
                               {!primaryMetricKeys.has('glucose') ? (
                                 <div>
                                   <span className="text-[10px] text-slate-400 block mb-1">空腹血糖</span>
                                   <input type="number" step="0.1" className="w-full border rounded p-1.5 text-sm" value={formData.indicators.glucose || ''} onChange={(e) => updateForm('indicators', 'glucose', Number(e.target.value))} />
                                 </div>
                               ) : null}
                               {!primaryMetricKeys.has('weight') ? (
                                 <div>
                                   <span className="text-[10px] text-slate-400 block mb-1">体重</span>
                                   <input type="number" className="w-full border rounded p-1.5 text-sm" value={formData.indicators.weight || ''} onChange={(e) => updateForm('indicators', 'weight', Number(e.target.value))} />
                                 </div>
                               ) : null}
                             </div>
                           ) : null}
                      </section>

                      <section className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                          <h4 className="font-bold text-indigo-800 mb-3">3. 健康管理方案落实总评</h4>
                          <p className="text-[11px] text-indigo-900/80 mb-3">对照下方饮食、运动建议整体打分，不必分项盘问。</p>
                          {(managementPlanRef.dietary.length > 0 || managementPlanRef.exercise.length > 0) ? (
                            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="rounded-lg border border-indigo-100 bg-white p-3">
                                <div className="text-xs font-bold text-emerald-800 mb-2">饮食建议（方案）</div>
                                {managementPlanRef.dietary.length ? (
                                  <ul className="text-xs text-slate-700 space-y-1 list-disc pl-4">
                                    {managementPlanRef.dietary.map((line, i) => (
                                      <li key={`d-${i}`}>{line}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-slate-400">暂无</p>
                                )}
                              </div>
                              <div className="rounded-lg border border-indigo-100 bg-white p-3">
                                <div className="text-xs font-bold text-sky-800 mb-2">运动建议（方案）</div>
                                {managementPlanRef.exercise.length ? (
                                  <ul className="text-xs text-slate-700 space-y-1 list-disc pl-4">
                                    {managementPlanRef.exercise.map((line, i) => (
                                      <li key={`e-${i}`}>{line}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-slate-400">暂无</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="mb-3 text-xs text-indigo-800/70">当前评估暂无结构化饮食/运动条目，请结合执行单总评。</p>
                          )}
                          <div className="flex flex-wrap gap-2 mb-3">
                            {([5, 4, 3, 2, 1] as PlanAdherenceGrade[]).map((g) => (
                              <button
                                key={g}
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, planAdherenceGrade: g }))}
                                className={`px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${
                                  formData.planAdherenceGrade === g
                                    ? 'bg-indigo-600 text-white border-indigo-700'
                                    : 'bg-white text-slate-600 border-indigo-200 hover:bg-indigo-100/50'
                                }`}
                              >
                                {g} 分
                              </button>
                            ))}
                          </div>
                          {formData.planAdherenceGrade ? (
                            <p className="text-xs text-indigo-900 mb-2">{PLAN_ADHERENCE_LABELS[formData.planAdherenceGrade]}</p>
                          ) : (
                            <p className="text-xs text-red-600 mb-2">提交前请选择总评</p>
                          )}
                          <input
                            type="text"
                            className="w-full border border-indigo-200 rounded p-2 text-sm bg-white mb-3"
                            placeholder="总评备注（可选，如饮食/运动执行亮点或困难）"
                            value={formData.planAdherenceNote || ''}
                            onChange={(e) => setFormData((prev) => ({ ...prev, planAdherenceNote: e.target.value }))}
                          />
                          <div>
                              <label className="text-xs text-indigo-600 block mb-1 font-bold">沟通备注</label>
                              <textarea 
                                  className="w-full border border-indigo-200 rounded p-2 text-sm h-24 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  placeholder="患者主诉、约定下一步等…"
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
          </>
      )}

      {workspaceTab === 'guide' && (latestRecord || assessment) && (
          <div className="bg-white p-8 rounded-xl shadow border border-slate-200 mb-8">
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

              {followUpGuidance && (followUpGuidance.priorityFocusItems.length > 0 || followUpGuidance.userSteps.length > 0) ? (
                <div className="mb-8 rounded-xl border-2 border-amber-200 bg-amber-50/60 p-5">
                  <h3 className="text-base font-black text-amber-950">本期监督重点（用户端同步）</h3>
                  <p className="mt-1 text-sm text-amber-900/90">
                    {followUpGuidance.userPrepSummary || '请按下列步骤指导用户准备，减少电话来回确认。'}
                  </p>
                  {followUpGuidance.priorityFocusItems.length > 0 ? (
                    <ol className="mt-3 flex flex-wrap gap-2">
                      {followUpGuidance.priorityFocusItems.map((item, i) => (
                        <li
                          key={item}
                          className="rounded-full bg-white border border-amber-200 px-3 py-1 text-sm font-medium text-slate-800"
                        >
                          <span className="text-amber-700 font-black mr-1">{i + 1}</span>
                          {item}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  <ul className="mt-4 space-y-2">
                    {followUpGuidance.userSteps.map((step, i) => (
                      <li key={step.id} className="flex gap-3 rounded-lg bg-white border border-amber-100 px-4 py-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-black text-white">
                          {i + 1}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-slate-800">{step.title}</div>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{step.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

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

                    {viewingRecord.planAdherenceGrade ? (
                        <section className="bg-indigo-50 p-3 rounded-lg text-sm">
                            <h4 className="font-bold text-indigo-900 mb-1 text-sm">方案落实总评</h4>
                            <p>{viewingRecord.planAdherenceGrade}/5 · {formatPlanAdherenceGrade(viewingRecord.planAdherenceGrade)}</p>
                            {viewingRecord.planAdherenceNote ? <p className="text-xs text-slate-600 mt-1">{viewingRecord.planAdherenceNote}</p> : null}
                        </section>
                    ) : null}
                    {viewingRecord.abnormalityFollowUps && viewingRecord.abnormalityFollowUps.length > 0 ? (
                        <section className="bg-amber-50 p-3 rounded-lg text-sm">
                            <h4 className="font-bold text-amber-900 mb-2 text-sm">异常指标跟踪</h4>
                            <ul className="space-y-1 text-xs">
                                {viewingRecord.abnormalityFollowUps.map((a) => (
                                    <li key={a.key}>
                                        {a.item} — {ABNORMALITY_STATUS_OPTIONS.find((o) => o.val === a.status)?.label || a.status}
                                        {a.note ? `（${a.note}）` : ''}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : null}

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