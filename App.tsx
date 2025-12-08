
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { HealthSurvey } from './components/HealthSurvey';
import { AssessmentReport } from './components/AssessmentReport';
import { FollowUpDashboard } from './components/FollowUpDashboard';
import { HospitalHeatmap } from './components/HospitalHeatmap';
import { AdminConsole } from './components/AdminConsole';
import { LoginModal } from './components/LoginModal';
import { NativeSurveyForm } from './components/NativeSurveyForm';
import { UserApp } from './components/UserApp';
import { HomeAdmin } from './components/HomeAdmin';
import { ResourceAdmin } from './components/ResourceAdmin'; 
import { SystemRiskPortrait } from './components/SystemRiskPortrait';
import { DoctorPatients } from './components/DoctorPatients';

import { HealthRecord, HealthAssessment, FollowUpRecord, ScheduledFollowUp, RiskAnalysisData, QuestionnaireData } from './types';
import { generateHealthAssessment, generateFollowUpSchedule, parseHealthDataFromText } from './services/geminiService';
import { HealthArchive, updateArchiveData, generateNextScheduleItem, saveArchive, fetchArchives, findArchiveByCheckupId, updateRiskAnalysis, findArchiveByPhone, updateHealthRecordOnly } from './services/dataService';
import { generateSystemPortraits, evaluateRiskModels } from './services/riskModelService';
import { ContentItem } from './services/contentService';

