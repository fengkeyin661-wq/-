
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layout } from './components/Layout';
import { HealthSurvey } from './components/HealthSurvey';
import { AssessmentReport } from './components/AssessmentReport';
import { FollowUpDashboard } from './components/FollowUpDashboard';
import { HospitalHeatmap } from './components/HospitalHeatmap';
import { AdminConsole } from './components/AdminConsole';
import { LoginModal } from './components/LoginModal';
import { NativeSurveyForm } from './components/NativeSurveyForm';
import { UserApp } from './components/user/UserApp';
import { HomeAdmin } from './components/HomeAdmin';
import { ResourceAdmin } from './components/ResourceAdmin'; 
import { SystemRiskPortrait } from './components/SystemRiskPortrait';
import { DoctorPatients } from './components/DoctorPatients';
import { DoctorMessageCenter } from './components/DoctorMessageCenter';
import { CriticalFollowUpManager } from './components/CriticalFollowUpManager'; // New Import
import { ElderlyAssessmentModule } from './components/ElderlyAssessmentModule';

import { HealthRecord, HealthAssessment, FollowUpRecord, ScheduledFollowUp, RiskAnalysisData, QuestionnaireData, ElderlyAssessmentData } from './types';
import { generateHealthAssessment, generateFollowUpSchedule, parseHealthDataFromText } from './services/geminiService';
import { HealthArchive, updateArchiveData, generateNextScheduleItem, saveArchive, fetchArchives, findArchiveByCheckupId, updateRiskAnalysis, updateHealthRecordOnly } from './services/dataService';
import { loginUserDualPath } from './services/userLoginService';
import { signUpWithPhonePassword } from './services/authService';
import { generateSystemPortraits, evaluateRiskModels } from './services/riskModelService';
import { ContentItem, fetchInteractions, fetchContent, isHealthManagerContent, getDoctorSigningUnreadTotal } from './services/contentService';
import { ElderlyAssessmentResult, mergeElderlyResultToAssessment } from './services/elderlyAssessmentService';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';

type PortalMode = 'all' | 'admin' | 'ops' | 'doctor' | 'user';

/** 随访提交后：把 AI 生成的复查计划与要点合并进档案 assessment，避免界面仍读旧评估 */
const mergeAssessmentFromFollowUpRecord = (
  base: HealthAssessment,
  fu: FollowUpRecord['assessment']
): HealthAssessment => {
  const nextItems = fu.nextCheckPlan
    ? fu.nextCheckPlan.split(/[，,、;；\n]/).map((s) => s.trim()).filter((s) => s.length > 0)
    : [];
  const goals = (fu.lifestyleGoals || []).filter((g) => g && String(g).trim());
  const baseMon = base.managementPlan?.monitoring || [];
  const stripped = baseMon.filter((m) => !String(m).startsWith('【随访】'));
  const monitoring =
    goals.length > 0
      ? [...stripped, ...goals.map((g) => `【随访】${g}`)].slice(0, 25)
      : base.managementPlan.monitoring;
  return {
    ...base,
    riskLevel: fu.riskLevel,
    summary: (fu.majorIssues && fu.majorIssues.trim()) || base.summary,
    followUpPlan: {
      ...base.followUpPlan,
      nextCheckItems: nextItems.length ? nextItems : base.followUpPlan.nextCheckItems,
    },
    managementPlan: {
      ...base.managementPlan,
      monitoring,
    },
  };
};

/** 随访提交后：把本次核心指标沉淀到 health_record，供用户端基础指标同源读取 */
const mergeHealthRecordFromFollowUp = (
  base: HealthRecord,
  follow: Omit<FollowUpRecord, 'id'>
): HealthRecord => {
  const indicators = follow.indicators || ({} as any);
  const basics = base.checkup?.basics || ({} as any);
  const labBasic = base.checkup?.labBasic || ({} as any);
  const lipids = labBasic.lipids || {};
  const glucose = labBasic.glucose || {};
  const nextWeight = Number(indicators.weight || basics.weight || 0);
  const height = Number(basics.height || 0);
  const bmi =
    height > 0 && nextWeight > 0 ? Number((nextWeight / Math.pow(height / 100, 2)).toFixed(1)) : basics.bmi;

  return {
    ...base,
    checkup: {
      ...base.checkup,
      basics: {
        ...basics,
        sbp: Number(indicators.sbp || basics.sbp || 0),
        dbp: Number(indicators.dbp || basics.dbp || 0),
        weight: nextWeight,
        bmi,
      },
      labBasic: {
        ...labBasic,
        glucose: {
          ...glucose,
          fasting:
            indicators.glucose != null && Number.isFinite(Number(indicators.glucose))
              ? String(indicators.glucose)
              : glucose.fasting,
        },
        lipids: {
          ...lipids,
          tc:
            indicators.tc != null && Number.isFinite(Number(indicators.tc))
              ? String(indicators.tc)
              : lipids.tc,
          tg:
            indicators.tg != null && Number.isFinite(Number(indicators.tg))
              ? String(indicators.tg)
              : lipids.tg,
          ldl:
            indicators.ldl != null && Number.isFinite(Number(indicators.ldl))
              ? String(indicators.ldl)
              : lipids.ldl,
          hdl:
            indicators.hdl != null && Number.isFinite(Number(indicators.hdl))
              ? String(indicators.hdl)
              : lipids.hdl,
        },
      },
    },
  };
};

