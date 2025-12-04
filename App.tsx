
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { HealthSurvey } from './components/HealthSurvey';
import { AssessmentReport } from './components/AssessmentReport';
import { FollowUpDashboard } from './components/FollowUpDashboard';
import { AdminConsole } from './components/AdminConsole';
import { LoginModal } from './components/LoginModal';
import { HospitalHeatmap } from './components/HospitalHeatmap';
import { NativeSurveyForm } from './components/NativeSurveyForm'; 
import { UserApp } from './components/UserApp'; 
import { SystemRiskPortrait } from './components/SystemRiskPortrait'; 
import { HomeAdmin } from './components/HomeAdmin'; // New Import

import { HealthRecord, HealthAssessment, FollowUpRecord, ScheduledFollowUp, RiskAnalysisData, QuestionnaireData } from './types'; 
import { generateHealthAssessment, generateFollowUpSchedule, parseHealthDataFromText } from './services/geminiService';
import { HealthArchive, updateArchiveData, generateNextScheduleItem, saveArchive, fetchArchives, findArchiveByCheckupId, updateRiskAnalysis, findArchiveByPhone } from './services/dataService'; 
import { generateSystemPortraits, evaluateRiskModels } from './services/riskModelService';

// @ts-ignore
import * as mammoth from 'mammoth';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