export const App: React.FC = () => {
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

  useEffect(() => {
    // Initial fetch if admin or doctor
    if (isAuthenticated && (currentUserRole === 'admin' || currentUserRole === 'doctor')) refreshArchives();
  }, [isAuthenticated, currentUserRole]);

  const refreshArchives = async () => {
    const data = await fetchArchives();
    setArchives(data);
  };

  const handleLoginSuccess = (role: 'admin' | 'home' | 'resource_admin' | 'doctor', doctorInfo?: ContentItem) => {
    setIsAuthenticated(true);
    setCurrentUserRole(role);
    setShowLoginModal(false);
    
    if (role === 'admin') {
        setActiveTab('admin');
        refreshArchives();
    } else if (role === 'doctor') {
        if (doctorInfo) setCurrentDoctor(doctorInfo);
        setActiveTab('my_patients'); 
        refreshArchives();
    }
  };

  const handleUserLogin = async (input: string) => {
      // Input could be phone or checkupId
      // Try finding by checkupId first
      let archive = await findArchiveByCheckupId(input);
      if (!archive) {
          // Try finding by phone
          archive = await findArchiveByPhone(input);
      }

      if (archive) {
          setUserCheckupId(archive.checkup_id);
          setCurrentUserRole('user');
          setIsAuthenticated(true); // User considered authenticated for their scope
      } else {
          alert('未找到档案，请核对体检编号或预留手机号');
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

  // --- Core Business Logic Handlers ---

  const handleSelectPatient = (archive: HealthArchive, mode: 'view' | 'edit' | 'followup' | 'assessment' = 'view') => {
      setHealthRecord(archive.health_record);
      setAssessment(archive.assessment_data);
      setFollowUps(archive.follow_ups || []);
      setSchedule(archive.follow_up_schedule || []);
      setRiskAnalysis(archive.risk_analysis);
      
      if (mode === 'followup') setActiveTab('followup');
      else if (mode === 'assessment') setActiveTab('assessment');
      else if (mode === 'edit') {
          setActiveTab('survey'); 
      }
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

          // Merge existing followups if updating existing record
          const res = await saveArchive(data, newAssessment, newSchedule, followUps, analysis);
          
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
          // Parse file content
          let text = await file.text(); // Simple text fallback
          
          // Re-parse
          const parsed = await parseHealthDataFromText(text);
          
          // Merge with existing profile to keep ID/Name stable if parser misses them
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
      
      // Update schedule: mark pending as completed
      const pendingIdx = schedule.findIndex(s => s.status === 'pending');
      let newSchedule = [...schedule];
      if (pendingIdx !== -1) {
          newSchedule[pendingIdx].status = 'completed';
      }
      // Add next schedule
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

  // Handler for NativeSurveyForm
  const handleSurveySubmit = async (qData: QuestionnaireData, checkupId: string, profile: {gender: string, dept: string}) => {
      setIsLoading(true);
      try {
          // 1. Check if archive exists
          let archive = await findArchiveByCheckupId(checkupId);
          let recordToSave: HealthRecord;
          let assessmentToSave: HealthAssessment;
          let scheduleToSave: ScheduledFollowUp[] = [];
          let followUpsToSave: FollowUpRecord[] = [];
          let analysisToSave: RiskAnalysisData | undefined = undefined;

          if (archive) {
              // Update existing
              recordToSave = {
                  ...archive.health_record,
                  questionnaire: qData,
                  profile: { ...archive.health_record.profile, gender: profile.gender || archive.gender || '', department: profile.dept || archive.department }
              };
              assessmentToSave = archive.assessment_data;
              scheduleToSave = archive.follow_up_schedule;
              followUpsToSave = archive.follow_ups;
              analysisToSave = archive.risk_analysis;
          } else {
              // New partial record
              recordToSave = {
                  profile: { checkupId, name: '待完善', gender: profile.gender, department: profile.dept, age: 0 },
                  checkup: { basics: {}, labBasic: {}, imagingBasic: { ultrasound: {} }, optional: {}, abnormalities: [] } as any,
                  questionnaire: qData
              };
              // Preliminary assessment
              assessmentToSave = {
                  riskLevel: 'GREEN', summary: '仅包含问卷数据，请补充体检数据以获得完整评估。', 
                  risks: { red: [], yellow: [], green: [] }, 
                  managementPlan: { dietary: [], exercise: [], medication: [], monitoring: [] }, 
                  followUpPlan: { frequency: '待定', nextCheckItems: [] }
              } as any;
          }

          const newAssessment = await generateHealthAssessment(recordToSave);
          const portraits = generateSystemPortraits(recordToSave);
          const models = evaluateRiskModels(recordToSave);
          
          assessmentToSave = newAssessment;
          analysisToSave = { portraits, models };
          
          if (scheduleToSave.length === 0) {
              scheduleToSave = generateFollowUpSchedule(newAssessment);
          }

          const res = await saveArchive(recordToSave, assessmentToSave, scheduleToSave, followUpsToSave, analysisToSave);
          if (res.success) {
              alert("问卷已提交并存档！");
              refreshArchives();
              if (isAuthenticated) {
                  const newArch = await findArchiveByCheckupId(checkupId);
                  if (newArch) handleSelectPatient(newArch);
              }
          } else {
              alert("保存失败: " + res.message);
          }

      } catch (e) {
          console.error(e);
          alert("提交失败");
      } finally {
          setIsLoading(false);
      }
  };

  // --- Render ---

  // 1. Home Admin View (System Level)
  if (currentUserRole === 'home') {
      return <HomeAdmin onLogout={() => { setIsAuthenticated(false); setCurrentUserRole(null); }} />;
  }

  // 2. Resource Admin View (Content/Ops Level)
  if (currentUserRole === 'resource_admin') {
      return <ResourceAdmin onLogout={() => { setIsAuthenticated(false); setCurrentUserRole(null); }} />;
  }

  // 3. User Portal View
  if (currentUserRole === 'user') {
      return <UserApp checkupId={userCheckupId} onLogout={() => { setCurrentUserRole(null); setUserCheckupId(''); }} />;
  }

  // 4. Main Dashboard / Admin / Doctor View Logic
  // If not authenticated, show the 4-entry Landing Page
  if (!isAuthenticated && activeTab === 'dashboard') {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 animate-fadeIn">
            {/* Logo/Header */}
            <div className="text-center mb-10">
                <div className="w-24 h-24 bg-teal-600 rounded-3xl flex items-center justify-center text-5xl text-white font-bold mx-auto shadow-2xl mb-4 transform hover:scale-105 transition-transform">
                    Z
                </div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">郑州大学医院</h1>
                <p className="text-slate-500 font-medium mt-1">智慧健康管理中心</p>
            </div>

            {/* 4 Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                
                {/* 1. Admin */}
                <button 
                    onClick={() => openLoginFor('admin')}
                    className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl hover:border-slate-300 transition-all text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-slate-100 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                    <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-2xl mb-4 text-white relative z-10">
                        ⚡
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">管理控制台</h3>
                    <p className="text-xs text-slate-500">Admin Console</p>
                    <p className="text-sm text-slate-600 mt-3 opacity-80">系统配置、档案管理与全局分析</p>
                </button>

                {/* 2. Resource */}
                <button 
                    onClick={() => openLoginFor('resource')}
                    className="bg-white p-6 rounded-2xl shadow-lg border border-teal-100 hover:shadow-xl hover:border-teal-300 transition-all text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                    <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center text-2xl mb-4 text-white relative z-10">
                        📦
                    </div>
                    <h3 className="text-lg font-bold text-teal-900 mb-1">健康资源管理台</h3>
                    <p className="text-xs text-teal-600">Resource Operations</p>
                    <p className="text-sm text-slate-600 mt-3 opacity-80">膳食、运动、医疗资源与活动发布</p>
                </button>

                {/* 3. Doctor */}
                <button 
                    onClick={() => openLoginFor('doctor')}
                    className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 hover:shadow-xl hover:border-blue-300 transition-all text-left group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-2xl mb-4 text-white relative z-10">
                        👨‍⚕️
                    </div>
                    <h3 className="text-lg font-bold text-blue-900 mb-1">签约医生入口</h3>
                    <p className="text-xs text-blue-600">Doctor Workstation</p>
                    <p className="text-sm text-slate-600 mt-3 opacity-80">我的签约用户、随访干预与审核</p>
                </button>

                {/* 4. User */}
                {showUserEntry ? (
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-green-200 text-left relative overflow-hidden flex flex-col justify-center animate-flipIn">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-green-900">职工健康登录</h3>
                            <button onClick={() => setShowUserEntry(false)} className="text-slate-400 hover:text-slate-600 text-sm">取消</button>
                        </div>
                        <input 
                            autoFocus
                            type="text" 
                            placeholder="输入体检编号或手机号"
                            className="w-full border border-green-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none mb-3 bg-green-50/50"
                            onKeyDown={(e) => {
                                if(e.key === 'Enter') handleUserLogin(e.currentTarget.value);
                            }}
                        />
                        <button className="text-xs text-green-700 font-bold self-start hover:underline" onClick={() => setActiveTab('external_survey')}>
                            📝 还没有档案？填写健康问卷
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={() => setShowUserEntry(true)}
                        className="bg-white p-6 rounded-2xl shadow-lg border border-green-100 hover:shadow-xl hover:border-green-300 transition-all text-left group relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                        <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center text-2xl mb-4 text-white relative z-10">
                            📱
                        </div>
                        <h3 className="text-lg font-bold text-green-900 mb-1">用户健康端</h3>
                        <p className="text-xs text-green-600">User Health Portal</p>
                        <p className="text-sm text-slate-600 mt-3 opacity-80">查看个人档案、健康计划与服务</p>
                    </button>
                )}
            </div>

            {/* Footer / Links */}
            <div className="mt-12 text-xs text-slate-400 flex gap-4">
                <span className="cursor-pointer hover:text-teal-600" onClick={() => setActiveTab('external_survey')}>健康问卷填报</span>
                <span>|</span>
                <span>© 2024 郑州大学医院</span>
                <span>|</span>
                <span>联系支持: 0371-67739261</span>
            </div>

            {/* Global Login Modal */}
            <LoginModal 
                isOpen={showLoginModal} 
                onClose={() => setShowLoginModal(false)} 
                onLoginSuccess={handleLoginSuccess} 
                roleContext={loginRoleContext}
            />
        </div>
      );
  }

  // 5. Authenticated Views (Layout for Admin/Doctor)
  return (
    <div className="h-screen flex flex-col">
        {/* Authenticated or Survey Mode */}
        <Layout 
            activeTab={activeTab} 
            onTabChange={setActiveTab} 
            isAuthenticated={isAuthenticated}
            currentUserRole={currentUserRole}
            onLoginClick={() => setShowLoginModal(true)} // Should ideally not be reachable if using new flow properly, but kept as fallback
            onLogoutClick={() => { 
                setIsAuthenticated(false); 
                setCurrentUserRole(null); 
                setCurrentDoctor(null); 
                setActiveTab('dashboard'); 
                setShowUserEntry(false);
            }}
        >
            {activeTab === 'dashboard' && (
                // Internal Dashboard (Only if somehow reached while auth'd but no specific tab)
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-60">
                    <div className="text-8xl">🏥</div>
                    <h2 className="text-3xl font-bold text-slate-700">欢迎使用健康管理系统</h2>
                    <p className="text-lg text-slate-500">请从左侧菜单选择功能。</p>
                </div>
            )}

            {activeTab === 'survey' && (
                <HealthSurvey 
                    onSubmit={handleHealthSurveySubmit} 
                    initialData={healthRecord} 
                    isLoading={isLoading} 
                />
            )}

            {activeTab === 'external_survey' && (
                <NativeSurveyForm 
                    onSubmit={handleSurveySubmit} 
                    isLoading={isLoading}
                    initialCheckupId={healthRecord?.profile.checkupId} 
                />
            )}

            {activeTab === 'assessment' && assessment && healthRecord && (
                <AssessmentReport 
                    assessment={assessment} patientName={healthRecord.profile.name} profile={healthRecord.profile}
                    healthRecord={healthRecord} riskAnalysis={riskAnalysis}
                    onSave={handleSaveAssessment} onUpdateReport={handleUpdateCheckupReport} 
                    onUpdateRiskAnalysis={refreshArchives} onSupplementQuestionnaire={() => setActiveTab('external_survey')}
                />
            )}

            {activeTab === 'risk_portrait' && healthRecord && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 min-h-full">
                    <div className="flex items-center gap-4 mb-6 border-b pb-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-2xl">🧘</div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">全维健康画像与模型评估</h2>
                            <p className="text-slate-500 text-sm">基于 {healthRecord.profile.name} ({healthRecord.profile.checkupId}) 的多维度数据分析</p>
                        </div>
                    </div>
                    <SystemRiskPortrait 
                        record={healthRecord} 
                        existingAnalysis={riskAnalysis} 
                        onUpdate={refreshArchives} 
                    />
                </div>
            )}
            
            {activeTab === 'followup' && (
                <FollowUpDashboard 
                    records={followUps} assessment={assessment} schedule={schedule} onAddRecord={handleAddFollowUp}
                    onUpdateData={handleManualDataUpdate} allArchives={archives} onPatientChange={(arch) => handleSelectPatient(arch, 'followup')}
                    currentPatientId={healthRecord?.profile.checkupId} isAuthenticated={isAuthenticated}
                    healthRecord={healthRecord} onRefresh={refreshArchives}
                />
            )}

            {activeTab === 'heatmap' && (
                <HospitalHeatmap archives={archives} onRefresh={refreshArchives} onSelectPatient={(a) => handleSelectPatient(a, 'assessment')} />
            )}

            {activeTab === 'admin' && currentUserRole === 'admin' && (
                <AdminConsole 
                    onSelectPatient={handleSelectPatient} 
                    onDataUpdate={refreshArchives} 
                    isAuthenticated={isAuthenticated} 
                    onTabChange={setActiveTab}
                />
            )}

            {activeTab === 'my_patients' && currentUserRole === 'doctor' && currentDoctor && (
                <DoctorPatients 
                    doctorId={currentDoctor.id}
                    onSelectPatient={handleSelectPatient}
                />
            )}
        </Layout>

        {/* Global Login Modal reused if needed */}
        <LoginModal 
            isOpen={showLoginModal} 
            onClose={() => setShowLoginModal(false)} 
            onLoginSuccess={handleLoginSuccess} 
            roleContext={loginRoleContext}
        />
    </div>
  );
};