const detectPortalModeFromHostname = (): PortalMode => {
  if (typeof window === 'undefined') return 'all';
  const host = window.location.hostname.toLowerCase();
  if (host.startsWith('admin.')) return 'admin';
  if (host.startsWith('ops.')) return 'ops';
  if (host.startsWith('doctor.')) return 'doctor';
  if (host.startsWith('user.')) return 'user';
  return 'all';
};

export const App: React.FC = () => {
  const portalMode = detectPortalModeFromHostname();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'home' | 'user' | 'resource_admin' | 'doctor' | null>(null);
  
  // Login Logic State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginRoleContext, setLoginRoleContext] = useState<{title: string, color: string, allowedRoles: string[]} | undefined>(undefined);
  
  // User Entry State
  const [showUserEntry, setShowUserEntry] = useState(false);
  const [userCheckupId, setUserCheckupId] = useState('');
  const [userLoginPhone, setUserLoginPhone] = useState('');
  const [userLoginPassword, setUserLoginPassword] = useState('');
  const [showUserRegister, setShowUserRegister] = useState(false);
  const [userRegisterPhone, setUserRegisterPhone] = useState('');
  const [userRegisterPassword, setUserRegisterPassword] = useState('');
  const [userRegisterPassword2, setUserRegisterPassword2] = useState('');
  
  // Doctor State
  const [currentDoctor, setCurrentDoctor] = useState<ContentItem | null>(null); 
  /** 医生侧栏「消息」角标：全部签约用户未读之和 */
  const [doctorMessageUnread, setDoctorMessageUnread] = useState(0);
  const baseTitleRef = useRef<string>(typeof document !== 'undefined' ? document.title : '健康管理系统');
  const prevDoctorUnreadRef = useRef<number>(0);
  const [healthManagerContacts, setHealthManagerContacts] = useState<ContentItem[]>([]);
  const [previewQr, setPreviewQr] = useState<string | null>(null);

  // Medical Data State
  const [archives, setArchives] = useState<HealthArchive[]>([]);
  const [healthRecord, setHealthRecord] = useState<HealthRecord | null>(null);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [schedule, setSchedule] = useState<ScheduledFollowUp[]>([]);
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysisData | undefined>(undefined);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingElderly, setIsSavingElderly] = useState(false);

  const ensureSupabaseSessionForStaff = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    if (!isSupabaseConfigured()) return { ok: false, message: 'Supabase 未配置' };
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) return { ok: false, message: sessionErr.message };
      if (sessionData.session) return { ok: true };

      const { error: anonErr } = await supabase.auth.signInAnonymously();
      if (anonErr) {
        return {
          ok: false,
          message: `无法创建 Supabase 会话：${anonErr.message}。请在 Supabase Auth 开启 Anonymous sign-ins，或改用真实账号登录。`,
        };
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.message || '创建 Supabase 会话失败' };
    }
  }, []);

  const canShowAdminEntry = portalMode === 'all' || portalMode === 'admin';
  const canShowOpsEntry = portalMode === 'all' || portalMode === 'ops';
  const canShowDoctorEntry = portalMode === 'all' || portalMode === 'doctor';
  /** 职工健康入口仅在主域名聚合页展示；`user.` 子域直达 UserApp，不在此展示 */
  const canShowUserEntry = portalMode === 'all';

  useEffect(() => {
    if (isAuthenticated && (currentUserRole === 'admin' || currentUserRole === 'doctor')) {
        refreshArchives();
    }
  }, [isAuthenticated, currentUserRole, currentDoctor]);

  useEffect(() => {
    if (!canShowUserEntry) return;
    let cancelled = false;
    (async () => {
      try {
        const doctors = await fetchContent('doctor', 'active');
        const managers = doctors.filter(isHealthManagerContent);
        if (!cancelled) setHealthManagerContacts(managers);
      } catch {
        if (!cancelled) setHealthManagerContacts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canShowUserEntry]);

  useEffect(() => {
    if (currentUserRole !== 'doctor' || !currentDoctor) {
      setDoctorMessageUnread(0);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const n = await getDoctorSigningUnreadTotal(currentDoctor.id, currentDoctor.title);
        if (!cancelled) setDoctorMessageUnread(n);
      } catch {
        if (!cancelled) setDoctorMessageUnread(0);
      }
    };
    tick();
    const id = window.setInterval(tick, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [currentUserRole, currentDoctor?.id, currentDoctor?.title]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const baseTitle = baseTitleRef.current || '健康管理系统';
    if (currentUserRole === 'doctor' && doctorMessageUnread > 0) {
      document.title = `(${doctorMessageUnread}) 条未读消息 - ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [currentUserRole, doctorMessageUnread]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentUserRole !== 'doctor') {
      prevDoctorUnreadRef.current = 0;
      return;
    }
    if (!('Notification' in window)) return;

    const maybeRequestPermission = async () => {
      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch {
          /* ignore */
        }
      }
    };
    maybeRequestPermission();
  }, [currentUserRole]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentUserRole !== 'doctor') {
      prevDoctorUnreadRef.current = 0;
      return;
    }
    if (!('Notification' in window)) return;

    const prev = prevDoctorUnreadRef.current;
    prevDoctorUnreadRef.current = doctorMessageUnread;

    const hasNewUnread = doctorMessageUnread > prev;
    const shouldNotify = hasNewUnread && Notification.permission === 'granted' && document.hidden;
    if (!shouldNotify) return;

    const notification = new Notification('医生工作站新消息', {
      body: `您有 ${doctorMessageUnread} 条未读消息，点击前往处理。`,
      tag: 'doctor-unread',
    });
    notification.onclick = () => {
      window.focus();
      setActiveTab('doctor_messages');
      notification.close();
    };
  }, [currentUserRole, doctorMessageUnread]);

  const refreshArchives = async () => {
    const allArchives = await fetchArchives();

    if (currentUserRole === 'doctor' && currentDoctor) {
        try {
            const interactions = await fetchInteractions();
            const myPatientIds = interactions
                .filter(i => 
                    i.type === 'doctor_signing' && 
                    i.targetId === currentDoctor.id && 
                    i.status === 'confirmed'
                )
                .map(i => i.userId);
            const myArchives = allArchives.filter(a => myPatientIds.includes(a.checkup_id));
            setArchives(myArchives);
        } catch (e) {
            console.error("Failed to filter doctor patients", e);
            setArchives([]); 
        }
    } else {
        setArchives(allArchives);
    }
  };

  const handleLoginSuccess = async (role: 'admin' | 'home' | 'resource_admin' | 'doctor', doctorInfo?: ContentItem) => {
    if (portalMode === 'admin' && !['admin', 'home'].includes(role)) {
        alert('当前子域仅允许管理控制台登录');
        return;
    }
    if (portalMode === 'ops' && role !== 'resource_admin') {
        alert('当前子域仅允许资源运营台登录');
        return;
    }
    if (portalMode === 'doctor' && role !== 'doctor') {
        alert('当前子域仅允许医生工作站登录');
        return;
    }
    if (portalMode === 'user') {
        alert('当前子域仅允许用户端登录');
        return;
    }

    setIsAuthenticated(true);
    setCurrentUserRole(role);
    setShowLoginModal(false);

    // 后台/医生登录后，确保持有 Supabase authenticated 会话，避免 RLS 将请求判为 anon
    if (['admin', 'home', 'resource_admin', 'doctor'].includes(role)) {
      const authRes = await ensureSupabaseSessionForStaff();
      if (!authRes.ok) {
        alert(
          `当前已进入系统，但云端写入可能被 RLS 拒绝。\n原因：${authRes.message || '未建立 Supabase 会话'}`
        );
      }
    }
    
    if (role === 'admin') {
        setActiveTab('admin');
    } else if (role === 'doctor') {
        if (doctorInfo) setCurrentDoctor(doctorInfo);
        setActiveTab('my_patients'); 
    }
  };

  const handleUserLogin = async () => {
      const phone = userLoginPhone.trim();
      const password = userLoginPassword;
      if (!phone || !password) {
          alert('请输入手机号与密码');
          return;
      }
      const result = await loginUserDualPath(phone, password);
      if (result.success) {
          setUserCheckupId(result.archive?.checkup_id || '');
          setCurrentUserRole('user');
          setIsAuthenticated(true);
          setUserLoginPassword('');
      } else {
          if (result.reason === 'archive_not_found') {
              alert('账号未注册或手机号未匹配，请先注册；若已注册仍无法查看档案，请联系健康管家完成建档。');
          } else if (result.reason === 'invalid_password') {
              alert('密码错误。若您已修改密码，请输入新密码；若忘记密码请联系健康管家协助重置。');
          } else if (result.reason === 'permission_denied') {
              alert('系统权限配置异常（RLS 拦截），请联系管理员检查 Supabase 策略。');
          } else if (result.reason === 'auth_failed') {
              alert(result.message);
          } else if (result.reason === 'auth_archive_missing') {
              alert('登录成功，但您尚未完成建档。可先浏览资源，查看档案和随访前请联系健康管家建档。');
          } else {
              alert(`登录失败：${result.message || '查询异常，请稍后重试。'}`);
          }
      }
  };

  const handleUserRegister = async () => {
      const phone = userRegisterPhone.trim();
      const pwd = userRegisterPassword;
      const pwd2 = userRegisterPassword2;
      if (!phone || !pwd || !pwd2) {
          alert('请完整填写手机号和两次密码');
          return;
      }
      if (pwd.length < 6) {
          alert('密码至少 6 位');
          return;
      }
      if (pwd !== pwd2) {
          alert('两次密码不一致');
          return;
      }
      const res = await signUpWithPhonePassword(phone, pwd);
      if (!res.success) {
          alert(`注册失败：${res.message}`);
          return;
      }
      alert(res.message || '注册成功');
      setUserLoginPhone(phone);
      setUserLoginPassword(pwd);
      setShowUserRegister(false);
      setUserRegisterPassword('');
      setUserRegisterPassword2('');
  };

  const openLoginFor = (type: 'admin' | 'resource' | 'doctor') => {
      if (type === 'admin') {
          setLoginRoleContext({ title: '管理控制台登录', color: 'slate', allowedRoles: ['admin', 'home'] });
      } else if (type === 'resource') {
          setLoginRoleContext({ title: '资源运营台登录', color: 'teal', allowedRoles: ['resource_admin'] });
      } else if (type === 'doctor') {
          setLoginRoleContext({ title: '医生工作站登录', color: 'blue', allowedRoles: ['doctor'] });
      }
      setShowLoginModal(true);
  };

  useEffect(() => {
      if (isAuthenticated || showLoginModal) return;
      if (portalMode === 'admin') openLoginFor('admin');
      if (portalMode === 'ops') openLoginFor('resource');
      if (portalMode === 'doctor') openLoginFor('doctor');
  }, [portalMode, isAuthenticated, showLoginModal]);

  const handleSelectPatient = (archive: HealthArchive, mode: 'view' | 'edit' | 'followup' | 'assessment' = 'view') => {
      setHealthRecord(archive.health_record);
      setAssessment(archive.assessment_data);
      setFollowUps(archive.follow_ups || []);
      setSchedule(archive.follow_up_schedule || []);
      setRiskAnalysis(archive.risk_analysis);
      
      if (mode === 'followup') setActiveTab('followup');
      else if (mode === 'assessment') setActiveTab('assessment');
      else if (mode === 'edit') setActiveTab('survey'); 
      else setActiveTab('dashboard');
  };

  const handleHealthSurveySubmit = async (data: HealthRecord) => {
      setIsLoading(true);
      try {
          const newAssessment = await generateHealthAssessment(data);
          const newSchedule = generateFollowUpSchedule(newAssessment);
          const portraits = generateSystemPortraits(data);
          const models = evaluateRiskModels(data);
          const analysis = { portraits, models };
          const res = await saveArchive(data, newAssessment, newSchedule, followUps, analysis, { completeProfileOnSave: true });
          
          if (res.success) {
              setHealthRecord(data);
              setAssessment(newAssessment);
              setSchedule(newSchedule);
              setRiskAnalysis(analysis);
              alert("档案保存成功！已生成最新风险评估。");
              refreshArchives();
              setActiveTab('assessment');
          } else {
              alert("保存失败: " + res.message);
          }
      } catch (e) {
          console.error(e);
          alert("处理失败，请检查网络或重试");
      } finally {
          setIsLoading(false);
      }
  };

  const handleSaveAssessment = async (newAssessment: HealthAssessment) => {
      if (!healthRecord) return;
      const res = await saveArchive(healthRecord, newAssessment, schedule, followUps, riskAnalysis);
      if (res.success) {
          setAssessment(newAssessment);
          alert("评估报告已更新");
          refreshArchives();
      }
  };

  const handleUpdateCheckupReport = async (file: File) => {
      if (!healthRecord) return;
      setIsLoading(true);
      try {
          let text = await file.text(); 
          const parsed = await parseHealthDataFromText(text);
          const newRecord = {
              ...parsed,
              profile: { ...parsed.profile, checkupId: healthRecord.profile.checkupId, name: healthRecord.profile.name }
          };
          await handleHealthSurveySubmit(newRecord);
      } catch (e) {
          alert("文件解析更新失败");
      } finally {
          setIsLoading(false);
      }
  };

  const handleAddFollowUp = async (
      record: Omit<FollowUpRecord, 'id'>
  ): Promise<{ success: boolean; message?: string }> => {
      if (!healthRecord) {
          return { success: false, message: '未选择健康档案' };
      }
      if (!assessment) {
          return { success: false, message: '缺少综合评估数据，无法保存随访。请先完成建档评估。' };
      }
      const newRecord: FollowUpRecord = { ...record, id: Date.now().toString() };
      const newFollowUps = [...followUps, newRecord];
      const pendingIdx = schedule.findIndex(s => s.status === 'pending');
      let newSchedule = [...schedule];
      if (pendingIdx !== -1) {
          newSchedule[pendingIdx].status = 'completed';
      }
      const nextItem = generateNextScheduleItem(newRecord.date, newRecord.assessment.nextCheckPlan, newRecord.assessment.riskLevel);
      newSchedule.push(nextItem);

      const mergedAssessment = mergeAssessmentFromFollowUpRecord(assessment, newRecord.assessment);
      const nextHealthRecord = mergeHealthRecordFromFollowUp(healthRecord, record);
      const res = await updateArchiveData(healthRecord.profile.checkupId, newFollowUps, newSchedule, {
          assessment: mergedAssessment,
          nextHealthRecord,
          syncSource: 'doctor_followup',
      });
      if (res.success) {
          setHealthRecord(nextHealthRecord);
          setFollowUps(newFollowUps);
          setSchedule(newSchedule);
          setAssessment(mergedAssessment);
          // 云端未写入时勿全量刷新，否则会拉回旧 follow_ups 覆盖当前界面
          if (!res.message) {
              refreshArchives();
          }
      }
      return res;
  };

  const handleManualDataUpdate = async (record: FollowUpRecord | null, newSchedule: ScheduledFollowUp[]) => {
      if (!healthRecord) return;
      let newFollowUps = followUps;
      if (record) {
          const idx = followUps.findIndex(f => f.id === record.id);
          if (idx !== -1) {
              newFollowUps = [...followUps];
              newFollowUps[idx] = record;
          }
      }
      const res = await updateArchiveData(healthRecord.profile.checkupId, newFollowUps, newSchedule);
      if (res.success) {
          setFollowUps(newFollowUps);
          setSchedule(newSchedule);
          refreshArchives();
      }
  };

  const handleSurveySubmit = async (qData: QuestionnaireData, checkupId: string, profile: {gender: string, dept: string}) => {
      setIsLoading(true);
      try {
          let baseRecord: HealthRecord;
          let previousFollowUps: FollowUpRecord[] = [];
          if (healthRecord && healthRecord.profile.checkupId === checkupId) {
              baseRecord = healthRecord;
              previousFollowUps = followUps;
          } else {
              const archive = await findArchiveByCheckupId(checkupId);
              if (archive) {
                  baseRecord = archive.health_record;
                  previousFollowUps = archive.follow_ups;
              } else {
                  baseRecord = {
                      profile: { checkupId, name: '待完善', gender: profile.gender, department: profile.dept, age: 0 },
                      checkup: { basics: {}, labBasic: {}, imagingBasic: { ultrasound: {} }, optional: {}, abnormalities: [] } as any,
                      questionnaire: {} as any
                  };
              }
          }
          const recordToSave: HealthRecord = {
              ...baseRecord,
              questionnaire: qData,
              profile: {
                  ...baseRecord.profile,
                  gender: profile.gender || baseRecord.profile.gender || '',
                  department: profile.dept || baseRecord.profile.department || ''
              }
          };
          const newAssessment = await generateHealthAssessment(recordToSave);
          const portraits = generateSystemPortraits(recordToSave);
          const models = evaluateRiskModels(recordToSave);
          const newAnalysis = { portraits, models };
          const newSchedule = generateFollowUpSchedule(newAssessment);
          const res = await saveArchive(recordToSave, newAssessment, newSchedule, previousFollowUps, newAnalysis, { completeProfileOnSave: true });
          if (res.success) {
              setHealthRecord(recordToSave);
              setAssessment(newAssessment);
              setSchedule(newSchedule);
              setRiskAnalysis(newAnalysis);
              setFollowUps(previousFollowUps);
              alert("问卷已提交！系统已结合您的体检数据重新生成风险评估与健康方案。");
              refreshArchives();
              if (isAuthenticated) setActiveTab('assessment');
          } else {
              alert("保存失败: " + res.message);
          }
      } catch (e) {
          console.error(e);
          alert("提交失败，请重试");
      } finally {
          setIsLoading(false);
      }
  };

  const handleSelectArchiveWithoutNavigation = (archive: HealthArchive) => {
      setHealthRecord(archive.health_record);
      setAssessment(archive.assessment_data);
      setFollowUps(archive.follow_ups || []);
      setSchedule(archive.follow_up_schedule || []);
      setRiskAnalysis(archive.risk_analysis);
  };

  const handleSaveElderlyAssessment = async (data: ElderlyAssessmentData, result: ElderlyAssessmentResult) => {
      if (!healthRecord || !assessment) {
          alert("请先选择一个已建档用户");
          return;
      }
      setIsSavingElderly(true);
      try {
          const mergedRecord: HealthRecord = { ...healthRecord, elderlyAssessment: data };
          const mergedAssessment = mergeElderlyResultToAssessment(assessment, result);
          const res = await saveArchive(mergedRecord, mergedAssessment, schedule, followUps, riskAnalysis);
          if (res.success) {
              setHealthRecord(mergedRecord);
              setAssessment(mergedAssessment);
              alert("老年专项评估已保存");
              await refreshArchives();
          } else {
              alert("保存失败: " + res.message);
          }
      } finally {
          setIsSavingElderly(false);
      }
  };

  if (portalMode === 'user') {
      return <UserApp />;
  }

  if (currentUserRole === 'home') {
      return <HomeAdmin onLogout={() => { setIsAuthenticated(false); setCurrentUserRole(null); }} />;
  }

  if (currentUserRole === 'resource_admin') {
      return <ResourceAdmin onLogout={() => { setIsAuthenticated(false); setCurrentUserRole(null); }} />;
  }

  if (currentUserRole === 'user') {
      return <UserApp initialCheckupId={userCheckupId} onLogout={() => { setCurrentUserRole(null); setUserCheckupId(''); }} />;
  }

  if (!isAuthenticated && activeTab === 'dashboard') {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 animate-fadeIn">
            <div className="text-center mb-10">
                <div className="w-24 h-24 bg-teal-600 rounded-3xl flex items-center justify-center text-5xl text-white font-bold mx-auto shadow-2xl mb-4 transform hover:scale-105 transition-transform">Z</div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">郑州大学医院</h1>
                <p className="text-slate-500 font-medium mt-1">智慧健康管理中心</p>
            </div>
            <div className={`grid grid-cols-1 ${portalMode === 'all' ? 'md:grid-cols-2' : ''} gap-6 w-full max-w-4xl`}>
                {canShowAdminEntry && (
                <button onClick={() => openLoginFor('admin')} className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl hover:border-slate-300 transition-all text-left group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-slate-100 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                    <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-2xl mb-4 text-white relative z-10">⚡</div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">管理控制台</h3>
                    <p className="text-xs text-slate-500">Admin Console</p>
                    <p className="text-sm text-slate-600 mt-3 opacity-80">系统配置、档案管理与全局分析</p>
                </button>
                )}
                {canShowOpsEntry && (
                <button onClick={() => openLoginFor('resource')} className="bg-white p-6 rounded-2xl shadow-lg border border-teal-100 hover:shadow-xl hover:border-teal-300 transition-all text-left group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                    <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center text-2xl mb-4 text-white relative z-10">📦</div>
                    <h3 className="text-lg font-bold text-teal-900 mb-1">健康资源管理台</h3>
                    <p className="text-xs text-teal-600">Resource Operations</p>
                    <p className="text-sm text-slate-600 mt-3 opacity-80">膳食、运动、医疗资源与活动发布</p>
                </button>
                )}
                {canShowDoctorEntry && (
                <button onClick={() => openLoginFor('doctor')} className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 hover:shadow-xl hover:border-blue-300 transition-all text-left group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-2xl mb-4 text-white relative z-10">👨‍⚕️</div>
                    <h3 className="text-lg font-bold text-blue-900 mb-1">签约医生入口</h3>
                    <p className="text-xs text-blue-600">Doctor Workstation</p>
                    <p className="text-sm text-slate-600 mt-3 opacity-80">我的签约用户、随访干预与审核</p>
                </button>
                )}
                {canShowUserEntry && (
                showUserEntry ? (
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-green-200 text-left relative overflow-hidden flex flex-col justify-center animate-flipIn">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-green-900">职工健康登录</h3>
                            <button onClick={() => setShowUserEntry(false)} className="text-slate-400 hover:text-slate-600 text-sm">取消</button>
                        </div>
                        <label className="block text-xs font-bold text-green-900 mb-1">预留手机号</label>
                        <input autoFocus type="tel" autoComplete="username" placeholder="预留手机号" className="w-full border border-green-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none mb-2 bg-green-50/50" value={userLoginPhone} onChange={(e) => setUserLoginPhone(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleUserLogin(); }} />
                        <label className="block text-xs font-bold text-green-900 mb-1">密码</label>
                        <input type="password" autoComplete="current-password" placeholder="请输入密码" className="w-full border border-green-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none mb-2 bg-green-50/50" value={userLoginPassword} onChange={(e) => setUserLoginPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleUserLogin(); }} />
                        <p className="text-[11px] text-green-800/80 mb-2">未建档用户也可先注册并登录浏览医疗资源；档案与随访功能需建档后开放。</p>
                        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3">
                            <p className="text-[11px] font-bold text-green-900 mb-2">健康管家联系方式（由资源运营台维护）</p>
                            {healthManagerContacts.length === 0 ? (
                                <p className="text-[11px] text-green-800/80">暂未维护健康管家联系方式，请联系健康管理中心。</p>
                            ) : (
                                <div className="space-y-2">
                                    {healthManagerContacts.slice(0, 2).map((m) => (
                                        <div key={m.id} className="rounded-md border border-green-100 bg-white px-2 py-2">
                                            <div className="text-[11px] font-bold text-slate-800">{m.title}</div>
                                            <div className="text-[11px] text-slate-700">电话：{m.details?.phone || m.details?.mobile || '未维护'}</div>
                                            {m.details?.wechat_qr &&
                                                (/^https?:\/\//i.test(String(m.details.wechat_qr)) ||
                                                    String(m.details.wechat_qr).startsWith('data:image')) && (
                                                <div className="mt-1 flex justify-end">
                                                    <button
                                                        type="button"
                                                        className="rounded border border-slate-200 bg-white p-1"
                                                        onClick={() => setPreviewQr(String(m.details?.wechat_qr))}
                                                        title="点击放大二维码"
                                                    >
                                                        <img src={String(m.details.wechat_qr)} alt="微信二维码" className="h-16 w-16 rounded object-cover" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button type="button" onClick={() => handleUserLogin()} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg text-sm hover:bg-green-700 mb-2">登录</button>
                        <button
                            type="button"
                            onClick={() => setShowUserRegister((v) => !v)}
                            className="w-full bg-white border border-green-300 text-green-700 font-bold py-2.5 rounded-lg text-sm hover:bg-green-50 mb-2"
                        >
                            {showUserRegister ? '收起注册' : '没有账号？先注册'}
                        </button>
                        {showUserRegister && (
                            <div className="mb-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                                <p className="text-xs font-bold text-blue-900 mb-2">用户注册（手机号 + 密码）</p>
                                <input type="tel" placeholder="手机号（登录名）" className="w-full border border-blue-200 rounded-lg p-2.5 text-sm outline-none mb-2 bg-white" value={userRegisterPhone} onChange={(e) => setUserRegisterPhone(e.target.value)} />
                                <input type="password" placeholder="密码（至少6位）" className="w-full border border-blue-200 rounded-lg p-2.5 text-sm outline-none mb-2 bg-white" value={userRegisterPassword} onChange={(e) => setUserRegisterPassword(e.target.value)} />
                                <input type="password" placeholder="确认密码" className="w-full border border-blue-200 rounded-lg p-2.5 text-sm outline-none mb-2 bg-white" value={userRegisterPassword2} onChange={(e) => setUserRegisterPassword2(e.target.value)} />
                                <button type="button" onClick={handleUserRegister} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-blue-700">立即注册</button>
                            </div>
                        )}
                        <button className="text-xs text-green-700 font-bold self-start hover:underline" onClick={() => setActiveTab('external_survey')}>📝 还没有档案？填写健康问卷</button>
                    </div>
                ) : (
                    <button onClick={() => setShowUserEntry(true)} className="bg-white p-6 rounded-2xl shadow-lg border border-green-100 hover:shadow-xl hover:border-green-300 transition-all text-left group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                        <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center text-2xl mb-4 text-white relative z-10">📱</div>
                        <h3 className="text-lg font-bold text-green-900 mb-1">用户健康端</h3>
                        <p className="text-xs text-green-600">User Health Portal</p>
                        <p className="text-sm text-slate-600 mt-3 opacity-80">查看个人档案、健康计划与服务</p>
                    </button>
                )
                )}
            </div>
            <div className="mt-12 text-xs text-slate-400 flex gap-4">
                <span className="cursor-pointer hover:text-teal-600" onClick={() => setActiveTab('external_survey')}>健康问卷填报</span>
                <span>|</span>
                <span>© 2024 郑州大学医院</span>
                <span>|</span>
                <span>联系支持: 0371-67739261</span>
            </div>
            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onLoginSuccess={handleLoginSuccess} roleContext={loginRoleContext} />
            {previewQr && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
                    onClick={() => setPreviewQr(null)}
                >
                    <div className="rounded-xl bg-white p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <img src={previewQr} alt="微信二维码预览" className="max-h-[80vh] max-w-[80vw] rounded" />
                    </div>
                </div>
            )}
        </div>
      );
  }

  return (
    <div className="h-screen flex flex-col">
        <Layout 
            activeTab={activeTab} 
            onTabChange={setActiveTab} 
            isAuthenticated={isAuthenticated}
            currentUserRole={currentUserRole}
            onLoginClick={() => setShowLoginModal(true)} 
            onLogoutClick={() => { setIsAuthenticated(false); setCurrentUserRole(null); setCurrentDoctor(null); setDoctorMessageUnread(0); setActiveTab('dashboard'); setShowUserEntry(false); setArchives([]); }}
            navBadges={currentUserRole === 'doctor' ? { doctor_messages: doctorMessageUnread } : undefined}
        >
            {activeTab === 'dashboard' && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-60">
                    <div className="text-8xl">🏥</div>
                    <h2 className="text-3xl font-bold text-slate-700">欢迎使用健康管理系统</h2>
                    <p className="text-lg text-slate-500">请从左侧菜单选择功能。</p>
                </div>
            )}
            {activeTab === 'survey' && <HealthSurvey onSubmit={handleHealthSurveySubmit} initialData={healthRecord} isLoading={isLoading} />}
            {activeTab === 'external_survey' && <NativeSurveyForm onSubmit={handleSurveySubmit} isLoading={isLoading} initialCheckupId={healthRecord?.profile.checkupId} />}
            {activeTab === 'assessment' && assessment && healthRecord && <AssessmentReport assessment={assessment} patientName={healthRecord.profile.name} profile={healthRecord.profile} healthRecord={healthRecord} riskAnalysis={riskAnalysis} onSave={handleSaveAssessment} onUpdateReport={handleUpdateCheckupReport} onUpdateRiskAnalysis={refreshArchives} onSupplementQuestionnaire={() => setActiveTab('external_survey')} />}
            {activeTab === 'elderly_assessment' && (
                <ElderlyAssessmentModule
                    archives={archives}
                    currentArchive={healthRecord ? archives.find(a => a.checkup_id === healthRecord.profile.checkupId) || null : null}
                    onSelectArchive={handleSelectArchiveWithoutNavigation}
                    onSave={handleSaveElderlyAssessment}
                    isSaving={isSavingElderly}
                />
            )}
            
            {/* TAB REPLACEMENT LOGIC: 危急值随访管理 */}
            {activeTab === 'risk_portrait' && (
                <CriticalFollowUpManager 
                    archives={archives} 
                    onRefresh={refreshArchives} 
                />
            )}
            
            {activeTab === 'followup' && <FollowUpDashboard records={followUps} assessment={assessment} schedule={schedule} onAddRecord={handleAddFollowUp} onUpdateData={handleManualDataUpdate} allArchives={archives} onPatientChange={(arch) => handleSelectPatient(arch, 'followup')} currentPatientId={healthRecord?.profile.checkupId} isAuthenticated={isAuthenticated} healthRecord={healthRecord} onRefresh={refreshArchives} />}
            {activeTab === 'heatmap' && <HospitalHeatmap archives={archives} onRefresh={refreshArchives} onSelectPatient={(a) => handleSelectPatient(a, 'assessment')} />}
            {activeTab === 'admin' && currentUserRole === 'admin' && <AdminConsole onSelectPatient={handleSelectPatient} onDataUpdate={refreshArchives} isAuthenticated={isAuthenticated} onTabChange={setActiveTab} />}
            {activeTab === 'doctor_messages' && currentUserRole === 'doctor' && currentDoctor && (
                <DoctorMessageCenter
                    doctorId={currentDoctor.id}
                    doctorName={currentDoctor.title}
                    onUnreadTotalChange={setDoctorMessageUnread}
                />
            )}
            {activeTab === 'my_patients' && currentUserRole === 'doctor' && currentDoctor && <DoctorPatients doctorId={currentDoctor.id} doctorName={currentDoctor.title} onSelectPatient={handleSelectPatient} />}
        </Layout>
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onLoginSuccess={handleLoginSuccess} roleContext={loginRoleContext} />
    </div>
  );
};
