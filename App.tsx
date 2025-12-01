
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { HealthSurvey } from './components/HealthSurvey';
import { AssessmentReport } from './components/AssessmentReport';
import { FollowUpDashboard } from './components/FollowUpDashboard';
import { AdminConsole } from './components/AdminConsole';
import { LoginModal } from './components/LoginModal';
import { HospitalHeatmap } from './components/HospitalHeatmap';
// import { SystemRiskPortrait } from './components/SystemRiskPortrait'; // Removed Standalone
import { HealthRecord, HealthAssessment, FollowUpRecord, ScheduledFollowUp, RiskAnalysisData } from './types'; 
import { generateHealthAssessment, generateFollowUpSchedule } from './services/geminiService';
import { HealthArchive, updateArchiveData, generateNextScheduleItem, saveArchive, fetchArchives } from './services/dataService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('followup');
  const [healthRecord, setHealthRecord] = useState<HealthRecord | null>(null);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [schedule, setSchedule] = useState<ScheduledFollowUp[]>([]);
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysisData | undefined>(undefined); 
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [archives, setArchives] = useState<HealthArchive[]>([]);

  const refreshArchives = async () => {
      try {
          const data = await fetchArchives();
          setArchives(data);
      } catch (e) {
          console.error("Failed to refresh archives:", e);
      }
  };

  useEffect(() => {
      refreshArchives();
  }, []);

  const handleSelectPatient = (archive: HealthArchive, mode: 'view' | 'edit' | 'followup' = 'view') => {
      setHealthRecord(archive.health_record);
      setAssessment(archive.assessment_data);
      setSchedule(archive.follow_up_schedule || []);
      setFollowUps(archive.follow_ups || []);
      setRiskAnalysis(archive.risk_analysis); 
      
      if (mode === 'edit') {
          setActiveTab('survey');
      } else if (mode === 'followup') {
          setActiveTab('followup');
      } else {
          setActiveTab('assessment');
      }
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
      
      if (!saveResult.success) {
          throw new Error("保存失败: " + saveResult.message);
      }

      await refreshArchives();
      setActiveTab('assessment');
    } catch (error) {
      alert("处理失败: " + (error instanceof Error ? error.message : "未知错误"));
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

  const handleAddFollowUp = async (record: Omit<FollowUpRecord, 'id'>) => {
    if (!healthRecord || !assessment) {
        alert("错误：缺少基础健康档案，无法保存。");
        return;
    }

    const newRecord = { ...record, id: Date.now().toString() };
    // 1. Update Local State
    const updatedFollowUps = [...followUps, newRecord];
    setFollowUps(updatedFollowUps);

    // 2. Update Schedule (Mark current pending as done, add next one)
    const currentPending = schedule.find(s => s.status === 'pending');
    let updatedSchedule = schedule.map(s => s.status === 'pending' ? { ...s, status: 'completed' as const } : s);
    
    // Generate new next item based on current record date + risk level
    const nextItem = generateNextScheduleItem(
        newRecord.date, 
        newRecord.assessment.nextCheckPlan || assessment.followUpPlan.nextCheckItems.join(','), 
        assessment.riskLevel
    );
    updatedSchedule = [...updatedSchedule, nextItem];
    setSchedule(updatedSchedule);

    try {
        // 3. Save to DB (Only save updated follow-ups and schedule. Do NOT modify HealthRecord or Assessment)
        const saveResult = await saveArchive(
            healthRecord, 
            assessment,       
            updatedSchedule,      
            updatedFollowUps,    
            riskAnalysis         
        );

        if (!saveResult.success) {
            throw new Error(saveResult.message);
        }

        // 4. Refresh background data (optional, to keep sync)
        refreshArchives();
        
        alert(`✅ 随访记录已保存。\n\n下阶段健康管理执行单已更新。`);
        // Stay on Dashboard to see the updated sheet
        
    } catch (e) {
        console.error("Save failed:", e);
        alert("保存失败: " + (e instanceof Error ? e.message : "未知错误"));
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

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      isAuthenticated={isAuthenticated}
      onLoginClick={() => setShowLoginModal(true)}
      onLogoutClick={() => setIsAuthenticated(false)}
    >
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={() => {
            setIsAuthenticated(true);
            refreshArchives();
        }}
      />

      {activeTab === 'dashboard' && (
         <div className="text-center py-20 animate-fadeIn">
            <h2 className="text-4xl font-bold text-slate-800 mb-6 tracking-tight">郑州大学医院健康管理系统 v3.0</h2>
            <p className="text-slate-500 mb-10 text-lg max-w-2xl mx-auto">
                基于 DeepSeek AI 引擎构建。<br/>
                集成 11项基础体检 + 20项自选项目 + 59项详细健康问卷的全维度健康档案。
            </p>
            <div className="flex justify-center gap-4">
                <button onClick={() => { setHealthRecord(null); setActiveTab('survey'); }} className="bg-white text-teal-600 border border-teal-200 px-8 py-3 rounded-lg hover:bg-teal-50 shadow-sm transition-all">
                    开始单人建档
                </button>
                <button 
                  onClick={() => {
                      if (isAuthenticated) setActiveTab('admin');
                      else setShowLoginModal(true);
                  }} 
                  className="bg-teal-600 text-white px-8 py-3 rounded-lg shadow-lg hover:bg-teal-700 transition-all transform hover:scale-105"
                >
                    {isAuthenticated ? '进入管理控制台' : '管理员登录'}
                </button>
            </div>
         </div>
      )}
      
      {activeTab === 'admin' && (
        <AdminConsole 
            isAuthenticated={isAuthenticated}
            onSelectPatient={handleSelectPatient} 
            onDataUpdate={refreshArchives} 
        />
      )}
      
      {activeTab === 'heatmap' && (
          <HospitalHeatmap archives={archives} onRefresh={refreshArchives} />
      )}
      
      <div className={activeTab === 'survey' ? 'block h-full' : 'hidden'}>
          <HealthSurvey onSubmit={handleSurveySubmit} initialData={healthRecord} isLoading={isGenerating} />
      </div>

      {activeTab === 'assessment' && assessment && healthRecord && (
        <AssessmentReport 
            assessment={assessment} 
            patientName={healthRecord.profile.name} 
            profile={healthRecord.profile}
            healthRecord={healthRecord}
            riskAnalysis={riskAnalysis}
            onSave={handleSaveAssessment}
            onReevaluate={() => setActiveTab('survey')}
            onUpdateRiskAnalysis={refreshArchives}
        />
      )}
      
      {activeTab === 'followup' && (
        <FollowUpDashboard 
            records={followUps} 
            assessment={assessment} 
            schedule={schedule} 
            onAddRecord={handleAddFollowUp}
            onUpdateData={handleManualDataUpdate}
            allArchives={archives}
            onPatientChange={(arch) => handleSelectPatient(arch, 'followup')}
            currentPatientId={healthRecord?.profile.checkupId}
        />
      )}
      
      {activeTab === 'risk_portrait' && healthRecord && (
          <div className="bg-white p-6 rounded-xl shadow border border-slate-200 h-full overflow-y-auto">
               {/* Reusing existing component in a dedicated tab */}
               {/* Note: In a real app we would import SystemRiskPortrait here, but I commented it out in imports per original file */}
               {/* <SystemRiskPortrait 
                  record={healthRecord} 
                  existingAnalysis={riskAnalysis} 
                  onUpdate={refreshArchives} 
              /> */}
              <div className="text-center text-slate-400 mt-20">请在“评估报告”中查看画像</div>
          </div>
      )}
    </Layout>
  );
};

export default App;
