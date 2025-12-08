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
import { SystemRiskPortrait } from './components/SystemRiskPortrait';

import { HealthRecord, HealthAssessment, FollowUpRecord, ScheduledFollowUp, RiskAnalysisData, QuestionnaireData } from './types';
import { generateHealthAssessment, generateFollowUpSchedule, parseHealthDataFromText } from './services/geminiService';
import { HealthArchive, updateArchiveData, generateNextScheduleItem, saveArchive, fetchArchives, findArchiveByCheckupId, updateRiskAnalysis, findArchiveByPhone, updateHealthRecordOnly } from './services/dataService';
import { generateSystemPortraits, evaluateRiskModels } from './services/riskModelService';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'home' | 'user' | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [userCheckupId, setUserCheckupId] = useState('');

  // Medical Data State
  const [archives, setArchives] = useState<HealthArchive[]>([]);
  const [healthRecord, setHealthRecord] = useState<HealthRecord | null>(null);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [schedule, setSchedule] = useState<ScheduledFollowUp[]>([]);
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysisData | undefined>(undefined);
  
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initial fetch if admin
    if (isAuthenticated) refreshArchives();
  }, [isAuthenticated]);

  const refreshArchives = async () => {
    const data = await fetchArchives();
    setArchives(data);
  };

  const handleLoginSuccess = (role: 'admin' | 'home') => {
    setIsAuthenticated(true);
    setCurrentUserRole(role);
    setShowLoginModal(false);
    if (role === 'admin') {
        setActiveTab('admin');
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
      } else {
          alert('未找到档案，请核对体检编号或预留手机号');
      }
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
          // Logic for edit mode if needed, usually handled in AdminConsole or just setting healthRecord allows HealthSurvey to edit
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
          // Update specific record or add? Assuming update latest if ID matches, or replace list logic?
          // For simplicity, if record is passed, we update it in the list
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
              assessmentToSave = archive.assessment_data; // Keep existing or re-evaluate? Ideally re-evaluate.
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

          // Re-evaluate if we have enough data or just save
          // Let's re-evaluate just in case questionnaire changes risk
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
              // If logged in as admin, switch to view it
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

  // 1. Home Admin View
  if (currentUserRole === 'home') {
      return <HomeAdmin onLogout={() => { setIsAuthenticated(false); setCurrentUserRole(null); }} />;
  }

  // 2. User Portal View
  if (currentUserRole === 'user') {
      return <UserApp checkupId={userCheckupId} onLogout={() => { setCurrentUserRole(null); setUserCheckupId(''); }} />;
  }

  // 3. Main Dashboard / Admin View
  return (
    <div className="h-screen flex flex-col">
        {/* Render Layout only if NOT in special modes like login/portal which are handled above */}
        {/* But we need Layout for standard app usage */}
        
        {/* Guest View: Landing Page with Login & Survey Access */}
        {!isAuthenticated && activeTab === 'dashboard' ? (
            <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center space-y-6">
                    <div className="w-20 h-20 bg-teal-600 rounded-2xl flex items-center justify-center text-4xl text-white font-bold mx-auto shadow-lg">
                        Z
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">郑州大学医院</h1>
                        <p className="text-slate-500">智慧健康管理中心</p>
                    </div>
                    
                    <div className="space-y-3 pt-4">
                        <button 
                            onClick={() => setShowLoginModal(true)}
                            className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 transition-all shadow-md"
                        >
                            管理员登录
                        </button>
                        
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="输入体检编号或手机号查询"
                                className="w-full border border-slate-200 bg-slate-50 py-3 px-4 rounded-xl text-center focus:ring-2 focus:ring-teal-500 outline-none"
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter') handleUserLogin(e.currentTarget.value);
                                }}
                            />
                        </div>

                        <div className="text-xs text-slate-400 pt-4 flex items-center justify-center gap-4">
                            <span onClick={() => setActiveTab('external_survey')} className="cursor-pointer hover:text-teal-600 hover:underline">
                                📝 填写健康问卷
                            </span>
                            <span>|</span>
                            <span>📞 客服: 0371-67739261</span>
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            // Authenticated or Survey Mode
            <Layout 
                activeTab={activeTab} 
                onTabChange={setActiveTab} 
                isAuthenticated={isAuthenticated}
                onLoginClick={() => setShowLoginModal(true)}
                onLogoutClick={() => { setIsAuthenticated(false); setCurrentUserRole(null); setActiveTab('dashboard'); }}
            >
                {activeTab === 'dashboard' && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-60">
                        <div className="text-8xl">🏥</div>
                        <h2 className="text-3xl font-bold text-slate-700">欢迎使用健康管理系统</h2>
                        <p className="text-lg text-slate-500">请从左侧菜单选择功能，或在“管理控制台”中选择一位受检者。</p>
                        {!isAuthenticated && (
                            <button onClick={() => setShowLoginModal(true)} className="bg-teal-600 text-white px-6 py-2 rounded-lg font-bold shadow">
                                登录系统
                            </button>
                        )}
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

                {activeTab === 'admin' && (
                    <AdminConsole 
                        onSelectPatient={handleSelectPatient} 
                        onDataUpdate={refreshArchives} 
                        isAuthenticated={isAuthenticated} 
                        onTabChange={setActiveTab}
                    />
                )}
            </Layout>
        )}

        <LoginModal 
            isOpen={showLoginModal} 
            onClose={() => setShowLoginModal(false)} 
            onLoginSuccess={handleLoginSuccess} 
        />
    </div>
  );
};