const App: React.FC = () => {
  // App Mode State: 'landing' | 'admin' | 'user' | 'home_admin'
  const [appMode, setAppMode] = useState<'landing' | 'admin' | 'user' | 'home_admin'>('landing');
  
  // User Login State (Updated for Phone Auth)
  const [userCheckupId, setUserCheckupId] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userVerifyCode, setUserVerifyCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [userLoginLoading, setUserLoginLoading] = useState(false);

  // Admin State
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [healthRecord, setHealthRecord] = useState<HealthRecord | null>(null);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [schedule, setSchedule] = useState<ScheduledFollowUp[]>([]);
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysisData | undefined>(undefined); 
  const [isGenerating, setIsGenerating] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [archives, setArchives] = useState<HealthArchive[]>([]);

  // Configure PDF Worker
  useEffect(() => {
    const setupPdfWorker = async () => {
        const workerUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
        // @ts-ignore
        const lib = pdfjsLib.default || pdfjsLib;
        if (!lib.GlobalWorkerOptions) return;

        try {
            const response = await fetch(workerUrl);
            if (!response.ok) throw new Error("Failed");
            const workerScript = await response.text();
            const blob = new Blob([workerScript], { type: "text/javascript" });
            lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
        } catch (error) {
            lib.GlobalWorkerOptions.workerSrc = workerUrl;
        }
    };
    setupPdfWorker();
  }, []);

  const refreshArchives = async () => {
      try {
          const data = await fetchArchives();
          setArchives(data);

          if (healthRecord?.profile?.checkupId) {
              const current = data.find(a => a.checkup_id === healthRecord.profile.checkupId);
              if (current) {
                  setHealthRecord(current.health_record);
                  setAssessment(current.assessment_data);
                  setSchedule(current.follow_up_schedule || []);
                  setFollowUps(current.follow_ups || []);
                  setRiskAnalysis(current.risk_analysis);
              }
          }
      } catch (e) {
          console.error("Failed to refresh archives:", e);
      }
  };

  useEffect(() => {
      if (appMode === 'admin') refreshArchives();
  }, [appMode]);

  // --- Handlers ---

  const handleSendVerifyCode = () => {
      if (!userPhone) return alert("请输入手机号");
      if (!/^1[3-9]\d{9}$/.test(userPhone)) return alert("请输入有效的中国大陆手机号");
      
      // Simulate sending code
      setIsCodeSent(true);
      alert(`验证码已发送至 ${userPhone}：8888 (模拟)`);
  };

  const handleUserLogin = async () => {
      if (!userPhone) return alert("请输入手机号");
      if (!isCodeSent) return alert("请先获取验证码");
      if (!userVerifyCode) return alert("请输入验证码");
      
      if (userVerifyCode !== '8888') {
          return alert("验证码错误");
      }

      setUserLoginLoading(true);
      try {
          const archive = await findArchiveByPhone(userPhone);
          if (archive) {
              setUserCheckupId(archive.checkup_id);
              setAppMode('user');
          } else {
              alert("您尚未开通健康管家服务，请联系客服开通，客服热线：0371-67739261");
          }
      } catch (e) {
          console.error(e);
          alert("登录服务异常，请稍后重试");
      } finally {
          setUserLoginLoading(false);
      }
  };

  const handleAdminLoginSuccess = (role: 'admin' | 'home') => {
      setIsAuthenticated(true);
      if (role === 'home') {
          setAppMode('home_admin');
      } else {
          setAppMode('admin');
          refreshArchives();
      }
  };

  const handleSelectPatient = (archive: HealthArchive, mode: 'view' | 'edit' | 'followup' | 'assessment' = 'view') => {
      setHealthRecord(archive.health_record);
      setAssessment(archive.assessment_data);
      setSchedule(archive.follow_up_schedule || []);
      setFollowUps(archive.follow_ups || []);
      setRiskAnalysis(archive.risk_analysis); 
      
      if (mode === 'edit') setActiveTab('survey');
      else if (mode === 'followup') setActiveTab('followup');
      else setActiveTab('assessment');
  };

  const handleSurveySubmit = async (data: HealthRecord) => {
    setHealthRecord(data);
    setIsGenerating(true);
    try {
      const result = await generateHealthAssessment(data);
      setAssessment(result);
      const newSchedule = generateFollowUpSchedule(result);
      setSchedule(newSchedule);
      const saveResult = await saveArchive(data, result, newSchedule, followUps);
      if (!saveResult.success) throw new Error("保存失败: " + saveResult.message);
      await refreshArchives();
      setActiveTab('assessment');
    } catch (error) {
      alert("处理失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsGenerating(false);
    }
  };

  // ... (Existing extractTextFromFile and handleUpdateCheckupReport remain same)
  // Re-adding omitted large chunks for brevity, assuming they are unchanged unless specified
  const extractTextFromFile = async (file: File): Promise<string> => {
      const fileType = file.name.split('.').pop()?.toLowerCase();
      
      if (fileType === 'txt') return await file.text();
      else if (fileType === 'docx' || fileType === 'doc') {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          return result.value;
      }
      else if (fileType === 'pdf') {
          const arrayBuffer = await file.arrayBuffer();
          // @ts-ignore
          const lib = pdfjsLib.default || pdfjsLib;
          const loadingTask = lib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let fullText = "";
          for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item: any) => item.str).join(' ');
              fullText += `--- Page ${i} ---\n${pageText}\n\n`;
          }
          return fullText;
      }
      else {
          throw new Error("不支持的文件格式 (仅支持 PDF, Word, TXT)");
      }
  };

  const handleUpdateCheckupReport = async (file: File) => {
      if (!healthRecord) return;
      setIsGenerating(true);
      try {
          const rawText = await extractTextFromFile(file);
          if (!rawText || rawText.length < 20) throw new Error("文件内容为空或无法识别");
          const newParsedRecord = await parseHealthDataFromText(rawText);
          const mergedRecord: HealthRecord = {
              ...healthRecord,
              checkup: newParsedRecord.checkup,
              profile: {
                  ...healthRecord.profile,
                  age: newParsedRecord.profile.age || healthRecord.profile.age,
                  checkupDate: newParsedRecord.profile.checkupDate || new Date().toISOString().split('T')[0]
              },
              questionnaire: healthRecord.questionnaire 
          };
          const newAssessment = await generateHealthAssessment(mergedRecord);
          const newSchedule = generateFollowUpSchedule(newAssessment);
          const newPortraits = generateSystemPortraits(mergedRecord);
          const newModels = evaluateRiskModels(mergedRecord);
          const newRiskAnalysis: RiskAnalysisData = { portraits: newPortraits, models: newModels };

          const saveResult = await saveArchive(mergedRecord, newAssessment, newSchedule, followUps, newRiskAnalysis);
          if (!saveResult.success) throw new Error("保存更新失败: " + saveResult.message);

          setHealthRecord(mergedRecord);
          setAssessment(newAssessment);
          setSchedule(newSchedule);
          setRiskAnalysis(newRiskAnalysis);
          await refreshArchives();
          alert("体检报告更新成功！已自动重新生成风险评估方案。");
      } catch (error) {
          console.error(error);
          alert("更新报告失败: " + (error instanceof Error ? error.message : "未知错误"));
      } finally {
          setIsGenerating(false);
      }
  };

  const handleQuestionnaireSupplement = async (qData: QuestionnaireData, checkupId: string, profileInfo: {gender: string, dept: string}) => {
      setIsGenerating(true);
      try {
          const existingArchive = await findArchiveByCheckupId(checkupId);
          if (!existingArchive) {
              alert(`未找到体检编号为 ${checkupId} 的档案。`);
              setIsGenerating(false);
              return;
          }
          const updatedRecord: HealthRecord = {
              ...existingArchive.health_record,
              questionnaire: qData,
              profile: {
                  ...existingArchive.health_record.profile,
                  gender: profileInfo.gender || existingArchive.health_record.profile.gender,
                  department: profileInfo.dept || existingArchive.health_record.profile.department
              }
          };
          const newAssessment = await generateHealthAssessment(updatedRecord);
          const newSchedule = generateFollowUpSchedule(newAssessment);
          const saveResult = await saveArchive(updatedRecord, newAssessment, newSchedule, existingArchive.follow_ups || [], undefined);
          if (!saveResult.success) throw new Error(saveResult.message);
          await refreshArchives();
          const freshArchive = await findArchiveByCheckupId(checkupId);
          if (freshArchive) {
              handleSelectPatient(freshArchive, 'view');
              alert(`问卷已提交！档案 ${checkupId} 已自动补全并完成 AI 重新评估。`);
          }
      } catch (error) {
          console.error(error);
          alert("提交失败: " + (error instanceof Error ? error.message : "未知错误"));
      } finally {
          setIsGenerating(false);
      }
  };

  const handleSaveAssessment = async (updatedAssessment: HealthAssessment) => {
      if (!healthRecord) return;
      setAssessment(updatedAssessment);
      try {
          const res = await saveArchive(healthRecord, updatedAssessment, schedule, followUps, riskAnalysis);
          if (!res.success) throw new Error(res.message);
          await refreshArchives();
          alert("评估方案已更新保存");
      } catch (e: any) {
          alert("保存失败: " + e.message);
      }
  };

  const syncFollowUpToHealthRecord = (original: HealthRecord, latest: FollowUpRecord): HealthRecord => {
      const updated = JSON.parse(JSON.stringify(original));
      if (latest.indicators.weight > 0) updated.checkup.basics.weight = latest.indicators.weight;
      if (latest.indicators.sbp > 0) updated.checkup.basics.sbp = latest.indicators.sbp;
      if (latest.indicators.dbp > 0) updated.checkup.basics.dbp = latest.indicators.dbp;
      if (updated.checkup.basics.weight && updated.checkup.basics.height) {
          const h = updated.checkup.basics.height / 100;
          updated.checkup.basics.bmi = parseFloat((updated.checkup.basics.weight / (h * h)).toFixed(1));
      }
      if (latest.indicators.glucose > 0 && latest.indicators.glucoseType === '空腹') {
          if (!updated.checkup.labBasic.glucose) updated.checkup.labBasic.glucose = {};
          updated.checkup.labBasic.glucose.fasting = latest.indicators.glucose.toString();
      }
      return updated;
  };

  const handleAddFollowUp = async (record: Omit<FollowUpRecord, 'id'>) => {
    const newRecord = { ...record, id: Date.now().toString() };
    const updatedFollowUps = [...followUps, newRecord];
    setFollowUps(updatedFollowUps);
    let updatedSchedule = schedule.map(s => s.status === 'pending' ? { ...s, status: 'completed' as const } : s);
    const nextItem = generateNextScheduleItem(newRecord.date, newRecord.assessment.nextCheckPlan || "", newRecord.assessment.riskLevel);
    updatedSchedule = [...updatedSchedule, nextItem];
    setSchedule(updatedSchedule);

    let updatedHealthRecord = healthRecord;
    if (healthRecord) {
        updatedHealthRecord = syncFollowUpToHealthRecord(healthRecord, newRecord);
        setHealthRecord(updatedHealthRecord); 
    }
    if (healthRecord?.profile.checkupId) {
        await updateArchiveData(healthRecord.profile.checkupId, updatedFollowUps, updatedSchedule, updatedHealthRecord || undefined);
        await refreshArchives();
    }
  };

  const handleManualDataUpdate = async (updatedRecord: FollowUpRecord, updatedSchedule: ScheduledFollowUp[]) => {
      const updatedFollowUps = followUps.map(r => r.id === updatedRecord.id ? updatedRecord : r);
      setFollowUps(updatedFollowUps);
      setSchedule(updatedSchedule);
      if (healthRecord?.profile.checkupId) {
          await updateArchiveData(healthRecord.profile.checkupId, updatedFollowUps, updatedSchedule);
          await refreshArchives();
      }
  };

  // --- RENDER LOGIC ---

  // Mode 1: Landing Page
  if (appMode === 'landing') {
      return (
          <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-4xl w-full flex flex-col md:flex-row overflow-hidden animate-fadeIn">
                  {/* Left: Branding */}
                  <div className="md:w-1/2 p-6 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-100">
                      <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mb-6 shadow-lg shadow-teal-200">
                          Z
                      </div>
                      <h1 className="text-3xl font-bold text-slate-800 mb-2">郑州大学医院</h1>
                      <h2 className="text-xl text-slate-500 mb-6 font-light">智能健康管理中心</h2>
                      <p className="text-sm text-slate-400 leading-relaxed">
                          基于 DeepSeek AI 引擎构建，为您提供全维度的健康档案管理、风险评估与个性化干预服务。
                      </p>
                  </div>

                  {/* Right: Actions */}
                  <div className="md:w-1/2 p-6 flex flex-col justify-center space-y-8 bg-slate-50/50">
                      {/* Admin Entry */}
                      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-teal-400 transition-all cursor-pointer group" onClick={() => setShowLoginModal(true)}>
                          <div className="flex items-center gap-4 mb-2">
                              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-xl group-hover:bg-teal-100 group-hover:text-teal-600 transition-colors">👨‍⚕️</div>
                              <div>
                                  <h3 className="font-bold text-slate-700">管理后台入口</h3>
                                  <p className="text-xs text-slate-400">医生工作台 / 健康社区维护</p>
                              </div>
                          </div>
                      </div>

                      {/* User Entry (Phone Login) */}
                      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                          <div className="flex items-center gap-4 mb-4">
                              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-xl text-blue-500">🧑‍💼</div>
                              <div>
                                  <h3 className="font-bold text-slate-700">我是教职工</h3>
                                  <p className="text-xs text-slate-400">验证手机号登录健康管家</p>
                              </div>
                          </div>
                          
                          <div className="space-y-3">
                              <div className="flex gap-2">
                                  <input 
                                      type="tel" 
                                      placeholder="请输入手机号" 
                                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                      value={userPhone}
                                      onChange={e => setUserPhone(e.target.value)}
                                      disabled={isCodeSent}
                                  />
                                  <button 
                                      onClick={handleSendVerifyCode}
                                      disabled={isCodeSent}
                                      className="bg-blue-100 text-blue-600 px-3 py-2 rounded-lg font-bold text-xs hover:bg-blue-200 disabled:opacity-50 whitespace-nowrap"
                                  >
                                      {isCodeSent ? '已发送' : '获取验证码'}
                                  </button>
                              </div>
                              
                              {isCodeSent && (
                                  <div className="animate-fadeIn">
                                      <input 
                                          type="text" 
                                          placeholder="输入验证码 (8888)" 
                                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none mb-3"
                                          value={userVerifyCode}
                                          onChange={e => setUserVerifyCode(e.target.value)}
                                      />
                                      <button 
                                          onClick={handleUserLogin}
                                          disabled={userLoginLoading}
                                          className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-100 disabled:opacity-70 flex items-center justify-center"
                                      >
                                          {userLoginLoading ? '正在验证...' : '登录'}
                                      </button>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
              
              <LoginModal 
                isOpen={showLoginModal} 
                onClose={() => setShowLoginModal(false)}
                onLoginSuccess={handleAdminLoginSuccess}
              />
          </div>
      );
  }

  // Mode 2: User App
  if (appMode === 'user') {
      return (
          <UserApp 
              checkupId={userCheckupId} 
              onLogout={() => { 
                  setAppMode('landing'); 
                  setUserCheckupId(''); 
                  setUserPhone('');
                  setUserVerifyCode('');
                  setIsCodeSent(false);
              }} 
          />
      );
  }

  // Mode 3: Home Admin Portal
  if (appMode === 'home_admin') {
      return (
          <HomeAdmin onLogout={() => { setIsAuthenticated(false); setAppMode('landing'); }} />
      );
  }

  // Mode 4: Main Admin Console (Doctor's Workbench)
  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      isAuthenticated={isAuthenticated}
      onLoginClick={() => setShowLoginModal(true)}
      onLogoutClick={() => {
          setIsAuthenticated(false);
          setAppMode('landing');
      }}
    >
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleAdminLoginSuccess}
      />

      {isGenerating && (
          <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center backdrop-blur-sm">
              <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
                  <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <h3 className="text-lg font-bold text-slate-800">AI 正在深度分析中...</h3>
              </div>
          </div>
      )}

      {activeTab === 'dashboard' && (
         <div className="text-center py-20 animate-fadeIn">
            <h2 className="text-4xl font-bold text-slate-800 mb-6 tracking-tight">郑州大学医院健康管理系统 v3.0 (Admin)</h2>
            <div className="flex justify-center gap-4">
                <button onClick={() => { setHealthRecord(null); setActiveTab('survey'); }} className="bg-white text-teal-600 border border-teal-200 px-8 py-3 rounded-lg hover:bg-teal-50 shadow-sm transition-all">
                    开始单人建档
                </button>
                <button onClick={() => setActiveTab('admin')} className="bg-teal-600 text-white px-8 py-3 rounded-lg shadow-lg hover:bg-teal-700 transition-all">
                    进入全科医生工作台
                </button>
            </div>
         </div>
      )}
      
      {activeTab === 'admin' && (
        <AdminConsole 
            isAuthenticated={isAuthenticated}
            onSelectPatient={handleSelectPatient} 
            onDataUpdate={refreshArchives}
            onTabChange={setActiveTab} 
        />
      )}
      
      {activeTab === 'heatmap' && (
          <HospitalHeatmap archives={archives} onRefresh={refreshArchives} onSelectPatient={(arch) => handleSelectPatient(arch, 'assessment')} />
      )}
      
      {activeTab === 'risk_portrait' && healthRecord && (
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6">
              <SystemRiskPortrait 
                  record={healthRecord} 
                  existingAnalysis={riskAnalysis} 
                  onUpdate={refreshArchives} 
              />
          </div>
      )}
      
      <div className={activeTab === 'survey' ? 'block h-full' : 'hidden'}>
          <HealthSurvey onSubmit={handleSurveySubmit} initialData={healthRecord} isLoading={isGenerating} />
      </div>

      {activeTab === 'assessment' && assessment && healthRecord && (
        <AssessmentReport 
            assessment={assessment} patientName={healthRecord.profile.name} profile={healthRecord.profile}
            healthRecord={healthRecord} riskAnalysis={riskAnalysis}
            onSave={handleSaveAssessment} onUpdateReport={handleUpdateCheckupReport} 
            onUpdateRiskAnalysis={refreshArchives} onSupplementQuestionnaire={() => setActiveTab('external_survey')}
        />
      )}
      
      {activeTab === 'followup' && (
        <FollowUpDashboard 
            records={followUps} assessment={assessment} schedule={schedule} onAddRecord={handleAddFollowUp}
            onUpdateData={handleManualDataUpdate} allArchives={archives} onPatientChange={(arch) => handleSelectPatient(arch, 'followup')}
            currentPatientId={healthRecord?.profile.checkupId} isAuthenticated={isAuthenticated}
        />
      )}

      {activeTab === 'external_survey' && (
          <NativeSurveyForm onSubmit={handleQuestionnaireSupplement} isLoading={isGenerating} initialCheckupId={healthRecord?.profile.checkupId} />
      )}
    </Layout>
  );
};

export default App;
