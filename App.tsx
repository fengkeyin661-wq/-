
import React, { useState, useEffect, useCallback } from 'react';
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
import { CriticalFollowUpManager } from './components/CriticalFollowUpManager'; // New Import
import { ElderlyAssessmentModule } from './components/ElderlyAssessmentModule';

import { HealthRecord, HealthAssessment, FollowUpRecord, ScheduledFollowUp, RiskAnalysisData, QuestionnaireData, ElderlyAssessmentData } from './types';
import { generateHealthAssessment, generateFollowUpSchedule, parseHealthDataFromText } from './services/geminiService';
import { HealthArchive, updateArchiveData, generateNextScheduleItem, saveArchive, fetchArchives, findArchiveByCheckupId, updateRiskAnalysis, updateHealthRecordOnly } from './services/dataService';
import { signInWithPhonePassword } from './services/authService';
import { generateSystemPortraits, evaluateRiskModels } from './services/riskModelService';
import { ContentItem, fetchInteractions } from './services/contentService';
import { ElderlyAssessmentResult, mergeElderlyResultToAssessment } from './services/elderlyAssessmentService';

type PortalMode = 'all' | 'admin' | 'ops' | 'doctor' | 'user';

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
  
  // Doctor State
  const [currentDoctor, setCurrentDoctor] = useState<ContentItem | null>(null); 

  // Medical Data State
  const [archives, setArchives] = useState<HealthArchive[]>([]);
  const [healthRecord, setHealthRecord] = useState<HealthRecord | null>(null);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [schedule, setSchedule] = useState<ScheduledFollowUp[]>([]);
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysisData | undefined>(undefined);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingElderly, setIsSavingElderly] = useState(false);

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

  const handleLoginSuccess = (role: 'admin' | 'home' | 'resource_admin' | 'doctor', doctorInfo?: ContentItem) => {
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
          alert('请输入预留手机号与密码（默认密码为体检编号）');
          return;
      }
      const auth = await signInWithPhonePassword(phone, password);
      if (!auth.success) {
          if (
              auth.message.toLowerCase().includes('invalid') ||
              auth.message.toLowerCase().includes('credentials')
          ) {
              alert('账号或密码错误，请核对后重试。');
          } else {
              alert(`登录失败：${auth.message}`);
          }
          return;
      }
      const archive = await findArchiveByCheckupId(auth.checkupId);
      if (archive) {
          setUserCheckupId(archive.checkup_id);
          setCurrentUserRole('user');
          setIsAuthenticated(true);
          setUserLoginPassword('');
      } else {
          alert('登录成功但未找到健康档案，请联系健康管家核对建档信息。');
      }
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

  const handleAddFollowUp = async (record: Omit<FollowUpRecord, 'id'>) => {
      if (!healthRecord || !assessment) return;
      const newRecord: FollowUpRecord = { ...record, id: Date.now().toString() };
      const newFollowUps = [...followUps, newRecord];
      const pendingIdx = schedule.findIndex(s => s.status === 'pending');
      let newSchedule = [...schedule];
      if (pendingIdx !== -1) {
          newSchedule[pendingIdx].status = 'completed';
      }
      const nextItem = generateNextScheduleItem(newRecord.date, newRecord.assessment.nextCheckPlan, newRecord.assessment.riskLevel);
      newSchedule.push(nextItem);

      const res = await updateArchiveData(healthRecord.profile.checkupId, newFollowUps, newSchedule);
      if (res.success) {
          setFollowUps(newFollowUps);
          setSchedule(newSchedule);
          refreshArchives();
      }
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
      return <UserApp initialCheckupId={userCheckupId} onLogout={() => { setIsAuthenticated(false); setCurrentUserRole(null); setUserCheckupId(''); }} />;
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
                        <label className="block text-xs font-bold text-green-900 mb-1">密码（默认：体检编号）</label>
                        <input type="password" autoComplete="current-password" placeholder="默认密码为体检编号" className="w-full border border-green-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none mb-2 bg-green-50/50" value={userLoginPassword} onChange={(e) => setUserLoginPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleUserLogin(); }} />
                        <p className="text-[11px] text-green-800/80 mb-2">首次登录请使用预留手机号，密码填写本人体检编号；登录后可在「我的」中修改密码。</p>
                        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">仅已完成健康建档注册用户可登录。未建档请联系健康管家（电话、微信号或在线消息）完成建档后再登录。</p>
                        <button type="button" onClick={() => handleUserLogin()} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg text-sm hover:bg-green-700 mb-2">登录</button>
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
            onLogoutClick={() => { setIsAuthenticated(false); setCurrentUserRole(null); setCurrentDoctor(null); setActiveTab('dashboard'); setShowUserEntry(false); setArchives([]); }}
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
            {activeTab === 'my_patients' && currentUserRole === 'doctor' && currentDoctor && <DoctorPatients doctorId={currentDoctor.id} doctorName={currentDoctor.title} onSelectPatient={handleSelectPatient} />}
        </Layout>
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onLoginSuccess={handleLoginSuccess} roleContext={loginRoleContext} />
    </div>
  );
};
